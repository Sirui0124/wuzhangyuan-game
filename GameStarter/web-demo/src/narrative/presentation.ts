/** Presentation is a projection, never the owner of story facts or save data. */
export type NarrativeChoice = { id: string; text: string; enabled?: boolean; reason?: string };
export type NarrativeDecision = { id: string; text: string; choices: readonly NarrativeChoice[] };

/** Reject stale or invented actions before forwarding to a chapter's state machine. */
export function availableChoice(decision: NarrativeDecision, id: string): NarrativeChoice | undefined {
    return decision.choices.find(choice => choice.id === id && choice.enabled !== false);
}

/** Copy only presentation fields; routes, effects and conditions stay in the chapter. */
export function projectDecision(node: { id: string; text: string }, choices: readonly NarrativeChoice[]): NarrativeDecision {
    return { id: node.id, text: node.text, choices: choices.map(({ id, text, enabled, reason }) => ({ id, text, ...(enabled === undefined ? {} : { enabled }), ...(reason === undefined ? {} : { reason }) })) };
}

/** A rendered choice must still belong to the current decision when clicked. */
export function acceptsChoice(decision: NarrativeDecision | undefined, decisionId: string | undefined, choiceId: string): boolean {
    return !!decision && decision.id === decisionId && !!availableChoice(decision, choiceId);
}
