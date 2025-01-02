
async function convertToWebp(image, type, option) {
    return webp.str2webpstr(image, type, option)
    .then(function(result) {
        return result;
    })
    .catch((error) => {
        console.log(error);
    });;
}

function base64ToBytes(inputString) {
    const binaryString = atob(inputString);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
function bufferToBytes(input) {
    const bytes = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
        bytes[i] = input[i];
    }
    return bytes;
}
function bufferToString(input) {
    var returnString = new String(input.length);
    for (let i = 0; i < input.length; i++) {
        returnString += String.fromCharCode(input[i]);
    }
    return returnString;
}

function saveBase64Image(base64Str, filePath) {
    const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFile(filePath, buffer, (err) => {
        if (err) {
            console.error('Fehler beim Speichern der Datei:', err);
        } else {
            console.log('Datei erfolgreich gespeichert:', filePath);
        }
    });
}