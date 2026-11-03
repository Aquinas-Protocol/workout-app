import type { Exercise, Workout, WorkoutSet } from './types';
import { exerciseKey, indexHistory, mergeAlias, unmergeAlias } from './records';
import { SEED_GROUPS } from './data/muscleGroups';
import {
  EMPTY_LIBRARY,
  buildLibrary,
  filterByGroup,
  markDistinct,
  pairId,
  setMeta,
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
