# 離散代数的色彩モデル 技術ノート

## Related Notes

- 先行研究・新規性評価: [離散代数的色彩モデル 先行研究調査ノート](./prior-art-algebraic-color-model.md)
- Theoryタブの改善提案: [Theoryタブ 先行研究調査と改善提案](./theory-tab-prior-art-and-improvements.md)

## Abstract

本ノートは、CHROMALUM の Theory タブで用いている 8 色モデルを、離散代数・有限幾何・符号理論・多面体幾何の観点から整理する。モデルの核は、RGB チャンネルのオン/オフを 3 ビットベクトルとして読み、8 つの色を GF(2)^3 の元に対応させることである。

この核そのものは既知である。RGB 色立方体、Z2 x Z2 x Z2 による色加算、Fano 平面 PG(2,2)、Hamming(7,4) 符号との関係は、既存の数学教材・レクリエーショナル数学・色空間解説に現れる。

本モデルの独自性は、これら既知構造を、BT.601 luma による一意な GRB レベル順序、補色 luma 定理、標準サイコロの対面和 7、色相グレイ巡回、Fano/Hamming 対応、多面体双対、K8 の Hamming 距離分解として、単一の 8 色体系へ統合する点にある。

## Model Assumptions

本モデルは一般的な色彩科学全体を扱うものではない。以下の仮定に基づく、有限個の色を対象とする離散モデルである。

1. 色集合は RGB チャンネルのオン/オフだけからなる 8 色である。
2. 各色はビット列 `[G,R,B]` で表す。
3. レベル番号は `lv = 4G + 2R + B` で定義する。
4. 加法的な構造は GF(2)^3 上の XOR で読む。
5. 集合論的な構造は `{G,R,B}` の部分集合束 B3 として読む。
6. 補色は `c' = c xor 7` で定義する。
7. 明るさ指標には、BT.601 型の luma

   ```text
   Y = 0.299 R + 0.587 G + 0.114 B
   ```

   を用いる。

この luma は CIE の知覚明度でも、WCAG の相対輝度でもない。BT.601 はガンマ補正済み信号から Y' を構成する規格であり、WCAG の相対輝度は sRGB を線形化したうえで `0.2126, 0.7152, 0.0722` を用いる。したがって本モデルの「luma順」は、知覚的均等性やアクセシビリティ・コントラストを直接保証しない。

## Color Labels

本モデルでは、8 色を次のようにラベル付けする。

| lv | bits `[G,R,B]` | set | color | short | luma |
| ---: | :---: | :--- | :--- | :---: | ---: |
| 0 | 000 | empty | Black | K | 0 |
| 1 | 001 | {B} | Blue | B | 29 |
| 2 | 010 | {R} | Red | R | 76 |
| 3 | 011 | {R,B} | Magenta | M | 105 |
| 4 | 100 | {G} | Green | G | 150 |
| 5 | 101 | {G,B} | Cyan | C | 179 |
| 6 | 110 | {G,R} | Yellow | Y | 226 |
| 7 | 111 | {G,R,B} | White | W | 255 |

ここで luma は 8 ビット RGB 値 `0` または `255` に対する丸め値である。

## Known Structures

### RGB Color Cube

RGB 色空間を 3 次元立方体として見ることは標準的である。8 頂点は `000` から `111` までの 3 ビットベクトルであり、各辺は 1 チャンネルの切り替えに対応する。

CHROMALUM ではこの立方体を Q3 として扱い、辺を Hamming 距離 1 のペアとして読む。

### Boolean Lattice B3

8 色は `{G,R,B}` の全ての部分集合と同一視できる。

```text
K = empty
B = {B}
R = {R}
G = {G}
M = {R,B}
C = {G,B}
Y = {G,R}
W = {G,R,B}
```

この見方では、OR は集合和、AND は集合共通部分、補色は `{G,R,B}` における集合補集合である。

### GF(2)^3 / Z2 x Z2 x Z2

XOR は GF(2)^3 の加法である。各色は基底 `{B=1, R=2, G=4}` の一意な XOR 結合として表せる。

