import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';
import type { Workout } from '../types';
import { totalTargetSets } from '../workoutLogic';
import { ImportModal } from '../components/ImportModal';

type Props = {
  onCancel: () => void;
  onStartWeek: (label: string | undefined, templates: Workout[]) => void;
  initialLabel?: string;
  initialTemplates?: Workout[];
};

export function ImportWeekScreen({
  onCancel,
  onStartWeek,
  initialLabel,
  initialTemplates,
}: Props) {
  const [label, setLabel] = useState(initialLabel ?? '');
  const [workouts, setWorkouts] = useState<Workout[]>(
    initialTemplates ? initialTemplates.map(t => JSON.parse(JSON.stringify(t))) : [],
  );
  const [importVisible, setImportVisible] = useState(false);

  const addWorkout = (w: Workout) => {
    setWorkouts(prev => [...prev, w]);
    setImportVisible(false);
  };

  const removeAt = (idx: number) => {
    setWorkouts(prev => prev.filter((_, i) => i !== idx));
  };

  const canStart = workouts.length > 0;

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
        <Pressable hitSlop={8} onPress={onCancel}>
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 11,
              color: theme.colors.textMuted,
              letterSpacing: 1.5,
            }}
          >
            ✕ CANCEL
          </Text>
        </Pressable>
      </View>

      {/* title block */}
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
          NEW WEEK
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.display700,
            fontSize: 28,
            color: theme.colors.text,
            letterSpacing: -0.6,
            marginBottom: 14,
          }}
        >
          Build your week.
        </Text>
      </View>

      {/* week label input */}
      <View
        style={{
          paddingHorizontal: theme.space.edgeSide,
          marginBottom: 14,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.mono700,
            fontSize: 9,
            color: theme.colors.textDim,
            letterSpacing: 1.8,
            marginBottom: 6,
          }}
        >
          LABEL (OPTIONAL)
        </Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Push/Pull/Legs · Week 1"
          placeholderTextColor={theme.colors.textGhost}
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.line,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontFamily: theme.fonts.display700,
            fontSize: 16,
            color: theme.colors.text,
            letterSpacing: -0.2,
          }}
        />
      </View>

      {/* workout list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.space.edgeSide,
          paddingBottom: 30,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontFamily: theme.fonts.mono700,
            fontSize: 9,
            color: theme.colors.textDim,
            letterSpacing: 1.8,
            marginBottom: 8,
          }}
        >
          WORKOUTS ({workouts.length})
        </Text>

        {workouts.length === 0 ? (
          <Text
            style={{
              fontFamily: theme.fonts.sans400,
              fontSize: 13,
              color: theme.colors.textGhost,
              marginBottom: 14,
              lineHeight: 18,
            }}
          >
            No workouts yet. Tap "+ ADD WORKOUT" to paste one from your notes.
          </Text>
        ) : (
          workouts.map((w, i) => (
            <View
              key={i}
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.colors.line,
                paddingVertical: 12,
                paddingHorizontal: 14,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontFamily: theme.fonts.mono700,
                    fontSize: 9,
                    color: theme.colors.textDim,
                    letterSpacing: 1.8,
                    marginBottom: 2,
                  }}
                >
                  WORKOUT {i + 1}
                </Text>
                <Text
                  style={{
                    fontFamily: theme.fonts.display700,
                    fontSize: 16,
                    color: theme.colors.text,
                    letterSpacing: -0.3,
                    marginBottom: 2,
                  }}
                >
                  {w.title}
                </Text>
                <Text
                  style={{
                    fontFamily: theme.fonts.mono400,
                    fontSize: 11,
                    color: theme.colors.textDim,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {w.exercises.length} ex · {totalTargetSets(w)} sets
                </Text>
              </View>
              <Pressable
                onPress={() => removeAt(i)}
                hitSlop={8}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.mono700,
                    fontSize: 11,
                    color: theme.colors.textDim,
                    letterSpacing: 1.2,
                  }}
                >
                  ✕
                </Text>
              </Pressable>
            </View>
          ))
        )}

        <Pressable
          onPress={() => setImportVisible(true)}
          style={({ pressed }) => ({
            marginTop: 6,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: theme.colors.line,
            borderStyle: 'dashed',
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 12,
              color: theme.colors.textMuted,
              letterSpacing: 1.2,
            }}
          >
            + ADD WORKOUT
          </Text>
        </Pressable>
      </ScrollView>

      {/* bottom CTA */}
      <View
        style={{
          paddingHorizontal: theme.space.edgeSide,
          paddingTop: 10,
          paddingBottom: 18,
          borderTopWidth: 1,
          borderTopColor: theme.colors.line,
          backgroundColor: theme.colors.bg,
        }}
      >
        <Pressable
          onPress={() =>
            onStartWeek(label.trim() || undefined, workouts)
          }
          disabled={!canStart}
          style={({ pressed }) => ({
            height: 50,
            borderRadius: theme.radii.cta,
            backgroundColor: canStart
              ? theme.colors.accent
              : theme.colors.surface2,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: theme.fonts.display700,
              fontSize: 16,
              color: canStart ? theme.colors.bg : theme.colors.textDim,
              letterSpacing: -0.2,
            }}
          >
            START WEEK <Text style={{ opacity: 0.6 }}>›</Text>
          </Text>
        </Pressable>
      </View>

      <ImportModal
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        onImport={addWorkout}
      />
    </SafeAreaView>
  );
}
