import type { Workout } from './types';
import { EMPTY_LIBRARY } from './library';
import {
  ALIASES_DOC,
  LIBRARY_DOC,
  SYNC_URL,
  enqueue,
  mergeRemote,
  ping,
  pullDocs,
  pushOutbox,
  workoutDoc,
} from './syncLogic';

function wk(id: string, completedAtMs: number, title = 'W'): Workout {
  return { id, day: '', title, dateLabel: '', completedAtMs, exercises: [] };
}

type Call = { url: string; init: RequestInit };

function fakeFetch(
  respond: (call: Call, n: number) => { status: number; body?: unknown } | 'offline',
) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    const r = respond(call, calls.length);
    if (r === 'offline') throw new TypeError('Failed to fetch');
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      json: async () => r.body ?? {},
    } as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const sentDocs = (c: Call) =>
  (JSON.parse(c.init.body as string) as { docs: { kind: string; id: string }[] })
    .docs;

describe('enqueue', () => {
  test('dedupes and keeps order', () => {
    expect(enqueue(['a', 'b'], ['b', 'c', 'a', 'd'])).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });
});

describe('pushOutbox', () => {
  const history = [wk('h2', 2), wk('h1', 1)];

  test('sends bearer auth and the workout + alias bodies', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200, body: { ok: true } }));
    const r = await pushOutbox(
      'tok',
      [workoutDoc('h1'), ALIASES_DOC],
      history,
      { 'A|': 'B|' },
      EMPTY_LIBRARY,
      fn,
      99,
    );
    expect(r).toEqual({ sent: [workoutDoc('h1'), ALIASES_DOC] });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${SYNC_URL}/v1/docs`);
    expect(calls[0].init.method).toBe('PUT');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok',
    );
    const docs = JSON.parse(calls[0].init.body as string).docs;
    expect(docs[0]).toMatchObject({ kind: 'workout', id: 'h1', updatedAt: 99 });
    expect(JSON.parse(docs[0].body).id).toBe('h1');
    expect(docs[1]).toMatchObject({ kind: 'aliases', id: 'main' });
    expect(JSON.parse(docs[1].body)).toEqual({ 'A|': 'B|' });
  });

  test('sends the library edits as library:main', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200 }));
    const library = { entries: { 'A|': { group: 'LEGS' as const } }, distinct: ['A|~B|'] };
    const r = await pushOutbox('tok', [LIBRARY_DOC], history, {}, library, fn, 7);
    expect(r).toEqual({ sent: [LIBRARY_DOC] });
    const [doc] = sentDocs(calls[0]) as { kind: string; id: string; body?: string }[];
    expect(doc).toMatchObject({ kind: 'library', id: 'main' });
    expect(JSON.parse(doc.body as string)).toEqual(library);
  });

  test('batches 50 docs per request', async () => {
    const many = Array.from({ length: 120 }, (_, i) => wk(`h${i}`, i));
    const { fn, calls } = fakeFetch(() => ({ status: 200 }));
    const r = await pushOutbox(
      'tok',
      many.map(w => workoutDoc(w.id!)),
      many,
      {},
      EMPTY_LIBRARY,
      fn,
    );
    expect(r.sent).toHaveLength(120);
    expect(calls.map(c => sentDocs(c).length)).toEqual([50, 50, 20]);
  });

  test('a 401 is an auth error with nothing sent', async () => {
    const { fn } = fakeFetch(() => ({ status: 401 }));
    expect(
      await pushOutbox('bad', [workoutDoc('h1')], history, {}, EMPTY_LIBRARY, fn),
    ).toEqual({ sent: [], error: 'auth' });
  });

  test('offline is a network error and never throws', async () => {
    const { fn } = fakeFetch(() => 'offline');
    expect(
      await pushOutbox('tok', [workoutDoc('h1')], history, {}, EMPTY_LIBRARY, fn),
    ).toEqual({ sent: [], error: 'network' });
  });

  test('a mid-run failure keeps the remaining keys queued', async () => {
    const many = Array.from({ length: 60 }, (_, i) => wk(`h${i}`, i));
    const { fn } = fakeFetch((_, n) => (n === 1 ? { status: 200 } : { status: 500 }));
    const r = await pushOutbox(
      'tok',
      many.map(w => workoutDoc(w.id!)),
      many,
      {},
      EMPTY_LIBRARY,
      fn,
    );
    expect(r.sent).toHaveLength(50);
    expect(r.error).toBe('server');
  });

  test('keys for workouts that no longer exist count as sent without a request', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200 }));
    const r = await pushOutbox('tok', [workoutDoc('gone')], history, {}, EMPTY_LIBRARY, fn);
    expect(r).toEqual({ sent: [workoutDoc('gone')] });
    expect(calls).toHaveLength(0);
  });
});

describe('ping / pullDocs', () => {
  test('ping maps status to an error or null', async () => {
    expect(await ping('t', fakeFetch(() => ({ status: 200 })).fn)).toBeNull();
    expect(await ping('t', fakeFetch(() => ({ status: 401 })).fn)).toBe('auth');
    expect(await ping('t', fakeFetch(() => 'offline').fn)).toBe('network');
  });

  test('pullDocs parses workouts and aliases, skipping unreadable docs', async () => {
    const { fn } = fakeFetch(() => ({
      status: 200,
      body: {
        docs: [
          { kind: 'workout', id: 'h1', body: JSON.stringify(wk('h1', 1)), updatedAt: 1 },
          { kind: 'workout', id: 'bad', body: '{nope', updatedAt: 1 },
          { kind: 'aliases', id: 'main', body: '{"A|":"B|"}', updatedAt: 1 },
          {
            kind: 'library',
            id: 'main',
            body: '{"entries":{"A|":{"notes":"x"}},"distinct":[]}',
            updatedAt: 1,
          },
        ],
      },
    }));
    const r = await pullDocs('t', fn);
    expect(r).toEqual({
      workouts: [wk('h1', 1)],
      aliases: { 'A|': 'B|' },
      library: { entries: { 'A|': { notes: 'x' } }, distinct: [] },
    });
  });
});

describe('mergeRemote', () => {
  test('unions by id, local wins, newest first, no duplicates', () => {
    const local = [wk('h3', 3, 'LOCAL'), wk('h1', 1)];
    const remote = [wk('h3', 3, 'REMOTE'), wk('h2', 2), wk('h2', 2)];
    const r = mergeRemote(
      { history: local, aliases: {}, library: EMPTY_LIBRARY },
      { workouts: remote, aliases: null, library: null },
    );
    expect(r.history.map(w => [w.id, w.title])).toEqual([
      ['h3', 'LOCAL'],
      ['h2', 'W'],
      ['h1', 'W'],
    ]);
    expect(r.added).toBe(1);
  });

  test('is order-independent for the remote list', () => {
    const local = { history: [wk('h1', 1)], aliases: {}, library: EMPTY_LIBRARY };
    const a = mergeRemote(local, { workouts: [wk('h2', 2), wk('h3', 3)], aliases: null, library: null });
    const b = mergeRemote(local, { workouts: [wk('h3', 3), wk('h2', 2)], aliases: null, library: null });
    expect(a.history).toEqual(b.history);
  });

  test('aliases union with local entries winning', () => {
    const r = mergeRemote(
      { history: [], aliases: { 'A|': 'LOCAL|' }, library: EMPTY_LIBRARY },
      { workouts: [], aliases: { 'A|': 'REMOTE|', 'B|': 'C|' }, library: null },
    );
    expect(r.aliases).toEqual({ 'A|': 'LOCAL|', 'B|': 'C|' });
  });

  test('library entries union with local winning; distinct pairs union', () => {
    const r = mergeRemote(
      {
        history: [],
        aliases: {},
        library: { entries: { 'A|': { notes: 'local' } }, distinct: ['A|~B|'] },
      },
      {
        workouts: [],
        aliases: null,
        library: {
          entries: { 'A|': { notes: 'remote' }, 'C|': { group: 'ARMS' } },
          distinct: ['A|~B|', 'C|~D|'],
        },
      },
    );
    expect(r.library).toEqual({
      entries: { 'A|': { notes: 'local' }, 'C|': { group: 'ARMS' } },
      distinct: ['A|~B|', 'C|~D|'],
    });
  });
});
