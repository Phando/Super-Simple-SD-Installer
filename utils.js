import axios from 'axios';
import chalk from 'chalk';
import { exec, execSync } from 'child_process';
import fs from 'fs';
import fse from 'fs-extra';
import fsp from 'fs/promises';
import Seven from 'node-7z'
import sevenBin from '7zip-bin'
import path from 'path';
import readline from 'readline';

const validTypes = ["model","negative","archive"];
const versionFields = [
    {match:"baseModel", target:"baseModel"},
    {match:"description", target:"notes"},
    {match:"name", target:"versionName"},
    {match:"type", target:"type"},
    {match:"trainedWords", target:"trainedWords"}]

class Utils {
    blank = ' '.repeat(175);
    pathTo7zip = sevenBin.path7za

    // ------------------------------------------------------------------
    extractErrorMessage = (fullErrorMessage, searchText = "ModuleNotFoundError: No module named") => {
        const lines = fullErrorMessage.split('\n'); // Split the error message into lines
        const line = lines.find(line => line.includes(searchText)); // Find the line containing the searchText
        return line || null; // Return the found line or a default message
    }

    // ------------------------------------------------------------------
    pathToRepo = (item) => {
        return path.join(global.prefs.dataPath, item.path, this.getNameFrom(item.url)); 
    }

    // ------------------------------------------------------------------
    addToSystemPath = (targetPath) => {
        const systemPath = process.env.PATH.split(path.delimiter);
        if(systemPath.includes(targetPath)){
            return;
        }
        
        exec(`setx /M PATH "%PATH%;${targetPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        });
    }

// ------------------------------------------------------------------
    isAdministrator = () => {
        try{
            execSync('net session', { stdio: 'ignore' });
            return true;
        }
        catch(error){
            return false;
        }
    }

// ------------------------------------------------------------------
    delay = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

// ------------------------------------------------------------------
    ffmpegExists() {
        try{
            execSync('ffmpeg -version', { stdio: 'ignore' });
            return true;
        }
        catch(error){
            return false;
        }
    }

// ------------------------------------------------------------------
    searchFor = async (searchPath, searchTerm) => {
        const filesAndFolders = await fsp.readdir(searchPath);
        const matchingFolders = filesAndFolders.filter(str => str.toLocaleLowerCase().includes(searchTerm));
        // console.log('Matched folders:', matchingFolders);
        return matchingFolders;
    }

// ------------------------------------------------------------------
    getNameFrom = (url) => {
        const parts = url.split('/');
        let lastPart = parts.pop() || parts.pop();  // handles potential trailing slash

        if (lastPart.endsWith('.zip') || lastPart.endsWith('.git')) {
            lastPart = lastPart.replace(/.zip$|.git$/, '');
        }

        return lastPart;
    };

// ------------------------------------------------------------------
    getTypeFrom(str) {
        const lastIndex = str.lastIndexOf('.');
    
        if (lastIndex !== -1) {
            return str.substring(lastIndex + 1);
        } else {
            return str; // or return null if you prefer
        }
    }

// ------------------------------------------------------------------
    filterWithOptions = (sourceData, filterOptions) => {
        if (filterOptions.length > 0) {
            return sourceData.filter(item => 
                filterOptions.some(option => 
                    Object.keys(option).every(key => 
                        key in item && item[key].includes(option[key])
                    )
                )
            );
        }
        return sourceData;
    }


// ------------------------------------------------------------------
    fetchJson = async(source) => {
        try {
            if (source.startsWith('http://') || source.startsWith('https://')) {
                const response = await axios.get(source);
                return response.data;
            } else {
                const data = await fsp.readFile(source, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.log(chalk.red('FetchJson Error - Request Config:'), error.config);
            return null;
        }
    }

// ------------------------------------------------------------------
    promptConfirmation = (question, defaultResponse = true) => {
        const defaultString = defaultResponse ? "(Y/n)" : "(y/N)";
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(`${question} ${chalk.yellow(defaultString)}: `, (answer) => {
                const normalizedAnswer = answer.trim().toLowerCase();
                rl.close();
                if (normalizedAnswer === '') {
                    resolve(defaultResponse);
                } else {
                    const isYes = ['y', 'yes'].includes(normalizedAnswer);
                    resolve(isYes);
                }
            });
        });
    }


// ------------------------------------------------------------------
    promptUser = (question, defaultValue = '') => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        if(defaultValue != ''){
            question += `(${chalk.yellow(defaultValue)})`
        }
            
        return new Promise((resolve) => {
            rl.question(`${question}: `, (input) => {
                rl.close();
                resolve(input || defaultValue);
            });
        });
    }


// ------------------------------------------------------------------
    saveFile(filePath, fileContent){
        fs.writeFileSync(filePath, fileContent, 'utf8', (err) => {
            if (err) {
                console.error('Error writing:', err);
                return;
            }
            console.log('File saved', filePath);
        });
    }

// ------------------------------------------------------------------
    moveItem = async (sourcePath, destinationPath) => {
        try {
            console.log(`Moving ${sourcePath} -> ${destinationPath}`);
            process.stdout.write("\rCopy Begin... ");
            fse.copySync(sourcePath, destinationPath);
            process.stdout.write("\rCopy done, removing original...");
            await fsp.rm(sourcePath, { recursive: true, force: true });
            process.stdout.write("\rMove Complete                  \n");
        } catch (error) {
            console.error('Error copying:', error);
        }
    }


// ------------------------------------------------------------------
    makeDir(dirPath){
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(chalk.magenta(`Directory ${dirPath} created successfully.`));
            } else {
                console.log(chalk.magenta(`Directory ${dirPath} already exists.`));
            }
        } catch (err) {
            console.error(`Error creating directory: ${err}`);
        }
    }

// ------------------------------------------------------------------
    makeLink = (sourcePath, linkPath) => {
        if(fse.existsSync(linkPath)){
            fse.removeSync(linkPath);
        }

        try {
            fs.symlinkSync(sourcePath, linkPath, 'junction');
            console.log(chalk.magenta('Symbolic link created successfully.'));
        }
        catch(error){
            console.error(chalk.red('Error creating symbolic link:'), error);
        }
    }


    // ------------------------------------------------------------------
    installRequirements = async (item) => {
        let nodesPath = this.pathToRepo(item);
        process.chdir(nodesPath);
        try {
            console.log("Installing Requirements for:", this.getNameFrom(item.url));
            const output = execSync(`"${global.pythonPath}" -s -m pip install -r requirements.txt`, { encoding: 'utf8' });
        } catch (error) {
            console.error('Error occurred:', error);
        }
        process.chdir(global.currentPath);
    }

    // ------------------------------------------------------------------
    fetchData = async (data, options = []) => {
        data = this.filterWithOptions(data, options);
        
        console.log(`Installing/Downloading ${chalk.cyan(data.length,)} items...`)
        for (const item of data) {
            let targetPath = path.join(global.prefs.dataPath, item.path);
            
            switch(item.type){
                case "get" : 
                    await this.downloadFile(item.url, targetPath)
                        .then(filePath => this.extractZip(filePath, targetPath))
                        .catch(error => console.error(error));
                break;
                case "git" :
                    let repoName = this.getNameFrom(item.url);
                    let installPath = path.join(targetPath, repoName)
                    if(fs.existsSync(installPath)){
                        console.log(chalk.magenta(`\n${chalk.yellow(item.note)} already installed.`));
                        continue;
                    }    

                    await this.cloneRepository(item.url, targetPath);
                    if("reqs" in item){
                        this.installRequirements(item);
                    }
                break;
                case "civitai":
                    await this.downloadCivitai(item);
                break;
            }
        }
    }


// ------------------------------------------------------------------
    runCommand = (command) => {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error: ${error.message}`);
                    reject(error);
                }
                if (stderr && !stdout) {
                    console.log(command);
                    if(stderr.includes("Cloning into")){
                        console.log(`STE Info: ${stderr}`);
                    }
                    else {
                        console.error(`Stderr: ${stderr}`);
                        reject(new Error(stderr));
                    }
                }
                console.log(`STO Info: ${stdout}`);
                resolve(stdout);
            });
        });
    }

      
