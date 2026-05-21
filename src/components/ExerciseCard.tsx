import type { Dispatch, SetStateAction } from 'react';
import { Pressable, Text, View } from 'react-native';
import { theme } from '../theme';
import type { Draft, Exercise } from '../types';
import { exerciseDoneCount } from '../workoutLogic';
import { HeroStepper } from './HeroStepper';
import { SetPill } from './SetPill';

type Props = {
  ex: Exercise;
  focused: boolean;
  focusSetIdx: number;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  pairPartnerName: string | null;
  pairing: string | null;
  isPairTarget: boolean;
  onFocusSet: (i: number) => void;
  onFocusExercise: () => void;
  onLog: () => void;
  onSkip: () => void;
  onPair: () => void;
  onMenu: () => void;
};

export function ExerciseCard({
  ex,
  focused,
  focusSetIdx,
  draft,
  setDraft,
  pairPartnerName,
  pairing,
  isPairTarget,
  onFocusSet,
  onFocusExercise,
  onLog,
  onSkip,
  onPair,
  onMenu,
}: Props) {
  const done = exerciseDoneCount(ex);
  const isComplete = done >= ex.targetSets;
  const focusedSet = ex.sets[focusSetIdx];

  const borderColor = isPairTarget
    ? theme.colors.accent
    : focused
      ? theme.colors.lineStrong
      : theme.colors.line;
  const borderWidth = isPairTarget ? 2 : 1;

  return (
    <Pressable
      onPress={() => {
        if (!focused) onFocusExercise();
      }}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.card,
        borderColor,
        borderWidth,
        paddingTop: focused ? 16 : 14,
        paddingBottom: focused ? 4 : 14,
        paddingHorizontal: 16,
        position: 'relative',
        shadowColor: '#000',
        shadowOpacity: focused ? 0.35 : 0,
        shadowRadius: focused ? 24 : 0,
        shadowOffset: { width: 0, height: 6 },
        elevation: focused ? 4 : 0,
      }}
    >
      {pairPartnerName ? (
        <View
          style={{
            position: 'absolute',
            left: -8,
            top: 14,
            bottom: 14,
            width: 4,
            backgroundColor: theme.colors.accent,
            borderRadius: 2,
            opacity: 0.9,
          }}
        />
      ) : null}

      {/* header row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 4,
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
              {ex.targetSets}×{ex.targetReps}
            </Text>
            {ex.modifier ? (
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 9,
                  color: theme.colors.textMuted,
                  letterSpacing: 1.8,
                  marginLeft: 6,
                }}
              >
                · {ex.modifier}
              </Text>
            ) : null}
            <Text
              style={{
                fontFamily: theme.fonts.mono700,
                fontSize: 9,
                color: theme.colors.textDim,
                letterSpacing: 1.8,
                marginLeft: 6,
              }}
            >
              · {done}/{ex.targetSets}
            </Text>
            {isComplete ? (
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 9,
                  color: theme.colors.good,
                  letterSpacing: 1.8,
                  marginLeft: 6,
                }}
              >
                ✓ DONE
              </Text>
            ) : null}
            {pairPartnerName ? (
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 9,
                  color: theme.colors.accent,
                  letterSpacing: 1.8,
                  marginLeft: 6,
                }}
              >
                ↔ {pairPartnerName}
              </Text>
            ) : null}
          </View>
          <Text
            style={{
              fontFamily: theme.fonts.display700,
              fontSize: focused ? 22 : 17,
              color: theme.colors.text,
              letterSpacing: -0.4,
              lineHeight: focused ? 26 : 20,
            }}
          >
            {ex.name}
          </Text>
        </View>

        {/* card action buttons */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 8,
          }}
        >
          {pairing === ex.id ? (
            <Text
              style={{
                fontFamily: theme.fonts.mono700,
                fontSize: 9,
                color: theme.colors.accent,
                letterSpacing: 1.5,
              }}
            >
              PICK PARTNER
            </Text>
          ) : (
            <Pressable
              onPress={onPair}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: pairPartnerName
                  ? theme.colors.accent
                  : theme.colors.surface2,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: pairPartnerName
                    ? theme.colors.bg
                    : theme.colors.textMuted,
                  fontSize: 14,
                  fontFamily: theme.fonts.sans400,
                  lineHeight: 16,
                }}
              >
                ↔
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={onMenu}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: theme.colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 6,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 18,
                fontFamily: theme.fonts.sans400,
                lineHeight: 18,
                marginTop: -6,
              }}
            >
              ⋯
            </Text>
          </Pressable>
        </View>
      </View>

      {/* set pills row */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: 12,
        }}
      >
        {ex.sets.map((s, i) => (
          <View key={i} style={{ marginRight: 6, marginBottom: 6 }}>
            <SetPill
              set={s}
              idx={i}
              active={focused && i === focusSetIdx}
              onPress={() => onFocusSet(i)}
            />
          </View>
        ))}
      </View>

      {focused ? (
        <View
          style={{
            marginTop: 14,
            marginBottom: 4,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: theme.colors.line,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HeroStepper
              label="REPS"
              value={draft.reps}
              unit={`target ${ex.targetReps}`}
              onMinus={() =>
                setDraft(d => ({ ...d, reps: Math.max(0, d.reps - 1) }))
              }
              onPlus={() => setDraft(d => ({ ...d, reps: d.reps + 1 }))}
            />
            <View
              style={{
                width: 1,
                height: 84,
                backgroundColor: theme.colors.line,
              }}
            />
            <HeroStepper
              label="WEIGHT"
              value={draft.bw ? 'BW' : draft.weight}
              unit={
                draft.bw
                  ? '(bodyweight)'
                  : focusedSet?.ea
                    ? 'lb · each'
                    : 'lb'
              }
              onMinus={() =>
                setDraft(d => ({
                  ...d,
                  weight: Math.max(0, d.weight - 5),
                }))
              }
              onPlus={() =>
                setDraft(d => ({ ...d, weight: d.weight + 5 }))
              }
              dimmed={draft.bw}
            />
          </View>

          {/* BW toggle + SKIP + LOG SET row */}
          <View
            style={{
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={() => setDraft(d => ({ ...d, bw: !d.bw }))}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: theme.radii.cta,
                backgroundColor: draft.bw
                  ? theme.colors.text
                  : 'transparent',
                borderWidth: 1.5,
                borderColor: draft.bw ? 'transparent' : theme.colors.line,
                flexDirection: 'row',
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  backgroundColor: draft.bw
                    ? theme.colors.bg
                    : 'transparent',
                  borderWidth: 1.5,
                  borderColor: draft.bw
                    ? theme.colors.bg
                    : theme.colors.lineStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 6,
                }}
              >
                {draft.bw ? (
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: 9,
                      lineHeight: 10,
                      fontFamily: theme.fonts.mono700,
                    }}
                  >
                    ✓
                  </Text>
                ) : null}
              </View>
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 11,
                  color: draft.bw ? theme.colors.bg : theme.colors.textMuted,
                  letterSpacing: 1.2,
                }}
              >
                BODYWEIGHT
              </Text>
            </Pressable>
            <Pressable
              onPress={onSkip}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: theme.radii.cta,
                borderWidth: 1.5,
                borderColor: theme.colors.line,
                marginLeft: 10,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 11,
                  color: theme.colors.textDim,
                  letterSpacing: 1.2,
                }}
              >
                SKIP
              </Text>
            </Pressable>
            <Pressable
              onPress={onLog}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: theme.radii.cta,
                backgroundColor: theme.colors.accent,
                marginLeft: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.display700,
                  fontSize: 15,
                  color: theme.colors.bg,
                  letterSpacing: -0.2,
                }}
              >
                LOG SET{' '}
                <Text style={{ opacity: 0.6 }}>›</Text>
              </Text>
            </Pressable>
          </View>

          {ex.lastTime ? (
            <Text
              style={{
                marginTop: 12,
                marginBottom: 4,
                fontFamily: theme.fonts.mono400,
                fontSize: 10,
                color: theme.colors.textDim,
                letterSpacing: 0.5,
                textAlign: 'center',
              }}
            >
              last time ·{' '}
              <Text style={{ color: theme.colors.textMuted }}>
                {ex.lastTime}
              </Text>
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
