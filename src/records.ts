// Cross-session PR records, derived from history. Pure functions, no React.
// Tested in src/records.test.ts.
//
// PR rule (rep-max): a weighted set of r reps at weight w is a PR when w beats
// the heaviest weight ever logged for that exercise at r OR MORE reps (all
// history, plus earlier sets in the same workout). A bodyweight set is a PR
// when it beats the most reps of any earlier bodyweight set. A PR needs a
// prior record to beat: the first set ever only sets the baseline. Ties are
// not PRs. Stored `pr` flags are never trusted; they are recomputed here.

import type { Focus, Workout, WorkoutSet } from './types';

// alias key → canonical key ("Merge into…").
export type Aliases = Record<string, string>;

export type SetRef = {
  reps: number;
  weight: number | null;
  ea?: boolean;
  workoutId?: string;
  completedAtMs?: number;
};

export type ExerciseRecords = {
  // Best weighted set at exactly r reps.
  byReps: Record<number, SetRef>;
  // Best bodyweight set (most reps).
  bw: SetRef | null;
};

export type Records = Record<string, ExerciseRecords>;

export type PrEvent = { key: string; set: SetRef; prev: SetRef };

export type ExerciseSession = {
  workoutId?: string;
  completedAtMs?: number;
  title: string;
  sets: WorkoutSet[];
};

export type Spelling = { name: string; modifier?: string };

export type ExerciseSummary = {
  key: string;
  name: string;
  modifier?: string;
  // Newest first.
  sessions: ExerciseSession[];
  // Every spelling logged under this exercise (merged ones too), newest first.
  spellings: Spelling[];
};

export type HistoryIndex = {
  // Same order as the input, with `pr` recomputed on every set.
  history: Workout[];
  records: Records;
  // Newest first.
  prs: PrEvent[];
  exercises: Record<string, ExerciseSummary>;
};

type At = { workoutId?: string; completedAtMs?: number };

export function normWords(s: string): string {
  const words = s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length === 0) return '';
  // Depluralize the last word only: PULL-UPS → PULL UP, PRESSES → PRESS,
  // while BENCH PRESS keeps its double S.
  const last = words.length - 1;
  words[last] = words[last]
    .replace(/(SS|CH|SH|X)ES$/, '$1')
    .replace(/([^S])S$/, '$1');
  return words.join(' ');
}

/** Identity of an exercise across sessions: normalized name + modifier. */
export function exerciseKey(name: string, modifier?: string): string {
  return `${normWords(name)}|${modifier ? normWords(modifier) : ''}`;
}

export function resolveKey(key: string, aliases: Aliases): string {
  let k = key;
  const seen = new Set<string>();
  while (aliases[k] && !seen.has(k)) {
    seen.add(k);
    k = aliases[k];
  }
  return k;
}

function keyOf(ex: { name: string; modifier?: string }, aliases: Aliases) {
  return resolveKey(exerciseKey(ex.name, ex.modifier), aliases);
}

/** Heaviest weighted set at `reps` or more reps. */
export function bestAtLeast(
  rec: ExerciseRecords | undefined,
  reps: number,
): SetRef | null {
  if (!rec) return null;
  let best: SetRef | null = null;
  for (const k of Object.keys(rec.byReps)) {
    const ref = rec.byReps[Number(k)];
    if (ref.reps < reps) continue;
    if (!best || (ref.weight ?? 0) > (best.weight ?? 0)) best = ref;
  }
  return best;
}

/** Fold one set into `rec` and say whether it was a PR. The whole PR rule. */
function foldSet(
  rec: ExerciseRecords,
  s: WorkoutSet,
  at: At,
): { pr: boolean; prev: SetRef | null } {
  if (s.reps == null || s.skipped || s.reps <= 0) {
    return { pr: false, prev: null };
  }
  if (s.bw) {
    const prev = rec.bw;
    if (prev && s.reps <= prev.reps) return { pr: false, prev };
    rec.bw = { reps: s.reps, weight: null, ...at };
    return { pr: prev != null, prev };
  }
  const w = s.weight ?? 0;
  if (w <= 0) return { pr: false, prev: null };
  const prev = bestAtLeast(rec, s.reps);
  const cur = rec.byReps[s.reps];
  // Replace (never mutate) refs so shallow copies of byReps stay safe.
  if (!cur || w > (cur.weight ?? 0)) {
    rec.byReps[s.reps] = {
      reps: s.reps,
      weight: w,
      ...(s.ea ? { ea: true } : {}),
      ...at,
    };
  }
  return { pr: prev != null && w > (prev.weight ?? 0), prev };
}

