export type ChapterId = 'wuzhang' | 'grain' | 'jieting' | string;
export type AxisId = 'A' | 'B' | 'C' | 'D';
export type Direction = -2 | -1 | 0 | 1 | 2 | null;
export type Vector = [Direction, Direction, Direction, Direction];
export interface PersonalityCharacter { id: string; name: string; coordinates: number[]; }
export interface PersonalityModel { neutralPrior: number; fullChapterEvidenceWeight: number; }
export interface ChoiceDefinition {
  chapterId: ChapterId; nodeId: string; optionId: string; decisionId: string;
  text: string; reason: string; vector: Vector; weight: 0 | 1 | 2; tutorial: boolean;
  prompt?: string; sourcePath?: string;
}
export interface OpenDefinition { chapterId: ChapterId; nodeId: string; decisionId: string; tutorial: boolean;
  prompt?: string; sourcePath?: string; }
export interface PersonalityConfig {
  version: string; model: PersonalityModel;
  axes: { id: AxisId; left: string; right: string }[];
  characters: PersonalityCharacter[]; choices: ChoiceDefinition[]; openQuestions: OpenDefinition[];
}
export interface PersonalityEvent {
  decisionId: string; nodeId: string; optionId?: string; text: string; explanation: string;
  vector: Vector; weight: 1 | 2; quotes: (string | null)[]; at: string; assisted: boolean;
  version: number; attempt: number; kind: 'choice' | 'open'; status: 'pending' | 'failed' | 'ready' | 'cancelled';
}
export interface ChapterLedger {
  epoch: number; runId: string; revision: number; attempt: number; tutorial: boolean;
  status: 'playing' | 'finished'; endingId: string | null; events: PersonalityEvent[];
  nextVersion: number;
}
export interface PersonalityCheckpoint extends ChapterLedger {
  schemaVersion: 1; purpose: 'checkpoint' | 'death-history'; ruleVersion: string; chapterId: ChapterId;
}
export interface AssessmentToken {
  ruleVersion: string; chapterId: ChapterId; nodeId: string; decisionId: string;
  epoch: number; runId: string; decisionVersion: number; attempt: number; input: string; round?: number;
}
export interface DeathArchive {
  id: string; chapterId: ChapterId; endingId: string; title: string; nodeId: string;
  text: string; at: string; forced: boolean; characterName?: string; snapshot: PersonalityCheckpoint;
}
export interface PersonalityState {
  schemaVersion: 1; ruleVersion: string; unlocked: boolean; chapters: Record<string, ChapterLedger>;
  deaths: DeathArchive[]; latestResult: { characterId: string; coordinates: number[] } | null;
}
export interface ProfileAxis { value: number; observed: boolean; observations: number; observedChapters: number; }
export interface PersonalityViewModel {
  status: 'locked' | 'insufficient' | 'ready'; unlocked: boolean; ready: boolean;
  character?: PersonalityCharacter;
  axes: { id: AxisId; left: string; right: string; value: number | null; evidenceCount: number }[];
  evidence: { chapterLabel: string; chapterId: string; decisionId: string; quote: string; explanation: string; axes: string[];
    tendencies?: string[];
    source?: { kind: 'choice' | 'open'; nodeId: string; optionId?: string; prompt: string; text: string; path?: string };
  }[];
  deathHistory: { id: string; chapterLabel: string; endingTitle: string; at: string; forced: boolean; characterName?: string }[];
  candidates: { id: string; name: string; distance: number }[];
  completedChapters: number; observedAxes: number; pendingCount: number; storageAvailable: boolean;
}
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface StoreOptions { namespace?: string; storage?: StorageLike | null; now?: () => string; newRunId?: () => string; }
export interface RecordOutcome { accepted: boolean; reason: string; }
