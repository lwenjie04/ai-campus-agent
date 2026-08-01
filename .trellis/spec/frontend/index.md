# Vue 3 Frontend Development Guidelines

> Project-specific guidance for the root `src/` application. These files describe the repository as it exists; they do not apply to `mobile-uniapp/` or the Node server.

## Current Stack

- Vue 3.5 single-file components with the Composition API and `<script setup lang="ts">`
- Vite 7 and TypeScript 5.9 (`vue-tsc --build` for type checking)
- Pinia 3 options stores
- Element Plus, with component and style auto-import configured in `vite.config.ts`
- Scoped component CSS plus global tokens and motion utilities in `src/assets/`

Real stack entry points: `package.json`, `vite.config.ts`, and `src/main.ts`.

## Pre-Development Checklist

Read the files that match the work before changing the root frontend:

1. [Directory Structure](./directory-structure.md) for every frontend task.
2. [Component Guidelines](./component-guidelines.md) when editing a `.vue` file or its public props/events.
3. [Hook Guidelines](./hook-guidelines.md) when adding lifecycle logic, watchers, reusable reactive behavior, or a `use*` API.
4. [State Management](./state-management.md) when state crosses components, persists in the browser, or coordinates API workflows.
5. [Type Safety](./type-safety.md) when changing domain models, API contracts, props, events, or environment-backed configuration.
6. [Quality Guidelines](./quality-guidelines.md) before handing off any frontend change.

## Quick Routing

| Change                                    | Primary guide                                     | Existing examples                                                  |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Add or reorganize a screen                | [Directory Structure](./directory-structure.md)   | `src/views/CommunityView.vue`, `src/views/LoginView.vue`           |
| Add a reusable UI building block          | [Component Guidelines](./component-guidelines.md) | `src/components/InputBox.vue`, `src/components/SourcePanel.vue`    |
| Add watchers, browser effects, or cleanup | [Hook Guidelines](./hook-guidelines.md)           | `src/components/DigitalHumanPlayer.vue`, `src/views/LoginView.vue` |
| Share feature state or persist a session  | [State Management](./state-management.md)         | `src/store/agent.ts`, `src/store/auth.ts`                          |
| Change data shapes or request contracts   | [Type Safety](./type-safety.md)                   | `src/types/community.ts`, `src/api/community.ts`                   |
| Verify UI quality                         | [Quality Guidelines](./quality-guidelines.md)     | `package.json`, `eslint.config.ts`                                 |

## Architecture Snapshot

```text
src/main.ts
  -> src/App.vue (application shell and state-driven screen selection)
       -> src/views/*.vue (screen/feature composition)
            -> src/components/*.vue (reusable UI)
            -> src/store/*.ts (shared Pinia state and workflows)
                 -> src/api/*.ts (fetch and response decoding)
                      -> server HTTP endpoints
```

Shared domain contracts live in `src/types/`; environment-backed configuration lives in `src/config/`; pure helpers live in `src/utils/`. The application currently has no Vue Router and no custom composable directory.

## Quality Check

For a normal frontend change, verify in this order:

```bash
npm run lint
npm run type-check
npm run build
```

`npm run lint` is configured to auto-fix, so inspect its diff and do not include unrelated rewrites. There is currently no frontend unit/E2E test runner or test suite configured. `CLAUDE.md` also requires refreshing the CodeGraph index after source changes with `npm run codegraph:index`; documentation-only changes do not change the source graph.

## Current-State Warnings

- Existing event spellings and error-boundary typing are not completely uniform. Preserve the local public contract when editing an existing component, and use the safer examples referenced in the focused guides for new code.
- `src/project-text/` is a large imported document corpus, not a place for application components or composables.
