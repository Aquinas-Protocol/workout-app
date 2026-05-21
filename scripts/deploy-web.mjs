// One-command web deploy to GitHub Pages.
//
// Why this exists instead of the `gh-pages` package: Expo emits font assets
// under `assets/node_modules/@expo-google-fonts/...`, and the repo .gitignore
// lists `node_modules/`. The `gh-pages` tool clones the repo and runs a plain
// `git add`, which silently skips those font files → the deployed app waits
// forever for fonts and renders a white screen. This script publishes the dist
// from an isolated worktree with `git add -A -f`, overriding .gitignore.

import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const wt = path.join(tmpdir(), 'workout-app-ghpages');
const BRANCH = 'gh-pages';

const sh = (cmd, opts = {}) =>
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
const shQuiet = (cmd, opts = {}) => {
  try {
    execSync(cmd, { stdio: 'ignore', cwd: root, ...opts });
  } catch {
    /* tolerated */
  }
};

console.log('▶ Building web export…');
sh('npx expo export --platform web');

console.log('▶ Preparing gh-pages worktree…');
shQuiet(`git fetch -q origin ${BRANCH}`);
rmSync(wt, { recursive: true, force: true });
try {
  sh(`git worktree add -q "${wt}" ${BRANCH}`);
  // Align the worktree to the remote tip so a stale local branch can't diverge.
  shQuiet(`git reset --hard origin/${BRANCH}`, { cwd: wt });
} catch {
  sh(`git worktree add -q --orphan -b ${BRANCH} "${wt}"`);
}

try {
  console.log('▶ Publishing dist…');
  shQuiet('git rm -rqf .', { cwd: wt });
  cpSync(dist, wt, { recursive: true });
  sh('git add -A -f', { cwd: wt });
  shQuiet('git commit -q -m "Deploy web build"', { cwd: wt });
  // Force push: gh-pages is a disposable build-artifact branch.
  sh(`git push -q -f origin ${BRANCH}`, { cwd: wt });
  console.log('✓ Deployed to https://aquinas-protocol.github.io/workout-app/');
} finally {
  shQuiet(`git worktree remove --force "${wt}"`);
}
