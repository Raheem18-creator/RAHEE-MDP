// utils/gen-id.js
/**
 * Generates a short, random alphanumeric ID.
 * @returns {string} A 5-character random ID.
 */
function makeid() {
    let result = '';
    // Characters to use for generating the ID
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0987654321';
    const charactersLength = characters.length;
    // Generate a 5-character ID
    for (let i = 0; i < 5; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

module.exports = { makeid };
