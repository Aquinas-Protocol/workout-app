import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActiveSession, Week, Workout } from './types';
import type { Aliases } from './records';
import { EMPTY_LIBRARY, type LibraryEdits } from './library';
import { withHistoryIds } from './historyLogic';

const WEEK_KEY = '@workout/active-week-v1';
const HISTORY_KEY = '@workout/history-v1';
// One-time copy of history taken before ids were first written into it.
const HISTORY_PREMIGRATION_KEY = '@workout/history-v1-premigration';
const LAST_TEMPLATES_KEY = '@workout/last-templates-v1';
const ALIASES_KEY = '@workout/exercise-aliases-v1';
const LIBRARY_KEY = '@workout/exercise-library-v1';
const SYNC_CONFIG_KEY = '@workout/sync-config-v1';
const SYNC_OUTBOX_KEY = '@workout/sync-outbox-v1';
// Legacy key — single-workout session, pre-Week model. Migrated on first load.
const LEGACY_SESSION_KEY = '@workout/active-session-v1';

export async function loadWeek(): Promise<Week | null> {
  try {
    const raw = await AsyncStorage.getItem(WEEK_KEY);
    if (raw) return JSON.parse(raw) as Week;
  } catch {
    // fall through to migration check
  }
  return migrateLegacySession();
}

async function migrateLegacySession(): Promise<Week | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const session: ActiveSession = JSON.parse(raw);
    const workoutCopy: Workout = JSON.parse(JSON.stringify(session.workout));
    const now = Date.now();
    const week: Week = {
      id: `week-${now}`,
      label: session.workout.title,
      createdAtMs: now,
      workouts: [
        {
          id: 'w1',
          template: workoutCopy,
          state: { kind: 'in-progress', session },
        },
      ],
    };
    await AsyncStorage.setItem(WEEK_KEY, JSON.stringify(week));
    await AsyncStorage.removeItem(LEGACY_SESSION_KEY);
    return week;
  } catch {
    return null;
  }
}

export async function saveWeek(w: Week): Promise<void> {
  await AsyncStorage.setItem(WEEK_KEY, JSON.stringify(w));
}

export async function clearWeek(): Promise<void> {
  await AsyncStorage.removeItem(WEEK_KEY);
}

export async function appendHistory(workout: Workout): Promise<void> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  let arr: Workout[] = [];
  if (raw) {
    // Unreadable history is left alone rather than overwritten with [workout].
    try {
      arr = JSON.parse(raw) as Workout[];
    } catch {
      throw new Error('Stored history is unreadable; not overwriting it.');
    }
  }
  arr.unshift(workout);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}

export async function loadHistory(): Promise<Workout[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Workout[];
    const withIds = withHistoryIds(arr);
    if (withIds !== arr) {
      // Ids are deterministic, so a failed write just repeats next load.
      // The snapshot is written first; if it fails, history isn't rewritten.
      try {
        if (!(await AsyncStorage.getItem(HISTORY_PREMIGRATION_KEY))) {
          await AsyncStorage.setItem(HISTORY_PREMIGRATION_KEY, raw);
        }
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(withIds));
      } catch {
        // keep the in-memory ids
      }
    }
    return withIds;
  } catch {
    return [];
  }
}

/** Replace history wholesale (cloud restore only). */
export async function saveHistory(h: Workout[]): Promise<void> {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

export async function loadAliases(): Promise<Aliases> {
  try {
    const raw = await AsyncStorage.getItem(ALIASES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Aliases;
  } catch {
    return {};
  }
}

export async function saveAliases(a: Aliases): Promise<void> {
  await AsyncStorage.setItem(ALIASES_KEY, JSON.stringify(a));
}

export async function loadLibrary(): Promise<LibraryEdits> {
  try {
    const raw = await AsyncStorage.getItem(LIBRARY_KEY);
    if (!raw) return EMPTY_LIBRARY;
    return { ...EMPTY_LIBRARY, ...(JSON.parse(raw) as LibraryEdits) };
  } catch {
    return EMPTY_LIBRARY;
  }
}

export async function saveLibrary(l: LibraryEdits): Promise<void> {
  await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(l));
}

export async function saveLastTemplates(templates: Workout[]): Promise<void> {
  await AsyncStorage.setItem(LAST_TEMPLATES_KEY, JSON.stringify(templates));
}

export async function loadLastTemplates(): Promise<Workout[] | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_TEMPLATES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Workout[];
  } catch {
    return null;
  }
}

export async function loadSyncToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

export async function saveSyncToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify({ token }));
  else await AsyncStorage.removeItem(SYNC_CONFIG_KEY);
}

export async function loadOutbox(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_OUTBOX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function saveOutbox(outbox: string[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_OUTBOX_KEY, JSON.stringify(outbox));
}
