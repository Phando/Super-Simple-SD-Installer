import chalk from 'chalk';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import fse from 'fs-extra';
import fsp from 'fs/promises';
import path from 'path';
import utils from './utils.js';
// import { test } from 'node-7z';
import largeInstaller from './installers/largeInstaller.js';
import nodeInstaller from './installers/nodeInstaller.js';

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
    "models/lycoris",
    "models/style_models",
    "models/swinir",
    "models/realesrgan",
    "models/upscale_models",
    "models/unet",
    "models/vae",
    "models/vae_approx"]

// ------------------------------------------------------------------
const fetchData = async (data, options = []) => {
    data = utils.filterWithOptions(data, options);
    
    console.log(`Installing/Downloading ${chalk.cyan(data.length,)} items...`)
    for (const item of data) {
        let targetPath = path.join(global.prefs.dataPath, item.path);
        
        switch(item.type){
            case "get" : 
                await utils.downloadFile(item.url, targetPath)
                    .then(filePath => utils.extractZip(filePath, targetPath))
                    .catch(error => console.error(error));
            break;
            case "git" :
                let installPath = path.join(targetPath, utils.getNameFrom(item.url))
                if(fs.existsSync(installPath)){
                    console.log(chalk.magenta(`\n${chalk.yellow(item.note)} already installed.`));
                    continue;
                }    

                await utils.cloneRepository(item.url, targetPath);
                if(item.setup && item.setup == 'basic'){
                    utils.installRequirements(item);
                }
            break;
            case "civitai":
                await utils.downloadCivitai(item);
            break;
        }
    }
}

// ------------------------------------------------------------------
const updateLauncher = (filePath) => {
    const modFlag = "@REM GenAI Modified\n";
    const matchString = 'standalone-build';
    const patchString = `standalone-build --disable-auto-launch --listen --output-directory "${global.prefs.dataPath}\\output" --port ${global.prefs.comfyPort}`

    console.log(filePath);
    try{
        let data = fs.readFileSync(filePath, 'utf8');
        
        if(data.includes(modFlag)){
            console.log(chalk.magenta('Launcher already modified:'+ filePath));
            return;
        }

        data = modFlag + data;
        const updatedContent = data.replace(matchString, patchString);
        utils.saveFile(filePath, updatedContent);
    }
    catch (error){
        console.error("reading", error);
    }
}


// ------------------------------------------------------------------
const comfyDataFix = () => {
    utils.makeLink(path.join(global.prefs.dataPath,"custom_nodes"),path.join(global.comfyPath, "ComfyUI/custom_nodes"));
    utils.makeLink(path.join(global.prefs.dataPath,"models"),path.join(global.comfyPath, "ComfyUI/models"));
}

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
const installAuto1111 = async () => {
    const applicationPath = path.join(global.autoPath, "webui");

    if(fs.existsSync(global.autoPath)){
        console.log(chalk.magenta("\nAuto1111 already installed."));
        return;
    }
    
    console.log(chalk.magenta("\nAuto1111 not installed. Downloading and installing Auto1111..."));
    
    global.prefs.autoPort = await utils.promptUser(`\nEnter a port for the ${chalk.yellow("Automatic1111")} Server`,  global.prefs.autoPort);
    console.log(`Auto1111 Port: ${ global.prefs.autoPort}`);

    const prefsString = JSON.stringify(global.prefs, null, 4);
    utils.saveFile('prefs.json', prefsString);

    let configString = `
        title Auto1111
        set PYTHON=
        set GIT=
        set VENV_DIR=
        set COMMANDLINE_ARGS= --xformers --update-all-extensions --port ${ global.prefs.autoPort} ^
        --ckpt-dir "${global.prefs.dataPath}\\models\\checkpoints" ^
        --codeformer-models-path "${global.prefs.dataPath}\\models\\codeformer" ^
        --controlnet-dir "${global.prefs.dataPath}\\models\\controlnet" ^
        --embeddings-dir "${global.prefs.dataPath}\\models\\embeddings" ^
        --esrgan-models-path "${global.prefs.dataPath}\\models\\esrgan" ^
        --gfpgan-models-path "${global.prefs.dataPath}\\models\\gfpgan" ^
        --hypernetwork-dir "${global.prefs.dataPath}\\models\\hypernetworks" ^
        --ldsr-models-path "${global.prefs.dataPath}\\models\\ldsr" ^
        --lora-dir "${global.prefs.dataPath}\\models\\loras" ^
        --realesrgan-models-path "${global.prefs.dataPath}\\models\\realesrgan" ^
        --swinir-models-path "${global.prefs.dataPath}\\models\\swinir" ^
        --textual-inversion-templates-dir "${global.prefs.dataPath}\\models\\embeddings" ^
        --vae-dir "${global.prefs.dataPath}\\models\\vae"

        git pull
        call webui.bat`

    console.log(utils.getNameFrom(global.jsonData.autoInstallerUrl));
    const extractPath = path.join(global.currentPath, utils.getNameFrom(global.jsonData.autoInstallerUrl))
    await utils.downloadFile(global.jsonData.autoInstallerUrl, global.currentPath)
        .then(filePath => utils.extractZip(filePath, extractPath))
        .catch(error => console.error(error));
    await utils.moveItem(extractPath, global.autoPath);
    
    // Install the extensions
    let extensionsPath = path.join(applicationPath, "extensions")
    for(const item of global.jsonData.extensions){
        await utils.cloneRepository(item, extensionsPath);
    }
    
    utils.saveFile(path.join(applicationPath,"webui-user.bat"), configString.replace(/\\/g, '/'));
    // TODO: Add localStartup and sharedStarup
    console.log(`Install complete: ${chalk.yellow("Automatic 1111")}`);
}


