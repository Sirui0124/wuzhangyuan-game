import { handleCluePopup } from './game/dialogue-clues';
import { acceptsChoice } from './narrative/presentation';
import { createCompositionGuard } from './game/composition-guard';
import { chapterOnwardHTML } from './game/chapter-onward';
import { recordAchievements } from './achievements/storage';
import { recordChapterHistory } from './chapters/progression';
import { grainAchievementIds } from './chapters/chapter-two/achievements';
import { polishDialogue } from './dialogue-polish';
import { grainPolishInput } from './chapters/chapter-two/polish';
import { bindDialogueScreenInput } from './game/dialogue-screen-input';
import { createPauseMenu } from './game/pause-menu';
import { createSettingsController } from './game/settings';
import { aiGuidanceHTML } from './game/ai-guidance';
import { GameApi } from '../../assets/scripts/GameApi';
import { GameAudio, type AudioBus } from './audio';
import { readAiVoiceEnabled, saveAiVoiceEnabled } from './voice-preference';
import { saveRuntimeMode, setRuntimeConnection} from './runtime-mode';
import { readRuntimeMode, aiEnabled } from './runtime-mode';
import { fixedSpeeches, fixedJudgment } from './chapters/chapter-two/film-dialogue';
import { GrainSession, type GrainStory } from './chapters/chapter-two/session';
import { CinematicPlayer, type Clip } from './cinematics';
import { judgeOpenDialogue, type Rubric } from './chapters/chapter-two/open-dialogue';
import { beginDialogueDiagnostic, recordDialogueDiagnostic } from './chapters/chapter-two/dialogue-diagnostics';
import { grainView } from './game/grain-view';
import { createGrainDialogueCamera } from './game/grain-dialogue-camera';
import { esc, type Media } from './game/view-common';
import { createGameUIState } from './game/ui-state';
import { createCharacterModule } from './characters/module';
import { chapterTwoCharacters } from './chapters/chapter-two/characters';
import { gameModules } from './modules/config';
import { createEvaluationModule } from './modules/evaluation';
import { frameModal, recordsPanelHTML, savePanelHTML } from './game-ui-panels';
import { grainHasCompleted, GRAIN_SAVE_KEY, GRAIN_COMPLETED_KEY } from './chapters/chapter-two/navigation';
import { backupGrainSave, grainRecoveryKeys, verifyGrainBackup } from './chapters/chapter-two/save-recovery';
import { grainHistory } from './chapters/chapter-two/history';
import { updateChapterAudio } from './chapter-audio';

const filmStyles=document.createElement('link');filmStyles.rel='stylesheet';filmStyles.href='/grain-films.css';document.head.append(filmStyles);
const materialStyles=document.createElement('link');materialStyles.rel='stylesheet';materialStyles.href='/evidence-material.css';document.head.append(materialStyles);

