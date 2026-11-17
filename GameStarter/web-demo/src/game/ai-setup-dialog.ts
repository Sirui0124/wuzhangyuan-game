import { GameApi } from '../../../assets/scripts/GameApi';
import { createSettingsController } from './settings';
import { createGameUIState } from './ui-state';
import { readRuntimeMode, readPhonePreference, saveRuntimeMode, setRuntimeConnection } from '../runtime-mode';
import { readAiVoiceEnabled, saveAiVoiceEnabled } from '../voice-preference';

/** Reuse the existing settings controller without adding a chapter-specific configuration system. */
export function openAISetup(onClose: () => void = () => {}) {
    if (document.querySelector('.ai-setup-dialog')) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'ai-setup-dialog'; dialog.setAttribute('aria-label', 'AI Token 配置');
    document.body.append(dialog);
    const ui = createGameUIState();
    const changed = () => window.dispatchEvent(new Event('ai-settings-changed'));
    const render = () => { dialog.innerHTML = `<header><h1>配置 AI Token</h1><button type="button" data-setup-close aria-label="关闭配置">×</button></header><label><input id="game-ai-enabled" type="checkbox"${readRuntimeMode() !== 'offline' ? ' checked' : ''}> 启用 AI</label>${settings.settingsHTML()}`; };
    const settings = createSettingsController(dialog, new GameApi(), { volume: () => 0 }, ui, render,
        { isEnabled: readAiVoiceEnabled, setEnabled: saveAiVoiceEnabled },
        { get: readRuntimeMode, set: mode => { saveRuntimeMode(mode); changed(); }, connected: value => { setRuntimeConnection(value); changed(); } }, { aiOnly: true });
    dialog.addEventListener('click', event => {
        const button = (event.target as Element).closest<HTMLElement>('button');
        if (!button) return;
        if (button.hasAttribute('data-setup-close')) dialog.close();
        else if (button.dataset.action === 'settings') settings.openSettings(true);
        else if (['save-api', 'test-api'].includes(button.dataset.action ?? '')) void settings.saveApiSettings(button.dataset.action === 'test-api');
    });
    dialog.addEventListener('input', event => {
        const input = event.target as HTMLInputElement;
        if (input.id === 'game-ai-enabled') settings.setRuntime(input.checked, readPhonePreference());
    });
    dialog.addEventListener('toggle', event => { if ((event.target as HTMLElement).id === 'api-settings') settings.setDetails((event.target as HTMLDetailsElement).open); }, true);
    dialog.addEventListener('close', () => { settings.close(); dialog.remove(); onClose(); }, { once: true });
    settings.openSettings(true); dialog.showModal();
}
