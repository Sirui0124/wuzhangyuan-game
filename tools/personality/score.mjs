/** Design verifier only. No browser state, network, or game-runtime integration. */
export function validateVector(vector) {
  if (!Array.isArray(vector) || vector.length !== 4 || vector.some(v => v !== null && (!Number.isInteger(v) || v < -2 || v > 2))) {
    throw new Error('Expected four values: integer -2..2 or null');
  }
}

export function coordinates(chapters, model) {
  const latest = Object.values(chapters).map(chapter => {
    const source = Array.isArray(chapter) ? chapter : Object.values(chapter.events ?? {});
    const events = new Map();
    for (const event of source) {
      validateVector(event.vector);
      if (![1, 2].includes(event.weight)) throw new Error('Invalid evidence weight');
      if (event.excluded || event.tutorial || event.round === 1 && event.chapter === 'wuzhang') continue;
      events.set(event.decisionId, event);
    }
    // The confirmed final action replaces O2's intention about the same C/D tradeoff.
    // A cancelled choice has no final-action event, so it cannot erase the intention.
    return [...events.values()].map(event => events.has('CH2.final-action') && event.decisionId === 'CH2.open.O2'
      ? { ...event, vector: event.vector.map((v, i) => i >= 2 ? null : v) }
      : event);
  });
  return [0, 1, 2, 3].map(axis => {
    let total = 0, chapterWeight = 0, observations = 0, observedChapters = 0;
    for (const events of latest) {
      const relevant = events.filter(e => e.vector[axis] !== null);
      const weight = relevant.reduce((sum, e) => sum + e.weight, 0);
      if (!weight) continue;
      const mean = relevant.reduce((sum, e) => sum + e.weight * e.vector[axis] / 2, 0) / weight;
      const reliability = Math.min(1, weight / model.fullChapterEvidenceWeight);
      total += reliability * mean;
      chapterWeight += reliability;
      observations += relevant.length;
      observedChapters++;
    }
    return {
      value: chapterWeight ? 50 + 50 * total / (model.neutralPrior + chapterWeight) : 50,
      observed: observations > 0, observations, observedChapters,
    };
  });
}

export function matchCharacters(profile, characters) {
  const observed = profile.flatMap((axis, i) => axis.observed ? [i] : []);
  if (!observed.length) return [];
  return characters.map(character => ({
    id: character.id, name: character.name,
    distance: Math.sqrt(observed.reduce((sum, i) => sum + (profile[i].value - character.coordinates[i]) ** 2, 0)),
  })).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}

export function validateOpenFixture(answer) {
  validateVector(answer.values);
  if (!Array.isArray(answer.quotes) || answer.quotes.length !== 4 || typeof answer.text !== 'string') throw new Error('Missing quoted evidence');
  answer.values.forEach((value, i) => {
    const quote = answer.quotes[i];
    if (value !== null && (typeof quote !== 'string' || !quote || !answer.text.includes(quote))) throw new Error(answer.id + ': unsupported axis ' + i);
    if (value === null && quote !== null) throw new Error(answer.id + ': unused quote');
  });
}
