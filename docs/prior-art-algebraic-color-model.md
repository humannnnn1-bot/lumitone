# 離散代数的色彩モデル — 重要先行研究

調査日：2026-04-19
整理方針：2026-04-29

## Related Notes

- 技術定義・定理・実装対応: [離散代数的色彩モデル](./algebraic-color-model.md)
- Theoryタブの改善提案: [Theoryタブ — 先行研究と改善提案](./theory-tab-prior-art-and-improvements.md)
- Music/LinkedVisualization: [Music Linked Visualization](./music-linked-visualization.md)

## Purpose

このノートは、Theory タブの研究・開発に本当に必要な先行研究だけを残す。網羅的な検索ログではなく、次のどちらかに該当する文献だけを保持する。

1. CHROMALUM が新規主張してはいけない既知構造を明確にする文献。
2. 実装・説明・UI 設計の判断に直接効く文献。

## Executive Summary

Theory タブの核にある次の構造は既知である。

- RGB cube と hue hexagon。
- 8 色を `Z2^3` / `GF(2)^3` として扱う色加算。
- 8 頂点を Boolean lattice `B3` / Hasse diagram として読むこと。
- 非零 7 点を Fano 平面 `PG(2,2)` として扱うこと。
- Fano 平面と Hamming(7,4) 符号の対応。
- cube nets、cube-octahedron duality、tetrahedra、stella octangula。

一方、今回残す先行研究の範囲では、次の統合を同一モデルとして示す例は見つかっていない。

1. BT.601 luma 係数から `GRB` ビット順序を一意化すること。
2. 補色 luma 反転を、標準サイコロの対面和 7 と接続すること。
3. hue Gray cycle、luma zigzag、dice net を同じ 6 色構造として重ねること。
4. `K8` の Hamming 距離分解を、cube / stella octangula / complement matching の色彩アトラスとして提示すること。
5. 上記を Theory タブの単一 UI に統合していること。

最も安全な新規性主張は次である。

> CHROMALUM は、既知の `GF(2)^3` 色加算、RGB cube、Boolean lattice、Fano 平面、Hamming 符号、多面体構造を基礎に、BT.601 luma により一意化される `GRB` レベル順序、補色-dice 定理、hue/luma/dice/polyhedra の対応を統合した、8 頂点 RGB 色集合の離散代数的色彩アトラスである。

## Essential Prior Art

| Keep | Source | Why it matters |
| --- | --- | --- |
| 必須 | Alvy Ray Smith, "Color Gamut Transform Pairs" | RGB cube、HSV/hexcone、hue hexagon の標準的背景。Theory タブは RGB cube 自体を新規主張できない。 |
| 必須 | 玉垣庸一・小原康裕・宮崎紀郎「CMYカラーキューブに基づく新たなカラーモデル II」 | Boolean lattice、Hasse diagram、RGB/CMY 双対、join/meet による理想化混色の直接的先行研究。 |
| 必須 | Ron Taylor, "Color Addition Across the Spectrum of Mathematics" | 8 色を `Z2 x Z2 x Z2` として扱い、Fano plane coloring に接続する最重要先行例。 |
| 必須 | ITU-R BT.601-7 | CHROMALUM の luma 係数 `0.299, 0.587, 0.114` の一次資料。GRB 一意性の出発点。 |
| 必須 | Fano/Hamming 標準資料 | Fano 平面と Hamming(7,4) の対応が既知であることを示す。色は符号語ではなく座標位置ラベルとして扱う。 |
| 重要 | MathWorld: Cube / Tetrahedron 2-Compound | 11 種類の cube nets、cube 内の 2 つの tetrahedra、stella octangula の幾何背景。 |

## Prior-Art Boundaries

### RGB Cube / Hue Hexagon

Smith 1978 により、RGB 色空間を cube として扱い、黒白軸まわりの有彩 6 色を hue hexagon として読むことは既知である。

CHROMALUM 側で主張できるのは、hue hexagon 自体ではない。主張できるのは、同じ 6 色経路を `GF(2)^3` の 1-bit Gray cycle、BT.601 luma zigzag、dice face adjacency として同時に読む統合である。

