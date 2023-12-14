import chalk from 'chalk';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import utils from '../utils.js';

class AutomaticInstaller {
// ------------------------------------------------------------------
    isInstalled = () => {
        return fs.existsSync(global.autoPath)
    }

// ------------------------------------------------------------------
    install = async () => {
        if(this.isInstalled()){
            console.log(chalk.yellow("\nAuto1111 already installed."));
            if(await utils.promptConfirmation(`Do you want to reinstall ${chalk.yellow("nAuto1111")}?`)){
                await this.uninstall(true);
            }
            else {
                return;
            }
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
        const applicationPath = path.join(global.autoPath, "webui");
        let extensionsPath = path.join(applicationPath, "extensions")
        for(const item of global.jsonData.extensions){
            await utils.cloneRepository(item, extensionsPath);
        }
        
        utils.saveFile(path.join(applicationPath,"webui-user.bat"), configString.replace(/\\/g, '/'));
        // TODO: Add localStartup and sharedStarup
        console.log(`Install complete: ${chalk.yellow("Automatic 1111")}`);
    }

// ------------------------------------------------------------------
    uninstall = async (autoAccept = false) => {
        if(!autoAccept){
            let response = await utils.promptConfirmation(`\nAre you sure you want to uninstall ${chalk.yellow("Automatic1111")}?`);
            if(!response){
                return;
            }
        }
        
        const customNodesPath = path.join(global.prefs.dataPath,"custom_nodes")
        console.log(`\nRemoving ${chalk.yellow("Custom Nodes")}...`)
        fse.emptyDirSync(path.join(global.prefs.dataPath,"custom_nodes"));
        console.log(`\nRemoving ${chalk.yellow("ComfyUI")} installation...`)
        fse.emptyDirSync(global.comfyPath);
    }
}
const autoInstaller = new AutomaticInstaller();
export default autoInstaller;