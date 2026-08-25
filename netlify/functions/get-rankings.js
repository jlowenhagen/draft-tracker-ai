/**
 * get-rankings.js
 * ----------------
 * Fetches live, current ADP (Average Draft Position) data from
 * FantasyFootballCalculator's public REST API — free for personal and
 * commercial use, no key required. Docs:
 * https://help.fantasyfootballcalculator.com/article/42-adp-rest-api
 *
 * WHY THIS LIVES IN A SERVERLESS FUNCTION AND NOT THE BROWSER:
 * Browsers block many cross-origin requests unless the target server
 * explicitly allows it (CORS). Calling this from our own backend sidesteps
 * that entirely, and also gives us one place to reshape their data into
 * the exact format our frontend already expects.
 *
 * WHY WE STILL KEEP A STATIC FALLBACK LIST IN THE FRONTEND:
 * This function depends on a third-party API being up. That's a fine bet
 * on a random Tuesday, but on draft day itself, "the whole app is unusable
 * because someone else's server hiccupped" is not an acceptable failure
 * mode. So the frontend tries this endpoint first, and silently falls back
 * to its embedded list if this fails for any reason. Fresh data when
 * possible, guaranteed data always.
 */

// Bye weeks aren't part of FFC's ADP response, so we fill them in from a
// small static lookup. Bye weeks are set months in advance by the NFL
// schedule and don't change, so this table doesn't go stale during a season
// the way player rankings do.
const TEAM_BYES = {
  ARI:14, ATL:11, BAL:13, BUF:7, CAR:5, CHI:10, CIN:6, CLE:11, DAL:14, DEN:10,
  DET:6, GB:11, HOU:8, IND:13, JAX:7, KC:5, LAC:7, LAR:11, LV:13, MIA:6,
  MIN:6, NE:11, NO:8, NYG:8, NYJ:13, PHI:10, PIT:9, SEA:11, SF:8, TB:10,
  TEN:9, WAS:7,
};

exports.handler = async function () {
  try {
    const res = await fetch(
      "https://fantasyfootballcalculator.com/api/v1/adp/ppr?teams=12&year=2026"
    );

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: "FFC API returned an error" }) };
    }

    const data = await res.json();
    const players = (data.players || [])
      .map((p, i) => ({
        rank: i + 1,
        name: p.name,
        pos: p.position,
        team: p.team,
        bye: TEAM_BYES[p.team] || null,
      }))
      // FFC's list is already sorted by ADP, but slicing keeps the payload
      // small and matches what the frontend actually displays.
      .slice(0, 250);

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ players, fetchedAt: new Date().toISOString() }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
