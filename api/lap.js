/* POST /api/lap — accept a lap, but only if the sim agrees with it.
 *
 * This imports the same sim.js the browser does. That's the whole point: the
 * server recomputes the lap from the input stream and ignores whatever the
 * client claimed. There is no second copy of the physics to drift.
 *
 * Persistence is left as a TODO — wire it to Neon or Supabase. Everything
 * above that line already works.
 */
import { verifyLap, dayNumber, SIM_VERSION } from '../sim.js';

const MAX_BODY = 64 * 1024;

export default async function handler(req, res){
  if (req.method !== 'POST'){
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  const { day, packed, ticks, hits, playerId } = req.body || {};

  if (typeof packed !== 'string' || packed.length > MAX_BODY)
    return res.status(400).json({ error: 'missing or oversized input stream' });
  if (!Number.isInteger(day))
    return res.status(400).json({ error: 'missing day' });

  /* Only today's and yesterday's puzzles are accepted. Yesterday is allowed
     because a lap finished at 23:59:58 can arrive after midnight. */
  const today = dayNumber();
  if (day !== today && day !== today - 1)
    return res.status(400).json({ error: 'that circuit is closed' });

  const result = verifyLap({ day, packed, claimedTicks: ticks, claimedHits: hits });
  if (!result.ok)
    return res.status(422).json({ error: 'lap rejected', reason: result.reason });

  /* TODO: persist. Suggested shape:
   *
   *   INSERT INTO laps
   *     (day, sim_version, player_id, ticks, hits, sectors, inputs, created_at)
   *   VALUES (...)
   *   ON CONFLICT (player_id, day, sim_version) DO NOTHING
   *
   * The unique constraint is what makes one-attempt-a-day real rather than
   * an honour system in localStorage. The `inputs` column is the ghost, the
   * replay and the behavioural-cloning dataset all at once — never drop it
   * and keep only the time.
   */

  return res.status(200).json({
    ok: true,
    sim: SIM_VERSION,
    day,
    ticks: result.ticks,
    ms: result.ms,
    hits: result.hits,
    sectors: result.sectorHits
  });
}
