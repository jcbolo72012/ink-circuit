/* POST /api/error
 *
 * Somewhere to send a client-side crash. Deliberately the smallest thing that
 * works: it writes to stdout, which Vercel captures as function logs, so there
 * is no third-party account, no SDK, and nothing to keep paid up. If the
 * volume ever justifies real error tracking, swap the console call for a
 * Sentry POST and nothing else changes.
 *
 * Never trust anything in here — it is unauthenticated and comes from a
 * browser. Everything is length-capped before it reaches the log.
 */

const MAX = { message: 500, stack: 4000, url: 300, agent: 300 };
const clip = (v, n) => typeof v === 'string' ? v.slice(0, n) : undefined;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'expected a JSON body' });
  }

  const entry = {
    at: new Date().toISOString(),
    kind: clip(body.kind, 40) || 'error',
    message: clip(body.message, MAX.message) || '(no message)',
    stack: clip(body.stack, MAX.stack),
    url: clip(body.url, MAX.url),
    line: Number.isFinite(body.line) ? body.line : undefined,
    col: Number.isFinite(body.col) ? body.col : undefined,
    day: Number.isFinite(body.day) ? body.day : undefined,
    sim: Number.isFinite(body.sim) ? body.sim : undefined,
    build: clip(body.build, 40),
    /* Enough to reproduce, and nothing that identifies anyone. */
    agent: clip(req.headers['user-agent'], MAX.agent),
    viewport: clip(body.viewport, 20),
    input: clip(body.input, 20)
  };

  // one line per error, so `vercel logs` and the dashboard stay greppable
  console.error('[client-error] ' + JSON.stringify(entry));

  /* 204: the browser has nothing useful to do with a response, and a body
     would only encourage retry loops on a page that is already broken. */
  return res.status(204).end();
}
