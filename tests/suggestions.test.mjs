import test from 'node:test';
import assert from 'node:assert/strict';
import{normalizeSuggestions,suggestionsHandler}from'../server/suggestions.mjs';
test('Google suggestions are validated, deduplicated and bounded',()=>{assert.deepEqual(normalizeSuggestions(['q',['one',null,'one','two',42]]),['one','two']);assert.deepEqual(normalizeSuggestions({}),[]);assert.equal(normalizeSuggestions(['q',Array.from({length:20},(_,i)=>String(i))]).length,8)});
test('suggestion route rejects invalid input before contacting Google',async()=>{let status;let body;const res={setHeader(){},writeHead(s){status=s},end(b){body=JSON.parse(b)}};await suggestionsHandler({url:'/api/suggest?q=a',method:'GET'},res);assert.equal(status,400);assert.match(body.error,/2–200/)});
