import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const allowed=new Map([['/','index.html'],['/index.html','index.html'],['/concepts.css','concepts.css'],['/variants-bd.css','variants-bd.css'],['/concepts.js','concepts.js']]);
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'};
createServer(async(req,res)=>{const path=new URL(req.url,'http://127.0.0.1:8824').pathname;if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}const name=allowed.get(path);if(!name){res.writeHead(404);res.end('Not found');return;}try{const data=await readFile(resolve(root,name));res.writeHead(200,{'Content-Type':mime[name.split('.').pop()],'Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(500);res.end('Preview file unavailable');}}).listen(8824,'127.0.0.1',()=>console.log('Phone UI concepts: http://127.0.0.1:8824/'));
