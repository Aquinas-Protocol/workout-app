import type { Exercise, Workout, WorkoutSet } from './types';
import {
  annotateSession,
  exerciseKey,
  fmtLastTime,
  fmtRecord,
  fmtSet,
  headline,
  indexHistory,
  keyLabel,
  mergeAlias,
  recordToBeat,
  repMaxBoard,
  resolveKey,
  unmergeAlias,
} from './records';

const DAY = 86400000;

function set(reps: number, weight: number, extra: Partial<WorkoutSet> = {}) {
  return { reps, weight, done: true, ...extra } as WorkoutSet;
}

function ex(
  name: string,
  sets: WorkoutSet[],
  extra: Partial<Exercise> = {},
): Exercise {
  return {
    id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
    name,
    targetSets: sets.length,
    targetReps: 5,
    sets,
    ...extra,
  };
}

function wk(completedAtMs: number, exercises: Exercise[]): Workout {
  return { day: '', title: 'W', dateLabel: '', exercises, completedAtMs };
}

const prFlags = (w: Workout, i = 0) => w.exercises[i].sets.map(s => !!s.pr);

const stackDown = () =>
  ex(
    'DEADLIFT',
    [set(5, 205), set(4, 215), set(3, 225), set(2, 235), set(1, 240)],
    { repScheme: [5, 4, 3, 2, 1] },
  );

describe('exerciseKey', () => {
  test('normalizes case, punctuation and a trailing plural', () => {
    expect(exerciseKey('PULL-UPS')).toBe(exerciseKey('Pull Ups'));
    expect(exerciseKey('pull up')).toBe(exerciseKey('PULL UP'));
    expect(exerciseKey('CRUNCHES')).toBe(exerciseKey('CRUNCH'));
    expect(exerciseKey('BENCH PRESSES')).toBe(exerciseKey('BENCH PRESS'));
  });

  test('keeps BENCH PRESS intact and the modifier distinct', () => {
    expect(exerciseKey('BENCH PRESS')).toBe('BENCH PRESS|');
    expect(exerciseKey('BENCH PRESS', 'DB')).not.toBe(
      exerciseKey('BENCH PRESS'),
    );
    expect(exerciseKey('PULL UP', 'weighted')).toBe('PULL UP|WEIGHTED');
  });

  test('resolveKey follows aliases and survives a cycle', () => {
    expect(resolveKey('A', { A: 'B', B: 'C' })).toBe('C');
    expect(['A', 'B']).toContain(resolveKey('A', { A: 'B', B: 'A' }));
  });
});

