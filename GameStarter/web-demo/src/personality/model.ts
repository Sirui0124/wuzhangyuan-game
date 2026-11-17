import type { ChapterLedger, PersonalityCharacter, PersonalityEvent, PersonalityModel, ProfileAxis, Vector } from './types.js';

export function validVector(value: unknown): value is Vector {
  return Array.isArray(value) && value.length === 4 && Array.from(value).every(n => n === null || Number.isInteger(n) && n >= -2 && n <= 2);
}

/** The confirmed action supersedes the intention about the same C/D decision. */
export function effectiveEvents(events: PersonalityEvent[]): PersonalityEvent[] {
  const hasFinalAction = events.some(e => e.decisionId === 'CH2.final-action');
  return events.map(e => hasFinalAction && e.decisionId === 'CH2.open.O2'
    ? { ...e, vector: [e.vector[0], e.vector[1], null, null], quotes: [e.quotes[0], e.quotes[1], null, null] }
    : e);
}

export function coordinates(chapters: Record<string, ChapterLedger>, model: PersonalityModel): ProfileAxis[] {
  const latest = Object.values(chapters).filter(c => !c.tutorial).map(c => effectiveEvents(c.events));
  return [0, 1, 2, 3].map(axis => {
    let total = 0, chapterWeight = 0, observations = 0, observedChapters = 0;
    for (const events of latest) {
      const relevant = events.filter(e => e.vector[axis] !== null);
      const weight = relevant.reduce((sum, e) => sum + e.weight, 0);
      if (!weight) continue;
      const mean = relevant.reduce((sum, e) => sum + e.weight * (e.vector[axis] as number) / 2, 0) / weight;
      const reliability = Math.min(1, weight / model.fullChapterEvidenceWeight);
      total += reliability * mean; chapterWeight += reliability;
      observations += relevant.length; observedChapters++;
    }
    return { value: chapterWeight ? 50 + 50 * total / (model.neutralPrior + chapterWeight) : 50,
      observed: observations > 0, observations, observedChapters };
  });
}

export function matchCharacters(profile: ProfileAxis[], characters: PersonalityCharacter[]) {
  const observed = profile.flatMap((a, i) => a.observed ? [i] : []);
  if (!observed.length) return [];
  return characters.map(c => ({ id: c.id, name: c.name,
    distance: Math.sqrt(observed.reduce((sum, i) => sum + (profile[i].value - c.coordinates[i]) ** 2, 0)) }))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}
