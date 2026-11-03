import type { MuscleGroup } from '../library';

// Starting muscle groups for every exercise logged up to 2026-11-03, keyed by
// exerciseKey(). A fallback only: the user's own tags win, and exercises
// logged later start untagged.
export const SEED_GROUPS: Record<string, MuscleGroup> = {
  'BENCH PRESS|': 'CHEST',
  'BENCH PRESS|BB': 'CHEST',
  'BENCH PRESS|DB': 'CHEST',
  'INCLINE PRESS|': 'CHEST',
  'INCLINE BARBELL PRESS|': 'CHEST',
  'FLOOR PRESS|BB': 'CHEST',
  'DB FLY|': 'CHEST',
  'DIP|': 'CHEST',
  'DIP|WEIGHTED': 'CHEST',
  'WEIGHTED CHEST DIP|': 'CHEST',

  'DEADLIFT|': 'BACK',
  'TRAP BAR DEADLIFT|': 'BACK',
  'TRAP BAR DL|': 'BACK',
  'RACK PULL|': 'BACK',
  'BENT OVER ROW|': 'BACK',
  'T BAR ROW|': 'BACK',
  'SINGLE ARM DB ROW|': 'BACK',
  'SINGLE ARM ROW|': 'BACK',
  'PULL UP|WEIGHTED': 'BACK',
  'PULL DOWN|': 'BACK',
  'PULLOVER|': 'BACK',
  'SHRUG|': 'BACK',

  'OVERHEAD PRESS|': 'SHOULDERS',
  'PUSH PRESS|': 'SHOULDERS',
  'LANDMINE PRESS|': 'SHOULDERS',
  'LATERAL RAISE|': 'SHOULDERS',
  'FRONT RAISE|BB': 'SHOULDERS',
  'FACE PULL|DB': 'SHOULDERS',
  'BARBELL HIGH PULL|': 'SHOULDERS',

  'BARBELL CURL|': 'ARMS',
  'ALT HAMMER CURL|': 'ARMS',
  'SKULL CRUSHER|': 'ARMS',
  'CABLE ROPE EXT|': 'ARMS',
  'CLOSE GRIP PRESS|': 'ARMS',

  'BACK SQUAT|': 'LEGS',
  'FRONT SQUAT|': 'LEGS',
  'ZERCHER SQUAT|': 'LEGS',
  'HACK SQUAT|BB': 'LEGS',
  'LEG PRESS|': 'LEGS',
  'LEG CURL|': 'LEGS',
  'LYING HAMSTRING CURL|': 'LEGS',
  'LEG EXT|': 'LEGS',
  'ROMANIAN DEADLIFT|': 'LEGS',
  'DUMBBELL RDL|': 'LEGS',
  'GOOD MORNING|': 'LEGS',
  'GLUTE BRIDGE|': 'LEGS',
  'STANDING CALF RAISE|': 'LEGS',
  'SEATED CALF RAISE|': 'LEGS',

  'CORE OBLIQUE CRUNCH|': 'CORE',

  'HANG CLEAN PRESS|': 'FULL BODY',
  'HANG CLEAN AND PRESS|DB': 'FULL BODY',
  'KB SWING|': 'FULL BODY',
};
