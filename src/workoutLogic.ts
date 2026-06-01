// Pure functions over ActiveSession. No React, no side effects.
// Tested directly in src/workoutLogic.test.ts.

import type {
  ActiveSession,
  Draft,
  Exercise,
  Focus,
  Pair,
  Workout,
  WorkoutSet,
} from './types';

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function findExercise(workout: Workout, exId: string): Exercise {
  const ex = workout.exercises.find(e => e.id === exId);
  if (!ex) throw new Error(`Exercise not found: ${exId}`);
  return ex;
}

export function firstIncompleteSetIdx(ex: Exercise): number {
  return ex.sets.findIndex(s => s.reps == null && !s.skipped);
}

export function isSetComplete(s: WorkoutSet): boolean {
  return s.reps != null || !!s.skipped;
}

export function exerciseDoneCount(ex: Exercise): number {
  return ex.sets.filter(isSetComplete).length;
}

export function totalDoneSets(workout: Workout): number {
  return workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(isSetComplete).length,
    0,
  );
}

export function totalTargetSets(workout: Workout): number {
  return workout.exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
}

/**
 * Take an in-progress workout and stamp it with summary stats for history.
 * Skipped sets are not counted toward totalSets/totalReps; only logged sets
 * contribute. Bodyweight sets contribute to totalReps but not totalVolume.
 */
export function summarizeWorkout(
  workout: Workout,
  startedAtMs: number,
  nowMs: number = Date.now(),
): Workout {
  const loggedSets = workout.exercises.flatMap(ex =>
    ex.sets.filter(s => s.reps != null),
  );
  const totalSets = loggedSets.length;
  const totalReps = loggedSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
  const totalVolume = loggedSets.reduce(
    (sum, s) => sum + (s.bw ? 0 : (s.reps ?? 0) * (s.weight ?? 0)),
    0,
  );
  const durationMin = Math.max(1, Math.round((nowMs - startedAtMs) / 60000));
  return {
    ...workout,
    duration: `${durationMin} min`,
    totalSets,
    totalReps,
    totalVolume,
    completedAtMs: nowMs,
  };
}

export function getPairPartnerId(
  pair: Pair | null,
  exId: string,
): string | null {
  if (!pair) return null;
  if (pair.a === exId) return pair.b;
  if (pair.b === exId) return pair.a;
  return null;
}

export function getPairPartner(
  workout: Workout,
  pair: Pair | null,
  exId: string,
): Exercise | null {
  const id = getPairPartnerId(pair, exId);
  return id ? workout.exercises.find(e => e.id === id) ?? null : null;
}

/**
 * Compute the suggested draft for a focused slot:
 *  - if the slot has a logged value, mirror it
 *  - else use the most recent logged set in this exercise (walking back)
 *  - else use targetReps / 0
 *  - bw mirrors the slot's bw flag (so dips default to BW entry)
 */
export function suggestDraft(ex: Exercise, setIdx: number): Draft {
  const slot = ex.sets[setIdx];
  if (slot.reps != null) {
    return {
      reps: slot.reps,
      weight: slot.weight ?? 0,
      bw: !!slot.bw,
    };
  }
  const lastDone = [...ex.sets.slice(0, setIdx)]
    .reverse()
    .find(s => s.reps != null);
  return {
    reps: lastDone?.reps ?? ex.targetReps,
    weight: lastDone?.weight ?? 0,
    bw: !!slot.bw,
  };
}

/**
 * Find the next focus after logging or skipping a set.
 * Priority:
 *   1. If paired with the logged exercise, partner's next incomplete set.
 *   2. Same exercise, next index that's incomplete.
 *   3. Any other exercise's first incomplete set.
 *   4. null when nothing remains.
 */
export function nextFocus(
  workout: Workout,
  pair: Pair | null,
  loggedExId: string,
  loggedIdx: number,
): Focus | null {
  const partnerId = getPairPartnerId(pair, loggedExId);
  if (partnerId) {
    const partner = findExercise(workout, partnerId);
    const pIdx = firstIncompleteSetIdx(partner);
    if (pIdx >= 0) return { exId: partnerId, setIdx: pIdx };
  }
  const ex = findExercise(workout, loggedExId);
  const nextIdx = ex.sets.findIndex(
    (s, i) => i > loggedIdx && s.reps == null && !s.skipped,
  );
  if (nextIdx >= 0) return { exId: loggedExId, setIdx: nextIdx };
  for (const cand of workout.exercises) {
    if (cand.id === loggedExId) continue;
    const idx = firstIncompleteSetIdx(cand);
    if (idx >= 0) return { exId: cand.id, setIdx: idx };
  }
  return null;
}

