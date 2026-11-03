// Pure helpers over saved history: stable ids, search, grouping, sorting.
// No React, no side effects. Tested in src/historyLogic.test.ts.

import type { Workout } from './types';
import type { ExerciseSummary } from './records';

export type ExerciseSort = 'recent' | 'az' | 'most';

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

export function historyId(completedAtMs: number): string {
  return `h${completedAtMs}`;
}

/**
 * Give every history entry a stable id (derived from completedAtMs, so it is
 * deterministic). Returns the same array when nothing was missing.
 */
export function withHistoryIds(h: Workout[]): Workout[] {
  if (h.every(w => w.id)) return h;
  const used = new Set(h.filter(w => w.id).map(w => w.id as string));
  return h.map((w, i) => {
    if (w.id) return w;
    const base = w.completedAtMs ? historyId(w.completedAtMs) : `h0-${i}`;
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return { ...w, id };
  });
}

function norm(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Case/punctuation-insensitive "contains" over any of `texts`. */
export function matchesQuery(
  query: string,
  texts: (string | undefined)[],
): boolean {
  const q = norm(query);
  if (!q) return true;
  return texts.some(t => !!t && norm(t).includes(q));
}

/** Workouts whose title, day, or any exercise name/modifier matches. */
export function filterWorkouts(h: Workout[], query: string): Workout[] {
  return h.filter(w =>
    matchesQuery(query, [
      w.title,
      w.day,
      ...w.exercises.flatMap(e => [e.name, e.modifier]),
    ]),
  );
}

export function monthLabel(ms: number | undefined): string {
  if (!ms) return 'UNDATED';
  const d = new Date(ms);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function groupByMonth(
  h: Workout[],
  oldestFirst: boolean,
): { label: string; workouts: Workout[] }[] {
  const sorted = [...h].sort((a, b) => {
    const diff = (a.completedAtMs ?? 0) - (b.completedAtMs ?? 0);
    return oldestFirst ? diff : -diff;
  });
  const groups: { label: string; workouts: Workout[] }[] = [];
  for (const w of sorted) {
    const label = monthLabel(w.completedAtMs);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.workouts.push(w);
    else groups.push({ label, workouts: [w] });
  }
  return groups;
}

const lastDone = (e: ExerciseSummary) => e.sessions[0]?.completedAtMs ?? 0;

export function sortExercises(
  list: ExerciseSummary[],
  mode: ExerciseSort,
): ExerciseSummary[] {
  const out = [...list];
  if (mode === 'az') {
    out.sort((a, b) => a.name.localeCompare(b.name));
  } else if (mode === 'most') {
    out.sort(
      (a, b) =>
        b.sessions.length - a.sessions.length || lastDone(b) - lastDone(a),
    );
  } else {
    out.sort((a, b) => lastDone(b) - lastDone(a));
  }
  return out;
}
