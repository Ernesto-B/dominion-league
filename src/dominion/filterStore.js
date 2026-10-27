/* Filter state outlives the page component, like the Games filters do: opening a card and pressing Back returns
   to the same filtered list instead of an empty search. Other pages can also PRESET a filter before linking to a
   browser (e.g. clicking a mechanic on a card, or an expansion bar on the Overview). */
import { DEFAULT_CARD_FILTERS, DEFAULT_LANDSCAPE_FILTERS } from './filters.js';

let cards = { ...DEFAULT_CARD_FILTERS };
let landscapes = { ...DEFAULT_LANDSCAPE_FILTERS };

export const getCardFilters = () => cards;
export const setCardFilters = f => { cards = f; };
export const presetCardFilters = patch => { cards = { ...DEFAULT_CARD_FILTERS, ...patch }; };
export const getLandscapeFilters = () => landscapes;
export const setLandscapeFilters = f => { landscapes = f; };
export const presetLandscapeFilters = patch => { landscapes = { ...DEFAULT_LANDSCAPE_FILTERS, ...patch }; };
