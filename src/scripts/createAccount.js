// fs - path
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");

// chalk - colorize text
const { gray, yellow, green } = require("chalk");

// wio.db
const { JsonDatabase } = require("wio.db");
const dbElements = new JsonDatabase({ databasePath: join(__dirname, "../../databases/dbElements.json") });
const dbConfig = new JsonDatabase({ databasePath: join(__dirname, "../../config.json") });

// xsls - excel - creation
const xlsx = require("xlsx");

// Navigate to the target website
module.exports = function createAccount(page, browser, randomUserAgent, numAccount, status, cpf, proxy, email, password, name, number, zip, street, city, state) {
    return new Promise(async (resolve, reject) => {
        try {

            // accessing the website and checking for errors
            await navigateToWebsite(page, numAccount, cpf, proxy);

            // accepted - cookies
            await handleClick(page, dbElements.get("button.pageRegister.acceptCookies"), `(${numAccount}) - Cookies aceitos.`);

            // fill - forms
            await fillField(page, dbElements.get("input.pageRegister.email"), email);
            await fillField(page, dbElements.get("input.pageRegister.password"), password);
            await fillField(page, dbElements.get("input.pageRegister.cpf"), cpf,);
            console.log(gray(`   [?] (${numAccount}) - Informações preenchidas com sucesso!`));

            // confirm - register
            await handleClick(page, dbElements.get("button.pageRegister.confirm"), `(${numAccount}) - Cadastrando...`);

            // check for internal error
            const internalError = await detectInternalError(page, dbElements.get("error.pageRegister.messageInternal"), "Erro do servidor interno.");
            if (internalError) {
                await saveErrorData("both", cpf, proxy);
                return reject(internalError, browser.close());
            };

            // check for CPF already registered error
            const cpfError = await detectCpfError(page);
            if (cpfError) {
                await saveErrorData("proxy", cpf, proxy);
                return reject(cpfError, browser.close());
            };

            // verify account creation
            const accountCreated = await verifyAccountCreation(page, name, email, password, cpf, proxy, browser);
            if (accountCreated) {
                return reject(accountCreated, browser.close());
            };

            // check - status
            if (status === true) {
                // close the browser connection
                browser.close();

                // save - informations
                await saveErrorData("details", cpf, proxy, `name=${name}\nplatform=jonbet.com\nusername=${cpf}\npassword=${password}\nproxytype=socks5\nproxy=${proxy}\nua=${randomUserAgent}\n*********************************************`);
                await saveToExcel({ status, Name: name, Email: email, Password: password, CPF: cpf, Proxy: proxy });
                resolve();
            } else if (status == false) {

                // fill - additional informations and generate payment
                const { randomValue, qrCodeText } = await fillInformations(page, numAccount, cpf, proxy, name, number, zip, street, city, state);

                // close the browser connection
                browser.close();

                // save - informations
                await saveErrorData("details", cpf, proxy, `name=${name}\nplatform=jonbet.com\nusername=${cpf}\npassword=${password}\nproxytype=socks5\nproxy=${proxy}\nua=${randomUserAgent}\n*********************************************`);
                await saveToExcel({ status, Name: name, Email: email, Password: password, CPF: cpf, Proxy: proxy, Value: randomValue, qrCode: qrCodeText });
                resolve();
            };

        } catch (err) {

            // close the browser connection
            reject(err, browser.close());
        };

    });
};


// function to click on elements
async function handleClick(page, selector, successMessage) {
    const element = await page.waitForSelector(selector, { timeout: 5000 });
    await element.click();
    console.log(yellow(`   [!] ${successMessage}`));
};

// function to fill in fields
async function fillField(page, selector, value) {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.type(selector, value);
};

