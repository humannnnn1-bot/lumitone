# Architecture

CHROMALUM is a browser-only React/Vite application. It has no backend service:
state, rendering, export, autosave, analysis, and sonification all run in the
browser.

The central model is a compact canvas:

```text
CanvasData
  w, h      canvas dimensions
  data      Uint8Array of 8 source luma levels
  colorMap  Uint8Array of optional per-pixel glaze variant overrides
```

Every major feature reads or transforms this model. Drawing changes the source
luma levels, glaze changes `colorMap`, analysis derives maps from the same
pixels, and gallery/theory/music views interpret the same 8-level structure.

## Runtime Shape

```text
App.tsx
  useAppState()
    canvasReducer        source pixels, glaze map, undo/redo, histogram
    useColorState()      palette candidate selection and locked levels
    useToolState()       active tools and brush settings
    useUIState()         tabs, modals, toasts, language-facing UI state

  useCanvasDrawing()     source drawing interactions
  useGlazeDrawing()      per-pixel color variant interactions
  usePanZoom()           wheel, middle-button, pan-mode, and pinch viewport state
  useCanvasCoordination()
                       shared rendering, wheel listeners, and cursor scheduling
  usePixelMaps()         analysis maps, worker-backed where useful

MusicPanel.tsx
  useMusicPanelController()
    useMusicPanelState()      Music palette, transport, Fano, and algebra state
    useMusic*Handlers()       transport, hue/palette, Fano, stop, and reset flows
    src/music/music-panel-derived.ts
                           derived preview, active-level, hue-tick, and Fano data
    useMusicEngine()          sonification command surface for the Music tab
      useMusicAudioSession()  Web Audio lifecycle, graph updates, and teardown
      src/music/*             audio graph helpers, playback runners, schedules,
                              and algebraic sequences
```

React components stay focused on panels, controls, diagrams, and view
composition. Hooks own workflow state and side effects. Pure drawing and
analysis logic lives under `src/drawing` and `src/utils` so it can be tested
without rendering the whole app. Music playback logic that does not need React
lives under `src/music`, with React hooks wiring it to Web Audio and UI state.

## State Model

`canvasReducer` owns the canonical canvas state:

- `cvs.data`: one level per source pixel.
- `cvs.colorMap`: optional glaze overrides for source pixels.
- `undoStack` and `redoStack`: compressed diffs for source and glaze changes.
- `hist`: source-level histogram used by color and analysis UI.

The reducer owns `colorMap` so one undo step can atomically revert a source
stroke and any related glaze change. Color candidate selection is separate in
`useColorState` and `colorReducer`; it controls which RGB candidate each luma
level maps to without rewriting source pixels.

## Drawing Pipeline

Source drawing and glaze drawing share the same broad flow:

1. Pointer input is converted into canvas coordinates.
2. The active tool mutates a cloned `Uint8Array` buffer.
3. The changed region is tracked as a dirty rectangle.
4. `renderBuf` redraws only the needed canvas region when possible.
5. On stroke completion, the hook dispatches a compressed diff to
   `canvasReducer`.

Brush and shape tools use CPU-side typed-array operations from `src/drawing`.
Flood fill uses `useFloodFillWorker` for larger canvases and falls back to a
synchronous fill for small canvases or worker failures.

## Interaction And Viewport

`usePanZoom` owns the shared zoom, pan, pan-mode, and cursor-mode state for the
canvas workspaces. It handles pointer-centered wheel zoom, middle-button panning
and reset, pan-mode touch gestures, and two-finger pinch zoom that keeps the
pinch focal point stable.

`useCanvasCoordination` connects the shared viewport state back to the mounted
canvas surfaces. It bridges cursor redraw scheduling between source and glaze
drawing hooks, attaches non-passive wheel listeners to the source, color, and
glaze workspaces, and redraws the source/color/hex/glaze buffers when canvas
state or color lookup tables change.

## Rendering

`renderBuf` converts luma levels plus the active color lookup table into
`ImageData`. It supports dirty-rectangle updates and optional `colorMap`
overrides for the glaze layer.

The app intentionally keeps rendering close to browser primitives:

- Canvas elements display source, color, hex, glaze, gallery, and map outputs.
- Typed arrays hold source, color-map, and analysis buffers.
- Reusable image caches avoid unnecessary allocation in repeated renders.

## Persistence

`useAppState` restores saved state from IndexedDB on mount and autosaves after
changes. Saves are debounced, skipped when references have not changed, and
flushed on `pagehide` or `visibilitychange` so browser tab closes are less
likely to lose work.

The stored state includes:

- canvas dimensions and source data;
- glaze color map;
- color candidate choices;
- locked color levels;
- persistence schema version.

Two version numbers have separate roles. `DB_VERSION` controls the IndexedDB
database structure and should change when object stores or indexes need an
IndexedDB upgrade. `SAVED_STATE_VERSION` controls the serialized canvas state
shape stored under the current key and should change when saved state needs a
data migration.

Restore treats an empty database and an invalid saved record differently. Empty
storage starts from the default canvas. Invalid or unsupported saved data is
reported to the UI and ignored for the session, but the first baseline autosave
does not immediately overwrite it. A later explicit user change can then create
a fresh valid save.

## Workers

Two worker paths keep expensive pixel operations away from the main thread:

- `flood-fill.worker.ts` handles large source and glaze flood fills.
- `pixel-analysis.worker.ts` computes map data for noise, diversity, depth,
  gradient, and regions.

Both paths have synchronous fallbacks so tests and restricted browser
environments can still run the same behavior. `usePixelMaps` also caches results
per canvas buffer and mode, preloads remaining map modes after the active map is
ready, and invalidates the cache when either source data or `colorMap` changes.

## Theory And Music Data

The Theory tab is driven by structured data under `src/data`, localized copy
under `src/i18n`, and diagram components under `src/components/theory`.

The Music tab composes presentational sections in `src/components/music` through
`src/components/MusicPanel.tsx`. `src/hooks/useMusicPanelController.ts`
aggregates state partitions from `src/hooks/useMusicPanelState.ts`, extracted
transport, hue/palette, Fano, stop, and reset handler hooks, Web Audio session
management from `src/hooks/useMusicAudioSession.ts`, the command surface in
`src/hooks/useMusicEngine.ts`, derived helpers in
`src/music/music-panel-derived.ts`, and pure playback helpers under
`src/music`.

The research notes in `docs/` define claim boundaries, prior-art positioning,
implementation correspondence, and citation guidance for the algebraic color
model and its Music-linked visualization layer.

## Quality Gates

The main local checks are:

```bash
npm run typecheck:all
npm run lint
npm run deadcode
npm run format:check
npm run test:coverage
npm run build
npm run test:e2e
npm run test:pwa
```

`npm run verify` runs formatting, linting, dead-code detection, full type
checking, the production build, and the unit suite. `npm run verify:e2e` adds
the browser and PWA suites, while `npm run verify:full` uses coverage plus the
browser and PWA suites.

GitHub Actions run CI checks on pull requests: full type checking, linting,
dead-code detection, format checking, coverage, browser end-to-end tests, and
PWA tests. CodeQL scans JavaScript and TypeScript, Dependabot tracks npm and
GitHub Actions updates, and the deployment workflow reruns the non-browser CI
checks before rebuilding the static GitHub Pages site from `main`.
