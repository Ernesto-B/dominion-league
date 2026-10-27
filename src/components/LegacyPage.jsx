import { useLayoutEffect, useRef } from 'react';
import { renderLegacyPage } from '../legacy/pages.js';

// React renders an empty <main> and never gives it children, so it leaves the
// DOM inside alone; the legacy renderer owns that subtree until each page is ported.
export default function LegacyPage({ league, boot, route }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    renderLegacyPage(ref.current, { ...league, ...route, reload: boot });
  }, [league, route.route, route.gid, route.arg, boot]);
  return <main id="main" tabIndex={-1} ref={ref} />;
}
