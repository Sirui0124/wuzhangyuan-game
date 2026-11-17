import type { GameSessionState } from './session-state';
import { currentClueSources, derive, inferenceRules } from './thought-canvas-model';
import { sixClueMigration } from './clue-save-migration';

export const jiangDutyMigration = {"from": "c6bca106a0dfaeb1c068de4bac02429bde086657c71b9703f3f3fb52ecadfd35", "to": "87f1e97bc7e78917ffd471c57b76ef615ec99f5f7e26af109abb4c0fe52798a1"};
/** Recover only information already heard. An unperformed inference stays unperformed. */
export function migrateJiangDutySave(state: GameSessionState, currentVersion: string): void {
    if (currentVersion !== jiangDutyMigration.to || ![jiangDutyMigration.from, sixClueMigration.from].includes(state.contentVersion)) return;
    const story = state.story;
    if (!story || !Array.isArray(story.completed) || !Array.isArray(story.collected) || !Array.isArray(story.edges) || !Array.isArray(story.seen) || !Array.isArray(story.selected)) return;
    const priorRules = inferenceRules.map(rule => rule.id === 'R02' ? {...rule, requires: rule.requires.filter(id => id !== 'C07')} : rule);
    const earnedPlan = story.seen.includes('R02') && !!derive(story.collected, story.edges, priorRules, story).R02;
    if (currentClueSources('C07', story.completed).length && !story.collected.includes('C07')) story.collected.push('C07');
    if (earnedPlan && story.collected.includes('C07')) {
        if (!story.edges.some(edge => edge.includes('C06') && edge.includes('C07'))) story.edges.push(['C06', 'C07']);
        for (const record of state.thinking?.history ?? []) {
            if (!record.outputs.some(output => output.id === 'R02')) continue;
            if (!record.inputs.includes('C07')) record.inputs.push('C07');
            for (const output of record.outputs) if (output.id === 'R02' && !output.used.includes('C07')) output.used.push('C07');
            record.added.push(['C06', 'C07']);
        }
    }
    // Preserve already spoken history; remove the plan only from the editable clue selection.
    story.selected = story.selected.filter(id => id !== 'R02');
}
