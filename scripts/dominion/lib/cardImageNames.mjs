/* Matching a picture's file name to a catalog name (scripts/dominion/build-card-images.mjs). */
// the same name in the catalog and in a file name: no case, accents, apostrophes or punctuation, `_` is a space
export const normName = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/_/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
export const nameOfFile = f => { const m = /^(?:\d+px-)?(.+?)(?:~[A-Za-z]+(?:~\d{4})?)?\.(jpe?g|png|webp)$/i.exec(f); return m ? m[1] : null; };

export const slugOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
