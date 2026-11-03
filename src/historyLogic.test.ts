import type { Workout } from './types';
import type { ExerciseSummary } from './records';
import {
  filterWorkouts,
  groupByMonth,
  historyId,
  sortExercises,
  withHistoryIds,
} from './historyLogic';

function wk(
  completedAtMs: number | undefined,
  title = 'W',
  names: string[] = [],
  id?: string,
): Workout {
  return {
    ...(id ? { id } : {}),
    day: '',
    title,
    dateLabel: '',
    completedAtMs,
    exercises: names.map(n => ({
      id: n.toLowerCase(),
      name: n,
      targetSets: 1,
      targetReps: 5,
      sets: [],
    })),
  };
}

describe('withHistoryIds', () => {
  test('derives ids from completedAtMs and keeps existing ones', () => {
    const out = withHistoryIds([wk(200), wk(100, 'W', [], 'keep-me')]);
    expect(out.map(w => w.id)).toEqual([historyId(200), 'keep-me']);
  });

  test('is idempotent and returns the same array when nothing is missing', () => {
    const once = withHistoryIds([wk(200), wk(100)]);
    expect(withHistoryIds(once)).toBe(once);
    expect(withHistoryIds([wk(200), wk(100)]).map(w => w.id)).toEqual(
      once.map(w => w.id),
    );
  });

  test('suffixes collisions and handles a missing timestamp', () => {
    const out = withHistoryIds([wk(100), wk(100), wk(undefined)]);
    expect(out.map(w => w.id)).toEqual(['h100', 'h100-2', 'h0-2']);
  });

  test('does not mutate the input entries', () => {
    const input = [wk(100)];
    withHistoryIds(input);
    expect(input[0].id).toBeUndefined();
  });
});

describe('filterWorkouts', () => {
  const h = [
    wk(1, 'PULL DAY', ['DEADLIFT', 'PULL UP']),
    wk(2, 'PUSH DAY', ['BENCH PRESS']),
  ];

  test('matches title or exercise names, ignoring case and punctuation', () => {
    expect(filterWorkouts(h, 'pull-up').map(w => w.title)).toEqual([
      'PULL DAY',
    ]);
    expect(filterWorkouts(h, 'push').map(w => w.title)).toEqual(['PUSH DAY']);
    expect(filterWorkouts(h, 'bench').map(w => w.title)).toEqual([
      'PUSH DAY',
    ]);
  });

  test('an empty query keeps everything', () => {
    expect(filterWorkouts(h, '  ')).toHaveLength(2);
  });
});

describe('groupByMonth', () => {
  const oct = new Date(2026, 9, 20).getTime();
  const nov1 = new Date(2026, 10, 1).getTime();
  const nov3 = new Date(2026, 10, 3).getTime();
  const h = [wk(nov1, 'B'), wk(oct, 'A'), wk(nov3, 'C')];

  test('newest first by default', () => {
    expect(
      groupByMonth(h, false).map(g => [g.label, g.workouts.map(w => w.title)]),
    ).toEqual([
      ['NOVEMBER 2026', ['C', 'B']],
      ['OCTOBER 2026', ['A']],
    ]);
  });

  test('oldest first', () => {
    expect(groupByMonth(h, true).map(g => g.label)).toEqual([
      'OCTOBER 2026',
      'NOVEMBER 2026',
    ]);
  });
});

describe('sortExercises', () => {
  const sum = (name: string, times: number[]): ExerciseSummary => ({
    key: `${name}|`,
    name,
    sessions: times.map(t => ({ completedAtMs: t, title: 'W', sets: [] })),
  });
  const list = [sum('ROW', [5]), sum('BENCH', [9, 3, 1]), sum('SQUAT', [7])];

  test('recent, A–Z and most-done', () => {
    expect(sortExercises(list, 'recent').map(e => e.name)).toEqual([
      'BENCH',
      'SQUAT',
      'ROW',
    ]);
    expect(sortExercises(list, 'az').map(e => e.name)).toEqual([
      'BENCH',
      'ROW',
      'SQUAT',
    ]);
    expect(sortExercises(list, 'most').map(e => e.name)).toEqual([
      'BENCH',
      'SQUAT',
      'ROW',
    ]);
  });
});
