const path=require('node:path');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function run(command,args,env=process.env){return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd:root,env,stdio:'inherit',windowsHide:true});
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`Local app preparation exited ${code}`)));
});}
(async()=>{
  if(process.platform!=='win32')throw new Error('Create the local Windows app on Windows.');
  if(!process.argv.includes('--use-existing'))await run(process.execPath,[path.join(__dirname,'package.cjs')]);
  const source=path.join(root,'.qa','package','千秋万待-win32-x64');
  const destination=path.join(root,'本地应用');
  await fs.access(path.join(source,'千秋万待.exe'));
  await fs.cp(source,destination,{recursive:true,force:true});
  const shortcutScript=`$taskRoot=$env:CHIAKI_LOCAL_ROOT; $taskShell=New-Object -ComObject WScript.Shell; $taskLink=$taskShell.CreateShortcut((Join-Path $taskRoot '千秋万待.lnk')); $taskLink.TargetPath=Join-Path $taskRoot '本地应用\\千秋万待.exe'; $taskLink.WorkingDirectory=Join-Path $taskRoot '本地应用'; $taskLink.IconLocation=$taskLink.TargetPath+',0'; $taskLink.Description='千秋万待 · 本地待办与专注'; $taskLink.Save()`;
  await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',shortcutScript],{...process.env,CHIAKI_LOCAL_ROOT:root});
  console.log(path.join(destination,'千秋万待.exe'));
})().catch(error=>{console.error(error);process.exit(1);});
