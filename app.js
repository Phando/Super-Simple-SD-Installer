import chalk from 'chalk';
import { execSync } from 'child_process';
import fse from 'fs-extra';
import path from 'path';
import utils from './utils.js';
import autoInstaller from './workers/auto111Installer.js';
import comfyInstaller from './workers/comfyInstaller.js';
import largeInstaller from './workers/largeInstaller.js';

global.prefs = {
    "rootPath": null,
    "dataPath": null,
    "autoPort": 7860,
    "comfyPort": 7861,
    "useNVidia": true
}

const directories = [
    "custom_nodes", 
    "output",
    "workflows",     
    "models/checkpoints",
    "models/checkpoints/sd",
    "models/checkpoints/sdxl",
    "models/classifiers",
    "models/clip",
    "models/clip_vision",
    "models/codeformer",
    "models/configs",
    "models/controlnet",
    "models/diffusers",
    "models/embeddings",
    "models/esrgan",
    "models/gfpgan",
    "models/hypernetworks",
    "models/ipadapter",
    "models/ldsr",
    "models/loras",
    "models/loras/sd",
    "models/loras/sdxl",
    "models/lycoris",
    "models/style_models",
    "models/swinir",
    "models/realesrgan",
    "models/upscale_models",
    "models/unet",
    "models/vae",
    "models/vae_approx"]

// ------------------------------------------------------------------
const onyxFix = async () => {
    if(!global.prefs.useNVidia) {
        console.log(chalk.magenta("\nUser selected non-nvidia install, skipping cuda driver check.\n"));
        return        
    }
    
    const output = execSync(`"${global.pythonPath}" -c "import torch; print(torch.__version__); print(torch.version.cuda)"`, { encoding: 'utf8' });
    if(output.includes("11.8")){
        console.log(chalk.magenta(`\nThe proper version of ${chalk.yellow("Cuda for OnyxRuntime")} is installed.\n`));    
        return;
    }
    
    const performFix = await utils.promptConfirmation(`\nFix the ${chalk.yellow("Cuda for OnyxRuntime")} to compatible versions (${chalk.yellow("2.1.1+cu118 and 11.8")})?`);
    console.log("");
    if(performFix){
        console.log("Fixing Cuda and OnyxRuntime...");
        execSync(`"${global.pythonPath}" -m pip uninstall torch torchvision torchaudio -y`, { encoding: 'utf8' });
        execSync(`"${global.pythonPath}" -m pip install torch==2.1.1+cu118 torchvision==0.16.1+cu118 torchaudio==2.1.1+cu118 -f https://download.pytorch.org/whl/torch_stable.html`, { encoding: 'utf8' });
        execSync(`"${global.pythonPath}" -m pip install onnxruntime-gpu`, { encoding: 'utf8' });
        await onyxFix();
    }
}   