/**
 * Walk a workout's sets in order, folding them into `records` (mutated) and
 * rewriting every set's `pr` flag. Returns the annotated copy and its PRs.
 */
export function annotateWorkout(
  w: Workout,
  records: Records,
  aliases: Aliases,
  at: At,
): { workout: Workout; events: PrEvent[] } {
  const events: PrEvent[] = [];
  const exercises = w.exercises.map(ex => {
    const key = keyOf(ex, aliases);
    if (!records[key]) records[key] = { byReps: {}, bw: null };
    const rec = records[key];
    const sets = ex.sets.map(s => {
      const { pr, prev } = foldSet(rec, s, at);
      const next: WorkoutSet = { ...s };
      delete next.pr;
      if (pr && prev) {
        next.pr = true;
        events.push({
          key,
          set: {
            reps: s.reps as number,
            weight: s.bw ? null : s.weight,
            ...(s.ea ? { ea: true } : {}),
            ...at,
          },
          prev,
        });
      }
      return next;
    });
    return { ...ex, sets };
  });
  return { workout: { ...w, exercises }, events };
}

/** Recompute PR flags for a live workout against history. Pure. */
export function annotateSession(
  w: Workout,
  records: Records,
  aliases: Aliases,
): Workout {
  const scratch: Records = {};
  for (const ex of w.exercises) {
    const key = keyOf(ex, aliases);
    const rec = records[key];
    if (rec && !scratch[key]) {
      scratch[key] = { byReps: { ...rec.byReps }, bw: rec.bw };
    }
  }
  return annotateWorkout(w, scratch, aliases, {}).workout;
}

/**
 * Replay history oldest → newest (by completedAtMs, not array order) into
 * records, PR events and per-exercise session lists.
 */
export function indexHistory(
  history: Workout[],
  aliases: Aliases,
): HistoryIndex {
  const records: Records = {};
  const prs: PrEvent[] = [];
  const annotated: Workout[] = new Array(history.length);
  const order = history
    .map((_, i) => i)
    .sort(
      (a, b) =>
        (history[a].completedAtMs ?? 0) - (history[b].completedAtMs ?? 0),
    );
  for (const i of order) {
    const w = history[i];
    const { workout, events } = annotateWorkout(w, records, aliases, {
      workoutId: w.id,
      completedAtMs: w.completedAtMs,
    });
    annotated[i] = workout;
    prs.push(...events);
  }
  prs.reverse();

  // Newest first. An exercise appearing twice in one workout is one session.
  const exercises: Record<string, ExerciseSummary> = {};
  const lastWorkoutIdx: Record<string, number> = {};
  const hasOwnName = new Set<string>();
  for (const i of [...order].reverse()) {
    const w = annotated[i];
    for (const ex of w.exercises) {
      if (!ex.sets.some(s => s.reps != null)) continue;
      const raw = exerciseKey(ex.name, ex.modifier);
      const key = resolveKey(raw, aliases);
      let sum = exercises[key];
      if (!sum) {
        sum = {
          key,
          name: ex.name,
          modifier: ex.modifier,
          sessions: [],
          spellings: [],
        };
        exercises[key] = sum;
      }
      if (
        !sum.spellings.some(
          sp => sp.name === ex.name && sp.modifier === ex.modifier,
        )
      ) {
        sum.spellings.push(
          ex.modifier ? { name: ex.name, modifier: ex.modifier } : { name: ex.name },
        );
      }
      // Display the canonical exercise under its own (newest) spelling.
      if (raw === key && !hasOwnName.has(key)) {
        hasOwnName.add(key);
        sum.name = ex.name;
        sum.modifier = ex.modifier;
      }
      if (lastWorkoutIdx[key] === i) {
        sum.sessions[sum.sessions.length - 1].sets.push(...ex.sets);
      } else {
        lastWorkoutIdx[key] = i;
        sum.sessions.push({
          workoutId: w.id,
          completedAtMs: w.completedAtMs,
          title: w.title,
          sets: [...ex.sets],
        });
      }
    }
  }

  return { history: annotated, records, prs, exercises };
}

