/** Composition has a separate contract from NPC judgment. Sources never enter the writer prompt. */
export type ExpressionMaterial = {
    id: string;
    kind: 'fact' | 'inference' | 'plan' | 'commitment';
    meaning: string;
    attribution: string;
    listenerAlreadyKnows: boolean;
    time: 'current' | 'historical-plan' | 'prior-run-memory';
    limit: string;
};
export type ExpressionSource = {
    evidenceId: string;
    basisIds: string[];
    originals: { id: string; speaker: string; text: string }[];
};
export type ExpressionItem = { kind: 'item'; id: string; name: string; ability: string; boundary: string };
export type ExpressionItemLink = { itemId: string; evidenceIds: string[]; quote: string };
export const hasExpressionMaterial = (evidenceCount: number, itemCount: number, words: string) =>
    evidenceCount > 0 || itemCount > 0 || !!words.trim();
export type ExpressionBrief = {
    schemaVersion: 2;
    conversation: {
        stage: 'first' | 'authorized';
        location: string;
        speaker: '我（守卒）';
        listener: '魏延';
        situation: string;
        listenerTurn: { speaker: '魏延'; text: string } | null;
        /** Confirmed exchanges in this encounter; context, never additional selected evidence. */
        previousTurns?: { text: string; reply: string }[];
    };
    playerIntent: {
        mode: 'compose-from-selected' | 'compose-selected-with-intent' | 'polish-player-words';
        /** The current editor draft takes precedence; otherwise use the supplementary input. */
        words: string;
        /** Optional for compatibility with older composition callers. Never NPC judgment input. */
        draft?: string;
        focus?: string;
    };
    selectedEvidence: ExpressionMaterial[];
    /** Only owned items actually attached to this utterance; never shopping suggestions. */
    attachedItems?: ExpressionItem[];
};
export type ExpressionGenerationInput = {
    brief: ExpressionBrief;
    /** Verification only: these are deliberately excluded from generation. */
    verificationSources: ExpressionSource[];
};
