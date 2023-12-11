import chalk from 'chalk';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import fse from 'fs-extra';
import fsp from 'fs/promises';
import path from 'path';
import utils from './utils.js';

const directories = [
    "custom_nodes", 
    "output",
    "workflows",     
    "models/checkpoints",
    "models/classifiers",
    "models/clip",
    "models/codeformer",
    "models/configs",
    "models/controlnet",
    "models/diffusers",
    "models/embeddings",
    "models/esrgan",
    "models/gfpgan",
    "models/hypernetworks",
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
        let targetPath = path.join(global.jsonData.dataPath, item.path);
        
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
    const patchString = `standalone-build --disable-auto-launch --listen --output-directory "${global.jsonData.dataPath}\\output" --port ${global.jsonData.comfyPort}`

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
    utils.makeLink(path.join(global.jsonData.dataPath,"custom_nodes"),path.join(global.comfyPath, "ComfyUI/custom_nodes"));
    utils.makeLink(path.join(global.jsonData.dataPath,"models"),path.join(global.comfyPath, "ComfyUI/models"));
}

// ------------------------------------------------------------------
const onyxFix = async () => {
    if(!global.jsonData.useNVidia) {
        console.log(chalk.magenta("\nUser selected non-nvidia install, skipping cuda driver check.\n"));
        return        
    }
    
    const output = execSync(`${global.pythonPath} -c "import torch; print(torch.__version__); print(torch.version.cuda)"`, { encoding: 'utf8' });
    if(output.includes("11.8")){
        console.log(chalk.magenta(`\nThe proper version of ${chalk.yellow("Cuda for OnyxRuntime")} is installed.\n`));    
        return;
    }
    
    const performFix = await utils.promptConfirmation(`\nFix the ${chalk.yellow("Cuda for OnyxRuntime")} to compatible versions (${chalk.yellow("2.1.1+cu118 and 11.8")})?`);
    console.log("");
    if(performFix){
        console.log("Fixing Cuda and OnyxRuntime...");
        execSync(`${global.pythonPath} -m pip uninstall torch torchvision torchaudio -y`, { encoding: 'utf8' });
        execSync(`${global.pythonPath} -m pip install torch==2.1.1+cu118 torchvision==0.16.1+cu118 torchaudio==2.1.1+cu118 -f https://download.pytorch.org/whl/torch_stable.html`, { encoding: 'utf8' });
        execSync(`${global.pythonPath} -m pip install onnxruntime-gpu`, { encoding: 'utf8' });
        await onyxFix();
    }
}   

