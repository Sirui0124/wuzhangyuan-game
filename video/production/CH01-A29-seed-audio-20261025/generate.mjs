import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
const base = new URL('./', import.meta.url), stateFile = new URL('generation.json', base);
let previous; try { previous = JSON.parse(await readFile(stateFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (previous) { console.log(JSON.stringify({ status: previous.status, requestId: previous.requestId, noRepost: true })); process.exit(0); }
const env = parseEnv(await readFile('GameStarter/server/.env', 'utf8'));
if (!env.TTS_API_KEY) throw new Error('Configured speech API key missing');
const referenceFile = 'source-art/audio/voice-clone/20261023/player-reference.wav';
const ref = await readFile(referenceFile);
const text = '将军留步，帐前有禁令，今夜非要事不得入。';
const prompt = `仅参考@音频1中成年男性本人的音色、声线和自然咬字，输出同一个人的干净中文对白。此人是年轻的守帐军士，正在克制而坚定地拦住一位将军，礼貌但不软弱，语气有紧迫感，不喊叫，不模仿参考音频的惊恐或自言自语。唯一允许发声的原句：“${text}”只朗读引号内的原句，不朗读角色名、某某说、旁白、画外、编号或任何控制说明，不复述参考录音。自然连贯，在约4.3秒内说完整句，句首只留约0.1秒呼吸，不拖尾。无BGM，无背景音乐，无配乐，无音效、无环境声，只有单人干净近讲人声。`;
const body = { model: 'seed-audio-1.0', text_prompt: prompt, references: [{ audio_data: ref.toString('base64') }], audio_config: { format: 'wav', sample_rate: 48000, enable_subtitle: true } };
const state = { status: 'dispatching', node: 'A-29', text, text_prompt: prompt, model: body.model, endpoint: 'https://openspeech.bytedance.com/api/v3/tts/create', requestId: randomUUID(), reference: { file: referenceFile, sha256: createHash('sha256').update(ref).digest('hex'), bytes: ref.length, field: 'references[0].audio_data' }, requestSha256: createHash('sha256').update(JSON.stringify(body)).digest('hex'), reviewStatus: '待用户试听', documentation: 'https://docs.volcengine.com/docs/DoubaoVoice/audio-generation-http?lang=zh' };
await writeFile(stateFile, JSON.stringify(state, null, 2), { flag: 'wx' });
try {
    const response = await fetch(state.endpoint, { method: 'POST', redirect: 'error', headers: { 'X-Api-Key': env.TTS_API_KEY, 'X-Api-Request-Id': state.requestId, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(300000) });
    state.httpStatus = response.status; state.logId = response.headers.get('x-tt-logid');
    const data = await response.json();
    if (!response.ok || !data.audio) Object.assign(state, { status: 'failed', code: data.code, error: JSON.stringify(data).replaceAll(env.TTS_API_KEY, '[REDACTED]').slice(0, 1000) });
    else {
        const bytes = Buffer.from(data.audio, 'base64');
        await writeFile(new URL('A-29-player-seed-audio-v1.wav', base), bytes);
        Object.assign(state, { status: 'succeeded', file: 'A-29-player-seed-audio-v1.wav', duration: data.duration, originalDuration: data.original_duration, subtitle: data.subtitle, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
} catch (e) { Object.assign(state, { status: 'unknown-no-repost', error: e.message.replaceAll(env.TTS_API_KEY, '[REDACTED]') }); }
await writeFile(stateFile, JSON.stringify(state, null, 2));
console.log(JSON.stringify({ status: state.status, requestId: state.requestId, duration: state.duration, error: state.error }));
