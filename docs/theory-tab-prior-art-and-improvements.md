# Theoryタブ 先行研究調査と改善提案

調査日：2026-04-19

## Related Notes

- 技術定義・定理・実装対応: [離散代数的色彩モデル 技術ノート](./algebraic-color-model.md)
- 先行研究・新規性評価: [離散代数的色彩モデル 先行研究調査ノート](./prior-art-algebraic-color-model.md)

## Executive Conclusion

Theory タブは、一般的な「色彩理論」として見ると危ういが、「8 頂点 RGB 集合に対する離散代数的色彩アトラス」として見ると学術的価値がある。改善の中心は、内容を増やすことではなく、主張の範囲を正確にすること、既知構造を明示的に引用すること、CHROMALUM 固有の貢献を前面に出すことである。

今回の追加調査で重要なのは、日本デザイン学会の「CMYカラーキューブに基づく新たなカラーモデル II」である。この文献は、8 元のブール束、ハッセ図、RGB/CMY キューブ、補元、結び `U`、交わり `∩` による加法/減法の双対を扱っている。したがって、Theory タブの Boolean lattice / Hasse 図 / RGB-CMY 双対の部分は直接的な先行研究がある。

一方で、次の統合は今回の調査範囲では見つからなかった。

1. BT.601 luma により `GRB` ビット順序を一意化すること。
2. 補色 luma 反転を、標準サイコロの対面和 7 と結びつけること。
3. hue Gray cycle、luma zigzag、dice net を同じ 6 色構造として重ねること。
4. `K8` の Hamming 距離分解を、cube / stella octangula / complement matching の色彩アトラスとして提示すること。
5. RGB cube、Boolean lattice、`GF(2)^3`、Fano、Hamming、polyhedra を単一 UI に統合していること。

## Current Theory Tab Map

現行 Theory タブは、次の順で構成されている。

| Group | Components | Academic role |
| --- | --- | --- |
| 前提と記法 | Venn, Binary levels, XOR | `P({G,R,B})`, `B3`, `GF(2)^3` の導入 |
| 立方体と巡回 | Color cube, Gray cycle, luma zigzag, dice | RGB cube、hue hexagon、luma rank、dice theorem |
| 射影幾何と符号 | Fano plane, Hamming diagram | `PG(2,2)` と Hamming(7,4) の対応 |
| 多面体 | Octahedron, tetrahedra, stella, network | `Q3`、dual、parity split、distance-2 graph |
| 総括と限界 | Connections, scope | 構造間の対応と非主張の明示 |

この構成は教育的には強い。ただし、前半の「色彩理論」という名前と一部コピーが、一般的な色彩科学・知覚色空間・物理混色まで扱うように見える点が弱い。

## Prior Art By Layer

### 1. RGB Cube and Hue Hexagon

RGB 色空間を立方体として扱い、黒白軸を中心にした 6 頂点の hue hexagon を読むことは標準的である。Smith 1978 は RGB colorcube と HSV/hexcone 変換の基礎文献であり、Joblove and Greenberg 1978 もコンピュータグラフィックス向け色空間を整理している。

Implication:

CHROMALUM は RGB cube や `R-Y-G-C-B-M` hue path を新規主張にしてはいけない。主張するなら、hue path が `GF(2)^3` の 1-bit Gray cycle、luma zigzag、dice adjacency と同時に一致する点である。

### 2. Boolean Lattice and RGB/CMY Duality

JSSD の CMY color cube 論文群は、Theory タブのハッセ図説明に近い。特に第 II 報は、8 元のブール束、補元、`U` と `∩`、RGB/CMY の双対、理想化された加法/減法の対応、そして実際の混色へ拡張する際の限界を明示している。

Implication:

Theory タブは、ハッセ図を「本モデルの発見」ではなく「既知の束論的読みを CHROMALUM の 8 色レベルへ接続したもの」として表示すべきである。ここに引用がないと、既知性の指摘に弱い。

### 3. `Z2^3`, Fano Plane, and Color Addition

Ron Taylor は 8 色の加算規則を `Z2 x Z2 x Z2` として扱い、Fano plane coloring に接続している。MathILy の講義記録も、8 色を `Z2` の 3 成分で表し、Fano plane 上で 2 色の和が第 3 色になることを述べている。

Implication:

Theory タブの XOR / Fano core は既知である。CHROMALUM の価値は、その既知構造を RGB display primaries、BT.601 luma、Hamming labels、多面体分解へ接続したところにある。

### 4. Hamming Code and Finite Geometry

Fano plane `PG(2,2)` の 7 点を Hamming(7,4) の parity-check matrix の 7 列として読むことは標準的である。Error Correction Zoo も `[7,4,3]` Hamming code と Fano plane `PG_2(2)` の対応を明記している。

