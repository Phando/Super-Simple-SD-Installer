# Super SD Installer
This script is a quick way to get up and running with Automatic1111, ComfyUI and their Data. The script replicates the way I like to setup my Stable Diffusion apps. It puts the applications in one location and the data in another. That way they apps and data can be updated independently of each other.


Due to the large downloads, the script may appear to be hanging, have faith, it is working. If anything does go wrong, the script is pretty good about rerunning the same commands and picking up where it left off. 


Thank you to everyone in the community for your contributions, creativity and skills.

### Note
- This has only been tested on a Windows 11 machine with an NVidia gpu.
- If you find issues or hve suggestions, I will be looking at the git issues.

## Features:
- Automatic1111 Installer with extensions
- ComfyUI Installer with manager
- FFMpeg Installer, needs to be run as admin
- Custom Node Installer
- Data Loader - controlnets, checkpoints, embeddings, loras, workflows, and vaes
- Clip Vision Installer (Optional)
- Control-Lora Installer (Optional)
- IP Adapter Installer (Optional)
- Onyx Runtime Fix
- Civitai metadata and image generation

## Config.json
This file contains lists of civitai models, git repos, and urls. Feel free to edit the file to add or remove items from the default dataset. Please take a look at the content so you know the amount of data that is going to be loaded. 
[config.json](./config.json)

## Generated File Structure
The default location for the appications and data are in path_to_script/genai and path_to_script/genai_data respectively. The locations can be changed during the install.

### Applications 
```
genai/
├─ auto1111/
│  ├─ system/
│  ├─ webui/
├─ comfyui/
│  ├─ python_embedded/
│  ├─ ComfyUI/
│  ├─ update/
├─ ffmpeg/ (optional)
```
### Data
```
genai_data/
├─ custom_nodes/
├─ models/
│  ├─ checkpoints/
│  ├─ classifiers/
│  ├─ clip/
│  ├─ clip_vision/
│  ├─ codeformer/
│  ├─ configs/
│  ├─ controlnet/
│  ├─ deepbump/
│  ├─ deffusers/
│  ├─ embeddings/
│  ├─ esrgan/
│  ├─ face_restore/
│  ├─ FILM/
│  ├─ gfpgan/
│  ├─ hypernetworks/
│  ├─ insightface/
│  ├─ ipadapter/
│  ├─ ldsr/
│  ├─ loras/
│  ├─ lycoris/
│  ├─ mmdets/
│  ├─ onyx/
│  ├─ realesrgan/
│  ├─ sams/
│  ├─ style_models/
│  ├─ swinir/
│  ├─ ultralytics/
│  ├─ unet/
│  ├─ upscale_models/
│  ├─ vae/
│  ├─ vae_approx/
├─ output/
├─ workflows/
```

## Prerequisites

Before you begin the installation process for our application, it's important to ensure that you have Node.js installed on your system. Node.js is a runtime environment that our application depends on to function correctly.

#### Installing Node.js

If you do not have Node.js installed, please follow these steps:

1. Visit the [official Node.js website](https://nodejs.org/) to download the installer.
2. Choose the version that is appropriate for your operating system. We recommend using the LTS (Long Term Support) version for better stability.
3. Follow the installation instructions specific to your operating system.

To verify that Node.js has been installed successfully, open a terminal or command prompt and run:

```
bash
node --version
```

## Installation and Running

### Launch
It is simple as:
`./installSD.bat`

Or you can run the command the is inside the installSD.bat file
`node --max-old-space-size=65216 .\app.js`

### Typical Operation
1. Install Automatic1111 (optional)
1. Install ComfyUI
1. Install the Custom Nodes
1. Load Models

### Optional Operations
1. Install Clip-Vision
1. Install Control-Lora
1. Install IPAdapter
1. Install FFMpeg
1. Onyx Runtime Fix
