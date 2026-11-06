import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import { generate, seededRng, BALANCE_LIMIT, specialistRoles } from '../../src/dominion/randomizer.js';

const catalog = realCatalog();
const rolls = (o, n = 150) => Array.from({ length: n }, (_, i) => generate(catalog, o, { rng: seededRng(i + 1) }));
const worst = (rs, role) => Math.max(...rs.map(r => r.slots.filter(s => specialistRoles(catalog, s).includes(role)).length));

describe('Balance: no two cards with the same single job', () => {
  it('holds each role to its limit in every roll, where an ordinary roll goes over', () => {
    const plain = rolls({ balance: false }), bal = rolls({});
    expect(bal.every(r => r.ok)).toBe(true);
    for (const [role, n] of Object.entries(BALANCE_LIMIT)) expect(worst(bal, role)).toBeLessThanOrEqual(n);
    expect(Object.entries(BALANCE_LIMIT).some(([role, n]) => worst(plain, role) > n)).toBe(true);   // otherwise the option would prove nothing
  });
});
