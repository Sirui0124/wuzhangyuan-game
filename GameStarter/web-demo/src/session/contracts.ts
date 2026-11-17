/** Shared persistence envelope. Each chapter owns its state and factual rules. */
export type SessionIdentity<ChapterId extends string = string> = {
    schemaVersion: 1;
    chapterId: ChapterId;
    contentVersion: string;
};
