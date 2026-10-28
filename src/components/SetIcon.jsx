import { setIconPath } from '../lib/sets.js';

export default function SetIcon({ name, size }) {
  const src = setIconPath(name);
  return src ? <img className="tier seticon" src={src} width={size} height={size} loading="lazy" decoding="async" alt={name} title={name} /> : null;
}