/**
 * The record a set at the focused slot must beat: history plus this
 * workout's earlier sets of the same exercise, stopping at the focused slot.
 */
export function recordToBeat(
  records: Records,
  aliases: Aliases,
  workout: Workout,
  focus: Focus,
  reps: number,
  bw: boolean,
): SetRef | null {
  const focusEx = workout.exercises.find(e => e.id === focus.exId);
  if (!focusEx) return null;
  const key = keyOf(focusEx, aliases);
  const base = records[key];
  const scratch: ExerciseRecords = {
    byReps: { ...(base?.byReps ?? {}) },
    bw: base?.bw ?? null,
  };
  outer: for (const ex of workout.exercises) {
    if (keyOf(ex, aliases) !== key) continue;
    for (let i = 0; i < ex.sets.length; i++) {
      if (ex.id === focus.exId && i === focus.setIdx) break outer;
      foldSet(scratch, ex.sets[i], {});
    }
  }
  return bw ? scratch.bw : bestAtLeast(scratch, reps);
}

/**
 * Merge `from` into `into`'s canonical exercise. Anything already merged into
 * `from` moves along, so the map stays one hop deep. A merge that would close
 * a cycle is a no-op.
 */
export function mergeAlias(a: Aliases, from: string, into: string): Aliases {
  const target = resolveKey(into, a);
  if (target === from || resolveKey(from, a) === target) return a;
  const next: Aliases = {};
  for (const k of Object.keys(a)) next[k] = a[k] === from ? target : a[k];
  next[from] = target;
  return next;
}

export function unmergeAlias(a: Aliases, key: string): Aliases {
  const next = { ...a };
  delete next[key];
  return next;
}

/** One row per rep count logged: the heaviest set at that many reps or more. */
export function repMaxBoard(
  rec: ExerciseRecords | undefined,
): { reps: number; best: SetRef }[] {
  if (!rec) return [];
  return Object.keys(rec.byReps)
    .map(Number)
    .sort((x, y) => x - y)
    .map(reps => ({ reps, best: bestAtLeast(rec, reps) as SetRef }));
}

/** The exercise's top set: heaviest weight (ties → more reps), else BW best. */
export function headline(rec: ExerciseRecords | undefined): SetRef | null {
  if (!rec) return null;
  let best: SetRef | null = null;
  for (const k of Object.keys(rec.byReps)) {
    const ref = rec.byReps[Number(k)];
    const w = ref.weight ?? 0;
    const bw = best?.weight ?? 0;
    if (!best || w > bw || (w === bw && ref.reps > best.reps)) best = ref;
  }
  return best ?? rec.bw;
}

/** "PULL UP|WEIGHTED" → "PULL UP (WEIGHTED)" */
export function keyLabel(key: string): string {
  const [name, modifier] = key.split('|');
  return modifier ? `${name} (${modifier})` : name;
}

/** "5×205" / "12 BW" / "10×40 ea" */
export function fmtSet(ref: { reps: number; weight: number | null; ea?: boolean }): string {
  if (ref.weight == null) return `${ref.reps} BW`;
  return `${ref.reps}×${ref.weight}${ref.ea ? ' ea' : ''}`;
}

function daysAgo(ms: number | undefined, nowMs: number): string {
  if (!ms) return '';
  const d = Math.floor((nowMs - ms) / 86400000);
  return d <= 0 ? 'today' : `${d}d ago`;
}

/** "5×205, 4×215, 3 BW · 6d ago" */
export function fmtLastTime(
  sets: WorkoutSet[],
  completedAtMs: number | undefined,
  nowMs: number,
): string {
  const logged = sets.filter(s => s.reps != null);
  const parts = logged.map(s =>
    s.bw ? `${s.reps} BW` : `${s.reps}×${s.weight ?? 0}`,
  );
  const ea = logged.some(s => !s.bw && s.ea) ? ' ea' : '';
  const when = daysAgo(completedAtMs, nowMs);
  return `${parts.join(', ')}${ea}${when ? ` · ${when}` : ''}`;
}

/** "225 lb at 3+ reps" / "12 reps BW" */
export function fmtRecord(reps: number, ref: SetRef, bw: boolean): string {
  if (bw) return `${ref.reps} reps BW`;
  return `${ref.weight} lb${ref.ea ? ' ea' : ''} at ${reps}+ reps`;
}