Implication:

Hamming セクションでは、色が符号語なのではなく、1..7 が座標位置ラベル・syndrome label であることを今後も強調するべきである。この区別は現行実装の強みである。

### 5. Luma, Luminance, and Perceptual Color

ITU-R BT.601 は `E_Y' = 0.299 E_R' + 0.587 E_G' + 0.114 E_B'` を定義する。これは gamma-corrected signal に対する luma であり、CIE の perceptual lightness でも WCAG の relative luminance でもない。

WCAG relative luminance は sRGB を線形化し、`0.2126, 0.7152, 0.0722` を用いる。CSS Color 4 では Lab/LCH/Oklab/OkLCh などの device-independent / perceptual-oriented color spaces が標準化され、HSL の lightness が視覚的明るさと一致しない例として blue/yellow が示されている。

Implication:

現行の日本語 UI で `color_detail_luma` が「輝度」になっているのは用語上のリスクである。「ルマ」または「BT.601 luma」に寄せるべきである。また `theory_binary_desc` の「人間の色覚の帰結」は強すぎる。正確には「BT.601 係数の不等式からの帰結」である。

### 6. Subtractive Mixing Limits

実際の減法混色は、RGB 三値だけでは予測できない。Burns 2017 は、RGB 値だけでは混合後の subtractive mixture を決める情報が足りず、Kubelka-Munk 型の方法には分光測定が必要になると説明している。

Implication:

Theory タブの AND / CMY reading は「物理的な顔料混合」ではなく、「ブール束上の理想化された meet」として表示すべきである。現行コピーはおおむね注意しているが、セクション見出しの「XOR 混色」は誤読されやすい。

## Claim Risk Assessment

| Risk | Severity | Reason | Recommended fix |
| --- | ---: | --- | --- |
| `theory_title = 色彩理論` | High | 一般色彩科学全体の主張に見える | `離散代数的色彩理論` または `8色代数モデル` |
| `人間の色覚の帰結` | High | BT.601 は完全な色覚モデルではない | `BT.601 luma 係数の不等式からの帰結` |
| `輝度` と `luma` の混同 | High | luminance/lightness/luma が混ざる | UI ラベルを `ルマ` に統一 |
| Boolean lattice の引用なし | High | JSSD 先行研究に近い | ハッセ図セクションに引用/既知ラベル |
| XOR/AND を混色と呼ぶ | Medium | 物理混色と誤読される | `XOR 演算`, `Boolean meet` に寄せる |
| dice net 一意性 | Medium | 現行は証明スケッチのみ | 11 nets の列挙テストか表現の弱化 |
| BT.601 のみの採用 | Medium | 係数選択が恣意的に見える | BT.709/WCAG/Oklab との比較パネル |
| 文献が UI から見えない | Medium | 学術的防御力が落ちる | References drawer / footnotes |
| 多面体セクションの過密 | Low | 教育的導線が長い | “known / CHROMALUM adds” ラベル |

## Improvement Proposals

### P0: Claim Hygiene

1. Theory タイトルを `色彩理論` から `離散代数的色彩理論` へ変更する。
2. `label_theory` は `ALGEBRAIC COLOR THEORY` のままでもよいが、H2 で範囲を限定する。
3. `color_detail_luma: "輝度"` を `ルマ` に変更する。
4. `theory_binary_desc` の末尾を変更する。

Suggested Japanese copy:

```text
これは任意の設計ではなく、BT.601 luma 係数の不等式から決まる離散モデル上の帰結です。
```

Avoid:

```text
人間の色覚の帰結です。
```

### P1: Scope Card Near the Top

Theory intro の直後に、短い Scope card を置く。目的は、読み手が最初から「これは何ではないか」を把握できるようにすること。

Suggested copy:

```text
このタブは、RGB チャンネルが 0/255 の 8 頂点だけを扱う離散モデルです。
BT.601 luma は順位付けのための信号指標であり、CIE 明度や WCAG 相対輝度ではありません。
XOR/AND は代数演算であり、光・顔料の物理混色を直接モデル化するものではありません。
```

### P1: Prior-Art Labels Per Section

各セクションに小さなラベルを置く。

```text
Known: RGB cube / Boolean lattice
CHROMALUM adds: BT.601 GRB order + dice connection
```

この方式なら、先行研究を隠していないことが UI 上で伝わる。論文化・公開説明で非常に強い。

### P1: References Drawer

Theory タブ末尾か各セクションに `References` ボタンを追加する。最低限の引用は次。

