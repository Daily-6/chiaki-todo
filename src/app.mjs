import {initialState,newTask,uid,localDate,addDays,QUADRANTS,quadrant,filteredTasks,sortedTasks,completeTask,validateState,demoState} from './model.mjs';
import {icon} from './icons.mjs';
import {monthStart,shiftMonth,monthDays} from './calendar.mjs';
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pNames={none:'无优先级',low:'低',medium:'中',high:'高'};
let state=initialState(),view='today',query='',layout='list',focused=false,maximized=false,dataPath='',loadBlocked=false;
let modal=null,undo=null,toastTimer,timerPaused=null,saveTail=Promise.resolve(),saveRevision=0,savedRevision=0;
let clockDate=localDate(),saveError=false;
let calendarDate=localDate(),calendarMonth=monthStart(calendarDate);
const app=$('#app'),overlay=$('#overlay-root');
const isDesktop=!!window.desktop;
async function persist() {
  if(loadBlocked)throw new Error('请先导入备份恢复本地数据。');
  const snapshot=structuredClone(state);const revision=++saveRevision;
  saveTail=saveTail.catch(()=>{}).then(async()=>{
    if(isDesktop){const r=await window.desktop.save(snapshot);if(!r.ok)throw new Error(r.error);}
    else localStorage.setItem('chiaki-todo-v1',JSON.stringify(snapshot));
    savedRevision=revision;saveError=false;updateSaveStatus();
  });
  updateSaveStatus();
  try{await saveTail;}catch(e){saveError=true;updateSaveStatus();toast(`保存失败：${e.message}`);throw e;}
}
function changed(){persist().catch(()=>{});render();}
function updateSaveStatus(){const el=$('#save-status');if(el){el.classList.toggle('save-error',saveError);el.innerHTML=icon(saveError?'bell':'circleCheck')+(saveError?'保存失败':savedRevision<saveRevision?'正在保存':'保存在此电脑');}}
function toast(message,undoAction=null){const el=$('#toast');clearTimeout(toastTimer);el.innerHTML=`<span>${esc(message)}</span>${undoAction?'<button data-action="undo">撤销</button>':''}`;el.classList.add('visible');undo=undoAction;toastTimer=setTimeout(()=>{el.classList.remove('visible');undo=null;},5000);}
function dateLabel(date){if(!date)return '';const today=localDate();if(date===today)return '今天';if(date===addDays(today,1))return '明天';if(date===addDays(today,-1))return '昨天';const d=new Date(`${date}T12:00:00`);return `${d.getMonth()+1}月${d.getDate()}日`;}
function taskCount(v){return filteredTasks(state,v).length;}
function currentTitle(){return {today:'今天',all:layout==='matrix'?'四象限':'全部待办',scheduled:'日历',priority:'重要事项',completed:'已完成'}[view]||state.lists.find(l=>l.id===view.slice(5))?.name||'待办';}
function navButton(id,label,i,count){const active=id==='matrix'?view==='all'&&layout==='matrix':view===id&&!(id==='all'&&layout==='matrix');return `<button class="nav-item ${active?'active':''}" data-action="navigate" data-view="${esc(id)}">${icon(i)}<span>${esc(label)}</span>${count!==undefined?`<span class="nav-count">${count}</span>`:''}</button>`;}
function render(){
  document.documentElement.dataset.theme=state.settings.theme;
  app.className=`${focused?'focus-mode':''} ${!state.settings.artwork?'no-art':''}`;
  const today=localDate();const completedToday=state.tasks.filter(t=>t.completed&&t.completedAt&&localDate(new Date(t.completedAt))===today).length;
  const totalToday=taskCount('today')+completedToday;
  const progress=totalToday?Math.round(completedToday/totalToday*100):0;
  const visible=sortedTasks(filteredTasks(state,view,query),state.settings.sort);
  const calendar=view==='scheduled';
  const matrix=layout==='matrix'&&view!=='completed'&&!calendar;
  const date=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
  app.innerHTML=`
    <div class="titlebar"><span class="titlebar-name">${icon('game')} 千秋万待</span><span class="titlebar-center">千秋万待</span><div class="window-controls"><button data-action="window" data-value="minimize" aria-label="最小化">${icon('minimize')}</button><button data-action="window" data-value="maximize" aria-label="${maximized?'还原':'最大化'}">${icon(maximized?'restore':'maximize')}</button><button class="close-window" data-action="window" data-value="close" aria-label="关闭">${icon('close')}</button></div></div>
    <div class="workspace">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">${icon('game')}</div><div><strong>千秋万待</strong><span>让每一天，轻一点。</span></div></div>
      <button class="search-trigger" data-action="search">${icon('search')}<span>搜索待办</span><kbd>Ctrl K</kbd></button>
      <nav aria-label="待办视图">${navButton('today','今天','sun',taskCount('today'))}${navButton('all','全部待办','inbox',taskCount('all'))}${navButton('scheduled','日历','calendar')}${navButton('priority','重要事项','star',taskCount('priority'))}${navButton('matrix','四象限','grid')}${navButton('completed','已完成','circleCheck')}</nav>
      <div class="list-label"><span>我的清单</span><button class="icon-button" data-action="new-list" aria-label="新建清单" title="新建清单">${icon('plus')}</button></div>
      <div class="custom-lists">${state.lists.map(l=>`<div class="list-nav-wrap">${navButton(`list:${l.id}`,l.name,l.icon,taskCount(`list:${l.id}`))}<button class="list-edit icon-button" data-action="edit-list" data-id="${esc(l.id)}" aria-label="编辑${esc(l.name)}清单">${icon('more')}</button></div>`).join('')}</div>
      <div class="sidebar-footer"><button class="nav-item" data-action="settings">${icon('settings')}<span>设置</span></button><div id="save-status" class="save-status">${icon('circleCheck')}保存在此电脑</div></div>
    </aside>
    <main class="main-panel ${calendar?'calendar-panel':''}">
      <header class="page-header"><div><div class="eyebrow">${esc(date)}</div><h1>${esc(query?'搜索结果':currentTitle())}<span class="title-dot"></span></h1><p>${query?`找到 ${visible.length} 件待办`:view==='matrix'?'把时间留给真正重要的事。':view==='completed'?'每一个小小的完成，都算数。':view==='today'?'新的一天，从一件小事开始。':`${visible.length} 件待办，慢慢来。`}</p></div><button class="primary-button" data-action="new-task">${icon('plus')}新建待办</button></header>
      <div class="toolbar ${calendar?'calendar-toolbar':''}">${calendar?calendarControls():`<div class="view-switch" aria-label="切换布局"><button data-action="layout" data-value="list" class="${!matrix?'selected':''}" aria-label="列表布局" title="列表">${icon('list')}<span>列表</span></button><button data-action="layout" data-value="matrix" class="${matrix?'selected':''}" aria-label="四象限布局" title="四象限">${icon('grid')}<span>四象限</span></button></div>`}<div class="toolbar-right">${query?`<div class="search-inline">${icon('search')}<input id="search-input" placeholder="搜索待办…" value="${esc(query)}" aria-label="搜索待办"><button data-action="clear-search" class="icon-button" aria-label="清除搜索">${icon('close')}</button></div>`:''}${calendar?'':`<label class="sort-select">${icon('down')}<select id="sort-select" aria-label="排序"><option value="priority" ${state.settings.sort==='priority'?'selected':''}>优先级排序</option><option value="date" ${state.settings.sort==='date'?'selected':''}>截止日期排序</option><option value="created" ${state.settings.sort==='created'?'selected':''}>最新创建</option><option value="manual" ${state.settings.sort==='manual'?'selected':''}>手动排序</option></select></label>`}<button class="icon-button ${focused?'is-active':''}" data-action="focus-view" aria-label="${focused?'退出专注布局':'专注布局'}" title="专注布局">${icon('maximize')}</button></div></div>
      <div class="task-content ${matrix?'matrix-content':calendar?'calendar-content':''}">${loadBlocked?`<div class="empty-state">${icon('bell')}<h2>恢复本地数据</h2><p>原文件已保留，请从设置导入备份。</p><button class="primary-button" data-action="settings">打开设置</button></div>`:calendar?renderCalendar(visible):matrix?renderMatrix(visible):renderList(visible)}</div>
      <footer class="main-footer"><span>${icon('spark')} 一次一件事，就很好。</span><span>${visible.length} 件${view==='completed'?'已完成':'待办'}</span></footer>
    </main>
    <aside class="companion-panel">
      <div class="art-card"><img src="assets/chiaki-window-scene-v3.png" alt="七海千秋坐在窗边的桌前玩掌机，侧身回头微笑"><div class="art-caption"><h2><img src="assets/quote-seas.svg" alt="愿与你纵横七海"><img src="assets/quote-autumn.svg" alt="请伴我阅遍千秋"></h2></div></div>
      <section class="focus-card"><div class="card-heading"><span>${icon('coffee')}专注一会儿</span><select id="focus-duration" aria-label="专注时长" ${state.timer.end||timerPaused!==null?'disabled':''}>${[15,25,45,60].map(n=>`<option value="${n}" ${state.settings.focusMinutes===n?'selected':''}>${n} 分钟</option>`).join('')}</select></div><div id="focus-time" class="focus-time">${timerText()}</div><div class="focus-actions"><button class="focus-start" data-action="timer">${icon(state.timer.end?'pause':'play')}<span>${state.timer.end?'暂停':timerPaused!==null?'继续':'开始专注'}</span></button><button class="icon-button" data-action="timer-reset" aria-label="重置专注计时" title="重置">${icon('reset')}</button></div></section>
      <section class="progress-card"><div><div class="card-heading">今日的小进步</div><strong>${completedToday}<span> / ${totalToday}</span></strong><p>${progress===100&&totalToday?'今天也辛苦啦。':'每一步，都在向前。'}</p></div><div class="progress-ring" data-progress="${progress}"><svg viewBox="0 0 80 80"><circle class="ring-track" cx="40" cy="40" r="32"/><circle class="ring-value" cx="40" cy="40" r="32" pathLength="100" stroke-dasharray="${progress} 100"/></svg><span>${progress}%</span></div></section>
    </aside></div>`;
  updateSaveStatus();
}
function emptyState(){return `<div class="empty-state"><div class="empty-icon">${icon(query?'search':view==='completed'?'circleCheck':'sprout')}</div><h2>${query?'没有找到待办':view==='completed'?'小小的完成，都会留在这里':view==='today'?'今天，想做点什么？':'给想做的事留个位置'}</h2><p>${query?'换一个关键词试试。':view==='today'?'留一点时间，给重要的事和喜欢的自己。':''}</p>${view!=='completed'&&!query?'<button class="text-button" data-action="new-task">＋ 添加第一件待办</button>':''}</div>`;}
function quickAdd(q=''){return `<form class="quick-add" data-quadrant="${esc(q)}">${icon('plus')}<input name="quickTitle" maxlength="300" placeholder="${q?'添加待办…':view==='scheduled'?'为这一天添加待办…':'记下一件待办，按 Enter 保存…'}" aria-label="快速添加待办" autocomplete="off"><kbd>↵</kbd></form>`;}
function calendarControls(){return `<div class="calendar-controls"><button class="icon-button" data-action="calendar-month" data-offset="-1" aria-label="上个月">${icon('chevronLeft')}</button><label class="calendar-month-label"><input type="month" id="calendar-month" value="${calendarMonth.slice(0,7)}" aria-label="选择年月"></label><button class="icon-button" data-action="calendar-month" data-offset="1" aria-label="下个月">${icon('chevronRight')}</button><button class="calendar-today" data-action="calendar-today">今天</button></div>`;}
function renderCalendar(tasks){
  const groups=new Map();for(const task of tasks){if(!groups.has(task.dueDate))groups.set(task.dueDate,[]);groups.get(task.dueDate).push(task);}
  const selected=groups.get(calendarDate)||[],today=localDate();
  return `<section class="month-calendar" aria-label="${calendarMonth.slice(0,7)}月历"><div class="calendar-weekdays">${['一','二','三','四','五','六','日'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-grid">${monthDays(calendarMonth).map(date=>{const items=groups.get(date)||[],outside=monthStart(date)!==calendarMonth;return `<div class="calendar-day ${outside?'outside-month':''} ${date===calendarDate?'selected-day':''} ${date===today?'is-today':''}" data-action="calendar-select" data-date="${date}" tabindex="0" role="button" aria-label="${date}，${items.length}件待办" aria-pressed="${date===calendarDate}"><div class="calendar-day-heading"><span class="day-number">${Number(date.slice(-2))}</span>${items.length?`<span class="day-count">${items.length}</span>`:''}</div><div class="calendar-items">${items.slice(0,2).map(t=>`<button class="calendar-task ${esc(state.lists.find(l=>l.id===t.listId)?.color||'rose')} ${t.priority==='high'?'calendar-high':''}" data-action="edit-task" data-id="${esc(t.id)}" title="${esc(t.dueTime?t.dueTime+' '+t.title:t.title)}"><i></i><span>${esc(t.title)}</span></button>`).join('')}${items.length>2?`<span class="calendar-more">＋${items.length-2} 件</span>`:''}</div></div>`;}).join('')}</div></section><section class="calendar-agenda"><header><h2>${esc(new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date(calendarDate+'T12:00:00')))}<span>${selected.length} 件</span></h2><button class="icon-button" data-action="new-task" aria-label="为${calendarDate}添加待办">${icon('plus')}</button></header>${selected.length?selected.map(t=>taskRow(t)).join(''):`<div class="calendar-day-empty">${query?'这一天没有匹配的待办':'这一天，留着慢慢安排。'}</div>`}${quickAdd()}</section>`;
}
function renderList(tasks){
  if(!tasks.length)return `${emptyState()}${view!=='completed'&&!query?quickAdd():''}`;
  const late=tasks.filter(t=>!t.completed&&t.dueDate&&t.dueDate<localDate());const normal=tasks.filter(t=>!late.includes(t));
  return `${late.length?`<section class="task-group"><h3 class="overdue-label">已逾期 <span>${late.length}</span></h3>${late.map(t=>taskRow(t)).join('')}</section>`:''}${normal.length?`<section class="task-group"><h3>${view==='completed'?'最近完成':view==='today'?'今日待办':'待办事项'}<span>${normal.length}</span></h3>${normal.map(t=>taskRow(t)).join('')}</section>`:''}${view!=='completed'?quickAdd():''}`;
}
function taskRow(t,compact=false){
  const list=state.lists.find(l=>l.id===t.listId);const q=quadrant(t);const subDone=t.subtasks.filter(s=>s.completed).length;
  return `<article class="task-row ${t.completed?'completed':''} ${compact?'compact':''}" draggable="${!t.completed}" data-task="${esc(t.id)}" tabindex="0" role="group" aria-label="${esc(t.title)}"><button class="task-check ${t.completed?'checked':''} p-${t.priority}" data-action="complete" data-id="${esc(t.id)}" aria-label="${t.completed?'恢复':'完成'} ${esc(t.title)}">${t.completed?icon('check'):''}</button><div class="task-body" data-action="edit-task" data-id="${esc(t.id)}"><div class="task-title">${esc(t.title)}${t.priority==='high'?`<span class="high-priority" title="高优先级">!!</span>`:''}</div><div class="task-meta">${t.dueDate?`<span class="${!t.completed&&t.dueDate<localDate()?'overdue':''}">${icon('calendar')}${esc(dateLabel(t.dueDate))}${t.dueTime?' '+esc(t.dueTime):''}</span>`:''}${list?`<span class="list-tag ${esc(list.color)}"><i></i>${esc(list.name)}</span>`:''}${t.subtasks.length?`<span title="子任务完成数">${icon('list')}${subDone}/${t.subtasks.length}</span>`:''}${t.repeat!=='none'?`<span title="${{daily:'每天',weekly:'每周',monthly:'每月'}[t.repeat]}重复">${icon('reset')}</span>`:''}${!compact&&t.important?`<span class="importance-tag">${icon('star')}重要</span>`:''}${!compact&&t.urgent?`<span class="urgency-tag">${icon('bolt')}紧急</span>`:''}</div></div><button class="task-more icon-button" data-action="edit-task" data-id="${esc(t.id)}" aria-label="编辑 ${esc(t.title)}">${icon('more')}</button></article>`;
}
function renderMatrix(tasks){return `<div class="matrix-grid">${QUADRANTS.map(q=>{const items=tasks.filter(t=>quadrant(t).id===q.id);return `<section class="quadrant ${q.color}" data-drop-quadrant="${q.id}"><header class="quadrant-heading"><div class="quadrant-symbol">${icon(q.icon)}</div><div><h2>${q.title}<span>${items.length}</span></h2><p>${q.subtitle}</p></div><button class="icon-button" data-action="new-quadrant-task" data-value="${q.id}" aria-label="添加到${q.title}">${icon('plus')}</button></header><div class="quadrant-tasks">${items.length?items.map(t=>taskRow(t,true)).join(''):`<div class="quadrant-empty">${icon(q.icon)}<span>${{do:'不必每件事都赶着做',plan:'给重要的事一点时间',delegate:'让小事轻轻过关',later:'好玩的事，留着慢慢做'}[q.id]}</span></div>`}</div>${quickAdd(q.id)}</section>`;}).join('')}</div>`;}
function openTask(id=null,qId=null){
  if(loadBlocked)return toast('请先导入备份恢复。');
  const existing=id?state.tasks.find(t=>t.id===id):null;if(id&&!existing)return;
  const q=QUADRANTS.find(q=>q.id===qId);
  const task=existing?structuredClone(existing):newTask({listId:view.startsWith('list:')?view.slice(5):state.lists[0].id,dueDate:view==='scheduled'?calendarDate:view==='today'?localDate():'',...(view==='priority'?{important:true,priority:'high'}:{}),...(q?{important:q.important,urgent:q.urgent}:{})});
  modal={type:'task',id,draft:task};renderTaskDialog();
  setTimeout(()=>{const input=$('#task-title');input?.focus();if(!id)input?.select();},40);
}
function renderTaskDialog(){
  const t=modal.draft;
  overlay.innerHTML=`<div class="modal-backdrop"><section class="task-dialog dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title"><header class="dialog-header"><span id="task-dialog-title">${modal.id?'编辑待办':'一件新的待办'}</span><button class="icon-button" data-action="close-modal" aria-label="关闭编辑面板">${icon('close')}</button></header><form id="task-form"><input id="task-title" class="task-title-input" name="title" placeholder="想做些什么？" maxlength="300" value="${esc(t.title)}" required autocomplete="off" aria-label="待办标题"><textarea name="notes" placeholder="添加备注…" maxlength="10000" aria-label="备注">${esc(t.notes)}</textarea><div class="form-grid"><label><span>${icon('folder')}清单</span><select name="listId">${state.lists.map(l=>`<option value="${esc(l.id)}" ${t.listId===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label><label><span>${icon('flag')}优先级</span><select name="priority">${['none','low','medium','high'].map(p=>`<option value="${p}" ${t.priority===p?'selected':''}>${pNames[p]}</option>`).join('')}</select></label><label><span>${icon('calendar')}截止日期</span><input type="date" name="dueDate" value="${esc(t.dueDate)}"></label><label><span>${icon('bell')}提醒时间</span><input type="time" name="dueTime" value="${esc(t.dueTime)}" ${!t.dueDate?'disabled':''}></label></div><div class="repeat-row"><label><span>${icon('reset')}重复</span><select name="repeat" ${!t.dueDate?'disabled':''}>${[['none','不重复'],['daily','每天'],['weekly','每周'],['monthly','每月']].map(([id,label])=>`<option value="${id}" ${t.repeat===id?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="importance-controls"><label class="importance-toggle"><input type="checkbox" name="important" ${t.important?'checked':''}>${icon('star')}<span>重要</span></label><label class="importance-toggle"><input type="checkbox" name="urgent" ${t.urgent?'checked':''}>${icon('bolt')}<span>紧急</span></label><span id="quadrant-preview" class="quadrant-preview">${quadrant(t).title}</span></div><div class="subtasks-section"><h3>子任务 <span id="subtask-count">${t.subtasks.length}</span></h3><div id="subtask-rows">${t.subtasks.map(s=>subtaskFormRow(s)).join('')}</div><div class="subtask-add">${icon('plus')}<input id="subtask-input" placeholder="添加一个小步骤…" maxlength="300" autocomplete="off" aria-label="添加子任务"><button type="button" class="text-button" data-action="add-subtask">添加</button></div></div><footer class="dialog-footer">${modal.id?`<button type="button" class="delete-button icon-button" data-action="delete-task" data-id="${esc(modal.id)}" aria-label="删除待办" title="删除待办">${icon('trash')}</button>`:'<span></span>'}<div><button type="button" class="secondary-button" data-action="close-modal">取消</button><button type="submit" class="primary-button">${modal.id?'保存修改':'添加待办'}${icon('check')}</button></div></footer></form></section></div>`;
}
function subtaskFormRow(s){return `<div class="subtask-form-row" data-subtask="${esc(s.id)}"><input type="checkbox" class="subtask-check" ${s.completed?'checked':''} aria-label="完成子任务"><input class="subtask-title" value="${esc(s.title)}" maxlength="300" aria-label="子任务标题"><button type="button" class="icon-button" data-action="remove-subtask" data-id="${esc(s.id)}" aria-label="删除子任务">${icon('close')}</button></div>`;}
function readDraft(){
  const f=$('#task-form');if(!f)return;
  const fd=new FormData(f);Object.assign(modal.draft,{title:String(fd.get('title')||'').trim(),notes:String(fd.get('notes')||''),listId:fd.get('listId'),priority:fd.get('priority'),dueDate:fd.get('dueDate')||'',dueTime:fd.get('dueDate')?fd.get('dueTime')||'':'',repeat:fd.get('dueDate')?fd.get('repeat')||'none':'none',important:fd.has('important'),urgent:fd.has('urgent'),subtasks:$$('[data-subtask]',f).map(row=>({id:row.dataset.subtask,title:$('.subtask-title',row).value.trim(),completed:$('.subtask-check',row).checked})).filter(s=>s.title)});
}
function closeModal(){overlay.innerHTML='';modal=null;}
function openList(id=null){
  const l=state.lists.find(l=>l.id===id)||{id:uid(),name:'',color:'rose',icon:'heart'};
  modal={type:'list',id,draft:structuredClone(l)};
  overlay.innerHTML=`<div class="modal-backdrop"><section class="dialog list-dialog" role="dialog" aria-modal="true" aria-labelledby="list-dialog-title"><header class="dialog-header"><span id="list-dialog-title">${id?'编辑清单':'新建清单'}</span><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></header><form id="list-form"><input id="list-name" name="name" class="task-title-input" placeholder="清单名称" maxlength="80" value="${esc(l.name)}" required aria-label="清单名称"><div class="list-customizer"><div><h3>颜色</h3><div class="color-options">${['rose','sage','amber','lavender','blue'].map(c=>`<label class="color-option ${c}"><input type="radio" name="color" value="${c}" ${l.color===c?'checked':''} aria-label="${{rose:'粉色',sage:'绿色',amber:'黄色',lavender:'紫色',blue:'蓝色'}[c]}"><span>${icon('check')}</span></label>`).join('')}</div></div><div><h3>图标</h3><div class="icon-options">${['heart','briefcase','coffee','book','star'].map(i=>`<label><input type="radio" name="icon" value="${i}" ${l.icon===i?'checked':''} aria-label="${{heart:'爱心',briefcase:'工作',coffee:'咖啡',book:'书籍',star:'星星'}[i]}"><span>${icon(i)}</span></label>`).join('')}</div></div></div><footer class="dialog-footer">${id&&state.lists.length>1?`<button type="button" class="icon-button delete-button" data-action="delete-list" data-id="${esc(id)}" title="删除清单" aria-label="删除清单">${icon('trash')}</button>`:'<span></span>'}<div><button type="button" class="secondary-button" data-action="close-modal">取消</button><button class="primary-button" type="submit">保存${icon('check')}</button></div></footer></form></section></div>`;
  setTimeout(()=>$('#list-name')?.focus(),40);
}
function openSettings(){
  modal={type:'settings'};
  overlay.innerHTML=`<div class="modal-backdrop"><section class="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header class="dialog-header"><span id="settings-title">设置</span><button class="icon-button" data-action="close-modal" aria-label="关闭设置">${icon('close')}</button></header><div class="settings-body"><div class="settings-brand"><div class="brand-mark">${icon('game')}</div><div><strong>千秋万待</strong><span>只在本机，安心记录。</span></div><span class="version-tag">v1.1.1</span></div><h3>外观与陪伴</h3><div class="settings-row"><span>${icon('moon')}深色模式</span><label class="switch"><input type="checkbox" data-setting="theme" ${state.settings.theme==='dark'?'checked':''} aria-label="深色模式"><i></i></label></div><div class="settings-row"><span>${icon('heart')}七海千秋插画</span><label class="switch"><input type="checkbox" data-setting="artwork" ${state.settings.artwork?'checked':''} aria-label="显示七海千秋插画"><i></i></label></div><div class="settings-row"><span>${icon('bell')}桌面提醒</span><label class="switch"><input type="checkbox" data-setting="notifications" ${state.settings.notifications?'checked':''} aria-label="启用桌面提醒"><i></i></label></div><p class="settings-note">提醒和专注计时在应用运行时生效。</p><h3>本地数据</h3><div class="backup-actions"><button class="secondary-button" data-action="export">${icon('download')}导出备份</button><button class="secondary-button" data-action="import">${icon('upload')}导入备份</button>${isDesktop?'<button class="secondary-button" data-action="data-folder">'+icon('folder')+'数据文件夹</button>':''}</div><p class="settings-note data-path">${esc(isDesktop?dataPath:'浏览器预览使用本地浏览器存储；桌面版使用独立本地文件。')}</p><h3>快捷键</h3><div class="shortcut-row"><span>新建待办</span><kbd>Ctrl N</kbd></div><div class="shortcut-row"><span>搜索</span><kbd>Ctrl K</kbd></div><div class="shortcut-row"><span>保存编辑</span><kbd>Ctrl Enter</kbd></div><div class="settings-bottom"><button class="text-button" data-action="demo">${icon('spark')}载入示例待办</button><span>Made for a quieter day.</span></div></div></section></div>`;
}
async function exportData(){
  try{await saveTail;if(isDesktop){const r=await window.desktop.exportBackup();if(!r.ok)throw new Error(r.error);if(!r.canceled)toast('备份已导出');}
  else {const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`千秋万待-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('备份已导出');}}
  catch(e){toast(`导出失败：${e.message}`);}
}
async function importData(){
  try{await saveTail.catch(()=>{});if(isDesktop){const r=await window.desktop.importBackup();if(!r.ok)throw new Error(r.error);if(r.canceled)return;state=validateState(r.state);loadBlocked=false;closeModal();render();toast('备份已恢复');}
  else {const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>30*1024*1024)throw new Error('文件过大');const incoming=validateState(JSON.parse(await file.text()));confirmDialog('导入这份备份？','当前待办将被替换。',()=>{localStorage.setItem('chiaki-before-import',JSON.stringify(state));state=incoming;loadBlocked=false;changed();toast('备份已恢复');},'导入');}catch(e){toast(`导入失败：${e.message}`);}};input.click();}}
  catch(e){toast(`导入失败：${e.message}`);}
}
function confirmDialog(title,body,onConfirm,label='删除'){
  modal={type:'confirm',onConfirm};overlay.innerHTML=`<div class="modal-backdrop"><section class="dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><header class="dialog-header"><span id="confirm-title">${esc(title)}</span><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></header><p>${esc(body)}</p><footer class="dialog-footer"><span></span><div><button class="secondary-button" data-action="close-modal">取消</button><button class="${label==='删除'?'danger-button':'primary-button'}" data-action="confirm">${esc(label)}</button></div></footer></section></div>`;
}
function timerText(){const seconds=state.timer.end?Math.max(0,Math.ceil((state.timer.end-Date.now())/1000)):timerPaused!==null?timerPaused:state.settings.focusMinutes*60;return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
const actions={
  navigate:el=>{if(el.dataset.view==='matrix'){view='all';layout='matrix';}else view=el.dataset.view;query='';render();},
  layout:el=>{layout=el.dataset.value;if(view==='completed'&&layout==='matrix')view='all';render();},
  'calendar-month':el=>{calendarDate=shiftMonth(calendarDate,Number(el.dataset.offset));calendarMonth=monthStart(calendarDate);render();},
  'calendar-today':()=>{calendarDate=localDate();calendarMonth=monthStart(calendarDate);render();},
  'calendar-select':el=>{calendarDate=el.dataset.date;calendarMonth=monthStart(calendarDate);render();$('.calendar-agenda')?.scrollIntoView({behavior:'smooth',block:'start'});},
  'new-task':()=>openTask(), 'new-quadrant-task':el=>openTask(null,el.dataset.value), 'edit-task':el=>openTask(el.dataset.id),
  complete:el=>{const id=el.dataset.id;const before=structuredClone(state.tasks);const wasCompleted=state.tasks.find(t=>t.id===id)?.completed;completeTask(state,id);changed();toast(wasCompleted?'已恢复待办':'又完成了一件小事',()=>{state.tasks=before;changed();});},
  'close-modal':()=>closeModal(),
  'delete-task':el=>{const id=el.dataset.id;const task=state.tasks.find(t=>t.id===id);if(!task)return;const before=structuredClone(state.tasks);state.tasks=state.tasks.filter(t=>t.id!==id);closeModal();changed();toast('待办已删除',()=>{state.tasks=before;changed();});},
  'new-list':()=>openList(), 'edit-list':el=>openList(el.dataset.id),
  'delete-list':el=>{const id=el.dataset.id;const name=state.lists.find(l=>l.id===id)?.name;confirmDialog(`删除「${name}」清单？`,'清单中的待办会移至另一份清单。',()=>{const fallback=state.lists.find(l=>l.id!==id);if(!fallback)return;state.tasks.forEach(t=>{if(t.listId===id)t.listId=fallback.id;});state.lists=state.lists.filter(l=>l.id!==id);if(view===`list:${id}`)view='all';changed();toast('清单已删除，待办已保留');});},
  'add-subtask':()=>{const input=$('#subtask-input');const title=input?.value.trim();if(!title)return;readDraft();const s={id:uid(),title,completed:false};modal.draft.subtasks.push(s);$('#subtask-rows').insertAdjacentHTML('beforeend',subtaskFormRow(s));input.value='';$('#subtask-count').textContent=modal.draft.subtasks.length;input.focus();},
  'remove-subtask':el=>{el.closest('[data-subtask]').remove();readDraft();$('#subtask-count').textContent=modal.draft.subtasks.length;},
  settings:()=>openSettings(), export:()=>exportData(), import:()=>importData(),
  'data-folder':async()=>{const r=await window.desktop.dataFolder();if(!r.ok)toast(r.error);},
  search:()=>{modal={type:'search'};overlay.innerHTML=`<div class="modal-backdrop search-backdrop"><section class="dialog search-dialog" role="dialog" aria-modal="true" aria-label="搜索待办"><form id="search-form">${icon('search')}<input name="query" placeholder="搜索标题、备注或子任务…" value="${esc(query)}" autocomplete="off" aria-label="搜索关键词"><button class="icon-button" data-action="close-modal" type="button" aria-label="关闭搜索">${icon('close')}</button></form><div class="search-hint"><span>搜索所有未完成待办</span><kbd>Enter</kbd></div></section></div>`;setTimeout(()=>$('#search-form input')?.focus(),40);},
  'clear-search':()=>{query='';render();},
  'focus-view':()=>{focused=!focused;render();},
  window:async el=>{if(!isDesktop)return toast('桌面版支持窗口控制');if(el.dataset.value==='close')await saveTail.catch(()=>{});window.desktop.window(el.dataset.value);},
  undo:()=>{if(undo){const fn=undo;undo=null;fn();$('#toast').classList.remove('visible');}},
  confirm:()=>{const fn=modal?.onConfirm;closeModal();fn?.();},
  demo:()=>confirmDialog('载入示例待办？','会新增一个「示例」清单，现有待办会保留。',()=>{const demo=demoState();const id=uid();state.lists.push({id,name:'示例',color:'lavender',icon:'game'});state.tasks.push(...demo.tasks.map(t=>({...t,listId:id})));view='all';changed();toast('已添加示例清单');},'载入'),
  timer:()=>{if(state.timer.end){timerPaused=Math.max(0,Math.ceil((state.timer.end-Date.now())/1000));state.timer.end=null;state.timer.remaining=timerPaused;}else{state.timer.end=Date.now()+(timerPaused!==null?timerPaused:state.settings.focusMinutes*60)*1000;timerPaused=null;state.timer.remaining=null;}changed();},
  'timer-reset':()=>{state.timer={end:null,remaining:null,taskId:null};timerPaused=null;changed();},
};
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(el){if(el.tagName==='BUTTON')event.preventDefault();actions[el.dataset.action]?.(el);}});
document.addEventListener('submit',event=>{
  event.preventDefault();const f=event.target;
  if(f.id==='task-form'){readDraft();const t=modal.draft;if(!t.title)return $('#task-title').focus();const id=modal.id;t.editedAt=id?new Date().toISOString():null;if(id){const index=state.tasks.findIndex(x=>x.id===id);state.tasks[index]=t;}else state.tasks.push(t);closeModal();changed();toast(id?'修改已保存':'待办已添加');}
  if(f.classList.contains('quick-add')){const input=$('input',f);const title=input.value.trim();if(!title)return;const q=QUADRANTS.find(x=>x.id===f.dataset.quadrant);state.tasks.push(newTask({title,listId:view.startsWith('list:')?view.slice(5):state.lists[0].id,dueDate:view==='scheduled'?calendarDate:view==='today'?localDate():'',...(view==='priority'?{important:true,priority:'high'}:{}),...(q?{important:q.important,urgent:q.urgent}:{})}));changed();toast('待办已添加');$(`.quick-add[data-quadrant="${f.dataset.quadrant}"] input`)?.focus();}
  if(f.id==='list-form'){const fd=new FormData(f);const name=String(fd.get('name')).trim();if(!name)return;const l={...modal.draft,name,color:fd.get('color'),icon:fd.get('icon')};if(modal.id)state.lists[state.lists.findIndex(x=>x.id===modal.id)]=l;else{state.lists.push(l);view=`list:${l.id}`;}closeModal();changed();}
  if(f.id==='search-form'){query=String(new FormData(f).get('query')||'').trim();view='all';closeModal();render();}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='calendar-month'&&/^\d{4}-\d{2}$/.test(el.value)){calendarDate=el.value+'-01';calendarMonth=calendarDate;render();}
  if(el.id==='sort-select'){state.settings.sort=el.value;changed();}
  if(el.id==='focus-duration'){state.settings.focusMinutes=Number(el.value);changed();}
  if(el.dataset.setting){state.settings[el.dataset.setting]=el.dataset.setting==='theme'?(el.checked?'dark':'light'):el.checked;persist().catch(()=>{});render();}
  if(modal?.type==='task'){if(el.name==='dueDate'){const has=!!el.value;$('[name=dueTime]').disabled=!has;$('[name=repeat]').disabled=!has;if(!has){$('[name=dueTime]').value='';$('[name=repeat]').value='none';}}if(el.name==='important'||el.name==='urgent'){$('#quadrant-preview').textContent=quadrant({important:$('[name=important]').checked,urgent:$('[name=urgent]').checked}).title;}}
});
document.addEventListener('input',event=>{if(event.target.id==='search-input'){const start=event.target.selectionStart;query=event.target.value;render();const input=$('#search-input');input?.focus();input?.setSelectionRange(start,start);}});
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='n'){event.preventDefault();if(!modal)openTask();}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(!modal)actions.search();}
  if(event.key==='Escape'){if(modal)closeModal();else if(query){query='';render();}else if(focused){focused=false;render();}}
  if(event.key==='Enter'&&event.target.id==='subtask-input'){event.preventDefault();actions['add-subtask']();}
  if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&modal?.type==='task'){event.preventDefault();$('#task-form').requestSubmit();}
  if((event.key==='Enter'||event.key===' ')&&event.target.matches('.task-row')){event.preventDefault();openTask(event.target.dataset.task);}
  if((event.key==='Enter'||event.key===' ')&&event.target.matches('.calendar-day')){event.preventDefault();actions['calendar-select'](event.target);$(`.calendar-day[data-date="${calendarDate}"]`)?.focus();}
  if(event.key==='Tab'&&modal){const elements=$$('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',overlay).filter(el=>el.offsetParent!==null);const first=elements[0],last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
let draggingId=null;
document.addEventListener('dragstart',event=>{const row=event.target.closest('[data-task]');if(!row)return;draggingId=row.dataset.task;event.dataTransfer.setData('text/plain',draggingId);event.dataTransfer.effectAllowed='move';setTimeout(()=>row.classList.add('dragging'),0);});
document.addEventListener('dragover',event=>{const zone=event.target.closest('[data-drop-quadrant]');const row=event.target.closest('[data-task]');if(draggingId&&(zone||(row&&state.settings.sort==='manual'))){event.preventDefault();event.dataTransfer.dropEffect='move';$$('.drop-target').forEach(el=>el.classList.remove('drop-target'));(zone||row).classList.add('drop-target');}});
document.addEventListener('dragleave',event=>{const zone=event.target.closest('.drop-target');if(zone&&!zone.contains(event.relatedTarget))zone.classList.remove('drop-target');});
document.addEventListener('drop',event=>{const id=draggingId;const task=state.tasks.find(t=>t.id===id);if(!task)return;const zone=event.target.closest('[data-drop-quadrant]');const row=event.target.closest('[data-task]');if(zone){event.preventDefault();const q=QUADRANTS.find(q=>q.id===zone.dataset.dropQuadrant);task.important=q.important;task.urgent=q.urgent;task.editedAt=new Date().toISOString();changed();toast(`已移至${q.title}`);}else if(row&&state.settings.sort==='manual'&&row.dataset.task!==id){event.preventDefault();const visible=sortedTasks(filteredTasks(state,view,query),'manual').filter(t=>t.id!==id);const index=visible.findIndex(t=>t.id===row.dataset.task);visible.splice(index,0,task);visible.forEach((t,i)=>t.order=i);changed();}draggingId=null;$$('.drop-target,.dragging').forEach(el=>el.classList.remove('drop-target','dragging'));});
document.addEventListener('dragend',()=>{draggingId=null;$$('.drop-target,.dragging').forEach(el=>el.classList.remove('drop-target','dragging'));});
setInterval(()=>{const el=$('#focus-time');if(el)el.textContent=timerText();if(state.timer.end&&Date.now()>=state.timer.end&&!isDesktop){state.timer={end:null,taskId:null};timerPaused=null;changed();toast('专注完成，休息一会儿吧。');}if(localDate()!==clockDate){clockDate=localDate();render();}},1000);
async function init(){
  try{if(isDesktop){const result=await window.desktop.load();if(!result.ok)throw new Error(result.error);dataPath=result.path;loadBlocked=!result.state;state=result.state?validateState(result.state):initialState();if(result.warning)setTimeout(()=>toast(result.warning),300);window.desktop.onReminder(value=>{if(value.type==='task'){state.notified.push(value.key);persist().catch(()=>{});toast(`到时间了：${state.tasks.find(t=>t.id===value.id)?.title||'待办提醒'}`);}if(value.type==='focus'){state.timer={end:null,taskId:null};timerPaused=null;changed();toast('专注完成，休息一会儿吧。');}if(value.type==='error')toast('提醒状态保存失败：'+value.message);});window.desktop.onMaximize(value=>{maximized=value;render();});}
  else{const saved=localStorage.getItem('chiaki-todo-v1');if(saved)state=validateState(JSON.parse(saved));}}
  catch(e){loadBlocked=true;toast(`数据无法读取：${e.message}`);}
  timerPaused=state.timer.remaining??null;
  if(isDesktop)window.desktop.onClosing(async()=>{try{await saveTail;window.desktop.window('close-ready');}catch{toast('保存尚未完成，请重试后关闭。');}});
  render();window.__chiakiReady=true;
}
init();
