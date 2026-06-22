# Plan: Three-Hour Product Stabilization Sprint

**Generated**: 2026-06-22
**Duration**: 3 hours
**Estimated Complexity**: Medium
**Primary Outcome**: Produce a stable, portfolio-ready online demo with verified responsive layouts, working AI flows, and a clean rollback point.

## Overview

This sprint should stop broad redesign work and turn the current restored green interface into a dependable demo. Work proceeds in four increments: visual QA, core workflow QA, community and RAG validation, then repository and deployment hardening.

## Prerequisites

- Run `npm run codegraph:sync` before every execution.
- Keep the existing server deployment and rollback directories intact.
- Do not reset or discard unrelated working-tree changes.
- Use the existing Vue 3, Pinia, Element Plus, Node backend, MySQL, LightRAG, Nginx, and PM2 stack.

## Sprint 1: Responsive Visual Stabilization

**Time**: 00:00-00:50
**Goal**: Make the digital-human and community surfaces reliable at common viewport sizes.

### Task 1.1: Establish a viewport QA matrix

- **Time**: 00:00-00:10
- **Locations**: `src/App.vue`, `src/views/AgentChat.vue`, `src/components/DigitalHumanPlayer.vue`
- **Description**:
  - Test 375x667, 768x1024, 1366x768, and 1920x1080.
  - Record page height, horizontal overflow, video bounds, chat input visibility, and navigation wrapping.
- **Acceptance Criteria**:
  - No horizontal scrollbar.
  - Chat input is visible without page scrolling on desktop.
  - Video remains centered and uncropped unless cropping is explicitly required.
- **Validation**: Browser screenshots plus DOM measurements of `scrollWidth`, `clientWidth`, and relevant bounding boxes.

### Task 1.2: Fix the digital-human page geometry

- **Time**: 00:10-00:30
- **Locations**: `src/views/AgentChat.vue`, `src/components/DigitalHumanPlayer.vue`
- **Dependencies**: Task 1.1
- **Description**:
  - Keep desktop content within `100dvh` minus navigation height.
  - Make the message list the only scrolling region.
  - Make video sizing responsive to available stage height while preserving the source ratio.
  - Verify greeting, idle, and teaching videos use identical visual bounds.
- **Acceptance Criteria**:
  - Input and stop controls remain visible at 1366x768.
  - Video does not create black gaps caused by oversized containers.
  - Switching video cues causes no layout shift.
- **Validation**: Replay all three cues and compare screenshots before and after switching.

### Task 1.3: Normalize community responsive behavior

- **Time**: 00:30-00:45
- **Locations**: `src/views/CommunityView.vue`, `src/views/PostDetailView.vue`
- **Description**:
  - Validate list, search, filters, details, reply editor, and side panels.
  - Collapse side content below the main content on tablet/mobile.
  - Ensure dialog controls and post titles fit narrow screens.
- **Acceptance Criteria**:
  - All controls have at least 44px touch targets.
  - No clipped labels, tags, or dialogs.
  - Community and detail pages share the green visual system.
- **Validation**: Screenshots at 375px and 768px, plus keyboard focus traversal.

### Task 1.4: Visual regression build

- **Time**: 00:45-00:50
- **Validation**:
  - Run `npm run build`.
  - Confirm no TypeScript errors or missing static assets.

**Sprint 1 Demo**:

- Navigate between Home, Digital Human, Community, and Post Detail at desktop and mobile sizes.
- Show that chat input stays visible and all pages remain usable.

## Sprint 2: Core AI Workflow Verification

**Time**: 00:50-01:35
**Goal**: Prove that the visible digital-human experience matches backend behavior.

### Task 2.1: Verify the question-answer state machine

- **Time**: 00:50-01:05
- **Locations**: `src/store/agent.ts`, `src/api/llm.ts`, `src/views/AgentChat.vue`
- **Description**:
  - Test initial greeting, user send, streaming response, completion, failure, and stop playback.
  - Confirm loading state prevents duplicate sends.
