import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import { Geist_400Regular } from '@expo-google-fonts/geist';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { theme } from './src/theme';
import type { ActiveSession, Week, Workout } from './src/types';
import {
  appendHistory,
  clearWeek,
  loadAliases,
  loadHistory,
  loadLastTemplates,
  loadLibrary,
  loadOutbox,
  loadSyncToken,
  loadWeek,
  saveAliases,
  saveHistory,
  saveLastTemplates,
  saveLibrary,
  saveOutbox,
  saveSyncToken,
  saveWeek,
} from './src/storage';
import {
  createWeek,
  discardWorkout,
  finishWorkout,
  launchOrResume,
  syncSession,
  templatesFromWeek,
} from './src/weekLogic';
import {
  indexHistory,
  keyLabel,
  mergeAlias,
  resolveKey,
  unmergeAlias,
  type Aliases,
  type ExerciseSummary,
} from './src/records';
import { sortExercises } from './src/historyLogic';
import {
  EMPTY_LIBRARY,
  buildLibrary,
  markDistinct,
  possibleDuplicates,
  setMeta,
  type LibraryEdits,
  type LibraryIndex,
  type LibraryMeta,
} from './src/library';
import {
  ALIASES_DOC,
  LIBRARY_DOC,
  enqueue,
  mergeRemote,
  ping,
  pullDocs,
  pushOutbox,
  workoutDoc,
  type SyncError,
} from './src/syncLogic';
import { initPwa } from './src/pwa';
import { EmptyWeekState } from './src/components/EmptyWeekState';
import {
  ConfirmSheet,
  type ConfirmConfig,
} from './src/components/ConfirmSheet';
import { TabBar, type TabKey } from './src/components/TabBar';
import { WeekScreen } from './src/screens/Week';
import { WorkoutScreen } from './src/screens/Workout';
import { ImportWeekScreen } from './src/screens/ImportWeek';
import {
  HistoryScreen,
  INITIAL_HISTORY_UI,
  type HistoryUi,
} from './src/screens/History';
import { PastWorkoutScreen } from './src/screens/PastWorkout';
import { ExerciseDetailScreen } from './src/screens/ExerciseDetail';
import { SyncScreen } from './src/screens/Sync';

SplashScreen.preventAutoHideAsync().catch(() => {});

type AppView =
  | { kind: 'week' }
  | { kind: 'workout'; workoutId: string }
  | {
      kind: 'import-week';
      initialLabel?: string;
      initialTemplates?: Workout[];
    }
  | { kind: 'history' }
  | { kind: 'sync' }
  // `back` is the view that opened the detail screen.
  | { kind: 'history-detail'; historyId: string; back: AppView }
  | { kind: 'exercise-detail'; exKey: string; back: AppView };

