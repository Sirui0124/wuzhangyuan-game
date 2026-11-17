/** A player must explicitly adopt an ended run; no formal save is read or changed here. */
export function handoffResult(result: {phase:string}) {
    if(result.phase!=='ended')throw new Error('请先结束这一夜的营救。');
    const origin=`${location.protocol}//${location.hostname}:8812`,nonce=crypto.randomUUID();
    const child=window.open(`${origin}/chapter-result-import.html#nonce=${nonce}`,'_blank');
    if(!child)throw new Error('请允许打开结果接收页后重试。');
    const listener=(event:MessageEvent)=>{
        if(event.source!==child||event.origin!==origin||event.data?.nonce!==nonce)return;
        if(event.data.type==='wzy-rescue-ready')child.postMessage({type:'wzy-rescue-result',nonce,result},origin);
        if(event.data.type==='wzy-rescue-adopted')window.removeEventListener('message',listener);
    };
    window.addEventListener('message',listener);
    setTimeout(()=>window.removeEventListener('message',listener),60000);
}
