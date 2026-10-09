import {icon} from './icons.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const filterFields={
  status:['状态',[['pending','未完成'],['completed','已完成'],['all','全部状态']]],
  priority:['优先级',[['any','全部优先级'],['high','高'],['medium','中'],['low','低'],['none','无优先级']]],
  important:['重要程度',[['any','不限'],['yes','重要'],['no','不重要']]],
  urgent:['紧急程度',[['any','不限'],['yes','紧急'],['no','不紧急']]],
  date:['截止日期',[['any','不限'],['overdue','已逾期'],['today','今天'],['tomorrow','明天'],['week','未来七天'],['dated','有日期'],['undated','无日期']]],
  repeat:['重复',[['any','不限'],['yes','重复待办'],['no','不重复']]],
  subtasks:['子任务',[['any','不限'],['yes','有子任务'],['no','无子任务']]],
};
export function filterSummary(filters,state){
  const items=[];
  for(const [key,[label,options]] of Object.entries(filterFields))if(filters[key]!== (key==='status'?'pending':'any'))items.push({key,label:label+'：'+options.find(([value])=>value===filters[key])[1]});
  for(const id of filters.listIds)items.push({key:'listIds',value:id,label:state.lists.find(l=>l.id===id)?.name||'清单'});
  for(const tag of filters.tags)items.push({key:'tags',value:tag,label:'#'+tag});
  return items;
}
export function renderFilterMenu(filters,state){
  const select=(key)=>{const [label,options]=filterFields[key];return `<label class="filter-field"><span>${label}</span><select data-filter="${key}" aria-label="筛选${label}">${options.map(([value,text])=>`<option value="${value}" ${filters[key]===value?'selected':''}>${text}</option>`).join('')}</select></label>`;};
  const tags=[...new Set([...state.tasks.flatMap(t=>t.tags||[]),...filters.tags])].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  const choices=(key,items)=>items.map(([value,label])=>`<label class="filter-choice"><input type="checkbox" data-filter-array="${key}" value="${esc(value)}" ${filters[key].includes(value)?'checked':''}><span>${esc(label)}</span></label>`).join('');
  return `<section class="filter-popover" aria-label="筛选待办"><header><strong>筛选</strong><button class="text-button" data-action="filters-reset">重置</button><button class="icon-button" data-action="filters-toggle" aria-label="收起筛选">${icon('close')}</button></header><div class="filter-fields">${['status','priority','important','urgent','date','repeat','subtasks'].map(select).join('')}</div><fieldset><legend>清单 <button class="text-button" data-action="manage-lists">管理清单</button></legend><div class="filter-choices">${choices('listIds',state.lists.map(l=>[l.id,l.name]))}</div></fieldset>${tags.length?`<fieldset><legend>标签</legend><div class="filter-choices">${choices('tags',tags.map(t=>[t,'#'+t]))}</div></fieldset>`:''}</section>`;
}
export function renderFilterChips(filters,state){
  const items=filterSummary(filters,state);
  return items.length?`<div class="filter-chips" aria-label="当前筛选">${items.map(({key,value,label})=>`<button data-action="filter-remove" data-key="${key}" ${value!==undefined?`data-value="${esc(value)}"`:''} aria-label="取消${esc(label)}">${esc(label)}${icon('close')}</button>`).join('')}<button class="clear-filters" data-action="filters-reset">清除</button></div>`:'';
}
