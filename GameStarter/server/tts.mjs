import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { encodeEvent, decodeEvent } from './tts-protocol.mjs';

/** Binary bidirectional provider transport; never expose credentials to the browser. */
export function streamTts({ text, speaker, apiKey, resource = 'seed-tts-2.0', signal, onAudio,
  url = 'wss://openspeech.bytedance.com/api/v3/tts/bidirection' }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Cancelled')); return; }
    const ws = new WebSocket(url, { headers: { 'X-Api-Key': apiKey, 'X-Api-Resource-Id': resource,
      'X-Api-Connect-Id': randomUUID() }, handshakeTimeout: 10000, maxPayload: 10 * 1024 * 1024 });
    const session = randomUUID();
    let settled = false, audioBytes = 0, stage = 'connection';
    const finish = error => {
      if (settled) return; settled = true; clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (ws.readyState === WebSocket.OPEN) ws.close(); else ws.terminate();
      error ? reject(error) : resolve({ audioBytes });
    };
    const abort = () => finish(new Error('Cancelled'));
    const timer = setTimeout(() => finish(new Error('语音合成超时')), 45000);
    signal?.addEventListener('abort', abort, { once: true });
    const params = { speaker, audio_params: { format: 'pcm', sample_rate: 24000 } };
    const send = (event, payload = {}, id = '') => ws.send(encodeEvent(event, payload, id));
    ws.on('open', () => send(1));
    ws.on('message', bytes => {
      if (settled) return;
      try {
        const m = decodeEvent(bytes);
        if ([51, 153].includes(m.event)) throw new Error(`语音服务拒绝请求（${m.event}），请检查密钥、资源和音色`);
        if (m.event >= 100 && m.id !== session) throw new Error('TTS session mismatch');
        if (m.event === 50 && stage === 'connection') {
          stage = 'session'; send(100, { event: 100, req_params: params }, session);
        } else if (m.event === 150 && stage === 'session') {
          stage = 'audio';
          // Send punctuation-sized pieces without artificial per-character delays.
          for (const part of text.match(/[^。！？；，,.!?;]+[。！？；，,.!?;]?|[。！？；，,.!?;]/gu) ?? [text])
            send(200, { event: 200, req_params: { ...params, text: part } }, session);
          send(102, {}, session);
        } else if (m.type === 11 && stage === 'audio') {
          audioBytes += m.payload.length;
          if (audioBytes > 12 * 1024 * 1024) throw new Error('语音过长');
          onAudio(m.payload);
        } else if (m.event === 152 && stage === 'audio') {
          if (!audioBytes) throw new Error('语音服务未返回音频');
          stage = 'closing'; send(2);
        } else if (m.event === 52 && stage === 'closing') finish();
      } catch (error) { finish(error); }
    });
    ws.on('error', () => finish(new Error('语音连接失败，请检查密钥和网络')));
    ws.on('close', () => { if (stage === 'closing' && audioBytes) finish(); else finish(new Error('语音连接提前关闭')); });
  });
}

export async function handleTts(req, res, config) {
  const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (req.method === 'GET') { send(200, { configured: Boolean(config.TTS_API_KEY), player: config.TTS_PLAYER_VOICE || '', weiyan: config.TTS_WEIYAN_VOICE || '' }); return; }
  if (req.method !== 'POST') { send(405, { error: 'Method not allowed' }); return; }
  if (!config.TTS_API_KEY) { send(503, { error: '尚未配置语音服务，请在设置中查看配音配置；可继续文字对话。' }); return; }
  let data;
  try {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 16000) throw new Error(); }
    data = JSON.parse(body);
    if (!['player', 'weiyan'].includes(data.role) || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 1200) throw new Error();
  } catch { send(400, { error: '无效的语音请求' }); return; }
  const speaker = config[data.role === 'player' ? 'TTS_PLAYER_VOICE' : 'TTS_WEIYAN_VOICE'];
  if (!speaker) { send(503, { error: '请先配置我和魏延的语音音色 ID。' }); return; }
  const controller = new AbortController();
  res.once('close', () => controller.abort());
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const emit = value => { if (!res.destroyed) { res.write(JSON.stringify(value) + '\n'); if (res.writableLength > 2 * 1024 * 1024) controller.abort(); } };
  try {
    await streamTts({ text: data.text, speaker, apiKey: config.TTS_API_KEY, resource: config.TTS_RESOURCE_ID,
      signal: controller.signal, onAudio: bytes => emit({ audio: bytes.toString('base64') }) });
    emit({ done: true });
  } catch (error) { if (!controller.signal.aborted) emit({ error: error.message }); }
  res.end();
}