// ------------------------------------------------------------------
const cycleComfyUI = async (waitTime = 180) => {
    global.childRunning = true;
    let count = 0;
    let args = ['-s', 'ComfyUI/main.py', '--windows-standalone-build', '--disable-auto-launch', '--port', global.prefs.comfyPort];
    if(!global.prefs.useNVidia){
        args.push('--cpu');
    }
    
    process.chdir(global.comfyPath);
    const child = spawn("python_embeded/python.exe", args, {stdout:'pipe'})

    child.stdout.on('data', (data) => {
        const output = data.toString();
        // console.log(output);
        if (output.includes('see the GUI') || output.includes('any key to continue')) {
            child.kill();
            global.childRunning = false;
        }
    });

    child.on('close', (code, signal) => {
        //console.log(`Child Closed with code ${code} and signal ${signal}`);
        global.childRunning = false;
    });
    child.on('exit', (code, signal) => {
        //console.log(`Child Exited with code ${code} and signal ${signal}`);
        global.childRunning = false;
    });
    child.on('disconnect', () => {
        //console.log('Child Process Complete');
        childRunning = false;
    });
    child.on('error', (error) => {
        console.error('Child:', error);
        global.childRunning = false;
    });
    
    while(global.childRunning && count < waitTime){
        count++;
        process.stdout.write(`\rComfyUI timeout in: ${chalk.yellow(waitTime-count)} `);   
        await utils.delay(1000);
    }
    
    if(global.childRunning){
        global.childRunning = false;
        child.kill();
    }

    process.stdout.write(`\rComfyUI run: Complete              \n\n`);   
    process.chdir(global.currentPath);
}


// ------------------------------------------------------------------
const installCustomNodes = async () => {
    if(!fs.existsSync(global.comfyPath)){
        console.log(chalk.red(`\n${chalk.yellow("ComfyUI")} is required before custom nodes can be installed.\nNot found in: ${chalk.yellow(global.comfyPath)} `));
        return;
    }

    // Simple Installs
    await fetchData(global.jsonData.customNodes, [{setup:"none"}]);
    await cycleComfyUI(); // 20

    // Requirements Needed 
    await fetchData(global.jsonData.customNodes, [{setup:"basic"}]);
    await cycleComfyUI();

    // Custom Installs
    const data = utils.filterWithOptions(global.jsonData.customNodes, [{setup:"custom"}]);
    for(const item of data){
        console.log(`Setting up: ${chalk.yellow(item.note)}`);
        let nodePath = path.join(global.prefs.dataPath, item.path); 
        
        if(item.type == "git"){
            await utils.cloneRepository(item.url, nodePath);
        }

        await nodeInstaller[item.installer](item);
        console.log("Done");
    }  

    await cycleComfyUI();  
    console.log(`Install complete: ${chalk.yellow("Custom Nodes")}`);
}


