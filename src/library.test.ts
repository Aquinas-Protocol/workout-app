import type { Exercise, Workout, WorkoutSet } from './types';
import { exerciseKey, indexHistory, mergeAlias, unmergeAlias } from './records';
import { SEED_GROUPS } from './data/muscleGroups';
import {
  EMPTY_LIBRARY,
  applyAnswers,
  buildLibrary,
  filterByGroup,
  looseWords,
  markDistinct,
  pairId,
  possibleDuplicates,
  resolveImport,
  setMeta,
  similarity,
  type LibraryEdits,
} from './library';

const DAY = 86400000;

function ex(name: string, modifier?: string): Exercise {
  const sets: WorkoutSet[] = [{ reps: 5, weight: 100, done: true }];
  return {
    id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
    name,
    ...(modifier ? { modifier } : {}),
    targetSets: 1,
    targetReps: 5,
    sets,
  };
}

function wk(completedAtMs: number, exercises: Exercise[]): Workout {
  return { day: '', title: 'W', dateLabel: '', exercises, completedAtMs };
}

const DL = exerciseKey('TRAP BAR DL');
const DEAD = exerciseKey('TRAP BAR DEADLIFT');
const history = [
  wk(DAY, [ex('TRAP BAR DL'), ex('NEW LIFT')]),
  wk(2 * DAY, [ex('TRAP BAR DEADLIFT')]),
];

function lib(edits: LibraryEdits, aliases: Record<string, string> = {}) {
  return buildLibrary(indexHistory(history, aliases).exercises, edits, aliases);
}

describe('buildLibrary', () => {
  test('one entry per logged exercise; seed group fallback; new ones untagged', () => {
    const l = lib(EMPTY_LIBRARY);
    expect(Object.keys(l).sort()).toEqual([exerciseKey('NEW LIFT'), DEAD, DL].sort());
    expect(l[DEAD].group).toBe('BACK');
    expect(l[exerciseKey('NEW LIFT')].group).toBeUndefined();
  });

  test('own edits win over the seed', () => {
    const l = lib(setMeta(EMPTY_LIBRARY, DEAD, { group: 'LEGS', notes: 'hips back' }));
    expect(l[DEAD]).toMatchObject({ group: 'LEGS', notes: 'hips back' });
  });

  test('a merge carries the merged key’s edits; unmerge gives them back', () => {
    const edits = setMeta(EMPTY_LIBRARY, DL, { group: 'LEGS', notes: 'neutral grip' });
    const merged = mergeAlias({}, DL, DEAD);
    const m = lib(edits, merged);
    expect(m[DL]).toBeUndefined();
    // DEAD has no group edit of its own, so DL's beats DEAD's seed group.
    expect(m[DEAD]).toMatchObject({ group: 'LEGS', notes: 'neutral grip' });
    const u = lib(edits, unmergeAlias(merged, DL));
    expect(u[DL]).toMatchObject({ group: 'LEGS', notes: 'neutral grip' });
    expect(u[DEAD].group).toBe('BACK');
    expect(u[DEAD].notes).toBeUndefined();
  });

  test('display spelling: a logged spelling shows; a stale one is ignored', () => {
    const merged = mergeAlias({}, DL, DEAD);
    const edits = setMeta(EMPTY_LIBRARY, DEAD, { spelling: { name: 'TRAP BAR DL' } });
    expect(lib(edits, merged)[DEAD].name).toBe('TRAP BAR DL');
    // after an unmerge TRAP BAR DL is its own exercise again
    expect(lib(edits, {})[DEAD].name).toBe('TRAP BAR DEADLIFT');
  });
});

describe('edits', () => {
  test('setMeta drops empty fields and empty entries', () => {
    const a = setMeta(EMPTY_LIBRARY, 'X|', { notes: 'cue', group: 'ARMS' });
    const b = setMeta(a, 'X|', { notes: '' });
    expect(b.entries['X|']).toEqual({ group: 'ARMS' });
    expect(setMeta(b, 'X|', { group: undefined }).entries).toEqual({});
    expect(EMPTY_LIBRARY.entries).toEqual({});
  });

  test('markDistinct stores order-independent pairs once', () => {
    const d = markDistinct(EMPTY_LIBRARY, [
      ['B|', 'A|'],
      ['A|', 'B|'],
    ]);
    expect(d.distinct).toEqual([pairId('A|', 'B|')]);
    expect(pairId('B|', 'A|')).toBe(pairId('A|', 'B|'));
  });

  test('filterByGroup', () => {
    const l = Object.values(lib(EMPTY_LIBRARY));
    expect(filterByGroup(l, null)).toHaveLength(3);
    expect(filterByGroup(l, 'BACK').map(e => e.key).sort()).toEqual([DEAD, DL].sort());
    expect(filterByGroup(l, 'UNTAGGED').map(e => e.key)).toEqual([
      exerciseKey('NEW LIFT'),
    ]);
  });
});

