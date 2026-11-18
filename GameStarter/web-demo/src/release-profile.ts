/** Local builds retain every chapter. Packaging writes this constant in its own copy. */
export const packagedChapters: readonly string[] | null = null;
export function hasPackagedChapter(id: string, chapters: readonly string[] | null = packagedChapters) {
    return chapters === null || chapters.includes(id);
}
