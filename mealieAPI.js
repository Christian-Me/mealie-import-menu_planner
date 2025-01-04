import Axios from 'axios';
import { BASE_URL, TOKEN } from './credentials.js';

const http = Axios.create({
    baseURL: BASE_URL, 
    headers: {
        'accept' : 'application/json',
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
    }
});

const AXIOS_PUT_DATA_OPTION = {
    baseURL: BASE_URL, 
    headers: {
        'accept' : 'application/json',
        'Content-Type' : 'multipart/form-data',
        'Authorization': `Bearer ${TOKEN}`
    }
};
    
async function makeGetRequest(path) {
    return http.get(path)
    .then((response) => {
        return response.data;
    })
    .catch((error) => {
        console.log(error);
        return error.response;
    });
}

async function makePostRequest(path, data) {
    return http.post(path,data)
    .then((response) => {
        return response;
    })
    .catch((error) => {
        console.log(error);
        return error.response;
    });
}

async function makePutRequest(path, data) {
    return http.put(path,data,AXIOS_PUT_DATA_OPTION)
    .then((response) => {
        return response;
    })
    .catch((error) => {
        console.log(error);
        return error.response;
    });
}

async function makePatchRequest(path, data) {
    return http.patch(path,data)
    .then((response) => {
        return response;
    })
    .catch((error) => {
        console.log(error);
        return error.response;
    });
}

export async function readMealieRecipes() {
    return await makeGetRequest('/api/recipes?page=1&perPage=-1');
}

export async function readMealieFoods() {
    return await makeGetRequest('/api/foods?page=1&perPage=-1');
}

export async function readMealieUnits() {
    return await makeGetRequest('/api/units?page=1&perPage=-1');
}

export async function createRecipe(name) {
    return await makePostRequest('/api/recipes',{name})
}

export async function createFood(food) {
    return await makePostRequest('/api/foods',food)
}

export async function updateRecipe(slug, data) {
    return await makePatchRequest('/api/recipes/'+slug,data)
}

export async function updateImage(slug, data) {
    return await makePutRequest('/api/recipes/'+slug+'/image',data)
}
