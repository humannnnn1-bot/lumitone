# 離散代数的色彩モデル 先行研究調査ノート

調査日：2026-04-19

## Related Notes

- 技術定義・定理・実装対応: [離散代数的色彩モデル 技術ノート](./algebraic-color-model.md)
- Theoryタブの改善提案: [Theoryタブ 先行研究調査と改善提案](./theory-tab-prior-art-and-improvements.md)

## Executive Summary

CHROMALUM の Theory タブで扱う離散代数的色彩モデルは、核となる数学構造だけを見ると新規ではない。8 つの RGB 頂点を `GF(2)^3` または `Z2 x Z2 x Z2` として扱うこと、非零 7 点を Fano 平面 `PG(2,2)` として読むこと、Hamming(7,4) 符号のパリティ検査行列と対応させること、RGB cube の有彩色 6 頂点を hue hexagon として読むことは既知である。

最も近い先行例は Ron Taylor, "Color Addition Across the Spectrum of Mathematics" である。この文献は 8 色の加算を `Z2 x Z2 x Z2` として扱い、Fano 平面、K7 の全彩色、集合の対称差にも接続している。したがって、CHROMALUM が「8 色を Z2^3 として読む」こと自体を新規主張にしてはいけない。

さらに近接する日本語先行研究として、玉垣庸一・小原康裕・宮崎紀郎「CMYカラーキューブに基づく新たなカラーモデル II」がある。この文献は、8 元のブール束 `B3`、ハッセ図、RGB/CMY キューブの双対性、結び `U` と交わり `∩` による加法混色・減法混色の説明を扱っている。したがって、CHROMALUM が「RGB/CMY キューブをブール束・ハッセ図・OR/AND 双対で読む」こと自体も新規主張にしてはいけない。

一方、今回の調査範囲では、次の組み合わせを同一モデルとして提示する先行例は見つからなかった。

1. BT.601 係数 `0.587 > 0.299 + 0.114`, `0.299 > 0.114` から、luma 順と二進レベル順を一致させる一意な `GRB` ビット割当を導くこと。
2. 補色 luma 和 `Y(c) + Y(c') = 255` を、6 有彩色の順位反転へ写し、標準サイコロの対面和 7 と接続すること。
3. hue hexagon の Gray 巡回、luma zigzag、サイコロ展開図の面隣接木を同じ 6 色構造として読むこと。
4. `K8` の 28 辺を Hamming 距離 `1/2/3` により、cube `Q3`、stella octangula、補色マッチングへ分解し、色彩モデルとして視覚化すること。
5. RGB cube、Fano、Hamming、octahedron、tetrahedra、stella octangula、dice を CHROMALUM の UI 上で一つの教育的体系として実装していること。

したがって、現時点で最も正確な新規性主張は次である。

> 本モデルは、既知の `GF(2)^3` 色加算・RGB cube・Fano 平面・Hamming 符号を基礎に、BT.601 luma により一意化される `GRB` レベル順序、補色 luma 定理、標準サイコロ対面則、hue Gray 巡回、多面体分解を統合した、8 頂点 RGB 色集合の離散代数的色彩アトラスである。

## Scope and Method

本調査は、公開 Web、論文 PDF、大学講義ノート、規格文書、数学リファレンスを対象とした技術的先行研究調査である。特許法上の新規性・進歩性を保証する調査ではない。論文化や出願前には、MathSciNet、zbMATH、ACM Digital Library、IEEE Xplore、SpringerLink、JSTOR、Google Patents、J-PlatPat で追加調査が必要である。

調査カテゴリは次の通り。

1. RGB cube、HSV/HSL、hue hexagon。
2. 8 色の `Z2^3` / `GF(2)^3` 加算。
3. Fano 平面、Hamming(7,4)、有限幾何。
4. BT.601 luma、WCAG relative luminance。
5. 補色、luma 順、サイコロ対面和。
6. cube nets、面隣接木。
7. cube、octahedron、tetrahedra、stella octangula、halved cube。
8. 「color algebra」という別分野の同名・近似用語。

主な検索語：

