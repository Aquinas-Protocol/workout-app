import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';
import type { Week, WeekWorkout } from '../types';
import {
  totalDoneSets,
  totalTargetSets,
} from '../workoutLogic';
import { weekStats } from '../weekLogic';

type Props = {
  week: Week;
  onLaunchWorkout: (workoutId: string) => void;
  onEndWeek: () => void;
};

export function WeekScreen({ week, onLaunchWorkout, onEndWeek }: Props) {
  const stats = weekStats(week);

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
        <Pressable hitSlop={8} onPress={onEndWeek}>
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 11,
              color: theme.colors.textMuted,
              letterSpacing: 1.5,
            }}
          >
            ✕ END WEEK
          </Text>
        </Pressable>
        <Text
          style={{
            fontFamily: theme.fonts.mono700,
            fontSize: 11,
            color: theme.colors.textDim,
            letterSpacing: 1.5,
            fontVariant: ['tabular-nums'],
          }}
        >
          {stats.completed} / {stats.total} DONE
        </Text>
      </View>

      {/* title */}
      <View
        style={{
          paddingHorizontal: theme.space.edgeSide,
          paddingTop: 14,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.mono700,
            fontSize: 10,
            color: theme.colors.textDim,
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          THIS WEEK
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.display700,
            fontSize: 28,
            color: theme.colors.text,
            letterSpacing: -0.6,
          }}
        >
          {week.label ?? 'Untitled week'}
        </Text>
      </View>

      {/* workout list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.space.edgeSide,
          paddingTop: 18,
          paddingBottom: 30,
        }}
        showsVerticalScrollIndicator={false}
      >
        {week.workouts.map((ww, i) => (
          <View key={ww.id} style={{ marginBottom: theme.space.cardGap }}>
            <WorkoutRow
              ww={ww}
              index={i}
              onPress={() => {
                if (ww.state.kind === 'completed') return;
                onLaunchWorkout(ww.id);
              }}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkoutRow({
  ww,
  index,
  onPress,
}: {
  ww: WeekWorkout;
  index: number;
  onPress: () => void;
}) {
  const isCompleted = ww.state.kind === 'completed';
  const isInProgress = ww.state.kind === 'in-progress';

  // Stats line varies by state
  let statusLine: string;
  let statusColor: string = theme.colors.textDim;
  if (isCompleted) {
    const s = ww.state.kind === 'completed' ? ww.state.summary : null;
    const duration = s?.duration ?? '';
    const reps = s?.totalReps ?? 0;
    const vol = s?.totalVolume ?? 0;
    statusLine = `✓ DONE${duration ? ` · ${duration}` : ''} · ${reps} reps${vol ? ` · ${(vol / 1000).toFixed(1)}k lb` : ''}`;
    statusColor = theme.colors.good;
  } else if (isInProgress) {
    const session = ww.state.kind === 'in-progress' ? ww.state.session : null;
    const done = session ? totalDoneSets(session.workout) : 0;
    const total = session ? totalTargetSets(session.workout) : 0;
    statusLine = `● IN PROGRESS · ${done} / ${total} sets`;
    statusColor = theme.colors.accent;
  } else {
    const total = totalTargetSets(ww.template);
    const exCount = ww.template.exercises.length;
    statusLine = `${exCount} exercise${exCount === 1 ? '' : 's'} · ${total} sets`;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isCompleted}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.cardPast,
        borderWidth: isInProgress ? 1.5 : 1,
        borderColor: isInProgress
          ? theme.colors.accent
          : theme.colors.line,
        paddingVertical: 14,
        paddingHorizontal: 16,
        opacity: isCompleted ? 0.55 : pressed ? 0.85 : 1,
      })}
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
            fontSize: 9,
            color: theme.colors.textDim,
            letterSpacing: 1.8,
          }}
        >
          WORKOUT {index + 1}
        </Text>
        {!isCompleted && !isInProgress ? (
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 9,
              color: theme.colors.textGhost,
              letterSpacing: 1.5,
            }}
          >
            TAP TO START ›
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: theme.fonts.display700,
          fontSize: 18,
          color: theme.colors.text,
          letterSpacing: -0.3,
          marginBottom: 6,
        }}
      >
        {ww.template.title}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.mono400,
          fontSize: 11,
          color: statusColor,
          letterSpacing: 0.3,
          fontVariant: ['tabular-nums'],
        }}
      >
        {statusLine}
      </Text>
    </Pressable>
  );
}