// ------------------------------------------------------------------      
    cloneRepository = async (repoUrl, targetPath) => {
        targetPath = path.join(targetPath, this.getNameFrom(repoUrl));
        
        if(fs.existsSync(path.join(targetPath))){
            console.log(`Repo exists: ${chalk.yellow(targetPath)}\nSkipping clone`);
            return targetPath;
        }
        
        try {
            console.log(`Cloning repo ${chalk.yellow(repoUrl)} -> ${chalk.yellow(targetPath)}`);
            await this.runCommand('git lfs install');
            await this.runCommand(`git clone --recurse-submodules "${repoUrl}" "${targetPath}"`);
            console.log('Repository cloned successfully.');
        } catch (error) {
            console.error(chalk.red('Failed to clone repository:'), error);
        }

        return targetPath;
    }


// ------------------------------------------------------------------
    downloadFile = async (url, outputPath, fileName = null) => {
        try {
            const response = await axios({
                url: url,
                method: 'GET',
                responseType: 'stream' // Important to handle downloads of large files
            });

            if(!fileName){
                // Extract filename from Content-Disposition header if available
                const contentDisposition = response.headers['content-disposition'];
                fileName = contentDisposition ? contentDisposition.split('filename=')[1] : path.basename(new URL(url).pathname);
                fileName = fileName.replace(/['"]/g, '');
            }

            // Set up the path and write stream
            const filePath = path.resolve(outputPath, fileName);
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filePath));
                writer.on('error', reject);
            });
        } catch (error) {
            console.error('Error downloading file:', error.config);
            throw error;
        }
    }


