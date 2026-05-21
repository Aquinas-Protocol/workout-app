// Design tokens for the Stadium workout app.
// Source: design_handoff_stadium_workout_app/README.md §"Design Tokens".

export const theme = {
  colors: {
    bg: '#0E0F12',
    surface: '#181A1F',
    surface2: '#22252C',
    surface3: '#2A2E36',
    line: 'rgba(255,255,255,0.08)',
    lineStrong: 'rgba(255,255,255,0.16)',

    text: '#F4F5F7',
    textMuted: 'rgba(244,245,247,0.70)',
    textDim: 'rgba(244,245,247,0.50)',
    textGhost: 'rgba(244,245,247,0.22)',

    accent: '#FF5C2A',
    good: '#5DDB95',
    danger: '#FF5C5C',
    pr: '#FFCB45',
    prFill: 'rgba(255,203,69,0.14)',
    prBorder: 'rgba(255,203,69,0.33)',
    accentFill: 'rgba(255,92,42,0.12)',
  },

  // Font family names match the exact constants exported by @expo-google-fonts.
  // Always reference these directly as `fontFamily`. Never combine with `fontWeight`.
  fonts: {
    display400: 'BricolageGrotesque_400Regular',
    display600: 'BricolageGrotesque_600SemiBold',
    display700: 'BricolageGrotesque_700Bold',
    sans400: 'Geist_400Regular',
    mono400: 'JetBrainsMono_400Regular',
    mono500: 'JetBrainsMono_500Medium',
    mono600: 'JetBrainsMono_600SemiBold',
    mono700: 'JetBrainsMono_700Bold',
  },

  space: {
    edgeTop: 18,
    edgeSide: 18,
    cardRow: 16,
    cardGap: 10,
    cardPadCollapsed: { vertical: 14, horizontal: 16 },
    cardPadFocused: { top: 16, horizontal: 16, bottom: 4 },
    pillPad: { vertical: 6, horizontal: 10 },
    statGap: 18,
    pillGap: 6,
  },

  radii: {
    card: 20,
    cardPast: 18,
    pill: 8,
    cta: 12,
    prBanner: 16,
  },

  anim: {
    pulseMs: 1600,
    progressMs: 320,
  },
} as const;

export type Theme = typeof theme;
