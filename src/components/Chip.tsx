import { Pressable, Text } from 'react-native';
import { theme } from '../theme';

// Small tappable tag: muscle-group filters and pickers.
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginRight: 6,
        marginBottom: 6,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: active ? theme.colors.accent : theme.colors.line,
        backgroundColor: active ? theme.colors.accentFill : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.fonts.mono700,
          fontSize: 10,
          color: active ? theme.colors.accent : theme.colors.textDim,
          letterSpacing: 1.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
