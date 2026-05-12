# Theoryタブ — 重要先行研究と改善提案

調査日：2026-04-19
整理方針：2026-04-29
文書種別：living research/development note。先行研究整理と、Theory タブ
実装に関するステータス確認を同じ文脈で扱う。

## Related Notes

- 技術定義・定理・実装対応: [離散代数的色彩モデル](./algebraic-color-model.md)
- 先行研究・新規性評価: [離散代数的色彩モデル — 重要先行研究](./prior-art-algebraic-color-model.md)
- Music-Linked Visualization: [Music-Linked Visualization](./music-linked-visualization.md)

## Executive Conclusion

Theory タブは、一般的な「色彩理論」ではなく、「8 頂点 RGB 集合に対する離散代数的色彩アトラス」として位置づけるのが最も強い。

残すべき先行研究は、次の 6 系統に絞る。

1. Smith 1978: RGB cube / HSV / hue hexagon。
2. JSSD CMY color cube II: Boolean lattice / Hasse / RGB-CMY duality。
3. Taylor 2013: `Z2^3` color addition / Fano plane coloring。
4. Fano/Hamming 標準資料: `PG(2,2)` と Hamming(7,4) の既知対応。
5. ITU-R BT.601: luma 係数。
6. MathWorld Cube / Tetrahedron 2-Compound: cube nets、tetrahedra、stella octangula。

この範囲で見ると、Theory タブの独自性は、個別構造の発見ではなく、BT.601 luma による `GRB` 順序、補色-dice 定理、hue Gray cycle、luma zigzag、Fano/Hamming、K8/polyhedra を単一 UI に統合する点にある。

## Current Theory Tab Map

| Group | Components | Academic role |
| --- | --- | --- |
| 前提と記法 | Venn, Binary levels, XOR | `P({G,R,B})`, `B3`, `GF(2)^3` の導入 |
| 立方体と巡回 | Color cube, Gray cycle, luma zigzag, dice | RGB cube、hue hexagon、luma rank、dice theorem |
| 射影幾何と符号 | Fano plane, Hamming diagram | `PG(2,2)` と Hamming(7,4) の対応 |
| 多面体 | Octahedron, tetrahedra, stella, network | `Q3`、dual、parity split、distance-2 graph |
| 総括と限界 | Connections, scope | 構造間の対応と非主張の明示 |

この構成は教育的には強い。改善の中心は、内容を増やすことではなく、既知部分と CHROMALUM 固有部分を分けて見せることである。

## Curated Prior-Art Map

| Layer | Keep | Known part | CHROMALUM adds |
| --- | --- | --- | --- |
| RGB cube / hue hexagon | Smith 1978 | RGB cube、black-white axis、hue hexagon | hue path を Gray cycle、luma zigzag、dice adjacency と重ねる |
| Boolean lattice | JSSD CMY color cube II | `B3`、Hasse、補元、join/meet、RGB-CMY 双対 | `B3` を BT.601 `GRB` 順、Fano/Hamming、dice に接続する |
| `Z2^3` color addition | Taylor 2013 | 8 色の XOR 群、Fano plane coloring | RGB display primaries、BT.601 luma、Hamming labels、K8 分解へ接続する |
| Fano/Hamming | Lavrauw / Error Correction Zoo | Fano 平面と Hamming(7,4) の対応 | 色を符号語ではなく syndrome / coordinate labels として UI 化する |
| Luma | ITU-R BT.601 | `0.299, 0.587, 0.114` の luma 係数 | `0.587 > 0.299 + 0.114`, `0.299 > 0.114` から `GRB` を一意化する |
| Cube nets / stella | MathWorld Cube / Tetrahedron 2-Compound | 11 cube nets、2 tetrahedra compound | complement-dice、hue path、K8 Hamming-distance color atlas に統合する |

## Claim Risk Assessment

| Risk | Severity | Recommended handling |
| --- | ---: | --- |
| `色彩理論` が一般色彩科学に見える | High | `離散代数的色彩理論` / `8色代数モデル` として範囲を限定する |
| `人間の色覚の帰結` と読める表現 | High | `BT.601 luma 係数の不等式からの帰結` に寄せる |
| `luma` と `luminance/lightness` の混同 | High | UI と docs で `luma` / `ルマ` を使う |
| Boolean lattice の既知性 | High | JSSD を引用し、Hasse 図自体は新規主張しない |
| XOR/AND を物理混色と誤読される | Medium | `XOR 演算`, `Boolean meet` として説明する |
| dice net 一意性 | Medium | 11 nets の列挙テストに基づく内部補題として扱う |
| 文献が UI から見えない | Medium | References drawer または “Known / CHROMALUM adds” ラベルを追加する |

## Improvement Proposals

### P0: Claim Hygiene

実装済みの方針は維持する。

1. Theory タイトルを `離散代数的色彩理論` にする。
2. `color_detail_luma` は `ルマ` / `Luma` にする。
3. Binary-level copy は BT.601 luma 係数の不等式に基づく説明へ寄せる。
4. `XOR 混色` ではなく `XOR 演算` と呼ぶ。

### P1: Known / CHROMALUM Adds Labels

各セクションに短いラベルを付ける。

```text
Known: RGB cube / hue hexagon
CHROMALUM adds: BT.601 GRB order + dice connection
```

これにより、先行研究を隠していないことが UI 上でも伝わる。

### P1: References Drawer

Theory タブ末尾または各セクションに References drawer を置く場合、引用は次に絞る。

