import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActiveSession, Week, Workout } from './types';

const WEEK_KEY = '@workout/active-week-v1';
const HISTORY_KEY = '@workout/history-v1';
const LAST_TEMPLATES_KEY = '@workout/last-templates-v1';
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
  let arr: Workout[] = [];
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (raw) arr = JSON.parse(raw) as Workout[];
  } catch {
    arr = [];
  }
  arr.unshift(workout);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}

export async function loadHistory(): Promise<Workout[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Workout[];
  } catch {
    return [];
  }
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

