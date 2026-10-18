/** Narrative v1: canonical authoring contract; no engine or Cocos dependencies. */
export type Value = boolean | string | number;
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flag: string; equals: Value }
  | { evidence: string; mode: 'held' | 'presented' }
  | { intent: string };

export interface FlagDefinition {
  id: string;
  scope: 'memory' | 'loop' | 'progress';
  owner: 'player' | string;
  initial: Value;
  allowedValues?: Value[];
  description: string;
}

export type Effect =
  | { type: 'setFlag'; flag: string; value: Value }
  | { type: 'grantEvidence'; evidenceId: string }
  | { type: 'startPromise'; promiseId: string }
  | { type: 'fulfillPromise'; promiseId: string }
  | { type: 'breakPromise'; promiseId: string };

export interface Line {
  id: string;
  speakerId: string;
  text: string;
  when?: Condition;
  mediaId?: string;
  /** Commit only on reaching/confirming this line, including skip-to-end. */
  effects: Effect[];
}

export interface Outcome {
  reply: Line[];
  effects: Effect[];
  next: string | null;
}

export interface Choice {
  id: string;
  label: string;
  intentId: string;
  visibleWhen: Condition;
  enabledWhen: Condition;
  lockedText: string;
  /** Semantic actions must be registered, never arbitrary free-text orders. */
  actionId: string | null;
  outcome: Outcome;
}

export interface FreeInput {
  intentOptions: Array<{ id: string; label: string }>;
  placeholder: string;
  guidingQuestions: string[];
  /** Optional editable draft; never auto-submitted. */
  starterText: string;
  maxLength: number;
  evidenceSelection: 'required' | 'optional';
  judgeId: string;
  outcomes: Record<'accept' | 'need_evidence' | 'need_plan' | 'out_of_scope' | 'clarify', Outcome>;
}

export interface DialogueNode {
  id: string;
  sceneId: string;
  characterId: string;
  topicId: string;
  title: string;
  targetStatement: string | null;
  trigger: 'topic' | 'present_evidence' | 'event';
  priority: number;
  availableWhen: Condition;
  repeat: 'once_per_loop' | 'once_ever' | 'repeatable';
  lines: Line[];
  choices: Choice[];
  freeInput: FreeInput | null;
  /** Used only by terminal/linear nodes; choices and input have own outcomes. */
  onComplete: Effect[];
  next: string | null;
}

export interface Scene {
  id: string;
  title: string;
  visibleWhen: Condition;
  enterWhen: Condition;
  lockedText: string;
  mediaId: string | null;
}

export interface Character {
  id: string;
  name: string;
  motivation: string;
  placements: Array<{ sceneId: string; when: Condition }>;
  visibleWhen: Condition;
  talkWhen: Condition;
  unavailableText: string;
  idleText: string;
}

export interface Evidence {
  id: string;
  title: string;
  source: string;
  proves: string[];
  cannotProve: string[];
  historicalBasis: 'history' | 'romance' | 'fiction';
}

export interface Action {
  id: string;
  title: string;
  availableWhen: Condition;
  /** Essential promise steps have none; unrelated delay uses delay. */
  timeCost: 'none' | 'delay';
  effects: Effect[];
  next: string | null;
}

export interface PromiseDefinition {
  id: string;
  description: string;
  requiredActionIds: string[];
  completedWhen: Condition;
  /** First delay warns; second delay breaks. No real-time clock. */
  delayBudget: number;
  brokenEffects: Effect[];
}

export interface JudgeDefinition {
  id: string;
  acceptedIntentIds: string[];
  requiredPoints: string[];
  forbiddenClaims: string[];
  /** Select a permitted branch using current facts AFTER semantic acceptance. */
  acceptanceCases: Array<{ when: Condition; outcome: Outcome }>;
}

export interface EventRule {
  id: string;
  priority: number;
  when: Condition;
  effects: Effect[];
  next: string | null;
}

export interface Chapter {
  schemaVersion: 1;
  id: string;
  title: string;
  entrySceneId: string;
  /** Optional one-time authored onboarding; restart keeps only these progress flags. */
  restart?: { preserveFlagIds: string[]; afterNodeId: string; restartNodeId: string; revivalNodeId: string };
  /** Read-only future previews can be saved after their lines, before choosing an entrance. */
  readOnlyCheckpointNodeIds?: string[];
  initialFlags: FlagDefinition[];
  scenes: Scene[];
  characters: Character[];
  evidence: Evidence[];
  dialogues: DialogueNode[];
  actions: Action[];
  promises: PromiseDefinition[];
  judges: JudgeDefinition[];
  events: EventRule[];
}

export interface JudgeRequest {
  requestId: string;
  loopId: string;
  stateRevision: number;
  nodeId: string;
  characterId: string;
  intentId: string;
  evidenceIds: string[];
  text: string;
  /** Whitelisted current facts and actor-visible history only. */
  context: string[];
  /** Current permission fact only; Wei Yan receives no dialogue history. */
  weiyan?: { engineFacts: { approval: boolean } };
}

export interface JudgeResult {
  requestId: string;
  status: 'accept' | 'need_evidence' | 'need_plan' | 'out_of_scope' | 'clarify';
  interpretedIntentId: string | null;
  supportedEvidenceIds: string[];
  missingPoints: string[];
  explanation: string;
}
