/* A horizontal bar list: label · proportional bar · number. Plain HTML/CSS, so it needs no chart library, scales to
   any width, and the numbers are real text (screen readers read them; the bar itself is decorative). Pass `href`
   on an item to make its label a link. All bars share one scale (`max`, default the largest value). `labelWidth` sets the
   label column's width (e.g. '100px') for charts whose labels are small icons, so the bars don't start far from them. */
export default function BarChart({ items, label, max, labelWidth, format = n => n.toLocaleString() }) {
  const top = max ?? Math.max(1, ...items.map(i => i.value));
  return (
    <ol className="dn-bars" aria-label={label} style={labelWidth ? { '--dn-bar-label': labelWidth } : undefined}>
      {items.map(i => (
        <li key={i.key ?? i.label}>
          <span className="dn-bar-label">{i.icon}{i.href ? <a href={i.href} onClick={i.onClick}>{i.label}</a> : i.label}</span>
          <span className="dn-bar-track" aria-hidden="true"><span style={{ width: `${Math.max(i.value ? 2 : 0, (i.value / top) * 100)}%` }} /></span>
          <span className="dn-bar-value">{format(i.value)}</span>
        </li>
      ))}
    </ol>
  );
}
