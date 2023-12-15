import { execSync, spawn } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import utils from '../utils.js';

class NodeInstaller {
// ------------------------------------------------------------------
    isInstalled = () => {
        const data = utils.filterWithOptions(global.jsonData.customNodes, [{setup:"custom"}]);
        for (const item of data) {
            let nodePath = utils.pathToRepo(item);  
            if(item.type == "git" && !fs.existsSync(nodePath)){
                return false;
            }
        }
        return true;
    }

// ------------------------------------------------------------------
    efficiencyInstaller = async (item) => {
        execSync(`"${global.pythonPath}" -m pip install simpleeval`, { encoding: 'utf8' });
    }

// ------------------------------------------------------------------
    impactInstaller = async (item) => {
        let nodePath = utils.pathToRepo(item);  
        execSync(`"${global.pythonPath}" "${path.join(nodePath, "install.py")}" -y`, { encoding: 'utf8' });
    }
    
// ------------------------------------------------------------------
    mtbInstaller = async (item) => {
        // {
        //     "type": "git",
        //     "path": "custom_nodes",
        //     "setup": "custom",
        //     "installer": "mtbInstaller",
        //     "note": "MTB",
        //     "url": "https://github.com/melMass/comfy_mtb.git"
        // }

        let nodePath = utils.pathToRepo(item);
        utils.installRequirements(item);
        process.chdir(path.join(nodePath, "scripts"));
        execSync(`echo 1, 2, 3, 4 | "${global.pythonPath}" download_models.py`, { encoding: 'utf8' });
        process.chdir(global.currentPath);
        console.log(chalk.green('Optional MTB Nodes require additional setup:'));
        console.log(`==> "${global.pythonPath}" -m pip install tensorflow facexlib insightface basicsr\n`);
    }

// ------------------------------------------------------------------
    seargeInstaller = async (item) => {
        if(fs.existsSync(path.join(global.prefs.dataPath, "custom_nodes","SeargeSDXL"))){
            console.log(`${chalk.yellow("SeargeSDXL")} nodes already installed.`);
            return;
        }

        await utils.downloadFile(item.url, global.currentPath)
            .then(filePath => utils.extractZip(filePath, global.comfyPath))
            .catch(error => console.error(error)); 
        
        await new Promise((resolve, reject) => {
            let commandIndex = 0;
            process.chdir(global.comfyPath);
            const commands = ["r\n", "0\n", "1\n", "4\n", "5\n", "6\n", "d\n" ]
            const child = spawn("SeargeSDXL-Installer.bat"); 
            
            child.stdout.on('data', (data) => {
                let dataString = data.toString();
                if(!dataString.includes('Transferred') && !dataString.includes(' ] - ')){
                    console.log(`stdout: ${data}`);
                }

                if(dataString.includes('then press enter') ||  dataString.includes('continue . . .')){
                    child.stdin.write('\n');
                }
                else if (dataString.includes('(default = [r]')) {
                    console.log("Downloading Model for Searge:", commands[commandIndex]);
                    child.stdin.write(commands[commandIndex]);
                    commandIndex++;
                }
            });

            child.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
                reject;
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Process exited with code ${code}`));
                }
            });

            child.on('error', reject);
        });
        
        execSync(`del "${path.join(global.comfyPath, "SeargeSDXL-Installer.*")}"`, { encoding: 'utf8' });
        process.chdir(global.currentPath);
    }

// ------------------------------------------------------------------
    wasInstaller = async (item) => {
        if(!utils.ffmpegExists()){
            console.log(chalk.magenta("WAS Nodes Installed"));
            console.log(chalk.yellow("WAS Video Nodes require ffmpeg.\nOptional - install ffmepg and try again"));
            return;
        }    
        
        const nodePath = utils.pathToRepo(item);
        const datapath = path.join(nodePath,"was_suite_config.json");
        let wasData = await utils.fetchJson(datapath);
        wasData.ffmpeg_bin_path = path.join(global.prefs.rootPath, "ffmpeg");
        const jsonString = JSON.stringify(wasData, null, 4);
        utils.saveFile(datapath, jsonString);
    }

// ------------------------------------------------------------------
    install = async (nodeType = "node") => {
        const data = utils.filterWithOptions(global.jsonData.customNodes, [{setup:nodeType}]);
        if(nodeType == "none" || nodeType == "basic"){
            await utils.fetchData(data);
            return
        }

        for(const item of data){
            console.log(`Setting up: ${chalk.yellow(item.note)}`);
            let nodePath = path.join(global.prefs.dataPath, item.path); 
            
            if(item.type == "git"){
                let workflowPath = await utils.cloneRepository(item.url, nodePath);
                workflowPath = path.join(path.join(workflowPath, "workflows"))
                if(fs.existsSync(workflowPath)){
                    let repoName = utils.getNameFrom(item.url);
                    fse.copySync(workflowPath, path.join(global.prefs.dataPath, "workflows", repoName))
                }
            }

            await this[item.installer](item);
            console.log("Done");
        }  
    }

// ------------------------------------------------------------------
    uninstall = async (autoAccept = false) => {
        if(!autoAccept){
            let response = await utils.promptConfirmation(`\nAre you sure you want to uninstall the ${chalk.yellow("Custom Nodes")}?`);
            if(!response){
                return;
            }
        }
        
        console.log(`\nRemoving ${chalk.yellow("Custom Nodes")}...`)
        fse.emptyDirSync(path.join(global.prefs.dataPath,"custom_nodes"));
    }
}

const nodeInstaller = new NodeInstaller();
export default nodeInstaller;



