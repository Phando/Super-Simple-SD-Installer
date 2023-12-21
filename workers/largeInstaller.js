import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import fse from 'fs-extra';
import fsp from 'fs/promises';
import path from 'path';
import utils from '../utils.js';

class LargeInstaller {
    // ------------------------------------------------------------------
    isItemInstalled = async (item) => {
        let targetPath = path.join(global.prefs.dataPath, item.path);
        let testList = await utils.searchFor(targetPath, item.searchTerm); 
        return testList.length > 0;
    }

    // ------------------------------------------------------------------
    showMenu = async () => {
        let index = 1;
        console.log(`\nChoose an Option: ${chalk.yellow('(Large Installs)')}`);
        for(const item of global.jsonData.largeInstalls){
            let installMessage = await this.isItemInstalled(item) ? chalk.green('Re-Install') : 'Install';
            console.log(`${chalk.yellow(index)}. ${installMessage} ${item.name} ~${item.size}g`);
            index++;
        };

        console.log(`${chalk.yellow(index)}. Back`);
    }

    // ------------------------------------------------------------------
    install = async () => {
        if(!fs.existsSync(global.comfyPath)){
            console.log(chalk.red(`\n${chalk.yellow("ComfyUI")} is required before Large Installes can be processed.\nComfyUI Not found in: ${chalk.yellow(global.comfyPath)} `));
            return;
        }

        await this.showMenu();
        let index = await utils.promptUser('Enter your choice');
        index = parseInt(index, 10) - 1;
        if(index >= global.jsonData.largeInstalls.length){
            return;
        }
        
        const item = global.jsonData.largeInstalls[index];
        if(await this.isItemInstalled(item)){
            console.log(chalk.magenta(`\n${item.name} already installed.`));
            return;
        }

        if (this.hasOwnProperty(item.installer)) {
            console.log(chalk.magenta(`\n${item.name} not installed\nDownloading and installing ${item.name} ... ~${item.size}g`));
            await this[item.installer](item);
        }
        else {
            console.log(chalk.yellow(`\n${item.name} installer not found.`));
        }
    }

    // ------------------------------------------------------------------
    controlLoraInstaller = async (item) =>  {
        let targetPath = path.join(global.prefs.dataPath, "models", "controlnet");
        let sourcePath = await utils.cloneRepository(item.modelUrl, global.currentPath)
        console.log("sourcePath", sourcePath, targetPath);
        await utils.moveItem(path.join(sourcePath,"control-LoRAs-rank128"),path.join(targetPath,"control-LoRAs-rank128"))
        await utils.moveItem(path.join(sourcePath,"control-LoRAs-rank256"),path.join(targetPath,"control-LoRAs-rank256"))
        
        // Copy the vision_clip models
        let visionPath = path.join(global.prefs.dataPath, "models/clip_vision");
        execSync(`copy "${path.join(sourcePath,"revision","*.safetensors")}" "${visionPath}"`);
        
        // Copy the workflows
        targetPath = path.join(global.prefs.dataPath, "workflows");
        fse.copySync(path.join(sourcePath,"comfy-control-LoRA-workflows"), targetPath, { recursive: true });
        execSync(`copy "${path.join(sourcePath,"revision","*.json")}" "${targetPath}"`);
        
        // Cleanup
        await fsp.rm(sourcePath, { recursive: true, force: true });
        console.log(`Install complete: ${chalk.yellow(item.name)}`);
    }
   

    // ------------------------------------------------------------------
    ipadapterInstaller = async (item) =>  {
        let targetPath = path.join(global.prefs.dataPath, "custom_nodes");
        await utils.cloneRepository(item.nodeUrl, targetPath);
        let sourcePath = await utils.cloneRepository(item.modelUrl, global.currentPath);
        
        // Move the models
        targetPath = path.join(global.prefs.dataPath, "models", "clip_vision");
        fs.mkdirSync(path.join(targetPath,"sd"), { recursive: true });
        fs.mkdirSync(path.join(targetPath,"sdxl"), { recursive: true });
        execSync(`copy "${path.join(sourcePath,"models/image_encoder","*.safetensors")}" "${path.join(targetPath,"sd","sdImageDetector.safetensors")}"`);
        execSync(`copy "${path.join(sourcePath,"sdxl_models/image_encoder","*.safetensors")}" "${path.join(targetPath,"sdxl","sdxlImageDetector.safetensors")}"`);
        
        targetPath = path.join(global.prefs.dataPath, "models", "ipadapter");
        fs.mkdirSync(path.join(targetPath,"sd"), { recursive: true });
        fs.mkdirSync(path.join(targetPath,"sdxl"), { recursive: true });
        execSync(`copy "${path.join(sourcePath,"models","*.safetensors")}" "${path.join(targetPath,"sd")}"`);
        execSync(`copy "${path.join(sourcePath,"sdxl_models","*.safetensors")}" "${path.join(targetPath,"sdxl")}"`);

        // Cleanup
        await fsp.rm(sourcePath, { recursive: true, force: true });
        console.log(`Install complete: ${chalk.yellow(item.name)}`);
    }

    // ------------------------------------------------------------------
    unclipInstaller = async (item) =>  {
        let targetPath = path.join(global.prefs.dataPath, item.path);
        await utils.cloneRepository(item.modelUrl, targetPath);
        console.log(`Install complete: ${chalk.yellow(item.name)}`);
    }
}

const largeInstaller = new LargeInstaller();
export default largeInstaller;
