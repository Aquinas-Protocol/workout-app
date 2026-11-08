import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { theme } from '../theme';
import type { ActiveSession, Draft } from '../types';
import {
  applyAddSet,
  applyLog,
  applyRemoveSet,
  applySkip,
  canRemoveSet,
  findExercise,
  focusExercise as focusExerciseLogic,
  getGroupPartners,
  suggestDraft,
  togglePair,
  totalDoneSets,
  totalTargetSets,
} from '../workoutLogic';
import {
  annotateSession,
  exerciseKey,
  fmtLastTime,
  fmtRecord,
  recordToBeat,
  resolveKey,
  type Aliases,
} from '../records';
import type { LibraryIndex } from '../library';
import { ExerciseCard } from '../components/ExerciseCard';
import type {
  ConfirmAction,
  ConfirmConfig,
} from '../components/ConfirmSheet';

type Props = {
  session: ActiveSession;
  setSession: Dispatch<SetStateAction<ActiveSession>>;
  onBack: () => void;
  onEnd: () => void;
  index: LibraryIndex;
  aliases: Aliases;
  showSheet: (config: ConfirmConfig) => void;
};

function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function WorkoutScreen({
  session,
  setSession,
  onBack,
  onEnd,
  index,
  aliases,
  showSheet,
}: Props) {
  const [pairing, setPairing] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: theme.anim.pulseMs / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: theme.anim.pulseMs / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const focusEx = findExercise(session.workout, session.focus.exId);
  const [draft, setDraft] = useState<Draft>(() =>
    suggestDraft(focusEx, session.focus.setIdx),
  );
  const lastFocusKey = useRef<string>(
    `${session.focus.exId}:${session.focus.setIdx}`,
  );
  useEffect(() => {
    const key = `${session.focus.exId}:${session.focus.setIdx}`;
    if (key !== lastFocusKey.current) {
      lastFocusKey.current = key;
      const ex = findExercise(session.workout, session.focus.exId);
      setDraft(suggestDraft(ex, session.focus.setIdx));
    }
  }, [session.focus.exId, session.focus.setIdx, session.workout]);

  const doneSets = useMemo(
    () => totalDoneSets(session.workout),
    [session.workout],
  );
  const targetSets = useMemo(
    () => totalTargetSets(session.workout),
    [session.workout],
  );
  const progress = targetSets > 0 ? doneSets / targetSets : 0;

  const progressWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressWidth, {
      toValue: progress,
      duration: theme.anim.progressMs,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [progress, progressWidth]);

  // PR stars are derived against all history, never read from storage.
  const shown = useMemo(
    () => annotateSession(session.workout, index.records, aliases),
    [session.workout, index.records, aliases],
  );

  const lastTimes = useMemo(() => {
    const out: Record<string, string> = {};
    const nowMs = Date.now();
    for (const ex of session.workout.exercises) {
      const key = resolveKey(exerciseKey(ex.name, ex.modifier), aliases);
      const last = index.exercises[key]?.sessions[0];
      if (last) out[ex.id] = fmtLastTime(last.sets, last.completedAtMs, nowMs);
    }
    return out;
  }, [session.workout.exercises, index.exercises, aliases]);

  const notes = useMemo(() => {
    const out: Record<string, string> = {};
    for (const ex of session.workout.exercises) {
      const key = resolveKey(exerciseKey(ex.name, ex.modifier), aliases);
      const n = index.exercises[key]?.notes;
      if (n) out[ex.id] = n;
    }
    return out;
  }, [session.workout.exercises, index.exercises, aliases]);

  const recordRef = recordToBeat(
    index.records,
    aliases,
    session.workout,
    session.focus,
    draft.reps,
    draft.bw,
  );
  const record = recordRef
    ? fmtRecord(draft.reps, recordRef, draft.bw)
    : undefined;

  const onLog = useCallback(() => {
    setSession(s => {
      const next = applyLog(s, draft);
      const annotated = annotateSession(next.workout, index.records, aliases);
      const loggedEx = findExercise(annotated, s.focus.exId);
      const loggedSlot = loggedEx.sets[s.focus.setIdx];
      if (loggedSlot?.pr) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      return next;
    });
  }, [draft, setSession, index.records, aliases]);

  const onMenu = useCallback(
    (exId: string) => {
      const ex = findExercise(session.workout, exId);
      const actions: ConfirmAction[] = [
        {
          label: 'Add set',
          onPress: () => {
            Haptics.selectionAsync().catch(() => {});
            setSession(s => applyAddSet(s, exId));
          },
        },
      ];
      if (canRemoveSet(ex)) {
        actions.push({
          label: 'Remove last set',
          style: 'destructive',
          onPress: () => setSession(s => applyRemoveSet(s, exId)),
        });
      }
      actions.push({ label: 'Cancel', style: 'cancel' });
      showSheet({ title: ex.name, actions });
    },
    [session.workout, setSession, showSheet],
  );

  const onSkip = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setSession(s => applySkip(s));
  }, [setSession]);

  const onFocusSet = useCallback(
    (exId: string, setIdx: number) => {
      setSession(s => ({ ...s, focus: { exId, setIdx } }));
    },
    [setSession],
  );

  const onFocusExercise = useCallback(
    (exId: string) => {
      const result = focusExerciseLogic(session, pairing, exId);
      setSession(result.session);
      setPairing(result.pairing);
    },
    [session, pairing, setSession],
  );

  const onPair = useCallback(
    (exId: string) => {
      const result = togglePair(session.pair, pairing, exId);
      if (result.pair !== session.pair) {
        setSession(s => ({ ...s, pair: result.pair }));
      }
      setPairing(result.pairing);
    },
    [session.pair, pairing, setSession],
  );

  const elapsed = fmtElapsed(now - session.startedAtMs);

  const eyebrowBits = [
    session.workout.day,
    session.workout.intensity,
    session.workout.rest ? `REST ${session.workout.rest}` : null,
  ].filter(Boolean) as string[];

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      {/* top bar */}
      <View
        style={{
          paddingHorizontal: theme.space.edgeSide,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Pressable
            hitSlop={12}
            onPress={onBack}
            style={({ pressed }) => ({
              paddingVertical: 6,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: theme.fonts.mono700,
                fontSize: 11,
                color: theme.colors.textMuted,
                letterSpacing: 1.5,
              }}
            >
              ← WEEK
            </Text>
          </Pressable>
          <Pressable
            hitSlop={12}
            onPress={onEnd}
            style={({ pressed }) => ({
              marginLeft: 14,
              paddingVertical: 6,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: theme.fonts.mono700,
                fontSize: 11,
                color: theme.colors.textMuted,
                letterSpacing: 1.5,
              }}
            >
              ✕ END
            </Text>
          </Pressable>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Animated.View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.colors.accent,
              opacity: pulse,
              marginRight: 6,
            }}
          />
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 11,
              color: theme.colors.accent,
              letterSpacing: 1.5,
              fontVariant: ['tabular-nums'],
            }}
          >
            REC · {elapsed}
          </Text>
        </View>
      </View>

      {/* title block */}
      <View
        style={{
          paddingHorizontal: theme.space.edgeSide,
          paddingTop: 14,
        }}
      >
        {eyebrowBits.length > 0 ? (
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 10,
              color: theme.colors.textDim,
              letterSpacing: 2,
              marginBottom: 4,
            }}
          >
            {eyebrowBits.join(' · ')}
          </Text>
        ) : null}
        <Text
          style={{
            fontFamily: theme.fonts.display700,
            fontSize: 26,
            color: theme.colors.text,
            letterSpacing: -0.6,
          }}
        >
          {session.workout.title}
        </Text>
      </View>

      {/* progress strip */}
      <View
        style={{
          paddingHorizontal: theme.space.edgeSide,
          paddingTop: 14,
          paddingBottom: 4,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 10,
              color: theme.colors.textDim,
              letterSpacing: 1.8,
            }}
          >
            PROGRESS
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.mono600,
              fontSize: 11,
              color: theme.colors.text,
              fontVariant: ['tabular-nums'],
            }}
          >
            {doneSets} / {targetSets} sets
          </Text>
        </View>
        <View
          style={{
            height: 3,
            backgroundColor: theme.colors.surface2,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              height: '100%',
              backgroundColor: theme.colors.accent,
              width: progressWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }}
          />
        </View>
        {pairing ? (
          <View
            style={{
              marginTop: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: theme.colors.accentFill,
              borderWidth: 1,
              borderColor: theme.colors.accent,
              borderStyle: 'dashed',
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.mono700,
                fontSize: 10,
                color: theme.colors.accent,
                letterSpacing: 1.2,
              }}
            >
              ↔ TAP ANOTHER EXERCISE TO PAIR
            </Text>
            <Pressable onPress={() => setPairing(null)} hitSlop={6}>
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 10,
                  color: theme.colors.accent,
                  letterSpacing: 1.2,
                }}
              >
                CANCEL
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* workout complete banner */}
      {doneSets >= targetSets && targetSets > 0 ? (
        <View
          style={{
            marginHorizontal: theme.space.edgeSide,
            marginTop: 10,
            paddingVertical: 10,
            paddingHorizontal: 14,
            backgroundColor: theme.colors.accent,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 10,
              color: theme.colors.bg,
              letterSpacing: 1.8,
            }}
          >
            ✓ WORKOUT COMPLETE
          </Text>
          <Pressable
            onPress={onEnd}
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text
              style={{
                fontFamily: theme.fonts.mono700,
                fontSize: 10,
                color: theme.colors.bg,
                letterSpacing: 1.2,
              }}
            >
              TAP TO SAVE ›
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* exercise list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.space.edgeSide,
          paddingTop: 14,
          paddingBottom: 30,
        }}
        showsVerticalScrollIndicator={false}
      >
        {shown.exercises.map(ex => {
          const partners = getGroupPartners(session.workout, session.pair, ex.id);
          const focused = session.focus.exId === ex.id;
          return (
            <View key={ex.id} style={{ marginBottom: theme.space.cardGap }}>
              <ExerciseCard
                ex={ex}
                focused={focused}
                focusSetIdx={focused ? session.focus.setIdx : -1}
                draft={draft}
                setDraft={setDraft}
                pairPartnerName={
                  partners.length > 0
                    ? partners.map(p => p.name.split(' ')[0]).join(' · ')
                    : null
                }
                pairing={pairing}
                isPairTarget={!!pairing && pairing !== ex.id}
                onFocusSet={i => onFocusSet(ex.id, i)}
                onFocusExercise={() => onFocusExercise(ex.id)}
                onLog={onLog}
                onSkip={onSkip}
                onPair={() => onPair(ex.id)}
                onMenu={() => onMenu(ex.id)}
                onFinish={
                  doneSets >= targetSets && targetSets > 0
                    ? onEnd
                    : undefined
                }
                lastTime={lastTimes[ex.id]}
                record={focused ? record : undefined}
                notes={notes[ex.id]}
              />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
