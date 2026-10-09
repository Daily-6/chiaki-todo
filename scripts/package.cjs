const path=require('node:path');
const fs=require('node:fs/promises');
(async()=> {
  const {packager}=await import('@electron/packager');
  const root=path.resolve(__dirname,'..');
  const out=path.resolve(root,'release');
  const staging=path.resolve(root,'.qa/package');
  const cachedZip=path.join(root,'.qa',`electron-v${require('../package.json').devDependencies.electron}-win32-x64.zip`);
  const zipOptions=await fs.access(cachedZip).then(()=>({electronZipDir:path.dirname(cachedZip)})).catch(()=>({}));
  if(!out.startsWith(root+path.sep))throw new Error('Unsafe output path');
  const result=await packager({dir:root,out:staging,...zipOptions,name:'七海待办',executableName:'七海待办',platform:'win32',arch:'x64',icon:path.join(root,'src/assets/app.ico'),overwrite:true,asar:true,prune:true,ignore:[/^\/release($|\/)/,/^\/output($|\/)/,/^\/\.qa($|\/)/,/^\/tests($|\/)/,/^\/scripts($|\/)/,/^\/\.git($|\/)/,/^\/node_modules($|\/)/,/^\/ASSET-PROMPT.*\.md$/,/^\/src\/assets\/chiaki\.png$/,/^\/src\/assets\/chiaki-reference\.png$/,/^\/src\/assets\/chiaki-reference-v2\.png$/,/\.lnk$/],win32metadata:{CompanyName:'Local',FileDescription:'七海待办',ProductName:'七海待办',OriginalFilename:'七海待办.exe'}});
  // Merge files in place: Explorer or a terminal may hold the release directory open.
  for(const stage of result){const dir=path.join(out,path.basename(stage));await fs.copyFile(path.join(root,'readme.md'),path.join(stage,'使用说明.md'));await fs.copyFile(path.join(root,'ASSET-PROMPT.md'),path.join(stage,'ASSET-PROMPT.md'));await fs.cp(stage,dir,{recursive:true,force:true});console.log(dir);}
})().catch(e=>{console.error(e);process.exit(1);});
