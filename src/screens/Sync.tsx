import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import type { SyncError } from '../syncLogic';

type Props = {
  enabled: boolean;
  pending: number;
  error: SyncError | null;
  busy: boolean;
  onEnable: (token: string) => void;
  onSyncNow: () => void;
  onRestore: () => void;
  onDisable: () => void;
  onBack: () => void;
};

const ERROR_TEXT: Record<SyncError, string> = {
  auth: 'The server rejected the token. Turn sync off and enter it again.',
  network: "Can't reach the server. Pending workouts upload when you're back online.",
  server: 'The server had a problem. It will retry automatically.',
};

export function SyncScreen({
  enabled,
  pending,
  error,
  busy,
  onEnable,
  onSyncNow,
  onRestore,
  onDisable,
  onBack,
}: Props) {
  const [token, setToken] = useState('');

  const status = !enabled
    ? { label: 'OFF', color: theme.colors.textDim }
    : error === 'auth'
      ? { label: 'TOKEN REJECTED', color: theme.colors.danger }
      : pending > 0
        ? {
            label: `${pending} WORKOUT${pending === 1 ? '' : 'S'} PENDING`,
            color: theme.colors.textMuted,
          }
        : { label: '✓ ALL BACKED UP', color: theme.colors.good };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <View style={{ paddingHorizontal: theme.space.edgeSide }}>
        <Pressable
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => ({
            paddingVertical: 6,
            alignSelf: 'flex-start',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: theme.fonts.mono600,
              fontSize: 11,
              color: theme.colors.textMuted,
              letterSpacing: 1.5,
            }}
          >
            ← HISTORY
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.space.edgeSide,
          paddingTop: 18,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
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
          BACKUP
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.display700,
            fontSize: 28,
            color: theme.colors.text,
            letterSpacing: -0.6,
          }}
        >
          Cloud sync
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.mono700,
            fontSize: 11,
            color: status.color,
            letterSpacing: 1.5,
            marginTop: 8,
          }}
        >
          {status.label}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.sans400,
            fontSize: 14,
            color: theme.colors.textMuted,
            lineHeight: 20,
            marginTop: 14,
          }}
        >
          Every saved workout is copied to your private cloud database
          automatically. Offline at the gym? It uploads the next time you're
          online. This device keeps its own copy either way.
        </Text>

        {error ? (
          <Note
            color={
              error === 'auth' || !enabled
                ? theme.colors.danger
                : theme.colors.textDim
            }
          >
            {enabled
              ? ERROR_TEXT[error]
              : error === 'auth'
                ? 'That token was rejected. Check it and try again.'
                : "Can't reach the sync server. Check your connection and try again."}
          </Note>
        ) : null}

        {!enabled ? (
          <View style={{ marginTop: 22 }}>
            <Text
              style={{
                fontFamily: theme.fonts.mono700,
                fontSize: 10,
                color: theme.colors.textDim,
                letterSpacing: 1.8,
                marginBottom: 6,
              }}
            >
              SYNC TOKEN
            </Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              placeholder="Paste your token"
              placeholderTextColor={theme.colors.textGhost}
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="none"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.line,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontFamily: theme.fonts.mono400,
                fontSize: 14,
                color: theme.colors.text,
              }}
            />
            <Button
              label={busy ? 'CHECKING…' : 'TURN ON SYNC'}
              primary
              disabled={busy || token.trim().length === 0}
              onPress={() => onEnable(token.trim())}
            />
          </View>
        ) : (
          <View style={{ marginTop: 22 }}>
            <Button
              label={busy ? 'WORKING…' : 'SYNC NOW'}
              primary
              disabled={busy}
              onPress={onSyncNow}
            />
            <Button
              label="RESTORE FROM CLOUD"
              disabled={busy}
              onPress={onRestore}
            />
            <Text
              style={{
                fontFamily: theme.fonts.sans400,
                fontSize: 12,
                color: theme.colors.textDim,
                lineHeight: 18,
                marginTop: 8,
              }}
            >
              Restore adds any workouts the cloud has that this device
              doesn't. It never removes anything here.
            </Text>
            <Button label="TURN OFF SYNC" disabled={busy} onPress={onDisable} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Note({ color, children }: { color: string; children: string }) {
  return (
    <Text
      style={{
        fontFamily: theme.fonts.sans400,
        fontSize: 13,
        color,
        lineHeight: 19,
        marginTop: 12,
      }}
    >
      {children}
    </Text>
  );
}

function Button({
  label,
  primary,
  disabled,
  onPress,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 46,
        marginTop: 12,
        borderRadius: theme.radii.cta,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? theme.colors.accent : 'transparent',
        borderWidth: primary ? 0 : 1.5,
        borderColor: theme.colors.line,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: primary ? theme.fonts.display700 : theme.fonts.mono700,
          fontSize: primary ? 15 : 12,
          letterSpacing: primary ? -0.2 : 1.2,
          color: primary ? theme.colors.bg : theme.colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
