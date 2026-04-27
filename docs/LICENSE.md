# Scholarly Content License

The scholarly and explanatory content of this repository is licensed under the
**Creative Commons Attribution 4.0 International License** (CC BY 4.0).

This CC BY 4.0 content includes:

- the documents in this `docs/` directory (excluding this `LICENSE.md`
  itself, which is a license notice rather than scholarly content);
- the authored prose, labels, and section text displayed in the Theory tab;
- the rendered explanatory diagrams and theory visualizations displayed in
  the Theory tab.

This is separate from the [MIT License](../LICENSE), which covers the
application source code, tests, build configuration, and non-scholarly app
assets. The React/TypeScript implementation of the Theory tab (component
logic, hooks, styles, and rendering algorithms) remains MIT-licensed. The
CC BY 4.0 license covers the expressive content surfaced by that
implementation: authored prose, section labels, and the rendered diagrams
when reused as visual artifacts (e.g., screenshots, embedded images).

## Summary (human-readable)

You are free to:

- **Share** — copy and redistribute the material in any medium or format.
- **Adapt** — remix, transform, and build upon the material for any
  purpose, even commercially.

Under the following terms:

- **Attribution** — You must give appropriate credit, provide a link to
  the license, and indicate if changes were made. You may do so in any
  reasonable manner, but not in any way that suggests the licensor
  endorses you or your use.
- **No additional restrictions** — You may not apply legal terms or
  technological measures that legally restrict others from doing anything
  the license permits.

## Full Legal Code

The full text of CC BY 4.0 is available at:
<https://creativecommons.org/licenses/by/4.0/legalcode>

The human-readable deed is at:
<https://creativecommons.org/licenses/by/4.0/>

## Author

The CC BY 4.0 content is attributed to:

> **Doctor Chromaticus**

This is a pseudonymous attribution. Citations should use the name
verbatim — it is a mononym (no first/last name split), which has
implications for BibTeX entries (see the double-brace handling in the
template below).

## The Corpus: *Tractatus Chromaticus*

The three documents in `docs/` are collectively known as the
*Tractatus Chromaticus* ("Chromatic Treatise"). They are read as
three parts of a single unified treatise on the discrete algebraic
color model that underlies the CHROMALUM application:

- **Pars I**: `algebraic-color-model.md`
  English title: Algebraic Color Model: Technical Note
  日本語タイトル: 離散代数的色彩モデル 技術ノート
- **Pars II**: `prior-art-algebraic-color-model.md`
  English title: Algebraic Color Model: Prior Art Survey
  日本語タイトル: 離散代数的色彩モデル 先行研究調査ノート
- **Pars III**: `theory-tab-prior-art-and-improvements.md`
  English title: Theory Tab: Prior Art and Improvement Proposals
  日本語タイトル: Theoryタブ 先行研究調査と改善提案

When citing the corpus as a whole, *Tractatus Chromaticus* is the
collective title. When citing a specific part, use the document title
above and identify the corpus with *in Tractatus Chromaticus*.

## Theory Tab Content

The Theory tab is the interactive presentation layer of the same scholarly
content. Its authored prose, labels, explanatory annotations, and rendered
theory diagrams are licensed under CC BY 4.0 when reused as content. The
software implementation that renders them remains under the repository's MIT
License.

When citing the Theory tab as a whole, use **CHROMALUM Theory Tab** as the
title. When citing a specific section or figure, use that section or figure
title and identify it as part of the CHROMALUM Theory Tab.

## How to Cite

Attribution under CC BY 4.0 must include four elements (TASL):

- **T**itle of the work (use the specific document title from the list
  above; *Tractatus Chromaticus* for the corpus; *CHROMALUM Theory Tab*
  for the interactive Theory tab)
- **A**uthor: Doctor Chromaticus
- **S**ource URL: <https://github.com/humannnnn1-bot/chromalum>
- **L**icense: CC BY 4.0,
  <https://creativecommons.org/licenses/by/4.0/>

If you adapt, translate, abridge, or otherwise modify the material,
you must also indicate that changes were made.

The templates below cover the most common cases. Use whichever fits
your medium; equivalents in other styles are fine as long as the four
TASL elements are present.

### Academic paper / journal (reference list)

```text
Doctor Chromaticus, "Algebraic Color Model: Technical Note,"
in Tractatus Chromaticus, 2026.
https://github.com/humannnnn1-bot/chromalum, licensed under
CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
```

BibTeX (note the double braces — they prevent BibTeX from splitting
the mononym into "first name / last name"):

```bibtex
@incollection{chromalum_acm_2026,
  author    = {{Doctor Chromaticus}},
  title     = {Algebraic Color Model: Technical Note},
  booktitle = {Tractatus Chromaticus},
  year      = {2026},
  url       = {https://github.com/humannnnn1-bot/chromalum},
  note      = {Licensed under CC BY 4.0,
               \url{https://creativecommons.org/licenses/by/4.0/}}
}
```

In-text citation: `Doctor Chromaticus (2026)`.

### Blog post / web article (after a quoted block)

```markdown
> "<quoted text>"

Source: "Algebraic Color Model: Technical Note," in
[Tractatus Chromaticus](https://github.com/humannnnn1-bot/chromalum),
by Doctor Chromaticus, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
```

### Book / textbook (footnote or end-note)

```text
Adapted from "Algebraic Color Model: Technical Note," in
Tractatus Chromaticus by Doctor Chromaticus, CC BY 4.0.
Source: https://github.com/humannnnn1-bot/chromalum
```

### Slide deck (footer or final credits slide)

```text
Adapted from: Tractatus Chromaticus by Doctor Chromaticus,
CC BY 4.0, github.com/humannnnn1-bot/chromalum
```

### Translation or summary (adaptation marker required)

```text
This document is a <translation | summary | abridgment> of
"Algebraic Color Model: Technical Note" in Tractatus Chromaticus
by Doctor Chromaticus, CC BY 4.0
(https://github.com/humannnnn1-bot/chromalum).
Changes: <e.g. translated from Japanese to English; sections 3-4 abridged>.
```

### Figure or table only (caption credit)

```text
Figure N. <caption>. Adapted from Tractatus Chromaticus
by Doctor Chromaticus, CC BY 4.0.
```

### Social media or short-form (where space is constrained)

```text
via Doctor Chromaticus · Tractatus Chromaticus · CC BY 4.0
github.com/humannnnn1-bot/chromalum
```

### Japanese-language template (日本語の標準形)

```text
出典: 「離散代数的色彩モデル 技術ノート」
（Tractatus Chromaticus, Doctor Chromaticus 作）
ライセンス: CC BY 4.0
https://github.com/humannnnn1-bot/chromalum
```

改変（翻訳・要約・抜粋）を行った場合は、上記に加えて改変内容を
明記してください。例:

```text
（原典を日本語から英語へ翻訳。§3-4 を要約。）
```

## Things You Must Not Do

The license does not allow:

- Suggesting that Doctor Chromaticus or CHROMALUM endorses you, your
  work, or your use of the material.
- Removing or altering existing copyright, attribution, or license
  notices in the material you reuse.
- Reusing material without crediting the source — this terminates the
  license automatically (with a 30-day cure window per CC BY 4.0 §6(b)).
- Applying additional legal or technological restrictions (e.g. DRM)
  that prevent downstream users from exercising the same CC BY 4.0
  rights.

Trademarks, logos, and product names (including "CHROMALUM") are not
covered by this license.

---

Copyright (c) 2026 Doctor Chromaticus.
