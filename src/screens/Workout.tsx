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
  applyLog,
  applySkip,
  findExercise,
  focusExercise as focusExerciseLogic,
  getPairPartner,
  suggestDraft,
  togglePair,
  totalDoneSets,
  totalTargetSets,
} from '../workoutLogic';
import { ExerciseCard } from '../components/ExerciseCard';

type Props = {
  session: ActiveSession;
  setSession: Dispatch<SetStateAction<ActiveSession>>;
  onBack: () => void;
  onEnd: () => void;
};

function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function WorkoutScreen({ session, setSession, onBack, onEnd }: Props) {
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

  const onLog = useCallback(() => {
    setSession(s => {
      const next = applyLog(s, draft);
      const loggedEx = findExercise(next.workout, s.focus.exId);
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
  }, [draft, setSession]);

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
      edges={['top', 'left', 'right']}
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
          <Pressable hitSlop={8} onPress={onBack}>
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
          <Pressable hitSlop={8} onPress={onEnd} style={{ marginLeft: 14 }}>
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
        {session.workout.exercises.map(ex => {
          const partner = getPairPartner(session.workout, session.pair, ex.id);
          return (
            <View key={ex.id} style={{ marginBottom: theme.space.cardGap }}>
              <ExerciseCard
                ex={ex}
                focused={session.focus.exId === ex.id}
                focusSetIdx={
                  session.focus.exId === ex.id ? session.focus.setIdx : -1
                }
                draft={draft}
                setDraft={setDraft}
                pairPartnerName={partner ? partner.name.split(' ')[0] : null}
                pairing={pairing}
                isPairTarget={!!pairing && pairing !== ex.id}
                onFocusSet={i => onFocusSet(ex.id, i)}
                onFocusExercise={() => onFocusExercise(ex.id)}
                onLog={onLog}
                onSkip={onSkip}
                onPair={() => onPair(ex.id)}
                onMenu={() => {}}
              />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
