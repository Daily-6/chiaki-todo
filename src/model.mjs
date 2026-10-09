export const PRIORITIES = ['none', 'low', 'medium', 'high'];
export const QUADRANTS = [
  { id: 'do', title: '立即行动', subtitle: '重要 · 紧急', important: true, urgent: true, color: 'rose', icon: 'bolt' },
  { id: 'plan', title: '认真计划', subtitle: '重要 · 不紧急', important: true, urgent: false, color: 'sage', icon: 'sprout' },
  { id: 'delegate', title: '尽快处理', subtitle: '不重要 · 紧急', important: false, urgent: true, color: 'amber', icon: 'clock' },
  { id: 'later', title: '留给以后', subtitle: '不重要 · 不紧急', important: false, urgent: false, color: 'lavender', icon: 'coffee' },
];
export function uid() { return globalThis.crypto.randomUUID(); }
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(date, n) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+n); return localDate(d); }
export function nextDate(date, repeat) {
  if (repeat === 'daily') return addDays(date,1);
  if (repeat === 'weekly') return addDays(date,7);
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+1);
  const last = new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); d.setDate(Math.min(day,last));
  return localDate(d);
}
export function initialState() {
  return { version: 1, lists: [
    { id: 'personal', name: '个人', color: 'rose', icon: 'heart' },
    { id: 'work', name: '工作', color: 'sage', icon: 'briefcase' },
    { id: 'life', name: '生活', color: 'amber', icon: 'coffee' },
  ], tasks: [], settings: { theme:'light', artwork:true, notifications:true, sort:'priority', focusMinutes:25 }, timer: { end:null, taskId:null }, notified: [] };
}
export function newTask(values={}) {
  return { id:uid(), title:'', notes:'', listId:'personal', priority:'none', important:false, urgent:false, dueDate:'', dueTime:'', repeat:'none', subtasks:[], completed:false, completedAt:null, createdAt:new Date().toISOString(), order:Date.now(), ...values };
}
export function quadrant(task) { return QUADRANTS.find(q => q.important === task.important && q.urgent === task.urgent); }
export function isToday(task, today=localDate()) { return !task.completed && !!task.dueDate && task.dueDate <= today; }
export function filteredTasks(state, view, query='', today=localDate()) {
  const needle = query.trim().toLocaleLowerCase();
  return state.tasks.filter(t => {
    if (needle && !`${t.title} ${t.notes} ${t.subtasks.map(s=>s.title).join(' ')}`.toLocaleLowerCase().includes(needle)) return false;
    if (view === 'completed') return t.completed;
    if (t.completed) return false;
    if (view === 'today') return isToday(t,today);
    if (view === 'scheduled') return !!t.dueDate;
    if (view === 'priority') return t.priority === 'high' || t.important;
    if (view.startsWith('list:')) return t.listId === view.slice(5);
    return true;
  });
}
export function sortedTasks(tasks, sort='priority') {
  return [...tasks].sort((a,b)=> {
    if (sort === 'priority') return PRIORITIES.indexOf(b.priority)-PRIORITIES.indexOf(a.priority) || Number(b.important)-Number(a.important) || Number(b.urgent)-Number(a.urgent) || (a.dueDate||'9999').localeCompare(b.dueDate||'9999') || a.order-b.order;
    if (sort === 'date') return (a.dueDate||'9999').localeCompare(b.dueDate||'9999') || (a.dueTime||'').localeCompare(b.dueTime||'') || a.order-b.order;
    if (sort === 'created') return b.createdAt.localeCompare(a.createdAt);
    return a.order-b.order;
  });
}
export function completeTask(state,id,now=new Date()) {
  const task=state.tasks.find(t=>t.id===id); if(!task)return;
  task.completed=!task.completed; task.completedAt=task.completed?now.toISOString():null;
  // Reopening a repeating item removes only an untouched generated successor.
  if (!task.completed) {
    state.tasks=state.tasks.filter(t=> !(t.repeatSource===id && !t.completed && !t.editedAt));
  } else if (task.repeat!=='none') {
    state.tasks.push(newTask({ ...task, id:uid(), completed:false, completedAt:null, createdAt:now.toISOString(), order:now.getTime(), dueDate:nextDate(task.dueDate||localDate(now),task.repeat), subtasks:task.subtasks.map(s=>({...s,id:uid(),completed:false})), repeatSource:id, editedAt:null }));
  }
}
export function validateState(input) {
  if (!input || typeof input!=='object' || input.version!==1 || !Array.isArray(input.lists) || !Array.isArray(input.tasks)) throw new Error('请选择千秋万待导出的 JSON 备份。');
  if (!input.lists.length || input.lists.length>100 || input.tasks.length>50000) throw new Error('备份中的清单或任务数量无效。');
  const colors=['rose','sage','amber','lavender','blue'];
  const listIds=new Set();
  const lists=input.lists.map(l=> {
    if(typeof l.id!=='string'||!l.id||listIds.has(l.id)||typeof l.name!=='string'||!l.name.trim()||l.name.length>80)throw new Error('清单数据无效。');
    listIds.add(l.id);return {id:l.id,name:l.name.trim(),color:colors.includes(l.color)?l.color:'rose',icon:['heart','briefcase','coffee','book','star','game'].includes(l.icon)?l.icon:'heart'};
  });
  const ids=new Set();
  const validDate=v=> !v || (typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && localDate(new Date(`${v}T12:00:00`))===v);
  const tasks=input.tasks.map(t=> {
    if(typeof t.id!=='string'||!t.id||ids.has(t.id)||typeof t.title!=='string'||!t.title.trim()||t.title.length>300||!listIds.has(t.listId)||!validDate(t.dueDate))throw new Error('待办数据无效。');
    ids.add(t.id);
    if(t.dueTime && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.dueTime)||!t.dueDate))throw new Error('提醒时间无效。');
    const subtasks=Array.isArray(t.subtasks)?t.subtasks.slice(0,100).map(s=>({id:typeof s.id==='string'?s.id:uid(),title:String(s.title||'').slice(0,300),completed:!!s.completed})).filter(s=>s.title.trim()):[];
    return {id:t.id,title:t.title.trim(),notes:String(t.notes||'').slice(0,10000),listId:t.listId,priority:PRIORITIES.includes(t.priority)?t.priority:'none',important:!!t.important,urgent:!!t.urgent,dueDate:t.dueDate||'',dueTime:t.dueTime||'',repeat:['daily','weekly','monthly'].includes(t.repeat)&&t.dueDate?t.repeat:'none',subtasks,completed:!!t.completed,completedAt:typeof t.completedAt==='string'?t.completedAt:null,createdAt:typeof t.createdAt==='string'&&Number.isFinite(Date.parse(t.createdAt))?t.createdAt:new Date().toISOString(),order:Number.isFinite(t.order)?t.order:Date.now(),repeatSource:typeof t.repeatSource==='string'?t.repeatSource:undefined,editedAt:typeof t.editedAt==='string'?t.editedAt:null};
  });
  const defaults=initialState().settings;const settings=input.settings||{};
  return {version:1,lists,tasks,settings:{theme:settings.theme==='dark'?'dark':'light',artwork:settings.artwork!==false,notifications:settings.notifications!==false,sort:['priority','date','created','manual'].includes(settings.sort)?settings.sort:defaults.sort,focusMinutes:[15,25,45,60].includes(settings.focusMinutes)?settings.focusMinutes:25},timer:{end:Number.isFinite(input.timer?.end)?input.timer.end:null,remaining:Number.isFinite(input.timer?.remaining)&&input.timer.remaining>=0?input.timer.remaining:null,taskId:typeof input.timer?.taskId==='string'?input.timer.taskId:null},notified:Array.isArray(input.notified)?input.notified.filter(x=>typeof x==='string').slice(-500):[]};
}
export function demoState() {
  const s=initialState();const today=localDate();
  s.tasks=[
    newTask({title:'完成项目的第一版设计',notes:'把想法变成看得见的东西。',listId:'work',priority:'high',important:true,urgent:true,dueDate:today,subtasks:[{id:uid(),title:'整理页面结构',completed:true},{id:uid(),title:'完成视觉稿',completed:false}]}),
    newTask({title:'读一会儿喜欢的书',listId:'personal',priority:'medium',important:true,dueDate:today}),
    newTask({title:'给绿植浇水',listId:'life',priority:'low',urgent:true,dueDate:today}),
    newTask({title:'规划周末的小旅行',listId:'personal',important:true,dueDate:addDays(today,2)}),
    newTask({title:'整理这个月的学习笔记',listId:'work',priority:'medium',important:true,dueDate:addDays(today,3)}),
    newTask({title:'试试那款新的独立游戏',listId:'personal'}),
    newTask({title:'买一些水果和牛奶',listId:'life',urgent:true,dueDate:today}),
    newTask({title:'出门散步 20 分钟',listId:'life',important:true,dueDate:today,completed:true,completedAt:new Date().toISOString()}),
  ];return s;
}
