# Stadium

Personal offline-first workout-logging PWA. Live at [aquinas-protocol.github.io/workout-app](https://aquinas-protocol.github.io/workout-app).

Built to match how I already log workouts in Apple Notes (`BENCH PRESS (DB) 4 SETS X 10 REPS ...`) and to work at the gym with no network: install it once on iPhone (Safari: Share, then Add to Home Screen) and it runs fully offline.

## Scope note

This is a personal daily-use app, not a product. It is tuned to one person's logging habits: no backend, no accounts, no analytics, and no roadmap beyond what I need at the gym.

## Features

- Live workout sessions: set steppers, set pills, bodyweight toggle, supersets, live timer, PR detection
- Week container: 2 to 5 workouts per week, each timed independently, with "repeat last week" templates
- Apple Notes paste-import: paste a week straight from Notes shorthand
- History: past-workout list plus a detail view with PR badges and per-exercise breakdowns
- Installable offline PWA: cache-first service worker, all state in local storage

## Stack

- Expo SDK 54 / React Native 0.81 / TypeScript
- Runs natively (Expo Go) and as a static web build via react-native-web
- AsyncStorage for persistence (backed by localStorage on web)
- Jest (~28 tests over the pure logic modules: workout, week, and the Apple Notes parser)

## Development

```bash
npm install
npm start          # Expo dev server
npm run web        # web target
npm test           # Jest
npm run typecheck  # tsc --noEmit
```

## Deploy

Deploy ONLY with:

```bash
npm run deploy
```

`npm run deploy` runs `scripts/deploy-web.mjs`, which exports the web build and publishes `dist` to the `gh-pages` branch from an isolated worktree with forced adds.

Do not publish with a plain `gh-pages` tool. Expo emits the app's fonts under `assets/node_modules/@expo-google-fonts/...`, and `.gitignore` excludes `node_modules/`, so a plain `git add` silently drops all 32 font files; the deployed app then waits forever on its font gate and white-screens. Treat `gh-pages` as a disposable, force-pushed artifact branch.
