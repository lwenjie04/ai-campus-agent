# Frontend Quality Guidelines

## Required Tooling

The root `package.json` defines the authoritative frontend checks:

| Command                   | What it does                                                         |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run lint`            | Runs Oxlint and ESLint with auto-fix enabled                         |
| `npm run type-check`      | Runs `vue-tsc --build`                                               |
| `npm run build`           | Runs type-check and the production Vite build in parallel            |
| `npm run build-only`      | Runs only `vite build`                                               |
| `npm run format`          | Runs Prettier on `src/`                                              |
| `npm run codegraph:index` | Refreshes CodeGraph after source changes, as required by `CLAUDE.md` |

Lint configuration lives in `eslint.config.ts` and `.oxlintrc.json`. Formatting is defined by `.prettierrc.json` and `.editorconfig`: two-space indentation, UTF-8, LF, final newline, no semicolons, single quotes, and a 100-column target.

Because the lint script fixes files, inspect `git diff` after running it and keep unrelated user changes out of the task.

## Test Reality

There is currently no Vitest, Cypress, Playwright, or other frontend test dependency/configuration, and no root frontend `*.test.*` or `*.spec.*` files. Do not report automated frontend tests as passing when only lint/type-check/build ran.

For behavior changes, combine the available static checks with focused manual verification in the Vite app. Relevant flows include:

- Chat send, streaming state, narration, and source navigation (`src/views/AgentChat.vue`, `src/store/agent.ts`, `src/components/DigitalHumanPlayer.vue`).
- Login/register/countdown/logout (`src/views/LoginView.vue`, `src/store/auth.ts`, `src/App.vue`).
- Community list/detail/post/reply/review workflows (`src/views/CommunityView.vue`, `src/views/PostDetailView.vue`, `src/views/AdminReviewView.vue`).

Adding the first test runner is a separate project decision, not something to hide inside an unrelated UI fix.

## Async and Error UX

Prevent duplicate work with loading/submitting flags and always restore them in `finally`.

- `src/views/LoginView.vue` tracks concurrent login/register/code requests with separate flags.
- `src/store/community.ts` exposes list/detail/review/submission flags and a user-readable `lastError`.
- `src/views/AdminLightRagView.vue` exposes checking/offline state around the health request.

Surface user-action failures rather than swallowing them. `src/views/CommunityView.vue`, `src/views/PostDetailView.vue`, and `src/views/AdminReviewView.vue` display success/error/warning feedback through `ElMessage`. Intentional fallbacks may be silent when the UI supplies an alternative, as `src/components/DigitalHumanPlayer.vue` falls back from backend TTS to browser speech.

## Accessibility Baseline

The current code has useful but incomplete accessibility coverage:

- Native buttons and a labeled navigation landmark in `src/App.vue`.
- Keyboard submission handlers in `src/components/InputBox.vue` and `src/views/LoginView.vue`.
- Status/decorative ARIA in `src/components/DigitalHumanPlayer.vue` and labeled hero content in `src/views/PortfolioHome.vue`.
- Reduced-motion CSS in `src/App.vue`, `src/components/ChatWindow.vue`, and `src/views/PortfolioHome.vue`.

For each new interactive element, manually verify keyboard reachability, visible focus, an accessible name/label, disabled/loading behavior, and reduced-motion behavior. Prefer native `<button>`/`<a href>` elements over click handlers on non-interactive elements. The project has no automated accessibility checker, so do not claim conformance from build success alone.

## Responsive and Visual Consistency

Component-local media queries are the established responsive mechanism.

- `src/views/AgentChat.vue` changes layout at 768px and 1024px.
- `src/views/CommunityView.vue` and `src/views/PostDetailView.vue` adapt at 900px.
- `src/components/InputBox.vue`, `src/components/MessageItem.vue`, and `src/views/LoginView.vue` adapt around 680px.

Reuse global custom properties from `src/assets/tokens.css` and motion utilities from `src/assets/motion.css` when the surrounding design uses them. Scoped files also contain feature-specific custom properties and literal colors, especially `src/views/PortfolioHome.vue`; preserve the local system rather than converting an entire screen incidentally.

Check both narrow and wide layouts when changing a view, and verify overflow/scroll behavior for chat, dialogs, tables, long source titles, and long Chinese content.

## Browser Resource Safety

Clean up resources created by a component:

- `src/components/DigitalHumanPlayer.vue` stops audio/video, cancels speech, and revokes object URLs.
- `src/components/RobotAvatar.vue` cancels its animation frame.
- `src/views/LoginView.vue` clears its interval.

When adding event listeners, timers, observers, animation frames, object URLs, or media playback, include the matching cleanup path and verify repeated mount/unmount behavior.

## Handoff Checklist

- [ ] The change follows the appropriate directory/component/state/type guide.
- [ ] `npm run lint` completed and its auto-fix diff was reviewed, or equivalent non-fixing lint checks were run when preserving a dirty worktree.
- [ ] `npm run type-check` completed.
- [ ] `npm run build` completed for source/config changes.
- [ ] Relevant user flows were manually checked when behavior or layout changed.
- [ ] Accessibility, responsive layout, loading/error states, and resource cleanup were considered.
- [ ] `npm run codegraph:index` was run after source changes; documentation-only edits do not require a source re-index.
- [ ] No automated-test claim is made unless a real frontend test command was added and run.
