# Documentation

This directory contains technical project documentation and the research
documentation for CHROMALUM.

Technical project documentation follows the repository's MIT license unless a
document says otherwise. The scholarly and explanatory research documents listed
below are covered by the CC BY 4.0 notice in [LICENSE.md](./LICENSE.md).

## Technical Documentation

1. [Architecture](./architecture.md)
   Describes the browser-only React/Vite runtime, state model, drawing
   pipeline, workers, persistence, and quality gates.

## Core Corpus: Tractatus Chromaticus

The core corpus is the three-part _Tractatus Chromaticus_ ("Chromatic
Treatise"). These documents define the discrete algebraic color model, place
it against prior art, and explain how it is presented in the Theory tab.

1. [Pars I - Algebraic Color Model](./algebraic-color-model.md)  
   Defines the 8-color `GF(2)^3` model, luma ordering, complement theorem,
   Fano/Hamming correspondences, and polyhedral readings.
2. [Pars II - Algebraic Color Model - Prior Art](./prior-art-algebraic-color-model.md)  
   Separates known mathematical and color-model structures from the
   CHROMALUM-specific synthesis.
3. [Pars III - Theory Tab - Prior Art and Improvement Proposals](./theory-tab-prior-art-and-improvements.md)  
   Tracks how the theoretical model is presented in the interactive Theory
   tab, including claim boundaries, UI/content improvements, and implementation
   status. This is a living research/development note.

## Music Appendix

The Music Appendix extends the same model into LinkedVisualization and
sonification. These notes are companion documents to the core corpus rather
than additional parts of _Tractatus Chromaticus_.

1. [Appendix A - Music-Linked Visualization](./music-linked-visualization.md)  
   Describes the luma-radius hue graph, hue-phase rotation (`alpha` in the
   implementation), complement phase behavior, pitch mapping, and bit-spectrum
   timbre layer.
2. [Appendix B - Music-Linked Visualization — 先行研究と設計ノート](./prior-art-music-linked-visualization.md)  
   Surveys related sonification, color-to-sound, luma, hue, and accessibility
   references, and records design guidance for the Music tab.

## Suggested Reading Order

For the theory model, read Pars I first, then Pars II, then Pars III. For the
Music tab and LinkedVisualization, read Pars I first, then Appendix A, then
Appendix B.

## Licensing and Citation

See [LICENSE.md](./LICENSE.md) for the CC BY 4.0 license notice, attribution
requirements, and citation templates. The root [../LICENSE](../LICENSE)
continues to apply to source code, tests, build configuration, and
non-scholarly application assets, including technical project documentation.
