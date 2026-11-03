// workout-sync: the cloud copy of the Stadium workout app's history.
// A tiny authenticated document store over D1. Each saved workout (and the
// exercise alias map and library edits) is one JSON doc keyed by (kind, id);
// on conflict the newer updatedAt wins.
//
//   GET /v1/ping  → { ok: true }
//   GET /v1/docs  → { docs: [{ kind, id, body, updatedAt }] }
//   PUT /v1/docs  ← { docs: [{ kind, id, body, updatedAt }] } → { ok, count }
//
// Auth: `Authorization: Bearer <SYNC_TOKEN>` (Worker secret). CORS headers go
// on every response, including 401s, so the app can tell a bad token from
// being offline.

interface Env {
  DB: D1Database;
  SYNC_TOKEN: string;
  ALLOWED_ORIGINS: string;
}

type Doc = { kind: string; id: string; body: string; updatedAt: number };

const KINDS = new Set(['workout', 'aliases', 'library']);
const MAX_DOCS = 100;
const MAX_BODY_CHARS = 500_000;

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
  if (!allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(
  data: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function authorized(req: Request, env: Env): Promise<boolean> {
  if (!env.SYNC_TOKEN) return false;
  const enc = new TextEncoder();
  // Hash both sides so the constant-time compare sees equal lengths.
  const [got, want] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(req.headers.get('Authorization') ?? '')),
    crypto.subtle.digest('SHA-256', enc.encode(`Bearer ${env.SYNC_TOKEN}`)),
  ]);
  return crypto.subtle.timingSafeEqual(got, want);
}

function parseDocs(input: unknown): Doc[] | null {
  const docs = (input as { docs?: unknown } | null)?.docs;
  if (!Array.isArray(docs) || docs.length === 0 || docs.length > MAX_DOCS) {
    return null;
  }
  for (const d of docs as Doc[]) {
    if (
      !d ||
      !KINDS.has(d.kind) ||
      typeof d.id !== 'string' ||
      d.id.length === 0 ||
      d.id.length > 100 ||
      typeof d.body !== 'string' ||
      d.body.length > MAX_BODY_CHARS ||
      !Number.isFinite(d.updatedAt)
    ) {
      return null;
    }
  }
  return docs as Doc[];
}

export default {
  async fetch(req, env): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (!(await authorized(req, env))) {
      return json({ error: 'unauthorized' }, 401, cors);
    }

    const { pathname } = new URL(req.url);
    if (req.method === 'GET' && pathname === '/v1/ping') {
      return json({ ok: true }, 200, cors);
    }
    if (req.method === 'GET' && pathname === '/v1/docs') {
      const { results } = await env.DB.prepare(
        'SELECT kind, id, body, updated_at AS updatedAt FROM docs',
      ).all<Doc>();
      return json({ docs: results }, 200, cors);
    }
    if (req.method === 'PUT' && pathname === '/v1/docs') {
      const docs = parseDocs(await req.json().catch(() => null));
      if (!docs) return json({ error: 'bad request' }, 400, cors);
      const upsert = env.DB.prepare(
        `INSERT INTO docs (kind, id, body, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(kind, id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at
         WHERE excluded.updated_at >= docs.updated_at`,
      );
      await env.DB.batch(
        docs.map(d => upsert.bind(d.kind, d.id, d.body, d.updatedAt)),
      );
      return json({ ok: true, count: docs.length }, 200, cors);
    }
    return json({ error: 'not found' }, 404, cors);
  },
} satisfies ExportedHandler<Env>;
