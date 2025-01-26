/**
 * convert a fraction like '1/2' into an number 0.5
 * 
 * @param {*} fraction 
 * @returns 
 */
export function fractionToDecimal(fraction) {
    const [numerator, denominator] = fraction.split('/').map(Number);
    if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
        return NaN; // not a fraction
    }
    return numerator / denominator;
}
/**
 * decode Unicode characters to standard string
 *
 * @export
 * @param {*} str
 * @return {*} 
 */
export function decodeUnicode(str) {
    if (str === null || str === undefined) return str;
    return str.replace(/&#(\d+);/g, function(match, dec) {
        return String.fromCharCode(dec);
    });
}
/**
 * remove text in parentheses out of a given text
*
* @param {*} text text to convert
* @return {*} text without parentheses
*/
export function removeTextInParenthesesAndExtraSpaces(text) {
    let cleanedText = text.replace(/\(.*?\)/g, '');
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    return cleanedText;
}

/**
 * get the text inside parentheses on first occurrence
 *
 * @export
 * @param {*} text to be analyzed
 * @param {string} [append=''] Optional a string to be appended after the found text
 * @return {*} 
 */
export function getTextInParentheses(text, append = '') {
    const parenthesesStart = text.indexOf('(');
    const parenthesesEnd = text.indexOf(')');
    let textInParentheses = '';
    
    if (parenthesesStart !== -1 && parenthesesEnd !== -1) {
        textInParentheses = text.substring(parenthesesStart + 1, parenthesesEnd) + append;
    }
    return textInParentheses;
}
/**
 * remove punctuation out of a string
 * @param {String} str  text 
 * @returns 
 */
export function removePunctuation(str) {
    return str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
}
/**
 * remove duplicates in an array of objects comparing a single key
 *
 * @export
 * @param {Array} array of objects
 * @param {String} key to match
 * @return {*} 
 */
export function removeDuplicates(array, key) {
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
