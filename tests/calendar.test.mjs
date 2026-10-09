import test from 'node:test';
import assert from 'node:assert/strict';
import {monthDays,shiftMonth} from '../src/calendar.mjs';

test('Monday-first calendar includes month edges, leap days and six-week months',()=>{
  for(const [month,first,last,length] of [
    ['2026-02-01','2026-01-26','2026-03-01',35],
    ['2028-02-01','2028-01-31','2028-03-05',35],
    ['2026-08-01','2026-07-27','2026-09-06',42],
    ['2027-02-01','2027-02-01','2027-02-28',28],
  ]){
    const days=monthDays(month);
    assert.equal(days[0],first);assert.equal(days.at(-1),last);assert.equal(days.length,length);
    assert.equal(new Set(days).size,length);
    assert.equal(new Date(days[0]+'T12:00:00').getDay(),1);
  }
  assert.ok(monthDays('2028-02-01').includes('2028-02-29'));
});

test('calendar month navigation clamps day and crosses year boundaries',()=>{
  assert.equal(shiftMonth('2026-01-31',1),'2026-02-28');
  assert.equal(shiftMonth('2028-01-31',1),'2028-02-29');
  assert.equal(shiftMonth('2026-12-08',1),'2027-01-08');
  assert.equal(shiftMonth('2026-01-08',-1),'2025-12-08');
});
