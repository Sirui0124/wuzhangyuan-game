/** Internal protocol details never become player-facing scoring advice. */
export class GrainDialogueError extends Error {
    constructor(public readonly kind: 'protocol' | 'expression', public readonly code: string, public readonly field: string) {
        super(kind === 'protocol'
            ? '系统未能完整处理这次回应，原话和线索已保留，可以原样重试。'
            : '苟安没听明白你想说什么，请补充一句与眼前事情有关的话。');
        this.name = 'GrainDialogueError';
    }
}
export function dialogueProtocolError(code: string, field: string): never {
    throw new GrainDialogueError('protocol', code, field);
}
