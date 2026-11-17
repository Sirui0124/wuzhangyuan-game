/** Presentation is a projection, never the owner of story facts or save data. */
export type NarrativeChoice = { id: string; text: string; enabled?: boolean; reason?: string };
export type NarrativeDecision = { id: string; text: string; choices: readonly NarrativeChoice[] };

/** Reject stale or invented actions before forwarding to a chapter's state machine. */
export function availableChoice(decision: NarrativeDecision, id: string): NarrativeChoice | undefined {
    return decision.choices.find(choice => choice.id === id && choice.enabled !== false);
}
