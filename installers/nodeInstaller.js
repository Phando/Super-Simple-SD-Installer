import { execSync } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import utils from '../utils.js';

class NodeInstaller {
    efficiencyInstaller = async (item) => {
        execSync(`"${global.pythonPath}" -m pip install simpleeval`, { encoding: 'utf8' });
    }

    impactInstaller = async (item) => {
        let nodesPath = utils.pathToRepo(item);  
        execSync(`"${global.pythonPath}" "${path.join(nodesPath, "install.py")}" -y`, { encoding: 'utf8' });
    }
    
    mtbInstaller = async (item) => {
        await utils.installRequirements(item);
        let nodesPath = utils.pathToRepo(item);
        execSync(`echo 1, 2, 3, 4 | "${global.pythonPath}" "${path.join(nodesPath, "scripts", "download_models.py")}"`, { encoding: 'utf8' });
    }
    
    seargeInstaller = async (item) => {
        await utils.downloadFile(item.url, global.currentPath)
            .then(filePath => utils.extractZip(filePath, global.comfyPath))
            .catch(error => console.error(error)); 
        execSync(`"${path.join(global.comfyPath, "SeargeSDXL-Installer.bat")}"`, { encoding: 'utf8' });
        execSync(`del "${path.join(global.comfyPath, "SeargeSDXL-Installer.*")}"`, { encoding: 'utf8' });
    }
    
    wasInstaller = async (item) => {
        await utils.installRequirements(item);

        if(!utils.ffmpegExists()){
            console.log(chalk.magenta("WAS Nodes Installed"));
            console.log(chalk.yellow("WAS Video Nodes require ffmpeg. Please install ffmepg and try again"));
            return;
        }    
        
        const nodesPath = utils.pathToRepo(item);
        const datapath = path.join(nodesPath,"was_suite_config.json");
        let wasData = await utils.fetchJson(datapath);
        wasData.ffmpeg_bin_path = path.join(global.prefs.rootPath, "ffmpeg");
        const jsonString = JSON.stringify(wasData, null, 4);
        utils.saveFile(datapath, jsonString);
    }
}

const nodeInstaller = new NodeInstaller();
export default nodeInstaller;



