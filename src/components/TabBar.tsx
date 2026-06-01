import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

export type TabKey = 'week' | 'history';

type Props = {
  active: TabKey;
  onSelect: (key: TabKey) => void;
};

// Root-level navigation between the Week hub and the History hub.
// Sits above the iOS home indicator via safe-area-inset.bottom.
export function TabBar({ active, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingBottom: insets.bottom,
        backgroundColor: theme.colors.bg,
        borderTopWidth: 1,
        borderTopColor: theme.colors.line,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <Tab label="WEEK" tabKey="week" active={active} onSelect={onSelect} />
        <Tab
          label="HISTORY"
          tabKey="history"
          active={active}
          onSelect={onSelect}
        />
      </View>
    </View>
  );
}

function Tab({
  label,
  tabKey,
  active,
  onSelect,
}: {
  label: string;
  tabKey: TabKey;
  active: TabKey;
  onSelect: (key: TabKey) => void;
}) {
  const isActive = active === tabKey;
  return (
    <Pressable
      onPress={() => onSelect(tabKey)}
      hitSlop={6}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.fonts.mono700,
          fontSize: 11,
          color: isActive ? theme.colors.accent : theme.colors.textMuted,
          letterSpacing: 1.8,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
