import * as Eng from '../lib/engine.js';
import { short } from '../lib/format.js';

export default function DateAnchor({ day, label }) {
  const iso = Eng.fmtDay(day);
  return <div className="tieranchor"><b title={iso}>{short(iso)}</b><span>{label}</span></div>;
}