// function to navigate to website
async function navigateToWebsite(page, numAccount, cpf, proxy) {
    return new Promise(async (resolve, reject) => {

        try {
            await page.goto(dbConfig.get("jonBetLink"), { waitUntil: "networkidle2", timeout: 30000 });
        } catch (error) {
            if (error.name === 'TimeoutError') {
                await saveErrorData("both", cpf, proxy);
                return reject("A página demorou para responder.");
            };
            await saveErrorData("both", cpf, proxy);
            return reject(`A página demorou para responder.`);
        };

        // check that the URL accessed is the expected one
        const currentUrl = page.url();
        const expectedPrefix = "https://jonbet.com/pt/l/immersiveroulette1";
        if (currentUrl !== expectedPrefix) {
            await saveErrorData("both", cpf, proxy);
            return reject((`URL inesperada detectada.`));
        };
        console.log(yellow(`   [!] (${numAccount}) - Procurando por erros...`));

        // checking for website access errors
        const accessError = await detectAccessError(page, cpf, proxy);
        if (accessError) {
            return reject(accessError);
        };

        // check if the Cloudflare error is present
        const cloudflareError = await detectCloudflareError(page, cpf, proxy);
        if (cloudflareError) {
            return reject(cloudflareError);
        };

        // check for update or timeout errors
        const pageError = await detectPageUpdateOrTimeout(page, cpf, proxy);
        if (pageError) {
            return reject(pageError);
        };

        // check that the input fields are present
        const inputsPresent = await verifyInputFields(page, cpf, proxy);
        if (!inputsPresent) {
            return reject(`Falha ao detectar os campos de entrada no site.`);
        };

        // flow successfully completed
        console.log(green(`   [+] (${numAccount}) - Navegação para o site concluída com sucesso!`));
        resolve(true);
    });

    async function detectAccessError(page, cpf, proxy) {
        try {
            await page.waitForSelector(dbElements.get("error.pageLoading.unableAccess"), { timeout: 5000 });
            const errorMessage = await page.$eval(errorSelector, el => el.textContent.trim());
            if (errorMessage === "Não é possível acessar esse site") {
                await saveErrorData("both", cpf, proxy);
                return `Não é possível acessar o site.`;
            }
        } catch {
        };
        return null;
    };

    async function detectCloudflareError(page, cpf, proxy) {
        try {
            await page.waitForSelector(dbElements.get("error.pageLoading.clouFlare"), { timeout: 5000 });
            await saveErrorData("both", cpf, proxy);
            return `Erro da cloudflare detectado.`;
        } catch {
        };
        return null;
    };

    async function detectPageUpdateOrTimeout(page, cpf, proxy) {
        try {
            await page.waitForSelector(dbElements.get("error.pageLoading.updated"), { timeout: 5000 });
            const errorMessage = await page.$eval(errorSelector, el => el.textContent.trim());
            if (errorMessage === "We've updated!") {
                await saveErrorData("both", cpf, proxy);
                return `Página atualizada detectada.`;
            } else if (errorMessage === "timeout of 30000ms exceeded") {
                await saveErrorData("both", cpf, proxy);
                return `Timeout detectado.`;
            };
        } catch {
        };
        return null;
    };

    async function verifyInputFields(page, cpf, proxy) {
        try {
            const emailSelector = dbElements.get("input.pageRegister.email");
            const passwordSelector = dbElements.get("input.pageRegister.password");
            const cpfSelector = dbElements.get("input.pageRegister.cpf");

            await page.waitForSelector(emailSelector, { timeout: 5000 });
            await page.waitForSelector(passwordSelector, { timeout: 5000 });
            await page.waitForSelector(cpfSelector, { timeout: 5000 });
            return true;
        } catch {
            await saveErrorData("both", cpf, proxy);
            return false;
        };
    };
};

// error detection function
async function detectInternalError(page, selector, expectedMessage) {

    try {
        await page.waitForSelector(selector, { timeout: 5000 });
        const errorMessage = await page.$eval(selector, el => el.textContent.trim());
        if (errorMessage === expectedMessage) {
            return "Erro interno no servidor de registro.";
        };
    } catch {
    };
    return null;
};

// function to detect CPF errors
async function detectCpfError(page) {
    try {
        await page.waitForSelector(dbElements.get("error.pageRegister.divMessage"), { timeout: 5000 });
        const errorMessage = await page.$eval(dbElements.get("error.pageRegister.divMessage"), el => el.textContent.trim());
        if (errorMessage.includes("O CPF já está cadastrado.")) {
            return "CPF já cadastrado.";
        } else if (errorMessage.includes("CPF inválido.")) {
            return "CPF inválido.";
        } else if (errorMessage.includes("Situação do CPF inválida")) {
            return "CPF inválido.";
        };
    } catch {
    };
    return null;
};

// function to verify account creation
async function verifyAccountCreation(page, name, email, password, cpf, proxy, browser) {
    try {
        await page.waitForSelector(dbElements.get("success.pageLoged.divMessage"), { timeout: 5000 });
        const welcomeMessage = await page.$eval(dbElements.get("success.pageLoged.divMessage"), el => el.textContent.trim());
        if (welcomeMessage === "Bem-vindo ao Jonbet!") { };
    } catch {
        await saveErrorData("error", cpf, proxy, `${name}:${email}:${password}:${cpf}:${proxy}`);
        return "Falha ao verificar criação da conta.";
    };
};

