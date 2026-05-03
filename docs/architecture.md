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
  usePixelMaps()         analysis maps, worker-backed where useful
  useMusicEngine()       Web Audio scheduling and playback state
```

React components stay focused on panels, controls, diagrams, and view
composition. Hooks own workflow state and side effects. Pure drawing and
analysis logic lives under `src/drawing` and `src/utils` so it can be tested
without rendering the whole app.

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

## Workers

Two worker paths keep expensive pixel operations away from the main thread:

- `flood-fill.worker.ts` handles large source and glaze flood fills.
- `pixel-analysis.worker.ts` computes map data for noise, diversity, depth,
  gradient, and regions.

Both paths have synchronous fallbacks so tests and restricted browser
environments can still run the same behavior.

## Theory And Music Data

The Theory and Music tabs are driven by structured data under `src/data`,
localized copy under `src/i18n`, and visual components under `src/components`.
The research notes in `docs/` define claim boundaries, prior-art positioning,
and citation guidance for the algebraic color model.

## Quality Gates

The main local checks are:

```bash
npm run lint
npm run format:check
npm run test:coverage
npm run build
npm run test:e2e
```

GitHub Actions run CI checks on pull requests, CodeQL scans JavaScript and
TypeScript, Dependabot tracks npm and GitHub Actions updates, and the deployment
workflow rebuilds the static GitHub Pages site from `main`.
