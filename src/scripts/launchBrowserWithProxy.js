// fs - path
const { readFile, writeFile } = require("fs");
const { join } = require("path");

// chalk - colorize text
const { cyan } = require("chalk");

// puppeteer - browser
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AnonymizeUA = require("puppeteer-extra-plugin-anonymize-ua");
const randomUseragent = require("random-useragent");

// puppeter - plugin
puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUA());

module.exports = async function launchBrowserWithProxy(numAccounts, numAccount, status) {
    return new Promise((resolve, reject) => {
        try {

            // set the credential file path based on the status
            const credentials = join(__dirname, status ? "../../data/output/credentialsOnlyCreate.txt" : "../../data/output/credentialsDepositCreate.txt");

            // read the credentials file
            readFile(credentials, 'utf8', async (err, data) => {

                // extract the first line of credentials
                const lines = data.split('\n').filter(line => line.trim() !== "");
                const selectedCredentials = lines.slice(0, numAccounts);

                // update the file by removing the first line
                const remainingCredentials = lines.slice(numAccounts).join('\n');
                writeFile(credentials, remainingCredentials, 'utf8', (writeErr) => {
                });

                // variables - information
                let cpf, proxy, email, password, name, number, zip, street, city, state, ip, port, username, pass;

                // divide the credential line into parts
                const selectedCredential = selectedCredentials[numAccount - 1];
                const parts = selectedCredential.split(":");

                if (status === true) {

                    // extract the values correctly
                    cpf = parts[0];
                    proxy = parts.slice(1, 5).join(":");
                    email = parts[5];
                    password = parts[6];
                    name = parts[7];

                } else if (status === false) {

                    // extract the values correctly
                    cpf = parts[0];
                    proxy = parts.slice(1, 5).join(":");
                    email = parts[5];
                    password = parts[6];
                    name = parts[7];
                    number = parts[8];
                    zip = parts[9];
                    street = parts[10];
                    city = parts[11];
                    state = parts[12];

                };

                // check and extract proxy in ip:port:username:password format
                proxyMatch = proxy.match(/^(.+?):(\d+):(.+?):(.+)$/);
                [_, ip, port, username, pass] = proxyMatch;

                // determine the language at random
                const isPortuguese = Math.random() < 0.8;
                const lang = isPortuguese ? "pt-BR,pt" : "en-US,en";

                // setting browser startup arguments
                const args = [
                    `--proxy-server=http://${ip}:${port}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--ignore-certificate-errors',
                    '--disable-blink-features=AutomationControlled',
                    `--lang=${lang}`,
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream',
                    '--disable-extensions',
                    '--hide-scrollbars',
                    '--mute-audio',
                ];

                // randomize viewport size for some browsers
                const viewportSizes = [
                    { width: 1920, height: 1080 },
                    { width: 1366, height: 768 },
                    { width: 1440, height: 900 },
                    { width: 1280, height: 720 }
                ];

                // randomize fullscreen mode for some browsers - 80% of the time fullscreen
                const isFullScreen = Math.random() < 1;
                const randomViewport = isFullScreen ? viewportSizes[0] : viewportSizes[Math.floor(Math.random() * viewportSizes.length)];

                // add fullscreen mode if not already set
                if (!isFullScreen) {
                    args.push(`--window-size=${randomViewport.width},${randomViewport.height}`);
                };

                // launch the browser with the adjusted private mode and proxy
                const browser = await puppeteer.launch({
                    headless: false,
                    args,
                    defaultViewport: isFullScreen ? null : randomViewport
                });

                // open a new page in the browser
                const page = await browser.newPage();

                // handle proxy authentication if provided
                if (username && pass) {
                    await page.authenticate({ username, password: pass });
                };

                // apply random User-Agent and other fingerprints
                const randomUserAgent = randomUseragent.getRandom();
                await page.setUserAgent(randomUserAgent);

                // console - success
                console.log(cyan(`   [+] (${numAccount}) - Fingertips injetados.`));
                resolve({ browser, page, randomUserAgent, cpf, proxy, email, password, name, number, zip, street, city, state });
            });

        } catch (error) {
            reject(error);
        };

    });
};