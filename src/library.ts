// The exercise library: one entry per exercise the user has logged, derived
// from history (records.ts) plus their own edits (muscle group, display
// spelling, notes). History is never rewritten. Pure functions, no React.
// Tested in src/library.test.ts.

import type { Exercise, Workout } from './types';
import {
  exerciseKey,
  normWords,
  resolveKey,
  type Aliases,
  type ExerciseSummary,
  type HistoryIndex,
  type Spelling,
} from './records';
import { SEED_GROUPS } from './data/muscleGroups';

export const MUSCLE_GROUPS = [
  'CHEST',
  'BACK',
  'SHOULDERS',
  'ARMS',
  'LEGS',
  'CORE',
  'FULL BODY',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export type LibraryMeta = {
  group?: MuscleGroup;
  // Which logged spelling to show; ignored once it no longer belongs here.
  spelling?: Spelling;
  notes?: string;
};

export type LibraryEdits = {
  // Canonical exercise key → the user's edits.
  entries: Record<string, LibraryMeta>;
  // Pairs the user said are different exercises, as pairId(a, b).
  distinct: string[];
};

export const EMPTY_LIBRARY: LibraryEdits = { entries: {}, distinct: [] };

export type LibraryEntry = ExerciseSummary & {
  group?: MuscleGroup;
  notes?: string;
};

/** The history index with its exercises shown as library entries. */
export type LibraryIndex = Omit<HistoryIndex, 'exercises'> & {
  exercises: Record<string, LibraryEntry>;
};

/** Canonical key → the alias keys merged into it. */
export function mergedInto(aliases: Aliases): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(aliases)) {
    const to = resolveKey(k, aliases);
    if (!out[to]) out[to] = [];
    out[to].push(k);
  }
  return out;
}

/**
 * One entry per exercise in history. A field the entry has no edit for
 * falls back to the edits of keys merged into it, and the group finally to
 * the seed map, so a merge carries tags across and an unmerge gives them back.
 */
export function buildLibrary(
  exercises: Record<string, ExerciseSummary>,
  edits: LibraryEdits,
  aliases: Aliases,
): Record<string, LibraryEntry> {
  const merged = mergedInto(aliases);
  const out: Record<string, LibraryEntry> = {};
  for (const key of Object.keys(exercises)) {
    const sum = exercises[key];
    const chain = [key, ...(merged[key] ?? [])];
    const first = <T>(get: (k: string) => T | undefined): T | undefined => {
      for (const k of chain) {
        const v = get(k);
        if (v !== undefined) return v;
      }
      return undefined;
    };
    const group =
      first(k => edits.entries[k]?.group) ?? first(k => SEED_GROUPS[k]);
    const notes = first(k => edits.entries[k]?.notes);
    const sp = edits.entries[key]?.spelling;
    const useSp =
      !!sp && resolveKey(exerciseKey(sp.name, sp.modifier), aliases) === key;
    const entry: LibraryEntry = { ...sum };
    if (useSp) {
      entry.name = sp.name;
      entry.modifier = sp.modifier;
    }
    if (group) entry.group = group;
    if (notes) entry.notes = notes;
    out[key] = entry;
  }
  return out;
}

/** Apply a patch to one entry's edits; empty fields are dropped. */
export function setMeta(
  edits: LibraryEdits,
  key: string,
  patch: Partial<LibraryMeta>,
): LibraryEdits {
  const meta: LibraryMeta = { ...edits.entries[key], ...patch };
  for (const f of Object.keys(meta) as (keyof LibraryMeta)[]) {
    if (meta[f] === undefined || meta[f] === '') delete meta[f];
  }
  const entries = { ...edits.entries };
  if (Object.keys(meta).length > 0) entries[key] = meta;
  else delete entries[key];
  return { ...edits, entries };
}

export function pairId(a: string, b: string): string {
  return [a, b].sort().join('~');
}

/** Record that each pair is two different exercises. */
export function markDistinct(
  edits: LibraryEdits,
  pairs: [string, string][],
): LibraryEdits {
  const distinct = [...edits.distinct];
  for (const [a, b] of pairs) {
    const id = pairId(a, b);
    if (!distinct.includes(id)) distinct.push(id);
  }
  return { ...edits, distinct };
}

// ── Near-duplicate names ──────────────────────────────────────
// Only ever suggests; exercise identity stays exerciseKey() + aliases.

// Shorthand expanded for matching only.
const ABBREVIATIONS: Record<string, string> = {
  DL: 'DEADLIFT',
  DB: 'DUMBBELL',
  BB: 'BARBELL',
  KB: 'KETTLEBELL',
  EXT: 'EXTENSION',
  ALT: 'ALTERNATING',
  OHP: 'OVERHEAD PRESS',
  RDL: 'ROMANIAN DEADLIFT',
};

/** A key's words, each depluralized, shorthand expanded, AND dropped. */
export function looseWords(key: string): string[] {
  const out: string[] = [];
  for (const w of key.replace('|', ' ').split(' ').filter(Boolean)) {
    const word = normWords(w);
    for (const x of (ABBREVIATIONS[word] ?? word).split(' ')) {
      if (x !== 'AND') out.push(x);
    }
  }
  return out;
}

