import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import type { Workout } from '../types';

type Props = {
  history: Workout[] | null;
  onTap: (index: number) => void;
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

function fmtDate(ms: number | undefined): string {
  if (!ms) return '';
  const d = new Date(ms);
  const wd = WEEKDAYS[d.getDay()];
  const mo = MONTHS[d.getMonth()];
  return `${wd} · ${mo} ${d.getDate()}`;
}

export function HistoryScreen({ history, onTap }: Props) {
  const isEmpty = !history || history.length === 0;
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      {/* title */}
      <View
        style={{
          paddingHorizontal: theme.space.edgeSide,
          paddingTop: 4,
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
          TRAINING LOG
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.display700,
            fontSize: 28,
            color: theme.colors.text,
            letterSpacing: -0.6,
          }}
        >
          History
        </Text>
        {!isEmpty ? (
          <Text
            style={{
              fontFamily: theme.fonts.mono400,
              fontSize: 11,
              color: theme.colors.textDim,
              fontVariant: ['tabular-nums'],
              marginTop: 6,
            }}
          >
            {history!.length} workout{history!.length === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>

      {isEmpty ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 10,
              color: theme.colors.textDim,
              letterSpacing: 1.8,
              marginBottom: 10,
            }}
          >
            NOTHING SAVED YET
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.sans400,
              fontSize: 14,
              color: theme.colors.textMuted,
              textAlign: 'center',
              lineHeight: 20,
              maxWidth: 280,
            }}
          >
            Finish a workout with{' '}
            <Text style={{ color: theme.colors.text }}>Save &amp; finish</Text>{' '}
            and it'll show up here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: theme.space.edgeSide,
            paddingTop: 18,
            paddingBottom: 30,
          }}
          showsVerticalScrollIndicator={false}
        >
          {history!.map((w, i) => (
            <View key={i} style={{ marginBottom: theme.space.cardGap }}>
              <HistoryRow workout={w} onPress={() => onTap(i)} />
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function HistoryRow({
  workout,
  onPress,
}: {
  workout: Workout;
  onPress: () => void;
}) {
  const hasPR = workout.exercises.some(ex => ex.sets.some(s => s.pr));
  const bits: string[] = [];
  if (workout.day) bits.push(workout.day);
  const dateBit = fmtDate(workout.completedAtMs);
  if (dateBit) bits.push(dateBit);
  const eyebrow = bits.join(' · ');

  const statBits: string[] = [];
  if (workout.duration) statBits.push(workout.duration);
  if (workout.totalReps != null) statBits.push(`${workout.totalReps} reps`);
  if (workout.totalVolume) {
    const k = workout.totalVolume / 1000;
    const display =
      k >= 10 ? `${Math.round(k)}k lb` : `${k.toFixed(1)}k lb`;
    statBits.push(display);
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.cardPast,
        borderWidth: 1,
        borderColor: theme.colors.line,
        paddingVertical: 14,
        paddingHorizontal: 16,
        opacity: pressed ? 0.85 : 1,
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
        {eyebrow ? (
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 9,
              color: theme.colors.textDim,
              letterSpacing: 1.8,
              flex: 1,
            }}
          >
            {eyebrow}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {hasPR ? (
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 9,
              color: theme.colors.pr,
              letterSpacing: 1.5,
            }}
          >
            ★ PR
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: theme.fonts.display700,
          fontSize: 18,
          color: theme.colors.text,
          letterSpacing: -0.3,
          marginBottom: statBits.length > 0 ? 6 : 0,
        }}
      >
        {workout.title}
      </Text>
      {statBits.length > 0 ? (
        <Text
          style={{
            fontFamily: theme.fonts.mono400,
            fontSize: 11,
            color: theme.colors.textDim,
            fontVariant: ['tabular-nums'],
            letterSpacing: 0.3,
          }}
        >
          {statBits.join(' · ')}
        </Text>
      ) : null}
    </Pressable>
  );
}