// function to save in Excel
async function saveToExcel(status, data) {
    const filePath = join(__dirname, "../../data/reports/accounts.xlsx");
    let workbook;

    try {
        workbook = xlsx.readFile(filePath);
    } catch {
        workbook = xlsx.utils.book_new();
    };

    if (status === true) {
        let sheet = workbook.Sheets["accountsOnlyRegistration"];
        if (!sheet) {
            sheet = xlsx.utils.json_to_sheet([]);
            xlsx.utils.book_append_sheet(workbook, sheet, "accountsOnlyRegistration");
        };
    } else if (status === false) {
        let sheet = workbook.Sheets["accountsDepositRegistration"];
        if (!sheet) {
            sheet = xlsx.utils.json_to_sheet([]);
            xlsx.utils.book_append_sheet(workbook, sheet, "accountsDepositRegistration");
        };
    };

    const existingData = xlsx.utils.sheet_to_json(sheet);
    const updatedData = [...existingData, data];
    const updatedSheet = xlsx.utils.json_to_sheet(updatedData);
    if (status === true) {
        workbook.Sheets["accountsOnlyRegistration"] = updatedSheet;
    } else if (status === false) {
        workbook.Sheets["accountsDepositRegistration"] = updatedSheet;
    };

    xlsx.writeFile(workbook, filePath);
};

// function to navigate to profile page
async function navigateToProfile(page, cpf, proxy) {
    return new Promise(async (resolve, reject) => {
        try {
            await page.goto("https://jonbet.com/pt/account/profile/personal", { waitUntil: "networkidle2", timeout: 30000 });
        } catch (error) {
            if (error.name === 'TimeoutError') {
                await saveErrorData("both", cpf, proxy);
                return reject("A página demorou para responder.");
            };
            await saveErrorData("both", cpf, proxy);
            return reject(`A página demorou para responder.`);
        };
    });

};

// function to navigate to profile info page
async function navigateToProfileInfo(page, cpf, proxy) {
    return new Promise(async (resolve, reject) => {
        try {
            await page.goto("https://jonbet.com/pt/account/profile/info", { waitUntil: "networkidle2", timeout: 30000 });
        } catch (error) {
            if (error.name === 'TimeoutError') {
                await saveErrorData("both", cpf, proxy);
                return reject("A página demorou para responder.");
            };
            await saveErrorData("both", cpf, proxy);
            return reject(`A página demorou para responder.`);
        };
    });

};

function generateRandomValue() {
    return (Math.random() * (45 - 42) + 42).toFixed(2);
};

// function for filling in information and generate payment
async function fillInformations(page, numAccount, cpf, proxy, name, number, zip, street, city, state) {

    // navigate - profile page
    navigateToProfile(page, cpf, proxy)

    // accepted - cookies
    await handleClick(page, dbElements.get("button.pageRegister.acceptCookies"), `(${numAccount}) - Cookies aceitos.`);

    // format - full name
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];

    // fill - names
    await fillField(page, dbElements.get("input.pageProfile.firstName"), firstName);
    await fillField(page, dbElements.get("input.pageProfile.lastName"), lastName);

    // select - country option
    await page.waitForSelector(dbElements.get("button.pageProfile.country"), { timeout: 5000 });
    await page.evaluate(() => {
        const brazilOption = document.querySelector(dbElements.get("button.pageProfile.country"));
        if (brazilOption) {
            brazilOption.click();
        };
    });

    // state - map state
    const statesMap = {
        "AC": "Acre",
        "AL": "Alagoas",
        "AP": "Amapá",
        "AM": "Amazonas",
        "BA": "Bahia",
        "CE": "Ceará",
        "DF": "Distrito Federal",
        "ES": "Espírito Santo",
        "GO": "Goiás",
        "MA": "Maranhão",
        "MT": "Mato Grosso",
        "MS": "Mato Grosso do Sul",
        "MG": "Minas Gerais",
        "PA": "Pará",
        "PB": "Paraíba",
        "PR": "Paraná",
        "PE": "Pernambuco",
        "PI": "Piauí",
        "RJ": "Rio de Janeiro",
        "RN": "Rio Grande do Norte",
        "RS": "Rio Grande do Sul",
        "RO": "Rondônia",
        "RR": "Roraima",
        "SC": "Santa Catarina",
        "SP": "São Paulo",
        "SE": "Sergipe",
        "TO": "Tocantins",
    };

    // select - state option
    const stateSelected = statesMap[state];

    // wait for the select state option to load
    await page.waitForSelector(dbElements.get("button.pageProfile.state"));
    await page.click(dbElements.get("button.pageProfile.state"));

    // build the dynamic selector based on the value
    const stateSelector = `${dbElements.get("button.pageProfile.stateSelected").replace("state", stateSelected)}`;

    // click the select state
    await page.waitForSelector(stateSelector);
    await page.click(stateSelector);

    // fill - address
    await fillField(page, dbElements.get("input.pageProfile.street"), street);
    await fillField(page, dbElements.get("input.pageProfile.city"), city);
    await fillField(page, dbElements.get("input.pageProfile.zipCode"), zip);

    // save - address
    await handleClick(page, dbElements.get("button.pageProfile.save"));

    // navigate - profile info page
    navigateToProfileInfo(page, cpf, proxy)

    // get the selector for the edit button on the profile page
    const editButtonSelector = dbElements.get("button.pageProfile.number");

    // wait for the edit button to be visible and clickable
    await page.waitForSelector(editButtonSelector);

    // click the edit button to open the phone number input field
    await page.click(editButtonSelector);

    // get the selector for the phone input field
    const phoneInputSelector = dbElements.get("input.pageProfile.number");

    // wait for the phone input field to be visible and ready for interaction
    await page.waitForSelector(phoneInputSelector);

    // enable the phone input field by removing the 'disabled' attribute
    await page.evaluate((selector) => {
        const phoneInput = document.querySelector(selector);
        if (phoneInput) {
            phoneInput.removeAttribute('disabled');
        }
    }, phoneInputSelector);

    // focus on the phone input field to prepare for typing
    await page.focus(phoneInputSelector);

    // select all the current text in the phone input field
    await page.click(phoneInputSelector, { clickCount: 3 });

    // type the new phone number into the input field
    await page.type(phoneInputSelector, number);

    // save - informations
    await handleClick(page, dbElements.get("button.pageProfile.save"), `(${numAccount}) - Informações preenchidas e salvas com sucesso!`);

    // navigate - deposit
    await page.waitForSelector(dbElements.get("button.pageDeposit.header"));
    await page.click(dbElements.get("button.pageDeposit.header"));
    await page.waitForSelector(dbElements.get("button.pageDeposit.bonus"));
    await page.click(dbElements.get("button.pageDeposit.bonus"));
    await page.waitForSelector(dbElements.get("button.pageDeposit.payment"));
    await page.click(dbElements.get("button.pageDeposit.payment"));

    // generate a random value to be used for the amount input
    const randomValue = generateRandomValue();

    // wait for the amount input field to appear (with a timeout of 8 seconds) and type the random value into it
    await page.waitForSelector(dbElements.get("input.pageDeposit.amount"), { timeout: 8000 });
    await page.type(dbElements.get("input.pageDeposit.amount"), randomValue, { delay: 100 });

    // wait for the complete button on the modal to be visible and clickable
    await page.waitForSelector(dbElements.get("button.pageDeposit.deposit"));

    // click on the modal complete button
    await page.click(dbElements.get("button.pageDeposit.deposit"));

    // wait for the QR code text to appear
    await page.waitForSelector(dbElements.get("input.pageDeposit.qrCode"));

    // extract the text inside the QR code area
    const qrCodeText = await page.$eval(dbElements.get("input.pageDeposit.qrCode"), el => el.innerText);

    return { randomValue, qrCodeText };

};

