import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import utils from '../utils.js';
import nodeInstaller from './nodeInstaller.js';

class ComfyInstaller {
    // ------------------------------------------------------------------
    isInstalled = () => {
        return fs.existsSync(global.comfyPath)
    }

    // ------------------------------------------------------------------
    nodesInstalled = () => {
        return nodeInstaller.isInstalled();
    }

    // ------------------------------------------------------------------
    makeSymlinks = () => {
        utils.makeLink(path.join(global.prefs.dataPath,"custom_nodes"),path.join(global.comfyPath, "ComfyUI/custom_nodes"));
        utils.makeLink(path.join(global.prefs.dataPath,"models"),path.join(global.comfyPath, "ComfyUI/models"));
    }

    // ------------------------------------------------------------------
    updateLauncher = (filePath) => {
        const modFlag = "@REM GenAI Modified\n";
        const matchString = 'standalone-build';
        const patchString = `standalone-build --disable-auto-launch --listen --output-directory "${global.prefs.dataPath}\\output" --port ${global.prefs.comfyPort}`

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
    cycleComfyUI = async (waitTime = 180) => {
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
    installCustomNodes = async () => {
        if(this.nodesInstalled()){
            console.log(chalk.yellow("\nCustom Nodes already installed."));
            if(await utils.promptConfirmation(`Do you want to reinstall ${chalk.yellow("Custom Nodes")}?`)){
                await nodeInstaller.uninstall(true);
            }
            else {
                return;
            }
        }
        
        // Simple Installs
        await nodeInstaller.install("none");
        await this.cycleComfyUI(); // 20

        // Requirements Needed 
        await nodeInstaller.install("basic");
        await this.cycleComfyUI();

        // Custom Installs
        await nodeInstaller.install("custom");
        await this.cycleComfyUI();  
        console.log(`Install complete: ${chalk.yellow("Custom Nodes")}`);
    }

    // ------------------------------------------------------------------
    install = async () => {
        let applicationPath = path.join(global.comfyPath, "ComfyUI");
        
        if(this.isInstalled()){
            console.log(chalk.yellow("\nComfyUI already installed."));
            if(await utils.promptConfirmation(`Do you want to reinstall ${chalk.yellow("ComfyUI")}?`)){
                await this.uninstall(true);
            }
            else {
                return;
            }
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
        this.updateLauncher(path.join(global.comfyPath,"run_cpu.bat"));
        this.updateLauncher(path.join(global.comfyPath,"run_nvidia_gpu.bat"));
        
        // Change the ConfyUI Folder Root
        // const folderScript = path.join(applicationPath,"folder_paths.py");
        // let fileContent = await fsp.readFile(folderScript, 'utf8');
        // fileContent = fileContent.replace(new RegExp(folderMatch, 'g'), folderString.replace(/\\/g, '/'));
        // console.log(fileContent);
        // saveFile(folderScript, fileContent);
        
        // Add an extra_model_paths.yml to make use of all the custom paths
        // saveFile(path.join(applicationPath,"extra_model_paths.yaml"), configString.replace(/\\/g, '/'));
        this.makeSymlinks();
        // Install the manager
        utils.fetchData(global.jsonData.customNodes, [{url:"ComfyUI-Manager.git"}]);
        await this.cycleComfyUI(60);
        console.log(`Install complete: ${chalk.yellow("ComfyUI & Manager")}`);
        
        let input = await utils.promptConfirmation(`Would you like to install the ${chalk.yellow("Custom Nodes")}?`);
        if(input){
            await this.installCustomNodes();
        }
    }

    // ------------------------------------------------------------------
    uninstall = async (autoAccept = false) => {
        if(!autoAccept){
            let response = await utils.promptConfirmation(`\nAre you sure you want to uninstall ${chalk.yellow("ComfyUI")}?`);
            if(!response){
                return;
            }
        }
        
        console.log(`\nRemoving ${chalk.yellow("ComfyUI")} installation...`)
        fse.emptyDirSync(global.comfyPath);
        await nodeInstaller.uninstall();
    }
}
const comfyInstaller = new ComfyInstaller();
export default comfyInstaller;