```text
"Z2 x Z2 x Z2" "color addition"
"color addition" "Fano plane"
"Al-Jabar" "color addition" "Z2"
"RGB color cube" "HSV" "hexcone" "Smith 1978"
"CMYカラーキューブ" "ハッセ図" "ブール束"
"CMY color cube" "boolean lattice" "Hasse diagram"
"0.587 > 0.299 + 0.114"
"GRB" "luma" "0.299" "0.587" "0.114"
"complement luma" "sum" "255" "dice"
"cube nets" "11 distinct nets"
"halved cube graph" "Q3" "tetrahedron"
"stella octangula" "compound of two tetrahedra" "cube"
```

## Prior Art Map

| CHROMALUM component | Prior-art status | Overlap | Assessment |
| --- | --- | ---: | --- |
| 8 RGB vertices as a cube | Standard | High | Known color-space geometry. Not novel. |
| Hue hexagon `R-Y-G-C-B-M` | Standard | High | HSV/hexcone tradition. Not novel. |
| Boolean lattice `B3` / Hasse diagram | Direct prior art exists | Very high | JSSD CMY color cube paper is close. Not novel. |
| RGB/CMY duality via complement and `U`/`∩` | Direct prior art exists | Very high | JSSD paper treats additive/subtractive duality through lattice theory. Not novel. |
| 8 colors as `Z2^3` | Direct prior art exists | Very high | Taylor/Al-Jabar is close. Not novel. |
| Fano plane on 7 non-black colors | Direct prior art exists | Very high | Taylor uses colored Fano plane. Not novel. |
| Hamming(7,4) linkage | Standard finite-geometry/coding theory | High | Known via Fano incidence. Not novel. |
| BT.601 luma coefficients | Official standard | High | Coefficients known. Not novel. |
| `GRB` as unique luma-monotone bit order | Not found as named prior art | Medium | Likely original lemma/application. |
| Complement luma sum | Algebraically elementary | Medium | Formula follows immediately from weights summing to 1; exact color-dice use not found. |
| Standard die opposite sum 7 from complement order reversal | Not found | Low-to-medium | Likely original synthesis. |
| Hue Gray cycle + luma zigzag + dice net | Not found as a package | Medium | Likely original synthesis. |
| `K8 = Q3 + Stella + complements` color reading | Graph/geometric pieces known | Medium | Decomposition is elementary; color-atlas framing likely original. |
| Interactive Theory atlas | Not found | Low | Implementation/instructional design likely original. |

## 1. RGB Cube and Hue Hexagon

### What is known

Alvy Ray Smith's 1978 SIGGRAPH paper "Color Gamut Transform Pairs" is a foundational source for RGB cube to HSV/hexcone transforms. It treats the RGB monitor gamut as a cube and derives hue/saturation/value transforms for computer graphics. The paper explicitly grounds HSV in the geometry of the RGB colorcube and the hexcone model.

This makes the following CHROMALUM components standard, not new:

1. RGB as a 3-dimensional color cube.
2. Black-white diagonal as the neutral axis.
3. Fully saturated colors around that axis as a 6-step hue circle/hexagon.
4. Hue order containing the vertices red, yellow, green, cyan, blue, magenta.

### CHROMALUM distinction

CHROMALUM does not merely use the hue hexagon as a perceptual UI transform. It discretizes the RGB cube to the 8 vertices only, then treats those vertices as `GF(2)^3`, and ties the hue hexagon to XOR, Hamming distance, luma zigzag, and dice adjacency.

That distinction is real, but it does not make the RGB cube or hue hexagon themselves novel.

### Sources

- Alvy Ray Smith, "Color Gamut Transform Pairs", SIGGRAPH 1978, DOI `10.1145/800248.807361`.  
  https://alvyray.com/Papers/CG/color78.pdf
- GMT documentation, "Color systems".  
  https://docs.generic-mapping-tools.org/6.2/cookbook/colorspace.html
- Wolfram Programming Lab, "Color Cube".  
  https://www.wolfram.com/programming-lab/explorations/color-cube/

## 1.5 Boolean Lattice, Hasse Diagram, and RGB/CMY Duality

### Closest prior art: JSSD CMY color cube papers

玉垣庸一・小原康裕・宮崎紀郎「CMYカラーキューブに基づく新たなカラーモデル II」は、Theory タブの Boolean lattice / Hasse diagram / RGB-CMY duality にかなり近い。特に次の重なりがある。