- **Acceptance Criteria**:
  - One user action produces one user message and one assistant response.
  - Network errors produce a visible retryable error state.
  - Session persistence does not duplicate the welcome message.
- **Validation**: Execute one successful query and one intentionally failed request.

### Task 2.2: Verify video and TTS synchronization

- **Time**: 01:05-01:20
- **Locations**: `src/components/DigitalHumanPlayer.vue`, `src/store/agent.ts`, `src/api/tts.ts`
- **Description**:
  - Confirm `greeting -> idle -> teaching -> idle` transitions.
  - Confirm API TTS playback, browser speech fallback, and Stop behavior.
  - Check object URLs and audio handlers are cleaned up.
- **Acceptance Criteria**:
  - No overlapping audio.
  - Stop immediately halts video narration and returns to idle.
  - TTS failure does not break the chat response.
- **Validation**: Browser console inspection and three consecutive questions.

### Task 2.3: Verify source trace behavior

- **Time**: 01:20-01:30
- **Locations**: `src/components/MessageItem.vue`, `src/types/agent.ts`, `src/store/agent.ts`
- **Description**:
  - Confirm source count matches returned source records.
  - Expand sources and open a community source when available.
- **Acceptance Criteria**:
  - Empty sources do not display a broken panel.
  - Community source links open the correct post detail.
- **Validation**: Query one handbook topic and one community topic.

### Task 2.4: Core workflow build checkpoint

- **Time**: 01:30-01:35
- **Validation**: Run `npm run build` and inspect browser errors.

**Sprint 2 Demo**:

- Ask a real question, watch the video state change, hear API narration, expand sources, and stop playback.

## Sprint 3: Community, RAG, and Data Integrity

**Time**: 01:35-02:15
**Goal**: Demonstrate an end-to-end knowledge workflow rather than isolated screens.

### Task 3.1: Verify community CRUD workflow

- **Time**: 01:35-01:50
- **Locations**: `src/store/community.ts`, `src/api/community.ts`, `server/community.mjs`
- **Description**:
  - Load metadata and posts.
  - Search and filter posts.
  - Submit a test post and reply using non-sensitive demo data.
- **Acceptance Criteria**:
  - Loading, empty, success, and error states are visible.
  - Pending content does not incorrectly appear as approved content.
- **Validation**: Network response check plus database/API readback.

### Task 3.2: Validate LightRAG and fallback retrieval

- **Time**: 01:50-02:05
- **Locations**: `server/index.mjs`, `server/lightrag.mjs`, `server/rag.mjs`
- **Description**:
  - Run LightRAG health check.
  - Query an indexed handbook topic.
  - Temporarily test fallback behavior when LightRAG is unavailable without changing production permanently.
- **Acceptance Criteria**:
  - Healthy LightRAG returns contextual material.
  - Failure falls back to keyword/vector RAG without a 500 response.
  - Logs identify which retrieval mode was used without exposing PII.
- **Validation**: `npm run lightrag:health`, `npm run rag:test:fast`, and one API query.

### Task 3.3: Verify community-to-knowledge trace

- **Time**: 02:05-02:15
- **Description**:
  - Generate a knowledge summary from an approved community post.
  - Confirm the result can appear as a lower-confidence source.
- **Acceptance Criteria**:
  - Generated knowledge links back to the original post.
  - The UI clearly distinguishes source provenance.
- **Validation**: API response plus a matching chat query.

**Sprint 3 Demo**:

- Open a community post, generate or inspect its knowledge record, then ask a related question and trace the answer back to its source.

## Sprint 4: Repository and Production Handoff

**Time**: 02:15-03:00
**Goal**: Leave the project reproducible, reviewable, and safely deployed.

### Task 4.1: Audit the dirty working tree

