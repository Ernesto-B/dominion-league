import { Fragment } from 'react';

export default function LandscapePills({ game }) {
  const l = game.landscapes || [];
  return l.map((x, i) => <Fragment key={x}>{i > 0 && ' '}<span className="pill">{x}</span></Fragment>);
}
