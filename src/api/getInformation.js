// fs - path
const { readFile, writeFile } = require("fs");
const { join } = require("path");

// axios - request
const { post } = require("axios");

// chalk - colorize text
const chalk = require("chalk");

// cheerio - parse HTML
const cheerio = require('cheerio');

// Função para salvar os dados no arquivo de saída
module.exports = async function pullInformations(numAccounts, status) {
    return new Promise(async (resolve, reject) => {

        try {

            // gets the information and waits for getInformations to finish
            const accountDetails = await getInformations(numAccounts, status);

            // variable credentials
            let credential
            let combinedLines

            if (status === true) {

                // credentials - file - true
                credential = join(__dirname, "../../data/output/credentialsOnlyCreate.txt");

                // Format combined lines
                combinedLines = accountDetails.map(({ cpf, proxy, email, password, name }) =>
                    `${cpf}:${proxy}:${email}:${password}:${name}`);

            } else if (status === false) {

                // credentials - file - false
                credential = join(__dirname, "../../data/output/credentialsDepositCreate.txt");

                // Format combined lines
                combinedLines = accountDetails.map(({ cpf, proxy, email, password, name, number, zip, street, city, state }) =>
                    `${cpf}:${proxy}:${email}:${password}:${name}:${number}:${zip}:${street}:${city}:${state}`);

            };

            // writes the information to the file
            await writeFilePromise(credential, combinedLines.join("\n"));

            // resolve - success
            resolve()
        } catch (error) {
            reject(error);
        };

    });
};

// function to perform account creation
async function getInformations(numAccounts, status) {

    // cpf and proxies path
    const cpfsPath = join(__dirname, "../../data/input/cpfs.txt");
    const proxiesPath = join(__dirname, "../../data/input/proxies.txt");

    try {

        // read CPF and Proxy files
        const cpfs = await readFilePromise(cpfsPath);
        const proxies = await readFilePromise(proxiesPath);

        // split data into lines
        const cpfLines = cpfs.split("\n").filter(line => line.trim() !== "");
        const proxyLines = proxies.split("\n").filter(line => line.trim() !== "");

        // array to hold account details
        const accountDetails = [];
        const usedCpfs = [];
        const usedProxies = [];
        for (let i = 0; i < numAccounts; i++) {
            const cpf = cpfLines[i];
            const proxy = proxyLines[i];

            // make API request with CPF
            const response = await post('https://lotogreen.com/api/validate/document', {
                document: cpf
            });

            // response - name
            const { name } = response.data;

            // generate email and password from name
            const email = await generateEmail(name);
            const password = await generatePassword(name);

            if (status == true) {

                // push details into the array
                accountDetails.push({ cpf, proxy, email, password, name });
            } else if (status == false) {

                // generate - address
                const { zip, street, city, state } = await getAddress();

                // generate - number
                const number = await generateNumber(state);

                // push details into the array
                accountDetails.push({ cpf, proxy, email, password, name, number, zip, street, city, state });
            };

            // track used CPFs and proxies
            usedCpfs.push(cpf);
            usedProxies.push(proxy);

        };

        // update the original files to remove used CPFs and proxies
        await updateFile(cpfsPath, usedCpfs);
        await updateFile(proxiesPath, usedProxies);

        // returns the combined data
        return accountDetails;
    } catch (error) {
        throw error;
    };
};

