import type { Workout } from '../types';

// Mirrors WORKOUT_ACTIVE from the prototype data.js.
// Note: `elapsed` and `startedAt` from the prototype are derived at runtime
// from `startedAtMs` on the ActiveSession, not stored here.
export const sampleActiveWorkout: Workout = {
  day: 'DAY 1',
  title: 'UPPER PUSH',
  dateLabel: 'TUE · WEEK 3 · NOV 12',
  intensity: '75% 1RM',
  rest: '60–90s',
  bodyweight: 178,
  exercises: [
    {
      id: 'bench',
      name: 'BENCH PRESS',
      modifier: 'DB',
      targetSets: 4,
      targetReps: 10,
      lastTime: '10 @ 35 ea · 5d ago',
      sets: [
        { reps: 10, weight: 40, ea: true, done: true },
        { reps: 8, weight: 40, ea: true, done: true },
        { reps: 9, weight: 40, ea: true, done: true, pr: true },
        { reps: null, weight: 40, ea: true, done: false },
      ],
    },
    {
      id: 'dbpress',
      name: 'DUMBBELL SEATED PRESS',
      targetSets: 4,
      targetReps: 10,
      lastTime: '10 @ 20 ea · 5d ago',
      sets: [
        { reps: null, weight: null, ea: true, done: false },
        { reps: null, weight: null, ea: true, done: false },
        { reps: null, weight: null, ea: true, done: false },
        { reps: null, weight: null, ea: true, done: false },
      ],
    },
    {
      id: 'dips',
      name: 'WEIGHTED CHEST DIPS',
      targetSets: 4,
      targetReps: 10,
      lastTime: '5 @ BW · 12d ago',
      sets: [
        { reps: null, weight: null, bw: true, done: false },
        { reps: null, weight: null, bw: true, done: false },
        { reps: null, weight: null, bw: true, done: false },
        { reps: null, weight: null, bw: true, done: false },
      ],
    },
    {
      id: 'lat',
      name: 'LATERAL RAISE',
      targetSets: 4,
      targetReps: 10,
      lastTime: '9 @ 10 ea · 5d ago',
      sets: [
        { reps: null, weight: null, ea: true, done: false },
        { reps: null, weight: null, ea: true, done: false },
        { reps: null, weight: null, ea: true, done: false },
        { reps: null, weight: null, ea: true, done: false },
      ],
    },
  ],
  workoutNote: 'Felt strong on bench — moved up to 40s.',
};
