// fs - path
const { readFile, writeFile, readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");

// chalk - colorize text
const { yellow, red } = require("chalk");

// imports - functions
const checkingInformation = require('./checkingInformation');
const getInformation = require('../api/getInformation');

// function to perform account creation
module.exports = async function formatInformation(numAccounts, status) {

    // checking the number of lines in the CPF and Proxies files
    const cpfsPath = join(__dirname, "../../data/input/cpfs.txt");
    const proxiesPath = join(__dirname, "../../data/input/proxies.txt");

    // try - error processing
    try {

        // function to count the number of lines in a file
        const readFileLines = (filePath) => {
            return new Promise((resolve, reject) => {
                readFile(filePath, 'utf8', (err, data) => {

                    // lines in the file
                    const lines = data.split('\n').filter(line => line.trim() !== '').length;
                    resolve(lines);

                });

            });

        };

        // validates and rewrites the CPF file
        console.log(yellow("   [!] Validando CPFs..."));
        const cpfData = readFileSync(cpfsPath, "utf-8");
        await backupFileRewrite("cpf", cpfData);
        await validateAndRewrite(cpfsPath, true);
        await checkingInformation(true);

        // validates and rewrites the Proxies file
        console.log(yellow("   [!] Validando Proxies..."));
        const proxyData = readFileSync(proxiesPath, "utf-8");
        await backupFileRewrite("proxy", proxyData);
        await validateAndRewrite(proxiesPath, false);
        await checkingInformation(false);

        // variables - lines
        const cpfLines = await readFileLines(cpfsPath);
        const proxyLines = await readFileLines(proxiesPath);

        // check the number of lines in both files
        if (cpfLines < numAccounts && proxyLines < numAccounts) {
            const missingCpfs = numAccounts - cpfLines;
            const missingProxies = numAccounts - proxyLines;
            console.log(red(`   [!] O número de CPFs (${cpfLines}) e proxies (${proxyLines}) é insuficiente! Faltam ${missingCpfs} CPFs e ${missingProxies} proxies.`));
            return false;
        } else if (cpfLines < numAccounts) {
            const missingCpfs = numAccounts - cpfLines;
            console.log(red(`   [!] O número de CPFs (${cpfLines}) é insuficiente! Faltam ${missingCpfs} CPFs.`));
            return false;
        } else if (proxyLines < numAccounts) {
            const missingProxies = numAccounts - proxyLines;
            console.log(red(`   [!] O número de proxies (${proxyLines}) é insuficiente! Faltam ${missingProxies} proxies.`));
            return false;
        };

        // pull - information
        await getInformation(numAccounts, status);

    } catch (err) {
        console.log(red(`   [!] Ocorreu um erro! (CONTATE AOS ADM), ${err}`));
        return;
    };

};

// function to save error data into a file
async function backupFileRewrite(type, data) {

    // path - backup
    const backupCPFsPath = join(__dirname, "../../data/backup/cpfs.txt");
    const backupProxiesPath = join(__dirname, "../../data/backup/proxies.txt");

    if (type === "cpf") {
        let cpfData = existsSync(backupCPFsPath) ? readFileSync(backupCPFsPath, "utf-8").split("\n").filter(Boolean) : [];
        const newCpfs = data.split("\n").filter(Boolean);
        cpfData = [...new Set([...cpfData, ...newCpfs])];
        writeFileSync(backupCPFsPath, cpfData.join("\n"), { flag: "w" });
    };

    if (type === "proxy") {
        let proxyData = existsSync(backupProxiesPath) ? readFileSync(backupProxiesPath, "utf-8").split("\n").filter(Boolean) : [];
        const newProxies = data.split("\n").filter(Boolean);
        proxyData = [...new Set([...proxyData, ...newProxies])];
        writeFileSync(backupProxiesPath, proxyData.join("\n"), { flag: "w" });
    };
};

// function to validate and rewrite from a file (CPFs or Proxies)
const validateAndRewrite = (filePath, isCpf = false) => {
    return new Promise((resolve, reject) => {
        readFile(filePath, 'utf8', (err, data) => {

            let uniqueLines;
            if (isCpf) {

                // regex to validate the allowed CPF formats
                const validCPFRegex = /^\d{11}$/;

                // separate lines, remove spaces, clear invalid CPFs, and remove duplicates
                uniqueLines = [...new Set(data
                    .split('\n')
                    .map(line => line.replace(/\D/g, ''))
                    .filter(line => validCPFRegex.test(line))
                    .map(line => line.padStart(11, '0'))
                    .map(line => line.trim())
                    .filter(line => line.length > 0))];
            } else {

                // regex to validate the format of proxies
                const validProxyRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}:[^:]+:[^:]+$/;

                // separate lines, remove spaces and clear invalid proxies
                const validProxies = data
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => validProxyRegex.test(line));

                // Remove duplicates for proxies
                uniqueLines = [...new Set(validProxies)];
            };

            // Rewriting the file with unique entries
            writeFile(filePath, uniqueLines.join('\n'), 'utf8', (err) => {

                // resolve - success
                resolve();
            });

        });

    });

};