import {createServer}from'node:http';
import {readFile}from'node:fs/promises';
import {resolve,extname,sep}from'node:path';
import {suggestionsHandler}from'./suggestions.mjs';
const root=resolve('dist');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
createServer((req,res)=>{suggestionsHandler(req,res,async()=>{try{if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return}const data=await readFile(path);res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:data)}catch{res.writeHead(404);res.end('Not found')}})}).listen(Number(process.env.PORT)||4173,process.env.HOST||'127.0.0.1',()=>console.log('NOVA available on port '+(process.env.PORT||4173)));
