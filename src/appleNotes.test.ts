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

describe('parseAppleNotes — descending/stacked rep schemes', () => {
  test('descending header parses into a per-set repScheme', () => {
    const r = parseAppleNotes('DEADLIFT 5 SETS X 5, 4, 3, 2, 1 REP');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ex = r.workout.exercises[0];
    expect(ex.name).toBe('DEADLIFT');
    expect(ex.targetSets).toBe(5);
    expect(ex.repScheme).toEqual([5, 4, 3, 2, 1]);
    expect(ex.targetReps).toBe(5);
    expect(ex.sets).toHaveLength(5);
    expect(ex.sets.every(s => s.reps === null)).toBe(true);
  });

  test('the full bug-report paste parses all four exercises', () => {
    const text = `
DEADLIFT 5 SETS X 5, 4, 3, 2, 1 REP
PULL UP (WEIGHTED) 5 SETS X 5, 4, 3, 2, 1 REP
ROMANIAN DEADLIFT 5 SETS X 5, 4, 3, 2, 1 REP
BENT OVER ROW 5 SETS X 5, 4, 3, 2, 1 REP
`.trim();
    const r = parseAppleNotes(text, 'Day 1 - Pull');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises.map(e => e.name)).toEqual([
      'DEADLIFT',
      'PULL UP',
      'ROMANIAN DEADLIFT',
      'BENT OVER ROW',
    ]);
    expect(r.workout.exercises[1].modifier).toBe('WEIGHTED');
    expect(
      r.workout.exercises.every(
        e => JSON.stringify(e.repScheme) === JSON.stringify([5, 4, 3, 2, 1]),
      ),
    ).toBe(true);
  });

  test('single-number header has no repScheme (regression)', () => {
    const r = parseAppleNotes('BENCH PRESS 4x10');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ex = r.workout.exercises[0];
    expect(ex.repScheme).toBeUndefined();
    expect(ex.targetSets).toBe(4);
    expect(ex.targetReps).toBe(10);
  });

  test('slash-separated scheme parses', () => {
    const r = parseAppleNotes('PULL UP 5 SETS X 5/4/3/2/1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises[0].repScheme).toEqual([5, 4, 3, 2, 1]);
  });

  test('mismatched stated sets vs rep list warns and trusts the list', () => {
    const r = parseAppleNotes('DEADLIFT 3 SETS X 5, 4, 3, 2, 1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises[0].targetSets).toBe(5);
    expect(r.workout.exercises[0].sets).toHaveLength(5);
    expect(r.warnings.some(w => /rep targets/.test(w))).toBe(true);
  });

  test('logged set under a scheme is captured and repScheme survives', () => {
    const text = `
DEADLIFT 5 SETS X 5, 4, 3, 2, 1 REP
5 @ 115
`.trim();
    const r = parseAppleNotes(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ex = r.workout.exercises[0];
    expect(ex.repScheme).toEqual([5, 4, 3, 2, 1]);
    expect(ex.sets[0]).toMatchObject({ reps: 5, weight: 115, done: true });
  });
});

describe('parseAppleNotes — tri sets / supersets', () => {
  test('Day 3 paste: only the tri set block is grouped, all at 4×12', () => {
    const text = [
      'SEATED SHOULDER PRESS (DB) 4 SETS X 12 REPS',
      'UPRIGHT ROW (DB) 4 SETS X 12 REPS',
      'TRI SET LATERAL RAISE 4 SETS X 12 REPS',
      '\tBENT OVER REVERSE FLY',
      '\tFRONT RAISE',
    ].join('\n');
    const r = parseAppleNotes(text, 'Shoulders');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
    const exs = r.workout.exercises;
    expect(exs.map(e => e.name)).toEqual([
      'SEATED SHOULDER PRESS',
      'UPRIGHT ROW',
      'LATERAL RAISE',
      'BENT OVER REVERSE FLY',
      'FRONT RAISE',
    ]);
    expect(exs.map(e => e.superset)).toEqual([
      undefined,
      undefined,
      'lateral-raise',
      'lateral-raise',
      'lateral-raise',
    ]);
    for (const e of exs) {
      expect(e.targetSets).toBe(4);
      expect(e.targetReps).toBe(12);
      expect(e.sets).toHaveLength(4);
    }
  });

  test('the next ordinary header closes the group', () => {
    const text = `
SUPERSET CURL 3x10
TRICEP PUSHDOWN
SQUATS 3x5
`.trim();
    const r = parseAppleNotes(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises.map(e => [e.name, e.superset])).toEqual([
      ['CURL', 'curl'],
      ['TRICEP PUSHDOWN', 'curl'],
      ['SQUATS', undefined],
    ]);
  });

  test('members keep their own modifier and logged sets, and inherit a rep scheme', () => {
    const text = `
GIANT SET ROW 3 SETS X 10, 8, 6
FACE PULL (CABLE)
10 @ 30
SHRUG
`.trim();
    const r = parseAppleNotes(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [row, face, shrug] = r.workout.exercises;
    expect(face).toMatchObject({ name: 'FACE PULL', modifier: 'CABLE', superset: 'row' });
    expect(face.repScheme).toEqual([10, 8, 6]);
    expect(face.sets[0]).toMatchObject({ reps: 10, weight: 30, done: true });
    expect(row.superset).toBe('row');
    expect(shrug.superset).toBe('row');
    expect(shrug.sets).toHaveLength(3);
  });

  test('a bare name outside a group is still skipped with a warning', () => {
    const r = parseAppleNotes('BENCH PRESS 4x10\nFRONT RAISE');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises).toHaveLength(1);
    expect(r.workout.exercises[0].superset).toBeUndefined();
    expect(r.warnings.some(w => /FRONT RAISE/.test(w))).toBe(true);
  });
});

describe('parseAppleNotes — STEPS unit and trailing notes', () => {
  test('Day 2 paste: lunges parse as 4×12 with EACH WAY kept as the modifier', () => {
    const text = `
ZERCHER SQUAT 4 SETS X 12 REPS
GLUTE BRIDGE 4 SETS X 12 REPS
WALKING LUNGES 4 SETS X 12 STEPS (EACH WAY)
LEG CURLS 4 SETS X 12 REPS
CALF RAISE 4 SETS X 12 REPS
`.trim();
    const r = parseAppleNotes(text, 'Day 2 - Legs');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
    expect(r.workout.exercises).toHaveLength(5);
    const lunges = r.workout.exercises[2];
    expect(lunges).toMatchObject({
      name: 'WALKING LUNGES',
      modifier: 'EACH WAY',
      targetSets: 4,
      targetReps: 12,
    });
    expect(lunges.sets).toHaveLength(4);
  });

  test('a (DB) written after the reps becomes the modifier', () => {
    const r = parseAppleNotes('BENCH PRESS 4x10 (DB)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises[0]).toMatchObject({ name: 'BENCH PRESS', modifier: 'DB' });
  });

  test('parens before and after the reps are both kept', () => {
    const r = parseAppleNotes('LUNGES (DB) 3 SETS X 10 STEPS (EACH WAY)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.exercises[0]).toMatchObject({ name: 'LUNGES', modifier: 'DB, EACH WAY' });
  });
});