// ------------------------------------------------------------------
const prepareEnvironment = async () => {
    global.currentPath = process.cwd();
    global.jsonData = await utils.fetchJson('config.json');

    global.jsonData.rootPath = global.jsonData.rootPath || path.join(global.currentPath,'genai');
    global.jsonData.dataPath = global.jsonData.dataPath || path.join(global.currentPath,'genai_data');
    
    global.jsonData.rootPath = await utils.promptUser(`\nEnter an ${chalk.yellow("absolute")} path for ${chalk.yellow("GenAI Applications")}`, global.jsonData.rootPath);
    global.jsonData.rootPath = global.jsonData.rootPath.replace(/["']/g, "");
    console.log(`GenAI Path: ${global.jsonData.rootPath}`);

    global.jsonData.dataPath = await utils.promptUser(`\nEnter an ${chalk.yellow("absolute")} path for ${chalk.yellow("GenAI Data")} (large file storage)`, global.jsonData.dataPath);
    global.jsonData.dataPath = global.jsonData.dataPath.replace(/["']/g, "");
    console.log(`GenAI Data Path: ${global.jsonData.dataPath}`);

    global.jsonData.useNVidia = await utils.promptConfirmation(`\nAre you using an NVidia GPU?`);
    console.log(`NVidia GPU Enabled: ${global.jsonData.useNVidia}\n`);

    global.autoPath = path.join(global.jsonData.rootPath, "auto1111")
    global.comfyPath = path.join(global.jsonData.rootPath, "comfyui")
    global.pythonPath = path.join(global.comfyPath,"python_embeded/python.exe");

    const jsonString = JSON.stringify(global.jsonData, null, 4);
    utils.saveFile('config.json', jsonString);

    utils.makeDir(global.jsonData.rootPath);
    directories.forEach((item) => {
        let myPath = path.join(global.jsonData.dataPath, item);
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
    
    global.jsonData.autoPort = await utils.promptUser(`\nEnter a port for the ${chalk.yellow("Automatic1111")} Server`,  global.jsonData.autoPort);
    console.log(`Auto1111 Port: ${ global.jsonData.autoPort}`);

    const jsonString = JSON.stringify(global.jsonData, null, 4);
    utils.saveFile('config.json', jsonString);

    let configString = `
        title Auto1111
        set PYTHON=
        set GIT=
        set VENV_DIR=
        set COMMANDLINE_ARGS= --xformers --update-all-extensions --port ${ global.jsonData.autoPort} ^
        --ckpt-dir "${global.jsonData.dataPath}\\models\\checkpoints" ^
        --codeformer-models-path "${global.jsonData.dataPath}\\models\\codeformer" ^
        --controlnet-dir "${global.jsonData.dataPath}\\models\\controlnet" ^
        --embeddings-dir "${global.jsonData.dataPath}\\models\\embeddings" ^
        --esrgan-models-path "${global.jsonData.dataPath}\\models\\esrgan" ^
        --gfpgan-models-path "${global.jsonData.dataPath}\\models\\gfpgan" ^
        --hypernetwork-dir "${global.jsonData.dataPath}\\models\\hypernetworks" ^
        --ldsr-models-path "${global.jsonData.dataPath}\\models\\ldsr" ^
        --lora-dir "${global.jsonData.dataPath}\\models\\loras" ^
        --realesrgan-models-path "${global.jsonData.dataPath}\\models\\realesrgan" ^
        --swinir-models-path "${global.jsonData.dataPath}\\models\\swinir" ^
        --textual-inversion-templates-dir "${global.jsonData.dataPath}\\models\\embeddings" ^
        --vae-dir "${global.jsonData.dataPath}\\models\\vae"

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
        utils.cloneRepository(item, extensionsPath);
    }
    
    utils.saveFile(path.join(applicationPath,"webui-user.bat"), configString.replace(/\\/g, '/'));
    // TODO: Add localStartup and sharedStarup
    console.log(`Install complete: ${chalk.yellow("Automatic 1111")}`);
}


// ------------------------------------------------------------------
const cycleComfyUI = async (waitTime = 180) => {
    global.childRunning = true;
    let count = 0;
    let args = ['-s', 'ComfyUI/main.py', '--windows-standalone-build', '--disable-auto-launch', '--port', global.jsonData.comfyPort];
    if(!global.jsonData.useNVidia){
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

    // Manual Installs
    const data = utils.filterWithOptions(global.jsonData.customNodes, [{setup:"custom"}]);
    for(const item of data){
        console.log(`Setting up: ${chalk.yellow(item.note)}`);
        let nodePath = path.join(global.jsonData.dataPath, item.path); 
        let repoPath = nodePath
        
        if(item.type == "git"){
            repoPath = await utils.cloneRepository(item.url, nodePath);
        }
        switch(item.note){
            case "Efficiency Nodes" : 
                execSync(`"${global.pythonPath}" -m pip install simpleeval`, { encoding: 'utf8' });
            break;
            case "Impact Pack" :
                execSync(`"${global.pythonPath}" "${path.join(repoPath, "install.py")}" -y`, { encoding: 'utf8' });
            break;
            case "MTB" :
                await utils.installRequirements(item);
                execSync(`echo 1, 2, 3, 4 | "${global.pythonPath}" "${path.join(repoPath, "scripts", "download_models.py")}"`, { encoding: 'utf8' });
            break;
            case "Searge SDXL" :
                await utils.downloadFile(item.url, global.currentPath)
                    .then(filePath => utils.extractZip(filePath, global.comfyPath))
                    .catch(error => console.error(error)); 
                execSync(`"${path.join(global.comfyPath, "SeargeSDXL-Installer.bat")}"`, { encoding: 'utf8' });
                execSync(`del "${path.join(global.comfyPath, "SeargeSDXL-Installer.*")}"`, { encoding: 'utf8' });
            break
            case "WAS Node Suite" :
                if(!ffmpegExists()){
                    continue;
                }    
                console.log("WAS", repoPath);
                // let wasData = await utils.fetchJson('config.json');
                // `C:\Users\Joe Andolina\genai\comfyui\ComfyUI\custom_nodes\was-node-suite-comfyui\was_suite_config.json` 
                // set ffmpeg_bin_path to path.join(global.jsonData.rootPath, "ffmpeg")
                // const jsonString = JSON.stringify(global.jsonData, null, 4);
                // utils.saveFile('config.json', jsonString);
            break;
        }
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

    global.jsonData.comfyPort = await utils.promptUser(`\nEnter a port for the ${chalk.yellow("ComfyUI")} Server`, global.jsonData.comfyPort);
    console.log(`ComfyUI Port: ${global.jsonData.comfyPort}`);
    
    const jsonString = JSON.stringify(global.jsonData, null, 4);
    utils.saveFile('config.json', jsonString);

    // const configString = `
    // #config for a1111 ui
    // a111:
    //     base_path: "${global.jsonData.dataPath}"

    //     checkpoints: "${global.jsonData.dataPath}/models/checkpoints"
    //     configs: "${global.jsonData.dataPath}/models/checkpoints"
    //     vae: "${global.jsonData.dataPath}/models/vae"
    //     loras: |
    //         models/loras
    //         models/lycoris
    //     upscale_models: |
    //         models/esrgan
    //         models/realesrgan
    //         models/swinir
    //     embeddings: "${global.jsonData.dataPath}/models/embeddings"
    //     hypernetworks: "${global.jsonData.dataPath}/models/hypernetworks"
    //     controlnet: "${global.jsonData.dataPath}/models/controlnet"

    // comfyui:
    //     base_path: "${global.jsonData.dataPath}"
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
    //     # checkpoints: "${global.jsonData.dataPath}/models/checkpoints"
    //     # gligen: "${global.jsonData.dataPath}/models/gligen"
    //     # custom_nodes: "${global.jsonData.dataPath}/custom_nodes"
    // `

//     let folderMatch = "base_path = os.path.dirname(os.path.realpath(__file__))"
//     folderMatch = folderMatch.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
//     const folderString = `

// def check_folder_exists(folder_path):
//     if os.path.exists(folder_path):
//         return folder_path
//     else:
//         return os.path.dirname(os.path.realpath(__file__))
// base_path = check_folder_exists("${global.jsonData.dataPath}")

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
    await utils.moveItem(path.join(global.currentPath, ffmpegPath[0], 'bin'), path.join(global.jsonData.rootPath, 'ffmpeg'));
    fse.removeSync(path.join(global.currentPath, ffmpegPath[0]));
    utils.addToSystemPath(path.join(global.jsonData.rootPath, 'ffmpeg'));
    console.log(`Install complete: ${chalk.yellow("FFMpeg")}`);
}


// ------------------------------------------------------------------
const installControlLora = async () =>  {
    if(!fs.existsSync(global.comfyPath)){
        console.log(chalk.red(`\n${chalk.yellow("ComfyUI")} is required before Control-Lora can be installed.\nNot found in: ${chalk.yellow(global.comfyPath)} `));
        return;
    }

    let visionPath = path.join(global.jsonData.dataPath, "models/clip_vision");
    
    if(fs.existsSync(visionPath)){
        console.log(chalk.magenta("\nControl-Lora already installed."));
        return;
    }

    console.log(chalk.magenta("\nControl-Lora not installed. Downloading and installing Control-Lora... ~70g"));

    // Copy the controlnets
    let sourcePath = await utils.cloneRepository(global.jsonData.controlLora, global.currentPath)
    let targetPath = path.join(global.jsonData.dataPath, "models", "controlnet");

    console.log("sourcePath", sourcePath, targetPath);
    fse.copySync(path.join(sourcePath,"control-LoRAs-rank128"), targetPath, { recursive: true });
    fse.copySync(path.join(sourcePath,"control-LoRAs-rank256"), targetPath, { recursive: true });
    
    // Copy the vision_clip models
    utils.makeDir(visionPath);
    execSync(`copy "${path.join(sourcePath,"revision","*.safetensors")}" "${visionPath}"`);
    
    // Copy the workflows
    targetPath = path.join(global.jsonData.dataPath, "workflows");
    fse.copySync(path.join(sourcePath,"comfy-control-LoRA-workflows"), targetPath, { recursive: true });
    execSync(`copy "${path.join(sourcePath,"revision","*.json")}" "${targetPath}"`);
    await fsp.rm(sourcePath, { recursive: true, force: true });
    
    // Copy the vision_clip models
    console.log(chalk.magenta("\nDownloading and installing UnClip... ~100g"));
    sourcePath = await utils.cloneRepository(global.jsonData.unclip, global.currentPath)
    execSync(`copy "${path.join(sourcePath,"*.safetensors")}" "${visionPath}"`);
    await fsp.rm(sourcePath, { recursive: true, force: true });
    console.log(`Install complete: ${chalk.yellow("Control Lora")}`);
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
    console.log(chalk.yellow('\n\nInstall for:'));
    console.log(`${chalk.yellow('1')}. SD`);
    console.log(`${chalk.yellow('2')}. SDXL`);
    console.log(`${chalk.yellow('3')}. SD and SDXL`);
    console.log(`${chalk.yellow('4')}. Back`);
}

// ------------------------------------------------------------------

const showMainMenu = () => {
    console.log(chalk.yellow('\n\nChoose an option:'));
    console.log(`${chalk.yellow('1')}. Install Automatic1111`);
    console.log(`${chalk.yellow('2')}. Install ComfyUI`);
    console.log(`${chalk.yellow('3')}. Install FFMpeg (admin)` );
    console.log(`${chalk.yellow('4')}. Install Custom Nodes`);
    console.log(`${chalk.yellow('5')}. Load Models (config.json)`);
    console.log(`${chalk.yellow('6')}. Install Control-Lora & Clip-Vision (Optional ~170g)`);
    // console.log(`${chalk.yellow('7')}. Comfy Data Fix (needed after update)`);
    console.log(`${chalk.yellow('7')}. Onyx Runtime Fix`);
    console.log(`${chalk.yellow('8')}. Exit`);
}

// ------------------------------------------------------------------

const handleUserInput = async (input) => {
    const admin = ['3'];
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
            await installFFMpeg();
        break;
        case '4':
            await installCustomNodes();
        break;
        case '5':
            await loadModels();
        break;
        case '6':
            await installControlLora();
        break;
        // case '7':
        //     await comfyDataFix();
        // break;
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
showMainMenu();
await waitForUserInput();

console.log("Happy Generating\n");