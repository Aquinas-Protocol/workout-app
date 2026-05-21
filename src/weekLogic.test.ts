import type { Workout } from './types';
import { sampleActiveWorkout } from './data/sampleWorkout';
import {
  createWeek,
  discardWorkout,
  finishWorkout,
  launchOrResume,
  syncSession,
  templatesFromWeek,
  weekStats,
} from './weekLogic';
import { applyLog } from './workoutLogic';

function template(title: string): Workout {
  const t: Workout = JSON.parse(JSON.stringify(sampleActiveWorkout));
  t.title = title;
  // strip logged data so it acts as a fresh template
  t.exercises.forEach(ex => {
    ex.sets = ex.sets.map(s => ({
      reps: null,
      weight: null,
      ea: s.ea,
      bw: s.bw,
      done: false,
    }));
  });
  return t;
}

describe('weekLogic', () => {
  test('createWeek seeds pending workouts with stable ids', () => {
    const w = createWeek(
      'Push/Pull/Legs',
      [template('PUSH'), template('PULL'), template('LEGS')],
      1000,
    );
    expect(w.label).toBe('Push/Pull/Legs');
    expect(w.workouts.map(x => x.id)).toEqual(['w1', 'w2', 'w3']);
    expect(w.workouts.every(x => x.state.kind === 'pending')).toBe(true);
  });

  test('launchOrResume on pending creates a session', () => {
    const w = createWeek(undefined, [template('PUSH')]);
    const { week, session } = launchOrResume(w, 'w1', 2000);
    expect(session.startedAtMs).toBe(2000);
    const ww = week.workouts[0];
    expect(ww.state.kind).toBe('in-progress');
  });

  test('launchOrResume on in-progress returns the same session', () => {
    const w = createWeek(undefined, [template('PUSH')]);
    const { week: w2, session: s1 } = launchOrResume(w, 'w1', 1000);
    const { week: w3, session: s2 } = launchOrResume(w2, 'w1', 9999);
    expect(s2).toBe(s1);
    expect(w3).toBe(w2);
  });

  test('syncSession updates the embedded session', () => {
    const w = createWeek(undefined, [template('PUSH')]);
    const { week: w2, session } = launchOrResume(w, 'w1');
    const next = applyLog(session, { reps: 10, weight: 35, bw: false });
    const w3 = syncSession(w2, 'w1', next);
    const ww = w3.workouts[0];
    if (ww.state.kind !== 'in-progress') throw new Error('expected in-progress');
    expect(ww.state.session.workout.exercises[0].sets[0].reps).toBe(10);
  });

  test('finishWorkout produces a summary and marks completed', () => {
    const w = createWeek(undefined, [template('PUSH')]);
    const { week: w2, session } = launchOrResume(w, 'w1', 1000);
    const next = applyLog(session, { reps: 10, weight: 35, bw: false });
    const w3 = syncSession(w2, 'w1', next);
    const { week: w4, summary } = finishWorkout(w3, 'w1', 1000 + 30 * 60_000);
    expect(summary?.duration).toBe('30 min');
    expect(summary?.totalSets).toBe(1);
    expect(summary?.totalVolume).toBe(350);
    expect(w4.workouts[0].state.kind).toBe('completed');
  });

  test('discardWorkout reverts in-progress to pending', () => {
    const w = createWeek(undefined, [template('PUSH')]);
    const { week: w2 } = launchOrResume(w, 'w1');
    const w3 = discardWorkout(w2, 'w1');
    expect(w3.workouts[0].state.kind).toBe('pending');
  });

  test('weekStats counts by state', () => {
    let w = createWeek(undefined, [
      template('A'),
      template('B'),
      template('C'),
    ]);
    ({ week: w } = launchOrResume(w, 'w1'));
    ({ week: w } = finishWorkout(w, 'w1'));
    ({ week: w } = launchOrResume(w, 'w2'));
    expect(weekStats(w)).toEqual({
      pending: 1,
      inProgress: 1,
      completed: 1,
      total: 3,
    });
  });

  test('templatesFromWeek strips state for repeat-last-week', () => {
    let w = createWeek(undefined, [template('PUSH'), template('PULL')]);
    ({ week: w } = launchOrResume(w, 'w1'));
    const ts = templatesFromWeek(w);
    expect(ts).toHaveLength(2);
    // templates are independent of in-progress state
    expect(ts[0].title).toBe('PUSH');
    expect(ts[1].title).toBe('PULL');
  });
});