// ------------------------------------------------------------------
const prepareEnvironment = async () => {
    global.currentPath = process.cwd();
    global.prefs = await utils.fetchJson('prefs.json') || global.prefs;
    global.jsonData = await utils.fetchJson('config.json');

    global.prefs.rootPath = global.prefs.rootPath || path.join(global.currentPath,'genai');
    global.prefs.dataPath = global.prefs.dataPath || path.join(global.currentPath,'genai_data');
    
    global.prefs.rootPath = await utils.promptUser(`\nEnter an ${chalk.yellow("absolute")} path for ${chalk.yellow("GenAI Applications")}`, global.prefs.rootPath);
    global.prefs.rootPath = global.prefs.rootPath.replace(/["']/g, "");
    console.log(`GenAI Path: ${global.prefs.rootPath}`);

    global.prefs.dataPath = await utils.promptUser(`\nEnter an ${chalk.yellow("absolute")} path for ${chalk.yellow("GenAI Data")} (large file storage)`, global.prefs.dataPath);
    global.prefs.dataPath = global.prefs.dataPath.replace(/["']/g, "");
    console.log(`GenAI Data Path: ${global.prefs.dataPath}`);

    global.prefs.useNVidia = await utils.promptConfirmation(`\nAre you using an NVidia GPU?`);
    console.log(`NVidia GPU Enabled: ${global.prefs.useNVidia}\n`);

    global.autoPath = path.join(global.prefs.rootPath, "auto1111")
    global.comfyPath = path.join(global.prefs.rootPath, "comfyui")
    global.pythonPath = path.join(global.comfyPath,"python_embeded/python.exe");

    const prefsString = JSON.stringify(global.prefs, null, 4);
    utils.saveFile('prefs.json', prefsString);

    utils.makeDir(global.prefs.rootPath);
    directories.forEach((item) => {
        let myPath = path.join(global.prefs.dataPath, item);
        utils.makeDir(myPath);
    });
}


// ------------------------------------------------------------------
const installFFMpeg = async () => {
    if(utils.ffmpegExists()){
        console.log(chalk.yellow("\nFFMpeg already installed."));
        if(await utils.promptConfirmation(`Do you want to reinstall ${chalk.yellow("FFMpeg")}?`)){
            fse.emptyDirSync(path.join(global.prefs.rootPath, 'ffmpeg'));
        }
        else {
            return;
        }
    }

    console.log("\nFFMpeg not installed. Downloading and installing FFMpeg...");
    await utils.downloadFile(global.jsonData.ffmpegInstallUrl, global.currentPath)
        .then(filePath => utils.extractZip(filePath, global.currentPath))
        .catch(error => console.error(error));

    let ffmpegPath = await utils.searchFor(global.currentPath, "ffmpeg")
    ffmpegPath = ffmpegPath[0];
    
    await utils.moveItem(path.join(global.currentPath, ffmpegPath, 'bin'), path.join(global.prefs.rootPath, 'ffmpeg'));
    fse.removeSync(path.join(global.currentPath, ffmpegPath));
    utils.addToSystemPath(path.join(global.prefs.rootPath, 'ffmpeg'));
    console.log(`Install complete: ${chalk.yellow("FFMpeg")}`);
}


// ------------------------------------------------------------------
const loadModels = async () => {
    let defaultModels = ["embeddings","workflows","vae"];
    const sdModels = ["controlnets","checkpoints","loras"];
    const sdxlModels = ["controlnetsXL","checkpointsXL","lorasXL"];
     
    showModelMenu();
    let input = await utils.promptUser('Enter your choice');
    
    switch(input){
        case '1' :
            defaultModels = [...defaultModels, ...sdModels];
        break;
        case '2' :
            defaultModels = [...defaultModels, ...sdxlModels];
        break;
        case '3' :
            defaultModels = [...defaultModels, ...sdModels, ...sdxlModels];
        break;
        default: return;
    }
    
    for (const item of defaultModels) {
        console.log(chalk.cyan("\nLoading " + item.toLocaleUpperCase()));
        try{
            await utils.fetchData(global.jsonData[item]);
        }
        catch(error){
            console.log(error);
        }
    }

    console.log(`Install complete: ${chalk.yellow("Model Data")}`);
}

// ------------------------------------------------------------------

const showModelMenu = () => {
    console.log(`\nChoose an Option: ${chalk.yellow('(Model Data)')}`);
    console.log(`${chalk.yellow('1')}. SD`);
    console.log(`${chalk.yellow('2')}. SDXL`);
    console.log(`${chalk.yellow('3')}. SD and SDXL`);
    console.log(`${chalk.yellow('4')}. Back`);
}

// ------------------------------------------------------------------

const showMainMenu = () => {
    const autoMessage = autoInstaller.isInstalled() ? `${chalk.green('Re-Install')}` : `Install`;
    const comfyMessage = comfyInstaller.isInstalled() ? `${chalk.green('Re-Install')}` : `Install`;
    const nodeMessage = comfyInstaller.nodesInstalled() ? `${chalk.green('Re-Install')}` : `Install`;
    const ffmpegMessage = utils.ffmpegExists() ? `${chalk.green('Re-Install')}` : `Install`;

    console.log(chalk.gray("\nData from config.json"));
    console.log(`\nChoose an Option:`);
    console.log(`${chalk.yellow('1')}. ${autoMessage} Automatic1111`);
    console.log(`${chalk.yellow('2')}. ${comfyMessage} ComfyUI`);
    console.log(`${chalk.yellow('3')}. ${nodeMessage} Custom Nodes`);
    console.log(`${chalk.yellow('4')}. Load Models...`);
    console.log(`${chalk.yellow('5')}. Large Installs...`);
    console.log(`${chalk.yellow('6')}. ${ffmpegMessage} FFMpeg (admin)`);
    console.log(`${chalk.yellow('7')}. Onyx Runtime Fix`);
    console.log(`${chalk.yellow('8')}. Create ComfyUI Symlinks (needed after update)`);
    console.log(`${chalk.yellow('9')}. Exit`);
}

// ------------------------------------------------------------------

const handleUserInput = async (input) => {
    const admin = ['6'];
    input = input.trim();
    
    if(admin.includes(input) && !utils.isAdministrator()){
        console.log(chalk.red(`This command requires ${chalk.yellow("administrative privileges")}. Please rerun this script as ${chalk.yellow("administrator")}.`))
        input = 'admin';
    }    

    if(input!='8' && !admin.includes(input) && utils.isAdministrator()){
        console.log(chalk.red(`This command should be run as a normal user. Please rerun this script without ${chalk.yellow("administrative privileges")}.`))
        input = 'admin';
    }

    switch (input) {
        case '1':
            await autoInstaller.install();
        break;
        case '2':
            await comfyInstaller.install();
        break;
        case '3':
            await comfyInstaller.installCustomNodes();
        break;
        case '4':
            await loadModels();
        break;
        case '5':
            await largeInstaller.install();
        break;
        case '6':
            await installFFMpeg();
        break;
        case '7':
            await onyxFix();
        break;
        case '8':
            comfyInstaller.makeSymlinks();
        break;
        case '9':
        return;
        case 'admin':
            // Empty Case, used to recover after administrative messages
        break;
        default:
            console.log('Invalid option, please enter 1-9');
    }

    showMainMenu();
    await waitForUserInput();
}


// ------------------------------------------------------------------
const waitForUserInput = async () => {
    const input = await utils.promptUser('Enter your choice')
    await handleUserInput(input); 
}
  
// ------------------------------------------------------------------

await prepareEnvironment();
// await utils.fetchData(global.jsonData["embeddings"]);
// await utils.fetchJson(`https://civitai.com/api/v1/models/257448`)  

// import nodeInstaller from './workers/nodeInstaller.js';
// await nodeInstaller.install("custom");

// const item = {
//     "type": "civitai",
//     "path": "models/checkpoints/sd",
//     "note": "Analog Madness",
//     "modelId": 8030
// }
// utils.downloadCivitai(item);

showMainMenu();
await waitForUserInput();
console.log("Happy Generating\n");