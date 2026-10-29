import TierIcon from './TierIcon.jsx';
import SetIcon from './SetIcon.jsx';

// The picture on a badge: the expansion's own icon, the Elo tier's icon, or a star (hollow until earned). Never an invented icon.
export const badgeIcon = (b, size = 26) => b.set ? <SetIcon name={b.set} size={size} /> : b.tierIcon ? <TierIcon id={b.tierIcon.icon} size={size} alt="" /> : b.id === 'champion' ? <TierIcon id="champion" size={size} alt="" /> : b.earned ? '★' : '☆';
