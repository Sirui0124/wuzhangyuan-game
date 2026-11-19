(() => {
  const loadedVersion = document.currentScript.dataset.version;
  let panel, dismissed;
  function noticeHost() {
    const frame = document.querySelector('iframe[src*="/yiling-command/"]');
    if (frame) return frame.contentDocument?.querySelector('.desk header');
    return new URLSearchParams(location.search).get('chapter') === 'yiling' ? null : document.body;
  }
  async function check() {
    try {
      const response = await fetch('/__local/status', { cache: 'no-store', signal: AbortSignal.timeout(2500) });
      const status = await response.json();
      const host = noticeHost();
      const nextVersion = status.current?.id;
      if (panel && (panel.parentNode !== host || panel.dataset.version !== nextVersion)) {
        panel.remove();
        panel = null;
      }
      if (host && nextVersion && nextVersion !== loadedVersion && nextVersion !== dismissed && !panel?.isConnected) {
        const inChapter = host !== document.body;
        panel = host.ownerDocument.createElement('aside');
        panel.dataset.version = nextVersion;
        panel.setAttribute('aria-label', '游戏版本更新');
        panel.style.cssText = inChapter ? 'display:block;flex:1 0 100%;min-width:0' : 'position:fixed;right:20px;top:12px;z-index:100000;max-width:calc(100vw - 40px)';
        const shadow = panel.attachShadow({ mode: 'open' });
        shadow.innerHTML = `<style>:host{font:14px/1.7 "Microsoft YaHei",sans-serif;color:#f4ecda}section{background:#243e39;border:1px solid #9e986d;border-radius:12px;padding:16px 20px;box-shadow:0 8px 28px #0004}p{margin:0 0 12px}button,a{font:inherit;color:inherit;cursor:pointer}button{background:#a24232;border:1px solid #da9e73;padding:5px 12px;border-radius:5px}a{margin-left:16px}</style><section role="status"><p>游戏已更新。可先完成当前操作，再刷新进入新版。</p><button type="button">刷新到新版</button><a href="/local/" target="_blank" rel="noopener">查看版本</a> <button type="button" data-dismiss>稍后</button></section>`;
        if (inChapter) {
          const style = host.ownerDocument.createElement('style');
          style.textContent = 'section{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:2px 8px;border:0;border-radius:0;box-shadow:none}p{margin:0}button,a{padding:0 5px;margin:0}';
          shadow.append(style);
        }
        shadow.querySelector('button').addEventListener('click', () => location.reload());
        shadow.querySelector('[data-dismiss]').addEventListener('click', () => { dismissed = nextVersion; panel.remove(); });
        host.append(panel);
      }
    } catch { /* A stopped local service must not interrupt play or modify saves. */ }
    setTimeout(check, 5000);
  }
  setTimeout(check, 5000);
})();
