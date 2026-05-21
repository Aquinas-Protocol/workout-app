import { useEffect, useRef } from 'react';
import { Pressable, Text } from 'react-native';
import { theme } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  big?: boolean;
};

// Hold-to-repeat tuning: tap fires once; holding past HOLD_DELAY starts
// repeating at REPEAT_MS. Latest onPress is invoked via a ref so the
// repeating closure always reads the freshest state.
const HOLD_DELAY = 400;
const REPEAT_MS = 80;

export function StepButton({ label, onPress, big }: Props) {
  const size = big ? 44 : 36;

  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    if (repeatInterval.current) {
      clearInterval(repeatInterval.current);
      repeatInterval.current = null;
    }
  };

  useEffect(() => stop, []);

  const start = () => {
    onPressRef.current();
    holdTimeout.current = setTimeout(() => {
      repeatInterval.current = setInterval(() => {
        onPressRef.current();
      }, REPEAT_MS);
    }, HOLD_DELAY);
  };

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.surface2,
        borderWidth: 1,
        borderColor: theme.colors.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: big ? 22 : 18,
          fontFamily: theme.fonts.sans400,
          lineHeight: big ? 26 : 22,
          marginTop: -2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
