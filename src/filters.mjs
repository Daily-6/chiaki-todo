export const defaultTaskFilters=()=>({status:'pending',listIds:[],tags:[],priority:'any',important:'any',urgent:'any',date:'any',repeat:'any',subtasks:'any'});
export function normalizeTags(value){
  const items=Array.isArray(value)?value:typeof value==='string'?value.split(/[,，\n]+/):[];
  return [...new Set(items.filter(t=>typeof t==='string').map(t=>t.trim().replace(/^#+/,'').slice(0,40)).filter(Boolean))].slice(0,20);
}
export function matchesTaskFilters(task,filters,today,addDays){
  if(filters.status==='pending'&&task.completed||filters.status==='completed'&&!task.completed)return false;
  if(filters.listIds.length&&!filters.listIds.includes(task.listId))return false;
  if(filters.tags.length&&!filters.tags.some(tag=>(task.tags||[]).includes(tag)))return false;
  if(filters.priority!=='any'&&task.priority!==filters.priority)return false;
  for(const key of ['important','urgent'])if(filters[key]!=='any'&&task[key]!== (filters[key]==='yes'))return false;
  const date=task.dueDate;
  if(filters.date==='overdue'&&(!date||date>=today||task.completed))return false;
  if(filters.date==='today'&&date!==today)return false;
  if(filters.date==='tomorrow'&&date!==addDays(today,1))return false;
  if(filters.date==='week'&&(!date||date<today||date>addDays(today,6)))return false;
  if(filters.date==='dated'&&!date||filters.date==='undated'&&date)return false;
  if(filters.repeat==='yes'&&task.repeat==='none'||filters.repeat==='no'&&task.repeat!=='none')return false;
  if(filters.subtasks==='yes'&&!task.subtasks.length||filters.subtasks==='no'&&task.subtasks.length)return false;
  return true;
}
export const validFocusMinutes=value=>Number.isInteger(value)&&value>=1&&value<=1440;
