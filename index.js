import fs from 'fs';
import Fuse  from 'fuse.js';
import { randomUUID } from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import { exit } from 'process';
import { builtinModules } from 'module';
import { BASE_URL, TOKEN } from './credentials.js';
import * as MealieAPI from './mealieAPI.js';

let rawData = fs.readFileSync('Menu Planner Recipe.mpxr');
let mpRecipes = JSON.parse(rawData);
var mealieRecipes = {};
var mealieFoods = {};
var mealieUnits = {};
var createCount = 0;
var updateCount = 0;

// translation matrix, perhaps translate to your language as fuzzy search sometimes give false results
const TRANSLATE_UNITS = JSON.parse(fs.readFileSync('units.json'));

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
		"originalText"
	]
};

console.log('Menu Planer to Mealie');
console.log('(c) Christian Meinert')
console.log('---------------------');

function fractionToDecimal(fraction) {
    const [numerator, denominator] = fraction.split('/').map(Number);
    if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
        return NaN; // not a fraction
    }
    return numerator / denominator;
}
/**
 * remove text in parentheses out of a given text
*
* @param {*} text text to convert
* @return {*} text without parentheses
*/
function removeTextInParenthesesAndExtraSpaces(text) {
    let cleanedText = text.replace(/\(.*?\)/g, '');
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    return cleanedText;
}

function getTextInParentheses(text, append = '') {
    const parenthesesStart = text.indexOf('(');
    const parenthesesEnd = text.indexOf(')');
    let textInParentheses = '';
    
    if (parenthesesStart !== -1 && parenthesesEnd !== -1) {
        textInParentheses = text.substring(parenthesesStart + 1, parenthesesEnd) + append;
    }
    return textInParentheses;
}

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

function removeDuplicates(array, key) {
    const seen = new Set();
    return array.filter(item => {
        const keyValue = item[key];
        if (seen.has(keyValue)) {
            return false;
        } else {
            seen.add(keyValue);
            return true;
        }
    });
}

function getMpFoodItemById(mpRecipe, id) {
    if (id === null) return undefined;
    for (let mpFoodItem of mpRecipe.FoodItems) {
        if (mpFoodItem.ID === id) return mpFoodItem;
    }
    return undefined;
}

function getMealieFood(mealieFoods, foodItem) {
    let foodName = removeTextInParenthesesAndExtraSpaces(foodItem.Name);
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
    if (TRANSLATE_UNITS.hasOwnProperty(mpUnitRecord.Name)) { // if there is a direct match in TRANSLATE_UNITS use this
        mpUnitRecord.Name = TRANSLATE_UNITS[mpUnitRecord.Name];
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

console.log('Reading MenuPlanner File')
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
    // update recipe
    mealieData = {
        "prepTime": menuPlannerRecipe.PrepTime,
        "cookTime": menuPlannerRecipe.CookTime,
        "orgURL" : menuPlannerRecipe.SourceURL,
        "rating" : Math.round(menuPlannerRecipe.Rating),
        "recipeYield" : menuPlannerRecipe.NumberOfServings + " servings",
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
        let originalText = undefined;
        let mpFoodItem = getMpFoodItemById(mpRecipe, mpIngredient.FoodItem_ID);
        if (mpFoodItem === undefined) {
            title = mpIngredient.HeaderName;
            continue;
        } else {
            originalText = mpFoodItem.Name;
            if (mpIngredient.AmountPartDouble !== 0) {
                quantity = mpIngredient.AmountPartDouble;
                unit = getMealieUnit(mealieUnits, mpUnits, mpIngredient);

            } else {
                if (mpIngredient.Amount !== null) { // try the get the ammount out fo the Amount String
                    quantity = parseFloat(mpIngredient.Amount);
                    if (isNaN(quantity)) quantity = fractionToDecimal(mpIngredient.Amount);
                    if (isNaN(quantity)) quantity = undefined;
                    unit = getMealieUnit(mealieUnits, mpUnits, mpIngredient);
                }
            }
            note = mpIngredient.Notes;
            food = getMealieFood(mealieFoods, mpFoodItem);
            if (food === undefined) { // create new food.
                food = {
                    "name" : removeTextInParenthesesAndExtraSpaces(mpFoodItem.Name),
                    "pluralName" : getPluralForm(mpFoodItem.Name),
                    "description" : getTextInParentheses(mpFoodItem.Name,mpFoodItem.Notes?.length>0 ? ' ' : '') + mpFoodItem.Notes,
                }
                food = await MealieAPI.createFood(food);
                if (food.status<300) {
                    food = food.data;
                    console.log(` food ${food.name} created`)
                } else {
                    console.error(`ERROR creating food item`,mpFoodItem.Name);
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
            originalText,
            reference_id: randomUUID(),
        })-1];
        console.log(`Quantity: ${mealieIngredient.quantity} ${mealieIngredient.unit?.abbreviation} (${mealieIngredient.unit?.name}) name: "${mealieIngredient.food?.name}" note: "${mealieIngredient.note}"`)
        title = undefined;
        // build foods list for later search
        mealieFoodList.push({id: mealieIngredient.reference_id, name: mealieIngredient.food?.name, originalText: mealieIngredient.originalText });
    }

    // update instructions
    if (mpRecipe.RecipeSteps.length===1) { // It seams that all menu planner recipes have only one step (maybe was planned for a future option)
        let mpRecipeSteps = mpRecipe.RecipeSteps[0].StepText.split('\n'); // split every paragraph of step 1
        mpRecipe.RecipeSteps = [];
        for (let mpRecipeStep of mpRecipeSteps) {
            if (mpRecipeStep.length > 5) { // ignore small steps as they might my multiple new lines
                mpRecipe.RecipeSteps.push({StepText : mpRecipeStep.trim()})
            }
        }
        console.log(`created ${mpRecipe.RecipeSteps} steps`);
    }
    const fuse = new Fuse(mealieFoodList, MEALIE_INGREDIENT_FUSE_OPTIONS);
    for (let mpInstruction of mpRecipe.RecipeSteps) {
        let stepText = "";
        let instructionWords = mpInstruction.StepText.split(' ');
        let ingredientReferences = [];
        // search for ingredients in instruction text
        for (let instructionWord of instructionWords) {
            if (instructionWord.length>3) {
                // first try a perfect match 
                let fuzeResult = fuse.search(instructionWord,{location:0, threshold:0, includeScore:0, distance:0}); // first try a perfect match
                if (fuzeResult.length===0) { // if this fails try a similar match
                    fuzeResult = fuse.search(instructionWord);
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
        const uniqueIngredientReferences = removeDuplicates(ingredientReferences, 'referenceId');
        mealieData.recipeInstructions.push(
            {
                "text": stepText.trim(),
                "ingredient_references": uniqueIngredientReferences,
            }
        )
    }
    // add note if present
    if (mpRecipe.Recipe.Notes!=='') {
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
        
        response = await axios.put(BASE_URL+'/api/recipes/'+currentSlug+'/image', formData, {
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
console.log(`finished importing ${createCount > 0 ? createCount : 'no'} new recipe(s) ${updateCount} updated`)

