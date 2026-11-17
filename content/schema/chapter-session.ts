/** First-chapter content contract. Other chapters own their scenes, rules and flow contracts. */
export type ChapterOneScene = 'camp_gate' | 'report_post' | 'jiangwei_tent_front';
export type ChapterOnePhase = 'branch' | 'explore' | 'dialogue' | 'choice' | 'cinematic' | 'thought-prompt' | 'thoughts' | 'expression' | 'spoken' | 'reply' | 'death' | 'ending' | 'map' | 'tent';
export type ChapterOneFlowTarget = { kind: 'section' | 'cinematic' | 'phase'; id: string };
export type ChapterOneFlowSection = {
    id: string; title: string; scene: ChapterOneScene; round: 1 | 2;
    rows: string[]; rowScenes?: Record<string, ChapterOneScene>; next: ChapterOneFlowTarget;
};
export type ChapterOneFlowAction = {
    id: string; label: string; description: string; scene: ChapterOneScene; round: 1 | 2;
    section: string; requires: string[]; x: number; y: number;
};
export type ChapterOneFlowCinematic = {
    id: string; group: string; title: string; clipIds?: string[];
    coveredRows: string[]; next: ChapterOneFlowTarget;
};
export type ChapterOneFlow = {
    schemaVersion: 1; id: 'wuzhang'; title: string; version: string; scriptVersion: string;
    entry: ChapterOneFlowTarget;
    sections: ChapterOneFlowSection[];
    actions: ChapterOneFlowAction[];
    cinematics: ChapterOneFlowCinematic[];
    scenes: { id: ChapterOneScene; title: string; description: string; routes: ChapterOneScene[] }[];
    endings: { id: string; number: string; phase: string; result: string; title: string; description: string; hint: string; kind: string }[];
};

/** Compatibility names for existing content tools and browser imports. */
export type ChapterScene = ChapterOneScene;
export type ChapterPhase = ChapterOnePhase;
export type FlowTarget = ChapterOneFlowTarget;
export type FlowSection = ChapterOneFlowSection;
export type FlowAction = ChapterOneFlowAction;
export type FlowCinematic = ChapterOneFlowCinematic;
export type ChapterFlow = ChapterOneFlow;
