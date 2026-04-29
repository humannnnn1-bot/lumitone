# Music Linked Visualization

作成日: 2026-04-28

## Related Notes

- 技術定義・定理・実装対応: [離散代数的色彩モデル](./algebraic-color-model.md)
- 先行研究・新規性評価: [離散代数的色彩モデル — 先行研究](./prior-art-algebraic-color-model.md)
- Theoryタブの改善提案: [Theoryタブ — 先行研究と改善提案](./theory-tab-prior-art-and-improvements.md)
- Music Linked Visualization の先行研究・開発参考: [Music Linked Visualization — 先行研究と開発参考](./prior-art-music-linked-visualization.md)

## Purpose

本ノートは、CHROMALUM の `LinkedVisualization` と Music タブで使う、色相角・luma 半径・位相回転・音高写像の関係を整理する。

これは「色彩の明るさそのものが三角関数で変化する」という主張ではない。BT.601 luma によって決まる各レベルの半径を固定し、その点を RGB 色相環上で回転させ、画面上の x/y 射影をグラフ化している、という意味で三角関数が現れる。

## Prior-Art Boundary

このレイヤーは、既存の色彩工学、ソニフィケーション、音楽理論、Web Audio 実装を組み合わせた可視化・音響化レイヤーである。したがって、次の要素それ自体は新規性として主張しない。

1. BT.601 型 luma 係数による RGB 信号値の重み付け。
2. RGB/HSV/HSY 型の計算色相、純色六角形、色相角による色の整理。
3. 極座標上の点を `sin` / `cos` で画面 x/y へ射影すること。
4. 色相、彩度、明度などをピッチ、音色、音量、定位へ写像する色ソニフィケーション。
5. 位相差に応じて合成振幅が変化する三角関数的干渉式。
6. 12 平均律、純正律、ダイアトニック、オクタトニックなどの既存音階への角度写像。

