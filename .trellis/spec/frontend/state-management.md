# Frontend State Management

## Pinia Setup and Store Shape

`src/main.ts` installs one Pinia instance for the root app. All three current stores use Pinia's options-store form:

```ts
defineStore('feature-id', {
  state: () => ({}),
  getters: {},
  actions: {},
})
```

Real stores:

- `src/store/auth.ts` — authenticated identity, getters, persistence, login/register/logout actions.
- `src/store/agent.ts` — chat messages, profile, streaming workflow, narration/video signals, session persistence.
- `src/store/community.ts` — community lists/details, filters, loading/error/submission state, moderation workflows.

Store files are singular lowercase domain names and export `useXStore`. Store ids are lowercase feature ids (`auth`, `agent`, `community`).

## What Goes Where

### Local component state

Keep state local when it controls one component or one view and does not need durable sharing.

- `src/components/InputBox.vue` owns its draft text.
- `src/views/CommunityView.vue` owns editor visibility, draft form fields, and toolbar inputs.
- `src/views/LoginView.vue` owns active tab, form fields, submission flags, and the resend countdown.

### Shared feature state

Use Pinia when multiple components/screens need the data, when actions coordinate several API calls, or when the data is persisted.

- `src/store/community.ts` shares the selected post and replies between list/detail/admin workflows.
- `src/store/agent.ts` shares chat, user profile, playback signals, and demo mode across chat/digital-human views.
- `src/store/auth.ts` shares role-aware identity with `src/App.vue` and `src/views/LoginView.vue`.

### Application navigation state

The current application does not use Vue Router. `src/App.vue` keeps `activeSection`, `activeHubPage`, `communityView`, and `currentPostId` in local refs and chooses views with `v-if`/`v-else-if`. Preserve this model for changes that fit the existing flow; do not write route-dependent store code without a separate routing change.

## API and Async Workflow

Stores import focused functions from `src/api/` rather than building request URLs inline.

- `src/store/community.ts` delegates transport to `src/api/community.ts` and refreshes dependent lists after mutations.
- `src/store/agent.ts` delegates streaming transport to `src/api/llm.ts` and updates the placeholder message through callbacks.
- `src/store/auth.ts` delegates credential requests to `src/api/auth.ts` and applies the returned `AuthUser`.

Shared loading and error state is explicit. Community actions clear `lastError`, set a relevant loading/submitting flag, and reset the flag in `finally`. Views such as `src/views/AdminReviewView.vue`, `src/views/CommunityView.vue`, and `src/views/PostDetailView.vue` translate action outcomes into `ElMessage` feedback.

Some load actions intentionally absorb errors and expose `lastError`; mutation/detail actions that callers must react to rethrow after setting `lastError`. Preserve the action's existing caller contract rather than assuming every action throws.

## Persistence and Hydration

Persistence is manual and feature-owned; there is no Pinia persistence plugin.

- `src/store/auth.ts` uses `ai-campus-agent.auth.v4`, guards browser storage access, parses a narrow persisted shape, normalizes the role, and resets invalid data.
- `src/store/agent.ts` uses `ai-campus-agent.session.v2`, persists only profile/messages/demo mode, validates restored message fields, and removes corrupt cache data.
- `src/App.vue` calls `authStore.hydrate()` on mount; `src/views/AgentChat.vue` and `src/views/DigitalHumanPanel.vue` call `hydrateSession()` before initializing their agent UI.

Treat `localStorage` data as untrusted. Add fields to the persisted type, write payload, and hydration validation together.

## Store Consumption

Current SFCs keep the store object intact and access state/getters/actions directly; the repository does not use `storeToRefs`.

Examples:

- `src/App.vue` reads `authStore.loggedIn` and `authStore.isAdmin`.
- `src/views/AgentChat.vue` reads `store.messages` and invokes agent actions.
- `src/views/CommunityView.vue` reads `store.meta`, `store.posts`, and filter actions.

Do not destructure reactive store state into plain variables. If a future change introduces `storeToRefs`, do it because destructuring is required, not as unrelated churn.

## Avoid

- Do not put draft-only input state in a global store.
- Do not duplicate a store's domain state in several views without an explicit synchronization step.
- Do not persist loading flags, errors, media handles, or other transient browser state.
- Do not call `localStorage` without the browser guard used by the auth and agent stores.
- Do not move HTTP response parsing into UI templates or duplicate request helpers inside views.