/**
 * 2: same letters ignoring spaces, or the same set of words.
 * 1: the shorter name (2+ words) is inside the longer, plus one extra word.
 * 0: no match.
 */
export function similarity(a: string[], b: string[]): number {
  if (a.join('') === b.join('')) return 2;
  const A = new Set(a);
  const B = new Set(b);
  const [s, l] = A.size <= B.size ? [A, B] : [B, A];
  if (![...s].every(w => l.has(w))) return 0;
  if (s.size === l.size) return 2;
  return s.size >= 2 && l.size - s.size === 1 ? 1 : 0;
}

/** The entry's own key plus the key of every spelling logged under it. */
function variantWords(e: LibraryEntry): string[][] {
  const keys = new Set([e.key, ...e.spellings.map(sp => exerciseKey(sp.name, sp.modifier))]);
  return [...keys].map(looseWords);
}

function bestScore(a: string[][], b: string[][]): number {
  let best = 0;
  for (const x of a) for (const y of b) best = Math.max(best, similarity(x, y));
  return best;
}

export type DuplicatePair = { keep: LibraryEntry; fold: LibraryEntry };

const lastDone = (e: LibraryEntry) => e.sessions[0]?.completedAtMs ?? 0;

/**
 * Entries that look like the same exercise, strongest match first. `keep` is
 * the one done more often (ties: the more recent), `fold` would merge into it.
 */
export function possibleDuplicates(
  library: Record<string, LibraryEntry>,
  distinct: string[],
): DuplicatePair[] {
  const list = Object.values(library);
  const words = list.map(variantWords);
  const found: (DuplicatePair & { score: number })[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [list[i], list[j]];
      if (distinct.includes(pairId(a.key, b.key))) continue;
      const score = bestScore(words[i], words[j]);
      if (score === 0) continue;
      const aFirst =
        a.sessions.length - b.sessions.length || lastDone(a) - lastDone(b);
      found.push(aFirst >= 0 ? { keep: a, fold: b, score } : { keep: b, fold: a, score });
    }
  }
  found.sort(
    (x, y) =>
      y.score - x.score || y.keep.sessions.length - x.keep.sessions.length,
  );
  return found.map(({ keep, fold }) => ({ keep, fold }));
}

// ── Import ────────────────────────────────────────────────────

export type ImportQuestion = {
  exId: string;
  asked: Spelling;
  // Up to 3 entries the new name looks like, best first.
  candidates: LibraryEntry[];
};

export function withSpelling(ex: Exercise, sp: Spelling): Exercise {
  const next: Exercise = { ...ex, name: sp.name };
  if (sp.modifier) next.modifier = sp.modifier;
  else delete next.modifier;
  return next;
}

/**
 * Names already in the library are written in the entry's display spelling.
 * A new name that looks like an entry becomes a question; any other new name
 * passes through.
 */
export function resolveImport(
  workout: Workout,
  library: Record<string, LibraryEntry>,
  aliases: Aliases,
  distinct: string[],
): { workout: Workout; questions: ImportQuestion[] } {
  const entries = Object.values(library);
  const questions: ImportQuestion[] = [];
  const exercises = workout.exercises.map(ex => {
    const raw = exerciseKey(ex.name, ex.modifier);
    const entry = library[resolveKey(raw, aliases)];
    if (entry) return withSpelling(ex, entry);
    const words = [looseWords(raw)];
    const candidates = entries
      .filter(e => !distinct.includes(pairId(raw, e.key)))
      .map(e => ({ e, score: bestScore(words, variantWords(e)) }))
      .filter(c => c.score > 0)
      .sort(
        (x, y) => y.score - x.score || y.e.sessions.length - x.e.sessions.length,
      )
      .slice(0, 3)
      .map(c => c.e);
    if (candidates.length > 0) {
      questions.push({
        exId: ex.id,
        asked: ex.modifier ? { name: ex.name, modifier: ex.modifier } : { name: ex.name },
        candidates,
      });
    }
    return ex;
  });
  return { workout: { ...workout, exercises }, questions };
}

/**
 * Apply the answers (exercise id → chosen entry key, or null for "keep as
 * new"). Returns the workout and the pairs to remember as distinct.
 */
export function applyAnswers(
  workout: Workout,
  questions: ImportQuestion[],
  answers: Record<string, string | null>,
  library: Record<string, LibraryEntry>,
): { workout: Workout; distinct: [string, string][] } {
  const byId = new Map(questions.map(q => [q.exId, q]));
  const distinct: [string, string][] = [];
  const exercises = workout.exercises.map(ex => {
    const q = byId.get(ex.id);
    if (!q) return ex;
    const pick = answers[ex.id];
    if (pick && library[pick]) return withSpelling(ex, library[pick]);
    const raw = exerciseKey(q.asked.name, q.asked.modifier);
    for (const c of q.candidates) distinct.push([raw, c.key]);
    return ex;
  });
  return { workout: { ...workout, exercises }, distinct };
}

/** "CHEST" / "UNTAGGED" filter over the library. */
export function filterByGroup(
  list: LibraryEntry[],
  group: MuscleGroup | 'UNTAGGED' | null,
): LibraryEntry[] {
  if (!group) return list;
  if (group === 'UNTAGGED') return list.filter(e => !e.group);
  return list.filter(e => e.group === group);
}
