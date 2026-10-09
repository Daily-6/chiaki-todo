const {contextBridge, ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop', {
  load:()=>ipcRenderer.invoke('data:load'),
  save:data=>ipcRenderer.invoke('data:save',data),
  exportBackup:()=>ipcRenderer.invoke('data:export'),
  importBackup:()=>ipcRenderer.invoke('data:import'),
  dataFolder:()=>ipcRenderer.invoke('data:folder'),
  window:action=>ipcRenderer.send('window:action',action),
  onReminder:callback=>ipcRenderer.on('reminder',(_event,value)=>callback(value)),
  onMaximize:callback=>ipcRenderer.on('window:maximized',(_event,value)=>callback(value)),
  onClosing:callback=>ipcRenderer.on('app:closing',()=>callback()),
});