// ------------------------------------------------------------------
    extractZip = async (filePath, outputPath) => {
        if(!filePath.includes(".zip") && !filePath.includes(".7z")){
            return;
        }

        try {
            global.extracting = true;
            console.log("Extracting:", filePath);
            const result  = Seven.extractFull(filePath, outputPath, {
                $bin: this.pathTo7zip,
                $recursive: true
            })

            result.on('data', (data) => {
                process.stdout.write(`\rExtracting: ${data.file.padEnd(120, ' ')}`);
            });
            
            result.on('end', () => {
                fse.removeSync(filePath);
                global.extracting = false;
            });

            while(global.extracting){
                await this.delay(2000);
            }

            await this.delay(1000);
            console.log(`\rExtraction ${"complete".padEnd(120,' ')}\n`);
        }
        catch (error) {
            global.extracting = false;
            throw new Error(`Error extracting files: ${error}`);
        }
    }


// ------------------------------------------------------------------
    getVersionInfo = (modelData, modelVersion) => {
        let metadata = {
            description:modelData.description,
            name:modelData.name,
            extensions: {
                super_installer: {
                    version: "0.0.1",
                    url: "https://github.com/Phando/Super-Simple-SD-Installer"
                }
            }
        }
        
        versionFields.forEach((item) => {
            if(modelVersion[item.match]){
                metadata[item.target] = modelVersion[item.match];
            }    
        });

        return metadata;
    }

// ------------------------------------------------------------------
    getVersionFile = (modelVersion) => {
        if (!modelVersion.files || modelVersion.files.length == 0) {
            return null;
        }
        
        let versionFile = modelVersion.files.find(file => validTypes.includes(file.type.toLowerCase()));
        versionFile.filePrefix = versionFile.name.split('.')[0];
        versionFile.imageType = this.getTypeFrom(modelVersion.images[0].url);
        versionFile.imageUrl = modelVersion.images[0].url;
        
        // Mark up the url with versionFile metadata
        if('type' in versionFile){
            versionFile.metadata.type = versionFile.type;
        }

        // let downloadUrl = versionFile.downloadUrl.includes("?") ? versionFile.downloadUrl : versionFile.downloadUrl + "?";
        // if('metadata' in versionFile){
        //     for (const key in versionFile.metadata) {
        //         if(versionFile.metadata[key] != null && !downloadUrl.includes(key)){
        //             downloadUrl += `&${key}=${versionFile.metadata[key]}`;
        //         }  
        //     }
        // }
        // versionFile.downloadUrl = downloadUrl;
        return versionFile;
    }

// ------------------------------------------------------------------
    getModelVersion = async (modelData, item) => {
        let modelVersion = modelData.modelVersions[0];
        if('versionId' in item){
            modelVersion = modelData.modelVersions.filter(version => version.id === item.versionId)[0];
        }
        
        return modelVersion;
    }

// ------------------------------------------------------------------
    getModelData = async (item) => {
        console.log(`Fetching metadata for model:${chalk.yellow(item.note)} id:${chalk.yellow(item.modelId)}`);
        try {
            const modelData = await this.fetchJson(`https://civitai.com/api/v1/models/${item.modelId}`);
            if(!modelData || !modelData.modelVersions || modelData.modelVersions.length == 0){
                return null;
            }
            return modelData;
        }
        catch(error){
            console.log(chalk.red("GetModelData:"),error);
            return null;
        }
    }

// ------------------------------------------------------------------
    downloadCivitai = async (item) => {
        const targetPath = path.join(global.prefs.dataPath, item.path);
        const modelData = await this.getModelData(item);
        if(!modelData){
            console.log(chalk.red(`Unable to find metadata for model:${chalk.yellow(item.note)}\n`));
            return;
        }

        const modelVersion = await this.getModelVersion(modelData, item);
        if(!modelVersion){
            console.log(chalk.red(`Unable to find model version for model:${chalk.yellow(item.note)}\n`));
            return;
        }
        
        const versionFile = this.getVersionFile(modelVersion);
        if(!versionFile){
            console.log(chalk.red(`Unable to find file version for model:${chalk.yellow(modelVersion.name)}\n`));
            return;
        }

        if(fs.existsSync(path.join(targetPath, versionFile.name))){
            console.log(`${chalk.yellow(versionFile.name)} already exists in:${chalk.yellow(targetPath)}\n`);
            return;
        }

        // Download the data and save generated files to disk
        console.log(chalk.magenta("Downloading:", Math.floor(versionFile.sizeKB / 1024),"mb..."));
        console.log(`Type: ${chalk.cyan(versionFile.type)}\n`);
        if(versionFile.type.toLowerCase() == "archive"){
            await this.downloadFile(versionFile.downloadUrl, global.currentPath)
                .then(filePath => this.extractZip(filePath, targetPath))
                .catch(error => console.error(error));    
            return;
        }
        
        const versionInfo = this.getVersionInfo(modelData, modelVersion);
        versionInfo.name = versionInfo.name || versionFile.name;
        fse.writeJsonSync(path.join(targetPath,`${versionFile.filePrefix}.json`), versionInfo, { spaces: 2 });
        fse.writeJsonSync(path.join(targetPath,`${versionFile.filePrefix}.civitai.info`), modelData, { spaces: 2 });
        await this.downloadFile(versionFile.imageUrl, targetPath, `${versionFile.filePrefix}.${versionFile.imageType}`);
        await this.downloadFile(versionFile.downloadUrl, targetPath, versionFile.name);
    }
}

const utils = new Utils();
export default utils;