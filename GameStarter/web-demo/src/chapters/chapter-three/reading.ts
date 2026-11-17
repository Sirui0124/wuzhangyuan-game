import type { JietingNode } from './types';

type ReadingNode = Pick<JietingNode, 'id' | 'kind' | 'text'>;
type ReadingPosition = { node: string; text: string; page: number };

// Authored pauses keep each thought together and leave the source transcript intact.
const firstPages: Record<string, string> = {
    'JT-002': '这一次，我到了街亭。《三国演义》里，马谡不听王平的劝，偏要上山扎营，后来被魏军断了水道，街亭失守，诸葛亮挥泪斩马谡。',
    'JT-151': '我把马谡的回话转告王平，又留在坡脚听他安排。',
    'JT-WATER-PROTECTED': '先前派来的兵已经按令护着取水队。',
    'JT-184': '我把回令交给王平。他看完便叫来领队，当着我的面交代各处的人手，我也把要带回山上的话记了下来。',
};

export class JietingReading {
    private position: ReadingPosition | null = null;

    restore(value?: unknown) {
        const p = value as Partial<ReadingPosition> | null | undefined;
        this.position = p && typeof p.node === 'string' && typeof p.text === 'string'
            && Number.isInteger(p.page) && p.page! >= 0
            ? { node: p.node, text: p.text, page: p.page! } : null;
    }

    private pages(node: ReadingNode) {
        const first = node.kind === 'line' ? firstPages[node.id] : undefined;
        // A later copy edit must never display stale text or omit an unmatched passage.
        return first && node.text.startsWith(first) && node.text.length > first.length
            ? [first, node.text.slice(first.length)] : [node.text];
    }

    current(node: ReadingNode) {
        const pages = this.pages(node), saved = this.position;
        const page = saved?.node === node.id && saved.text === node.text && saved.page < pages.length ? saved.page : 0;
        this.position = { node: node.id, text: node.text, page };
        return { text: pages[page], page, count: pages.length };
    }

    advance(node: ReadingNode) {
        const current = this.current(node);
        if (current.page + 1 >= current.count) return false;
        this.position!.page++;
        return true;
    }

    save(node: ReadingNode): ReadingPosition | undefined {
        return this.current(node).count > 1 ? { ...this.position! } : undefined;
    }
}

/** Reading position belongs to presentation; checkpoints only receive gameplay state. */
export function withoutReading(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const { reading: _reading, ...gameplay } = value as Record<string, unknown>;
    return gameplay;
}

export function savedReading(value: unknown): unknown {
    return value && typeof value === 'object' ? (value as Record<string, unknown>).reading : undefined;
}
