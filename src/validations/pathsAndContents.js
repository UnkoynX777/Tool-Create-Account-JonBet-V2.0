// fs - path
const { readFile, writeFile, access } = require("fs");
const { join } = require("path");

// axios - request
const { get } = require("axios");

// xsls - excel - creation
const xlsx = require("xlsx");

module.exports = function validationsPathandContents() {

    // paths - files
    const paths = {
        cpfsPath: join(__dirname, "../../data/input/cpfs.txt"),
        proxiesPath: join(__dirname, "../../data/input/proxies.txt"),
        backupCPFsPath: join(__dirname, "../../data/backup/cpfs.txt"),
        backupProxiesPath: join(__dirname, "../../data/backup/proxies.txt"),
        credentialsOnlyCreate: join(__dirname, "../../data/output/credentialsOnlyCreate.txt"),
        credentialsDepositCreate: join(__dirname, "../../data/output/credentialsDepositCreate.txt"),
        accountsOnlyCreateErrorsPath: join(__dirname, "../../data/errors/accountsOnlyCreate.txt"),
        accountsDepositCreateErrorsPath: join(__dirname, "../../data/errors/accountsDepositCreate.txt"),
        cpfsErrorsPath: join(__dirname, "../../data/errors/cpfs.txt"),
        proxiesErrorsPath: join(__dirname, "../../data/errors/proxies.txt"),
        accountsPath: join(__dirname, "../../data/reports/accounts.xlsx"),
        detailsAccountsOnlyCreatePath: join(__dirname, "../../data/reports/detailsAccountsOnlyCreate.txt"),
        dbElementsPath: join(__dirname, "../../databases/dbElements.json"),
        configPath: join(__dirname, "../../config.json")
    };

    // JSON content to be added to dbElements.json
    const dbElementsContent = {
        "input": {
            "pageRegister": {
                "email": "[data-testid=\"email-input\"]",
                "password": "[data-testid=\"password-input\"]",
                "cpf": "input[name=\"cpf\"]"
            },
            "pageProfile": {
                "firstName": "input[data-testid=\"personal-info-first-name\"]",
                "lastName": "input[data-testid=\"personal-info-last-name\"]",
                "street": "[data-testid=\"personal-info-address\"] .input-wrapper input",
                "city": ".col-md-6.col-xs-7 .input-wrapper input",
                "zipCode": ".col-md-6.col-xs-5 .input-wrapper input",
                "number": ".react-tel-input input.form-control"
            },
            "pageDeposit": {
                "amount": "input[data-testid=\"amount\"]",
                "qrCode": ".qr-code-text-inner"
            }
        },
        "button": {
            "pageRegister": {
                "confirm": ".input-footer.register-button-landing .red.submit",
                "acceptCookies": ".policy-regulation-button-container .primary.shared-button-custom.css-11gm6zt"
            },
            "pageProfile": {
                "state": "[data-testid=\"region\"] .dropdown__trigger",
                "stateSelected": "[data-testid=\"state\"]",
                "country": ".country[data-testid=\"Brazil\"]",
                "save": "[data-testid=\"personal-info-save-button\"]",
                "number": "[data-testid=\"edit-phone-open\"]"
            },
            "pageDeposit": {
                "header": "#header-deposit",
                "bonus": "[data-testid=\"bonus-select-continue\"]",
                "payment": ".payment-method span",
                "deposit": "button[data-testid=\"modal-complete-button\"]"
            }
        },
        "error": {
            "pageLoading": {
                "unableAccess": "span[jsselect=\"heading\"][jsvalues=\".innerHTML:msg\"][jstcache=\"9\"]",
                "clouFlare": "h2.text-3xl.leading-tight.font-normal.mb-4.text-black-dark.antialiased[data-translate=\"what_happened\"]"
            },
            "pageRegister": {
                "updated": "div.page-loadable.chunk-error h1",
                "divMessage": "div.error-label",
                "messageInternal": "div.message h1[data-testid=\"growl-message\"]"
            }
        },
        "success": {
            "pageLoged": {
                "divMessage": ".welcome-card-container .welcome-header"
            }
        }
    };

    // Ensure jonBetLink exists and is valid
    function ensureJonBetLinkInConfig() {
        access(paths.configPath, (err) => {
            if (err) {

                // the file doesn't exist, create it with the jonBetLink key
                const initialConfig = { jonBetLink: "none" };
                writeFile(paths.configPath, JSON.stringify(initialConfig, null, 4), (writeErr) => {
                });
            } else {

                // the file exists, check its contents
                readFile(paths.configPath, 'utf8', (readErr, data) => {

                    if (data.trim() === "") {

                        // file is empty, rewrite with jonBetLink key
                        const initialConfig = { jonBetLink: "none" };
                        writeFile(paths.configPath, JSON.stringify(initialConfig, null, 4), (writeErr) => {
                        });
                        return;
                    };

                    let configData;
                    try {
                        configData = JSON.parse(data);
                    } catch (parseError) {

                        // rewrites the file with the default value
                        const initialConfig = { jonBetLink: "none" };
                        writeFile(paths.configPath, JSON.stringify(initialConfig, null, 4), (writeErr) => {
                        });
                        return;
                    };

                    // checks that the jonBetLink key is present
                    if (configData.hasOwnProperty("jonBetLink")) {

                        // validate the link jonBetLink
                        validateLink(configData.jonBetLink).then((isValid) => {
                            if (!isValid) {
                                const initialConfig = { jonBetLink: "none" };
                                writeFile(paths.configPath, JSON.stringify(initialConfig, null, 4), (writeErr) => {
                                });
                            };

                            // ensure the link starts with the required prefix
                            const requiredPrefix = "https://jonbet.cxclick.com/visit/?bta=";
                            if (!configData.jonBetLink.trim().startsWith(requiredPrefix)) {
                                const initialConfig = { jonBetLink: "none" };
                                writeFile(paths.configPath, JSON.stringify(initialConfig, null, 4), (writeErr) => {
                                });
                            };

                        });

                    };

                });

            };

        });

    };

    // function to validate the link using axios
    function validateLink(link) {
        return get(link).then((response) => {

            // considers the link valid if the status is 200
            return response.status === 200;
        }).catch(error => {
            return;
        });

    };


    // function to ensure that .txt files are recreated empty
    function ensureTxtFileExists(filePath) {
        access(filePath, (err) => {
            if (err) {

                // if the .txt file does not exist, create it empty
                writeFile(filePath, "", (err) => {
                });
            };

        });

    };

    // function to ensure that .json files are rewritten with JSON content
    function ensureJsonFileExists(filePath) {
        access(filePath, (err) => {
            if (err) {

                // if the .json file does not exist, create it with JSON content
                writeFile(filePath, JSON.stringify(dbElementsContent, null, 4), (err) => {
                });

            } else {

                // if it already exists, rewrites the JSON content with a 4-space indentation
                writeFile(filePath, JSON.stringify(dbElementsContent, null, 4), (err) => {
                });

            };

        });

    };

    // function to ensure that .xlsx files exist
    function ensureXlsxFileExists(filePath) {
        access(filePath, (err) => {
            if (err) {

                // if the .xlsx file does not exist, create it with an empty sheet
                const wb = xlsx.utils.book_new();
                const ws = xlsx.utils.aoa_to_sheet([]);
                xlsx.utils.book_append_sheet(wb, ws, 'accountsOnlyRegistration');
                xlsx.utils.book_append_sheet(wb, ws, 'accountsDepositRegistration');
                xlsx.writeFile(wb, filePath);
            };

        });

    };

    // ensure that all .txt files are recreated empty and .json files are rewritten
    Object.values(paths).forEach((filePath) => {
        if (filePath.endsWith("t")) {
            ensureTxtFileExists(filePath);
        } else if (filePath.endsWith("s.json")) {
            ensureJsonFileExists(filePath);
        } else if (filePath.endsWith("g.json")) {
            ensureJonBetLinkInConfig(filePath);
        } else if (filePath.endsWith("x")) {
            ensureXlsxFileExists(filePath);
        };

    });

};