const playtest=new URLSearchParams(location.search).get('playtest')==='open1';
const isolatedPlaytest=playtest;
const key=playtest?'grain-chapter-two-open1-playtest-v1':GRAIN_SAVE_KEY;
const root=document.querySelector<HTMLElement>('#game-root')!;
const read=async <T>(url:string):Promise<T>=>{const r=await fetch(url);if(!r.ok)throw new Error('第二章内容未载入，请刷新重试。');return r.json();};
async function start(){
    const [story,rubric,movies,media]=await Promise.all([read<GrainStory>(playtest?'/story/chapter-two.playable.json':'/story/chapter-two.films.json'),read<Rubric>(playtest?'/story/chapter-two.rubric.json':'/story/chapter-two.films-rubric.json'),read<{chapterPreview:Clip[];chapterTwo:Clip[]}>('/cinematics.json'),read<Media>('/media/manifest.json')]);
    let saved:unknown,initialError='',restarting=false;
    let originalRaw:string|null|undefined,recoveryPending=false,recoveryKey='';
    const protectOriginal=()=>{
        if(typeof originalRaw!=='string')return false;
        try{recoveryKey=backupGrainSave(localStorage,key,originalRaw);if(verifyGrainBackup(localStorage,key,originalRaw,recoveryKey))return true;recoveryKey='';return false;}
        catch{recoveryKey='';return false;}
    };
    const allowReplacement=()=>{
        if(!recoveryPending)return;
        if(typeof originalRaw!=='string'||!verifyGrainBackup(localStorage,key,originalRaw,recoveryKey))throw new Error('旧进度备份尚未核实，原自动存档仍保留。');
    };
    try{
        const raw=originalRaw=localStorage.getItem(key);
        if(!isolatedPlaytest&&grainHasCompleted(story,raw,null))localStorage.setItem(GRAIN_COMPLETED_KEY,'true');
        const url=new URL(location.href);
        if(url.searchParams.get('restart')==='1'&&!isolatedPlaytest){
            if(raw!==null){backupGrainSave(localStorage,key,raw);localStorage.setItem(`${key}:before-new`,raw);}
            saved=undefined;restarting=true;
        }else if(raw!==null){saved=JSON.parse(raw);if(!saved||typeof saved!=='object'||Array.isArray(saved))throw new Error('存档内容不可读');}
    }catch{saved=undefined;recoveryPending=true;protectOriginal();}
    const entryURL=new URL(location.href);entryURL.searchParams.delete('restart');history.replaceState(null,'',entryURL);
    const createSession=(value?:unknown)=>{const s=new GrainSession(story,value,rubric);if(playtest&&s.current.id===story.start)for(let i=0;i<story.nodes.length&&s.current.kind!=='open';i++)if(!s.advance(s.current.options?.[0]?.id))break;return s;};
    let session:GrainSession;
    try{session=createSession(saved);}catch{recoveryPending=true;protectOriginal();saved=undefined;session=createSession();}
    let request:AbortController|null=null,requestDiagnostic:string|undefined,editing=false,error=initialError,detail='';
    const composition = createCompositionGuard(root, render);
    const ui=createGameUIState();ui.home=false;if(recoveryPending)ui.overlay='save-recovery';
    const people=createCharacterModule({root,portraits:media.characters,enabled:gameModules.characters});
    const evaluation=createEvaluationModule<Parameters<typeof judgeOpenDialogue>,Awaited<ReturnType<typeof judgeOpenDialogue>>>({enabled:()=>aiEnabled(readRuntimeMode()),online:([input,rules,evidence,_signal,diagnostic],signal)=>judgeOpenDialogue(input,rules,evidence,signal,diagnostic)});
    const player=new CinematicPlayer(story.version,playtest?'grain-open1-films':'grain-prefix-cinematics-v1',true);
    if(restarting)player.resetPlayback();
    const snapshot=()=>({...session.state});
    const persist=()=>{if(recoveryPending)return;try{
        if(!isolatedPlaytest)recordAchievements(grainAchievementIds(session),`grain:${session.state.run}`);
        localStorage.setItem(key,JSON.stringify(snapshot()));
        if(!isolatedPlaytest)recordChapterHistory('grain',session.current.kind==='finish');
        if(!isolatedPlaytest&&session.current.kind==='finish')localStorage.setItem(GRAIN_COMPLETED_KEY,'true');
    }catch{error='当前进度未能保存，仍可继续。';}};
    const audio = new GameAudio();
    const settings = createSettingsController(root, new GameApi(), audio, ui, () => render(), { isEnabled: readAiVoiceEnabled, setEnabled: saveAiVoiceEnabled }, {
        get: readRuntimeMode,
        set: mode => { saveRuntimeMode(mode); applyMode(); },
        connected: value => { setRuntimeConnection(value); applyMode(); },
    });
    const pauseMenu = createPauseMenu(root, ui, { render: () => render(), settings: settings.settingsHTML,
        suspend: () => { audio.setMusicPaused(true); cancel(); evaluation.cancel(); },
        home: () => { cancel(); persist(); location.href='/'; },
        saves: saveHTML, restart: restartChapter,
    });
    function saveHTML() {
        const slots=[undefined,1,2].map(i=>{
            const slotKey=i===undefined?key:key+':slot:'+i, raw=localStorage.getItem(slotKey);
            let summary='北伐粮运危机',savedAt:number|undefined,sceneImage:string|undefined;
            try {
                const value=JSON.parse(raw??'null'); const n=story.nodes.find(n=>n.id===value?.node);
                if(n){summary=(n.text||'北伐粮运危机').slice(0,55);sceneImage=n.image??(n.material?media.scenes.grain_records:undefined);}
                savedAt=value?.savedAt;
            } catch { summary='此存档暂不可读，原记录保留'; }
            return {key:slotKey,manualIndex:i,exists:!!raw,chapterTitle:'第二章',summary,sceneImage,savedAt,overwrite:i!==undefined&&ui.slotOverwrite===String(i)};
        });
        const backups=grainRecoveryKeys(localStorage,key);
        const recovery=backups.length?`<details><summary>旧进度备份（${backups.length}）</summary><p>备份保留原始进度；内容兼容时可以恢复。</p>${backups.map((backup,index)=>`<button class="folio-button" data-load-backup="${esc(backup)}">尝试恢复备份 ${index+1}</button>`).join('')}</details>`:'';
        return savePanelHTML(slots,{canStore:!recoveryPending})+recovery+`<p role="status">${esc(ui.storageWarning||ui.notice)}</p>`;
    }
    function restartChapter() {
        try { const raw=recoveryPending?originalRaw!:JSON.stringify(snapshot());allowReplacement();localStorage.setItem(key+':before-new',raw); }
        catch { ui.storageWarning='暂时无法备份当前进度，请先存档后重试。';ui.overlay='save';render();return; }
        recoveryPending=false;cancel();evaluation.cancel();player.resetPlayback();delete root.dataset.node;
        session=createSession();editing=false;error='';ui.overlay='';ui.notesShown=false;ui.slotOverwrite='';ui.notice='';ui.storageWarning='';
        persist();render();
    }
    root.addEventListener('toggle', event => { const target = event.target as HTMLElement; if (target.id === 'api-settings') settings.setDetails((target as HTMLDetailsElement).open); }, true);
    root.addEventListener('input', event => {
        const target = event.target as HTMLInputElement;
        if (target.dataset.volume) { audio.setVolume(target.dataset.volume as AudioBus, Number(target.value)); if(target.nextElementSibling) target.nextElementSibling.textContent=target.value+'%'; }
        if (target.id === 'ai-voice-enabled') settings.setVoiceEnabled(target.checked);
        if (target.id === 'game-ai-enabled') settings.setRuntime(target.checked);
    });
    const dialogueCamera=createGrainDialogueCamera();
    const closePicker=()=>{ui.notesShown=false;ui.inventoryKind='clues';};
    const cancel=()=>{if(request)recordDialogueDiagnostic(requestDiagnostic,'cancelled');request?.abort();request=null;requestDiagnostic=undefined;polishing=false;};
    let activeMode=readRuntimeMode();
    function applyMode(){
        const nextMode=readRuntimeMode();
        if(nextMode===activeMode)return;
        activeMode=nextMode;
        cancel(); evaluation.cancel();
        ui.notesShown=false; ui.inventoryKind='clues'; detail='';
        persist(); render();
    }
    window.addEventListener('pagehide',event=>{cancel();evaluation.cancel();if(!event.persisted){people.dispose();evaluation.dispose();}});
    function next(option?:string){
        if(ui.overlay||ui.notesShown||request)return;
        const before=new Set(session.clues.map(c=>c.id)),node=session.current.id;
        if(session.advance(option)){editing=false;persist();render();audio.play('dialogue_next');}
    }
    let polishing=false, previousPolish:{node:string;run:number;before:string;after:string}|null=null;
    const canUndoPolish=()=>!!previousPolish&&previousPolish.node===session.current.id&&previousPolish.run===session.state.run&&previousPolish.after===session.state.draft;
    async function polish() {
        if(request||session.current.kind!=='open'||!aiEnabled(readRuntimeMode()))return;
        const controller=new AbortController(),current=session,input=grainPolishInput(session),signature=JSON.stringify(input);
        const before=session.state.draft;
        request=controller;polishing=true;error='';closePicker();persist();render();
        try {
            const text=await polishDialogue(input,controller.signal);
            if(controller.signal.aborted||request!==controller||session!==current||session.current.id!==input.node||JSON.stringify(grainPolishInput(session))!==signature)return;
            previousPolish={node:input.node,run:session.state.run,before,after:text};
            session.state.draft=text;error='';persist();
        } catch(e) {if(request===controller&&!controller.signal.aborted)error=e instanceof Error?e.message:'润色未完成，原稿已保留。';}
        finally {if(request===controller){request=null;polishing=false;render();}}
    }
    async function speak(){
        if(request||!session.state.draft.trim())return;
        const controller=new AbortController(),current=session,node=session.current.id;
        request=controller;error='';closePicker();render();audio.play('submit');
        const diagnostic=beginDialogueDiagnostic({input:session.state.draft.trim(),rubricVersion:session.currentRubric!.version,rubric:session.currentRubric,scene:session.current.round,nodeId:node,storyVersion:story.version,run:session.state.run,evidence:session.clues,selected:session.state.selected});
        requestDiagnostic=diagnostic;
        const listener=dialogueCamera.listen(root,movies.chapterTwo,node,session.state.draft,controller.signal,event=>recordDialogueDiagnostic(diagnostic,event==='listener-mounted'?'listener-started':'listener-ended',{snapshot:{mediaEvent:event}}));
        try{const j=await evaluation.evaluate([session.state.draft.trim(),session.currentRubric!,session.clues,controller.signal,{requestId:diagnostic,nodeId:node,storyVersion:story.version,run:session.state.run,selected:[...session.state.selected],responseContext:session.dialogueResponseContext}],controller.signal);
            await listener;
            if(request!==controller||session!==current||session.current.id!==node){recordDialogueDiagnostic(diagnostic,'late-result-ignored');return;}
            if(session.submit(j)){
                
                editing=false;persist();audio.play('response_ready');
            }
        }catch(e){if(request===controller)error=e instanceof Error?e.message:'回应失败，请重试。';}
        finally{if(request===controller){request=null;requestDiagnostic=undefined;render();if(root.querySelector('.grain-reply'))recordDialogueDiagnostic(diagnostic,'reply-visible');}}
    }
    function fixedSpeak(index:number){
        if(request||session.current.kind!=='open')return;
        const round=session.current.round??'O1',node=session.current.id;
        const selected=fixedJudgment(round,index,session.currentRubric!);
        // Fixed alternatives do not silently give away attached inventory.
        if(!session.submit(selected.judgment))return;
        audio.play('submit');
        
        closePicker();
        persist();
        if(['CH2-V11T','CH2-V11D'].includes(selected.clip)){render();return;}
        const clip=movies.chapterTwo.find(c=>c.id===selected.clip);
        if(clip){audio.setMusicPaused(true);player.mount(root,'reply:'+session.current.id+':'+session.state.run,[clip],'chapter-two',()=>next());people.sync(chapterTwoCharacters(session));}
        else render();
    }
    function render(){
        if (composition.defer()) return;
        try{renderContent();}finally{
            people.sync({...chapterTwoCharacters(session),visible:!ui.overlay});
            const node=session.current;
            const determined=!ui.overlay&&(node.kind!=='open'||!!session.state.judgments[node.id]);
            const following=determined&&node.next?story.nodes.find(n=>n.id===node.next):undefined;
            player.prepareNext(following?.kind==='video'?[...movies.chapterPreview,...movies.chapterTwo].find(c=>c.id===following.clip):undefined);
        }
    }
    function renderContent(){
        if(pauseMenu.render())return;
        if(recoveryPending&&!ui.overlay)ui.overlay='save-recovery';
        updateChapterAudio(audio,'grain',session.current,{later:Object.keys(session.state.judgments).length>0,silent:false});
        if(session.current.kind==='video'&&!ui.overlay&&root.dataset.node===session.current.id&&root.querySelector('.cinema-screen video'))return;
        dialogueCamera.disposeListening();
        root.querySelectorAll<HTMLVideoElement>('.grain-listener video').forEach(listener=>{listener.pause();listener.removeAttribute('src');listener.load();});
        const replyFrame=root.querySelector<HTMLCanvasElement>('.grain-reply-frame');
        player.dispose(false,true);root.dataset.node=session.current.id;
        if(session.current.kind==='video'&&!ui.overlay){const clip=[...movies.chapterPreview,...movies.chapterTwo].find(c=>c.id===session.current.clip);if(!clip)throw new Error('影像缺失');player.mount(root,session.current.id,[clip],'chapter-two',()=>next());dialogueCamera.transitionToFilm(replyFrame,root.querySelector('video'));return;}
        root.innerHTML=grainView(session,media,{notes:ui.notesShown,editing,busy:!!request,error,polishing,canUndoPolish:canUndoPolish(),detail});
        dialogueCamera.mountReply(root,session.current.id);
        if(session.current.kind==='open'&&!ui.overlay&&!aiEnabled(readRuntimeMode())){
            const round=session.current.round??'O1';
            const paper=root.querySelector('.expression-paper');
            if(paper)paper.innerHTML=`<section class="grain-fixed-speech">${fixedSpeeches[round].map((s,i)=>`<button data-fixed-speech="${i}">${esc(s.text)}</button>`).join('')}</section>${aiGuidanceHTML('grain',false)}`;
        }
        if(ui.overlay==='onward'&&session.current.kind==='finish')root.insertAdjacentHTML('beforeend',chapterOnwardHTML('grain',session.current.ending??''));
        if(ui.overlay==='records')root.insertAdjacentHTML('beforeend',frameModal('历史对白',recordsPanelHTML(grainHistory(session)),'history'));
        if(ui.overlay==='save')root.insertAdjacentHTML('beforeend',frameModal('存档',saveHTML(),'saves'));
        if(ui.overlay==='save-recovery'){
            const readable=typeof originalRaw==='string';
            const message=!readable?'暂时无法读取本机进度。自动保存已暂停，请重试读取。':recoveryKey?'上次进度暂时无法恢复，原记录已另存备份。可以读取手动存档，或从本章开头重新开始。':'上次进度暂时无法恢复，备份还没有保存成功。原自动存档仍保留，请先重试备份。';
            root.insertAdjacentHTML('beforeend',frameModal('保留旧进度',`<p role="status">${message}</p>${readable?'<button class="folio-button" data-action="save">查看存档</button>':''}${!recoveryKey?'<button class="folio-button" data-action="retry-save-recovery">重试</button>':''}${recoveryKey?'<button class="folio-button" data-action="restart-recovered">从本章开头开始</button>':''}<a href="/">返回开始页</a>`,'saves'));
        }
    }
    root.addEventListener('input',e=>{const t=e.target as HTMLTextAreaElement;if(t.id==='letter-draft'){session.state.letterDraft=t.value;persist();}if(t.id==='player-expression'){session.state.draft=t.value;session.state.selectedAt=session.current.id;persist();const note=root.querySelector('.grain-selection-note');if(note)note.textContent='所选线索供这次写话参考，可按 × 收回。';const b=root.querySelector<HTMLButtonElement>('[data-action=speak]');if(b)b.disabled=!t.value.trim();const polishButton=root.querySelector<HTMLButtonElement>('[data-action=polish-expression]');if(polishButton)polishButton.disabled=!!request||(!t.value.trim()&&!session.state.selected.length&&true);const undo=root.querySelector<HTMLButtonElement>('[data-action=undo-polish]');if(undo)undo.hidden=!canUndoPolish();}});
    root.addEventListener('click',e=>{
        const clueButton = (e.target as HTMLElement).closest<HTMLElement>('button');
        if (clueButton && handleCluePopup(root, clueButton)) return;
        const target=e.target as HTMLElement;
        const b=target.closest<HTMLElement>('[data-action],[data-option],[data-select],[data-detail],[data-store-slot],[data-load-slot],[data-load-backup],[data-fixed-speech]');
        if(!b)return;
        e.preventDefault(); // The shared reading surface must not consume this UI action a second time.
        if(b instanceof HTMLButtonElement&&b.disabled)return;
        if(b.dataset.action&&!['next','speak'].includes(b.dataset.action))audio.action(b.dataset.action);
        if(b.dataset.fixedSpeech!==undefined){fixedSpeak(Number(b.dataset.fixedSpeech));return;}
        if (b.dataset.option) { if (acceptsChoice(session.decision, b.closest<HTMLElement>('[data-decision]')?.dataset.decision, b.dataset.option)) next(b.dataset.option); return; }
        if(b.dataset.storeSlot){if(recoveryPending)return;const id=b.dataset.storeSlot;try{if(localStorage.getItem(key+':slot:'+id)&&ui.slotOverwrite!==id){ui.slotOverwrite=id;render();return;}localStorage.setItem(key+':slot:'+id,JSON.stringify({...snapshot(),savedAt:Date.now()}));ui.slotOverwrite='';ui.storageWarning='';ui.notice='已保存到手动存档 '+id+'。';}catch{ui.storageWarning='暂时无法写入存档，当前进度仍保留。';}render();return;}
        if(b.dataset.loadSlot||b.dataset.loadBackup||b.dataset.action==='load-auto'){try{const value=localStorage.getItem(b.dataset.loadBackup??(b.dataset.action==='load-auto'?key:key+':slot:'+b.dataset.loadSlot));if(value){const saved=JSON.parse(value);if(!saved||typeof saved!=='object'||Array.isArray(saved))throw new Error('incompatible');const restored=createSession(saved);allowReplacement();recoveryPending=false;cancel();evaluation.cancel();pauseMenu.dismiss();player.resetPlayback();delete root.dataset.node;session=restored;editing=false;ui.overlay='';ui.notesShown=false;ui.slotOverwrite='';ui.storageWarning='';ui.notice='';persist();render();}}catch{ui.storageWarning=recoveryPending&&!recoveryKey?'旧进度备份尚未完成，原自动存档仍保留。请返回重试备份。':'这份存档暂不可读，当前进度和原存档已保留。';render();}return;}
        if (['insert-clue','remove-clue','clear-expression'].includes(b.dataset.action ?? '') && session.current.kind === 'open' && (!request || polishing)) {
            const clue = session.clues.find(c => c.id === b.dataset.clue);
            cancel(); previousPolish = null; error = '';
            if (b.dataset.action === 'clear-expression') { session.state.draft = ''; session.state.selected = []; }
            else if (clue) { if (b.dataset.action === 'remove-clue') session.state.selected = session.state.selected.filter(id=>id!==clue.id);
                else if (!session.state.selected.includes(clue.id)) { session.state.selected.push(clue.id); } }
            session.state.selectedAt = session.current.id;
            persist(); render(); return;
        }
        if (b.dataset.action === 'show-clues') { root.querySelector<HTMLElement>('.dialogue-clues')?.focus(); return; }
        switch (b.dataset.action) {
            case 'retry-save-recovery':if(typeof originalRaw!=='string'){location.reload();return;}protectOriginal();render();break;
            case 'restart-recovered':restartChapter();break;
            case 'settings':case 'configure-ai':settings.openSettings(b.dataset.action==='configure-ai');break;
            case 'save-api':case 'test-api':void settings.saveApiSettings(b.dataset.action==='test-api');break;
            case 'next':next();break;
            case 'polish-expression': void polish(); break;
            case 'undo-polish': if(!request&&canUndoPolish()){session.state.draft=previousPolish!.before;previousPolish=null;error='';persist();render();} break;
            case 'speak':void speak();break;
            case 'cancel-speech':cancel();error='已停止等待，原话已保留。';render();root.querySelector<HTMLTextAreaElement>('#player-expression')?.focus();break;
            case 'revise':closePicker();editing=true;error='';render();break;
            case 'keep':closePicker();editing=false;render();break;
            case 'close-evidence-detail':detail='';render();break;
            case 'close-modal':ui.overlay=recoveryPending?'save-recovery':'';render();break;
            case 'onward':if(session.current.kind==='finish'){ui.overlay='onward';render();}break;
            case 'menu':cancel();persist();location.href='/';break;
            case 'restart':pauseMenu.open();ui.overlay='restart-chapter';render();break;
        }
    });
    const readingAction = () => {
        if(ui.overlay || ui.notesShown || request || root.querySelector('.cinema-screen') || session.current.kind === 'video') return;
        if(session.current.kind === 'open') return !editing && session.state.judgments[session.current.id] ? () => next() : undefined;
        if(session.current.material || ['line','action'].includes(session.current.kind)) return () => next();
    };
    bindDialogueScreenInput(root, readingAction);
    document.addEventListener('keydown', e => {
        if(e.isComposing || e.keyCode === 229) return;
        const focused = e.target as HTMLElement;
        if(ui.overlay && e.key === 'Tab') {
            const controls = Array.from(root.querySelectorAll<HTMLElement>('.game-modal button:not(:disabled),.game-modal input:not(:disabled),.game-modal summary,.game-modal textarea,.game-modal a[href]')).filter(n => n.getClientRects().length);
            const first = controls[0], last = controls.at(-1);
            if(e.shiftKey && focused === first) { e.preventDefault(); last?.focus(); }
            else if(!e.shiftKey && focused === last) { e.preventDefault(); first?.focus(); }
            return;
        }
        if(e.key === 'Escape') { e.preventDefault(); cancel(); ui.overlay = ''; ui.notesShown = false; render(); return; }
        if(focused.closest('input,textarea,button,select,summary,a,[contenteditable]')) return;
        const advance = readingAction();
        if(advance && [' ', 'Enter'].includes(e.key)) { e.preventDefault(); if(!e.repeat) advance(); }
    });
    persist();render();

}
start().catch(e=>{root.innerHTML=`<main class="game-scene"><section class="dialogue-box"><p>${esc(e.message??e)}</p><a href="/">返回开始页</a></section></main>`;});