function exerciseLabel(e: ExerciseSummary | undefined, key: string): string {
  if (!e) return keyLabel(key);
  return e.modifier ? `${e.name} (${e.modifier})` : e.name;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    Geist_400Regular,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  const [week, setWeek] = useState<Week | null>(null);
  const [lastTemplates, setLastTemplates] = useState<Workout[] | null>(null);
  const [history, setHistory] = useState<Workout[] | null>(null);
  const [aliases, setAliases] = useState<Aliases>({});
  const [libraryEdits, setLibraryEdits] = useState<LibraryEdits>(EMPTY_LIBRARY);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<AppView>({ kind: 'week' });
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const [historyUi, setHistoryUi] = useState<HistoryUi>(INITIAL_HISTORY_UI);
  // Cloud sync: token (null = off) and the queue of doc keys to upload.
  const [syncToken, setSyncToken] = useState<string | null>(null);
  const [outbox, setOutbox] = useState<string[]>([]);
  const [syncError, setSyncError] = useState<SyncError | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  const flushing = useRef(false);

  // PRs, records and per-exercise sessions, replayed from all history.
  const historyIndex = useMemo(
    () => indexHistory(history ?? [], aliases),
    [history, aliases],
  );
  // The same index with each exercise shown as its library entry.
  const index: LibraryIndex = useMemo(
    () => ({
      ...historyIndex,
      exercises: buildLibrary(historyIndex.exercises, libraryEdits, aliases),
    }),
    [historyIndex, libraryEdits, aliases],
  );
  const duplicates = useMemo(
    () => possibleDuplicates(index.exercises, libraryEdits.distinct),
    [index.exercises, libraryEdits.distinct],
  );

  // Web only: inject PWA tags + register the service worker.
  useEffect(() => {
    initPwa();
  }, []);

  // Hydrate from storage.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadWeek(),
      loadLastTemplates(),
      loadHistory(),
      loadAliases(),
      loadSyncToken(),
      loadOutbox(),
      loadLibrary(),
    ]).then(([w, t, h, a, token, o, l]) => {
      if (cancelled) return;
      setWeek(w);
      setLastTemplates(t);
      setHistory(h);
      setAliases(a);
      setLibraryEdits(l);
      setSyncToken(token);
      setOutbox(o);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshHistory = useCallback(() => {
    loadHistory().then(setHistory).catch(() => {});
  }, []);

  // Persist week. Gated on hydration so the initial null doesn't clobber storage.
  useEffect(() => {
    if (!hydrated) return;
    if (week) saveWeek(week).catch(() => {});
    else clearWeek().catch(() => {});
  }, [week, hydrated]);

  // Persist the sync outbox, same hydration gate as the week.
  useEffect(() => {
    if (!hydrated) return;
    saveOutbox(outbox).catch(() => {});
  }, [outbox, hydrated]);

  // Upload whatever is queued. A failure leaves the outbox as-is; the next
  // trigger (save, foreground, back online) retries.
  const flush = useCallback(async (): Promise<SyncError | null> => {
    if (!syncToken || !history || outbox.length === 0 || flushing.current) {
      return null;
    }
    flushing.current = true;
    const { sent, error } = await pushOutbox(
      syncToken,
      outbox,
      history,
      aliases,
      libraryEdits,
      fetch,
    );
    flushing.current = false;
    if (sent.length > 0) setOutbox(o => o.filter(k => !sent.includes(k)));
    setSyncError(error ?? null);
    return error ?? null;
  }, [syncToken, history, outbox, aliases, libraryEdits]);

  useEffect(() => {
    if (hydrated) flush();
  }, [hydrated, flush, syncTick]);

  // Retry when the app returns to the foreground or the network comes back.
  useEffect(() => {
    const bump = () => setSyncTick(t => t + 1);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') bump();
    });
    const win =
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
        ? window
        : null;
    win?.addEventListener('online', bump);
    return () => {
      sub.remove();
      win?.removeEventListener('online', bump);
    };
  }, []);

  // Hide splash when fonts + hydration are both ready.
  useEffect(() => {
    if (fontsLoaded && hydrated) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, hydrated]);

  // Self-heal a stale "workout" view if the underlying workout isn't there or
  // isn't in-progress (e.g., after migration / external state change).
  useEffect(() => {
    if (view.kind !== 'workout' || !week) return;
    const ww = week.workouts.find(x => x.id === view.workoutId);
    if (!ww || ww.state.kind !== 'in-progress') {
      setView({ kind: 'week' });
    }
  }, [view, week]);

  // Self-heal an exercise page whose key stopped being canonical (merged).
  useEffect(() => {
    if (view.kind !== 'exercise-detail' || index.exercises[view.exKey]) return;
    const resolved = resolveKey(view.exKey, aliases);
    setView(
      index.exercises[resolved] ? { ...view, exKey: resolved } : view.back,
    );
  }, [view, index.exercises, aliases]);

  // Handlers ─────────────────────────────────────────────────

  const goEmptyState = useCallback(() => {
    setWeek(null);
    setView({ kind: 'week' });
  }, []);

  const onStartNewWeek = useCallback(() => {
    setView({ kind: 'import-week' });
  }, []);

  const onRepeatLastWeek = useCallback(() => {
    setView({
      kind: 'import-week',
      initialTemplates: lastTemplates ?? undefined,
    });
  }, [lastTemplates]);

  const onCommitWeek = useCallback(
    (label: string | undefined, templates: Workout[]) => {
      const newWeek = createWeek(label, templates);
      setWeek(newWeek);
      setView({ kind: 'week' });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    },
    [],
  );

  const onCancelImport = useCallback(() => {
    setView({ kind: 'week' });
  }, []);

  const onLaunchWorkout = useCallback(
    (workoutId: string) => {
      if (!week) return;
      const result = launchOrResume(week, workoutId);
      setWeek(result.week);
      setView({ kind: 'workout', workoutId });
    },
    [week],
  );

  const onBackToWeek = useCallback(() => {
    setView({ kind: 'week' });
  }, []);

  const onEndWorkout = useCallback(() => {
    if (view.kind !== 'workout' || !week) return;
    const ww = week.workouts.find(x => x.id === view.workoutId);
    if (!ww || ww.state.kind !== 'in-progress') return;
    const session = ww.state.session;
    const loggedAny = session.workout.exercises.some(ex =>
      ex.sets.some(s => s.reps != null),
    );

    if (!loggedAny) {
      const next = discardWorkout(week, view.workoutId);
      setWeek(next);
      setView({ kind: 'week' });
      return;
    }

    const workoutId = view.workoutId;
    setConfirm({
      title: 'End workout?',
      message: 'Save your sets to history, or discard them.',
      actions: [
        {
          label: 'Save & finish',
          onPress: () => {
            const { week: next, summary } = finishWorkout(week, workoutId);
            if (summary) {
              appendHistory(summary).catch(() => {});
              setHistory(h => (h ? [summary, ...h] : [summary]));
              if (syncToken && summary.id) {
                const key = workoutDoc(summary.id);
                setOutbox(o => enqueue(o, [key]));
              }
            }
            setWeek(next);
            setView({ kind: 'week' });
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
          },
        },
        {
          label: 'Discard',
          style: 'destructive',
          onPress: () => {
            const next = discardWorkout(week, workoutId);
            setWeek(next);
            setView({ kind: 'week' });
          },
        },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  }, [view, week, syncToken]);

  const onEndWeek = useCallback(() => {
    if (!week) return;
    const hasAny = week.workouts.some(w => w.state.kind !== 'pending');
    const finalize = () => {
      const templates = templatesFromWeek(week);
      saveLastTemplates(templates).catch(() => {});
      setLastTemplates(templates);
      goEmptyState();
    };
    if (!hasAny) {
      finalize();
      return;
    }
    setConfirm({
      title: 'End this week?',
      message:
        'Completed workouts stay in your history. This clears the active week.',
      actions: [
        { label: 'End week', style: 'destructive', onPress: finalize },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  }, [week, goEmptyState]);

  // setSession dispatcher for the active workout — wraps the week-level setter.
  const setSession: Dispatch<SetStateAction<ActiveSession>> = useCallback(
    update => {
      if (view.kind !== 'workout') return;
      const workoutId = view.workoutId;
      setWeek(w => {
        if (!w) return w;
        const cww = w.workouts.find(x => x.id === workoutId);
        if (!cww || cww.state.kind !== 'in-progress') return w;
        const next =
          typeof update === 'function' ? update(cww.state.session) : update;
        return syncSession(w, workoutId, next);
      });
    },
    [view],
  );

  const onTabChange = useCallback(
    (key: TabKey) => {
      if (key === 'history') {
        refreshHistory();
        setView({ kind: 'history' });
      } else {
        setView({ kind: 'week' });
      }
    },
    [refreshHistory],
  );

  const openWorkout = useCallback((historyId: string) => {
    setView(v => ({ kind: 'history-detail', historyId, back: v }));
  }, []);

  const openExercise = useCallback((exKey: string) => {
    setView(v => ({ kind: 'exercise-detail', exKey, back: v }));
  }, []);

  const goBack = useCallback(() => {
    setView(v => ('back' in v ? v.back : { kind: 'history' }));
  }, []);

  const onMerge = useCallback(
    (from: string, into: string) => {
      setConfirm({
        title: 'Merge exercises?',
        message: `${exerciseLabel(index.exercises[from], from)} will count as ${exerciseLabel(index.exercises[into], into)}. Past sets combine and PRs are recalculated. You can unmerge later.`,
        actions: [
          {
            label: 'Merge',
            onPress: () => {
              const next = mergeAlias(aliases, from, into);
              setAliases(next);
              saveAliases(next).catch(() => {});
              if (syncToken) setOutbox(o => enqueue(o, [ALIASES_DOC]));
            },
          },
          { label: 'Cancel', style: 'cancel' },
        ],
      });
    },
    [aliases, index.exercises, syncToken],
  );

  const onUnmerge = useCallback(
    (key: string) => {
      setConfirm({
        title: 'Unmerge?',
        message: `${keyLabel(key)} becomes its own exercise again. PRs are recalculated.`,
        actions: [
          {
            label: 'Unmerge',
            onPress: () => {
              const next = unmergeAlias(aliases, key);
              setAliases(next);
              saveAliases(next).catch(() => {});
              if (syncToken) setOutbox(o => enqueue(o, [ALIASES_DOC]));
            },
          },
          { label: 'Cancel', style: 'cancel' },
        ],
      });
    },
    [aliases, syncToken],
  );

  const onEditLibrary = useCallback(
    (key: string, patch: Partial<LibraryMeta>) => {
      const next = setMeta(libraryEdits, key, patch);
      setLibraryEdits(next);
      saveLibrary(next).catch(() => {});
      if (syncToken) setOutbox(o => enqueue(o, [LIBRARY_DOC]));
    },
    [libraryEdits, syncToken],
  );

  // "Keep as new" at import, or "Not the same" on a possible duplicate.
  const onMarkDistinct = useCallback(
    (pairs: [string, string][]) => {
      const next = markDistinct(libraryEdits, pairs);
      setLibraryEdits(next);
      saveLibrary(next).catch(() => {});
      if (syncToken) setOutbox(o => enqueue(o, [LIBRARY_DOC]));
    },
    [libraryEdits, syncToken],
  );

  const onEnableSync = useCallback(
    async (token: string) => {
      setSyncBusy(true);
      const error = await ping(token, fetch);
      setSyncBusy(false);
      setSyncError(error);
      if (error) return;
      saveSyncToken(token).catch(() => {});
      setSyncToken(token);
      // Turning sync on uploads every workout already saved.
      const ids = (history ?? []).flatMap(w => (w.id ? [w.id] : []));
      setOutbox(o =>
        enqueue(o, [...ids.map(workoutDoc), ALIASES_DOC, LIBRARY_DOC]),
      );
    },
    [history],
  );

  const onRestoreSync = useCallback(async () => {
    if (!syncToken || !history) return;
    setSyncBusy(true);
    // Send pending changes first so the pull can't bring back stale ones.
    const pushError = await flush();
    const pulled = pushError ? null : await pullDocs(syncToken, fetch);
    setSyncBusy(false);
    if (!pulled || 'error' in pulled) {
      setSyncError(pulled ? pulled.error : pushError);
      return;
    }
    const merged = mergeRemote(
      { history, aliases, library: libraryEdits },
      pulled,
    );
    setHistory(merged.history);
    saveHistory(merged.history).catch(() => {});
    setAliases(merged.aliases);
    saveAliases(merged.aliases).catch(() => {});
    setLibraryEdits(merged.library);
    saveLibrary(merged.library).catch(() => {});
    setConfirm({
      title: 'Restore complete',
      message: merged.added
        ? `Added ${merged.added} workout${merged.added === 1 ? '' : 's'} from the cloud.`
        : 'Nothing new: this device already has every workout in the cloud.',
      actions: [{ label: 'OK' }],
    });
  }, [syncToken, history, aliases, libraryEdits, flush]);

  const onDisableSync = useCallback(() => {
    setConfirm({
      title: 'Turn off sync?',
      message:
        'New workouts stop uploading. Everything already in the cloud stays there, and this device keeps its history.',
      actions: [
        {
          label: 'Turn off',
          style: 'destructive',
          onPress: () => {
            saveSyncToken(null).catch(() => {});
            setSyncToken(null);
            setOutbox([]);
            setSyncError(null);
          },
        },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  }, []);

  // Render ───────────────────────────────────────────────────

  if (!fontsLoaded || !hydrated) return null;

  const historyScreen = (
    <HistoryScreen
      index={index}
      ui={historyUi}
      setUi={setHistoryUi}
      onOpenWorkout={openWorkout}
      onOpenExercise={openExercise}
      sync={{ enabled: !!syncToken, pending: outbox.length, error: syncError }}
      onOpenSync={() => setView({ kind: 'sync' })}
      duplicates={duplicates}
      onMerge={onMerge}
      onNotSame={(a, b) => onMarkDistinct([[a, b]])}
    />
  );

  let content: React.ReactNode;
  if (view.kind === 'import-week') {
    content = (
      <ImportWeekScreen
        initialLabel={view.initialLabel}
        initialTemplates={view.initialTemplates}
        onCancel={onCancelImport}
        onStartWeek={onCommitWeek}
        library={index.exercises}
        aliases={aliases}
        distinct={libraryEdits.distinct}
        onKeepNew={onMarkDistinct}
      />
    );
  } else if (view.kind === 'workout' && week) {
    const ww = week.workouts.find(x => x.id === view.workoutId);
    if (ww && ww.state.kind === 'in-progress') {
      content = (
        <WorkoutScreen
          key={ww.state.session.startedAtMs}
          session={ww.state.session}
          setSession={setSession}
          onBack={onBackToWeek}
          onEnd={onEndWorkout}
          index={index}
          aliases={aliases}
          showSheet={setConfirm}
        />
      );
    }
  } else if (view.kind === 'history') {
    content = historyScreen;
  } else if (view.kind === 'sync') {
    content = (
      <SyncScreen
        enabled={!!syncToken}
        pending={outbox.length}
        error={syncError}
        busy={syncBusy}
        onEnable={onEnableSync}
        onSyncNow={() => setSyncTick(t => t + 1)}
        onRestore={onRestoreSync}
        onDisable={onDisableSync}
        onBack={() => setView({ kind: 'history' })}
      />
    );
  } else if (view.kind === 'history-detail') {
    const entry = index.history.find(w => w.id === view.historyId);
    content = entry ? (
      <PastWorkoutScreen
        workout={entry}
        onBack={goBack}
        backLabel={
          view.back.kind === 'exercise-detail' ? '← EXERCISE' : '← HISTORY'
        }
      />
    ) : (
      historyScreen
    );
  } else if (view.kind === 'exercise-detail') {
    const exKey = view.exKey;
    const summary = index.exercises[exKey];
    content = summary ? (
      <ExerciseDetailScreen
        key={exKey}
        summary={summary}
        records={index.records[exKey]}
        mergedHere={Object.keys(aliases).filter(k => aliases[k] === exKey)}
        mergeTargets={sortExercises(
          Object.values(index.exercises).filter(e => e.key !== exKey),
          'az',
        )}
        onBack={goBack}
        onOpenWorkout={openWorkout}
        onMerge={into => onMerge(exKey, into)}
        onUnmerge={onUnmerge}
        onEdit={patch => onEditLibrary(exKey, patch)}
      />
    ) : (
      historyScreen
    );
  } else if (week) {
    content = (
      <WeekScreen
        week={week}
        onLaunchWorkout={onLaunchWorkout}
        onEndWeek={onEndWeek}
      />
    );
  }

  if (!content) {
    content = (
      <EmptyWeekState
        onStartNew={onStartNewWeek}
        onRepeatLast={
          lastTemplates && lastTemplates.length > 0
            ? onRepeatLastWeek
            : undefined
        }
      />
    );
  }

  const showTabs =
    view.kind !== 'workout' && view.kind !== 'import-week';
  const activeTab: TabKey =
    view.kind === 'history' ||
    view.kind === 'sync' ||
    view.kind === 'history-detail' ||
    view.kind === 'exercise-detail'
      ? 'history'
      : 'week';

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={{ flex: 1 }}>{content}</View>
        {showTabs ? (
          <TabBar active={activeTab} onSelect={onTabChange} />
        ) : null}
        <ConfirmSheet config={confirm} onDismiss={() => setConfirm(null)} />
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}
