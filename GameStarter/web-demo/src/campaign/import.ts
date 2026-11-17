import { publishChapterResult, RESULT_KEY } from './results';
import { adoptedYilingResult, YILING_BASE_KEY } from './yiling-result';

const status = document.querySelector<HTMLElement>('#status')!;
const nonce = new URLSearchParams(location.hash.slice(1)).get('nonce');
const origin = `${location.protocol}//${location.hostname}:8828`;
let received = false;
if (!window.opener || !nonce || !/^[\da-f-]{36}$/i.test(nonce)) status.textContent='请在夷陵营救的结局页选择“采用这次营救结果”。';
else {
    window.addEventListener('message', event=>{
        if (received || event.source!==window.opener || event.origin!==origin || event.data?.type!=='wzy-rescue-result' || event.data.nonce!==nonce) return;
        received = true;
        const ledgerBefore=localStorage.getItem(RESULT_KEY), baselineBefore=localStorage.getItem(YILING_BASE_KEY);
        try {
            const result=adoptedYilingResult(event.data.result);
            localStorage.setItem(YILING_BASE_KEY,JSON.stringify(localStorage.getItem('yiling-chapter-four-v1')));
            publishChapterResult(result);
            status.textContent=`已采用本轮结果：${result.people.filter(p=>p.fate==='saved').length}条路线脱险。第七章下次从章首开始时会读取；当前第七章存档仍保留原来的经历。`;
            document.querySelector<HTMLElement>('#links')!.hidden=false;
            window.opener.postMessage({type:'wzy-rescue-adopted',nonce},origin);
        } catch (e) {
            try { if(ledgerBefore===null)localStorage.removeItem(RESULT_KEY);else localStorage.setItem(RESULT_KEY,ledgerBefore);if(baselineBefore===null)localStorage.removeItem(YILING_BASE_KEY);else localStorage.setItem(YILING_BASE_KEY,baselineBefore); } catch { /* Original formal save is never modified. */ }
            status.textContent=e instanceof Error?e.message:'结果未能写入，请重试。';
        }
    });
    window.opener.postMessage({type:'wzy-rescue-ready',nonce},origin);
    setTimeout(()=>{if(!received)status.textContent='尚未收到营救结果，请回到夷陵结局页重新点击。';},30000);
}
