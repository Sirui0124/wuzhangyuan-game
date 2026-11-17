import { esc } from './view-common';
import { clueSidebarHTML, clueReferencesHTML, type DialogueClue } from './dialogue-clues';
import { aiGuidanceHTML } from './ai-guidance';

/** Shared visual structure; chapters retain their own state and action handlers. */
export function expressionHeadingHTML(listener: string, question: string) {
    return `<header class="expression-heading"><h1>对${esc(listener)}说</h1>${question ? `<aside class="expression-current-reply" aria-label="${esc(listener)}上一句话"><p>${esc(question)}</p><small>— ${esc(listener)}</small></aside>` : ''}</header>`;
}

export function expressionPaperHTML(view: {
    evidence: string; clues?: DialogueClue[]; selected?: string[]; draft: string; status: string; polishActions: string; confirmActions: string;
    composer?: string; help?: string; inspection?: string; ready?: boolean; busy?: boolean;
    revealing?: boolean; elapsed?: number; maxLength?: number; placeholder?: string;
    inputId?: string; statusId?: string; clearButton?: string; guidance?: boolean;
}) {
    return `<div class="expression-paper${view.revealing ? ' is-revealing' : ''}" style="--reveal-elapsed:-${Math.max(0, view.elapsed ?? 0)}ms">
        <div class="expression-main">${clueReferencesHTML(view.clues ?? [], view.selected ?? [])}
        ${view.composer ? `<div class="expression-input-block">${view.composer}</div>` : ''}
        <section class="expression-result ${view.ready === false ? 'is-pending' : 'is-ready'}" data-expression-result>
            <div class="expression-writing-wash"><textarea class="expression-draft" id="${esc(view.inputId ?? 'player-expression')}" ${view.maxLength === 0 ? '' : `maxlength="${view.maxLength ?? 1500}"`} aria-label="我的回应" placeholder="${esc(view.placeholder ?? '我的回应…')}"${view.busy ? ' disabled' : ''}>${esc(view.draft)}</textarea></div>
            <p class="expression-status" ${view.statusId ? `id="${esc(view.statusId)}"` : ''} role="status" aria-live="polite">${esc(view.status)}</p>
        </section>
        <div class="polish-actions">${view.polishActions}</div>${view.help ?? ''}
        <footer class="expression-actions">${view.clearButton ?? '<button data-action="clear-expression">清空</button>'}${view.confirmActions}</footer>${view.guidance === false ? '' : aiGuidanceHTML('expression')}</div>${clueSidebarHTML(view.clues ?? [], view.selected ?? [], !!view.busy)}

    </div>`;
}
