// fs - path
const { readFile, writeFile, readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");

// chalk - colorize text
const { red, green } = require("chalk");

// axios - request
const { post, get } = require("axios");

// qs - codifications
const { stringify } = require("qs");

// function to perform account creation
module.exports = async function checkingInformation(status) {

    // checking the number of lines in the CPF and Proxies files
    const cpfsPath = join(__dirname, "../../data/input/cpfs.txt");
    const proxiesPath = join(__dirname, "../../data/input/proxies.txt");

    // try - error processing
    try {

        // validated according to status
        if (status === true) {

            // validates and rewrites the CPF file
            await validateAndRewriteCPFs(cpfsPath);


        } else if (status === false) {

            // validates and rewrites the Proxies file
            await validateAndRewriteProxies(proxiesPath);

        };

    } catch (err) {
        console.log(red(`   [!] Ocorreu um erro! (CONTATE AOS ADM)`));
        return;
    };

};

// function to validate of CPFs
const validateAndRewriteCPFs = (filePath) => {
    return new Promise((resolve, reject) => {
        readFile(filePath, 'utf8', (err, data) => {

            // separate lines, remove spaces
            const cpfs = data.split('\n').map(line => line.trim()).filter(line => line);

            // function to validate the CPF using the API
            const validateCpfWithApi = (cpf) => {
                return new Promise((resolve, reject) => {
                    const url = 'https://www.4devs.com.br/ferramentas_online.php';
                    post(url, stringify({
                        acao: 'validar_cpf',
                        txt_cpf: cpf
                    })).then(response => {

                        // check - result
                        const result = response.data.split(' - ')[1];
                        if (result === 'Verdadeiro') {

                            // check - lotogreen API
                            post('https://lotogreen.com/api/validate/document', {
                                document: cpf
                            }).then(response => {

                                const { name } = response.data;
                                if (name === null) {

                                    // resolve - invalid
                                    console.log(red(`   [-] CPF inválido: ${cpf}`));
                                    resolve(false);

                                } else {

                                    // resolve - success
                                    resolve(true);

                                };

                            }).catch(error => {
                                saveErrorData("cpf", cpf);
                                console.log(red(`   [-] CPF inválido: Erro desconhecido - ${cpf}`));
                                resolve(false);
                            });

                        } else {

                            // resolve - invalid
                            console.log(red(`   [-] CPF inválido: ${cpf}`));
                            resolve(false);
                        };

                    }).catch(error => {
                        saveErrorData("cpf", cpf);
                        console.log(red(`   [-] CPF inválido: Erro desconhecido - ${cpf}`));
                        resolve(false);
                    });
                });
            };

            // valid - cpfs
            const validCPFsPromises = cpfs.map(cpf => validateCpfWithApi(cpf));
            Promise.all(validCPFsPromises).then(results => {
                const validCPFs = cpfs.filter((_, index) => results[index]);

                // check if no valid cpf was found
                if (validCPFs.length === 0) {

                    // clear the file if there are no valid CPFs
                    writeFile(filePath, '', 'utf8', (err) => {

                        // resolve - success
                        console.log(red(`   [!] Nenhum CPF válido encontrado no arquivo!`));
                        resolve();
                    });
                    return;
                };

                // rewrites the file with valid CPFs
                writeFile(filePath, validCPFs.join('\n'), 'utf8', (err) => {

                    // resolve - success
                    console.log(green(`   [+] ${validCPFs.length} CPFs válidos.`));
                    resolve();
                });

            });

        });

    });

};

// function to validate of Proxies
const validateAndRewriteProxies = (filePath) => {
    return new Promise((resolve, reject) => {
        readFile(filePath, 'utf8', (err, data) => {

            // separate lines, remove spaces
            const proxies = data.split('\n').map(line => line.trim()).filter(line => line);

            // function to test a specific proxy
            const testProxy = (proxy) => {
                return new Promise((resolve) => {
                    const [host, port, username, password] = proxy.split(':');
                    const proxyConfig = {
                        host,
                        port: parseInt(port, 10),
                        auth: { username, password },
                    };

                    // Test the proxy by accessing example.com (HTTP site)
                    get('http://example.com', {
                        proxy: proxyConfig,
                        timeout: 5000,
                    }).then(response => {

                        // check if the response was successful
                        if (response && response.status >= 200 && response.status < 300) {
                            resolve(true);
                        };

                    }).catch(error => {

                        // check if the error is a response status
                        if (error.response && error.response.status) {
                            console.log(red(`   [-] Proxy inválida: ${proxy}`));
                        } else {
                            saveErrorData("proxy", proxy);
                            console.log(red(`   [-] Proxy inválida: Erro desconhecido - ${proxy}`));
                        };
                        resolve(false);
                    });
                });
            };

            // valid - proxies
            const validProxiesPromises = proxies.map(proxy => testProxy(proxy));
            Promise.all(validProxiesPromises).then(results => {
                const validProxies = proxies.filter((_, index) => results[index]);

                // check if no valid proxies were found
                if (validProxies.length === 0) {

                    // clear the file if there are no valid proxies
                    writeFile(filePath, '', 'utf8', (err) => {

                        // resolve - success
                        console.log(red(`   [!] Nenhum Proxy válido encontrado no arquivo!`));
                        resolve();
                    });
                    return;
                };

                // rewrites the file with valid proxies
                writeFile(filePath, validProxies.join('\n'), 'utf8', (err) => {

                    // resolve - success
                    console.log(green(`   [+] ${validProxies.length} Proxies válidas.`));
                    resolve();
                });

            });

        });

    });

};

// function to save error data into a file
async function saveErrorData(type, data) {
    const filePathErrorCpf = join(__dirname, "../../data/errors/cpfs.txt");
    const filePathErrorProxy = join(__dirname, "../../data/errors/proxies.txt");

    if (type === "cpf") {
        let cpfData = existsSync(filePathErrorCpf) ? readFileSync(filePathErrorCpf, "utf-8").split("\n").filter(Boolean) : [];
        if (!cpfData.includes(data)) {
            cpfData.push(data);
            writeFileSync(filePathErrorCpf, cpfData.join("\n"), { flag: "w" });
        };
    };

    if (type === "proxy") {
        let proxyData = existsSync(filePathErrorProxy) ? readFileSync(filePathErrorProxy, "utf-8").split("\n").filter(Boolean) : [];
        if (!proxyData.includes(data)) {
            proxyData.push(data);
            writeFileSync(filePathErrorProxy, proxyData.join("\n"), { flag: "w" });
        };
    };
};