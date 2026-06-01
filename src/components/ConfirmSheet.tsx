import { Pressable, Text, View } from 'react-native';
import { theme } from '../theme';

export type ConfirmAction = {
  label: string;
  style?: 'default' | 'destructive' | 'cancel';
  onPress?: () => void;
};

export type ConfirmConfig = {
  title: string;
  message?: string;
  actions: ConfirmAction[];
};

// Cross-platform replacement for Alert.alert (react-native-web has no Alert).
// Renders as a plain absolutely-positioned overlay rather than RN Modal,
// because installed iOS PWAs can fail to render Modal portals reliably,
// leaving the End workout / End week buttons feeling broken.
export function ConfirmSheet({
  config,
  onDismiss,
}: {
  config: ConfirmConfig | null;
  onDismiss: () => void;
}) {
  if (!config) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        elevation: 1000,
      }}
    >
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 360,
            backgroundColor: theme.colors.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.colors.line,
            padding: 20,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.display700,
              fontSize: 20,
              color: theme.colors.text,
              letterSpacing: -0.4,
              marginBottom: config?.message ? 8 : 16,
            }}
          >
            {config?.title}
          </Text>
          {config?.message ? (
            <Text
              style={{
                fontFamily: theme.fonts.sans400,
                fontSize: 14,
                color: theme.colors.textMuted,
                lineHeight: 20,
                marginBottom: 18,
              }}
            >
              {config.message}
            </Text>
          ) : null}
          <View style={{ gap: 8 }}>
            {config?.actions.map((a, i) => {
              const isPrimary = !a.style || a.style === 'default';
              const isDestructive = a.style === 'destructive';
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    onDismiss();
                    a.onPress?.();
                  }}
                  style={({ pressed }) => ({
                    height: 46,
                    borderRadius: theme.radii.cta,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isPrimary
                      ? theme.colors.accent
                      : 'transparent',
                    borderWidth: isPrimary ? 0 : 1.5,
                    borderColor: theme.colors.line,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: isPrimary
                        ? theme.fonts.display700
                        : theme.fonts.mono700,
                      fontSize: isPrimary ? 15 : 12,
                      letterSpacing: isPrimary ? -0.2 : 1.2,
                      color: isPrimary
                        ? theme.colors.bg
                        : isDestructive
                          ? theme.colors.danger
                          : theme.colors.textMuted,
                    }}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </View>
  );
}