- **Time**: 02:15-02:25
- **Locations**: Entire repository
- **Description**:
  - Separate source changes from generated documents, ingestion data, local exports, and temporary assets.
  - Verify `.gitignore` excludes secrets, caches, generated indexes, and deployment archives.
- **Acceptance Criteria**:
  - No `.env`, credentials, private keys, or private student documents are staged.
  - Every staged file belongs to the release.
- **Validation**: `git status`, staged diff review, and secret-pattern scan.

### Task 4.2: Create focused commits

- **Time**: 02:25-02:35
- **Dependencies**: Task 4.1
- **Description**:
  - Commit UI restoration separately from backend security/LightRAG integration where possible.
  - Use messages that describe user-visible outcomes.
- **Acceptance Criteria**:
  - Commits are reviewable and do not include unrelated binary documents.
- **Validation**: `git show --stat` and `git diff HEAD^`.

### Task 4.3: Production smoke test and deployment

- **Time**: 02:35-02:50
- **Locations**: `dist/`, Nginx static root, PM2 backend
- **Description**:
  - Build once from the exact commit intended for deployment.
  - Deploy frontend to a new release directory.
  - Keep the previous directory as rollback.
  - Reload backend only if backend files changed.
- **Acceptance Criteria**:
  - `/`, `/health`, all three MP4 files, chat, community, and source navigation work over HTTPS.
  - Backend still listens only on `127.0.0.1:3000`.
- **Validation**: HTTP status checks, PM2 status, and one production user workflow.

### Task 4.4: Push and document the release

- **Time**: 02:50-03:00
- **Description**:
  - Push the focused branch to GitHub.
  - Record release commit, deployment time, rollback directory, and remaining issues.
- **Acceptance Criteria**:
  - Remote branch contains the deployed commit.
  - A short handoff note explains how to build, deploy, verify, and roll back.
- **Validation**: Compare local and remote commit hashes.

**Sprint 4 Demo**:

- Open the production URL, complete one AI question and one community navigation flow, then show the matching GitHub commit and rollback location.

## Testing Strategy

- **Static**: `npm run build`, TypeScript checks, lint only on touched source files.
- **Responsive**: 375x667, 768x1024, 1366x768, 1920x1080.
- **Functional**: greeting, streaming answer, TTS, stop, sources, community list/detail/post/reply.
- **Backend**: `/health`, LightRAG health, fallback RAG query, MySQL connectivity.
- **Production**: HTTPS, static video delivery, CORS, security headers, PM2 process, localhost-only backend binding.

## Time Guardrails

- At 00:50, stop visual polishing and move to workflow validation.
- At 01:35, stop component refactoring and move to RAG/community integration.
- At 02:15, freeze feature code and begin release preparation.
- Reserve the last 10 minutes exclusively for rollback-capable deployment and documentation.

## Potential Risks and Gotchas

- The working tree contains many unrelated modified and untracked files; staging everything would risk publishing private documents and generated artifacts.
- Local and production repositories are on different branches, so production should use packaged releases rather than a blind `git pull` until branch history is reconciled.
- Browser TTS fallback behaves differently across browsers and requires user interaction on some devices.
- The 2GB server may not comfortably run large local embedding models; LightRAG health and memory usage should be checked before enabling it as the sole retriever.
- Mobile viewport height changes when browser chrome opens; use `dvh/svh` and test on a real mobile browser where possible.

## Rollback Plan

- Keep the current Nginx static directory as a timestamped rollback directory before every swap.
- Keep backend file backups before PM2 reloads.
- If production smoke testing fails, restore the previous static directory and reload Nginx without altering the database.
- Do not roll back database schema changes automatically; use forward-compatible fixes or a reviewed migration.

## Definition of Done

- The four target viewport sizes pass without overlap or hidden primary controls.
- A real AI question streams, narrates, and exposes sources.
- Community list and detail workflows function and match the green visual system.
- LightRAG works or cleanly falls back.
- Production is healthy, rollback-ready, and tied to a pushed Git commit.
