import type { NarrativeDecision } from '../narrative/presentation';
import { esc } from './view-common';

export function narrativeChoiceHTML(decision: NarrativeDecision, attribute = 'data-narrative-choice') {
    if (!['data-narrative-choice', 'data-option'].includes(attribute)) throw new Error('Unsupported choice binding');
    return `<section class="dialogue-box scout-choice narrative-choice" data-decision="${esc(decision.id)}" aria-label="剧情选择"><h2 class="dialogue-speaker">${esc(decision.text)}</h2>${decision.choices.map(choice => `<button ${attribute}="${esc(choice.id)}"${choice.enabled === false ? ' disabled' : ''}${choice.reason ? ` title="${esc(choice.reason)}"` : ''}><span>${esc(choice.text)}</span><i aria-hidden="true">›</i></button>`).join('')}</section>`;
}