/**
 * Returns the initial focus for a workout — the first incomplete set
 * across all exercises, or the first slot of the first exercise.
 */
export function initialFocus(workout: Workout): Focus {
  for (const ex of workout.exercises) {
    const idx = firstIncompleteSetIdx(ex);
    if (idx >= 0) return { exId: ex.id, setIdx: idx };
  }
  return { exId: workout.exercises[0].id, setIdx: 0 };
}

/**
 * Apply LOG SET: write draft into the focused slot and advance focus.
 * Includes the PR heuristic: only on a previously-empty slot, only when
 * reps >= targetReps and weighted, and only when total volume beats the
 * best previously-logged set in this exercise.
 */
export function applyLog(
  session: ActiveSession,
  draft: Draft,
): ActiveSession {
  const { focus, pair } = session;
  const workout = clone(session.workout);
  const ex = findExercise(workout, focus.exId);
  const slot = ex.sets[focus.setIdx];
  const wasEmpty = slot.reps == null;

  ex.sets[focus.setIdx] = {
    ...slot,
    reps: draft.reps,
    weight: draft.bw ? null : draft.weight,
    bw: draft.bw,
    done: true,
    skipped: false,
  };

  if (wasEmpty && !draft.bw && draft.reps >= ex.targetReps) {
    const bestPrev = Math.max(
      0,
      ...ex.sets
        .filter((s, i) => i !== focus.setIdx && s.reps != null && !s.bw)
        .map(s => (s.reps as number) * (s.weight || 0)),
    );
    const cur = draft.reps * (draft.weight || 0);
    if (cur > bestPrev) ex.sets[focus.setIdx].pr = true;
  }

  const next = nextFocus(workout, pair, focus.exId, focus.setIdx);
  return {
    ...session,
    workout,
    focus: next ?? focus,
  };
}

/** Mark the focused slot skipped and advance focus. */
export function applySkip(session: ActiveSession): ActiveSession {
  const { focus, pair } = session;
  const workout = clone(session.workout);
  const ex = findExercise(workout, focus.exId);
  ex.sets[focus.setIdx] = {
    ...ex.sets[focus.setIdx],
    reps: null,
    weight: null,
    skipped: true,
  };
  const next = nextFocus(workout, pair, focus.exId, focus.setIdx);
  return {
    ...session,
    workout,
    focus: next ?? focus,
  };
}

/**
 * Toggle pair-mode for an exercise via the ↔ button. Matches prototype
 * (`handlePair` in stadium.jsx):
 *   - If `exId` is already in `pair`, unpair. Keep `pairing` as-is.
 *   - If `pairing === exId`, cancel pair-mode.
 *   - Otherwise set `pairing = exId` (enter, or switch the target).
 *
 * The pair is only *completed* by tapping the partner exercise body —
 * see `focusExercise`. Tapping ↔ never completes a pair.
 */
export function togglePair(
  pair: Pair | null,
  pairing: string | null,
  exId: string,
): { pair: Pair | null; pairing: string | null } {
  if (pair && (pair.a === exId || pair.b === exId)) {
    return { pair: null, pairing };
  }
  if (pairing === exId) {
    return { pair, pairing: null };
  }
  return { pair, pairing: exId };
}

/**
 * Tap on an exercise's body (not a pill / button). Either completes a
 * pending pair-pick (mutating session.pair), or focuses that exercise's
 * first incomplete set.
 */
export function focusExercise(
  session: ActiveSession,
  pairing: string | null,
  exId: string,
): { session: ActiveSession; pairing: string | null } {
  if (pairing && pairing !== exId) {
    return {
      session: { ...session, pair: { a: pairing, b: exId } },
      pairing: null,
    };
  }
  const ex = findExercise(session.workout, exId);
  const idx = firstIncompleteSetIdx(ex);
  return {
    session: {
      ...session,
      focus: { exId, setIdx: idx >= 0 ? idx : 0 },
    },
    pairing,
  };
}
