import {localDate,addDays} from './model.mjs';

export function monthStart(date) { return date.slice(0,7)+'-01'; }

// Keep the selected day when paging; clamp it at shorter month ends.
export function shiftMonth(date,offset) {
  const d=new Date(`${date}T12:00:00`);
  const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+offset);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,last));return localDate(d);
}

export function monthDays(date) {
  const first=monthStart(date),d=new Date(`${first}T12:00:00`);
  const offset=(d.getDay()+6)%7;
  const count=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  const cells=Math.ceil((offset+count)/7)*7;
  const start=addDays(first,-offset);
  return Array.from({length:cells},(_,i)=>addDays(start,i));
}