1. Smith 1978: RGB cube / HSV / hexcone.
2. JSSD CMY color cube papers: Boolean lattice / Hasse / RGB-CMY duality.
3. Taylor 2013: `Z2^3` color addition / Fano coloring.
4. ITU-R BT.601: luma coefficients.
5. W3C WCAG and CSS Color 4: relative luminance and perceptual color spaces.
6. Burns 2017: real subtractive mixing cannot be inferred from RGB alone.

### P1: Formal Proof Cards

Theory タブにはすでに視覚的説明がある。学術性を上げるには、各主要主張の下に折りたたみ式の Proof card を追加する。

Must-have proof cards:

1. `GRB` is unique for BT.601 luma monotonicity.
2. Complement luma theorem: `Y(c) + Y(c xor 7) = 255`.
3. Die rank theorem: order-reversing involution pairs rank `k` with `7-k`.
4. Fano line theorem: `{a,b,c}` is a line iff `a xor b xor c = 0`.
5. `K8` edge partition by Hamming distance.

### P2: Coefficient Switcher

BT.601 だけでなく、係数セットを切り替えて順位がどう変わるか見せる。

Suggested coefficient sets:

| Mode | Coefficients | Use |
| --- | --- | --- |
| BT.601 luma | `0.299, 0.587, 0.114` | CHROMALUM default |
| BT.709 / WCAG linear luminance weights | `0.2126, 0.7152, 0.0722` | accessibility comparison |
| Equal weights | `1/3, 1/3, 1/3` | tie case; GRB uniqueness fails |
| Custom | sliders constrained to sum 1 | explores theorem conditions |

Key theorem to display:

```text
A binary order with bit weights x2, x1, x0 is strictly luma-monotone iff
x2 > x1 + x0 and x1 > x0.
```

This makes the GRB claim stronger because users can see exactly which coefficient families support it.

### P2: Replace "XOR Mixing" With "XOR Operation"

Current title:

```text
XOR 混色
```

Safer title:

```text
XOR 演算
```

or:

```text
XOR 色加算（代数）
```

The description can still mention "color addition" as a pedagogical reading, but the first impression should not imply physical light mixing.

### P2: Dice Net Verification

現行コピーは「11種類の立方体展開図のうち、この階段型だけ」とかなり強い。維持するなら、実装側に列挙検証を追加する。

Suggested tests:

1. Enumerate all spanning trees of the cube face-adjacency graph up to cube automorphism.
2. Filter trees containing the hue path `R-Y-G-C-B-M` or reverse.
3. Verify the resulting free net class is the 2-2-2 staircase.

If this is too heavy, UI copy should be weakened:

```text
この条件から得られる自然な展開図が 2-2-2 型の階段形です。
```

### P2: "Known vs Added" Synthesis Panel

Theory タブ終盤に表を追加する。

| Structure | Known | CHROMALUM adds |
| --- | --- | --- |
| RGB cube | Standard color geometry | luma-monotone `GRB` level numbering |
| Boolean lattice | JSSD prior art | linked to GF(2)^3/Fano/dice in one UI |
| `Z2^3` color addition | Taylor prior art | RGB display primaries and Hamming labels |
| Fano/Hamming | standard finite geometry | color-syndrome educational mapping |
| Dice | standard opposite-sum rule | complement luma reversal explanation |
| Stella/K8 | standard graph/polyhedra | Hamming-distance color partition |

### P3: Advanced Explorers

These are optional and should not ship before P0/P1.

1. `AG(3,2)` affine planes explorer using existing `AG32_PLANES`.
2. `GL(3,2)` automorphism explorer, with a warning that only `S3` channel permutations are color-semantically meaningful.
3. Proof audit panel linking every theorem to a unit test.
4. Academic mode toggle: compact UI text vs citation-heavy UI text.

## Proposed Implementation Phases

### Phase 1: Copy and Citation Corrections

Low risk, high value.

1. Rename `theory_title`.
2. Change luma label from `輝度` to `ルマ`.
3. Replace “human color vision consequence” wording.
4. Add top-level Scope card.
5. Add references to README/docs or a small bibliography modal.

### Phase 2: Proof and Comparison

Medium risk.

1. Add proof cards for GRB, complement, dice, Fano, K8.
2. Add coefficient switcher.
3. Add tests for coefficient-order theorem.

### Phase 3: Dice Net Rigor

Medium-to-high risk.

1. Implement cube net enumeration or weaken the claim. Implemented in `src/__tests__/theory-data.test.ts`.
2. Add tests for hue-path face adjacency. Implemented in `src/__tests__/theory-data.test.ts`.
3. Keep the technical note aligned with the exact enumeration result.

### Phase 4: Optional Advanced Theory

Only after the main narrative is cleaner.

