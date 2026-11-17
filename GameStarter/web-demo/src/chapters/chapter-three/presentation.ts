import type { JietingScene } from './types';
import type { Media } from '../../game/view-common';

export const sceneNames: Record<JietingScene, string> = {
    jieting_camp: '帐前', jieting_masu_tent: '山上 · 马谡军帐',
    jieting_wangping_camp: '山下 · 王平营地', jieting_water_path: '侧路 · 取水道',
    jieting_mountain_path: '下山道 · 坡脚', jieting_evening_camp: '战后营地',
    jieting_battlefield: '山下关道', jieting_lure_camp: '山上营寨',
};
export const speakerPortrait: Record<string, string> = {
    '马谡': 'masu', '王平': 'wangping', '军吏': 'jieting-clerk',
    '探马': 'jieting-scout', '取水军士': 'jieting-water', '搬营军士': 'jieting-mover',
    '传令军士': 'jieting-messenger', '王平的传令军士': 'jieting-messenger',
    '带队军士': 'jieting-leader', '领队军士': 'jieting-leader', '押队军士': 'jieting-leader',
    // Unidentified voices do not borrow a named soldier's or a general's face.
    '军士': '', '亲兵': '', '伤兵': '',
};
export function sceneImage(media: Media, scene: JietingScene) {
    return media.scenes[scene] ?? media.scenes.jieting_camp ?? media.scenes.camp_gate;
}