1. 8 頂点の色立体を `{0,1}^3` の直積集合として扱う。
2. その直積集合をブール束 `B3` として読み、ハッセ図と RGB カラーキューブの類似を述べる。
3. 結び `U` を RGB 三原色の加法混色、交わり `∩` を CMY 三原色の減法混色に対応させる。
4. 補元と `U`/`∩` の入れ替えにより RGB 系と CMY 系の互換を説明する。
5. 連続的・中間調のカラーキューブへ拡張する場合、束演算と実際の混色操作を同一視しきれない制限も明示している。

これは CHROMALUM の「ハッセ図の自己双対性が加法/減法の等価性を与える」という説明の直接的な先行例である。したがって、この部分は「本モデルの新規発見」ではなく、先行研究を UI 上で再実装・再配置したものとして扱うべきである。

### CHROMALUM distinction

CHROMALUM の差分は、ブール束そのものではない。差分は次の接続にある。

1. `B3` の座標軸を BT.601 luma によって `G,R,B` のビット重みへ固定する。
2. `B3` の補元を、luma 順位反転と標準サイコロ対面和 7 へ接続する。
3. `B3` と `GF(2)^3` の二つの演算系を、Fano/Hamming/Gray/dice/polyhedra の同一 UI 上で切り替えて示す。
4. 加法/減法の比喩を、物理的混色ではなく「ブール束上の理想化された読み」として制限付きで扱う。

### Sources

- 犬井聖恵・玉垣庸一・宮崎紀郎「CMYカラーキューブに基づく新たなカラーモデル」, 日本デザイン学会研究発表大会概要集 46, 1999.  
  https://www.jstage.jst.go.jp/article/jssd/46/0/46_310/_article/-char/ja/
- 玉垣庸一・小原康裕・宮崎紀郎「CMYカラーキューブに基づく新たなカラーモデル II」, 日本デザイン学会研究発表大会概要集 47, 2000.  
  https://www.jstage.jst.go.jp/article/jssd/47/0/47_290/_article/-char/ja/

## 2. `Z2^3` / `GF(2)^3` Color Addition

### Closest prior art: Ron Taylor

Ron Taylor's "Color Addition Across the Spectrum of Mathematics" is the strongest prior-art hit. It introduces games based on color addition and then interprets the rules as the group `Z2 x Z2 x Z2`. The paper assigns 8 colors to binary triples, includes black as `(0,0,0)` and white as `(1,1,1)`, gives a full group table, then realizes the same structure as cube vertices under mod-2 vector addition.

It also connects the color system to:

1. Al-Jabar, a color-stone game.
2. Spectrominoes, a domino-like game.
3. Fano plane coloring.
4. Total colorings of `K7`.
5. Symmetric difference on sets.
6. Knot coloring analogies.

This is extremely close to the algebraic core of CHROMALUM. Any claim that "8 colors form `Z2^3` under XOR" is already known.

### Difference from CHROMALUM

Taylor uses an RYB-like pedagogical color set:

```text
red, yellow, blue, orange, green, purple, white, black
```

CHROMALUM uses RGB display primaries and secondaries:

```text
red, green, blue, cyan, magenta, yellow, white, black
```

More importantly, Taylor does not appear to use BT.601 luma to force a unique bit order, nor does he connect the luma order to a standard die, luma zigzag, cube net, or `K8` distance partition in the same way.

### MathILy / Al-Jabar note

A MathILy ROM 2016 daily report summarizes Ron Taylor's Al-Jabar lecture and states the same core idea: represent 8 colors by ordered triples over `Z2` and add component-wise modulo 2; then use the Fano plane so that two colors on a line sum to the third, and three on a line sum to black. This independently confirms that the pedagogical `Z2^3` / Fano color model is known in outreach material.

### Sources

- Ron Taylor, "Color Addition Across the Spectrum of Mathematics", Gathering 4 Gardner gift exchange, 2013.  
  https://www.gathering4gardner.org/g4g11gift/Taylor_Ron-Color_Addition.pdf
- MathILy, ROM 2016 Daily Gather report summarizing Ron Taylor's color-addition lecture.  
  https://mathily.org/roms/ROM2016-2-dgs.pdf

## 3. Fano Plane and Hamming Code

### What is known

The Fano plane `PG(2,2)` has 7 points and 7 lines. It can be coordinatized by the 7 nonzero vectors in `GF(2)^3`. A line through two nonzero vectors `a,b` contains `a`, `b`, and `a+b`; equivalently, Fano triples satisfy:

