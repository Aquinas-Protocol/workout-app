import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

type Props = {
  onStartNew: () => void;
  onRepeatLast?: () => void;
};

export function EmptyWeekState({ onStartNew, onRepeatLast }: Props) {
  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg,
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
          letterSpacing: 2,
          marginBottom: 10,
        }}
      >
        NO ACTIVE WEEK
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.display700,
          fontSize: 30,
          color: theme.colors.text,
          letterSpacing: -0.6,
          textAlign: 'center',
          marginBottom: 12,
        }}
      >
        Ready when you are.
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.sans400,
          fontSize: 14,
          color: theme.colors.textMuted,
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: 28,
          maxWidth: 300,
        }}
      >
        Build a week of workouts — paste each one from your notes, then start
        lifting.
      </Text>

      <Pressable
        onPress={onStartNew}
        style={({ pressed }) => ({
          paddingVertical: 14,
          paddingHorizontal: 24,
          borderRadius: theme.radii.cta,
          backgroundColor: theme.colors.accent,
          opacity: pressed ? 0.85 : 1,
          marginBottom: 12,
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
          + START NEW WEEK <Text style={{ opacity: 0.6 }}>›</Text>
        </Text>
      </Pressable>

      {onRepeatLast ? (
        <Pressable
          onPress={onRepeatLast}
          style={({ pressed }) => ({
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: theme.radii.cta,
            borderWidth: 1.5,
            borderColor: theme.colors.line,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: theme.fonts.mono700,
                fontSize: 12,
                color: theme.colors.textMuted,
                letterSpacing: 1.2,
              }}
            >
              ↺ REPEAT LAST WEEK
            </Text>
          </View>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
