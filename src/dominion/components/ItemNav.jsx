/* The strip at the top of a card/landscape page: back to the list (filters kept), Previous/Next through that same list,
   and a Random pick from it. `nav` is neighbors() of the list the viewer came from. */
export default function ItemNav({ backHref, backLabel, nav, hrefFor, onRandom, randomLabel }) {
  const step = (item, label, rel) => (item
    ? <a href={hrefFor(item)} rel={rel} title={item.name}>{label}</a>
    : <span className="meta dn-itemnav-off" aria-disabled="true">{label}</span>);
  return (
    <div className="dn-itemnav">
      <a href={backHref}>{backLabel}</a>
      <span className="dn-itemnav-steps">
        {step(nav.prev, '← Previous', 'prev')}
        <span className="meta">{nav.index + 1} of {nav.total}</span>
        {step(nav.next, 'Next →', 'next')}
        <button type="button" className="ghost" onClick={onRandom}>{randomLabel}</button>
      </span>
    </div>
  );
}
