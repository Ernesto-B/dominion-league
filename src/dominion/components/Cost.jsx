import { costLabel } from '../model.js';

/* Cost icons: the owner's own artwork in public/icons/costs (coin-0..10 + the "+" overpay variants, debt-N).
   Only values that actually have a file get an icon; anything else (a future cost the artwork doesn't cover)
   falls back to plain text instead of a broken image. */
const COINS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const COIN_PLUS = new Set([2, 3, 4]);
const DEBT = new Set([1, 2, 3, 4, 5, 6, 8]);
export const coinIconSrc = (n, plus = false) => (plus ? (COIN_PLUS.has(n) && `icons/costs/coin-${n}plus.png`) : (COINS.has(n) && `icons/costs/coin-${n}.png`)) || null;
export const debtIconSrc = n => (DEBT.has(n) ? `icons/costs/debt-${n}.png` : null);

const Img = ({ src, size }) => <img className="dn-cost-icon" src={src} width={size} height={size} loading="lazy" decoding="async" alt="" />;

export function CoinIcon({ coins, overpay = false, size = 24 }) {
  const src = coinIconSrc(coins, overpay);
  return src ? <Img src={src} size={size} /> : <span className="dn-cost-text">${coins}{overpay ? '+' : ''}</span>;
}
export function DebtIcon({ debt, size = 24 }) {
  const src = debtIconSrc(debt);
  return src ? <Img src={src} size={size} /> : <span className="dn-cost-text">{debt} Debt</span>;
}

// The Debt symbol without a number — for "has a Debt cost" in general (a filter chip, a chart label).
export const PlainDebtIcon = ({ size = 24 }) => <img className="dn-cost-icon" src="icons/costs/debt.png" width={size} height={size} alt="" />;

/* A card's whole cost as icons. A Debt-only card shows just the Debt icon (it has no coin cost); a card with both
   shows coin then Debt. One accessible name for the group ("8 coins and 8 Debt"); the images are decorative. */
export default function CostIcons({ coins, debt = 0, overpay = false, size = 24 }) {
  const label = costLabel({ coins, debt, overpay });
  return (
    <span className="dn-cost" role="img" aria-label={label} title={label}>
      {(coins > 0 || debt === 0) && <CoinIcon coins={coins} overpay={overpay} size={size} />}
      {debt > 0 && <DebtIcon debt={debt} size={size} />}
    </span>
  );
}
