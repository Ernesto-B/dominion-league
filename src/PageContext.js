import { createContext, useContext } from 'react';

/* What a page needs, provided by App while a league is loaded:
   D (scoped model), gid, arg, allGroups, me, cfg, enabledSets, rawPlayers, rawSeasons,
   playerIdByName, seasonDbIds, reload(), and hashFor(route, gid, rest). */
export const PageContext = createContext(null);
export const usePage = () => useContext(PageContext);