### Boolean Lattice / RGB-CMY Duality

JSSD の CMY color cube II は、Theory タブの Hasse diagram 説明にかなり近い。8 元の Boolean lattice、補元、join `U`、meet `∩`、RGB/CMY 双対は既知として扱う。

CHROMALUM 側の差分は、`B3` を BT.601 luma で固定された `GRB` レベル順序、補色-dice、Fano/Hamming、K8 分解へ接続する点にある。

### `Z2^3` / Fano

Taylor 2013 は、色加算を `Z2 x Z2 x Z2` として扱い、Fano plane coloring へ接続する。したがって「8 色は XOR 群になる」「Fano 線は XOR-zero triples である」は新規主張にしない。

CHROMALUM 側の差分は、Taylor の色加算遊びを RGB display primaries、BT.601 luma、Hamming syndrome labels、多面体分解と同じ UI に統合する点である。

### Hamming(7,4)

Fano 平面の 7 点を Hamming(7,4) 符号の parity-check matrix の 7 列として読むことは標準的である。Theory タブでは、色そのものを符号語とは呼ばず、`1..7` を座標位置 / syndrome label として扱う。この区別は維持する。

### BT.601 Luma

BT.601 係数そのものは既知であり、新規性はない。CHROMALUM の貢献は、次の不等式から 8 頂点 RGB の binary level order を一意に固定する点である。

```text
0.587 > 0.299 + 0.114
0.299 > 0.114
```

この結果、bit significance は `G,R,B` の順になり、`lv = 4G + 2R + B` が BT.601 luma 順と一致する。

### Dice / Cube Net / Stella

標準サイコロの対面和 7、cube nets、stella octangula は既知である。CHROMALUM 側の主張は、補色 luma 反転から die rank sum 7 が出ること、さらに hue Gray path が 2-2-2 staircase net と結びつくことである。

K8 分解も、個別の graph / polyhedra は既知である。CHROMALUM 側の差分は次の色彩アトラス化である。

```text
distance 1 = Q3 cube edges
distance 2 = stella octangula edges
distance 3 = complement matching
```

## Citation Strategy

論文・README・UI で引用するなら、次の役割分担にする。

1. Smith 1978: RGB cube / hue hexagon。
2. JSSD CMY color cube II: Boolean lattice / Hasse / RGB-CMY duality。
3. Taylor 2013: `Z2^3` color addition / Fano coloring。
4. Fano/Hamming 標準資料: `PG(2,2)` と Hamming(7,4) の既知対応。
5. ITU-R BT.601: luma 係数。
6. MathWorld Cube / Tetrahedron 2-Compound: cube nets と stella 背景。

## References

- Alvy Ray Smith, "Color Gamut Transform Pairs", SIGGRAPH 1978. https://alvyray.com/Papers/CG/color78.pdf
- 玉垣庸一・小原康裕・宮崎紀郎「CMYカラーキューブに基づく新たなカラーモデル II」, 日本デザイン学会研究発表大会概要集 47, 2000. https://www.jstage.jst.go.jp/article/jssd/47/0/47_290/_article/-char/ja/
- Ron Taylor, "Color Addition Across the Spectrum of Mathematics", Gathering 4 Gardner, 2013. https://www.gathering4gardner.org/g4g11gift/Taylor_Ron-Color_Addition.pdf
- ITU-R Recommendation BT.601-7. https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.601-7-201103-I!!PDF-E.pdf
- Michel Lavrauw, "Incidence Geometry and Buildings", lecture notes. https://osebje.famnit.upr.si/~michel.lavrauw/inc_geom_buildings_notes.pdf
- Error Correction Zoo, "Incidence-matrix projective code". https://errorcorrectionzoo.org/c/incidence_matrix
- Wolfram MathWorld, "Cube". https://mathworld.wolfram.com/Cube.html
- Wolfram MathWorld, "Tetrahedron 2-Compound".  
  https://mathworld.wolfram.com/Tetrahedron2-Compound.html
