const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../.qa/packaged-test');
const exe=path.resolve(__dirname,'../release/七海待办-win32-x64/七海待办.exe');
async function run(args){return new Promise((resolve,reject)=>{const p=spawn(exe,args,{windowsHide:true,env:{...process.env,CHIAKI_QA_ROOT:root}});let output='';p.stdout.on('data',s=>{output+=s;process.stdout.write(s)});p.stderr.on('data',s=>{output+=s;process.stderr.write(s)});p.on('error',reject);p.on('close',code=>code===0?resolve(output):reject(new Error('Packaged app exited '+code+': '+output)));});}
(async()=>{
  if(process.argv.includes('--screenshot-only')){await fs.mkdir(root,{recursive:true});await run(['--self-test','--screenshot-only']);return;}
  await fs.mkdir(root,{recursive:true});await run(['--self-test']);
  await run(['--probe-data']);let probe=JSON.parse(await fs.readFile(path.join(root,'probe.json'),'utf8'));assert.equal(probe.tasks,8);assert.equal(probe.warning,null);console.log('PASS packaged app restarts with saved data');
  const data=path.join(root,'profile/tasks.json');await fs.writeFile(data,'intentional QA corruption','utf8');
  await run(['--probe-data']);probe=JSON.parse(await fs.readFile(path.join(root,'probe.json'),'utf8'));assert.equal(probe.tasks,8);assert.ok(probe.warning.includes('备份'));const files=await fs.readdir(path.dirname(data));assert.ok(files.some(f=>f.startsWith('tasks.json.damaged-')));console.log('PASS damaged file preserved and backup recovered');
  const report=JSON.parse(await fs.readFile(path.join(root,'test-results.json'),'utf8'));report.checks.push('packaged executable launches and restarts','damaged data file recovered from backup');report.passed=report.checks.length;await fs.writeFile(path.join(root,'test-results.json'),JSON.stringify(report,null,2));console.log('Packaged checks passed: '+report.passed);
})().catch(e=>{console.error(e);process.exit(1)});
