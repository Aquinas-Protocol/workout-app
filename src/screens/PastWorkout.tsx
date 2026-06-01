import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import type { Exercise, Workout, WorkoutSet } from '../types';
import { SetPill } from '../components/SetPill';

type Props = {
  workout: Workout;
  onBack: () => void;
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
  return `${WEEKDAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function findFirstPr(
  workout: Workout,
): { exercise: Exercise; set: WorkoutSet } | null {
  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      if (s.pr) return { exercise: ex, set: s };
    }
  }
  return null;
}

function fmtVolume(v: number | undefined): string {
  if (!v) return '0';
  const k = v / 1000;
  return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}

export function PastWorkoutScreen({ workout, onBack }: Props) {
  const pr = findFirstPr(workout);

  const eyebrowBits: string[] = [];
  if (workout.day) eyebrowBits.push(workout.day);
  const dateBit = fmtDate(workout.completedAtMs);
  if (dateBit) eyebrowBits.push(dateBit);
  const eyebrow = eyebrowBits.join(' · ');

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      {/* top nav */}
      <View
        style={{
          paddingHorizontal: theme.space.edgeSide,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
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
              fontFamily: theme.fonts.mono600,
              fontSize: 11,
              color: theme.colors.textMuted,
              letterSpacing: 1.5,
            }}
          >
            ← HISTORY
          </Text>
        </Pressable>
        <Text
          style={{
            fontFamily: theme.fonts.mono400,
            fontSize: 11,
            color: theme.colors.textDim,
            letterSpacing: 1.5,
          }}
        >
          ⋯
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {pr ? (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 16,
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.pr,
              borderRadius: theme.radii.prBanner,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.display700,
                fontSize: 22,
                color: '#241a02',
                marginRight: 12,
              }}
            >
              ★
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 10,
                  color: '#241a02',
                  letterSpacing: 2,
                  marginBottom: 2,
                }}
              >
                NEW PR
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.display600,
                  fontSize: 14,
                  color: '#241a02',
                }}
                numberOfLines={1}
              >
                {prLabel(pr.exercise, pr.set)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* title block */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 22,
          }}
        >
          {eyebrow ? (
            <Text
              style={{
                fontFamily: theme.fonts.mono600,
                fontSize: 10,
                color: theme.colors.textDim,
                letterSpacing: 2,
                marginBottom: 6,
              }}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: theme.fonts.display700,
              fontSize: 36,
              color: theme.colors.text,
              letterSpacing: -1,
              lineHeight: 38,
            }}
          >
            {workout.title}
          </Text>
        </View>

        {/* stats row */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 6,
          }}
        >
          <Stat label="TIME" value={workout.duration ?? '—'} />
          <Stat
            label="VOL"
            value={fmtVolume(workout.totalVolume)}
            unit="lb"
          />
          <Stat label="SETS" value={String(workout.totalSets ?? 0)} />
          <Stat label="REPS" value={String(workout.totalReps ?? 0)} />
        </View>

        {/* exercise cards */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 14,
            flexDirection: 'column',
          }}
        >
          {workout.exercises.map(ex => (
            <View key={ex.id} style={{ marginBottom: theme.space.cardGap }}>
              <PastExerciseCard ex={ex} />
            </View>
          ))}

          {workout.workoutNote ? (
            <View
              style={{
                padding: 16,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.cardPast,
                borderWidth: 1,
                borderColor: theme.colors.line,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 10,
                  color: theme.colors.textDim,
                  letterSpacing: 2,
                  marginBottom: 6,
                }}
              >
                NOTE
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.sans400,
                  fontSize: 14,
                  color: theme.colors.textMuted,
                  lineHeight: 20,
                }}
              >
                {workout.workoutNote}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function prLabel(ex: Exercise, set: WorkoutSet): string {
  const w = set.weight ?? 0;
  const reps = set.reps ?? 0;
  const ea = set.ea ? ' ea' : '';
  return `${capitalize(ex.name)} · ${reps} × ${w}${ea}`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View style={{ marginRight: 18 }}>
      <Text
        style={{
          fontFamily: theme.fonts.mono700,
          fontSize: 9,
          color: theme.colors.textDim,
          letterSpacing: 1.8,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.display700,
            fontSize: 22,
            color: theme.colors.text,
            letterSpacing: -0.5,
            fontVariant: ['tabular-nums'],
          }}
        >
          {value}
        </Text>
        {unit ? (
          <Text
            style={{
              fontFamily: theme.fonts.sans400,
              fontSize: 11,
              color: theme.colors.textDim,
              marginLeft: 3,
            }}
          >
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function PastExerciseCard({ ex }: { ex: Exercise }) {
  const completedSets = ex.sets.filter(s => s.reps != null).length;
  const incomplete = completedSets < ex.targetSets;
  const hasPR = ex.sets.some(s => s.pr);

  return (
    <View
      style={{
        padding: 16,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.cardPast,
        borderWidth: 1,
        borderColor: theme.colors.line,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={{
              fontFamily: theme.fonts.display700,
              fontSize: 16,
              color: theme.colors.text,
              letterSpacing: -0.3,
            }}
          >
            {ex.name}
          </Text>
          {ex.modifier ? (
            <Text
              style={{
                fontFamily: theme.fonts.mono600,
                fontSize: 10,
                color: theme.colors.textDim,
                letterSpacing: 1.5,
                marginLeft: 8,
              }}
            >
              {ex.modifier}
            </Text>
          ) : null}
        </View>
        {hasPR ? (
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 10,
              color: theme.colors.pr,
              letterSpacing: 1.5,
              marginLeft: 8,
            }}
          >
            ★ PR
          </Text>
        ) : null}
        {incomplete ? (
          <Text
            style={{
              fontFamily: theme.fonts.mono600,
              fontSize: 10,
              color: theme.colors.textDim,
              letterSpacing: 1.5,
              marginLeft: 8,
              fontVariant: ['tabular-nums'],
            }}
          >
            {completedSets}/{ex.targetSets}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: 12,
        }}
      >
        {ex.sets.map((s, i) => (
          <View key={i} style={{ marginRight: 6, marginBottom: 6 }}>
            <SetPill set={s} idx={i} active={false} onPress={() => {}} />
          </View>
        ))}
      </View>
    </View>
  );
}
