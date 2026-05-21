import { parseAppleNotes } from './appleNotes';

describe('parseAppleNotes', () => {
  test('template-only paste creates empty sets', () => {
    const text = `
BENCH PRESS (DB) 4 SETS X 10 REPS
DUMBBELL SEATED PRESS 4 SETS X 10 REPS
WEIGHTED CHEST DIPS 4 SETS X 10 REPS
LATERAL RAISE 4 SETS X 10 REPS
`.trim();
    const r = parseAppleNotes(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises.length).toBe(4);
    expect(r.workout.exercises[0].name).toBe('BENCH PRESS');
    expect(r.workout.exercises[0].modifier).toBe('DB');
    expect(r.workout.exercises[0].targetSets).toBe(4);
    expect(r.workout.exercises[0].targetReps).toBe(10);
    expect(r.workout.exercises[0].sets).toHaveLength(4);
    expect(r.workout.exercises[0].sets.every(s => s.reps === null)).toBe(true);
  });

  test('shorthand "4x10" header works', () => {
    const r = parseAppleNotes('SQUATS 3x12');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises[0].targetSets).toBe(3);
    expect(r.workout.exercises[0].targetReps).toBe(12);
    expect(r.workout.exercises[0].sets).toHaveLength(3);
  });

  test('partial logged sets pad with empty sets carrying ea flag', () => {
    const text = `
BENCH PRESS (DB) 4 SETS X 10 REPS
10 @ 40 ea, 8 @ 40 ea, 9 @ 40 ea
`.trim();
    const r = parseAppleNotes(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const bench = r.workout.exercises[0];
    expect(bench.sets).toHaveLength(4);
    expect(bench.sets[0]).toMatchObject({ reps: 10, weight: 40, ea: true, done: true });
    expect(bench.sets[2]).toMatchObject({ reps: 9, weight: 40, ea: true, done: true });
    expect(bench.sets[3]).toMatchObject({ reps: null, done: false, ea: true });
  });

  test('BW sets parse both "@ BW" and "5 BW" shorthand', () => {
    const text = `
WEIGHTED CHEST DIPS 4 SETS X 10 REPS
5 @ BW, 3 BW
`.trim();
    const r = parseAppleNotes(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const dips = r.workout.exercises[0];
    expect(dips.sets[0]).toMatchObject({ reps: 5, weight: null, bw: true, done: true });
    expect(dips.sets[1]).toMatchObject({ reps: 3, weight: null, bw: true, done: true });
    // padded sets inherit BW
    expect(dips.sets[2]).toMatchObject({ reps: null, bw: true, done: false });
    expect(dips.sets[3]).toMatchObject({ reps: null, bw: true, done: false });
  });

  test('multiple exercises with mixed templates and logs', () => {
    const text = `
BENCH PRESS (DB) 4 SETS X 10 REPS
10 @ 40 ea

WEIGHTED CHEST DIPS 4x10
5 BW

LATERAL RAISE 4x10
`.trim();
    const r = parseAppleNotes(text, 'Upper Push');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.title).toBe('UPPER PUSH');
    expect(r.workout.exercises.map(e => e.id)).toEqual([
      'bench-press',
      'weighted-chest-dips',
      'lateral-raise',
    ]);
    expect(r.workout.exercises[2].sets).toHaveLength(4);
    expect(r.workout.exercises[2].sets.every(s => !s.bw && !s.ea)).toBe(true);
  });

  test('empty input fails gracefully', () => {
    const r = parseAppleNotes('');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatch(/No exercises/);
  });

  test('garbled set lines warn but do not abort the exercise', () => {
    const text = `
BENCH PRESS 4 SETS X 10 REPS
10 @ 40, asdfqwer, 8 @ 40
`.trim();
    const r = parseAppleNotes(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.some(w => /asdfqwer/.test(w))).toBe(true);
    expect(r.workout.exercises[0].sets.filter(s => s.reps != null)).toHaveLength(2);
  });

  test('extra sets beyond target are ignored with a warning', () => {
    const text = `
SQUATS 2 SETS X 10 REPS
10 @ 100, 10 @ 100, 10 @ 100
`.trim();
    const r = parseAppleNotes(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises[0].sets).toHaveLength(2);
    expect(r.warnings.some(w => /extra set/.test(w))).toBe(true);
  });

  test('duplicate exercise names get unique ids', () => {
    const text = `
PULL-UPS 3x8
PULL-UPS 2x6
`.trim();
    const r = parseAppleNotes(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises[0].id).toBe('pull-ups');
    expect(r.workout.exercises[1].id).toBe('pull-ups-2');
  });
});
