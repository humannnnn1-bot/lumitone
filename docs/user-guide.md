# User Guide

This guide is for first-time use of CHROMALUM as an app. For implementation
details, see [architecture.md](./architecture.md). For the research model behind
the Theory and Music tabs, start with the [documentation index](./README.md).

## First Run

Open the public demo or start the local development server with `npm run dev`.
CHROMALUM runs entirely in the browser: there is no account system, backend
service, or project server that stores your artwork.

The current canvas is autosaved in this browser with IndexedDB. Autosave is a
convenience feature, not a backup. Clearing site data, using private browsing,
or switching devices can remove local work, so export PNG files for anything you
need to keep outside the browser.

## Basic Workflow

1. Use the Source tab to draw an eight-level luma image or import an image.
2. Use Hex and Color to choose how the eight luma levels map to color
   candidates.
3. Use Glaze to paint per-pixel color-variant overrides while preserving the
   underlying source luma structure.
4. Use Gallery to generate, compare, bookmark, and export color-pattern
   variants.
5. Use Map to inspect tone, color tone, gradient, connected regions, boundary
   distance, isolation, and local diversity.
6. Use Theory and Music to explore the same eight-level structure as algebraic
   diagrams and sonification.

## Drawing And Navigation

The Source workspace includes brush, eraser, fill, line, rectangle, and ellipse
tools, plus undo and redo. Pan and zoom are shared across canvas workspaces so
you can inspect the same structure from Source, Color, Hex, Glaze, and Map.

Image import converts the source image into the eight luma levels used by the
model. PNG export can save grayscale, color, or glaze renderings; keep exported
files when you need a durable copy outside browser storage.

## What The Model Means

CHROMALUM is built around eight RGB vertices and a BT.601 luma ordering. The
levels are useful for discrete drawing, palette mapping, structural maps,
Theory diagrams, and Music sonification. They are not a perceptually uniform
color space and do not guarantee accessibility contrast by themselves.

Glaze overrides change the displayed color candidate for selected pixels, but
they do not change the source luma level. This is what lets the app compare
source structure, color mapping, glaze variants, gallery patterns, map
analysis, and sonification as views of the same compact canvas.