1. Smith 1978。
2. JSSD CMY color cube II。
3. Taylor 2013。
4. Lavrauw / Error Correction Zoo。
5. ITU-R BT.601。
6. MathWorld Cube / Tetrahedron 2-Compound。

### P1: Formal Proof Cards

学術性を上げるには、主要主張だけを proof card 化する。

1. `GRB` is unique for BT.601 luma monotonicity.
2. Complement luma theorem: `Y(c) + Y(c xor 7) = 255`.
3. Die rank theorem: order-reversing involution pairs rank `k` with `7-k`.
4. Fano line theorem: `{a,b,c}` is a line iff `a ⊕ b ⊕ c = 0`.
5. `K8` edge partition by Hamming distance.

### P2: Coefficient Switcher

BT.601 以外の係数を扱う場合は、先行研究を増やす目的ではなく、定理の条件を可視化する目的にする。

```text
A binary order with bit weights x2, x1, x0 is strictly luma-monotone iff
x2 > x1 + x0 and x1 > x0.
```

候補は BT.601、BT.709/WCAG 系の重み、equal weights、custom weights。これは `GRB` 一意性の条件を見せるための開発機能であり、Theory タブの中核先行研究ではない。

### P2: Known vs Added Synthesis Panel

終盤に次の表を追加すると、研究上の防御力が上がる。

| Structure | Known | CHROMALUM adds |
| --- | --- | --- |
| RGB cube | Standard color geometry | luma-monotone `GRB` level numbering |
| Boolean lattice | JSSD prior art | linked to `GF(2)^3` / Fano / dice in one UI |
| `Z2^3` color addition | Taylor prior art | RGB display primaries and Hamming labels |
| Fano/Hamming | standard finite geometry | color-syndrome educational mapping |
| Dice | standard opposite-sum rule | complement luma reversal explanation |
| Stella/K8 | standard graph/polyhedra | Hamming-distance color partition |

## Implementation Status

| Proposal | Status | Notes |
| --- | --- | --- |
| P0: Claim Hygiene | Done | UI uses `Discrete Algebraic Color Theory` / `離散代数的色彩理論`, `Luma` / `ルマ`, BT.601 coefficient-bound wording, and `XOR Operation` / `XOR 演算`. |
| Scope card | Partial | Scope and Limits summary exists; a near-top concise scope card remains optional. |
| Dice-net rigor | Done | Cube-net enumeration and hue-path adjacency are machine-checked. |
| P1: Known / CHROMALUM Adds Labels | Deferred | The docs already separate known prior art from CHROMALUM-specific synthesis; compact in-app labels remain optional. |
| P1: References Drawer | Deferred | Docs carry the bibliography; an in-app references drawer remains optional. |
| P1: Formal Proof Cards | Partial | Core proofs and proof sketches exist in docs/UI copy and are backed by tests; dedicated proof-card UI remains optional. |
| P2: Coefficient Switcher | Remaining | Optional theorem explorer, not required for the core model. |
| P2: Known vs Added Synthesis Panel | Deferred | The curated prior-art map already records this split; an end-of-tab synthesis panel remains optional. |

## Tests To Keep

1. Venn copy defines the characteristic function by channel membership `x ∈ A`, not by treating `A` itself as an element of `{G,R,B}`.
2. `BT.601` coefficients force `GRB` as the unique strictly monotone bit assignment.
3. Complementation `lv xor 7` reverses chromatic luma ranks and die-opposite rank sums are 7.
4. Fano lines form a Steiner triple system.
5. Hamming labels are coordinate positions and parity-check labels, not color codewords.
6. Gray cycle uses only one-bit flips.
7. K8 edges partition by Hamming distance.
8. Cube-face spanning trees enumerate the 11 free cube nets and verify the hue-order staircase.
9. UI copy tests reject `人間の色覚の帰結` and Japanese `輝度` for BT.601 luma labels.

## Bottom Line

Theory タブは、新しい色彩科学や新しい代数構造として主張しない。次の形に絞る。

```text
known finite algebra + known RGB/CMY lattice geometry + BT.601-forced GRB order
+ complement/dice theorem + hue/luma/Fano/Hamming/polyhedra integration
```

この整理なら、先行研究を必要十分に引用しつつ、CHROMALUM 固有の研究・開発価値を前面に出せる。

## Sources Kept

- Alvy Ray Smith, "Color Gamut Transform Pairs", SIGGRAPH 1978.
  https://alvyray.com/Papers/CG/color78.pdf
- 玉垣庸一・小原康裕・宮崎紀郎「CMYカラーキューブに基づく新たなカラーモデル II」, 日本デザイン学会研究発表大会概要集 47, 2000.
  https://www.jstage.jst.go.jp/article/jssd/47/0/47_290/_article/-char/ja/
- Ron Taylor, "Color Addition Across the Spectrum of Mathematics", 2013.
  https://www.gathering4gardner.org/g4g11gift/Taylor_Ron-Color_Addition.pdf
- Michel Lavrauw, "Incidence Geometry and Buildings", lecture notes.
  https://osebje.famnit.upr.si/~michel.lavrauw/inc_geom_buildings_notes.pdf
- Error Correction Zoo, "Incidence-matrix projective code".
  https://errorcorrectionzoo.org/c/incidence_matrix
- ITU-R BT.601-7.
  https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.601-7-201103-I!!PDF-E.pdf
- Wolfram MathWorld, "Cube".
  https://mathworld.wolfram.com/Cube.html
- Wolfram MathWorld, "Tetrahedron 2-Compound".
  https://mathworld.wolfram.com/Tetrahedron2-Compound.html
