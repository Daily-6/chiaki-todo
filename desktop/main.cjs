const {app,BrowserWindow,ipcMain,dialog,shell,Notification,nativeImage}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const isTest=process.argv.includes('--self-test');
const isProbe=process.argv.includes('--probe-data');
if(isTest){app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion');}
const qaProfile=process.env.CHIAKI_QA_PROFILE;
const qaRoot=process.env.CHIAKI_QA_ROOT?path.resolve(process.env.CHIAKI_QA_ROOT):path.resolve(__dirname,'../.qa');
if(isTest||isProbe||qaProfile) app.setPath('userData',path.join(qaRoot,qaProfile||'profile'));
// Preserve the original profile location across the display-name change.
else app.setPath('userData',path.join(app.getPath('appData'),'ChiakiTodo'));
app.setAppUserModelId('local.chiaki.todo');
let win,store,model,saveQueue=Promise.resolve(),loadIssue=null,closing=false,notificationsReady=false;
const dataFile=()=>path.join(app.getPath('userData'),'tasks.json');
const backupFile=()=>path.join(app.getPath('userData'),'tasks.backup.json');
const unwrap=async fn=>{try{return {ok:true,...await fn()};}catch(e){return {ok:false,error:e.message};}};
function authorized(event) { return event.sender===win?.webContents && event.senderFrame===win.webContents.mainFrame; }
function register(name,fn) { ipcMain.handle(name,(event,...args)=> authorized(event)?unwrap(()=>fn(...args)):({ok:false,error:'无效请求'})); }
async function readState() {
  await fs.mkdir(app.getPath('userData'),{recursive:true});
  try {store=model.validateState(JSON.parse(await fs.readFile(dataFile(),'utf8')));}
  catch(e) {
    if(e.code==='ENOENT'){store=model.initialState();return;}
    try {store=model.validateState(JSON.parse(await fs.readFile(backupFile(),'utf8')));loadIssue='已从上一份本地备份恢复数据。';await fs.copyFile(dataFile(),dataFile()+`.damaged-${Date.now()}`);await fs.writeFile(dataFile(),JSON.stringify(store,null,2),'utf8');}
    catch {loadIssue='本地数据无法读取。原文件已保留，请导入一份备份恢复。';store=null;}
  }
}
async function commit(data) {
  const normalized=model.validateState(data);
  // Reminder receipts are monotonic, even if the renderer saves an older snapshot.
  normalized.notified=[...new Set([...(store?.notified||[]),...normalized.notified])].slice(-500);
  const write=saveQueue.then(async()=> {
    const temporary=dataFile()+'.tmp';
    await fs.writeFile(temporary,JSON.stringify(normalized,null,2),'utf8');
    try{await fs.copyFile(dataFile(),backupFile());}catch(e){if(e.code!=='ENOENT')throw e;}
    await fs.rename(temporary,dataFile());store=normalized;
  });
  saveQueue=write.catch(()=>{});await write;
}
async function prepareNotifications(){
  if(isTest||isProbe||qaProfile||!app.isPackaged)return;
  try{
    const folder=path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs');
    await fs.mkdir(folder,{recursive:true});
    notificationsReady=shell.writeShortcutLink(path.join(folder,'千秋万待.lnk'),'create',{target:process.execPath,cwd:path.dirname(process.execPath),description:'千秋万待 · 本地待办与专注',icon:process.execPath,iconIndex:0,appUserModelId:'local.chiaki.todo',toastActivatorClsid:'{D1A35279-2EBB-48A8-89F0-10B08FA01071}'});
  }catch{notificationsReady=false;}
}
function notify(title,body){
  if(!notificationsReady||!Notification.isSupported())return;
  const notification=new Notification({title,body});
  notification.on('click',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
  notification.on('failed',()=>{notificationsReady=false;});
  notification.show();
}
async function checkReminders() {
  if(!store)return;
  const now=Date.now();const receipts=[];
  if(store.settings.notifications) {
    for(const task of store.tasks) {
      if(task.completed||!task.dueDate||!task.dueTime)continue;
      const due=new Date(`${task.dueDate}T${task.dueTime}:00`).getTime();
      const key=`${task.id}:${task.dueDate}:${task.dueTime}`;
      if(due<=now&&now-due<600000&&!store.notified.includes(key)) {
        receipts.push(key);notify('千秋万待',task.title);
        win?.webContents.send('reminder',{type:'task',id:task.id,key});
      }
    }
  }
  if(store.timer.end&&now>=store.timer.end) {
    store.timer={end:null,taskId:null};
    if(store.settings.notifications)notify('专注完成','辛苦啦，休息一会儿吧。');
    win?.webContents.send('reminder',{type:'focus'});
  }
  if(receipts.length){store.notified=[...store.notified,...receipts].slice(-500);await commit(store);}
}
function buildWindow() {
  const iconPath=path.join(__dirname,'../src/assets/app-icon.png');
  win=new BrowserWindow({width:1440,height:930,minWidth:1060,minHeight:700,frame:false,show:false,backgroundColor:'#faf8f5',title:'千秋万待',icon:nativeImage.createFromPath(iconPath),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.on('maximize',()=>win.webContents.send('window:maximized',true));
  win.on('unmaximize',()=>win.webContents.send('window:maximized',false));
  win.on('close',event=>{if(isTest||closing)return;event.preventDefault();win.webContents.send('app:closing');});
  win.once('ready-to-show',()=>{if(!isTest&&!process.argv.includes('--hidden'))win.show();});
  win.loadFile(path.join(__dirname,'../src/index.html'));
}
if(!app.requestSingleInstanceLock()&&!isTest&&!qaProfile)app.quit();
else {
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
  app.whenReady().then(async()=>{
    model=await import(pathToFileURL(path.join(__dirname,'../src/model.mjs')).href);await readState();
    if(isProbe){await fs.writeFile(path.join(qaRoot,'probe.json'),JSON.stringify({tasks:store?.tasks.length,lists:store?.lists.length,warning:loadIssue,theme:store?.settings.theme}), 'utf8');app.exit(store?0:1);return;}
    await prepareNotifications();
    register('data:load',async()=>({state:store,warning:loadIssue,path:dataFile()}));
    register('data:save',async data=> {if(!store&&loadIssue)throw new Error(loadIssue);await commit(data);return {};});
    register('data:export',async()=> {
      await saveQueue;if(!store)throw new Error('没有可导出的数据。');
      const result=await dialog.showSaveDialog(win,{title:'导出待办备份',defaultPath:`千秋万待-${model.localDate()}.json`,filters:[{name:'JSON 备份',extensions:['json']}]});
      if(result.canceled)return {canceled:true};await fs.writeFile(result.filePath,JSON.stringify(store,null,2),'utf8');return {path:result.filePath};
    });
    register('data:import',async()=> {
      const result=await dialog.showOpenDialog(win,{title:'导入待办备份',properties:['openFile'],filters:[{name:'JSON 备份',extensions:['json']}]});
      if(result.canceled)return {canceled:true};
      const file=result.filePaths[0];const stat=await fs.stat(file);if(stat.size>30*1024*1024)throw new Error('备份文件过大。');
      const incoming=model.validateState(JSON.parse(await fs.readFile(file,'utf8')));
      const confirm=await dialog.showMessageBox(win,{type:'question',message:'用这份备份替换当前待办？',detail:`${incoming.lists.length} 个清单 · ${incoming.tasks.length} 件待办\n当前数据会另外保留一份恢复副本。`,buttons:['取消','导入'],defaultId:0,cancelId:0});
      if(confirm.response!==1)return {canceled:true};
      try{await fs.copyFile(dataFile(),path.join(app.getPath('userData'),`before-import-${Date.now()}.json`));}catch(e){if(e.code!=='ENOENT')throw e;}
      await commit(incoming);loadIssue=null;return {state:store};
    });
    register('data:folder',async()=>{const error=await shell.openPath(app.getPath('userData'));if(error)throw new Error(error);return {};});
    ipcMain.on('window:action',async(event,action)=>{if(!authorized(event))return;if(action==='minimize')win.minimize();if(action==='maximize')win.isMaximized()?win.unmaximize():win.maximize();if(action==='close')win.close();if(action==='close-ready'){await saveQueue;closing=true;win.close();}});
    buildWindow();
    if(isTest){await require('./self-test.cjs')({app,win,commit,getState:()=>store,dataFile:dataFile(),model});}
    else setInterval(()=>checkReminders().catch(e=>win?.webContents.send('reminder',{type:'error',message:e.message})),10000).unref();
  }).catch(e=>{console.error(e);app.exit(1);});
}
app.on('window-all-closed',()=>app.quit());
