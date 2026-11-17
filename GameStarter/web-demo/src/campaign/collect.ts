/** Entry-level adapters may depend on chapter owners; the finale consumes results.ts only. */
import { JingzhouSession, type Story as JingzhouStory } from '../chapters/chapter-five/session';
import { JietingSession } from '../chapters/chapter-three/session';
import type { JietingStory } from '../chapters/chapter-three/types';
import { emptyResult, priorChapters, RESULT_KEY, validateResult, type CampaignSnapshot, type ChapterResult, type ResultStore } from './results';
import { YILING_BASE_KEY, YILING_CAMPAIGN_KEY } from './yiling-result';
type FetchJSON = (url: string) => Promise<any>;
const fetchJSON: FetchJSON = async url => { const r = await fetch(url); if (!r.ok) throw new Error('章节正文未载入'); return r.json(); };
const keys = ['wuzhang-chapter-session-v1','grain-chapter-two-films-v1','jieting-chapter-three-v1','yiling-chapter-four-v1','jingzhou-chapter-five-v1',''];
export async function collectCampaign(store: ResultStore = localStorage, read: FetchJSON = fetchJSON): Promise<CampaignSnapshot> {
    const results = await Promise.all(priorChapters.map(async (id,index): Promise<ChapterResult> => {
        const key = keys[index]; let r = emptyResult(id);
        try {
            const raw = key ? store.getItem(key) : null;
            if (id === 'yiling') {
                const adopted = JSON.parse(store.getItem(RESULT_KEY) ?? '{}')?.yiling;
                if (adopted?.source?.startsWith('yiling-rescue-adopted:') && store.getItem(YILING_BASE_KEY) === JSON.stringify(raw)) {
                    validateResult(adopted); if(adopted.chapterId!=='yiling'||adopted.status!=='completed')throw new Error('营救结果不完整'); return adopted;
                }
                const campaignId = store.getItem(YILING_CAMPAIGN_KEY);
                if (campaignId) {
                    if (adopted?.source?.startsWith(`yiling-rescue-campaign:${campaignId}:`)) {
                        validateResult(adopted); if (adopted.chapterId !== id) throw new Error('营救结果章节不符'); return adopted;
                    }
                    return { ...emptyResult(id, 'in-progress'), source: YILING_CAMPAIGN_KEY };
                }
                return r;
            }
            if (!raw) {
                // A sixth chapter can be connected without changing finale nodes.
                if (id === 'chapter-six') { const value = JSON.parse(store.getItem(RESULT_KEY) ?? '{}')[id]; if (value) { validateResult(value); if (/playtest|demo|fixture/i.test(value.source)) throw new Error('非正式结果'); return value; } }
                return r;
            }
            const s = JSON.parse(raw); r = { ...emptyResult(id,'in-progress'), source:key };
            const done = (ending: string, detail: string) => { r.status='completed'; r.ending=ending; r.detail=detail; };
            if (id === 'wuzhang') {
                if (s.schemaVersion!==1 || s.chapterId!==id || !s.story || !Array.isArray(s.story.completed)) throw new Error('存档身份错误');
                if (['ending','map'].includes(s.phase) && ['safe','radio-relay','light-signal','item-plan'].includes(s.end)) done(s.end,'守灯与军情交接完成，但北伐困境仍在。');
            } else if (id === 'grain') {
                const story = await read('/story/chapter-two.films.json');
                if (s.version!==story.version || !Array.isArray(s.visited) || !Array.isArray(s.chosen)) throw new Error('存档身份错误');
                const n = story.nodes.find((n:any)=>n.id===s.node); if (!n) throw new Error('节点不存在');
                if (n.kind==='finish' && !s.end) {
                    done(n.ending,n.text);
                    if (['E1','E2'].includes(n.ending)) r.people=[{name:'苟安',fate:'saved',detail:n.ending==='E1'?'苟安与你共同补报，活着面对后续处置。':'苟安当时被救下；案中的责任并未因此消失。'}];
                    else if (n.ending==='E5') r.people=[{name:'苟安',fate:'unknown',detail:'苟安被放行，后来赴魏散谣，不能写成安稳归乡。'}];
                    // “人没回来” and a conviction are not proof of death.
                }
            } else if (id === 'jieting') {
                const story = await read('/story/chapter-three.story.json') as JietingStory;
                const session = new JietingSession(story,s), n=session.current;
                if (n.kind==='ending') { const e=story.endings.find(e=>e.id===n.ending)!; done(e.id,e.description);
                    if (e.masuAlive!==null) r.people=[{name:'马谡',fate:e.masuAlive?'saved':'dead',detail:e.masuAlive?'马谡活着离开了这次街亭危局。':'马谡在掩护撤离时战死，街亭仍然守住了。'}]; }
            } else if (id === 'jingzhou') {
                const story = await read('/story/chapter-five.reports.json') as JingzhouStory;
                const saved = s.contentVersion==='jingzhou-reports-20261028-v1' && story.version==='jingzhou-reports-20261028-v2' ? {...s,contentVersion:story.version} : s;
                const session = new JingzhouSession(story,saved.seed,saved), e=session.result;
                if (e) { done(e.survived?'guanyu-returned':'guanyu-lost',`六条军报中，判断正确${e.judged}条。${e.outcome==='costly'?'撤离途中有所折损。':''}`);
                    r.people=[{name:'关羽',fate:e.survived?'saved':'dead',detail:e.survived?'关羽这一次脱险归来，后来仍因失城郁郁而终。':'关羽未能脱离荆州危局，最终被俘身亡。'}]; }
            }
            validateResult(r); return r;
        } catch { return {...emptyResult(id,'invalid'),source:key}; }
    }));
    return {version:1,capturedAt:new Date().toISOString(),results};
}
