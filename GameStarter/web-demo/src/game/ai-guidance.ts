import { aiEnabled, readRuntimeMode, RUNTIME_MODE_KEY } from '../runtime-mode';

export const AI_SETUP_KEY = 'wuzhang-ai-setup-seen-v1';
export function needsInitialAiSetup() {
    try { return !localStorage.getItem(AI_SETUP_KEY) && !localStorage.getItem(RUNTIME_MODE_KEY)
        && !localStorage.getItem('wuzhang-chapter-session-v1'); } catch { return false; }
}
export function acknowledgeAiSetup() {
    try { localStorage.setItem(AI_SETUP_KEY, '1'); } catch { /* This visit remains playable. */ }
}

/** A contextual explanation, separate from character dialogue and progression. */
export function aiGuidanceHTML(context: 'expression' | 'grain' | 'jieting' | 'inquiry', online = aiEnabled(readRuntimeMode())) {
    const description = context === 'inquiry' ? 'AI 可以理解你自己写的追问，再由士兵回答。'
        : context === 'jieting' ? 'AI 可以理解你给马谡的理由，并让他根据这次进言回应。'
        : 'AI 可以润色你准备说的话，并让人物根据你的意思回应。';
    const alternative = context === 'expression' ? '当前使用参考句和本地判定，自由措辞的识别范围有限。'
        : context === 'inquiry' ? '当前可选择上方预设问题，发送后继续核问。'
        : '当前使用本章预设发言，选好后即可继续。';
    if (context === 'jieting' && !online) return '<details class="ai-guidance"><summary>当前使用预设发言 · 了解 AI 玩法</summary><p>' + description + '</p><button type="button" data-action="configure-ai">配置 AI Token</button></details>';
    return online ? `<details class="ai-guidance"><summary>AI 已开启 · 自由表达</summary><p>${description}实际请求可能产生服务商费用。</p></details>`
        : `<aside class="ai-guidance" aria-label="AI 体验提示"><p>当前未使用 AI。${alternative}</p><details><summary>配置 AI Token 后有什么不同？</summary><p>${description}Token 即服务商提供的 API Key，需同时填写 API 地址和模型。</p></details><button type="button" data-action="configure-ai">配置 AI Token</button></aside>`;
}
