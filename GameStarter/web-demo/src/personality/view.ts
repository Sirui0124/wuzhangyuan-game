import { esc } from '../game/view-common';
import type { PersonalityViewModel } from './types';

export type PersonalityCopyState = 'idle' | 'copied' | 'manual';

/** A missing provider remains a readable, locked page, never a fabricated result. */
export function lockedPersonalityView(): PersonalityViewModel {
    return {
        status: 'locked', unlocked: false, ready: false, completedChapters: 0, observedAxes: 0, pendingCount: 0,
        axes: [
            { id: 'A', left: '谋定', right: '敢行', value: null, evidenceCount: 0 },
            { id: 'B', left: '直陈', right: '周旋', value: null, evidenceCount: 0 },
            { id: 'C', left: '守则', right: '权变', value: null, evidenceCount: 0 },
            { id: 'D', left: '大局', right: '情义', value: null, evidenceCount: 0 },
        ],
        evidence: [], deathHistory: [], candidates: [], storageAvailable: true,
    };
}

export function personalityMenuAction(): string {
    return '<button type="button" class="pause-secondary" data-action="pause-personality"><svg class="pause-seal-icon" viewBox="0 0 32 32" aria-hidden="true"><path class="seal-corners" d="M2 8V2H8M24 2H30V8M30 24V30H24M8 30H2V24"/><path d="M12 7H20V15H12ZM7 26V23L12 19H20L25 23V26M9 11H5M27 11H23M7 17H4M28 17H25"/></svg><span>三国人格</span></button>';
}

function isPreview(view: PersonalityViewModel): boolean {
    return (view as PersonalityViewModel & { preview?: boolean }).preview === true;
}

function axisDescription(axis: PersonalityViewModel['axes'][number], locked = false): string {
    if (locked) return '尚未揭晓';
    if (axis.value === null || !Number.isFinite(axis.value)) return '尚无依据';
    if (Math.abs(axis.value - 50) < 3) return '居中';
    return `偏向${axis.value < 50 ? axis.left : axis.right}`;
}

function axesHTML(view: PersonalityViewModel): string {
    const locked = view.status === 'locked';
    const axes = view.axes.length ? view.axes : lockedPersonalityView().axes;
    return `<section class="personality-dimensions" aria-label="四个性格维度"><div class="personality-section-heading"><h3>行事之间</h3><span>${locked ? '走过第二章，方见轮廓' : '每一端，都有自己的选择'}</span></div><div class="personality-axis-list">${axes.map(axis => {
        const value = !locked && axis.value !== null && Number.isFinite(axis.value) ? Math.max(0, Math.min(100, axis.value)) : null;
        const description = axisDescription(axis, locked);
        return `<div class="personality-axis${value === null ? ' is-unobserved' : ''}" data-axis="${esc(axis.id)}"><div class="personality-axis-labels"><span>${esc(axis.left)}</span><span class="personality-axis-reading">${description}</span><span>${esc(axis.right)}</span></div><div class="personality-scale" role="img" aria-label="${esc(`${axis.left}到${axis.right}，${description}`)}"><i class="personality-scale-center" aria-hidden="true"></i>${value === null ? '' : `<i class="personality-scale-span" style="left:${Math.min(50, value)}%;width:${Math.abs(value - 50)}%" aria-hidden="true"></i><i class="personality-scale-marker" style="left:${value}%" aria-hidden="true"></i>`}</div></div>`;
    }).join('')}</div></section>`;
}

function evidenceTitle(e: PersonalityViewModel['evidence'][number]): string {
    const original = e.source?.text ?? e.quote;
    if (e.source?.kind === 'choice' && /^(确认|继续|离开|返回|同意|就这样)[。！]?$/u.test(original)
        && e.source.prompt && !/[{}]/u.test(e.source.prompt)) return `${original}：${e.source.prompt}`;
    return `“${e.quote}”`;
}

function evidenceHTML(view: PersonalityViewModel): string {
    const records = view.evidence.filter(e => e.quote.trim());
    const row = (e: typeof records[number]) => {
        const source = e.source;
        const prompt = source?.prompt && !/[{}]/u.test(source.prompt) ? source.prompt : '';
        const tags = e.axes.flatMap((id, index) => {
            const axis = view.axes.find(a => a.id === id);
            if (!axis) return [];
            const tendency = e.tendencies?.[index];
            const label = tendency || `${axis.left}／${axis.right}`;
            const description = `影响${axis.left}／${axis.right}：${label}`;
            return [`<span class="personality-attribute-tag" data-axis="${esc(id)}" title="${esc(description)}" aria-label="${esc(description)}">${esc(label)}</span>`];
        }).join('');
        const traits = tags ? `<span class="personality-evidence-traits" aria-label="影响属性">${tags}</span>` : '';
        return `<li data-evidence-node="${esc(source?.nodeId ?? '')}" data-evidence-option="${esc(source?.optionId ?? '')}"><details class="personality-evidence-record" data-personality-detail="evidence:${esc(e.chapterId)}:${esc(e.decisionId)}"><summary><span class="personality-evidence-chapter">${esc(e.chapterLabel)}</span><span class="personality-evidence-copy"><span class="personality-evidence-title">${esc(evidenceTitle(e))}</span>${traits}</span><span class="personality-evidence-chevron" aria-hidden="true">⌄</span></summary><div class="personality-evidence-original">${prompt ? `<span class="personality-source-label">当时的提示</span><p>${esc(prompt)}</p>` : ''}<span class="personality-source-label">${source?.kind === 'choice' ? '所选原文' : '你的原话'}</span><blockquote>${esc(source?.text ?? e.quote)}</blockquote></div></details></li>`;
    };
    return `<section class="personality-evidence"><div class="personality-section-heading"><h3>典型依据</h3></div>${records.length ? `<ol>${records.slice(0, 3).map(row).join('')}</ol>${records.length > 3 ? `<details data-personality-detail="more-evidence"><summary>更多依据（${records.length - 3}）</summary><ol start="4">${records.slice(3).map(row).join('')}</ol></details>` : ''}` : '<p class="personality-empty-copy">还没有足够明确的选择依据。继续游戏，值得记下的取舍会留在这里。</p>'}</section>`;
}

