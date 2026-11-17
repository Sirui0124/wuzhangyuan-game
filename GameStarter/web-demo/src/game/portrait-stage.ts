/** Shared still-image framing. Scene/pair compositions must be deliberately authored. */
export type PortraitComposition = 'conversation' | 'center' | 'scene';
export function portraitStage(image: string, composition: PortraitComposition = 'conversation') {
    return image ? `<div class="portrait-stage" data-composition="${composition}">${image}</div>` : '';
}