```text
B xor R = M
B xor G = C
R xor G = Y
B xor R xor G = W
c xor c = K
c xor (c xor 7) = W
```

この種の色加算モデルは既知であり、既存文献では 8 色を `Z2 x Z2 x Z2` の元として扱う例がある。本ノートでは、これを CHROMALUM の luma レベル、Fano/Hamming、多面体構造へ接続する。

### Hue Hexagon / Gray Cycle

完全飽和色の有彩色 6 頂点は、RGB 色立方体の黒白軸を囲む六角形として現れる。

```text
R -> Y -> G -> C -> B -> M -> R
```

CHROMALUM のレベル順で書くと、

```text
2 -> 6 -> 4 -> 5 -> 1 -> 3 -> 2
```

であり、各ステップは 1 ビットだけを反転する。したがってこれは、立方体 Q3 の有彩色頂点上の 6-cycle であり、Gray code 的な巡回である。

### Fano Plane PG(2,2)

非零レベル `{1,...,7}` は、GF(2)^3 の非零ベクトルである。射影化すると、これらは Fano 平面 PG(2,2) の 7 点になる。

Fano 線は次の 7 本である。

```text
{1,2,3} = {B,R,M}
{1,4,5} = {B,G,C}
{2,4,6} = {R,G,Y}
{1,6,7} = {B,Y,W}
{2,5,7} = {R,C,W}
{3,4,7} = {M,G,W}
{3,5,6} = {M,C,Y}
```

各線 `{a,b,c}` は

```text
a xor b xor c = 0
```

を満たす。Black(0) は零ベクトルであり、射影平面の点にはならない。

### Hamming(7,4)

Fano 平面の 7 点は、Hamming(7,4) 符号のパリティ検査行列の 7 列として読むことができる。CHROMALUM では、色そのものを符号語とは呼ばず、1..7 を符号語の座標位置ラベルとして扱う。

```text
P1 = Blue  = position bit 001
P2 = Red   = position bit 010
P4 = Green = position bit 100
```

単一位置の誤りに対し、失敗したパリティ検査の集合が誤り位置の 3 ビット表現になる。

## Original Contributions

本節は、既知構造を前提に、本モデルとして新規性を主張しやすい部分を整理する。

### Contribution 1: GRB Luma Monotone Labeling

BT.601 係数

```text
G = 0.587
R = 0.299
B = 0.114
```

は

```text
G > R + B
R > B
```

を満たす。このため、3 ビット番号 `4G + 2R + B` は、8 つの RGB 頂点の luma 順と一致する。

6 通りのチャンネル割当のうち、レベル番号が luma に対して単調増加する割当は GRB だけである。

### Contribution 2: Complement Luma Theorem

任意の係数 `w_R, w_G, w_B` が

```text
w_R + w_G + w_B = 1
```

を満たすとする。色 `c = (R,G,B)` の補色を

```text
c' = (1-R, 1-G, 1-B)
```

とすると、

```text
Y(c) + Y(c') = 255
```

が成り立つ。

これは BT.601 に限らず、係数和が 1 の任意の線形 luma に対して成り立つ。

### Contribution 3: Standard Die Rule from Complement Reversal

有彩色 6 色を luma の昇順に 1 から 6 として並べる。

```text
B < R < M < G < C < Y
```

補色は luma 順序を反転するため、補色ペアは必ず順位和 7 になる。

```text
B(1) + Y(6) = 7
R(2) + C(5) = 7
M(3) + G(4) = 7
```

これは標準的な六面サイコロの対面和 7 と同じ規則である。したがって、6 つの有彩色をサイコロ面に配置する場合、補色ペアを対面に置く自然な理由が得られる。

### Contribution 4: Hue Gray Cycle, Luma Zigzag, and Die Net

有彩色六角形 `R -> Y -> G -> C -> B -> M` は、各ステップが 1 ビット反転であるため、Gray code 的な巡回である。同じ経路は、BT.601 luma の 6 区間ジグザグを与える。

