import axios from 'axios';
import chalk from 'chalk';
import { exec, execSync, spawn } from 'child_process';
import fs from 'fs';
import fse from 'fs-extra';
import fsp from 'fs/promises';
import Seven from 'node-7z'
import sevenBin from '7zip-bin'
import path from 'path';
import readline from 'readline';
import { simpleGit, CleanOptions } from 'simple-git';

// simpleGit().clean(CleanOptions.FORCE);

class Utils {
    blank = ' '.repeat(175);
    pathTo7zip = sevenBin.path7za

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
        const matchingFolders = filesAndFolders.filter(str => str.includes(searchTerm));
        console.log('Matched folders:', matchingFolders);
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
        if(filterOptions.length > 0){
            return sourceData.filter(item => 
                filterOptions.some(option => 
                    Object.keys(option).every(key => item[key].includes(option[key]))
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
            console.error('Error loading JSON:', error);
            throw error; // Rethrow the error for the caller to handle, if needed
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
                process.stdout.write(`\r${this.blank}`);    
                process.stdout.write(`\rExtracting: ${data.file}`);
            });
            
            result.on('end', () => {
                process.stdout.write(`\r${this.blank}`);
                fse.removeSync(filePath);
                global.extracting = false;
            });

            while(global.extracting){
                await this.delay(2000);
            }

            await this.delay(1000);
            console.log('\nExtraction finished\n');
        }
        catch (error) {
            global.extracting = false;
            throw new Error(`Error extracting files: ${error}`);
        }
    }

// ------------------------------------------------------------------
    installRequirements = async (item) => {
        let nodesPath = path.join(global.jsonData.dataPath, item.path, this.getNameFrom(item.url)); 
        process.chdir(nodesPath);
        try {
            console.log("Installing Requirements for:", this.getNameFrom(item.url));
            const output = execSync(`${global.pythonPath} -s -m pip install -r requirements.txt`, { encoding: 'utf8' });
        } catch (error) {
            console.error('Error occurred:', error);
        }
        process.chdir(global.currentPath);
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
            await this.runCommand(`git clone --recurse-submodules ${repoUrl} ${targetPath}`);
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
            console.error('Error downloading file:', error);
            throw error;
        }
    }

// ------------------------------------------------------------------
    getModelVersion(jsonData, item) {
        let modelVersion = null;
        if (jsonData.modelVersions && jsonData.modelVersions.length > 0) {
            if('versionId' in item){
                modelVersion = jsonData.modelVersions.filter(version => version.id === item.versionId)[0];
            }
            else {
                modelVersion = jsonData.modelVersions[0];
            }
        }
        return modelVersion;
    }

// ------------------------------------------------------------------
    getVersionFile(modelVersion) {
        const validFiles = ["model","negative","archive"];
         if (modelVersion.files && modelVersion.files.length > 0) {
           return modelVersion.files.find(file => validFiles.includes(file.type.toLowerCase()));
        }
        return null;
    }

// ------------------------------------------------------------------
    downloadCivitai = async (item) => {
        console.log(`Fetching metadata for model:${chalk.yellow(item.note)} id:${chalk.yellow(item.modelId)}`);
        const targetPath = path.join(global.jsonData.dataPath, item.path);
        const jsonData = await this.fetchJson(`https://civitai.com/api/v1/models/${item.modelId}`);

        const modelVersion = this.getModelVersion(jsonData, item);
        if(!modelVersion){
            console.log(chalk.red(`Unable to find metadata for model id:${chalk.yellow(item.note)}`));
            return;
        }
        
        const modelFile = this.getVersionFile(modelVersion);
        if(!modelFile){
            console.log(chalk.red(`Fetching metadata failed model:${chalk.red(item.note)} id: ${chalk.red(item.modelId)}`));
            return;
        }
        if(fs.existsSync(path.join(targetPath,modelFile.name))){
            console.log(`${chalk.yellow(modelFile.name)} already exists in:${chalk.yellow(targetPath)}`);
            return;
        }

        console.log(chalk.magenta("Downloading:", Math.floor(modelFile.sizeKB / 1024),"mb...\n"));
        if(modelFile.type.toLowerCase() == "archive"){
            await utils.downloadFile(modelVersion.downloadUrl, global.currentPath)
                .then(filePath => utils.extractZip(filePath, targetPath))
                .catch(error => console.error(error));    
            return;
        }
        
        // Past the sanity checks, prep the data
        let filePrefix = modelFile.name.split('.')[0];
        let imageType = this.getTypeFrom(modelVersion.images[0].url);
        
        let metadata = {
            description:jsonData.description,
            name:jsonData.name,
            extensions: {
                super_installer: {
                    version: "0.0.1",
                    url: "https://github.com/Phando/Super-Simple-SD-Installer"
                }
            }
        }
        
        const versionFields = [
            {match:"baseModel", target:"baseModel"},
            {match:"description", target:"notes"},
            {match:"name", target:"versionName"},
            {match:"trainedWords", target:"trainedWords"}]

        versionFields.forEach((item) => {
            if(modelVersion[item.match]){
                metadata[item.target] = modelVersion[item.match];
            }    
        });

        
        // Mark up the url with modelFile metadata
        let downloadUrl = modelFile.downloadUrl + "?";
        if('type' in modelFile){
            downloadUrl += "type=" + modelFile.type;
        }

        if('metadata' in modelFile){
            for (const key in modelFile.metadata) {
                if(modelFile.metadata[key] != null){
                    downloadUrl += `&${key}=${modelFile.metadata[key]}`;
                }  
            }
        }
        
        // Download the data and save generated files to disk
        fse.writeJsonSync(path.join(targetPath,`${filePrefix}.json`), metadata, { spaces: 2 });
        fse.writeJsonSync(path.join(targetPath,`${filePrefix}.civitai.info`), jsonData, { spaces: 2 });
        await this.downloadFile(modelVersion.images[0].url, targetPath, `${filePrefix}.${imageType}`);
        await this.downloadFile(downloadUrl, targetPath, modelFile.name);
    }
}

const utils = new Utils();
export default utils;