1. Add `AG(3,2)` explorer.
2. Add `GL(3,2)` explorer.
3. Add proof audit / test coverage links.

## Specific Copy Fixes

Recommended Japanese changes:

| Key | Current | Proposed |
| --- | --- | --- |
| `theory_title` | `色彩理論` | `離散代数的色彩理論` |
| `color_detail_luma` | `輝度` | `ルマ` |
| `theory_binary_desc` | `人間の色覚の帰結です` | `BT.601 luma 係数の不等式から決まる離散モデル上の帰結です` |
| `theory_xor_title` | `XOR 混色` | `XOR 演算` |
| `theory_dice_desc3` | uniqueness claim | keep only after enumeration test, or weaken |

Recommended English changes:

| Key | Current | Proposed |
| --- | --- | --- |
| `theory_title` | `Color Theory` | `Discrete Algebraic Color Theory` |
| `theory_binary_desc` | `consequence of human color vision` | `consequence of the BT.601 luma coefficient inequalities` |
| `theory_xor_title` | `XOR Mixing` | `XOR Operation` or `XOR Color Addition` |

## Tests To Add

1. `BT.601` coefficients force `GRB` as the unique strictly monotone bit assignment. Implemented in `src/__tests__/theory-data.test.ts`.
2. `BT.709/WCAG` coefficient order also satisfies or reports the monotonicity condition explicitly.
3. Equal weights create ties and therefore fail strict monotonicity.
4. Complement luma theorem holds for any coefficient triple summing to 1. Implemented for the BT.601 chromatic ranks in `src/__tests__/theory-data.test.ts`.
5. Die rank theorem follows from complement order reversal. Implemented in `src/__tests__/theory-data.test.ts`.
6. UI copy tests reject `人間の色覚の帰結` and Japanese `輝度` for BT.601 luma labels.
7. Dice net uniqueness is machine-checked by enumerating cube-face spanning trees and verifying the unique hue-order staircase.

## Bottom Line

The best academic positioning is:

```text
CHROMALUM is not a new general theory of color perception.
It is an interactive discrete algebraic atlas of the eight binary RGB vertices.
Its ingredients are largely classical, but its BT.601-induced GRB order,
complement-dice theorem, and unified hue/luma/Fano/Hamming/polyhedra presentation
form a defensible original synthesis.
```

The most important improvement is not adding more mathematics. It is making the existing mathematics harder to misread.

## Sources Consulted

- Alvy Ray Smith, "Color Gamut Transform Pairs", SIGGRAPH 1978.  
  https://alvyray.com/Papers/CG/color78.pdf
- George H. Joblove and Donald Greenberg, "Color spaces for computer graphics", SIGGRAPH 1978.  
  https://cir.nii.ac.jp/crid/1362262943695000320
- 犬井聖恵・玉垣庸一・宮崎紀郎「CMYカラーキューブに基づく新たなカラーモデル」, 日本デザイン学会研究発表大会概要集 46, 1999.  
  https://www.jstage.jst.go.jp/article/jssd/46/0/46_310/_article/-char/ja/
- 玉垣庸一・小原康裕・宮崎紀郎「CMYカラーキューブに基づく新たなカラーモデル II」, 日本デザイン学会研究発表大会概要集 47, 2000.  
  https://www.jstage.jst.go.jp/article/jssd/47/0/47_290/_article/-char/ja/
- Ron Taylor, "Color Addition Across the Spectrum of Mathematics", 2013.  
  https://www.gathering4gardner.org/g4g11gift/Taylor_Ron-Color_Addition.pdf
- MathILy, ROM 2016 Daily Gather, Ron Taylor lecture summary.  
  https://mathily.org/roms/ROM2016-2-dgs.pdf
- Michel Lavrauw, "Incidence Geometry and Buildings", lecture notes.  
  https://osebje.famnit.upr.si/~michel.lavrauw/inc_geom_buildings_notes.pdf
- Error Correction Zoo, "Incidence-matrix projective code".  
  https://errorcorrectionzoo.org/c/incidence_matrix
- ITU-R BT.601-7, "Studio encoding parameters of digital television..."  
  https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.601-7-201103-I!!PDF-E.pdf
- W3C WCAG Working Group Wiki, "Relative luminance".  
  https://www.w3.org/WAI/GL/wiki/Relative_luminance
- W3C, "CSS Color Module Level 4".  
  https://www.w3.org/TR/css-color-4/
- Björn Ottosson, "A perceptual color space for image processing".  
  https://bottosson.github.io/posts/oklab/
- Scott Allen Burns, "Subtractive Color Mixture Computation", arXiv:1710.06364.  
  https://arxiv.org/abs/1710.06364