describe('seed map', () => {
  test('every seed key is a normalized exerciseKey', () => {
    for (const k of Object.keys(SEED_GROUPS)) {
      const [name, modifier] = k.split('|');
      expect(exerciseKey(name, modifier || undefined)).toBe(k);
    }
  });
});

// Every spelling logged up to 2026-11-03 (from the cloud copy).
const REAL_SPELLINGS: [string, string?][] = [
  ['ALT. HAMMER CURL'], ['BACK SQUAT'], ['BACK SQUATS'], ['BARBELL CURL'],
  ['BARBELL CURLS'], ['BARBELL HIGH PULL'], ['BENCH PRESS'], ['BENCH PRESS', 'BB'],
  ['BENCH PRESS', 'DB'], ['BENT OVER ROW'], ['CABLE ROPE EXT.'], ['CABLE ROPE EXT?'],
  ['CLOSE GRIP PRESS'], ['CORE: OBLIQUE CRUNCHES'], ['DB FLY'], ['DEADLIFT'],
  ['DIPS'], ['DIPS', 'WEIGHTED'], ['DUMBBELL RDL'], ['FACE PULL', 'DB'],
  ['FLOOR PRESS', 'BB'], ['FRONT RAISE', 'BB'], ['FRONT SQUAT'], ['FRONT SQUATS'],
  ['GLUTE BRIDGE'], ['GOOD MORNINGS'], ['HACK SQUATS', 'BB'],
  ['HANG CLEAN AND PRESS', 'DB'], ['HANG CLEAN PRESS'], ['INCLINE BARBELL PRESS'],
  ['INCLINE PRESS'], ['KB SWINGS'], ['LANDMINE PRESS'], ['LATERAL RAISE'],
  ['LEG CURLS'], ['LEG EXT.'], ['LEG PRESS'], ['LYING HAMSTRING CURLS'],
  ['OVERHEAD PRESS'], ['PULL DOWNS'], ['PULL DOWNS?'], ['PULL UP', 'WEIGHTED'],
  ['PULL UPS', 'WEIGHTED'], ['PULLOVER'], ['PUSH PRESS'], ['RACK PULL'],
  ['RACK PULLS'], ['ROMANIAN DEADLIFT'], ['SEATED CALF RAISE'], ['SHRUGS'],
  ['SINGLE ARM DB ROW'], ['SINGLE ARM ROW'], ['SKULL CRUSHERS'],
  ['STANDING CALF RAISE'], ['T-BAR ROW'], ['TRAP BAR DEADLIFT'], ['TRAP BAR DL'],
  ['WEIGHTED CHEST DIPS'], ['ZERCHER SQUAT'],
];

function realLibrary() {
  const h = REAL_SPELLINGS.map(([name, modifier], i) =>
    wk((i + 1) * DAY, [ex(name, modifier)]),
  );
  return buildLibrary(indexHistory(h, {}).exercises, EMPTY_LIBRARY, {});
}

const label = (e: { name: string; modifier?: string }) =>
  e.modifier ? `${e.name} (${e.modifier})` : e.name;

const unordered = (a: string, b: string) => [a, b].sort().join(' ~ ');

describe('similarity', () => {
  const w = (name: string, modifier?: string) =>
    looseWords(exerciseKey(name, modifier));

  test('same letters, same words, or one extra word on a 2+ word name', () => {
    expect(similarity(w('TRAP BAR DL'), w('TRAP BAR DEADLIFT'))).toBe(2);
    expect(similarity(w('SKULLCRUSHERS'), w('SKULL CRUSHER'))).toBe(2);
    expect(similarity(w('DIPS', 'WEIGHTED'), w('WEIGHTED DIPS'))).toBe(2);
    expect(similarity(w('SINGLE ARM ROW'), w('SINGLE ARM DB ROW'))).toBe(1);
  });

  test('a one-word name never matches on an extra word', () => {
    expect(similarity(w('DEADLIFT'), w('ROMANIAN DEADLIFT'))).toBe(0);
    expect(similarity(w('DIPS'), w('DIPS', 'WEIGHTED'))).toBe(0);
    expect(similarity(w('FRONT SQUAT'), w('BACK SQUAT'))).toBe(0);
  });
});