// function to make the request and extract the data
async function getAddress() {

    // data to send in the POST request
    const data = new URLSearchParams();
    data.append('acao', 'gerar_cep');
    data.append('cep_estado', '');
    data.append('cep_cidade', '');
    data.append('somente_numeros', 'S');

    // send POST request with axios
    const response = await post("https://www.4devs.com.br/ferramentas_online.php", data, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    // use cheerio to parse HTML
    const $ = cheerio.load(response.data);

    // extract the information
    const zip = $('#cep span').text().trim();
    const street = $('#endereco span').text().trim();
    const city = $('#cidade span').text().trim();
    const state = $('#estado span').text().trim();

    // return the extracted informations
    return { zip, street, city, state };
};

// function to generate a random number from a state
async function generateNumber(state) {

    const dddsByState = {
        'AC': [68],
        'AL': [82],
        'AP': [96],
        'AM': [92, 97],
        'BA': [71, 73, 74, 75, 77],
        'CE': [85, 88],
        'DF': [61],
        'ES': [27, 28],
        'GO': [62, 64],
        'MA': [98, 99],
        'MT': [65, 66],
        'MS': [67],
        'MG': [31, 32, 33, 34, 35, 37, 38],
        'PA': [91, 93, 94],
        'PB': [83],
        'PR': [41, 42, 43, 44, 45, 46],
        'PE': [81, 87],
        'PI': [86, 89],
        'RJ': [21, 22, 24],
        'RN': [84],
        'RS': [51, 53, 54, 55],
        'RO': [69],
        'RR': [95],
        'SC': [47, 48, 49],
        'SP': [11, 12, 13, 14, 15, 16, 17, 18, 19],
        'SE': [79],
        'TO': [63]
    };

    // convert a string to an array of strings
    const ddds = dddsByState[state.toUpperCase()];

    // pick a random DDD from the array and generate a random number
    const ddd = ddds[Math.floor(Math.random() * ddds.length)];
    const number = `${ddd}9${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`;

    return number;
};

// utility function to generate emails based on name
function generateEmail(name) {
    const domains = ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "live.com", "protonmail.com", "icloud.com", "aol.com"];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const maxLength = 50 - randomDomain.length - 1;

    const styles = [
        () => `${sanitized}${Math.floor(100 + Math.random() * 900)}`,
        () => `${sanitized}_${Math.floor(10 + Math.random() * 90)}`,
        () => `${sanitized}.${Math.floor(1000 + Math.random() * 9000)}`,
        () => `${sanitized}${Math.floor(100 + Math.random() * 900)}`,
    ];

    let emailLocalPart = styles[Math.floor(Math.random() * styles.length)]();

    // ensure the emailLocalPart does not exceed the maxLength
    if (emailLocalPart.length > maxLength) {
        emailLocalPart = emailLocalPart.substring(0, maxLength);
    };

    // final validation to ensure no invalid characters remain
    emailLocalPart = emailLocalPart.replace(/[^a-z0-9._-]/g, "");

    return `${emailLocalPart}@${randomDomain}`;
};

// utility function to generate a strong password based on name
function generatePassword(name) {
    const sanitized = name.replace(/[^a-zA-Z0-9]/g, "");
    const randomSpecialChars = "!@#$%^&*_-+=?";
    const specialChar = randomSpecialChars[Math.floor(Math.random() * randomSpecialChars.length)];
    const randomUppercase = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const randomLowercase = () => String.fromCharCode(97 + Math.floor(Math.random() * 26));
    const randomNumber = Math.floor(Math.random() * 10);

    const passwordStyles = [
        () => `${sanitized.charAt(0).toUpperCase()}${sanitized.slice(1, 4)}${specialChar}${randomNumber}${randomUppercase()}${randomLowercase()}`,
        () => `${randomUppercase()}${sanitized.slice(0, 3)}${specialChar}${sanitized.slice(-2)}${randomNumber}${randomLowercase()}`,
        () => `${sanitized.charAt(0)}${specialChar}${randomUppercase()}${sanitized.slice(-3)}${randomLowercase()}${randomNumber}`,
    ];

    let password = passwordStyles[Math.floor(Math.random() * passwordStyles.length)]();

    // ensure password length is between 8 and 30 characters
    while (password.length < 8) {
        password += randomSpecialChars[Math.floor(Math.random() * randomSpecialChars.length)];
    };
    if (password.length > 30) {
        password = password.substring(0, 30);
    };

    return password;
};

// utility function to read files with promises
function readFilePromise(path) {
    return new Promise((resolve, reject) => {
        readFile(path, "utf8", (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            };

        });
    });
};

// utility function to write files with promises
function writeFilePromise(path, data) {
    return new Promise((resolve, reject) => {
        writeFile(path, data, "utf8", (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            };
        });
    });
};

// utility function to update files by removing used lines
async function updateFile(path, usedLines) {
    try {
        // read the file content
        const content = await readFilePromise(path);

        // split into lines and filter out the used lines
        const updatedContent = content
            .split("\n")
            .filter(line => line.trim() !== "" && !usedLines.includes(line))
            .join("\n");

        // write the updated content back to the file
        await writeFilePromise(path, updatedContent);
    } catch (error) {
        throw error;
    };

};