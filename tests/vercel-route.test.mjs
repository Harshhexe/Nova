import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/suggest.js';
test('Vercel function exports a working suggestion handler',async()=>{let status;let body;const res={setHeader(){},writeHead(value){status=value},end(value){body=JSON.parse(value)}};await handler({url:'/api/suggest?q=a',method:'GET'},res);assert.equal(status,400);assert.match(body.error,/2–200/)});
