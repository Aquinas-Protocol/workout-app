// Cloud sync with the workout-sync Worker (server/). The outbox holds doc
// keys only; bodies are read from history when it flushes, so nothing is
// stored twice. Pure apart from the injected fetch. Tested in
// src/syncLogic.test.ts.

import type { Workout } from './types';
import type { Aliases } from './records';

export const SYNC_URL = 'https://workout-sync.machina-infastructure.workers.dev';

export type SyncError = 'auth' | 'network' | 'server';
type Fetch = typeof fetch;

export const ALIASES_DOC = 'aliases:main';

export function workoutDoc(historyId: string): string {
  return `workout:${historyId}`;
}

/** Append keys not already queued, keeping order. */
export function enqueue(outbox: string[], keys: string[]): string[] {
  const out = [...outbox];
  const seen = new Set(out);
  for (const k of keys) {
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

type WireDoc = { kind: string; id: string; body: string; updatedAt: number };

async function call(
  token: string,
  method: 'GET' | 'PUT',
  path: string,
  fetchFn: Fetch,
  body?: unknown,
): Promise<{ data: unknown } | { error: SyncError }> {
  let res: Response;
  try {
    res = await fetchFn(`${SYNC_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { error: 'network' };
  }
  if (res.status === 401) return { error: 'auth' };
  if (!res.ok) return { error: 'server' };
  try {
    return { data: await res.json() };
  } catch {
    return { error: 'server' };
  }
}

export async function ping(
  token: string,
  fetchFn: Fetch,
): Promise<SyncError | null> {
  const r = await call(token, 'GET', '/v1/ping', fetchFn);
  return 'error' in r ? r.error : null;
}

const BATCH = 50;

/**
 * Upload queued docs in batches, stopping at the first failure. Never
 * throws. Keys whose workout no longer exists count as sent.
 */
export async function pushOutbox(
  token: string,
  outbox: string[],
  history: Workout[],
  aliases: Aliases,
  fetchFn: Fetch,
  nowMs: number = Date.now(),
): Promise<{ sent: string[]; error?: SyncError }> {
  const byId = new Map(history.map(w => [w.id, w]));
  const sent: string[] = [];
  for (let i = 0; i < outbox.length; i += BATCH) {
    const keys = outbox.slice(i, i + BATCH);
    const docs: WireDoc[] = [];
    for (const k of keys) {
      if (k === ALIASES_DOC) {
        docs.push({
          kind: 'aliases',
          id: 'main',
          body: JSON.stringify(aliases),
          updatedAt: nowMs,
        });
      } else if (k.startsWith('workout:')) {
        const w = byId.get(k.slice('workout:'.length));
        if (w && w.id) {
          docs.push({
            kind: 'workout',
            id: w.id,
            body: JSON.stringify(w),
            updatedAt: nowMs,
          });
        }
      }
    }
    if (docs.length > 0) {
      const r = await call(token, 'PUT', '/v1/docs', fetchFn, { docs });
      if ('error' in r) return { sent, error: r.error };
    }
    sent.push(...keys);
  }
  return { sent };
}

export async function pullDocs(
  token: string,
  fetchFn: Fetch,
): Promise<
  { workouts: Workout[]; aliases: Aliases | null } | { error: SyncError }
> {
  const r = await call(token, 'GET', '/v1/docs', fetchFn);
  if ('error' in r) return r;
  const docs = ((r.data as { docs?: WireDoc[] }).docs ?? []) as WireDoc[];
  const workouts: Workout[] = [];
  let aliases: Aliases | null = null;
  for (const d of docs) {
    try {
      if (d.kind === 'workout') workouts.push(JSON.parse(d.body) as Workout);
      else if (d.kind === 'aliases') aliases = JSON.parse(d.body) as Aliases;
    } catch {
      // skip an unreadable doc rather than failing the restore
    }
  }
  return { workouts, aliases };
}

/**
 * Union remote into local by workout id (local copies win), newest first.
 * Aliases union too, local entries winning.
 */
export function mergeRemote(
  local: { history: Workout[]; aliases: Aliases },
  remote: { workouts: Workout[]; aliases: Aliases | null },
): { history: Workout[]; aliases: Aliases; added: number } {
  const ids = new Set(local.history.map(w => w.id));
  const extra = new Map<string, Workout>();
  for (const w of remote.workouts) {
    if (w.id && !ids.has(w.id) && !extra.has(w.id)) extra.set(w.id, w);
  }
  const history = [...local.history, ...extra.values()].sort(
    (a, b) => (b.completedAtMs ?? 0) - (a.completedAtMs ?? 0),
  );
  return {
    history,
    aliases: { ...(remote.aliases ?? {}), ...local.aliases },
    added: extra.size,
  };
}
