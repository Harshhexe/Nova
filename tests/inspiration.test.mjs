import test from 'node:test';
import assert from 'node:assert/strict';
import{inspirationForDate,millisecondsUntilMidnight}from'../src/daily-inspiration.mjs';
test('inspiration stays the same throughout the local day',()=>{assert.deepEqual(inspirationForDate(new Date(2026,9,29,0,0)),inspirationForDate(new Date(2026,9,29,23,59)))});
test('inspiration changes on the next calendar day including year rollover',()=>{assert.notEqual(inspirationForDate(new Date(2026,9,29)).text,inspirationForDate(new Date(2026,9,30)).text);assert.notEqual(inspirationForDate(new Date(2026,11,31)).text,inspirationForDate(new Date(2027,0,1)).text)});
test('midnight scheduling follows local date boundaries',()=>{assert.equal(millisecondsUntilMidnight(new Date(2026,9,29,23,59,59)),1000);assert.ok(millisecondsUntilMidnight(new Date(2026,9,29,12))>0)});
