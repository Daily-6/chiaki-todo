import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,newTask,filteredTasks,sortedTasks,validateState} from '../src/model.mjs';
import {defaultTaskFilters,normalizeTags} from '../src/filters.mjs';
const today='2026-10-09';
test('combined filters use OR within tags and lists, AND across task features',()=>{
  const state=initialState();state.tasks=[
    newTask({title:'match',listId:'work',tags:['学习'],important:true,urgent:false,priority:'medium',dueDate:today,repeat:'weekly',subtasks:[{id:'s',title:'step'}]}),
    newTask({title:'also match',listId:'personal',tags:['项目'],important:true,urgent:false,priority:'medium',dueDate:today,repeat:'weekly',subtasks:[{id:'s',title:'step'}]}),
    newTask({title:'urgent',listId:'work',tags:['项目'],important:true,urgent:true,priority:'medium',dueDate:today,repeat:'weekly',subtasks:[{id:'s',title:'step'}]}),
    newTask({title:'completed',listId:'work',tags:['项目'],important:true,priority:'medium',completed:true,dueDate:today,repeat:'weekly',subtasks:[{id:'s',title:'step'}]}),
  ];
  const f={...defaultTaskFilters(),listIds:['work','personal'],tags:['学习','项目'],important:'yes',urgent:'no',priority:'medium',date:'today',repeat:'yes',subtasks:'yes'};
  assert.deepEqual(filteredTasks(state,'all','',today,f).map(t=>t.title),['match','also match']);
  assert.deepEqual(filteredTasks(state,'all','',today,{...f,status:'completed'}).map(t=>t.title),['completed']);
  assert.equal(filteredTasks(state,'all','',today,{...f,status:'all'}).length,3);
  assert.equal(filteredTasks(state,'all','学习',today,f).length,1);
});
test('date filters respect local day boundaries and exclude completed overdue tasks',()=>{
  const s=initialState();s.tasks=[newTask({title:'late',dueDate:'2026-10-08'}),newTask({title:'today',dueDate:today}),newTask({title:'tomorrow',dueDate:'2026-10-10'}),newTask({title:'last week day',dueDate:'2026-10-15'}),newTask({title:'outside week',dueDate:'2026-10-16'}),newTask({title:'undated'}),newTask({title:'done late',dueDate:'2026-10-08',completed:true})];
  const titles=date=>filteredTasks(s,'all','',today,{...defaultTaskFilters(),status:'all',date}).map(t=>t.title);
  assert.deepEqual(titles('overdue'),['late']);assert.deepEqual(titles('today'),['today']);assert.deepEqual(titles('tomorrow'),['tomorrow']);assert.deepEqual(titles('week'),['today','tomorrow','last week day']);assert.deepEqual(titles('undated'),['undated']);assert.equal(titles('dated').length,6);
});
test('tags and custom focus durations survive validation, old data remains compatible',()=>{
  const s=initialState();s.tasks=[newTask({title:'tags',tags:[' 学习 ','学习','#项目',4,'']})];s.settings.focusMinutes=37;s.settings.sort='urgent';
  assert.deepEqual(validateState(s).tasks[0].tags,['学习','项目']);assert.equal(validateState(s).settings.focusMinutes,37);assert.equal(validateState(s).settings.sort,'urgent');
  delete s.tasks[0].tags;assert.deepEqual(validateState(s).tasks[0].tags,[]);
  for(const n of [0,-1,1.5,1441,NaN,'37']){s.settings.focusMinutes=n;assert.equal(validateState(s).settings.focusMinutes,25);}
  for(const n of [1,1440]){s.settings.focusMinutes=n;assert.equal(validateState(s).settings.focusMinutes,n);}
  assert.deepEqual(normalizeTags('学习，项目,学习'),['学习','项目']);
});
test('feature sorting respects list names and separates completion states',()=>{
  const a=newTask({title:'B',listId:'work',important:true,urgent:false,order:1});const b=newTask({title:'A',listId:'personal',important:false,urgent:true,order:2,completed:true,completedAt:'2026-10-09T12:00:00Z'});
  assert.equal(sortedTasks([a,b],'important')[0],a);assert.equal(sortedTasks([a,b],'urgent')[0],b);assert.equal(sortedTasks([a,b],'title')[0],b);assert.equal(sortedTasks([a,b],'completed')[0],a);assert.equal(sortedTasks([a,b],'list',[{id:'work',name:'B'},{id:'personal',name:'A'}])[0],b);
  a.tags=['B'];b.tags=['A'];assert.equal(sortedTasks([a,b],'tags')[0],b);assert.equal(sortedTasks([newTask({title:'untagged'}),a],'tags')[0],a);
});
