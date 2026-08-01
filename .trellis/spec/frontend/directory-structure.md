# Frontend Directory Structure

## Scope

This guide covers the root Vue application under `src/`. `server/` is a separate Node layer, and `mobile-uniapp/` is a separate client with its own dependencies and conventions.

## Actual Layout

```text
src/
├── main.ts                 # createApp, Pinia registration, global CSS
├── App.vue                 # app shell and state-driven screen selection
├── views/                  # screen-sized feature composition
├── components/             # reusable UI building blocks
├── store/                  # Pinia options stores and shared workflows
├── api/                    # fetch clients and transport decoding
├── types/                  # shared domain and response shapes
├── config/                 # environment-backed and static configuration
├── utils/                  # small pure helpers
├── assets/                 # global CSS tokens and motion utilities
└── project-text/           # imported source corpus; not application code
```

## Placement Rules Observed in the Repository

### Application bootstrap and shell

`src/main.ts` only creates the Vue app, installs Pinia, loads global CSS, and mounts. `src/App.vue` owns top-level layout, authentication gating, and the current screen.

Examples:

- `src/main.ts` registers `createPinia()` and imports `tokens.css` and `motion.css`.
- `src/App.vue` switches between home, chat, community, detail, and admin views with local union-typed refs.
- `src/App.vue` hydrates authentication once when the shell mounts.

There is no Vue Router. Do not assume route params, route guards, or a `router/` directory exist when extending the current screen flow.

### Views versus components

Put a screen-sized feature or workflow composition in `src/views/`. Put a reusable UI unit with a props/events boundary in `src/components/`.

View examples:

- `src/views/AgentChat.vue` composes the chat window, input, digital-human player, and agent store.
- `src/views/CommunityView.vue` owns the community list/filter/editor workflow.
- `src/views/PostDetailView.vue` owns post-detail loading and reply submission.

Component examples:

- `src/components/InputBox.vue` owns input UI and emits submitted text.
- `src/components/ChatWindow.vue` renders message lists and owns scroll-to-latest behavior.
- `src/components/SourcePanel.vue` renders reusable source metadata and link actions.

Component and view filenames are PascalCase. TypeScript modules and folders use lowercase domain names such as `api/community.ts`, `store/auth.ts`, and `types/agent.ts`.

### State, transport, and types are separate layers

Shared feature state and multi-step workflows live in `src/store/`; raw HTTP work lives in `src/api/`; cross-file domain shapes live in `src/types/`.

Examples:

- `src/store/community.ts` coordinates loading flags, filters, submissions, and list refreshes, while `src/api/community.ts` builds requests.
- `src/store/agent.ts` coordinates streaming chat state, while `src/api/llm.ts` parses the NDJSON stream.
- `src/types/community.ts` supplies the shapes used by both `src/api/community.ts` and `src/store/community.ts`.

Do not put direct `fetch` calls in a store when the feature already has an API module, and do not duplicate shared response shapes in multiple views.

### Config, utilities, and assets stay narrow

- `src/config/app.ts` resolves `import.meta.env` values and exports immutable application configuration.
- `src/config/agent.ts` holds the static campus-agent prompt configuration; `src/config/app.ts` is the current runtime configuration entry point.
- `src/utils/text.ts` exports a pure text-normalization helper used by `src/components/DigitalHumanPlayer.vue`.
- `src/assets/tokens.css` and `src/assets/motion.css` are the global style foundation imported by `src/main.ts`.

Keep one-off display helpers local to a view, as the existing date/status helpers in `src/views/AdminReviewView.vue`, `src/views/CommunityView.vue`, and `src/views/PostDetailView.vue` do. Move a helper to `src/utils/` only when it is genuinely shared and remains independent of Vue state.

### Imported project material is not UI source

`src/project-text/` contains hundreds of imported documents and JSON exports used as project material. It does not contain Vue application modules. Do not add components, stores, APIs, or type declarations there.

## Imports

Nested frontend modules normally use the `@/` alias configured in `vite.config.ts` and `tsconfig.app.json`.

Examples:

- `src/views/AgentChat.vue` imports `@/components/ChatWindow.vue` and `@/store/agent`.
- `src/store/community.ts` imports `@/api/community` and `@/types/community`.
- `src/components/DigitalHumanPlayer.vue` imports `@/api/tts` and `@/utils/text`.

Close sibling components sometimes use relative imports, for example `src/components/ChatWindow.vue` imports `./MessageItem.vue`, and `src/components/MessageItem.vue` imports `./SourcePanel.vue`. `src/main.ts` and `src/App.vue` also use relative imports at the application root. Preserve the surrounding style rather than rewriting imports only for uniformity.

## Avoid

- Do not apply the root Vue conventions to `mobile-uniapp/`.
- Do not create a route-based architecture for a small change; the current app uses state-driven view selection in `src/App.vue`.
- Do not treat `src/project-text/` as a code package.
- Do not move API decoding, persisted domain state, and presentation into one `.vue` file when the existing feature already separates those layers.
