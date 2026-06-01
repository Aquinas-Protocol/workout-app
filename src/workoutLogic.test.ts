import type { ActiveSession } from './types';
import { sampleActiveWorkout } from './data/sampleWorkout';
import {
  applyLog,
  applySkip,
  focusExercise,
  initialFocus,
  nextFocus,
  summarizeWorkout,
  togglePair,
  totalDoneSets,
} from './workoutLogic';

function mkSession(): ActiveSession {
  const workout = JSON.parse(JSON.stringify(sampleActiveWorkout));
  return {
    workout,
    focus: initialFocus(workout),
    pair: null,
    startedAtMs: 0,
  };
}

describe('workoutLogic', () => {
  test('initialFocus lands on the first incomplete set', () => {
    const s = mkSession();
    // Bench: 3 done + 1 empty → focus exId=bench, setIdx=3
    expect(s.focus).toEqual({ exId: 'bench', setIdx: 3 });
  });

  test('applyLog writes the slot and advances focus to the next exercise', () => {
    const s = mkSession();
    const next = applyLog(s, { reps: 9, weight: 40, bw: false });
    const bench = next.workout.exercises.find(e => e.id === 'bench')!;
    expect(bench.sets[3].reps).toBe(9);
    expect(bench.sets[3].done).toBe(true);
    // bench is now fully done; focus jumps to dbpress set 0
    expect(next.focus).toEqual({ exId: 'dbpress', setIdx: 0 });
  });

  test('applyLog awards a PR when volume beats the prior best in the exercise', () => {
    const s = mkSession();
    // Prior bench best: 10×40 = 400. Log 11×40 = 440 (and reps >= targetReps).
    const next = applyLog(s, { reps: 11, weight: 40, bw: false });
    const bench = next.workout.exercises.find(e => e.id === 'bench')!;
    expect(bench.sets[3].pr).toBe(true);
  });

  test('applyLog does NOT award a PR when bw=true', () => {
    const s = mkSession();
    const next = applyLog(s, { reps: 20, weight: 0, bw: true });
    const bench = next.workout.exercises.find(e => e.id === 'bench')!;
    expect(bench.sets[3].pr).toBeUndefined();
  });

  test('applySkip marks slot skipped, counts toward done, advances focus', () => {
    const s = mkSession();
    const before = totalDoneSets(s.workout);
    const next = applySkip(s);
    expect(totalDoneSets(next.workout)).toBe(before + 1);
    const bench = next.workout.exercises.find(e => e.id === 'bench')!;
    expect(bench.sets[3].skipped).toBe(true);
    expect(bench.sets[3].reps).toBeNull();
    expect(next.focus).toEqual({ exId: 'dbpress', setIdx: 0 });
  });

  test('togglePair: enter, then complete via focusExercise', () => {
    const s = mkSession();
    const after1 = togglePair(s.pair, null, 'bench');
    expect(after1).toEqual({ pair: null, pairing: 'bench' });
    // User taps Lateral Raise body → pair completes, pairing clears
    const after2 = focusExercise(s, 'bench', 'lat');
    expect(after2.session.pair).toEqual({ a: 'bench', b: 'lat' });
    expect(after2.pairing).toBeNull();
  });

  test('togglePair: tapping ↔ on a paired exercise unpairs', () => {
    const s = mkSession();
    s.pair = { a: 'bench', b: 'lat' };
    const after = togglePair(s.pair, null, 'bench');
    expect(after.pair).toBeNull();
  });

  test('nextFocus alternates within a superset', () => {
    const s = mkSession();
    s.pair = { a: 'bench', b: 'lat' };
    // Logging bench set 3 jumps to lat set 0 (partner has empty)
    const next = applyLog(s, { reps: 10, weight: 40, bw: false });
    expect(next.focus).toEqual({ exId: 'lat', setIdx: 0 });
    // Logging lat set 0: partner (bench) is now exhausted, so we continue
    // within lat itself — set 1 is the next empty
    const afterLat = applyLog(next, { reps: 10, weight: 10, bw: false });
    expect(afterLat.focus).toEqual({ exId: 'lat', setIdx: 1 });
  });

  test('summarizeWorkout computes duration, volume, sets, reps; excludes BW from volume', () => {
    const s = mkSession();
    // Sample bench has 3 logged sets: 10×40, 8×40, 9×40 = 400+320+360 = 1080
    // No other logged sets. Total reps = 27. Total sets = 3.
    const now = Date.now();
    const summary = summarizeWorkout(
      s.workout,
      now - 25 * 60 * 1000, // started 25 min ago
      now,
    );
    expect(summary.totalSets).toBe(3);
    expect(summary.totalReps).toBe(27);
    expect(summary.totalVolume).toBe(1080);
    expect(summary.duration).toBe('25 min');
    expect(summary.completedAtMs).toBe(now);
  });

  test('summarizeWorkout excludes BW sets from volume but includes them in reps', () => {
    const s = mkSession();
    // Log a BW set on dips: 5 BW
    const dips = s.workout.exercises.find(e => e.id === 'dips')!;
    dips.sets[0] = { reps: 5, weight: null, bw: true, done: true };
    const summary = summarizeWorkout(s.workout, Date.now() - 60000, Date.now());
    expect(summary.totalSets).toBe(4); // 3 bench + 1 dips
    expect(summary.totalReps).toBe(32); // 27 + 5
    expect(summary.totalVolume).toBe(1080); // BW contributes 0 to volume
  });

  test('nextFocus returns null when nothing remains', () => {
    const s = mkSession();
    // Fill every set
    s.workout.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        if (set.reps == null) {
          set.reps = 1;
          set.done = true;
        }
      });
    });
    expect(
      nextFocus(s.workout, null, 'lat', s.workout.exercises[3].sets.length - 1),
    ).toBeNull();
  });
});
