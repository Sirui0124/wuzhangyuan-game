/** 浏览器只访问代理；API 密钥保存在服务端。 */
export interface GameApiRequest {
    text: string;
    images?: string[];
    previousResponseId?: string;
}
export interface GameApiResponse {
    text: string;
    responseId: string;
    usage?: Record<string, unknown>;
}
export interface GameApiSettings {
    apiKey: string;
    baseUrl: string;
    model: string;
}
export class GameApi {
    constructor(private readonly baseUrl = 'http://127.0.0.1:8787') {}

    async settings(value?: GameApiSettings): Promise<GameApiSettings> {
        const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/game/settings`, {
            method: value ? 'POST' : 'GET',
            headers: value ? { 'Content-Type': 'application/json' } : {},
            body: value ? JSON.stringify(value) : undefined,
            cache: 'no-store',
            signal: AbortSignal.timeout(10000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'API 配置读取或保存失败。');
        return value ?? result as GameApiSettings;
    }

    async respond(request: GameApiRequest, signal?: AbortSignal, timeoutMs = 45000): Promise<GameApiResponse> {
        const controller = new AbortController();
        let timedOut = false;
        const cancel = () => controller.abort();
        if (signal?.aborted) cancel();
        signal?.addEventListener('abort', cancel, { once: true });
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
        try {
            const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/game/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal: controller.signal,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Game API HTTP ${response.status}`);
            return result as GameApiResponse;
        } catch (error) {
            if (timedOut) throw new Error('回应超时，文字已保留，请重试或使用预设选项。');
            throw error;
        } finally {
            clearTimeout(timer); signal?.removeEventListener('abort', cancel);
        }
    }
}
