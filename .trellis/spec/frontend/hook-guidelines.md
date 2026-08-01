# Reactive Logic and Composable Guidelines

## Current State: No Custom Composable Layer

The root frontend currently has no `src/composables/` or `src/hooks/` directory and no custom Vue composable modules. Do not claim that a `useFeature` composable pattern is established here.

The only current `use*` APIs are Pinia stores:

- `useAgentStore` in `src/store/agent.ts`
- `useAuthStore` in `src/store/auth.ts`
- `useCommunityStore` in `src/store/community.ts`

These names identify stores, not custom hooks.

## Where Reactive Logic Lives Today

Feature-specific reactive logic stays in the SFC that owns the UI.

- `src/components/ChatWindow.vue` watches message length/loading and scrolls after `nextTick`.
- `src/components/DigitalHumanPlayer.vue` watches cue/narration/stop signals and owns audio/video lifecycle state.
- `src/views/PortfolioHome.vue` owns its intersection observer, cursor behavior, marquee, and animation-frame loops.

Shared reactive domain state lives in Pinia instead of a composable. `src/store/agent.ts`, `src/store/auth.ts`, and `src/store/community.ts` are the real examples.

Shared non-reactive behavior uses focused modules:

- `src/utils/text.ts` contains pure text normalization.
- `src/api/community.ts` and `src/api/llm.ts` contain reusable transport logic.
- `src/config/app.ts` contains environment-backed configuration resolution.

## Lifecycle and Watch Patterns

Use Vue lifecycle hooks for browser work tied to a component's lifetime, and clean up timers, media, event listeners, or animation frames that survive a render.

Examples:

- `src/views/LoginView.vue` starts a countdown interval and clears it in `onBeforeUnmount`.
- `src/components/RobotAvatar.vue` starts `requestAnimationFrame` in `onMounted` and cancels it in `onBeforeUnmount`.
- `src/components/DigitalHumanPlayer.vue` uses `onBeforeUnmount` to stop media and invalidate queued playback.

Use `watch` when a side effect must follow reactive input; use `computed` for pure derivation.

- `src/components/ChatWindow.vue` watches message/loading changes because scrolling is a DOM side effect.
- `src/components/DigitalHumanPlayer.vue` watches signal props because playback is a browser side effect.
- `src/views/AgentChat.vue` uses computed values for filtered messages and display summaries rather than watchers.

## Async Side Effects

Async functions normally set state before work, use `try/catch/finally`, and restore flags in `finally`.

- `src/views/LoginView.vue` tracks `sendingCode`, `submittingLogin`, and `submittingRegister` around async actions.
- `src/views/AdminLightRagView.vue` tracks `checking` around its health request.
- `src/store/community.ts` owns shared loading/submitting flags for multi-view community workflows.

Use `void` only when intentionally starting an async side effect without awaiting it, as the queue drain in `src/components/DigitalHumanPlayer.vue` does.

## Introducing the First Custom Composable

Because there is no repository precedent, do not extract a composable merely to make a component shorter. Keep one-off logic local, put shared state in Pinia, and put pure/transport logic in `utils/` or `api/` as the current code does.

If a task genuinely needs the first reusable reactive module, treat its location, `useX` name, inputs, returned refs, cleanup behavior, and tests as an explicit task decision, then update this guide with real file examples. Do not silently create both `hooks/` and `composables/` conventions.

## Avoid

- Do not call a Pinia store a custom hook.
- Do not return raw mutable module globals from component logic; current cross-component mutation goes through Pinia actions.
- Do not leave intervals, animation frames, media object URLs, or global listeners alive after unmount.
- Do not use a watcher for a value that can be expressed as a computed property.
