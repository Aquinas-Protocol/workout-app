import { useState, type Dispatch, type SetStateAction } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import type { Workout } from '../types';
import {
  fmtSet,
  headline,
  type ExerciseSummary,
  type PrEvent,
} from '../records';
import {
  filterWorkouts,
  groupByMonth,
  matchesQuery,
  sortExercises,
  type ExerciseSort,
} from '../historyLogic';
import {
  MUSCLE_GROUPS,
  filterByGroup,
  type DuplicatePair,
  type LibraryEntry,
  type LibraryIndex,
  type MuscleGroup,
} from '../library';
import type { SyncError } from '../syncLogic';
import { Chip } from '../components/Chip';

export type HistoryTab = 'workouts' | 'exercises' | 'prs';

export type GroupFilter = MuscleGroup | 'UNTAGGED' | null;

// Lives in App so tab/search/sort survive opening a detail screen.
export type HistoryUi = {
  tab: HistoryTab;
  query: string;
  oldestFirst: boolean;
  exerciseSort: ExerciseSort;
  group: GroupFilter;
};

export const INITIAL_HISTORY_UI: HistoryUi = {
  tab: 'workouts',
  query: '',
  oldestFirst: false,
  exerciseSort: 'recent',
  group: null,
};

type Props = {
  index: LibraryIndex;
  ui: HistoryUi;
  setUi: Dispatch<SetStateAction<HistoryUi>>;
  onOpenWorkout: (historyId: string) => void;
  onOpenExercise: (exKey: string) => void;
  sync: { enabled: boolean; pending: number; error: SyncError | null };
  onOpenSync: () => void;
  duplicates: DuplicatePair[];
  onMerge: (fromKey: string, intoKey: string) => void;
  onNotSame: (a: string, b: string) => void;
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

const TABS: { key: HistoryTab; label: string }[] = [
  { key: 'workouts', label: 'WORKOUTS' },
  { key: 'exercises', label: 'EXERCISES' },
  { key: 'prs', label: 'PRS' },
];

const EXERCISE_SORTS: { key: ExerciseSort; label: string }[] = [
  { key: 'recent', label: 'RECENT' },
  { key: 'az', label: 'A–Z' },
  { key: 'most', label: 'MOST DONE' },
];

function fmtDate(ms: number | undefined): string {
  if (!ms) return '';
  const d = new Date(ms);
  const wd = WEEKDAYS[d.getDay()];
  const mo = MONTHS[d.getMonth()];
  return `${wd} · ${mo} ${d.getDate()}`;
}

function fmtShortDate(ms: number | undefined): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function HistoryScreen({
  index,
  ui,
  setUi,
  onOpenWorkout,
  onOpenExercise,
  sync,
  onOpenSync,
  duplicates,
  onMerge,
  onNotSame,
}: Props) {
  const isEmpty = index.history.length === 0;
  const exercises = Object.values(index.exercises);
  const syncPill = !sync.enabled
    ? { label: 'SYNC OFF', color: theme.colors.textDim }
    : sync.error === 'auth'
      ? { label: 'SYNC ERROR', color: theme.colors.danger }
      : sync.pending > 0
        ? { label: `SYNC · ${sync.pending}`, color: theme.colors.textMuted }
        : { label: '✓ SYNCED', color: theme.colors.good };
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
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 10,
              color: theme.colors.textDim,
              letterSpacing: 2,
            }}
          >
            TRAINING LOG
          </Text>
          <Pressable
            hitSlop={10}
            onPress={onOpenSync}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Text
              style={{
                fontFamily: theme.fonts.mono700,
                fontSize: 10,
                color: syncPill.color,
                letterSpacing: 1.5,
              }}
            >
              {syncPill.label} ›
            </Text>
          </Pressable>
        </View>
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
            {plural(index.history.length, 'workout')} ·{' '}
            {plural(exercises.length, 'exercise')} ·{' '}
            {plural(index.prs.length, 'PR')}
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
        <>
          <View
            style={{
              paddingHorizontal: theme.space.edgeSide,
              paddingTop: 14,
            }}
          >
            <Segmented
              active={ui.tab}
              onSelect={tab => setUi(u => ({ ...u, tab }))}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 10,
              }}
            >
              <TextInput
                value={ui.query}
                onChangeText={query => setUi(u => ({ ...u, query }))}
                placeholder={
                  ui.tab === 'workouts'
                    ? 'Search workouts or exercises'
                    : 'Search exercises'
                }
                placeholderTextColor={theme.colors.textGhost}
                autoCorrect={false}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.line,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontFamily: theme.fonts.mono400,
                  fontSize: 13,
                  color: theme.colors.text,
                }}
              />
              {ui.tab !== 'prs' ? (
                <Pressable
                  hitSlop={6}
                  onPress={() =>
                    setUi(u =>
                      u.tab === 'workouts'
                        ? { ...u, oldestFirst: !u.oldestFirst }
                        : { ...u, exerciseSort: nextSort(u.exerciseSort) },
                    )
                  }
                  style={({ pressed }) => ({
                    marginLeft: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.line,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.mono700,
                      fontSize: 10,
                      color: theme.colors.textMuted,
                      letterSpacing: 1.2,
                    }}
                  >
                    {ui.tab === 'workouts'
                      ? ui.oldestFirst
                        ? 'OLDEST ↑'
                        : 'NEWEST ↓'
                      : EXERCISE_SORTS.find(s => s.key === ui.exerciseSort)
                          ?.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {ui.tab === 'exercises' ? (
              <GroupChips
                exercises={exercises}
                active={ui.group}
                onSelect={group => setUi(u => ({ ...u, group }))}
              />
            ) : null}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: theme.space.edgeSide,
              paddingTop: 14,
              paddingBottom: 30,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {ui.tab === 'workouts' ? (
              <WorkoutList
                history={index.history}
                query={ui.query}
                oldestFirst={ui.oldestFirst}
                onOpen={onOpenWorkout}
              />
            ) : ui.tab === 'exercises' ? (
              <>
                {duplicates.length > 0 && !ui.query && !ui.group ? (
                  <DuplicatesCard
                    pairs={duplicates}
                    onMerge={onMerge}
                    onNotSame={onNotSame}
                  />
                ) : null}
                <ExerciseList
                  index={index}
                  query={ui.query}
                  sort={ui.exerciseSort}
                  group={ui.group}
                  onOpen={onOpenExercise}
                />
              </>
            ) : (
              <PrList index={index} query={ui.query} onOpen={onOpenWorkout} />
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function nextSort(s: ExerciseSort): ExerciseSort {
  const i = EXERCISE_SORTS.findIndex(x => x.key === s);
  return EXERCISE_SORTS[(i + 1) % EXERCISE_SORTS.length].key;
}

/** ALL, each muscle group in use, and UNTAGGED when anything lacks one. */
function GroupChips({
  exercises,
  active,
  onSelect,
}: {
  exercises: LibraryEntry[];
  active: GroupFilter;
  onSelect: (g: GroupFilter) => void;
}) {
  const used = new Set(exercises.map(e => e.group));
  const options: GroupFilter[] = [
    null,
    ...MUSCLE_GROUPS.filter(g => used.has(g)),
    ...(used.has(undefined) ? (['UNTAGGED'] as const) : []),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: 10, flexGrow: 0 }}
    >
      {options.map(g => (
        <Chip
          key={g ?? 'ALL'}
          label={g ?? 'ALL'}
          active={g === active}
          onPress={() => onSelect(g)}
        />
      ))}
    </ScrollView>
  );
}

function Segmented({
  active,
  onSelect,
}: {
  active: HistoryTab;
  onSelect: (tab: HistoryTab) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.line,
        padding: 3,
      }}
    >
      {TABS.map(t => {
        const isActive = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => onSelect(t.key)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 8,
              borderRadius: 9,
              alignItems: 'center',
              backgroundColor: isActive ? theme.colors.surface3 : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: theme.fonts.mono700,
                fontSize: 10,
                color: isActive ? theme.colors.text : theme.colors.textDim,
                letterSpacing: 1.6,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: theme.fonts.mono700,
        fontSize: 10,
        color: theme.colors.textDim,
        letterSpacing: 2,
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {children}
    </Text>
  );
}

function NoMatches() {
  return (
    <Text
      style={{
        fontFamily: theme.fonts.mono700,
        fontSize: 10,
        color: theme.colors.textDim,
        letterSpacing: 1.8,
        textAlign: 'center',
        marginTop: 30,
      }}
    >
      NO MATCHES
    </Text>
  );
}

function WorkoutList({
  history,
  query,
  oldestFirst,
  onOpen,
}: {
  history: Workout[];
  query: string;
  oldestFirst: boolean;
  onOpen: (historyId: string) => void;
}) {
  const groups = groupByMonth(filterWorkouts(history, query), oldestFirst);
  if (groups.length === 0) return <NoMatches />;
  return (
    <>
      {groups.map(g => (
        <View key={g.label} style={{ marginBottom: 8 }}>
          <SectionLabel>{g.label}</SectionLabel>
          {g.workouts.map((w, i) => (
            <View key={w.id ?? i} style={{ marginBottom: theme.space.cardGap }}>
              <HistoryRow
                workout={w}
                onPress={() => {
                  if (w.id) onOpen(w.id);
                }}
              />
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

const pairLabel = (e: LibraryEntry) =>
  e.modifier ? `${e.name} (${e.modifier})` : e.name;

/** Library entries that look like the same lift, collapsed until opened. */
function DuplicatesCard({
  pairs,
  onMerge,
  onNotSame,
}: {
  pairs: DuplicatePair[];
  onMerge: (fromKey: string, intoKey: string) => void;
  onNotSame: (a: string, b: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View
      style={{
        marginBottom: theme.space.cardGap,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.cardPast,
        borderWidth: 1,
        borderColor: theme.colors.line,
        paddingHorizontal: 16,
      }}
    >
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: 14,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text
          style={{
            fontFamily: theme.fonts.mono700,
            fontSize: 10,
            color: theme.colors.textMuted,
            letterSpacing: 1.6,
          }}
        >
          POSSIBLE DUPLICATES · {pairs.length}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.mono700,
            fontSize: 10,
            color: theme.colors.textDim,
            letterSpacing: 1.6,
          }}
        >
          {open ? 'HIDE' : 'REVIEW ›'}
        </Text>
      </Pressable>
      {open
        ? pairs.map(p => (
            <View
              key={`${p.fold.key}~${p.keep.key}`}
              style={{
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: theme.colors.line,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.display700,
                  fontSize: 14,
                  color: theme.colors.text,
                  marginBottom: 2,
                }}
              >
                {pairLabel(p.fold)}{' '}
                <Text style={{ color: theme.colors.textDim }}>
                  ({p.fold.sessions.length}×)
                </Text>
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.mono400,
                  fontSize: 11,
                  color: theme.colors.textDim,
                  marginBottom: 10,
                }}
              >
                looks like {pairLabel(p.keep)} ({p.keep.sessions.length}×)
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <Chip
                  label="MERGE"
                  active
                  onPress={() => onMerge(p.fold.key, p.keep.key)}
                />
                <Chip
                  label="NOT THE SAME"
                  active={false}
                  onPress={() => onNotSame(p.fold.key, p.keep.key)}
                />
              </View>
            </View>
          ))
        : null}
    </View>
  );
}

function ExerciseList({
  index,
  query,
  sort,
  group,
  onOpen,
}: {
  index: LibraryIndex;
  query: string;
  sort: ExerciseSort;
  group: GroupFilter;
  onOpen: (exKey: string) => void;
}) {
  const list = sortExercises(
    filterByGroup(Object.values(index.exercises), group).filter(e =>
      matchesQuery(query, [e.name, e.modifier]),
    ),
    sort,
  );
  if (list.length === 0) return <NoMatches />;
  return (
    <>
      {list.map(e => (
        <View key={e.key} style={{ marginBottom: theme.space.cardGap }}>
          <ExerciseRow
            summary={e}
            best={headline(index.records[e.key])}
            onPress={() => onOpen(e.key)}
          />
        </View>
      ))}
    </>
  );
}

function PrList({
  index,
  query,
  onOpen,
}: {
  index: LibraryIndex;
  query: string;
  onOpen: (historyId: string) => void;
}) {
  const list = index.prs.filter(p => {
    const e = index.exercises[p.key];
    return matchesQuery(query, [e?.name, e?.modifier]);
  });
  if (list.length === 0) return <NoMatches />;
  return (
    <>
      {list.map((p, i) => (
        <View key={i} style={{ marginBottom: theme.space.cardGap }}>
          <PrRow
            pr={p}
            exercise={index.exercises[p.key]}
            onPress={() => {
              if (p.set.workoutId) onOpen(p.set.workoutId);
            }}
          />
        </View>
      ))}
    </>
  );
}

function ExerciseRow({
  summary,
  best,
  onPress,
}: {
  summary: LibraryEntry;
  best: ReturnType<typeof headline>;
  onPress: () => void;
}) {
  const sessions = summary.sessions.length;
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
        flexDirection: 'row',
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.display700,
              fontSize: 16,
              color: theme.colors.text,
              letterSpacing: -0.3,
            }}
          >
            {summary.name}
          </Text>
          {summary.modifier ? (
            <Text
              style={{
                fontFamily: theme.fonts.mono600,
                fontSize: 10,
                color: theme.colors.textDim,
                letterSpacing: 1.5,
                marginLeft: 8,
              }}
            >
              {summary.modifier}
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            fontFamily: theme.fonts.mono400,
            fontSize: 11,
            color: theme.colors.textDim,
            fontVariant: ['tabular-nums'],
            letterSpacing: 0.3,
          }}
        >
          {summary.group ? `${summary.group} · ` : ''}
          {plural(sessions, 'session')} · last{' '}
          {fmtShortDate(summary.sessions[0]?.completedAtMs)}
        </Text>
      </View>
      {best ? (
        <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 9,
              color: theme.colors.textDim,
              letterSpacing: 1.5,
              marginBottom: 4,
            }}
          >
            BEST
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.mono600,
              fontSize: 14,
              color: theme.colors.pr,
              fontVariant: ['tabular-nums'],
            }}
          >
            {fmtSet(best)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function PrRow({
  pr,
  exercise,
  onPress,
}: {
  pr: PrEvent;
  exercise: ExerciseSummary | undefined;
  onPress: () => void;
}) {
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
        <Text
          style={{
            fontFamily: theme.fonts.mono700,
            fontSize: 9,
            color: theme.colors.textDim,
            letterSpacing: 1.8,
          }}
        >
          {fmtDate(pr.set.completedAtMs)}
        </Text>
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
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          marginBottom: 6,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.display700,
            fontSize: 16,
            color: theme.colors.text,
            letterSpacing: -0.3,
          }}
        >
          {exercise?.name ?? ''}
        </Text>
        {exercise?.modifier ? (
          <Text
            style={{
              fontFamily: theme.fonts.mono600,
              fontSize: 10,
              color: theme.colors.textDim,
              letterSpacing: 1.5,
              marginLeft: 8,
            }}
          >
            {exercise.modifier}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: theme.fonts.mono600,
          fontSize: 14,
          color: theme.colors.pr,
          fontVariant: ['tabular-nums'],
        }}
      >
        {fmtSet(pr.set)}
        <Text
          style={{
            fontFamily: theme.fonts.mono400,
            fontSize: 11,
            color: theme.colors.textDim,
          }}
        >
          {'  '}prev {fmtSet(pr.prev)}
        </Text>
      </Text>
    </Pressable>
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
