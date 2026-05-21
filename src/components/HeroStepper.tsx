import { Text, View } from 'react-native';
import { theme } from '../theme';
import { StepButton } from './StepButton';

type Props = {
  label: string;
  value: number | string;
  unit?: string;
  onMinus: () => void;
  onPlus: () => void;
  dimmed?: boolean;
};

export function HeroStepper({
  label,
  value,
  unit,
  onMinus,
  onPlus,
  dimmed,
}: Props) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        opacity: dimmed ? 0.35 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.mono700,
          fontSize: 9,
          color: theme.colors.textDim,
          letterSpacing: 1.8,
          marginBottom: 10,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'stretch',
        }}
      >
        <StepButton label="−" onPress={onMinus} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: theme.fonts.display700,
            fontSize: 50,
            color: theme.colors.text,
            letterSpacing: -1.5,
            fontVariant: ['tabular-nums'],
            paddingHorizontal: 8,
          }}
        >
          {value}
        </Text>
        <StepButton label="+" onPress={onPlus} />
      </View>
      {unit ? (
        <Text
          style={{
            fontFamily: theme.fonts.mono400,
            fontSize: 10,
            color: theme.colors.textMuted,
            letterSpacing: 1.2,
            marginTop: 10,
          }}
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}
