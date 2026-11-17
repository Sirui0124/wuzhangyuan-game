import { esc } from './view-common';
import { aiGuidanceHTML } from './ai-guidance';

/** Shared visual structure; chapters retain their own state and action handlers. */
export function expressionHeadingHTML(listener: string, question: string) {
    return `<header class="expression-heading"><h1>对${esc(listener)}说</h1>${question ? `<aside class="expression-current-reply" aria-label="${esc(listener)}上一句话"><p>${esc(question)}</p><small>— ${esc(listener)}</small></aside>` : ''}</header>`;
}

export function expressionPaperHTML(view: {
    evidence: string; draft: string; status: string; polishActions: string; confirmActions: string;
    composer?: string; help?: string; inspection?: string; ready?: boolean; busy?: boolean;
    revealing?: boolean; elapsed?: number; maxLength?: number; placeholder?: string;
}) {
    return `<div class="expression-paper${view.revealing ? ' is-revealing' : ''}" style="--reveal-elapsed:-${Math.max(0, view.elapsed ?? 0)}ms">
        ${view.composer ? `<div class="expression-input-block">${view.composer}</div>` : ''}
        <section class="expression-result ${view.ready === false ? 'is-pending' : 'is-ready'}" data-expression-result>
            <header><label for="player-expression" class="outcome-title" data-expression-output>准备说的话</label></header>
            <div class="expression-writing-wash"><textarea id="player-expression" ${view.maxLength === 0 ? '' : `maxlength="${view.maxLength ?? 1500}"`} aria-label="准备说的话"${view.placeholder ? ` placeholder="${esc(view.placeholder)}"` : ''}${view.busy ? ' disabled' : ''}>${esc(view.draft)}</textarea></div>
            <p class="expression-status" role="status" aria-live="polite">${esc(view.status)}</p>
        </section>
        <div class="polish-actions">${view.polishActions}</div>${view.help ?? ''}
        <footer class="expression-actions">${view.confirmActions}</footer>${aiGuidanceHTML('expression')}

    </div>`;
}
