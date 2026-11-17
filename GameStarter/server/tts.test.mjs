import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import { once } from 'node:events';
import { streamTts } from './tts.mjs';
import { decodeEvent } from './tts-protocol.mjs';

// Independent wire fixture: event + length-prefixed ID + length-prefixed payload.
function response(event, id, payload = Buffer.from('{}'), audio = false) {
  const bytes = Buffer.alloc(16 + Buffer.byteLength(id) + payload.length);
  bytes.set([0x11, audio ? 0xb4 : 0x94, audio ? 0 : 0x10, 0]);
  bytes.writeUInt32BE(event, 4); bytes.writeUInt32BE(Buffer.byteLength(id), 8); bytes.write(id, 12);
  const offset = 12 + Buffer.byteLength(id); bytes.writeUInt32BE(payload.length, offset); payload.copy(bytes, offset + 4);
  return bytes;
}
test('binary TTS streams before finish, uses distinct speaker, and closes cleanly', async t => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' }); await once(server, 'listening');
  t.after(() => server.close());
  let session, text = '', finishSeen = false;
  server.on('connection', (ws, req) => {
    assert.equal(req.headers['x-api-key'], 'fixture-secret');
    assert.equal(req.headers['x-api-resource-id'], 'seed-tts-2.0');
    ws.on('message', buffer => {
      const event = buffer.readUInt32BE(4);
      if (event === 1) ws.send(response(50, 'connection'));
      else if (event === 100) {
        const message = decodeEvent(buffer); session = message.id;
        const data = JSON.parse(message.payload); assert.equal(data.req_params.speaker, 'fixture-weiyan');
        assert.deepEqual(data.req_params.audio_params, { format: 'pcm', sample_rate: 24000 });
        ws.send(response(150, session));
      } else if (event === 200) text += JSON.parse(decodeEvent(buffer).payload).req_params.text;
      else if (event === 102) {
        ws.send(response(352, session, Buffer.from([0, 0, 255, 127]), true));
        setTimeout(() => { finishSeen = true; ws.send(response(152, session)); }, 80);
      } else if (event === 2) ws.send(response(52, 'connection'));
      else assert.fail(`unexpected ${event}`);
    });
  });
  const chunks = [];
  await streamTts({ text: '将军，军情紧急。', speaker: 'fixture-weiyan', apiKey: 'fixture-secret',
    url: `ws://127.0.0.1:${server.address().port}`, onAudio: b => { assert.equal(finishSeen, false); chunks.push(b); } });
  assert.equal(text, '将军，军情紧急。'); assert.deepEqual(Buffer.concat(chunks), Buffer.from([0, 0, 255, 127]));
});
test('cancel closes upstream and malformed frames cannot be treated as audio', async t => {
  assert.throws(() => decodeEvent(Buffer.from([0x11, 0xb4, 0, 0])));
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' }); await once(server, 'listening');
  t.after(() => server.close());
  const controller = new AbortController();
  let closed;
  server.on('connection', ws => { closed = once(ws, 'close'); controller.abort(); });
  await assert.rejects(streamTts({ text: '测试', speaker: 'voice', apiKey: 'fixture', signal: controller.signal,
    url: `ws://127.0.0.1:${server.address().port}`, onAudio: () => assert.fail('cancelled audio') }), /Cancelled/);
  await closed;
});
