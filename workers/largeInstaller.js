import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import fse from 'fs-extra';
import fsp from 'fs/promises';
import path from 'path';
import utils from '../utils.js';

class LargeInstaller {
    // ------------------------------------------------------------------
    controlLoraInstaller = async (item) =>  {
        if(!fs.existsSync(global.comfyPath)){
            console.log(chalk.red(`\n${chalk.yellow("ComfyUI")} is required before ${iten.name} can be installed.\nNot found in: ${chalk.yellow(global.comfyPath)} `));
            return;
        }

        let targetPath = path.join(global.prefs.dataPath, "models", "controlnet");
        let testList = await utils.searchFor(targetPath,"rank128"); 
        if(testList.length > 0){
            console.log(chalk.magenta(`\n${item.name} already installed.`));
            return;
        }

        console.log(chalk.magenta(`\n${item.name} not installed\n Downloading and installing ${item.name} ... ~${item.size}g`));
        
        // Copy the controlnets
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
        if(!fs.existsSync(global.comfyPath)){
            console.log(chalk.red(`\n${chalk.yellow("ComfyUI")} is required before ${iten.name} can be installed.\nNot found in: ${chalk.yellow(global.comfyPath)} `));
            return;
        }

        let targetPath = path.join(global.prefs.dataPath, "models/ipadapter");
        let testList = await utils.searchFor(targetPath,"sdxl"); 
        if(testList.length > 0){
            console.log(chalk.magenta(`\n${item.name} already installed.`));
            return;
        }

        console.log(chalk.magenta(`\n${item.name} not installed\n Downloading and installing ${item.name} ... ~${item.size}g`));
        
        // Install the custom nodes
        targetPath = path.join(global.prefs.dataPath, "custom_nodes");
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
        if(!fs.existsSync(global.comfyPath)){
            console.log(chalk.red(`\n${chalk.yellow("ComfyUI")} is required before ${iten.name} can be installed.\nNot found in: ${chalk.yellow(global.comfyPath)} `));
            return;
        }

        let targetPath = path.join(global.prefs.dataPath, item.path);
        let testList = await utils.searchFor(targetPath,"unclip"); 
        if(testList.length > 0){
            console.log(chalk.magenta(`\n${item.name} already installed.`));
            return;
        }

        console.log(chalk.magenta(`\n${item.name} not installed\n Downloading and installing ${item.name}... ~${item.size}g`));
        await utils.cloneRepository(item.modelUrl, targetPath);
        console.log(`Install complete: ${chalk.yellow(item.name)}`);
    }
}

const largeInstaller = new LargeInstaller();
export default largeInstaller;
