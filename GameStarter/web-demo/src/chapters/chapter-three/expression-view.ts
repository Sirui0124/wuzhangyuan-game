import { expressionHeadingHTML, expressionPaperHTML } from '../../game/expression-view';
import type { JietingSession } from './session';
import type { JietingViewState } from './view';
import { esc, btn } from '../../game/view-common';
import { deploymentAxisHTML } from './deployment-view';

/** Uses the same expression, evidence and inspection components as chapters one and two. */
export function jietingExpression(s: JietingSession, v: JietingViewState, hud: string, background: string) {
    const question = s.state.followupUsed[s.current.id] ? s.state.unresolvedConcerns.at(-1) ?? s.current.text : s.current.text;
    const paper = expressionPaperHTML({ evidence: '', clues:s.clues.filter(c=>c.current!==false), selected:s.state.selected,
        draft:s.state.draft, busy:v.busy, status:v.error||(v.questioning?'马谡正在斟酌……':v.polishing?'正在润色……':v.busy?'正在等待回应……':''),
        polishActions:v.polishing?btn('cancel-speech','取消润色','cancel-polish'):!v.busy?`${v.retryAction==='question'?btn('retry-question','重试提问'):''}${btn('polish-expression',v.error&&v.retryAction==='polish'?'重试润色':'润色表达','polish-button',!s.state.draft.trim()&&!s.state.selected.length)}${v.canUndoPolish?btn('undo-polish','撤销润色','restore-draft'):''}`:'',
        confirmActions:v.busy&&!v.polishing?btn('cancel-speech','停止等待'):btn('speak',v.error&&v.retryAction==='speak'?'重试说出 ↗':'确认说出 ↗','confirm-expression',v.busy||!s.state.draft.trim()),
    });
    const axis = deploymentAxisHTML(s, v.previousBelow);
    return `<main class="thought-screen workspace-screen expression-workspace jieting-expression${axis ? ' has-deployment' : ''}" data-phase="expression"><div class="thought-landscape" style="background-image:url('${esc(background)}')"></div><div class="paper-atmosphere"></div>${hud}${axis}<div class="workspace-layout" tabindex="0" aria-label="组织表达，可上下滚动"><div class="expression-layout"><section class="thought-center expression-center">${expressionHeadingHTML('马谡',question)}${paper}</section></div></div></main>`;
}
