# Frontend Type Safety

## Compiler and Vue Baseline

The root frontend is checked by `vue-tsc --build`. `tsconfig.app.json` extends `@vue/tsconfig/tsconfig.dom.json`, includes `src/**/*` and Vue SFCs, and maps `@/*` to `src/*`. Every current Vue component uses `<script setup lang="ts">`.

Configuration examples: `tsconfig.json`, `tsconfig.app.json`, and `env.d.ts`.

## Where Types Live

### Shared domain types

Put shapes shared by APIs, stores, and components in `src/types/`.

- `src/types/agent.ts` defines `Message` and `MessageSource` for API, store, and chat components.
- `src/types/community.ts` defines post, reply, knowledge, metadata, pagination, and generic review-list shapes.
- `src/components/MessageItem.vue`, `src/store/agent.ts`, and `src/api/llm.ts` all consume the agent types instead of redefining them.

### Module-local contracts

Keep a type next to its only consumer when it is an implementation detail.

- `PersistedAuthState` and `AuthRole` stay in `src/store/auth.ts`.
- `PersistedAgentSession` stays in `src/store/agent.ts`.
- `ApiEnvelope<T>` stays in `src/api/community.ts`.
- View-only unions such as `UserRole` and `GradeValue` stay in `src/views/AgentChat.vue` and `src/views/DigitalHumanPanel.vue`.

### API contracts

Use typed payloads/results at API boundaries and generic request helpers where one response envelope is reused.

- `src/api/community.ts` uses `request<T>` and returns typed community response models.
- `src/api/auth.ts` uses `post<T>` and exports the shared `AuthUser` response type.
- `src/api/llm.ts` defines `ChatApiResponse` and `StreamChatHandlers` for non-streaming and streaming callers.

There is no generated API client or schema source of truth, so a backend response change must be reflected manually in the API module and any shared `src/types/` contract.

## Component Contracts

Props and emits are declared with macro generics, not runtime prop objects.

- `src/components/ChatWindow.vue` types `Message[]`, optional loading, and the post-opening event payload.
- `src/components/SourcePanel.vue` types optional display props and supplies defaults with `withDefaults`.
- `src/views/LoginView.vue` types its `login-success` role payload.

Use DOM element unions for template refs, for example `HTMLDivElement | null` in `src/components/ChatWindow.vue`, `HTMLVideoElement | null` in `src/components/DigitalHumanPlayer.vue`, and `HTMLIFrameElement | null` in `src/views/AdminLightRagView.vue`.

## Literal Unions, Records, and Immutable Config

Literal unions describe small closed domains throughout the current codebase.

- Message roles/statuses in `src/types/agent.ts`.
- Community categories/statuses/source types in `src/types/community.ts`.
- App shell states in `src/App.vue`.

Use `Record` when keys are a known union or a runtime string map, as in the role labels in `src/views/AgentChat.vue`, status/profile labels in `src/store/agent.ts`, and request headers in `src/api/tts.ts`.

Environment-backed application configuration is resolved once and exported `as const` from `src/config/app.ts`.

## Imports and Inference

Use `import type` for type-only dependencies. Examples include `src/api/community.ts`, `src/components/MessageItem.vue`, and `src/store/agent.ts`. The auth store intentionally combines a value import and `type AuthUser` in one import in `src/store/auth.ts`.

The codebase generally relies on return-type inference for local helpers and store actions, while annotating public async boundaries such as `requestBackendTts(...): Promise<Blob>`, `sendChat(...): Promise<ChatApiResponse>`, and `streamChat(...): Promise<ChatApiResponse>`.

## Untrusted Data and Existing Type Debt

Safer current code receives unknown values and narrows them:

- `src/views/LoginView.vue` accepts `error: unknown` and narrows before reading fields.
- `src/store/auth.ts` normalizes a persisted `unknown` role and validates parsed fields.
- `src/api/community.ts` parses a response as `ApiEnvelope<T> | null` and validates success before returning data.

Legacy `any` still exists at fetch/stream error boundaries in `src/api/auth.ts`, `src/api/llm.ts`, and the `sendMessage` catch block in `src/store/agent.ts`. This is current technical debt, not a rule to copy. Prefer the `unknown`-and-narrow pattern above when adding a new boundary; do not perform unrelated mass rewrites when touching these files.

Type assertions are used where runtime APIs are wider than the known local shape, such as parsed storage in `src/store/auth.ts`, event targets in `src/views/PortfolioHome.vue`, and palette keys in `src/components/RobotAvatar.vue`. Keep assertions narrow and pair them with runtime checks when the value comes from storage, JSON, or the network.

## Avoid

- Do not duplicate cross-layer domain shapes inside views.
- Do not turn optional backend fields into required frontend fields without runtime guarantees.
- Do not treat parsed JSON or `localStorage` data as trustworthy solely because it was asserted.
- Do not add broad `any` when `unknown`, a generic, a literal union, or a small boundary type can describe the value.
