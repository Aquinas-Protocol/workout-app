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

type Props = {
  visible: boolean;
  onClose: () => void;
  onImport: (workout: Workout) => void;
};

const PLACEHOLDER = `BENCH PRESS (DB) 4 SETS X 10 REPS

DUMBBELL SEATED PRESS 4x10

WEIGHTED CHEST DIPS 4x10
5 BW

LATERAL RAISE 4x10

DEADLIFT 5 SETS X 5, 4, 3, 2, 1`;

export function ImportModal({ visible, onClose, onImport }: Props) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const reset = () => {
    setTitle('');
    setText('');
    setErrors([]);
    setWarnings([]);
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
    onImport(result.workout);
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

          <View
            style={{
              flexDirection: 'row',
              marginTop: 14,
            }}
          >
            <Pressable
              onPress={handleClose}
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
                CANCEL
              </Text>
            </Pressable>
            <Pressable
              onPress={handleImport}
              disabled={text.trim().length === 0}
              style={({ pressed }) => ({
                flex: 1,
                marginLeft: 10,
                height: 44,
                borderRadius: theme.radii.cta,
                backgroundColor:
                  text.trim().length === 0
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
                  color:
                    text.trim().length === 0
                      ? theme.colors.textDim
                      : theme.colors.bg,
                  letterSpacing: -0.2,
                }}
              >
                IMPORT{' '}
                <Text style={{ opacity: 0.6 }}>›</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
