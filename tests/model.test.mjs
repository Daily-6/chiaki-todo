import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,newTask,localDate,addDays,nextDate,quadrant,completeTask,filteredTasks,sortedTasks,validateState} from '../src/model.mjs';
test('four quadrants are independent of task priority',()=>{
  for(const [important,urgent,id] of [[true,true,'do'],[true,false,'plan'],[false,true,'delegate'],[false,false,'later']]){
    assert.equal(quadrant(newTask({important,urgent,priority:'high'})).id,id);
  }
});
test('Today includes overdue but excludes undated, completed and future tasks',()=>{
  const s=initialState();s.tasks=[newTask({title:'late',dueDate:'2026-10-07'}),newTask({title:'today',dueDate:'2026-10-08'}),newTask({title:'future',dueDate:'2026-10-09'}),newTask({title:'no date'}),newTask({title:'done',dueDate:'2026-10-08',completed:true})];
  assert.deepEqual(filteredTasks(s,'today','','2026-10-08').map(t=>t.title),['late','today']);
});
test('priority sorting uses importance and urgency to break ties, no date sorts last',()=>{
  const tasks=[newTask({title:'low',priority:'low'}),newTask({title:'medium',priority:'medium'}),newTask({title:'important high',priority:'high',important:true}),newTask({title:'high',priority:'high'})];
  assert.deepEqual(sortedTasks(tasks).map(t=>t.title),['important high','high','medium','low']);
  assert.deepEqual(sortedTasks([newTask({title:'none'}),newTask({title:'dated',dueDate:'2026-10-08'})],'date').map(t=>t.title),['dated','none']);
});
test('daily, weekly, month end and leap year recurrences keep local dates',()=>{
  assert.equal(nextDate('2026-12-31','daily'),'2027-01-01');
  assert.equal(nextDate('2026-12-28','weekly'),'2027-01-04');
  assert.equal(nextDate('2026-01-31','monthly'),'2026-02-28');
  assert.equal(nextDate('2028-01-31','monthly'),'2028-02-29');
  assert.equal(addDays('2026-03-08',1),'2026-03-09');
  assert.equal(localDate(new Date(2026,9,8,0,1)),'2026-10-08');
});
test('completing a recurrence creates exactly one fresh instance and reopens safely',()=>{
  const s=initialState();const t=newTask({title:'weekly',dueDate:'2026-10-08',repeat:'weekly',subtasks:[{id:'sub',title:'step',completed:true}]});s.tasks=[t];
  completeTask(s,t.id,new Date('2026-10-08T12:00:00'));assert.equal(s.tasks.length,2);const next=s.tasks[1];assert.equal(next.dueDate,'2026-10-15');assert.equal(next.completed,false);assert.equal(next.subtasks[0].completed,false);assert.notEqual(next.subtasks[0].id,'sub');
  completeTask(s,t.id);assert.equal(s.tasks.length,1);assert.equal(t.completed,false);
  completeTask(s,t.id);assert.equal(s.tasks.length,2);s.tasks[1].editedAt=new Date().toISOString();completeTask(s,t.id);assert.equal(s.tasks.length,2);
});
test('search covers title, notes and subtasks within selected list',()=>{
  const s=initialState();s.tasks=[newTask({title:'A',listId:'work',notes:'PROJECT'}),newTask({title:'B',subtasks:[{id:'s',title:'project step',completed:false}]})];
  assert.equal(filteredTasks(s,'all','project').length,2);assert.equal(filteredTasks(s,'list:work','project').length,1);
});
test('backup rejects malformed dates, broken list references and duplicate ids',()=>{
  const s=initialState();s.tasks=[newTask({title:'one',dueDate:'2026-10-08',dueTime:'09:00'})];assert.equal(validateState(s).tasks[0].title,'one');
  for(const patch of [{dueDate:'2026-02-30'},{dueDate:'not-date'},{dueDate:'',dueTime:'09:00'},{dueTime:'25:00'},{listId:'missing'},{title:'   '}]){assert.throws(()=>validateState({...s,tasks:[{...s.tasks[0],...patch}]}));}
  assert.throws(()=>validateState({...s,tasks:[s.tasks[0],s.tasks[0]]}));assert.throws(()=>validateState({...s,lists:[]}));assert.throws(()=>validateState({version:2,tasks:[],lists:[]}));
});
test('backup keeps settings and paused timer while dropping unrecognized object fields',()=>{
  const s=initialState();s.settings.theme='dark';s.timer={end:null,remaining:100,taskId:null};s.tasks=[newTask({title:'safe',injected:'ignored'})];const v=validateState(s);assert.equal(v.settings.theme,'dark');assert.equal(v.timer.remaining,100);assert.equal(v.tasks[0].injected,undefined);
});