この経路をサイコロの面隣接木として要求すると、6 面の隣接 5 本がすべて使われるため、面隣接木全体がこの Hamilton path に固定される。そこから得られる自由立方体展開図は 2-2-2 型の階段形になる。

この主張は、本モデル内では重要な幾何的特徴である。ただし、論文化する場合は、11 種類の自由立方体展開図に対する同値関係と一意性を、別途補題として形式化する必要がある。

### Contribution 5: Unified Polyhedral Reading

8 色の全 28 ペアは Hamming 距離により 3 種類へ分かれる。

| distance | edge count | structure | XOR result |
| ---: | ---: | :--- | :--- |
| 1 | 12 | cube Q3 | RGB primaries |
| 2 | 12 | stella octangula edges | CMY secondaries |
| 3 | 4 | complement diagonals | White |

すなわち、

```text
E(K8) = E(Q3) disjoint union E(Stella) disjoint union M4
```

である。

この分解を色彩モデルとして視覚化することで、立方体、八面体、偶奇四面体、星形八面体を同じ GF(2)^3 構造の複数の影として読むことができる。

## Core Theorems and Proof Sketches

### Theorem 1: GRB is the unique luma-monotone bit assignment

Let the 3 bit weights be assigned to color channels. A binary level order is luma-monotone if

```text
Y(000) < Y(001) < Y(010) < Y(011) < Y(100) < Y(101) < Y(110) < Y(111).
```

For BT.601 coefficients, the unique assignment is

```text
bit 2 = G
bit 1 = R
bit 0 = B
```

Proof sketch:

For binary numeric order to be luma-monotone, the most significant bit must exceed the sum of the two lower bits, and the middle bit must exceed the lowest bit. BT.601 satisfies

```text
0.587 > 0.299 + 0.114
0.299 > 0.114
```

so the only possible assignment is `G,R,B` in descending bit significance.

### Theorem 2: Complement luma sum

Let

```text
Y(c) = 255 (w_R R + w_G G + w_B B)
```

where each channel is 0 or 1 and `w_R + w_G + w_B = 1`. Then

```text
Y(c) + Y(c xor 7) = 255.
```

Proof:

The complement replaces each bit `x` by `1-x`. Therefore

```text
Y(c') = 255 (w_R(1-R) + w_G(1-G) + w_B(1-B))
      = 255 ((w_R+w_G+w_B) - (w_R R + w_G G + w_B B))
      = 255 - Y(c).
```

### Theorem 3: Die opposite faces sum to 7

Assume the six chromatic colors have distinct luma values. Rank them from darkest to brightest as `d(c) in {1,...,6}`. Then

```text
d(c) + d(c') = 7.
```

Proof sketch:

By Theorem 2, complementation maps luma `Y` to `255-Y`, so it reverses the strict order. An order-reversing involution on a 6 element chain pairs rank `k` with rank `7-k`.

### Theorem 4: Fano lines are XOR-zero triples

For nonzero `a,b,c in GF(2)^3`, the triple `{a,b,c}` is a Fano line iff

```text
a xor b xor c = 0.
```

Proof sketch:

In PG(2,2), every projective point has a unique nonzero vector representative. The line through two distinct points `a` and `b` is the 2-dimensional subspace generated by them, whose nonzero elements are `{a,b,a+b}`. In characteristic 2, `a+b = a xor b`, hence the three points satisfy `a+b+c=0`.

### Theorem 5: K8 edge partition by Hamming distance

The complete graph on 8 GF(2)^3 vertices has 28 edges. These split by Hamming distance as

```text
12 edges of distance 1
12 edges of distance 2
4 edges of distance 3
```

Proof sketch:

For each vertex in the 3-cube, there are `C(3,d)` vertices at Hamming distance `d`. Counting unordered pairs gives

```text
d=1: 8*C(3,1)/2 = 12
d=2: 8*C(3,2)/2 = 12
d=3: 8*C(3,3)/2 = 4
```

The distance 1 edges form Q3, the distance 2 edges form two inscribed tetrahedra, and the distance 3 edges form the complement matching.

## Correspondence Table

