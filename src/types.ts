// Domain types for the workout app.
// Source: design_handoff_stadium_workout_app/README.md §"Data shapes".

export type WorkoutSet = {
  reps: number | null;
  weight: number | null;
  ea?: boolean;
  bw?: boolean;
  done?: boolean;
  skipped?: boolean;
  pr?: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  modifier?: string;
  targetSets: number;
  targetReps: number;
  // Per-set target reps for stacked/descending schemes, e.g. [5,4,3,2,1];
  // index-aligned with sets. Absent for uniform schemes.
  repScheme?: number[];
  lastTime?: string;
  sets: WorkoutSet[];
};

export type Workout = {
  day: string;
  title: string;
  dateLabel: string;
  intensity?: string;
  rest?: string;
  bodyweight?: number;
  exercises: Exercise[];
  workoutNote?: string;
  duration?: string;
  totalVolume?: number;
  totalSets?: number;
  totalReps?: number;
  completedAtMs?: number;
};

export type Focus = { exId: string; setIdx: number };
export type Pair = { a: string; b: string };

export type ActiveSession = {
  workout: Workout;
  focus: Focus;
  pair: Pair | null;
  startedAtMs: number;
};

export type Draft = { reps: number; weight: number; bw: boolean };

export type WorkoutState =
  | { kind: 'pending' }
  | { kind: 'in-progress'; session: ActiveSession }
  | { kind: 'completed'; summary: Workout };

export type WeekWorkout = {
  id: string;
  template: Workout;
  state: WorkoutState;
};

export type Week = {
  id: string;
  label?: string;
  workouts: WeekWorkout[];
  createdAtMs: number;
};