```text
a xor b xor c = 0
```

The relation to Hamming(7,4) is also standard. The 7 columns of a parity-check matrix for the binary Hamming code can be taken as the 7 nonzero 3-bit vectors. The Fano plane incidence structure is a common geometric way to understand the code.

### CHROMALUM distinction

CHROMALUM's careful distinction is good: colors `1..7` are used as position labels / syndrome labels, not as Hamming codewords themselves. This avoids an easy conceptual error.

However, the Fano-Hamming connection itself is not new. It should be cited as established finite geometry and coding theory.

### Sources

- Michel Lavrauw, "Incidence Geometry and Buildings", lecture notes, 2018.  
  https://osebje.famnit.upr.si/~michel.lavrauw/inc_geom_buildings_notes.pdf
- Keith Ball, "Combinatorics II", Warwick lecture slides, finite projective planes and Fano plane over `Z2`.  
  https://warwick.ac.uk/fac/sci/maths/people/staff/keith_ball/combinatorics_ii_slide_17-18.pdf
- Error Correction Zoo, "Incidence-matrix projective code", noting the `[7,4,3]` Hamming parity-check matrix/Fano plane correspondence.  
  https://errorcorrectionzoo.org/c/incidence_matrix
- R. W. Hamming, "Error Detecting and Error Correcting Codes", Bell System Technical Journal, 1950.  
  https://ftp.math.utah.edu/pub/tex/bib/toc/bstj1950.html

## 4. BT.601 Luma and Relative Luminance

### What is known

ITU-R BT.601 defines the luma construction:

```text
Y' = 0.299 R' + 0.587 G' + 0.114 B'
```

The 8 vertex values under full-range 0/255 RGB are therefore:

```text
K = 0
B = 29
R = 76
M = 105
G = 150
C = 179
Y = 226
W = 255
```

The coefficients and these vertex luma values are not novel.

WCAG relative luminance is different. It linearizes sRGB and uses:

```text
L = 0.2126 R + 0.7152 G + 0.0722 B
```

Thus CHROMALUM should keep using "luma" or "BT.601 luma-like level", not "perceptual lightness" or "WCAG luminance".

### CHROMALUM distinction

The new-looking lemma is not the coefficients themselves, but the observation:

```text
0.587 > 0.299 + 0.114
0.299 > 0.114
```

This implies that the binary level order is luma-monotone only when bit significance is:

```text
bit 2 = Green
bit 1 = Red
bit 0 = Blue
```

Across exact searches for the inequality and for `GRB` + BT.601 luma, this result did not appear as a named or prior color-ordering theorem. It is elementary, but likely a genuine contribution in this specific model.

### Sources

- ITU-R Recommendation BT.601-7, official PDF.  
  https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.601-7-201103-I!!PDF-E.pdf
- W3C, WCAG 2.0 relative luminance definition.  
  https://www.w3.org/WAI/GL/2012/WD-wcag2ict-20121126/#relative-luminance

## 5. Complement, Luma Reversal, and Standard Die

### What is known

Color complementing by bit inversion is standard on RGB cube vertices:

```text
c' = c xor 7
```

For any linear luma whose weights sum to 1:

```text
Y(c') = 255 - Y(c)
```

This proof is immediate algebra. The theorem is mathematically simple enough that it may exist implicitly in many image-processing contexts, even if not named.

Standard dice conventionally place opposite faces so that they sum to 7:

```text
1 opposite 6
2 opposite 5
3 opposite 4
```

That fact is widely known. It is not color theory by itself.

### What was not found

Searches did not find a prior source connecting all of the following:

1. Six saturated RGB vertex colors ranked by BT.601 luma.
2. Complement pairs reversing that rank.
3. Rank sums becoming 7.
4. A standard die whose opposite faces are complementary colors.

This is one of CHROMALUM's stronger original-synthesis points. The proof is short but the connection is memorable and pedagogically useful.

### Suggested claim

Use:

> Complementation reverses the BT.601 luma order of the six chromatic RGB vertices; therefore assigning die pips by luma rank puts complementary colors on opposite faces under the standard opposite-sum-7 die rule.

Avoid:

> We discovered the standard die rule.