// functfunction to save data
async function saveErrorData(type, cpf, proxy, account) {
    const filePathCpf = join(__dirname, "../../data/input/cpfs.txt");
    const filePathProxy = join(__dirname, "../../data/input/proxies.txt");
    const filePathError = join(__dirname, "../../data/errors/accountsOnlyCreate.txt");
    const filePathDetails = join(__dirname, "../../data/reports/detailsAccountsOnlyCreate.txt");

    if (type === "cpf" || type === "both") {
        let cpfData = existsSync(filePathCpf) ? readFileSync(filePathCpf, "utf-8").split("\n").filter(Boolean) : [];
        if (!cpfData.includes(cpf)) {
            cpfData.push(cpf);
            writeFileSync(filePathCpf, cpfData.join("\n"), { flag: "w" });
        };
    };

    if (type === "proxy" || type === "both") {
        let proxyData = existsSync(filePathProxy) ? readFileSync(filePathProxy, "utf-8").split("\n").filter(Boolean) : [];
        if (!proxyData.includes(proxy)) {
            proxyData.push(proxy);
            writeFileSync(filePathProxy, proxyData.join("\n"), { flag: "w" });
        };
    };

    if (type === "cpf" || type === "both") {
        let cpfData = existsSync(filePathCpf) ? readFileSync(filePathCpf, "utf-8").split("\n").filter(Boolean) : [];
        if (!cpfData.includes(cpf)) {
            cpfData.push(cpf);
            writeFileSync(filePathCpf, cpfData.join("\n"), { flag: "w" });
        };
    };

    if (type === "error") {
        let errorData = existsSync(filePathError) ? readFileSync(filePathError, "utf-8").split("\n").filter(Boolean) : [];

        if (!errorData.includes(account)) {
            errorData.push(account);
            writeFileSync(filePathError, errorData.join("\n"), { flag: "w" });
        };
    };

    if (type === "details") {
        let errorData = existsSync(filePathDetails) ? readFileSync(filePathDetails, "utf-8").split("\n").filter(Boolean) : [];

        if (!errorData.includes(account)) {
            errorData.push(account);
            writeFileSync(filePathDetails, errorData.join("\n"), { flag: "w" });
        };
    };
};