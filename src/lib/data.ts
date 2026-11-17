import "server-only";
import { cache } from "react";
import { getPublished } from "./store";
import { getUsdIdr } from "./fx";
import { runChecks } from "./checks";
import { hbaStats } from "./analytics";

/** Everything the public pages need, loaded once per request. */
export const getSiteData = cache(async () => {
  const [board, fx] = await Promise.all([getPublished(), getUsdIdr()]);
  return { board, fx, checks: runChecks(board), stats: hbaStats(board.hba) };
});
