import { Pressable, Text, View } from 'react-native';
import { theme } from '../theme';
import type { WorkoutSet } from '../types';

type Props = {
  set: WorkoutSet;
  idx: number;
  active: boolean;
  onPress: () => void;
};

export function SetPill({ set, idx, active, onPress }: Props) {
  const done = set.reps != null;
  const skipped = !!set.skipped;

  if (skipped) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: theme.radii.pill,
          borderWidth: 1,
          borderColor: theme.colors.line,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.mono400,
            fontSize: 9,
            color: theme.colors.textGhost,
            marginRight: 6,
          }}
        >
          {idx + 1}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.mono400,
            fontSize: 12,
            color: theme.colors.textGhost,
            textDecorationLine: 'line-through',
          }}
        >
          skip
        </Text>
      </Pressable>
    );
  }

  if (done) {
    const prColor = theme.colors.pr;
    const numColor = set.pr ? prColor : theme.colors.text;
    const dimColor = set.pr ? prColor : theme.colors.textDim;
    return (
      <Pressable
        onPress={onPress}
        style={{
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: theme.radii.pill,
          backgroundColor: set.pr ? theme.colors.prFill : theme.colors.surface2,
          borderWidth: set.pr ? 1 : 1.5,
          borderColor: set.pr
            ? theme.colors.prBorder
            : active
              ? theme.colors.accent
              : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.mono400,
            fontSize: 9,
            color: dimColor,
            marginRight: 6,
          }}
        >
          {idx + 1}
        </Text>
        {set.bw ? (
          <Text
            style={{
              fontFamily: theme.fonts.mono400,
              fontSize: 12,
              color: numColor,
              fontVariant: ['tabular-nums'],
            }}
          >
            {set.reps}{' '}
            <Text style={{ color: theme.colors.textDim }}>BW</Text>
          </Text>
        ) : (
          <Text
            style={{
              fontFamily: theme.fonts.mono400,
              fontSize: 12,
              color: numColor,
              fontVariant: ['tabular-nums'],
            }}
          >
            {set.reps}
            <Text style={{ color: dimColor }}>×</Text>
            {set.weight}
            {set.ea && (
              <Text style={{ color: dimColor }}>{' ea'}</Text>
            )}
          </Text>
        )}
        {set.pr && (
          <Text
            style={{
              fontFamily: theme.fonts.mono700,
              fontSize: 9,
              color: prColor,
              letterSpacing: 1,
              marginLeft: 4,
            }}
          >
            PR
          </Text>
        )}
      </Pressable>
    );
  }

  // empty
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: theme.radii.pill,
        backgroundColor: active ? theme.colors.accentFill : 'transparent',
        borderWidth: 1.5,
        borderColor: active ? theme.colors.accent : theme.colors.line,
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.mono400,
          fontSize: 9,
          color: active ? theme.colors.accent : theme.colors.textGhost,
          marginRight: 6,
        }}
      >
        {idx + 1}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.mono400,
          fontSize: 12,
          color: active ? theme.colors.accent : theme.colors.textGhost,
        }}
      >
        —
      </Text>
    </Pressable>
  );
}