## 6. Cube Nets and Face-Adjacency Tree

### What is known

There are 11 distinct free cube nets up to rotation and reflection. This is standard elementary geometry and appears in MathWorld and many educational resources.

### CHROMALUM distinction

CHROMALUM's net claim is not that cube nets are new. The specific claim is:

1. Use the six chromatic colors as die faces.
2. Put complementary pairs on opposite faces.
3. Require the hue Gray path `R -> Y -> G -> C -> B -> M` to be realized by edge-adjacent die faces.
4. Read the resulting unfolded net as a face-adjacency tree.

The current technical note says this produces a 2-2-2 staircase-type free net. This should be treated as an internal lemma requiring proof by enumeration of the 11 nets or by face-adjacency-tree classification. The source literature confirms the 11 nets, but not this CHROMALUM-specific hue-path constraint.

### Source

- Wolfram MathWorld, "Cube", including the statement that the cube has 11 distinct nets.  
  https://mathworld.wolfram.com/Cube.html

## 7. Polyhedral Structures: Cube, Octahedron, Tetrahedra, Stella Octangula

### What is known

The cube-octahedron duality is standard. The cube has 8 vertices and the octahedron has 8 faces; the octahedron has 6 vertices corresponding naturally to the cube's 6 face directions or, in CHROMALUM, to 3 complement axes.

The cube's 8 vertices can be split by parity into two sets of 4. Each set forms a regular tetrahedron when embedded as alternating cube vertices. The union of the two tetrahedra is the regular compound known as the stella octangula, or stellated octahedron.

Graph-theoretically, the distance-2 graph on the vertices of `Q3` splits into two `K4` components, one on even parity vertices and one on odd parity vertices. These are the two tetrahedra.

### CHROMALUM distinction

The known facts above explain CHROMALUM's polyhedral visuals. The distinctive part is the color interpretation:

```text
distance 1 edges = single-channel toggles = RGB primary XOR results
distance 2 edges = two-channel toggles = CMY secondary XOR results = stella octangula
distance 3 edges = complements = XOR result W
```

This decomposition is mathematically straightforward:

```text
|E(K8)| = 28
8*C(3,1)/2 = 12
8*C(3,2)/2 = 12
8*C(3,3)/2 = 4
```

The individual components are known; the integrated color-atlas reading appears to be original in this application.

### Sources

- Wolfram MathWorld, "Tetrahedron 2-Compound".  
  https://mathworld.wolfram.com/Tetrahedron2-Compound.html
- Wolfram MathWorld, "Stellation", noting stella octangula as the only nontrivial stellation of the octahedron.  
  https://mathworld.wolfram.com/Stellation.html
- Wolfram MathWorld, "Hamming Graph".  
  https://mathworld.wolfram.com/HammingGraph.html
- Wolfram MathWorld, "Hamming Distance".  
  https://mathworld.wolfram.com/HammingDistance.html

## 8. "Color Algebra" as a False Friend

Searches for "algebra of color" also surface a separate mathematical-physics literature around nonassociative "color algebras", tied to hadron/quark color and Cayley-Dickson-like structures. This is not the same problem as CHROMALUM's finite RGB vertex model.

Relevant examples include:

1. Domokos and Kövesi-Domokos, "The algebra of color", Journal of Mathematical Physics, 1978.
2. Wene, "A Little Color in Abstract Algebra", American Mathematical Monthly, 1982.
3. Schafer, "A Generalization of the Algebra of Color", Journal of Algebra, 1993.
4. Elduque and Myung, "Colour algebras and Cayley-Dickson algebras", 1995.

These should not be treated as direct prior art unless CHROMALUM starts making claims about nonassociative algebras, quantum chromodynamics, or octonion-like multiplication. They are useful mainly because a reviewer may search "color algebra" and find them. The response is: same words, different object.

### Sources

- G. P. Wene, "A Little Color in Abstract Algebra", American Mathematical Monthly, DOI `10.1080/00029890.1982.11995467`.  
  https://www.tandfonline.com/doi/abs/10.1080/00029890.1982.11995467
- Alberto Elduque and Hyo Chul Myung, "Colour algebras and Cayley-Dickson algebras", Proceedings of the Royal Society of Edinburgh Section A, DOI `10.1017/S0308210500030511`.  
  https://www.cambridge.org/core/services/aop-cambridge-core/content/view/7EA28510A8B5F24418346AC74F4C312C/S0308210500030511a.pdf/colour_algebras_and_cayleydickson_algebras.pdf
