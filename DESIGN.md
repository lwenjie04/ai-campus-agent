# Design

## Visual Direction

The product uses a mixed light/dark system:

- The AI chat home surface is a dark, spatial command-center interface.
- Community, admin, auth, and long-reading surfaces are light, calm, and operational.
- The two modes should feel like one product through shared geometry, type scale, motion, and blue-violet cold-light accents.

The current primary references are Raycast and Linear, with Apple Vision Pro used only for spatial depth and soft material cues. The interface should feel like a precise command desk: dark, dense, fast, and calm, with restrained cold-light accents.

## Color System

Use a cold blue-violet technology palette with small campus-green accents only where school identity or success states need it.

Primary roles:

- `ink`: near-white text on dark command surfaces; deep blue-black text on light surfaces.
- `canvas-dark`: deep blue-black, not pure black.
- `canvas-light`: cool white or very pale blue, not beige or warm cream.
- `surface`: translucent layered panels with subtle blue-violet tint.
- `surface-solid`: opaque fallback for dense text, tables, and forms.
- `primary`: blue-violet cold light for active controls, focus, and high-value action.
- `accent-cyan`: secondary AI/status glow.
- `campus-green`: sparing identity accent, success, verified official source.
- `warning`: amber for pending review or uncertainty.
- `danger`: red for errors and rejected states.

Avoid the current dominant green gradient as the product-wide theme. Green can remain a supporting identity signal, not the main atmosphere.

## Typography

Use a clean system sans-serif stack optimized for Chinese UI:

```css
font-family: Inter, "SF Pro Display", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
```

Hierarchy:

- Page title: confident but compact, not marketing-hero sized.
- Section title: clear and scannable.
- Body: high contrast, comfortable for long Chinese answers.
- Metadata/source labels: smaller but never low-contrast gray.
- Code/request IDs/source IDs: mono stack only when the content is technical.

Long assistant answers should prioritize readability: 65-75ch max line length where possible, generous line height, and clear paragraph rhythm.

## Layout System

### App Shell

The app shell should become a unified product frame:

- Persistent top or side navigation with clear active state.
- One visual language for home, community, admin, and auth.
- Responsive layout that works from mobile to wide desktop without text collision.

### Home Chat Surface

Home uses a Raycast/Linear-inspired command desk:

- Left: narrow command rail with common campus workflows, digital human status, voice controls, and user context.
- Center: focused chat reading column, ideally 720-820px wide on desktop, optimized for fast questions and readable answers.
- Right: source and context desk for LightRAG state, current profile, answer strategy, and future source drill-down.
- Sources remain attached to assistant answers by default, while the right desk provides persistent retrieval context.
- The digital human should be a compact status/narration module, not the page's visual center.

### Light Surfaces

Community, admin review, and auth surfaces should be lighter and calmer:

- More table/list density where needed.
- Fewer decorative panels.
- Clear separation between official knowledge, community content, pending review, and errors.

Avoid stacked identical cards as the default layout. Use lists, timelines, segmented panels, split views, compact tables, and source drawers when they fit the task better.

## Component Language

### Panels

Use spatial panels sparingly:

- Dark home panels may use soft translucent material.
- Light pages should use mostly solid surfaces for readability.
- Nested cards are discouraged.
- Glass effect must support legibility and have a solid fallback.
- Product/tool surfaces should prefer 8px radius; pill shapes are reserved for tags, chips, and clear navigation states.

### Buttons

Primary buttons use blue-violet cold light. Secondary buttons are quiet and bordered. Destructive actions must be unmistakable but not visually loud until needed.

Icon buttons should use recognizable icons and tooltips when the action is not obvious.

### Chat Messages

Assistant messages should feel readable and source-grounded:

- Streamed answer text is the focus.
- Sources are compact by default and expandable.
- Official sources get stronger trust treatment than community sources.
- Community sources should clearly say they are for reference.

### Digital Human

The digital human panel should communicate:

- idle
- listening/ready
- generating
- speaking
- error/unavailable

The panel can have a subtle status halo, but the avatar/video should not dominate the first viewport.

## Motion

Motion intensity is balanced:

- Default state: refined and calm.
- Key moments: more technological and presentation-worthy.

Use motion for:

- first entry composition
- chat stream arrival
- answer generation state
- source expansion/collapse
- digital human state changes
- navigation transitions
- review status updates

Allowed visual motifs:

- soft panel float-in
- cold-light pulse
- subtle spatial parallax
- restrained scan shimmer during generation
- source drawer reveal
- active focus glow

Avoid constant particle noise, aggressive scanning lines, bouncing effects, or animations that delay reading. All motion needs `prefers-reduced-motion` support.

## Interaction Principles

1. Ask quickly.
The chat input should always be easy to reach and visually primary on the home surface.

2. Trust quickly.
Sources should be scannable immediately after an answer, with clear type and authority.

3. Recover quickly.
Errors, empty states, LightRAG unavailable states, and TTS unavailable states should explain what happened and what the user can do next.

4. Navigate without ceremony.
Students should move between chat, community posts, and source references without losing context.

## Accessibility

Target WCAG AA:

- body text contrast at least 4.5:1
- visible keyboard focus
- reduced-motion alternative
- no text overflow on mobile
- controls with accessible labels
- status changes conveyed by text, not only color or animation

Chinese text, long handbook answers, long post titles, and mixed source metadata must remain readable on mobile.

## Implementation Notes

The current Vue 3 + Element Plus stack can stay, but the visual system should be pulled into shared tokens and reusable components instead of page-specific color and spacing rules.

Recommended first refactor targets:

1. Raycast-style home command desk
2. chat message, source, and input refinement
3. Linear-style community list/detail surfaces
4. Linear-style admin review surfaces
5. shared source display component
6. app shell and navigation polish
7. login/register polish if authentication is re-enabled
