import fs from 'fs';
import path  from 'path';
import Fuse  from 'fuse.js';
import { randomUUID } from 'crypto';
import Axios from 'axios';
import FormData from 'form-data';
import { exit } from 'process';
import { builtinModules } from 'module';
import { BASE_URL, TOKEN } from './credentials.js';
import * as MealieAPI from './mealieAPI.js';
import * as Tools from './tools.js';

var mealieRecipes = {};
var mealieFoods = {};
var mealieUnits = {};
var createCount = 0;
var updateCount = 0;

// translation matrix, translate to your language as fuzzy search sometimes give false results
const TRANSLATE_UNITS = JSON.parse(fs.readFileSync('units.json'));
const LOCALIZATION = JSON.parse(fs.readFileSync('localization.json'));

const MEALIE_UNIT_FUSE_OPTIONS = {
    isCaseSensitive: false,
	includeScore: true,
	// shouldSort: true,
	// includeMatches: false,
	// findAllMatches: false,
	// minMatchCharLength: 1,
	// location: 0,
	// threshold: 0.6,
	// distance: 100,
	// useExtendedSearch: false,
	// ignoreLocation: false,
	// ignoreFieldNorm: false,
	// fieldNormWeight: 1,
	keys: [
        "name",
		"pluralName",
        "abbreviation",
        "pluralAbbreviation",
        "description"
	]
};

const MEALIE_INGREDIENT_FUSE_OPTIONS = {
    isCaseSensitive: false,
	includeScore: true,
	// shouldSort: true,
	// includeMatches: false,
	// findAllMatches: false,
	// minMatchCharLength: 1,
	// location: 0,
	threshold: 0.01,
	// distance: 100,
	// useExtendedSearch: false,
	// ignoreLocation: false,
	// ignoreFieldNorm: false,
	// fieldNormWeight: 1,
	keys: [
        "name",
        "pluralName",
		"originalText"
	]
};

console.log('Menu Planer to Mealie');
console.log('(c) Christian Meinert')
console.log('---------------------');



function getPluralForm(text) {
    const parenthesesStart = text.indexOf('(');
    const parenthesesEnd = text.indexOf(')');
    let textInParentheses = '';
    
    if (parenthesesStart !== -1 && parenthesesEnd !== -1) {
        textInParentheses = text.substring(parenthesesStart + 1, parenthesesEnd);
        if (textInParentheses.length<3) {
            return text.substring(0,parenthesesStart) + textInParentheses;
        }
    }
    return '';
}


function getMpFoodItemById(mpRecipe, id) {
    if (id === null) return undefined;
    for (let mpFoodItem of mpRecipe.FoodItems) {
        if (mpFoodItem.ID === id) return mpFoodItem;
    }
    return undefined;
}

function getMealieFood(mealieFoods, foodItem) {
    let foodName = Tools.decodeUnicode(Tools.removeTextInParenthesesAndExtraSpaces(foodItem.Name));
    let mealieFood = mealieFoods.find((mealieFood) => (mealieFood.name === foodName)||(mealieFood.pluralName === foodName));
    if (mealieFood === undefined) { // find by fuzzy search
        const fuse = new Fuse(mealieFoods, MEALIE_INGREDIENT_FUSE_OPTIONS);
        let fuzeResult = fuse.search(foodName);
        if (fuzeResult !== undefined && fuzeResult.length>0) {
            mealieFood = fuzeResult[0].item;
            console.log(` fuzzy search for "${foodName}" found ${fuzeResult.length} results. Best result "${mealieFood.name}" Score:${fuzeResult[0].score}.`)
        } else {
            console.log(` fuzzy search for "${foodName}" FAILED!`);
        }
    }
    return mealieFood; 
}

