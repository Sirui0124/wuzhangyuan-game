import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';
test('新服务独立身份、资源白名单、同源限制与方法限制',async()=>{const s=server();await new Promise(r=>s.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+s.address().port;try{assert.deepEqual(await(await fetch(base+'/health')).json(),{demo:'yiling-tactics-lab',version:1});assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/art/overview.webp')).status,200);assert.equal((await fetch(base+'/api/plan',{method:'POST',headers:{origin:'https://outside.example','Content-Type':'application/json'},body:'{}'})).status,403);assert.equal((await fetch(base+'/api/plan')).status,404);}finally{await new Promise(r=>s.close(r));}});