// ------------------------------------------------------------------
const installComfyUI = async () => {
    let applicationPath = path.join(global.comfyPath, "ComfyUI");
    
    if(fs.existsSync(global.comfyPath)){
        console.log(chalk.yellow("\nComfyUI already installed."));
        return;
    }

    console.log(chalk.magenta("\nComfyUI not installed. Downloading and installing ComfyUI..."));

    global.prefs.comfyPort = await utils.promptUser(`\nEnter a port for the ${chalk.yellow("ComfyUI")} Server`, global.prefs.comfyPort);
    console.log(`ComfyUI Port: ${global.prefs.comfyPort}`);
    
    const prefsString = JSON.stringify(global.prefs, null, 4);
    utils.saveFile('prefs.json', prefsString);

    // const configString = `
    // #config for a1111 ui
    // a111:
    //     base_path: "${global.prefs.dataPath}"

    //     checkpoints: "${global.prefs.dataPath}/models/checkpoints"
    //     configs: "${global.prefs.dataPath}/models/checkpoints"
    //     vae: "${global.prefs.dataPath}/models/vae"
    //     loras: |
    //         models/loras
    //         models/lycoris
    //     upscale_models: |
    //         models/esrgan
    //         models/realesrgan
    //         models/swinir
    //     embeddings: "${global.prefs.dataPath}/models/embeddings"
    //     hypernetworks: "${global.prefs.dataPath}/models/hypernetworks"
    //     controlnet: "${global.prefs.dataPath}/models/controlnet"

    // comfyui:
    //     base_path: "${global.prefs.dataPath}"
    //     checkpoints: models/checkpoints
    //     classifiers: models/classifiers
    //     clip: models/clip
    //     clip_vision: models/clip_vision
    //     configs: models/configs
    //     controlnet: models/controlnet
    //     diffusers: models/diffusers
    //     embeddings: models/embeddings
    //     loras: models/loras
    //     style_models: models/style_models
    //     unet: models/unet
    //     upscale_models: models/upscale_models
    //     vae: models/vae
    //     vae_approx: models/vae_approx

    // other_ui:
    //     # base_path: path/to/ui
    //     # checkpoints: "${global.prefs.dataPath}/models/checkpoints"
    //     # gligen: "${global.prefs.dataPath}/models/gligen"
    //     # custom_nodes: "${global.prefs.dataPath}/custom_nodes"
    // `

//     let folderMatch = "base_path = os.path.dirname(os.path.realpath(__file__))"
//     folderMatch = folderMatch.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
//     const folderString = `

// def check_folder_exists(folder_path):
//     if os.path.exists(folder_path):
//         return folder_path
//     else:
//         return os.path.dirname(os.path.realpath(__file__))
// base_path = check_folder_exists("${global.prefs.dataPath}")

// `

    // Download ComfyUI
    const extractPath = path.join(global.currentPath, "ComfyUI_windows_portable")
    await utils.downloadFile(global.jsonData.comfyInstallerUrl, global.currentPath)
        .then(filePath => utils.extractZip(filePath, global.currentPath))
        .catch(error => console.error(error));    
    await utils.moveItem(extractPath, global.comfyPath);
   
    // Update the run_cpu.bat launcher to use the output folder
    updateLauncher(path.join(global.comfyPath,"run_cpu.bat"));
    updateLauncher(path.join(global.comfyPath,"run_nvidia_gpu.bat"));
    
    // Change the ConfyUI Folder Root
    // const folderScript = path.join(applicationPath,"folder_paths.py");
    // let fileContent = await fsp.readFile(folderScript, 'utf8');
    // fileContent = fileContent.replace(new RegExp(folderMatch, 'g'), folderString.replace(/\\/g, '/'));
    // console.log(fileContent);
    // saveFile(folderScript, fileContent);
    
    // Add an extra_model_paths.yml to make use of all the custom paths
    // saveFile(path.join(applicationPath,"extra_model_paths.yaml"), configString.replace(/\\/g, '/'));
    comfyDataFix();
    // Install the manager
    fetchData(global.jsonData.customNodes, [{url:"ComfyUI-Manager.git"}]);
    await cycleComfyUI(60);
    console.log(`Install complete: ${chalk.yellow("ComfyUI with Manager")}`);
    
    let input = await utils.promptConfirmation('Would you like to install ComfyUI custom nodes?');
    if(input){
        await installCustomNodes();
    }
}