describe('indexHistory (rep-max PRs)', () => {
  test('stack-down with no history: first set is the baseline, rest are PRs', () => {
    const { history } = indexHistory([wk(DAY, [stackDown()])], {});
    expect(prFlags(history[0])).toEqual([false, true, true, true, true]);
  });

  test('stack-down over lighter history: every rung is a PR', () => {
    const prior = wk(DAY, [ex('DEADLIFT', [set(5, 185), set(5, 185)])]);
    const { history } = indexHistory([wk(2 * DAY, [stackDown()]), prior], {});
    // input order preserved: history[0] is the stack-down
    expect(prFlags(history[0])).toEqual([true, true, true, true, true]);
    expect(prFlags(history[1])).toEqual([false, false]);
  });

  test('repeating the exact session scores no PRs (ties do not count)', () => {
    const { history } = indexHistory(
      [wk(DAY, [stackDown()]), wk(2 * DAY, [stackDown()])],
      {},
    );
    expect(prFlags(history[1])).toEqual([false, false, false, false, false]);
  });

  test('a heavier top set only PRs the rung that improved', () => {
    const next = stackDown();
    next.sets[0] = set(5, 210);
    const { history } = indexHistory(
      [wk(DAY, [stackDown()]), wk(2 * DAY, [next])],
      {},
    );
    expect(prFlags(history[1])).toEqual([true, false, false, false, false]);
  });

  test('replays by completedAtMs, not array order', () => {
    const older = wk(DAY, [ex('ROW', [set(5, 135)])]);
    const newer = wk(2 * DAY, [ex('ROW', [set(5, 145)])]);
    const { history, prs } = indexHistory([newer, older], {});
    expect(prFlags(history[0])).toEqual([true]);
    expect(prs).toHaveLength(1);
    expect(prs[0].set.weight).toBe(145);
    expect(prs[0].prev.weight).toBe(135);
  });

  test('ignores skipped, empty and 0 lb sets', () => {
    const { history } = indexHistory(
      [
        wk(DAY, [
          ex('ROW', [
            set(5, 100),
            { reps: null, weight: null, skipped: true },
            set(5, 0),
            { reps: null, weight: null },
          ]),
        ]),
      ],
      {},
    );
    expect(prFlags(history[0])).toEqual([false, false, false, false]);
  });

  test('bodyweight sets keep their own rep record', () => {
    const w1 = wk(DAY, [
      ex('DIPS', [set(8, 0, { bw: true, weight: null }), set(5, 25)]),
    ]);
    const w2 = wk(2 * DAY, [
      ex('DIP', [set(10, 0, { bw: true, weight: null }), set(5, 20)]),
    ]);
    const { history } = indexHistory([w1, w2], {});
    expect(prFlags(history[1])).toEqual([true, false]);
  });

  test('merging two keys gives the later exercise a record to beat', () => {
    const a = wk(DAY, [ex('PULLUP', [set(5, 25)])]);
    const b = wk(2 * DAY, [ex('CHIN UP', [set(5, 30), set(5, 28)])]);
    const separate = indexHistory([a, b], {});
    // on its own, CHIN UP's first set is only a baseline
    expect(prFlags(separate.history[1])).toEqual([false, false]);
    const merged = indexHistory([a, b], {
      [exerciseKey('CHIN UP')]: exerciseKey('PULLUP'),
    });
    expect(prFlags(merged.history[1])).toEqual([true, false]);
    expect(merged.exercises[exerciseKey('PULLUP')].sessions).toHaveLength(2);
    expect(merged.exercises[exerciseKey('CHIN UP')]).toBeUndefined();
  });

  test('exercise sessions are newest first and fold duplicate entries', () => {
    const w1 = wk(DAY, [ex('ROW', [set(5, 135)])]);
    const w2 = wk(2 * DAY, [
      ex('ROW', [set(5, 140)]),
      ex('ROW', [set(5, 145)], { id: 'row-2' }),
    ]);
    const { exercises } = indexHistory([w1, w2], {});
    const row = exercises[exerciseKey('ROW')];
    expect(row.sessions).toHaveLength(2);
    expect(row.sessions[0].sets.map(s => s.weight)).toEqual([140, 145]);
    expect(row.sessions[1].completedAtMs).toBe(DAY);
  });
});

describe('annotateSession (live workout)', () => {
  const history = [wk(DAY, [ex('DEADLIFT', [set(4, 220), set(5, 200)])])];
  const { records } = indexHistory(history, {});

  test('stale-flag regression: re-logging 5×215 as 4×215 clears the star', () => {
    const live = wk(0, [ex('DEADLIFT', [set(5, 205), set(5, 215)])]);
    expect(prFlags(annotateSession(live, records, {}))).toEqual([true, true]);
    live.exercises[0].sets[1] = set(4, 215, { pr: true });
    expect(prFlags(annotateSession(live, records, {}))).toEqual([true, false]);
  });

  test('editing an earlier set heavier removes a later set\'s star', () => {
    const live = wk(0, [ex('DEADLIFT', [set(5, 205), set(5, 210)])]);
    expect(prFlags(annotateSession(live, records, {}))).toEqual([true, true]);
    live.exercises[0].sets[0] = set(5, 215);
    expect(prFlags(annotateSession(live, records, {}))).toEqual([true, false]);
  });

  test('does not mutate the history records', () => {
    const live = wk(0, [ex('DEADLIFT', [set(4, 300)])]);
    annotateSession(live, records, {});
    expect(records[exerciseKey('DEADLIFT')].byReps[4].weight).toBe(220);
  });
});

describe('recordToBeat', () => {
  const { records } = indexHistory(
    [wk(DAY, [ex('DEADLIFT', [set(5, 205), set(3, 225)])])],
    {},
  );

  test('uses history at reps-or-more', () => {
    const live = wk(0, [stackDown()]);
    const ref = recordToBeat(records, {}, live, { exId: 'deadlift', setIdx: 2 }, 3, false);
    // history 3×225 and this session's 5×205 / 4×215 → best ≥3 reps = 225
    expect(ref?.weight).toBe(225);
  });

  test('counts earlier sets in this session, not the focused or later ones', () => {
    const live = wk(0, [stackDown()]);
    // focus the last rung (1 rep): history ≥1 = 225, earlier rung 2×235 wins
    const ref = recordToBeat(records, {}, live, { exId: 'deadlift', setIdx: 4 }, 1, false);
    expect(ref?.weight).toBe(235);
    const first = recordToBeat(records, {}, live, { exId: 'deadlift', setIdx: 0 }, 5, false);
    expect(first?.weight).toBe(205);
  });

  test('returns null for an exercise never logged', () => {
    const live = wk(0, [ex('NEW LIFT', [{ reps: null, weight: null }])]);
    expect(
      recordToBeat(records, {}, live, { exId: 'new-lift', setIdx: 0 }, 5, false),
    ).toBeNull();
  });
});