function getMealieUnit(mealieUnits, mpUnits, mpIngredient) {
    let mpUnitRecord = undefined;
    let mealieUnit = undefined;
    if (mpIngredient.MeasurementUnit_ID !== null) {
        mpUnitRecord = mpUnits.find((mpRecord) => mpRecord.ID === mpIngredient.MeasurementUnit_ID); // found menu planner unit
    } else {
        if (mpIngredient.AmountPartString !== null) {
            mpUnitRecord = {Name : mpIngredient.AmountPartString}; // use unit string in ingredient list
        }
        if (mpIngredient?.AmountPartString === '') {
            console.log(` Menu Planner unit is empty!`)
            return mealieUnit;
        }
    }
    if (mpUnitRecord === undefined) { // still no succes in finding any unit information
        console.log(` cannot find menu planner unit!`);
        return mealieUnit;
    }
    if (TRANSLATE_UNITS.hasOwnProperty(mpUnitRecord.DisplayAs)) { // if there is a direct match in TRANSLATE_UNITS use this
        mpUnitRecord.Name = TRANSLATE_UNITS[mpUnitRecord.DisplayAs];
    }
    mealieUnit = mealieUnits.find((mealieUnit) => (mealieUnit.name.toLowerCase().trim() === mpUnitRecord.Name.toLowerCase().trim())||(mealieUnit.abbreviation.toLowerCase().trim() === mpUnitRecord.Name.toLowerCase().trim()));
    if (mealieUnit === undefined) { //find by fuzzy search
        const fuse = new Fuse(mealieUnits, MEALIE_UNIT_FUSE_OPTIONS);
        let fuzeResult = fuse.search(mpUnitRecord.Name)
        if (fuzeResult !== undefined && fuzeResult.length>0) {
            mealieUnit = fuzeResult[0].item;
            console.log(` fuzzy search for "${mpUnitRecord.Name}" found ${fuzeResult.length} results. Best result "${mealieUnit.name}".`)
        } else {
            console.log(` fuzzy search for "${mpUnitRecord.Name} FAILED!`);
        }
    }
    
    return mealieUnit;
}

console.log('Calling API for existing recipes ...')
mealieRecipes = await MealieAPI.readMealieRecipes();
if (mealieFoods === undefined) {
    console.error(`Failed to revive recipes form mealie. Is Mealie running and accessible on ${BASE_URL}?`)
    exit(500);
}
console.log(` Existing recipes in Mealie: ${mealieRecipes.items.length}`);
console.log('Calling API for existing foods ...')
mealieFoods = await MealieAPI.readMealieFoods();
if (mealieFoods !== undefined) {
    mealieFoods = mealieFoods.items;
} else {
    console.log("Can't read melanie foods! Exiting");
    exit(500);
}
console.log(` Existing foods in Mealie: ${mealieFoods.length}`);

console.log('Calling API for existing Units ...')
mealieUnits = await MealieAPI.readMealieUnits();
if (mealieUnits !== undefined) {
    mealieUnits = mealieUnits.items;
} else {
    console.log("Can't read melanie Units! Exiting");
    exit;
}

console.log(` Existing units in Mealie: ${mealieUnits.length}`);

