import test from 'node:test';
import assert from 'node:assert/strict';
import {safeUrl,searchUrl,calculator} from '../src/logic.mjs';
test('URL normalization and unsafe schemes',()=>{assert.equal(safeUrl('example.com'),'https://example.com/');assert.equal(safeUrl('javascript://alert(1)'),null);assert.equal(safeUrl('file:///tmp/test'),null);assert.equal(safeUrl('https://example.com/path'),'https://example.com/path')});
test('search safely encodes a query',()=>{assert.equal(searchUrl('hello & world','DuckDuckGo'),'https://duckduckgo.com/?q=hello%20%26%20world')});
test('calculator supports precedence without executing code',()=>{assert.equal(calculator('2 + 3 * 4'),14);assert.equal(calculator('(2+3)*4'),20);assert.equal(calculator('-3 + 2'),-1);assert.equal(calculator('1/0'),null);assert.equal(calculator('alert(1)'),null);assert.equal(calculator('2 +'),null)});