describe('possibleDuplicates', () => {
  test('real names: exactly the 8 expected pairs', () => {
    const pairs = possibleDuplicates(realLibrary(), []).map(p =>
      unordered(label(p.keep), label(p.fold)),
    );
    expect(pairs.sort()).toEqual(
      [
        unordered('BENCH PRESS (BB)', 'BENCH PRESS'),
        unordered('BENCH PRESS (DB)', 'BENCH PRESS'),
        unordered('DIPS (WEIGHTED)', 'WEIGHTED CHEST DIPS'),
        unordered('DUMBBELL RDL', 'ROMANIAN DEADLIFT'),
        unordered('HANG CLEAN AND PRESS (DB)', 'HANG CLEAN PRESS'),
        unordered('INCLINE BARBELL PRESS', 'INCLINE PRESS'),
        unordered('SINGLE ARM DB ROW', 'SINGLE ARM ROW'),
        unordered('TRAP BAR DEADLIFT', 'TRAP BAR DL'),
      ].sort(),
    );
  });

  test('keep is the one done more often; distinct pairs drop out', () => {
    const h = [
      wk(DAY, [ex('TRAP BAR DL')]),
      wk(2 * DAY, [ex('TRAP BAR DEADLIFT')]),
      wk(3 * DAY, [ex('TRAP BAR DEADLIFT')]),
    ];
    const l = buildLibrary(indexHistory(h, {}).exercises, EMPTY_LIBRARY, {});
    const [p] = possibleDuplicates(l, []);
    expect([p.keep.key, p.fold.key]).toEqual([DEAD, DL]);
    expect(possibleDuplicates(l, [pairId(DL, DEAD)])).toEqual([]);
  });
});

describe('resolveImport / applyAnswers', () => {
  const l = realLibrary();
  const paste: Workout = {
    day: '',
    title: 'W',
    dateLabel: '',
    exercises: [ex('BACK SQUATS'), ex('TRAPBAR DEADLIFT'), ex('ZOTTMAN CURL')],
  };

  test('known name → display spelling; near name → question; new name passes', () => {
    const { workout, questions } = resolveImport(paste, l, {}, []);
    // BACK SQUAT and BACK SQUATS are one entry; its newest spelling shows.
    expect(workout.exercises[0].name).toBe(l[exerciseKey('BACK SQUAT')].name);
    expect(workout.exercises[1].name).toBe('TRAPBAR DEADLIFT');
    expect(questions).toHaveLength(1);
    expect(questions[0].exId).toBe(paste.exercises[1].id);
    expect(questions[0].candidates.map(c => c.key).sort()).toEqual(
      [DEAD, DL].sort(),
    );
    expect(workout.exercises[2].name).toBe('ZOTTMAN CURL');
  });

  test('a merged name is written as its canonical entry', () => {
    const aliases = mergeAlias({}, DL, DEAD);
    const h = [
      wk(DAY, [ex('TRAP BAR DL')]),
      wk(2 * DAY, [ex('TRAP BAR DEADLIFT')]),
    ];
    const merged = buildLibrary(
      indexHistory(h, aliases).exercises,
      EMPTY_LIBRARY,
      aliases,
    );
    const { workout, questions } = resolveImport(
      { ...paste, exercises: [ex('TRAP BAR DL')] },
      merged,
      aliases,
      [],
    );
    expect(workout.exercises[0].name).toBe('TRAP BAR DEADLIFT');
    expect(questions).toEqual([]);
  });

  test('USE rewrites the name; KEEP AS NEW returns the pairs to remember', () => {
    const { workout, questions } = resolveImport(paste, l, {}, []);
    const exId = questions[0].exId;
    const used = applyAnswers(workout, questions, { [exId]: DEAD }, l);
    expect(used.workout.exercises[1].name).toBe('TRAP BAR DEADLIFT');
    expect(used.distinct).toEqual([]);
    const kept = applyAnswers(workout, questions, { [exId]: null }, l);
    expect(kept.workout.exercises[1].name).toBe('TRAPBAR DEADLIFT');
    const raw = exerciseKey('TRAPBAR DEADLIFT');
    const ids = kept.distinct.map(([a, b]) => pairId(a, b));
    expect(ids.sort()).toEqual([pairId(raw, DEAD), pairId(raw, DL)].sort());
    // once remembered, the same paste asks nothing
    expect(resolveImport(paste, l, {}, ids).questions).toEqual([]);
  });

  test('a modifier is dropped when the chosen entry has none', () => {
    const { workout, questions } = resolveImport(
      { ...paste, exercises: [ex('INCLINE PRESS', 'BB')] },
      l,
      {},
      [],
    );
    const pick = exerciseKey('INCLINE PRESS');
    expect(questions[0].candidates.map(c => c.key)).toContain(pick);
    const used = applyAnswers(workout, questions, { [questions[0].exId]: pick }, l);
    expect(used.workout.exercises[0]).not.toHaveProperty('modifier');
    expect(used.workout.exercises[0].name).toBe('INCLINE PRESS');
  });
});