async function readMenuPlannerFile(mpFileName) {
    let rawData = fs.readFileSync(mpFileName);
    let mpRecipes = JSON.parse(rawData);
    console.log(`Reading MenuPlanner File "${mpFileName}"`)
    for (let mpRecipe of mpRecipes) {
        let mealieData = {};
        let currentSlug = "";
        let mealieFoodList = [];
        console.log(`Prepare MenuPlanner units: ${mpRecipe.MeasurementUnits.length}`);
        let mpUnits = mpRecipe.MeasurementUnits.map((mpUnit) => {
            mpUnit.AliasesArray=mpUnit.Aliases.split(',');
            mpUnit.mealieAliases=mpUnit.AliasesArray.map((alias) => { return {name: alias}});
            return mpUnit;
        });
        let menuPlannerRecipe = mpRecipe.Recipe;
        var recipeExists = mealieRecipes.items.find((value) => {return value.name === mpRecipe.Recipe.Name});
        console.log(` Recipe name "${menuPlannerRecipe.Name}" ${recipeExists!==undefined ? 'already existing. Updating!' : 'is new'}`);
        // create recipe
        if (recipeExists === undefined) { // create non existing recipes
            console.log(`  Creating recipe "${menuPlannerRecipe.Name}"`);
            let response = await MealieAPI.createRecipe(menuPlannerRecipe.Name);
            if (response.status === 201) {
                console.log(`"${response.data}" created!`);
                currentSlug = response.data;
                createCount++;
            } else {
                console.error(`Error! Could not create recipe!`,menuPlannerRecipe.Name)
                continue;
            }
        } else { //get slug of existing recipes
            currentSlug = recipeExists.slug;
        }
        // save menu planner recipe
        let mpFileName = '.\\mpRecipes\\' + currentSlug + ".mpxr";
        fs.writeFile(mpFileName, JSON.stringify(mpRecipes), (err) => {
            if (err) {
                console.error('Error saving:', err);
            }
        });
        console.log(`recipe saved to ${mpFileName}`);
        // split servings field
        menuPlannerRecipe.recipeYieldText = "";
        if (isNaN(Number(menuPlannerRecipe.NumberOfServings))) {
            let servingsSplitted = menuPlannerRecipe.NumberOfServings.split(' ');
            menuPlannerRecipe.NumberOfServings = LOCALIZATION.defaultYield; // default value
            for (let servingsToken of servingsSplitted) {
                if (!isNaN(Number(servingsToken))) {
                    menuPlannerRecipe.NumberOfServings = Number(servingsToken)
                } else {
                    menuPlannerRecipe.recipeYieldText += servingsToken + " ";
                }
            }
            console.log(`servings / yield splitted into ${menuPlannerRecipe.NumberOfServings} ${menuPlannerRecipe.recipeYieldText}`);
        }
        // update recipe
        mealieData = {
            "prepTime": menuPlannerRecipe.PrepTime,
            "cookTime": menuPlannerRecipe.CookTime,
            "orgURL" : menuPlannerRecipe.SourceURL,
            "rating" : Math.round(menuPlannerRecipe.Rating),
            "recipeServings": menuPlannerRecipe.NumberOfServings,
            "recipeYieldQuantity": menuPlannerRecipe.NumberOfServings,
            "recipeYield" : (menuPlannerRecipe.recipeYieldText==="") ? LOCALIZATION.yieldText : menuPlannerRecipe.recipeYieldText,
            "recipeIngredient" : [],
            "recipeInstructions" : []
        }
        // update ingredients
        let title = undefined;
        for (let mpIngredient of mpRecipe.RecipeIngredients) {
            let quantity = undefined;
            let note = undefined;
            let food = undefined;
            let unit = undefined;
            let display = undefined;
            let originalMpFoodName = undefined;
            let originalMpFoodNote = undefined;
            let mpFoodItem = getMpFoodItemById(mpRecipe, mpIngredient.FoodItem_ID);
            if (mpFoodItem === undefined) {
                title = mpIngredient.HeaderName;
                continue;
            } else {
                originalMpFoodName = Tools.decodeUnicode(mpFoodItem.Name);
                originalMpFoodNote = Tools.decodeUnicode(mpFoodItem.Notes);
                if (mpIngredient.AmountPartDouble !== 0) {
                    quantity = mpIngredient.AmountPartDouble;
                    unit = getMealieUnit(mealieUnits, mpUnits, mpIngredient);

                } else {
                    if (mpIngredient.Amount !== null) { // try the get the ammount out fo the Amount String
                        quantity = parseFloat(mpIngredient.Amount);
                        if (isNaN(quantity)) quantity = Tools.fractionToDecimal(mpIngredient.Amount);
                        if (isNaN(quantity)) quantity = undefined;
                        unit = getMealieUnit(mealieUnits, mpUnits, mpIngredient);
                    }
                }
                note = mpIngredient.Notes;
                food = getMealieFood(mealieFoods, mpFoodItem);
                if (food === undefined) { // create new food.
                    food = {
                        "name" : Tools.removeTextInParenthesesAndExtraSpaces(originalMpFoodName),
                        "pluralName" : getPluralForm(Tools.decodeUnicode(originalMpFoodName)),
                        "description" : Tools.getTextInParentheses(originalMpFoodName,originalMpFoodNote?.length>0 ? ' ' : '') + originalMpFoodNote,
                    }
                    food = await MealieAPI.createFood(food);
                    if (food.status<300) {
                        food = food.data;
                        console.log(` food ${food.name} created`)
                    } else {
                        console.error(`ERROR creating food item`,originalMpFoodName);
                        food = undefined;
                    }
                }
                
            };
            let mealieIngredient = mealieData.recipeIngredient[mealieData.recipeIngredient.push({
                quantity,
                unit,
                food,
                note,
                display,
                title,
                originalText: originalMpFoodName,
                reference_id: randomUUID(),
            })-1];
            console.log(`Quantity: ${mealieIngredient.quantity} ${mealieIngredient.unit?.abbreviation} (${mealieIngredient.unit?.name}) name: "${mealieIngredient.food?.name}" note: "${mealieIngredient.note}"`)
            title = undefined;
            // build foods list for later search
            mealieFoodList.push({id: mealieIngredient.reference_id, name: mealieIngredient.food?.name, pluralName: mealieIngredient.food?.pluralName, originalText: mealieIngredient.originalText });
        }

        // update instructions
        if (mpRecipe.RecipeSteps.length>0) { // It seams that all menu planner recipes have only one step (maybe was planned for a future option)
            let mpRecipeStepCount = 0;
            for (let mpRecipeStep of mpRecipe.RecipeSteps) {
                let mpRecipeSubSteps = Tools.decodeUnicode(mpRecipeStep.StepText).split('\n'); // split every paragraph of step 1
                let mpRecipeSubStepCount = 0;
                mpRecipe.RecipeSteps = [];
                mpRecipeStepCount++;
                for (let mpRecipeSubStep of mpRecipeSubSteps) {
                    if (mpRecipeSubStep.length > 5) { // ignore small steps as they might my multiple new lines
                        mpRecipeSubStepCount++;
                        mpRecipe.RecipeSteps.push({StepText : mpRecipeSubStep.trim()})
                    }
                }
                console.log(`  reading instruction ${mpRecipeStepCount}/${mpRecipe.RecipeSteps.length} with ${mpRecipeSubStepCount} steps`)
            }
            console.log(`created ${mpRecipe.RecipeSteps.length} steps total`);
        }

        //link ingredients to recipe steps
        const fuse = new Fuse(mealieFoodList, MEALIE_INGREDIENT_FUSE_OPTIONS);
        for (let mpInstruction of mpRecipe.RecipeSteps) {
            let stepText = "";
            let instructionWords = mpInstruction.StepText.split(' ');
            let ingredientReferences = [];
            let instructionWordSearch = "";
            // search for ingredients in instruction text
            for (let instructionWord of instructionWords) {
                if (instructionWord.length>3) {
                    instructionWordSearch = Tools.removePunctuation(instructionWord);
                    // first try a perfect match 
                    let fuzeResult = fuse.search(instructionWordSearch,{location:0, threshold:0, includeScore:0, distance:0}); // first try a perfect match
                    if (fuzeResult.length===0) { // if this fails try a similar match
                        fuzeResult = fuse.search(instructionWordSearch);
                    }
                    if (fuzeResult !== undefined && fuzeResult.length>0) {
                        ingredientReferences.push({referenceId:fuzeResult[0].item.id});
                        console.log(` fuzzy search for "${instructionWord}" found ${fuzeResult.length} results. Best result "${fuzeResult[0].item.name}" (${fuzeResult[0].score.toFixed(5)}).`)
                        stepText += "**" + instructionWord + "** ";
                    } else {
                        stepText += instructionWord + " ";
                    }
                } else {
                    stepText += instructionWord + " ";
                }

            }
            const uniqueIngredientReferences = Tools.removeDuplicates(ingredientReferences, 'referenceId');
            mealieData.recipeInstructions.push(
                {
                    "text": stepText.trim(),
                    "ingredient_references": uniqueIngredientReferences,
                }
            )
        }
        // add note if present
        if (mpRecipe.Recipe.Notes!==null && mpRecipe.Recipe.Notes!=='') {
            mealieData.notes=[{
                "title" : "Menu Planner",
                "text" : mpRecipe.Recipe.Notes,
            }]
        }
        // finally update the recipe
        let response = await MealieAPI.updateRecipe(currentSlug, mealieData);
        if (response!== undefined && response.status < 300) {
            console.log(`"${currentSlug}" recipe updated! (${response.status} ${response.statusText})`);
            updateCount++;
        } else {
            console.error(`Error! Could not update "${currentSlug}" (${response.status} ${response.statusText})`)
            continue;
        }
        // update image
        if (mpRecipe.Image !== undefined) {
            const formData = new FormData();
            formData.append('image',Buffer.from(mpRecipe.Image, 'base64'), {
                filename: 'image.jpg',
                contentType: 'image/jpeg',
            });
            formData.append('extension','jpg')
            
            response = await Axios.put(BASE_URL+'/api/recipes/'+currentSlug+'/image', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'accept' : 'application/json',
                    'Authorization': `Bearer ${TOKEN}`,
                },
            });

            if (response!== undefined && response.status < 300) {
                console.log(`"${currentSlug}" image updated! (${response.status} ${response.statusText})`);
                // save image
                var filePath = '.\\mpRecipes\\' + currentSlug + ".jpg";
                fs.writeFile(filePath, Buffer.from(mpRecipe.Image, 'base64'), (err) => {
                    if (err) {
                        console.error('Error saving image:', err);
                    } else {
                        console.log(`Image saved to ${filePath}:`);
                    }
                });
            } else {
                console.error(`Error! Could not update image for "${currentSlug}" (${response.status} ${response.statusText})`)
                continue;
            }
        
        }
    }
}

// first import all files in import directory
var importFiles = fs.readdirSync('./import');
var bulkImportCount = 0;
if (importFiles.length > 0) {
    for (let importFile of importFiles) {
        if (path.extname(importFile) === '.mpxr') {
            await readMenuPlannerFile('./import/' + importFile);
            bulkImportCount++;
        }
    }
} 
// import 'Menu Planner Recipe.mpxr'
if (bulkImportCount < 1) {
    await readMenuPlannerFile('Menu Planner Recipe.mpxr');
}

console.log(`finished importing ${createCount > 0 ? createCount : 'no'} new recipe(s) ${updateCount} updated`)

