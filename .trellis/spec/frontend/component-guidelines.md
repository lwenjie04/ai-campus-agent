# Vue Component Guidelines

## Single-File Component Shape

Root frontend components use Vue SFCs in this order:

1. `<template>`
2. `<script setup lang="ts">`
3. `<style scoped>`

Examples: `src/components/InputBox.vue`, `src/components/DigitalHumanPlayer.vue`, and `src/views/LoginView.vue` all follow this shape. Keep styles scoped unless a rule genuinely belongs in the global token/motion layer.

## Props

Declare props with TypeScript generic syntax. Required inputs are non-optional; optional inputs use `?`.

Examples:

- `src/components/InputBox.vue` requires `loading: boolean`.
- `src/views/PostDetailView.vue` requires `postId: string`.
- `src/components/DigitalHumanPlayer.vue` requires cue/play signals and makes narration/stop/source inputs optional.

Bind the macro to `const props` only when the script reads the values. `src/components/ChatWindow.vue` and `src/components/SourcePanel.vue` read from `props`; `src/components/MessageItem.vue` calls `defineProps` without a binding because its prop is only used in the template.

Use `withDefaults` when an optional prop has a stable component default.

Examples:

- `src/components/RobotAvatar.vue` defaults `cueKey` to `idle`.
- `src/components/SourcePanel.vue` defaults `expanded`, `compact`, and `maxVisible`.

## Emits and Parent/Child Boundaries

Emit domain actions instead of mutating parent state. Type event names and payloads with `defineEmits`.

Examples:

- `src/components/InputBox.vue` emits submitted text and immediately clears only its local input.
- `src/components/SourcePanel.vue` emits a community post id instead of navigating itself.
- `src/views/LoginView.vue` emits the resolved login role after the auth store succeeds.

Existing event names are mixed: `send` and `back-list` are kebab-case contracts, while `openCommunityPost` and `login-success` also exist. Vue templates often listen with kebab-case even when the TypeScript event is camelCase. Preserve an existing component's public spelling when editing it; avoid renaming events as incidental cleanup.

If an emit is used only in the template, a bare typed `defineEmits` is normal (`src/views/CommunityView.vue`, `src/views/AdminReviewView.vue`). Bind it to `const emit` when the script calls it (`src/views/AgentChat.vue`, `src/components/DigitalHumanPlayer.vue`).

## Local State and Derived Values

Use `ref` for mutable component/UI state and `computed` for values derived from props or stores.

Examples:

- `src/views/CommunityView.vue` keeps dialog, filter-input, and form state in local refs.
- `src/views/AgentChat.vue` derives visible messages, the profile summary, and source count with computed values.
- `src/components/DigitalHumanPlayer.vue` derives the normalized cue, video source, and status labels from props.

Move state to Pinia only when it crosses screens/components, represents domain workflow state, or must persist. The split between `src/views/CommunityView.vue` and `src/store/community.ts` is the main example.

## Store and API Use

Views usually connect stores to UI workflows; lower-level components receive typed props and emit events.

- Store-connected views: `src/views/AgentChat.vue`, `src/views/CommunityView.vue`, `src/views/PostDetailView.vue`.
- Prop/event components: `src/components/InputBox.vue`, `src/components/ChatWindow.vue`, `src/components/MessageItem.vue`.
- A component may call a focused service when the behavior belongs to that component, as `src/components/DigitalHumanPlayer.vue` calls `requestBackendTts` for playback.

Element Plus SFC components are auto-resolved by Vite and therefore appear as `<el-input>`, `<el-select>`, and similar tags without imports. Import JavaScript APIs explicitly, as `src/views/LoginView.vue`, `src/views/CommunityView.vue`, and `src/views/AdminReviewView.vue` do for `ElMessage`.

## Styling

The current frontend combines scoped component CSS with global custom properties.

- Use tokens from `src/assets/tokens.css` for shared spacing, typography, color, radius, shadow, and motion values where the surrounding file already does so.
- Use `:deep(...)` for scoped overrides of Element Plus internals, as in `src/views/LoginView.vue`.
- Keep responsive rules near the component they affect. Examples include `src/components/InputBox.vue`, `src/views/CommunityView.vue`, and `src/views/AdminReviewView.vue`.
- Preserve reduced-motion handling for animated UI. Examples: `src/App.vue`, `src/components/DigitalHumanPlayer.vue`, and `src/views/PortfolioHome.vue`.

## DOM and Resource Cleanup

Pair long-lived browser effects with lifecycle cleanup.

- `src/components/DigitalHumanPlayer.vue` stops video/audio and revokes object URLs in `onBeforeUnmount`.
- `src/components/RobotAvatar.vue` cancels its animation frame in `onBeforeUnmount`.
- `src/views/LoginView.vue` clears the verification countdown interval in `onBeforeUnmount`.

## Accessibility Patterns Present Today

Use native interactive elements and preserve the limited accessibility annotations already present.

- `src/App.vue` uses a labeled `<nav>` and native `<button>` elements.
- `src/components/DigitalHumanPlayer.vue` uses `role="status"` for fallback status and `aria-hidden` for decoration.
- `src/components/SourcePanel.vue` uses real links and `rel="noreferrer"` for new-tab links.

The repository does not have automated accessibility tests, so new controls still require manual keyboard, focus, label, and reduced-motion review.
