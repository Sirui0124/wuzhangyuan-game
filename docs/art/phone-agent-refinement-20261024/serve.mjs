import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const files=new Map([['/','index.html'],['/index.html','index.html'],['/refinement.css','refinement.css'],['/refinement.js','refinement.js'],['/assets/ink-paper.png','assets/ink-paper.png'],['/phone-agent-concepts-20261024/concepts.css','../phone-agent-concepts-20261024/concepts.css'],['/phone-agent-concepts-20261024/concepts.js','../phone-agent-concepts-20261024/concepts.js']]);
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png'};
createServer(async(req,res)=>{const path=new URL(req.url,'http://127.0.0.1:8825').pathname;if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}const file=files.get(path);if(!file){res.writeHead(404);res.end('Not found');return;}try{const bytes=await readFile(resolve(root,file));res.writeHead(200,{'Content-Type':mime[file.split('.').pop()],'Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(500);res.end('Preview unavailable');}}).listen(8825,'127.0.0.1',()=>console.log('B refinements: http://127.0.0.1:8825/'));
