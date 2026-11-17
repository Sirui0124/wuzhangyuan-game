import { validVector } from './model.js';
import type { AxisId, ChoiceDefinition, OpenDefinition, PersonalityConfig, Vector } from './types.js';

type Row = Record<string, any>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value : [];

/** Adapt the authored files without importing game state or interpreting endings. */
export function normalizePersonalityConfig(characters: Row, ...chapters: Row[]): PersonalityConfig {
  if (typeof characters.version !== 'string' || !Array.isArray(characters.characters)
    || !Number.isFinite(characters.model?.neutralPrior) || characters.model.neutralPrior < 0
    || !(characters.model?.fullChapterEvidenceWeight > 0)) throw new Error('Invalid personality model');
  const choices: ChoiceDefinition[] = [], openQuestions: OpenDefinition[] = [];
  for (const source of chapters) {
    for (const node of rows(source.choices)) for (const option of rows(node.options)) {
      const p = option.personality;
      if (!p || !validVector(p.directions) || ![0, 1, 2].includes(p.weight)) throw new Error('Invalid personality choice');
      choices.push({ chapterId: node.chapter, nodeId: node.nodeId, optionId: option.id,
        decisionId: p.slot ?? node.slot ?? node.nodeId, text: option.text ?? '', reason: p.reason ?? '',
        vector: [...p.directions] as Vector, weight: p.weight, tutorial: node.tutorial === true,
        prompt: node.prompt ?? '', sourcePath: node.source });
    }
    for (const option of rows(source.fixedFallbackSpeeches)) {
      const p = option.personality;
      if (!p || !validVector(p.directions) || ![0, 1, 2].includes(p.weight)) throw new Error('Invalid personality fallback');
      choices.push({ chapterId: option.chapter, nodeId: option.nodeId, optionId: option.id,
        decisionId: p.slot ?? option.nodeId, text: option.text ?? '', reason: p.reason ?? '',
        vector: [...p.directions] as Vector, weight: p.weight, tutorial: false,
        prompt: rows(source.openQuestions).find(n => n.nodeId === option.nodeId)?.prompt ?? '', sourcePath: option.source });
    }
    for (const node of rows(source.openQuestions)) openQuestions.push({ chapterId: node.chapter, nodeId: node.nodeId,
      decisionId: node.personality?.slot ?? node.nodeId, tutorial: node.tutorial === true,
      prompt: node.prompt ?? '', sourcePath: node.source });
  }
  const roster = characters.characters.map((c: Row) => {
    if (typeof c.id !== 'string' || typeof c.name !== 'string' || !Array.isArray(c.coordinates) || c.coordinates.length !== 4
      || c.coordinates.some((n: unknown) => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100)) throw new Error('Invalid personality character');
    return { id: c.id, name: c.name, coordinates: [...c.coordinates] };
  });
  if (new Set(roster.map((c: Row) => c.id)).size !== roster.length || characters.axes?.length !== 4) throw new Error('Invalid personality roster');
  return { version: characters.version, model: { neutralPrior: characters.model.neutralPrior,
    fullChapterEvidenceWeight: characters.model.fullChapterEvidenceWeight }, characters: roster,
    axes: characters.axes.map((a: Row, i: number) => ({ id: ['A', 'B', 'C', 'D'][i] as AxisId, left: a.left, right: a.right })),
    choices, openQuestions };
}

export function linkPersonalitySources(config: PersonalityConfig, sources: Row[]): PersonalityConfig {
  for (const source of sources) {
    for (const option of rows(source.options)) {
      const choice = config.choices.find(c => c.chapterId === source.chapterId && c.nodeId === source.nodeId && c.optionId === option.id);
      if (choice) {
        choice.prompt = source.prompt; choice.sourcePath = source.path; choice.text = option.text;
      } else {
        // New gameplay is visible as source evidence, but never invent personality scores.
        config.choices.push({ chapterId: source.chapterId, nodeId: source.nodeId, optionId: option.id,
          decisionId: source.nodeId, text: option.text, prompt: source.prompt, sourcePath: source.path,
          vector: [null, null, null, null], weight: 0, tutorial: false, reason: '此选项尚未配置性格评分，不计入性格结果。' });
      }
    }
    for (const question of config.openQuestions.filter(o => o.chapterId === source.chapterId && o.nodeId === source.nodeId)) {
      question.prompt = source.prompt; question.sourcePath = source.path;
    }
  }
  return config;
}

export async function loadPersonalityConfig(base = '/story/personality'): Promise<PersonalityConfig> {
  const names = ['characters-and-model', 'chapter-one-two-scoring', 'chapter-three-scoring'];
  const files = await Promise.all([...names, 'evidence-sources'].map(async name => {
    const response = await fetch(`${base.replace(/\/$/, '')}/${name}.json`);
    if (!response.ok) throw new Error(`Personality configuration unavailable: ${response.status}`);
    return response.json();
  }));
  return linkPersonalitySources(normalizePersonalityConfig(files[0], files[1], files[2]), files[3]);
}

export function personalityNamespace(search = typeof location === 'undefined' ? '' : location.search): string {
  const params = new URLSearchParams(search), playtest = params.get('playtest');
  return playtest !== null ? `wzy:personality:v1:playtest:${encodeURIComponent(playtest)}:${encodeURIComponent(params.get('chapter') ?? 'wuzhang')}` : 'wzy:personality:v1';
}
