// The exercise library: one entry per exercise the user has logged, derived
// from history (records.ts) plus their own edits (muscle group, display
// spelling, notes). History is never rewritten. Pure functions, no React.
// Tested in src/library.test.ts.

import {
  exerciseKey,
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

/** "CHEST" / "UNTAGGED" filter over the library. */
export function filterByGroup(
  list: LibraryEntry[],
  group: MuscleGroup | 'UNTAGGED' | null,
): LibraryEntry[] {
  if (!group) return list;
  if (group === 'UNTAGGED') return list.filter(e => !e.group);
  return list.filter(e => e.group === group);
}