// ------------------------------------------------------------------
const installFFMpeg = async () => {
    if(utils.ffmpegExists()){
        console.log(`\n${chalk.yellow("FFMpeg")} already installed.`);
        return;
    }

    console.log("\nFFMpeg not installed. Downloading and installing FFMpeg...");
    await utils.downloadFile(global.jsonData.ffmpegInstallUrl, global.currentPath)
        .then(filePath => utils.extractZip(filePath, global.currentPath))
        .catch(error => console.error(error));

    let ffmpegPath = await utils.searchFor(global.currentPath, "ffmpeg");
    await utils.moveItem(path.join(global.currentPath, ffmpegPath[0], 'bin'), path.join(global.prefs.rootPath, 'ffmpeg'));
    fse.removeSync(path.join(global.currentPath, ffmpegPath[0]));
    utils.addToSystemPath(path.join(global.prefs.rootPath, 'ffmpeg'));
    console.log(`Install complete: ${chalk.yellow("FFMpeg")}`);
}

// ------------------------------------------------------------------
const largeInstalls = async () => {
    let index = 1;
    console.log(chalk.yellow('\nInstall:'));
    jsonData.largeInstalls.forEach((item) => {
        console.log(`${chalk.yellow(index)}. ${item.name} ~${item.size}g`);
        index++;
    });

    console.log(`${chalk.yellow(index)}. Back`);
    index = await utils.promptUser('Enter your choice');
    index = parseInt(index, 10) - 1;
    if(index >= global.jsonData.largeInstalls.length){
        return;
    }
    
    const item = global.jsonData.largeInstalls[index];
    if (largeInstaller.hasOwnProperty(item.installer)) {
        await largeInstaller[item.installer](item);
    }
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
            await fetchData(global.jsonData[item]);
        }
        catch(error){
            console.log(error);
        }
    }

    console.log(`Install complete: ${chalk.yellow("Model Data")}`);
}


// ------------------------------------------------------------------

const showModelMenu = () => {
    console.log(chalk.yellow('\nInstall for:'));
    console.log(`${chalk.yellow('1')}. SD`);
    console.log(`${chalk.yellow('2')}. SDXL`);
    console.log(`${chalk.yellow('3')}. SD and SDXL`);
    console.log(`${chalk.yellow('4')}. Back`);
}

// ------------------------------------------------------------------

const showMainMenu = () => {
    console.log(chalk.gray("\nData from config.json"));
    console.log(chalk.yellow('Choose an option:'));
    console.log(`${chalk.yellow('1')}. Install Automatic1111`);
    console.log(`${chalk.yellow('2')}. Install ComfyUI`);
    console.log(`${chalk.yellow('3')}. Install Custom Nodes`);
    console.log(`${chalk.yellow('4')}. Load Models...`);
    console.log(`${chalk.yellow('5')}. Large Installs...`);
    console.log(`${chalk.yellow('6')}. Install FFMpeg (admin)` );
    console.log(`${chalk.yellow('7')}. Onyx Runtime Fix`);
    console.log(`${chalk.yellow('8')}. Exit`);
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
            await installAuto1111();
        break;
        case '2':
            await installComfyUI();
        break;
        case '3':
            await installCustomNodes();
        break;
        case '4':
            await loadModels();
        break;
        case '5':
            await largeInstalls();
        break;
        case '6':
            await installFFMpeg();
        break;
        case '7':
            await onyxFix();
        break;
        case '8':
        return;
        case 'admin':
            // Empty Case, used to recover after administrative messages
        break;
        default:
            console.log('Invalid option, please enter 1-8');
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
// await fetchData(global.jsonData["embeddings"]);
// await utils.fetchJson(`https://civitai.com/api/v1/models/257448`)

showMainMenu();
await waitForUserInput();
console.log("Happy Generating\n");