特に、色を音へ写す研究・装置には [See ColOr](https://icad.org/Proceedings/2010/BolognaDevillePun2010.pdf)、[Colorophone 2.0](https://www.mdpi.com/1424-8220/21/21/7351)、[Sonifyd:Colormatrics](https://nime.pubpub.org/pub/efyd2zra/release/1) などの先行例がある。また、色相と音高の対応は心理物理的に安定した普遍対応として扱うべきではない。色音対応のレビューや近年の実験研究でも、pitch-height と明度・彩度の対応は比較的扱いやすい一方、色相固有の pitch 対応は弱く、文脈依存的であることが示されている。

CHROMALUM 側の固有性は、これらの標準要素を単独で使う点ではなく、BT.601 luma 順の 8 頂点 RGB アトラス、L0/L7 補色半径、`alpha0` / `alpha7` 位相、GRB bit order、Fano/Hamming/polyhedral などの代数的色彩構造と、Music タブのピッチ・ゲイン・位相写像を同じ操作系で連動させる点にある。詳細な先行研究と開発上の示唆は [Music Linked Visualization — 先行研究と開発参考](./prior-art-music-linked-visualization.md) に分離する。

## Coordinate Model

レベル `L` の luma 値を `Y_L`、表示最大半径を `R` とする。`LinkedVisualization` は L0 原点系と L7 原点系を次の半径で扱う。

```text
r0(L) = (Y_L / 255) R
r7(L) = (1 - Y_L / 255) R
```

ここで `Y_L` は BT.601 型 luma

```text
Y = 0.299 R' + 0.587 G' + 0.114 B'
```

を 8-bit RGB 頂点へ適用した値である。この luma は CIE 明度や WCAG 相対輝度ではない。

色相角を `theta`、位相・原点回転角を `alpha` とすると、実装上の円上の点は次の角度で置かれる。

```text
rad = theta - alpha - 90deg
x = cx + r cos(rad)
y = cy + r sin(rad)
```

SVG 画面座標では y 軸が下向きなので、標準的な数学座標で `beta = theta - alpha` と読むと、画面上の射影は次の形になる。

```text
screen-x = x - cx =  r sin(beta)
screen-y = y - cy = -r cos(beta)
math-y            =  r cos(beta)
```

したがって Music タブ上のグラフラベルは、画面座標の射影として読む。

```text
right graph  = screen-y projection = -r cos(theta - alpha)
bottom graph = screen-x projection =  r sin(theta - alpha)
```

## Meaning of Alpha

ここでの `alpha` は CSS や画像処理でいう透明度ではない。`LinkedVisualization` では、`alpha0` と `alpha7` は L0 原点系・L7 原点系それぞれの位相回転角である。

Music タブでは、現在の原点モードに応じて

```text
activeAlpha = alpha0  when L0 is origin
activeAlpha = alpha7  when L7 is origin
```

を選び、音高写像にも `theta + activeAlpha` を使う。これにより、視覚上の位相回転と音高の回転が一致する。

## Hue Angle and Color Candidates

CHROMALUM の hue angle は、CIE L*a*b* や Oklab のような知覚均等色空間の hue angle ではない。RGB/HSV 型の純色六角形上の計算色相である。

各有彩レベルの候補色は、次の条件を満たす RGB 純色として求められる。

1. 1 つのチャンネルが `255`。
2. 1 つのチャンネルが `0`。
3. 残り 1 チャンネルを調整して、そのレベルの BT.601 luma に一致させる。

したがって、点群は単なる装飾ではなく、同一 luma を持つ純色候補の集合である。ただし、これは知覚的な等明度集合を意味しない。

## Complement Symmetry

BT.601 型 luma の係数和は 1 なので、RGB 頂点の補色 `c' = c xor 7` について

```text
Y(c) + Y(c') = 255
```

が成り立つ。このため

```text
r0(L) = r7(7 - L)
```

となり、L0 原点系と L7 原点系は補色対に対して反転対称になる。

デフォルトの有彩色候補では、補色ペアは luma 和が 255 で、色相角も 180 度離れる。

| pair | luma | default hue angles |
| --- | ---: | --- |
| L1 Blue / L6 Yellow | 29 + 226 = 255 | 240deg / 60deg |
| L2 Red / L5 Cyan | 76 + 179 = 255 | 0deg / 180deg |
| L3 Magenta / L4 Green | 105 + 150 = 255 | 300deg / 120deg |

## Phase Difference and Interference

`alpha0` と `alpha7` の差を

```text
deltaAlpha = alpha7 - alpha0
```

とすると、補色ペアの合成曲線は三角関数の和積公式に従う。等しい半径 `r` の同型ペアを足すと、有効振幅は概念的に次の形になる。

```text
amplitude = 2 r cos(deltaAlpha / 2)
```

したがって、`deltaAlpha = 0deg` では同位相で強調され、`deltaAlpha = 180deg` では逆位相でキャンセルされる。Music タブの持続音ゲインも、この関係を反映して `abs(cos(deltaAlpha / 2))` を位相係数として使う。

## Pitch Mapping

Music タブでは、色相角を音高空間へ写す。基本は

```text
liveAngle = theta + activeAlpha
```

である。12 平均律モードでは、`liveAngle` を 2 オクターブ分の連続的な指数写像へ送る。

```text
freq = 220 * 2^((liveAngle mod 360) / 360 * 2)
```

純正律、オクタトニック、ダイアトニックの各モードでは、連続角度をそれぞれのスケール度数へスナップする。したがって、これらは連続的な三角関数音高ではなく、角度から離散音階への量子化である。

単音バースト、持続音、音程表示はいずれも `activeAlpha` を含む角度を使う。これにより、alpha 回転後にクリックした単音と、画面上の音程表示・ドローン音高が一致する。

## Algebraic Timbre / Bit Spectrum

代数的デモで使う `Bit Spectrum` では、色相角そのものを音高へ写すのではなく、Theory タブと同じ `GF(2)^3` のビット構造を音色成分へ写す。

レベル `lv` を

```text
lv = 4G + 2R + B
```

として読むと、音色は次のようなビット基底の合成として定義する。

```text
T(lv) = B * tau_B + R * tau_R + G * tau_G
```

ここで `tau_B`, `tau_R`, `tau_G` は Web Audio 上の倍音成分である。したがって、Black `000` は成分なし、White `111` は全成分、有彩色の Gray cycle は音色成分が 1 つずつ切り替わる巡回として聴こえる。

このモードは、音響ミックスそのものが XOR を実装する、という意味ではない。XOR はコード側で `a xor b` として計算し、その結果のレベルを `Bit Spectrum` として鳴らす。通常の音響加算は GF(2) 加法ではないため、同じ音を 2 回足しても Black には戻らない。

## Routing of Structural Sonifications

Music タブの手動バーストは `Pitch` 固定にする。一方で、Fano Sequences と Structural Sonification の各デモでは、ユーザー選択ではなく、デモの数学的役割に合わせて音響写像を固定する。

- `Bit Spectrum`: XOR, Fano incidence, line/coset, Hamming labels, Boolean operations, Cayley rows, K8/tetra/octahedron など、`GF(2)^3` の点・部分集合・演算を聴かせるデモ。
- `Pitch`: Gray traversal melody や GL(3,2) のドローン変換など、色相角・回転・既存ドローンの幾何的配置を聴かせるデモ。
- Dedicated sonification: Fano rhythm, complement/luma canon, luma zigzag, Hamming error marker など、ビット音色でも音高でもなく、その構造固有の時間・輝度・誤りマーカーを聴かせるデモ。

この分離により、代数的構造を説明するデモでは `Pitch` による色相写像を混ぜず、幾何的・輝度的・リズム的なデモでは `Bit Spectrum` を無理に適用しない。

## Implementation Map

このレイヤーは、離散代数的色彩モデル本体の上に置かれた可視化・音響化レイヤーである。主な実装対応は次の通り。

| responsibility | implementation |
| --- | --- |
| BT.601 luma, hue candidates, default candidates | `src/color-engine.ts` |
| bit-spectrum timbre basis and music invariants | `src/data/music-data.ts` |
| luma radii, alpha rotation, x/y projections, complement curves | `src/components/LinkedVisualization.tsx` |
| Music-specific wrapper and interval overlay | `src/components/music/MusicLinkedVisualization.tsx`, `src/components/music/IntervalRatios.tsx` |
| angle-to-frequency mapping | `src/data/music-frequency.ts` |
| drone, bursts, phase gain, algebraic sonification | `src/hooks/useMusicEngine.ts` |
| Music tab state and controls | `src/components/MusicPanel.tsx` |

## Scope Limits

1. The graph is a trigonometric projection of a luma-radius hue circle; it is not a model of luma varying sinusoidally with hue.
2. The hue angle is RGB/HSV-style computational hue, not a perceptually uniform hue angle.
3. BT.601 luma is a gamma-corrected signal measure, not CIE lightness or WCAG relative luminance.
4. The sonification is a mapping from this discrete color atlas to pitch, gain, and phase behavior. It is not a psychoacoustic model of color-hearing correspondence.
5. The trigonometric and pitch-mapping pieces are mathematically standard. CHROMALUM's contribution is the integration of these pieces with BT.601 luma order, complement symmetry, GRB bit order, and the Fano/Hamming/polyhedral color atlas.