| Structure | Objects | Color interpretation |
| :--- | :--- | :--- |
| Boolean lattice B3 | subsets of `{G,R,B}` | channels present in a color |
| GF(2)^3 | 8 vectors | 8 color levels |
| Q3 cube | Hamming distance 1 graph | single-channel toggles |
| Gray cycle | chromatic 6-cycle | hue order R -> Y -> G -> C -> B -> M |
| Fano plane PG(2,2) | 7 nonzero vectors | non-black colors |
| Hamming(7,4) | 7 coordinate positions | nonzero color labels as syndrome positions |
| Octahedron | 6 chromatic vertices | complement axes R-C, G-M, B-Y |
| Tetrahedra T0/T1 | even/odd parity split | two inscribed tetrahedra |
| Stella octangula | distance 2 edges | two-channel flips |
| K8 | all pairs of 8 colors | distance 1/2/3 decomposition |

## Limits and Non-Claims

This model does not claim the following:

1. It does not claim to be a complete theory of color perception.
2. It does not model CIE XYZ, CIELAB, OKLab, cone response, chromatic adaptation, or color difference.
3. It does not claim that XOR is physical additive light mixing.
4. It does not claim that AND is real pigment or ink mixing.
5. It does not claim that BT.601 luma is perceptual lightness.
6. It does not claim that the Fano/Hamming correspondence is newly discovered.
7. It does not claim that the RGB cube itself is newly discovered.

The accurate claim is narrower:

> This is a unified discrete algebraic color model for the 8 binary RGB vertices, combining known GF(2)^3, Fano, Hamming, and cube structures with a luma-induced GRB order, complement-die duality, hue Gray cycle, and polyhedral decomposition.

## Implementation Notes

The current CHROMALUM implementation stores the core data and invariants in:

```text
src/components/theory/theory-data.ts
src/components/TheoryPanel.tsx
src/i18n/ja.ts
src/i18n/en.ts
src/__tests__/theory-data.test.ts
src/__tests__/theory-copy.test.ts
```

Important invariants currently tested include:

1. Fano lines form a Steiner triple system.
2. BT.601 coefficients make `GRB` the unique luma-monotone bit assignment over the six RGB channel-to-bit permutations.
3. Complementation `lv xor 7` reverses the six chromatic BT.601 luma ranks, so die-opposite rank sums are 7.
4. CMY line is treated as an even-parity tetrahedron rather than a literal Euclidean plane slice.
5. Gray cycle uses only one-bit flips.
6. K8 edges partition by Hamming distance.
7. T0 is closed under XOR.
8. Subtractive CMY examples are Boolean AND identities, not XOR identities.
9. Hamming labels are coordinate positions, not color codewords.
10. Cube-face spanning trees enumerate the 11 free cube nets, and the hue-order die path uniquely unfolds as the displayed 2-2-2 staircase net.

## References

- ITU-R, Recommendation BT.601: digital component video and luma construction.  
  https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.601-6-200701-S!!PDF-E.pdf
- W3C, WCAG relative luminance definition.  
  https://www.w3.org/WAI/GL/2012/WD-wcag2ict-20121126/#relative-luminance
- GMT Documentation, Color systems and RGB cube hue path.  
  https://docs.generic-mapping-tools.org/6.2/cookbook/colorspace.html
- Wolfram Programming Lab, Color Cube.  
  https://www.wolfram.com/programming-lab/explorations/color-cube/
- Ron Taylor, "Color Addition Across the Spectrum of Mathematics."  
  https://www.gathering4gardner.org/g4g11gift/Taylor_Ron-Color_Addition.pdf
- Michel Lavrauw, "Incidence Geometry and Buildings" lecture notes, Fano plane and Hamming code construction.  
  https://osebje.famnit.upr.si/~michel.lavrauw/inc_geom_buildings_notes.pdf
- Keith Ball, Combinatorics II slides, finite projective plane over Z2.  
  https://warwick.ac.uk/fac/sci/maths/people/staff/keith_ball/combinatorics_ii_slide_17-18.pdf
