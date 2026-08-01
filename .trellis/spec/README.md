# Project Development Guidelines

This directory is the entry point for Trellis coding context. Only load guidelines that have been verified against this repository.

## Authoritative Project Specs

### [Root Frontend](./frontend/index.md)

The root application uses Vue 3, TypeScript, Vite, Pinia, and Element Plus. Its project-specific guides are:

- [Directory Structure](./frontend/directory-structure.md)
- [Component Guidelines](./frontend/component-guidelines.md)
- [Reactive Logic and Composables](./frontend/hook-guidelines.md)
- [State Management](./frontend/state-management.md)
- [Type Safety](./frontend/type-safety.md)
- [Quality Guidelines](./frontend/quality-guidelines.md)

These guides apply to the root `src/` application only. They do not apply automatically to `mobile-uniapp/` or `server/`.

## Starter Material Not Yet Project-Specific

The `backend/`, `shared/`, and `big-question/` directories still contain Trellis starter material for an Electron/React reference project. They do not describe this repository and must not be added to implementation or check manifests as coding authority. Replace and re-index those layers against real source before using them for project work.

The pre-filled [thinking guides](./guides/index.md) may be used for general reasoning, but some examples use Electron/React terminology. Treat those examples as illustrative only; the root frontend guides above remain the source of truth for code conventions.
