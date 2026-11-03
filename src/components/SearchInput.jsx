// A search box with an × on its right edge that clears it (and keeps focus in the box).
// `onChange` gets the new text, not the event.
export default function SearchInput({ value, onChange, onKeyDown, ...rest }) {
  return (
    <span className="sbox">
      <input type="search" value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} {...rest} />
      {value ? <button type="button" className="sbox-x" aria-label="Clear search" title="Clear"
        onMouseDown={e => e.preventDefault()}
        onClick={e => { onChange(''); const i = e.currentTarget.parentNode.querySelector('input'); if (i) i.focus(); }}>×</button> : null}
    </span>
  );
}
