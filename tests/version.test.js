import { describe, expect, it } from 'vitest';
import { entryOf, isNewer } from '../src/lib/version.js';

const page = name => `<html><head><script type="module" crossorigin src="./assets/${name}"></script><link rel="modulepreload" href="./assets/react-AbC123.js"></head></html>`;

describe('knowing when a newer build is live', () => {
  it('reads the entry script from a page', () => {
    expect(entryOf(page('index-DfG45_x.js'))).toBe('assets/index-DfG45_x.js');
    expect(entryOf('<html></html>')).toBeNull();
    expect(entryOf(null)).toBeNull();
  });
  it('is newer only when both are known and differ', () => {
    expect(isNewer('assets/index-aaa.js', page('index-bbb.js'))).toBe(true);
    expect(isNewer('assets/index-aaa.js', page('index-aaa.js'))).toBe(false);
    expect(isNewer(null, page('index-bbb.js'))).toBe(false);           // dev: nothing is hashed
    expect(isNewer('assets/index-aaa.js', '<html>offline page</html>')).toBe(false);
  });
});

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import UpdateBar from '../src/components/UpdateBar.jsx';
describe('the update notice', () => {
  it('renders nothing until a newer build is found', () => {
    expect(renderToString(createElement(UpdateBar))).toBe('');
  });
});
