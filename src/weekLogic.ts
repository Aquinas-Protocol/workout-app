// Pure functions over Week. No React, no side effects.
// Tested in src/weekLogic.test.ts.

import type {
  ActiveSession,
  Week,
  WeekWorkout,
  Workout,
} from './types';
import { initialFocus, summarizeWorkout } from './workoutLogic';

export function createWeek(
  label: string | undefined,
  templates: Workout[],
  nowMs: number = Date.now(),
): Week {
  return {
    id: `week-${nowMs}`,
    label: label?.trim() || undefined,
    createdAtMs: nowMs,
    workouts: templates.map((t, i) => ({
      id: `w${i + 1}`,
      template: JSON.parse(JSON.stringify(t)) as Workout,
      state: { kind: 'pending' },
    })),
  };
}

export function findWeekWorkout(week: Week, workoutId: string): WeekWorkout {
  const w = week.workouts.find(x => x.id === workoutId);
  if (!w) throw new Error(`Workout not found in week: ${workoutId}`);
  return w;
}

/**
 * Launch or resume a workout in the week:
 *  - pending: create a fresh ActiveSession from the template, mark in-progress
 *  - in-progress: return the existing session unchanged
 *  - completed: throw (caller should prevent this)
 */
export function launchOrResume(
  week: Week,
  workoutId: string,
  nowMs: number = Date.now(),
): { week: Week; session: ActiveSession } {
  const idx = week.workouts.findIndex(w => w.id === workoutId);
  if (idx < 0) throw new Error(`Workout not found in week: ${workoutId}`);
  const ww = week.workouts[idx];

  if (ww.state.kind === 'in-progress') {
    return { week, session: ww.state.session };
  }
  if (ww.state.kind === 'completed') {
    throw new Error('Cannot launch a completed workout');
  }

  const workoutCopy: Workout = JSON.parse(JSON.stringify(ww.template));
  const session: ActiveSession = {
    workout: workoutCopy,
    focus: initialFocus(workoutCopy),
    pair: null,
    startedAtMs: nowMs,
  };
  const newWorkouts = week.workouts.map((w, i) =>
    i === idx
      ? { ...w, state: { kind: 'in-progress', session } satisfies WeekWorkout['state'] }
      : w,
  );
  return { week: { ...week, workouts: newWorkouts }, session };
}

/** Sync a freshly-updated session back into the week record. */
export function syncSession(
  week: Week,
  workoutId: string,
  session: ActiveSession,
): Week {
  const idx = week.workouts.findIndex(w => w.id === workoutId);
  if (idx < 0) return week;
  const ww = week.workouts[idx];
  if (ww.state.kind !== 'in-progress') return week;
  const newWorkouts = week.workouts.map((w, i) =>
    i === idx
      ? { ...w, state: { kind: 'in-progress', session } satisfies WeekWorkout['state'] }
      : w,
  );
  return { ...week, workouts: newWorkouts };
}

/** Mark the in-progress workout completed; return week + summary for history. */
export function finishWorkout(
  week: Week,
  workoutId: string,
  nowMs: number = Date.now(),
): { week: Week; summary: Workout | null } {
  const idx = week.workouts.findIndex(w => w.id === workoutId);
  if (idx < 0) return { week, summary: null };
  const ww = week.workouts[idx];
  if (ww.state.kind !== 'in-progress') return { week, summary: null };

  const summary = summarizeWorkout(
    ww.state.session.workout,
    ww.state.session.startedAtMs,
    nowMs,
  );
  const newWorkouts = week.workouts.map((w, i) =>
    i === idx
      ? { ...w, state: { kind: 'completed', summary } satisfies WeekWorkout['state'] }
      : w,
  );
  return { week: { ...week, workouts: newWorkouts }, summary };
}

/** Revert an in-progress workout to pending (discard the session). */
export function discardWorkout(week: Week, workoutId: string): Week {
  const idx = week.workouts.findIndex(w => w.id === workoutId);
  if (idx < 0) return week;
  if (week.workouts[idx].state.kind !== 'in-progress') return week;
  const newWorkouts = week.workouts.map((w, i) =>
    i === idx
      ? { ...w, state: { kind: 'pending' } satisfies WeekWorkout['state'] }
      : w,
  );
  return { ...week, workouts: newWorkouts };
}

export function weekStats(week: Week): {
  pending: number;
  inProgress: number;
  completed: number;
  total: number;
} {
  let pending = 0;
  let inProgress = 0;
  let completed = 0;
  for (const w of week.workouts) {
    if (w.state.kind === 'pending') pending += 1;
    else if (w.state.kind === 'in-progress') inProgress += 1;
    else completed += 1;
  }
  return { pending, inProgress, completed, total: week.workouts.length };
}

export function activeWorkoutId(week: Week): string | null {
  const w = week.workouts.find(x => x.state.kind === 'in-progress');
  return w ? w.id : null;
}

/** Templates from a week, suitable for "repeat last week" — strips state. */
export function templatesFromWeek(week: Week): Workout[] {
  return week.workouts.map(w => JSON.parse(JSON.stringify(w.template)) as Workout);
}
