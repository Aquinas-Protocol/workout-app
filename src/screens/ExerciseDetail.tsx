import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import {
  fmtSet,
  headline,
  keyLabel,
  repMaxBoard,
  type ExerciseRecords,
  type ExerciseSummary,
} from '../records';
import { matchesQuery } from '../historyLogic';
import {
  MUSCLE_GROUPS,
  type LibraryEntry,
  type LibraryMeta,
} from '../library';
import { SetPill } from '../components/SetPill';
import { Chip } from '../components/Chip';

type Props = {
  summary: LibraryEntry;
  records: ExerciseRecords | undefined;
  // Alias keys currently merged into this exercise.
  mergedHere: string[];
  // Other canonical exercises this one can be merged into.
  mergeTargets: ExerciseSummary[];
  onBack: () => void;
  onOpenWorkout: (historyId: string) => void;
  onMerge: (intoKey: string) => void;
  onUnmerge: (aliasKey: string) => void;
  onEdit: (patch: Partial<LibraryMeta>) => void;
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

function fmtShortDate(ms: number | undefined): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function ExerciseDetailScreen({
  summary,
  records,
  mergedHere,
  mergeTargets,
  onBack,
  onOpenWorkout,
  onMerge,
  onUnmerge,
  onEdit,
}: Props) {
  const [merging, setMerging] = useState(false);
  const [mergeQuery, setMergeQuery] = useState('');
  const [notes, setNotes] = useState(summary.notes ?? '');
  const saveNotes = () => {
    const next = notes.trim();
    if (next !== (summary.notes ?? '')) onEdit({ notes: next });
  };
  const board = repMaxBoard(records);
  const best = headline(records);
  const targets = mergeTargets.filter(t =>
    matchesQuery(mergeQuery, [t.name, t.modifier]),
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      {/* top nav */}
      <View style={{ paddingHorizontal: theme.space.edgeSide }}>
        <Pressable
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => ({
            paddingVertical: 6,
            alignSelf: 'flex-start',
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
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* title block */}
        <View style={{ paddingHorizontal: 4, paddingTop: 18 }}>
          <Text
            style={{
              fontFamily: theme.fonts.mono600,
              fontSize: 10,
              color: theme.colors.textDim,
              letterSpacing: 2,
              marginBottom: 6,
            }}
          >
            EXERCISE{summary.modifier ? ` · ${summary.modifier}` : ''}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.display700,
              fontSize: 32,
              color: theme.colors.text,
              letterSpacing: -1,
              lineHeight: 36,
            }}
          >
            {summary.name}
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}
          >
            {MUSCLE_GROUPS.map(g => (
              <Chip
                key={g}
                label={g}
                active={summary.group === g}
                onPress={() => {
                  if (summary.group !== g) onEdit({ group: g });
                }}
              />
            ))}
          </View>
        </View>

        {/* stats row */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 4, paddingTop: 18 }}>
          <Stat label="SESSIONS" value={String(summary.sessions.length)} />
          <Stat label="BEST" value={best ? fmtSet(best) : '—'} pr={!!best} />
          <Stat
            label="LAST"
            value={fmtShortDate(summary.sessions[0]?.completedAtMs)}
          />
        </View>

        {/* notes */}
        <View style={{ marginTop: 18 }}>
          <SectionLabel>NOTES</SectionLabel>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onBlur={saveNotes}
            placeholder="Cues, grip, seat or pin settings"
            placeholderTextColor={theme.colors.textGhost}
            multiline
            style={{
              minHeight: 64,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.line,
              borderWidth: 1,
              borderRadius: theme.radii.cardPast,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontFamily: theme.fonts.sans400,
              fontSize: 14,
              lineHeight: 20,
              color: theme.colors.text,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* rep records */}
        {board.length > 0 || records?.bw ? (
          <View style={{ marginTop: 18 }}>
            <SectionLabel>REP RECORDS</SectionLabel>
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.cardPast,
                borderWidth: 1,
                borderColor: theme.colors.line,
                paddingHorizontal: 16,
                paddingVertical: 6,
              }}
            >
              {board.map(row => (
                <RecordRow
                  key={row.reps}
                  label={`${row.reps} REP${row.reps === 1 ? '' : 'S'}`}
                  value={`${row.best.weight} lb${row.best.ea ? ' ea' : ''}`}
                  note={
                    row.best.reps !== row.reps
                      ? `via ${row.best.reps}× · ${fmtShortDate(row.best.completedAtMs)}`
                      : fmtShortDate(row.best.completedAtMs)
                  }
                />
              ))}
              {records?.bw ? (
                <RecordRow
                  label="BODYWEIGHT"
                  value={`${records.bw.reps} reps`}
                  note={fmtShortDate(records.bw.completedAtMs)}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* sessions */}
        <View style={{ marginTop: 18 }}>
          <SectionLabel>SESSIONS</SectionLabel>
          {summary.sessions.map((s, i) => (
            <Pressable
              key={s.workoutId ?? i}
              onPress={() => {
                if (s.workoutId) onOpenWorkout(s.workoutId);
              }}
              style={({ pressed }) => ({
                marginBottom: theme.space.cardGap,
                padding: 16,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.cardPast,
                borderWidth: 1,
                borderColor: theme.colors.line,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 9,
                  color: theme.colors.textDim,
                  letterSpacing: 1.8,
                  marginBottom: 4,
                }}
              >
                {fmtDate(s.completedAtMs)}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.display700,
                  fontSize: 15,
                  color: theme.colors.text,
                  letterSpacing: -0.3,
                }}
              >
                {s.title}
              </Text>
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}
              >
                {s.sets.map((set, j) => (
                  <View key={j} style={{ marginRight: 6, marginBottom: 6 }}>
                    <SetPill
                      set={set}
                      idx={j}
                      active={false}
                      onPress={() => {
                        if (s.workoutId) onOpenWorkout(s.workoutId);
                      }}
                    />
                  </View>
                ))}
              </View>
            </Pressable>
          ))}
        </View>

        {/* display name: any spelling logged under this exercise */}
        {summary.spellings.length > 1 ? (
          <View style={{ marginTop: 10 }}>
            <SectionLabel>DISPLAY NAME</SectionLabel>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', marginLeft: 4 }}
            >
              {summary.spellings.map(sp => {
                const label = sp.modifier ? `${sp.name} (${sp.modifier})` : sp.name;
                const active =
                  sp.name === summary.name && sp.modifier === summary.modifier;
                return (
                  <Chip
                    key={label}
                    label={label}
                    active={active}
                    onPress={() => {
                      if (!active) onEdit({ spelling: sp });
                    }}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {/* merged here */}
        {mergedHere.length > 0 ? (
          <View style={{ marginTop: 10 }}>
            <SectionLabel>MERGED HERE</SectionLabel>
            {mergedHere.map(k => (
              <View
                key={k}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  marginBottom: 6,
                  backgroundColor: theme.colors.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.line,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontFamily: theme.fonts.mono600,
                    fontSize: 12,
                    color: theme.colors.textMuted,
                  }}
                >
                  {keyLabel(k)}
                </Text>
                <Pressable hitSlop={8} onPress={() => onUnmerge(k)}>
                  <Text
                    style={{
                      fontFamily: theme.fonts.mono700,
                      fontSize: 10,
                      color: theme.colors.accent,
                      letterSpacing: 1.2,
                    }}
                  >
                    UNMERGE
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* merge into another exercise */}
        {mergeTargets.length > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Pressable
              onPress={() => setMerging(m => !m)}
              style={({ pressed }) => ({
                height: 44,
                borderRadius: theme.radii.cta,
                borderWidth: 1.5,
                borderColor: theme.colors.line,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 11,
                  color: theme.colors.textMuted,
                  letterSpacing: 1.2,
                }}
              >
                {merging ? 'CANCEL MERGE' : 'MERGE INTO…'}
              </Text>
            </Pressable>
            {merging ? (
              <View style={{ marginTop: 10 }}>
                <Text
                  style={{
                    fontFamily: theme.fonts.sans400,
                    fontSize: 13,
                    color: theme.colors.textMuted,
                    lineHeight: 19,
                    marginBottom: 10,
                  }}
                >
                  Same lift under a different name? Merge it into the right
                  exercise: past sets combine and PRs are recalculated. You can
                  unmerge later.
                </Text>
                <TextInput
                  value={mergeQuery}
                  onChangeText={setMergeQuery}
                  placeholder="Search exercises"
                  placeholderTextColor={theme.colors.textGhost}
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    fontFamily: theme.fonts.mono400,
                    fontSize: 13,
                    color: theme.colors.text,
                    marginBottom: 8,
                  }}
                />
                {targets.map(t => (
                  <Pressable
                    key={t.key}
                    onPress={() => onMerge(t.key)}
                    style={({ pressed }) => ({
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      marginBottom: 6,
                      backgroundColor: theme.colors.surface,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.colors.line,
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: theme.fonts.display700,
                        fontSize: 14,
                        color: theme.colors.text,
                      }}
                    >
                      {t.name}
                    </Text>
                    {t.modifier ? (
                      <Text
                        style={{
                          fontFamily: theme.fonts.mono600,
                          fontSize: 10,
                          color: theme.colors.textDim,
                          letterSpacing: 1.5,
                          marginLeft: 8,
                        }}
                      >
                        {t.modifier}
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        flex: 1,
                        textAlign: 'right',
                        fontFamily: theme.fonts.mono400,
                        fontSize: 11,
                        color: theme.colors.textDim,
                      }}
                    >
                      {t.sessions.length}×
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
        marginLeft: 4,
      }}
    >
      {children}
    </Text>
  );
}

function RecordRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          width: 96,
          fontFamily: theme.fonts.mono700,
          fontSize: 10,
          color: theme.colors.textDim,
          letterSpacing: 1.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.mono600,
          fontSize: 14,
          color: theme.colors.pr,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          flex: 1,
          textAlign: 'right',
          fontFamily: theme.fonts.mono400,
          fontSize: 10,
          color: theme.colors.textDim,
        }}
      >
        {note}
      </Text>
    </View>
  );
}

function Stat({
  label,
  value,
  pr,
}: {
  label: string;
  value: string;
  pr?: boolean;
}) {
  return (
    <View style={{ marginRight: 22 }}>
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
      <Text
        style={{
          fontFamily: theme.fonts.display700,
          fontSize: 22,
          color: pr ? theme.colors.pr : theme.colors.text,
          letterSpacing: -0.5,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
