// fs - path
const { readFile } = require("fs");
const { join } = require("path");

// wio.db
const { JsonDatabase } = require("wio.db");
const dbConfig = new JsonDatabase({ databasePath: join(__dirname, "../../config.json") });

// readline - read entries
const { createInterface } = require("readline");

// chalk - colorize text
const { magenta, yellow, cyan, gray, red, green } = require("chalk");

// axios - request
const { get } = require("axios");

// figlet - ASCII representation
const { textSync } = require("figlet");

// nanospinner - loading spinner
const { createSpinner } = require("nanospinner");

// inquirer - interactive prompts
const { prompt } = require("inquirer");

// imports - functions
const formatInformation = require('../validations/formatInformation');
const createAccount = require('../scripts/createAccount');
const launchBrowserWithProxy = require('../scripts/launchBrowserWithProxy');

// function to display home screen
function showWelcomeScreen() {

    // console - clear
    console.clear();

    // draw a title with ASCII art
    console.log(magenta(textSync(" JonBet", { horizontalLayout: 'default', font: 'Slant' })));

    // additional information
    console.log(yellow("\n   [!] - Programmed by Unkoynx7\n"));
    console.log(cyan(`\n   Bem-vindo ao sistema de automação de contas!`));
    console.log(gray(`   Data: ${new Date().toLocaleString()}\n`));

    // readline - interface
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // check if jonBetLink is set
    const jonBetLink = dbConfig.get("jonBetLink");
    if (!jonBetLink || jonBetLink === "none") {
        rl.question(cyan("   [?] Qual link você deseja usar para JonBet? "), async (link) => {
            if (!link.trim()) {
                console.log(red("   [!] Link inválido. Tente novamente."));
                pauseAndReturnToMenu(true);
                return;
            };

            try {

                // ensure the link starts with the required prefix
                const requiredPrefix = "https://jonbet.cxclick.com/visit/?bta=";
                if (!link.trim().startsWith(requiredPrefix)) {
                    console.log(red("   [!] O link não é de afiliado da jonBet!"));
                    pauseAndReturnToMenu(true);
                    return;
                };

                // validate the link with a request
                console.log(yellow("   [!] Validando o link..."));
                await get(link.trim());
                dbConfig.set("jonBetLink", link.trim());
                console.log(green("   [+] Link salvo com sucesso!"));

                // add delay execute menu
                const spinner = createSpinner(" Carregando sistema...").start();
                setTimeout(() => {
                    spinner.success({ text: "Sistema carregado com sucesso!" });
                    showMenu();
                }, 3500);
            } catch (error) {
                console.log(red("   [!] O link fornecido é inválido ou inacessível."));
                pauseAndReturnToMenu();
            }
        });
        return;
    };

    // displays “loading”
    const spinner = createSpinner(" Carregando sistema...").start();
    setTimeout(() => {
        spinner.success({ text: "Sistema carregado com sucesso!" });
        showMenu();
    }, 3000);
};

// function to display interactive menu
async function showMenu() {

    // console - clear
    console.clear();

    // draw a title with ASCII art
    console.log(magenta(textSync(" JonBet", { horizontalLayout: 'default', font: 'Bloody' })));

    // additional information
    console.log(yellow("\n   [!] - Programmed by Unkoynx7\n"));

    // displays menu options
    const answers = await prompt([
        {
            type: "list",
            name: "option",
            message: `${gray(" O que você deseja fazer?")}`,
            choices: [
                { name: `${green(" ( 1 ) - Criar Conta [JONBET]( SEM DEPOSITO )")}`, value: "1" },
                { name: `${green(" ( 2 ) - Criar Conta [JONBET]( COM DEPOSITO )")}`, value: "2" },
                { name: `${red(" ( 3 ) - Sair")}`, value: "0" }
            ]
        }
    ]);

    // answers - option
    switch (answers.option) {
        case "1":
            createNewAccount(true);
            break;
        case "2":
            createNewAccount(false);
            break;
        case "0":
            console.log(red("\n   Saindo..."));
            process.exit();
        default:
            console.log(red("\n   [!] Opção inválida."));
            pauseAndReturnToMenu();
    };
};

// function to create a new account
function createNewAccount(status) {

    // answers - account
    prompt([
        {
            type: "input",
            name: "numAccounts",
            message: gray(" [?] Quantas contas você deseja criar? "),
            validate: (input) => {
                const num = parseInt(input);
                if (isNaN(num) || num <= 0) {
                    return `${red(" [!] Número inválido!")}`;
                };
                return true;
            },
        },
    ]).then(async (answers) => {

        // number - accounts
        const numAccounts = parseInt(answers.numAccounts);

        // format and check information
        formatInformation(numAccounts, status).then(() => {

            // initialize counters
            let successCount = 0;
            let errorCount = 0;

            // launches browsers without external proxy loading
            const tasks = Array.from({ length: numAccounts }).map((_, index) => {
                const numAccount = index + 1;
                console.log(yellow(`   [!] (${numAccount}) - Iniciando navegador...`));


                // launch a new browser without external proxy loading
                return launchBrowserWithProxy(numAccounts, numAccount, status).then(({ browser, page, randomUserAgent, cpf, proxy, email, password, name, number, zip, street, city, state }) => {
                    console.log(green(`   [+] (${numAccount}) - Navegador lançado com sucesso!`));
                    return createAccount(page, browser, randomUserAgent, numAccount, status, cpf, proxy, email, password, name, number, zip, street, city, state).then(() => {
                        if (status === true) {
                            console.log(green(`   [+] (${numAccount}) - Conta sem deposito criada com sucesso!`));
                            successCount++;
                        } else if (status === false) {
                            console.log(green(`   [+] (${numAccount}) - Conta com deposito criada com sucesso!`));
                            successCount++;
                        };
                    });
                }).catch((err) => {
                    console.error(red(`   [-] (${numAccount}) - ${err}`));
                    errorCount++;
                });
            });

            // wait for all the tasks to finish before returning to the menu
            Promise.all(tasks).finally(() => {

                // draw a title with ASCII art
                console.log("\n")
                console.log(magenta(textSync(" Finalizado", { horizontalLayout: 'default', font: 'ANSI Shadow' })));

                // display final results
                console.log(green(`   [+] Sucessos: ${successCount}`), red(`   [-] Erros: ${errorCount}`))
                pauseAndReturnToMenu("finished");
            });

        }).catch((err) => {
            console.error(red("   [-] Falha ao formatar informações. [CONTATE AOS ADM]"));
            pauseAndReturnToMenu();
        });
    });
};

// function to return to the menu
function pauseAndReturnToMenu(status) {

    // readline - interface
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // format - message
    let message = gray("\n   [RETURN] Pressione ENTER para voltar...");
    if (status === "finished") {
        message = gray("   [RETURN] Operação concluída! Pressione ENTER para voltar...");
    };

    // readline - question - back menu
    rl.question(message, () => {

        // close readline interface
        rl.close();

        // showMenu - clear
        console.clear();

        // check - status
        if (status === true) {
            showWelcomeScreen();
        } else {
            showMenu();
        };

    });
};

// export - menu
module.exports = { showWelcomeScreen };
