import type { RuntimeMode } from '../runtime-mode';
import { itemSystemEnabled, saveItemSystemEnabled, readRuntimePreference } from '../runtime-mode';
import type { GameApi } from '../../../assets/scripts/GameApi';
import type { GameAudio } from '../audio';
import type { GameUIState } from './ui-state';
import { settingsPanelHTML } from '../game-ui-panels';
import { acknowledgeAiSetup } from './ai-guidance';

/** 加载、保存服务配置并测试连接。 */
export function createSettingsController(root: HTMLElement, api: GameApi, audio: Pick<GameAudio, 'volume'>, ui: GameUIState, render: () => void,
    voice: { isEnabled(): boolean; setEnabled(enabled: boolean): void }, runtime: { get(): RuntimeMode; set(mode: RuntimeMode): void; connected(value: boolean): void }, options: { aiOnly?: boolean } = {}) {
    let apiStatus = '', apiSaving = false, apiLoaded = false, apiDetailsOpen = false, settingsSeq = 0, initialApiSettings = { apiKey: '', baseUrl: '', model: '' };
    let initialSetup = false, enableOnSave = false;
    function captureApiFields() {
        if (apiLoaded) for (const [id, key] of [['api-base', 'baseUrl'], ['api-model', 'model'], ['api-key', 'apiKey']] as const) {
            const input = root.querySelector<HTMLInputElement>(`#${id}`); if (input) initialApiSettings[key] = input.value;
        }
    }
    function settingsHTML() {
        return settingsPanelHTML({ runtimeMode: runtime.get(), itemSystemEnabled: itemSystemEnabled(), music: audio.volume('music'), sfx: audio.volume('sfx'), aiVoiceEnabled: voice.isEnabled(),
            apiLoaded, apiSaving, apiDetailsOpen, apiConfig: initialApiSettings, apiStatus, initialSetup, aiOnly: options.aiOnly });
    }
    function openSettings(focusAI = false, firstRun = false) {
        initialSetup = firstRun;
        enableOnSave = focusAI;
        if (focusAI) apiDetailsOpen = true;
        if (apiSaving) { ui.overlay = 'settings'; render(); return; }
        const seq = ++settingsSeq; ui.overlay = 'settings'; apiLoaded = false; apiStatus = '正在读取本机配置……'; render();
        void api.settings().then(value => {
            if (ui.overlay !== 'settings' || seq !== settingsSeq) return;
            initialApiSettings = value; apiLoaded = true; apiStatus = '';
            runtime.connected(Boolean(value.apiKey.trim()));
            render();
        }).catch(() => { if (ui.overlay !== 'settings' || seq !== settingsSeq) return; apiStatus = '暂时无法读取本机配置。请启动本地服务后重试，已有配置不会被覆盖。'; const status = root.querySelector('#api-status'); if (status) status.textContent = apiStatus; });
    }
    async function saveApiSettings(testConnection: boolean) {
        if (!apiLoaded || apiSaving) return;
        initialApiSettings = { apiKey: root.querySelector<HTMLInputElement>('#api-key')!.value.trim(), baseUrl: root.querySelector<HTMLInputElement>('#api-base')!.value.trim(), model: root.querySelector<HTMLInputElement>('#api-model')!.value.trim() };
        apiSaving = true; apiStatus = '正在保存配置……'; render();
        let saved = false;
        try {
            await api.settings(initialApiSettings); saved = true; runtime.connected(Boolean(initialApiSettings.apiKey.trim()));
            if (enableOnSave && initialApiSettings.apiKey.trim()) runtime.set('ai');
            if (testConnection) {
                apiStatus = '配置已保存，正在测试模型连接……'; render();
                const started = performance.now();
                await api.respond({ text: '连接测试，请仅回复 OK。' }, undefined, 50000);
                apiStatus = `连接成功。模型：${initialApiSettings.model}，耗时 ${((performance.now() - started) / 1000).toFixed(1)} 秒。配置已保存。`;
            } else apiStatus = '配置已保存。';
        } catch (error) {
            apiStatus = (saved ? '配置已保存，但连接测试失败：' : '配置暂未保存：') + (error instanceof Error ? error.message : '请确认本地服务已启动后重试。');
        } finally { apiSaving = false; render(); }
    }
    return { settingsHTML, openSettings, saveApiSettings,
        setRuntime(ai: boolean, _phone: boolean) {
            captureApiFields();
            runtime.set(!ai ? 'offline' : 'ai');
            render();
        },
        setItemSystem(enabled: boolean) {
            captureApiFields();
            if (!saveItemSystemEnabled(enabled)) { ui.storageWarning = '系统设置暂未保存，请重试。'; render(); return; }
            runtime.set(readRuntimePreference() === 'offline' ? 'offline' : 'ai');
            render();
        },
        setVoiceEnabled(enabled: boolean) { voice.setEnabled(enabled); },
        setDetails(open: boolean) { apiDetailsOpen = open; },
        close() { settingsSeq++; if (initialSetup) acknowledgeAiSetup(); initialSetup = false; },
    };
}