describe('aliases', () => {
  test('mergeAlias points the key at the canonical target and flattens chains', () => {
    const a1 = mergeAlias({}, 'A|', 'B|');
    expect(a1).toEqual({ 'A|': 'B|' });
    // B merged into C: A follows along (one hop)
    const a2 = mergeAlias(a1, 'B|', 'C|');
    expect(a2).toEqual({ 'A|': 'C|', 'B|': 'C|' });
    // merging into an alias resolves to its canonical key
    expect(mergeAlias(a2, 'D|', 'A|')['D|']).toBe('C|');
  });

  test('mergeAlias refuses a cycle or a self-merge', () => {
    const a = { 'A|': 'B|' };
    expect(mergeAlias(a, 'B|', 'A|')).toBe(a);
    expect(mergeAlias(a, 'B|', 'B|')).toBe(a);
  });

  test('unmergeAlias removes one key without touching the input', () => {
    const a = { 'A|': 'C|', 'B|': 'C|' };
    expect(unmergeAlias(a, 'A|')).toEqual({ 'B|': 'C|' });
    expect(a).toEqual({ 'A|': 'C|', 'B|': 'C|' });
  });
});

describe('repMaxBoard / headline', () => {
  const { records } = indexHistory(
    [wk(DAY, [stackDown()]), wk(2 * DAY, [ex('DEADLIFT', [set(3, 230)])])],
    {},
  );
  const rec = records[exerciseKey('DEADLIFT')];

  test('one row per rep count, never rising as reps go up', () => {
    const board = repMaxBoard(rec);
    expect(board.map(r => [r.reps, r.best.weight])).toEqual([
      [1, 240],
      [2, 235],
      [3, 230],
      [4, 215],
      [5, 205],
    ]);
    // 2-rep row is held by the 2×235 set itself
    expect(board[1].best.reps).toBe(2);
  });

  test('headline is the heaviest set; BW-only falls back to the BW best', () => {
    expect(headline(rec)?.weight).toBe(240);
    const bwOnly = indexHistory(
      [wk(DAY, [ex('DIP', [set(12, 0, { bw: true, weight: null })])])],
      {},
    ).records[exerciseKey('DIP')];
    expect(headline(bwOnly)?.reps).toBe(12);
    expect(headline(undefined)).toBeNull();
  });

  test('keyLabel and fmtSet', () => {
    expect(keyLabel('PULL UP|WEIGHTED')).toBe('PULL UP (WEIGHTED)');
    expect(keyLabel('DEADLIFT|')).toBe('DEADLIFT');
    expect(fmtSet({ reps: 5, weight: 205 })).toBe('5×205');
    expect(fmtSet({ reps: 10, weight: 40, ea: true })).toBe('10×40 ea');
    expect(fmtSet({ reps: 12, weight: null })).toBe('12 BW');
  });
});

describe('formatting', () => {
  test('fmtLastTime lists logged sets and days ago', () => {
    expect(
      fmtLastTime(
        [set(5, 205), set(4, 215), { reps: null, weight: null, skipped: true }],
        DAY,
        7 * DAY + 1000,
      ),
    ).toBe('5×205, 4×215 · 6d ago');
    expect(
      fmtLastTime([set(10, 40, { ea: true })], 5 * DAY, 5 * DAY + 60000),
    ).toBe('10×40 ea · today');
    expect(
      fmtLastTime([set(5, 0, { bw: true, weight: null })], undefined, DAY),
    ).toBe('5 BW');
  });

  test('fmtRecord', () => {
    expect(fmtRecord(3, { reps: 5, weight: 225 }, false)).toBe(
      '225 lb at 3+ reps',
    );
    expect(fmtRecord(10, { reps: 12, weight: null }, true)).toBe('12 reps BW');
  });
});