- AMS Notices 1979 abstract mentioning Domokos and Kövesi-Domokos color algebra in hadron physics.  
  https://www.ams.org/journals/notices/197902/197902FullIssue.pdf

## Claim Boundaries

### Claims that are not defensible as novel

1. RGB colors form a cube.
2. The 8 binary RGB vertices are 3-bit vectors.
3. The 8 RGB/CMY vertices form a Boolean lattice `B3`.
4. Hasse diagrams, complement, join `U`, and meet `∩` explain an RGB/CMY duality.
5. XOR gives `GF(2)^3` / `Z2^3`.
6. The 7 nonzero vectors form the Fano plane.
7. Fano plane relates to Hamming(7,4).
8. The saturated RGB colors form a hue hexagon.
9. Cube vertices split into two tetrahedra.
10. Stella octangula is a compound of two tetrahedra.
11. A cube has 11 nets.
12. Standard dice have opposite faces summing to 7.

### Claims that are defensible as CHROMALUM-specific contributions

1. The `GRB` bit order is uniquely forced by BT.601 luma monotonicity over the 8 binary RGB vertices.
2. The 8-level CHROMALUM order is not arbitrary UI numbering; it is the binary order compatible with that luma inequality.
3. Complement luma reversal yields a six-color die ranking with opposite pips summing to 7.
4. The hue Gray cycle, luma zigzag, and die net are three views of the same six-color path.
5. `K8` edge decomposition by Hamming distance gives a compact atlas linking cube, stella octangula, and complement axes.
6. The Theory tab is an integrated educational visualization of these structures rather than a standalone restatement of any one known result.

### Claims that require more proof before publication

1. Uniqueness of the die net under hue-path and complement constraints.
2. Whether the `GRB` luma-monotone lemma remains unique under BT.709 / WCAG relative luminance.
3. Whether alternate luma coefficients with `max > sum(other two)` produce analogous unique bit orders.
4. Whether the CHROMALUM ordering has any perceptual advantages beyond luma ranking.
5. Whether the model can be generalized from 8 vertices to continuous RGB surfaces without losing algebraic clarity.

## Recommended Citation Strategy

Use the prior art openly. The strongest academic posture is to say:

> The underlying algebraic and geometric objects are classical. The contribution is the selection, alignment, and visualization of these objects through a BT.601-induced discrete color order.

Suggested citation grouping:

1. Cite Smith 1978 for RGB cube / HSV / hue hexagon.
2. Cite the JSSD CMY color cube papers for Boolean lattice / Hasse diagram / RGB-CMY duality.
3. Cite Taylor 2013 and MathILy for color addition as `Z2^3` and colored Fano plane.
4. Cite Lavrauw / Ball / Error Correction Zoo for Fano and Hamming.
5. Cite ITU-R BT.601 and W3C WCAG for luma/luminance distinction.
6. Cite MathWorld or a polyhedra text for cube nets and stella octangula geometry.

## Suggested Abstract Wording

```text
We present a discrete algebraic color atlas on the eight binary RGB vertices.
The underlying vertex set is the vector space GF(2)^3, so RGB toggles,
complements, the Fano plane PG(2,2), and Hamming(7,4) syndrome labels arise
from standard finite geometry and coding theory. The new organizing choice is
a BT.601 luma-monotone labeling: among the six assignments of RGB channels
to binary bit significance, the GRB assignment is uniquely compatible with
the luma order because 0.587 > 0.299 + 0.114 and 0.299 > 0.114. This ordering
connects complement luma reversal to the standard die opposite-sum rule,
and it aligns the RGB hue hexagon, a luma zigzag, cube/octahedron duality,
and a Hamming-distance decomposition of K8 into a single interactive model.
```

## Bottom Line

The model should not be framed as the discovery of a new algebraic structure. The algebraic structure is known.

It can be framed as a new discrete color atlas or synthesis:

```text
known finite algebra + known RGB/CMY lattice geometry + BT.601-forced GRB order
+ complement/dice theorem + hue/luma/dice/polyhedron integration
```

That is a legitimate and academically defensible contribution if the claims remain precise.
