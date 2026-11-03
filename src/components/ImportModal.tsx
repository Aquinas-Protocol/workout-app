import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../theme';
import { parseAppleNotes } from '../appleNotes';
import type { Workout } from '../types';
import type { Aliases } from '../records';
import {
  applyAnswers,
  resolveImport,
  type ImportQuestion,
  type LibraryEntry,
} from '../library';
import { Chip } from './Chip';

type Props = {
  visible: boolean;
  onClose: () => void;
  onImport: (workout: Workout) => void;
  // The exercise library, to catch near-duplicate names before they're saved.
  library: Record<string, LibraryEntry>;
  aliases: Aliases;
  distinct: string[];
  onKeepNew: (pairs: [string, string][]) => void;
};

type Review = { workout: Workout; questions: ImportQuestion[] };

const spellingLabel = (s: { name: string; modifier?: string }) =>
  s.modifier ? `${s.name} (${s.modifier})` : s.name;

const PLACEHOLDER = `BENCH PRESS (DB) 4 SETS X 10 REPS

DUMBBELL SEATED PRESS 4x10

WEIGHTED CHEST DIPS 4x10
5 BW

LATERAL RAISE 4x10

DEADLIFT 5 SETS X 5, 4, 3, 2, 1`;

export function ImportModal({
  visible,
  onClose,
  onImport,
  library,
  aliases,
  distinct,
  onKeepNew,
}: Props) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  // Set while the user answers "Did you mean…" for near-duplicate names.
  const [review, setReview] = useState<Review | null>(null);
  // Exercise id → chosen entry key, or null for "keep as new".
  const [answers, setAnswers] = useState<Record<string, string | null>>({});

  const reset = () => {
    setTitle('');
    setText('');
    setErrors([]);
    setWarnings([]);
    setReview(null);
    setAnswers({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImport = () => {
    const result = parseAppleNotes(text, title);
    if (!result.ok) {
      setErrors(result.errors);
      setWarnings(result.warnings);
      return;
    }
    setWarnings(result.warnings);
    setErrors([]);
    const resolved = resolveImport(result.workout, library, aliases, distinct);
    if (resolved.questions.length > 0) {
      setReview(resolved);
      setAnswers({});
      return;
    }
    onImport(resolved.workout);
    reset();
  };

  const allAnswered =
    !!review && review.questions.every(q => q.exId in answers);

  const handleConfirm = () => {
    if (!review || !allAnswered) return;
    const done = applyAnswers(review.workout, review.questions, answers, library);
    if (done.distinct.length > 0) onKeepNew(done.distinct);
    onImport(done.workout);
    reset();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
        <View
          style={{
            backgroundColor: theme.colors.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 24,
            maxHeight: '85%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.display700,
                fontSize: 22,
                color: theme.colors.text,
                letterSpacing: -0.4,
              }}
            >
              New workout
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 11,
                  color: theme.colors.textMuted,
                  letterSpacing: 1.5,
                }}
              >
                ✕ CLOSE
              </Text>
            </Pressable>
          </View>

          {review ? (
            <ScrollView
              style={{ flexGrow: 0, maxHeight: 360 }}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.sans400,
                  fontSize: 13,
                  color: theme.colors.textMuted,
                  lineHeight: 19,
                  marginBottom: 12,
                }}
              >
                {review.questions.length === 1 ? 'This name is' : 'These names are'}{' '}
                new but look like exercises you've logged. Pick one to keep
                your history in one place, or keep it as a new exercise.
              </Text>
              {review.questions.map(q => (
                <View
                  key={q.exId}
                  style={{
                    padding: 14,
                    marginBottom: 10,
                    backgroundColor: theme.colors.surface,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.line,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.display700,
                      fontSize: 16,
                      color: theme.colors.text,
                      marginBottom: 4,
                    }}
                  >
                    {spellingLabel(q.asked)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: theme.fonts.mono700,
                      fontSize: 9,
                      color: theme.colors.textDim,
                      letterSpacing: 1.8,
                      marginBottom: 8,
                    }}
                  >
                    DID YOU MEAN…
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {q.candidates.map(c => (
                      <Chip
                        key={c.key}
                        label={`${spellingLabel(c)} · ${c.sessions.length}×`}
                        active={answers[q.exId] === c.key}
                        onPress={() => setAnswers(a => ({ ...a, [q.exId]: c.key }))}
                      />
                    ))}
                    <Chip
                      label="KEEP AS NEW"
                      active={q.exId in answers && answers[q.exId] === null}
                      onPress={() => setAnswers(a => ({ ...a, [q.exId]: null }))}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <>
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 9,
                  color: theme.colors.textDim,
                  letterSpacing: 1.8,
                  marginBottom: 6,
                }}
              >
                TITLE
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="UPPER PUSH"
                placeholderTextColor={theme.colors.textGhost}
                autoCapitalize="characters"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.line,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontFamily: theme.fonts.display700,
                  fontSize: 18,
                  color: theme.colors.text,
                  letterSpacing: -0.3,
                  marginBottom: 14,
                }}
              />

              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 9,
                  color: theme.colors.textDim,
                  letterSpacing: 1.8,
                  marginBottom: 6,
                }}
              >
                EXERCISES
              </Text>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={PLACEHOLDER}
                placeholderTextColor={theme.colors.textGhost}
                multiline
                autoCapitalize="characters"
                autoCorrect={false}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.line,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontFamily: theme.fonts.mono400,
                  fontSize: 13,
                  color: theme.colors.text,
                  minHeight: 180,
                  textAlignVertical: 'top',
                }}
              />

              {(errors.length > 0 || warnings.length > 0) && (
                <ScrollView
                  style={{ marginTop: 10, maxHeight: 100 }}
                  showsVerticalScrollIndicator={false}
                >
                  {errors.map((e, i) => (
                    <Text
                      key={`e${i}`}
                      style={{
                        fontFamily: theme.fonts.mono400,
                        fontSize: 11,
                        color: theme.colors.accent,
                        marginBottom: 4,
                      }}
                    >
                      ! {e}
                    </Text>
                  ))}
                  {warnings.map((w, i) => (
                    <Text
                      key={`w${i}`}
                      style={{
                        fontFamily: theme.fonts.mono400,
                        fontSize: 11,
                        color: theme.colors.textDim,
                        marginBottom: 4,
                      }}
                    >
                      · {w}
                    </Text>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          <View
            style={{
              flexDirection: 'row',
              marginTop: 14,
            }}
          >
            <Pressable
              onPress={review ? () => setReview(null) : handleClose}
              style={({ pressed }) => ({
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: theme.radii.cta,
                borderWidth: 1.5,
                borderColor: theme.colors.line,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.mono700,
                  fontSize: 12,
                  color: theme.colors.textDim,
                  letterSpacing: 1.2,
                }}
              >
                {review ? '← EDIT' : 'CANCEL'}
              </Text>
            </Pressable>
            <Pressable
              onPress={review ? handleConfirm : handleImport}
              disabled={review ? !allAnswered : text.trim().length === 0}
              style={({ pressed }) => ({
                flex: 1,
                marginLeft: 10,
                height: 44,
                borderRadius: theme.radii.cta,
                backgroundColor: (review ? !allAnswered : text.trim().length === 0)
                  ? theme.colors.surface2
                  : theme.colors.accent,
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
                  color: (review ? !allAnswered : text.trim().length === 0)
                    ? theme.colors.textDim
                    : theme.colors.bg,
                  letterSpacing: -0.2,
                }}
              >
                {review ? 'ADD WORKOUT' : 'IMPORT'}{' '}
                <Text style={{ opacity: 0.6 }}>›</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
