import { StreamingVoice, voiceEndpoint } from './streaming-voice';
const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const status = (text: string) => { document.getElementById('status')!.textContent = text; };
const voice = new StreamingVoice(status);
const save = document.getElementById('save') as HTMLButtonElement;
try {
    const response = await fetch(voiceEndpoint + '/settings');
    if (!response.ok) throw new Error('请重新启动本地游戏服务，以加载配音接口。');
    const settings = await response.json();
    for (const key of ['player', 'weiyan', 'resource']) field(key).value = settings[key];
    status(settings.configured ? '本机已保存语音密钥。选择音色后可试听。' : '请填写语音密钥和两个音色 ID。');
    save.disabled = false;
} catch (error) { status(String(error)); }
field('mute').checked = voice.diagnostics().muted;
field('mute').onchange = () => voice.setMuted(field('mute').checked);
document.getElementById('voice-form')!.onsubmit = async event => {
    event.preventDefault(); save.disabled = true;
    try {
        const response = await fetch(voiceEndpoint + '/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: field('key').value, player: field('player').value, weiyan: field('weiyan').value, resource: field('resource').value }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        field('key').value = ''; status('已保存，可以试听或进入对白试玩。');
    } catch (error) { status(String(error)); } finally { save.disabled = false; }
};
for (const role of ['player', 'weiyan'] as const) document.getElementById('test-' + role)!.onclick = () => {
    voice.stop(); voice.unlock();
    if (field('mute').checked) { status('配音当前已关闭，请取消勾选后试听。'); return; }
    status('正在合成，音频到达即播放……');
    void voice.prepare(field('text').value, role, true).finished.then(result => { if (result === 'ended') status('音频播放流程已结束。如果仍无声，请用下方普通播放器对照试听。'); });
};
document.getElementById('stop')!.onclick = () => { voice.stop(); status('已停止。'); };
setInterval(() => {
    const d = voice.diagnostics();
    document.getElementById('voice-diagnostics')!.textContent = `播放器：${d.state}；音频时钟：${d.time.toFixed(1)}秒；已收到：${Math.round(d.receivedBytes / 1024)} KB；正在处理：${d.tracks}段。`;
}, 500);
