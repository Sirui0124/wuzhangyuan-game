import type { GrainSession } from './session';
import { isAvailableSupply } from '../../phone/supplies';
/** Legacy save/item regression support; no live phone entry. */
export function toggleGrainItem(session: GrainSession, id: string) {
    if (!session.phoneAllowed || session.current.kind !== 'open' || session.eraFailure || session.state.end || !isAvailableSupply(id, session.state.supplies)) return;
    const s = session.state.supplies;
    if (s.attached.includes(id)) s.attached = s.attached.filter(i => i !== id);
    else if (s.attached.length < 2) s.attached.push(id);
}
