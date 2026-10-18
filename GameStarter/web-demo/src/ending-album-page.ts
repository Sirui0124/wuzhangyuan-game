import { ENDINGS_KEY, freshCollection, parseCollection, type EndingCatalog } from './endings';
import { openEndingAlbum } from './ending-album';

const landing = document.querySelector<HTMLElement>('#album-loading')!;
try {
    const response = await fetch('/story/endings.json');
    if (!response.ok) throw new Error('Missing catalog');
    const catalog: EndingCatalog = await response.json();
    let collection = freshCollection(), warning = '';
    try { collection = parseCollection(localStorage.getItem(ENDINGS_KEY), catalog); }
    catch { warning = '结局记录暂时无法读取，原记录已保留。请返回游戏检查存档。'; }
    landing.hidden = true;
    openEndingAlbum(catalog, collection, {
        warning, initialId: new URLSearchParams(location.search).get('ending') ?? '',
        onClose: () => location.assign('/' + (new URLSearchParams(location.search).get('white') === '1' ? '?white=1' : '')),
    });
} catch {
    landing.innerHTML = '<h1>卡册暂时未能展开</h1><p>结局内容加载失败，收录记录仍保留在本机。</p><button onclick="location.reload()">重新打开</button><a href="/">返回游戏</a>';
}
