import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
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
  loadHistory,
  loadLastTemplates,
  loadWeek,
  saveLastTemplates,
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
import { HistoryScreen } from './src/screens/History';
import { PastWorkoutScreen } from './src/screens/PastWorkout';

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
  | { kind: 'history-detail'; index: number };

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
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<AppView>({ kind: 'week' });
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  // Web only: inject PWA tags + register the service worker.
  useEffect(() => {
    initPwa();
  }, []);

  // Hydrate from storage.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadWeek(), loadLastTemplates(), loadHistory()]).then(
      ([w, t, h]) => {
        if (cancelled) return;
        setWeek(w);
        setLastTemplates(t);
        setHistory(h);
        setHydrated(true);
      },
    );
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
  }, [view, week]);

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

  const onTapHistoryRow = useCallback((index: number) => {
    setView({ kind: 'history-detail', index });
  }, []);

  const onBackToHistory = useCallback(() => {
    setView({ kind: 'history' });
  }, []);

  // Render ───────────────────────────────────────────────────

  if (!fontsLoaded || !hydrated) return null;

  let content: React.ReactNode;
  if (view.kind === 'import-week') {
    content = (
      <ImportWeekScreen
        initialLabel={view.initialLabel}
        initialTemplates={view.initialTemplates}
        onCancel={onCancelImport}
        onStartWeek={onCommitWeek}
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
        />
      );
    }
  } else if (view.kind === 'history') {
    content = (
      <HistoryScreen history={history} onTap={onTapHistoryRow} />
    );
  } else if (view.kind === 'history-detail') {
    const entry = history?.[view.index];
    if (entry) {
      content = (
        <PastWorkoutScreen workout={entry} onBack={onBackToHistory} />
      );
    } else {
      content = (
        <HistoryScreen history={history} onTap={onTapHistoryRow} />
      );
    }
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
    view.kind === 'history' || view.kind === 'history-detail'
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
