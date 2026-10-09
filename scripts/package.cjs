const path=require('node:path');
const fs=require('node:fs/promises');
(async()=> {
  const {packager}=await import('@electron/packager');
  const root=path.resolve(__dirname,'..');
  const staging=path.resolve(root,'.qa/package');
  const cachedZip=path.join(root,'.qa',`electron-v${require('../package.json').devDependencies.electron}-win32-x64.zip`);
  const zipOptions=await fs.access(cachedZip).then(()=>({electronZipDir:path.dirname(cachedZip)})).catch(()=>({}));
  if(!staging.startsWith(root+path.sep))throw new Error('Unsafe staging path');
  const result=await packager({dir:root,out:staging,...zipOptions,name:'千秋万待',executableName:'千秋万待',platform:'win32',arch:'x64',icon:path.join(root,'src/assets/app.ico'),overwrite:true,asar:true,prune:true,ignore:[/^\/本地应用($|\/)/,/^\/release($|\/)/,/^\/output($|\/)/,/^\/\.qa($|\/)/,/^\/tests($|\/)/,/^\/scripts($|\/)/,/^\/\.git($|\/)/,/^\/node_modules($|\/)/,/^\/ASSET-PROMPT.*\.md$/,/^\/src\/assets\/chiaki\.png$/,/^\/src\/assets\/chiaki-reference\.png$/,/^\/src\/assets\/chiaki-reference-v2\.png$/,/\.lnk$/],win32metadata:{CompanyName:'Local',FileDescription:'千秋万待',ProductName:'千秋万待',OriginalFilename:'千秋万待.exe'}});
  for(const stage of result){await fs.copyFile(path.join(root,'readme.md'),path.join(stage,'使用说明.md'));await fs.copyFile(path.join(root,'ASSET-PROMPT.md'),path.join(stage,'ASSET-PROMPT.md'));console.log(stage);}
})().catch(e=>{console.error(e);process.exit(1);});
