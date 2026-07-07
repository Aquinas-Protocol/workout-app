// Parser for the user's Apple Notes workout format.
//
// Header line examples (modifier in parens is optional):
//   BENCH PRESS (DB) 4 SETS X 10 REPS
//   BENCH PRESS (DB) 4x10
//   LATERAL RAISE 4 x 10
//
// Sets line examples (separated by , or ;):
//   10 @ 40 ea, 8 @ 40 ea, 9 @ 40 ea
//   5 @ BW, 3 BW
//   9 @ 45
//
// Lines that look like neither a header nor a sets line are reported as
// errors but do not abort the parse — we return whatever we could extract.

import type { Exercise, Workout, WorkoutSet } from './types';

const HEADER_RE =
  /^(.+?)(?:\s*\(([^)]+)\))?\s+(\d+)\s*(?:SETS?\s*)?[X×x]\s*(\d+(?:\s*[,/]\s*\d+)*)(?:\s*REPS?)?$/i;
const SET_RE = /^(\d+)\s*@\s*(BW|\d+)\s*(ea)?$/i;
const SET_BW_SHORT_RE = /^(\d+)\s+BW$/i;

export type ParseResult =
  | { ok: true; workout: Workout; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

function parseRepList(s: string): number[] {
  return s
    .split(/[,/]/)
    .map(x => parseInt(x.trim(), 10))
    .filter(n => !Number.isNaN(n));
}

function slugify(name: string, existing: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'exercise';
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function parseSet(chunk: string): WorkoutSet | null {
  const bwShort = SET_BW_SHORT_RE.exec(chunk);
  if (bwShort) {
    return {
      reps: parseInt(bwShort[1], 10),
      weight: null,
      bw: true,
      done: true,
    };
  }
  const m = SET_RE.exec(chunk);
  if (!m) return null;
  const [, repsStr, weightStr, ea] = m;
  const isBW = /^bw$/i.test(weightStr);
  const set: WorkoutSet = {
    reps: parseInt(repsStr, 10),
    weight: isBW ? null : parseInt(weightStr, 10),
    done: true,
  };
  if (ea) set.ea = true;
  if (isBW) set.bw = true;
  return set;
}

function padEmptySets(
  ex: Exercise,
  defaults: { ea?: boolean; bw?: boolean },
): void {
  while (ex.sets.length < ex.targetSets) {
    const empty: WorkoutSet = {
      reps: null,
      weight: null,
      done: false,
    };
    if (defaults.ea) empty.ea = true;
    if (defaults.bw) empty.bw = true;
    ex.sets.push(empty);
  }
}

export function parseAppleNotes(text: string, title?: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const exercises: Exercise[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();

  let current: Exercise | null = null;
  let defaults: { ea?: boolean; bw?: boolean } = {};
  let parsedInExercise = 0;

  const closeCurrent = () => {
    if (current) padEmptySets(current, defaults);
  };

  for (const line of lines) {
    const header = HEADER_RE.exec(line);
    if (header) {
      closeCurrent();
      const [, name, modifier, sets, reps] = header;
      const cleanName = name.trim().toUpperCase();
      const id = slugify(cleanName, ids);
      ids.add(id);
      const repList = parseRepList(reps);
      const statedSets = parseInt(sets, 10);
      const isScheme = repList.length > 1;
      if (isScheme && repList.length !== statedSets) {
        warnings.push(
          `${cleanName}: header says ${statedSets} sets but lists ${repList.length} rep targets; using ${repList.length}.`,
        );
      }
      current = {
        id,
        name: cleanName,
        modifier: modifier?.trim().toUpperCase(),
        targetSets: isScheme ? repList.length : statedSets,
        targetReps: repList[0],
        ...(isScheme ? { repScheme: repList } : {}),
        sets: [],
      };
      defaults = {};
      parsedInExercise = 0;
      exercises.push(current);
      continue;
    }

    if (!current) {
      warnings.push(`Skipped (no exercise yet): "${line}"`);
      continue;
    }

    const chunks = line
      .split(/[,;]/)
      .map(c => c.trim())
      .filter(Boolean);

    let parsedThisLine = 0;
    for (const chunk of chunks) {
      const set = parseSet(chunk);
      if (!set) {
        warnings.push(`Couldn't parse set: "${chunk}"`);
        continue;
      }
      if (current.sets.length >= current.targetSets) {
        warnings.push(
          `${current.name}: extra set ignored (target is ${current.targetSets}): "${chunk}"`,
        );
        continue;
      }
      current.sets.push(set);
      parsedInExercise += 1;
      parsedThisLine += 1;
      if (parsedInExercise === 1) {
        if (set.ea) defaults.ea = true;
        if (set.bw) defaults.bw = true;
      }
    }

    if (parsedThisLine === 0 && chunks.length > 0) {
      // already warned per-chunk
    }
  }

  closeCurrent();

  if (exercises.length === 0) {
    errors.push(
      'No exercises found. Each exercise needs a header like "BENCH PRESS 4x10".',
    );
    return { ok: false, errors, warnings };
  }

  const workout: Workout = {
    day: '',
    title: (title?.trim() || 'WORKOUT').toUpperCase(),
    dateLabel: '',
    exercises,
  };

  return { ok: true, workout, warnings };
}
