(() => {
  const loadedVersion = document.currentScript.dataset.version;
  let panel;
  async function check() {
    try {
      const response = await fetch('/__local/status', { cache: 'no-store', signal: AbortSignal.timeout(2500) });
      const status = await response.json();
      if (status.current?.id && status.current.id !== loadedVersion && !panel) {
        panel = document.createElement('aside');
        panel.setAttribute('aria-label', '游戏版本更新');
        panel.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:100000;max-width:calc(100vw - 40px)';
        const shadow = panel.attachShadow({ mode: 'open' });
        shadow.innerHTML = `<style>:host{font:14px/1.7 "Microsoft YaHei",sans-serif;color:#f4ecda}section{background:#243e39;border:1px solid #9e986d;border-radius:12px;padding:16px 20px;box-shadow:0 8px 28px #0004}p{margin:0 0 12px}button,a{font:inherit;color:inherit;cursor:pointer}button{background:#a24232;border:1px solid #da9e73;padding:5px 12px;border-radius:5px}a{margin-left:16px}</style><section role="status"><p>游戏已更新。可先完成当前操作，再刷新进入新版。</p><button type="button">刷新到新版</button><a href="/local/" target="_blank" rel="noopener">查看版本</a></section>`;
        shadow.querySelector('button').addEventListener('click', () => location.reload());
        document.body.append(panel);
      }
    } catch { /* A stopped local service must not interrupt play or modify saves. */ }
    setTimeout(check, 5000);
  }
  setTimeout(check, 5000);
})();
