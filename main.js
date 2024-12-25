// import - functions
const { showWelcomeScreen } = require('./src/gui/dashboard');
const validationsPathandContents = require('./src/validations/pathsAndContents');

// start - verify - clear
console.clear();
validationsPathandContents();

// start - menu - clear
console.clear();
setTimeout(() => {
    showWelcomeScreen();
}, 500);