function deathHistoryHTML(view: PersonalityViewModel): string {
    if (!view.deathHistory.length) return '';
    return `<details class="personality-history" data-personality-detail="death-history"><summary><span>曾经走过的结局</span><span class="personality-history-count">${view.deathHistory.length}</span></summary><p>这些经历留作回看，不参与现在的人格判定。</p><ol>${view.deathHistory.map(death => {
        const date = new Date(death.at);
        const time = Number.isNaN(date.getTime()) ? '' : `<time datetime="${esc(date.toISOString())}">${esc(date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }))}</time>`;
        return `<li><div><span>${esc(death.chapterLabel)}</span>${time}</div><strong>${esc(death.endingTitle)}</strong>${death.forced ? '<p>初次教学经历，不计人格。</p>' : death.characterName ? `<p>那时的你，更像${esc(death.characterName)}。</p>` : ''}</li>`;
    }).join('')}</ol></details>`;
}

/** Text leaves the page only after the player's explicit copy action. */
export function personalityShareText(view: PersonalityViewModel): string {
    if (view.status !== 'ready' || !view.character) return '';
    const traits = view.axes.filter(a => a.value !== null && Number.isFinite(a.value)).map(a => `${a.left}／${a.right}：${axisDescription(a)}`).join(' · ');
    const evidence = view.evidence.filter(e => e.quote.trim()).slice(0, 3).map(e => `${e.chapterLabel}：${evidenceTitle(e)}`).join('\n');
    return [`${isPreview(view) ? '【试玩示例】' : ''}在《逆转五丈原》里，若在三国，我更像${view.character.name}。`, traits, evidence, '这是这一程的选择留下的模样，故事继续，答案也会变。'].filter(Boolean).join('\n\n');
}

export function personalityHTML(view: PersonalityViewModel, copyState: PersonalityCopyState = 'idle'): string {
    const ready = view.status === 'ready' && !!view.character;
    const hero = ready
        ? `<div class="personality-hero-heading"><p class="personality-kicker">若在三国，你更像</p><p class="personality-intro">这是这一程的你。故事继续，答案也会变。</p></div><h2 class="personality-name">${esc(view.character!.name)}</h2>`
        : view.status === 'locked'
            ? '<p class="personality-kicker">若在三国，你会是谁</p><h2 class="personality-state-title">第二章结束后揭晓</h2><p class="personality-intro">走过粮案，再回看这一程的取舍。此后的章节，会继续改变你的模样。</p>'
            : '<p class="personality-kicker">若在三国，你会是谁</p><h2 class="personality-state-title">还不能断定，你像谁</h2><p class="personality-intro">眼下的依据还不够。接下来的选择，会让你的性情渐渐清楚。</p>';
    return `<div class="personality-content" data-personality-status="${esc(view.status)}">${isPreview(view) ? '<p class="personality-preview-note">试玩示例 · 不代表你的游玩记录</p>' : ''}<section class="personality-hero${ready ? ' is-ready' : ''}"><div class="personality-seal" aria-hidden="true">${ready ? '此刻' : '待续'}</div><div class="personality-hero-copy">${hero}</div><div class="personality-ink-ring" aria-hidden="true"></div></section><div class="personality-reading-leaf">${axesHTML(view)}${evidenceHTML(view)}</div><footer class="personality-footer"><p>以每关最近一次经历为准。重玩该关，会重写这一页。</p>${view.pendingCount > 0 ? `<p class="personality-pending" role="status">还有 ${view.pendingCount} 段话尚待判断，结果可能会更新。</p>` : ''}<div class="personality-actions"><button type="button" class="folio-button" data-action="resume-game">返回游戏</button>${ready ? '<button type="button" class="quiet-button" data-action="personality-copy">复制分享文字 <span aria-hidden="true">↗</span></button>' : ''}</div><p class="personality-copy-status" role="status" aria-live="polite">${copyState === 'copied' ? '已复制，可以分享这一程的你。' : copyState === 'manual' ? '浏览器未能复制，可选中下面的文字复制。' : ''}</p>${copyState === 'manual' && ready ? `<label class="personality-manual-copy">分享文字<textarea readonly data-personality-copy-text>${esc(personalityShareText(view))}</textarea></label>` : ''}${view.storageAvailable === false ? '<p class="personality-storage-notice" role="status">本次人格记录暂时无法长期保存，关闭页面后可能丢失。</p>' : ''}</footer>${deathHistoryHTML(view)}<p class="personality-footnote">一场三国性情趣测，依据你在故事中的选择。</p></div>`;
}

export function personalityModalHTML(view: PersonalityViewModel, copyState: PersonalityCopyState = 'idle'): string {
    return `<div class="game-modal-shade personality-shade"><section class="game-modal xuan-panel personality-panel" data-page="personality" role="dialog" aria-modal="true" aria-labelledby="game-panel-title"><header class="folio-header"><h1 id="game-panel-title">三国人格</h1><button type="button" class="modal-close" data-action="close-modal" aria-label="返回暂停菜单"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="folio-body" data-personality-content>${personalityHTML(view, copyState)}</div></section></div>`;
}
