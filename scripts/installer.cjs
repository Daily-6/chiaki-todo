const path=require('node:path');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const {build,Platform,Arch}=require('electron-builder');
const root=path.resolve(__dirname,'..');

async function packageApp(){
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(__dirname,'package.cjs')],{cwd:root,stdio:'inherit',windowsHide:true});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve():reject(new Error(`Portable packaging exited ${code}`)));
  });
}

(async()=>{
  if(process.platform!=='win32')throw new Error('Build the Windows installer on Windows.');
  if(!process.argv.includes('--use-existing'))await packageApp();
  const prepackaged=path.join(root,'release','七海待办-win32-x64');
  await fs.access(path.join(prepackaged,'七海待办.exe'));
  process.env.CSC_IDENTITY_AUTO_DISCOVERY='false';
  const artifacts=await build({projectDir:root,prepackaged,targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),publish:'never',config:require('../installer.config.cjs')});
  for(const artifact of artifacts)console.log(artifact);
})().catch(error=>{console.error(error);process.exit(1);});
