import type { Supplies, SupplyItem } from './supplies';
import type { PhoneSave } from './phone-state';
/** Both chapters provide this small interface to the same phone controller and view. */
export type PhoneSnapshot = { supplies: Supplies; phone: PhoneSave; phase: string; round: number; speech?: unknown; story: { run: string | number; requestSeq: number } };
export interface PhoneHost {
    snapshot(): PhoneSnapshot;
    scene: { title: string };
    canPrepareSupplies(): boolean;
    rememberPhone(value: unknown): void;
    applyPhonePenalty(value: unknown): unknown;
    buySuggestedItem(value: SupplyItem): boolean;
    sellWorldItem?(id: string): boolean;
    expressionContext(focus: string): { evidence: unknown[] };
}
