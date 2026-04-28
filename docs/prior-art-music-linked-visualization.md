# Music Linked Visualization — 先行研究と開発参考

作成日: 2026-04-28

## Purpose

本ノートは、CHROMALUM の `LinkedVisualization` と Music タブを開発するうえで参考になる先行研究を整理し、どこに既存性があり、どこに CHROMALUM 固有の設計余地があるかを明確にする。

ここでの「新規性」は研究・設計上の位置づけであり、特許性や法的な新規性の判断ではない。特許調査を行う場合は、別途クレーム単位の調査が必要である。

## Executive Summary

Music Linked Visualization は、次の個別要素については強い先行研究がある。

1. RGB から luma を求める信号処理。
2. RGB/HSV/HSY 的な計算色相。
3. 色相、彩度、明度を音高、音色、音量、定位へ写すソニフィケーション。
4. 円環角度を音高や pitch class へ写す可視音楽的手法。
5. 位相差による干渉・合成振幅の三角関数。
6. Web Audio API によるブラウザ内音響生成。

したがって、`hue -> pitch` や `luma -> gain` だけを新規性として主張するのは弱い。既存研究に対して強く打ち出せるのは、BT.601 luma 順の 8 頂点 RGB アトラス、L0/L7 補色半径、`alpha0` / `alpha7` 位相、GRB bit order、Fano/Hamming/polyhedral などの代数的色彩構造と、音響写像を同じ操作系で結合している点である。

開発方針としては、現在の `hue -> pitch` を「心理物理的な色聴対応」ではなく「CHROMALUM の構造的・作曲的写像」として扱うのが安全である。ユーザー向けには、`hue -> pitch` だけでなく `hue -> timbre` または `hue -> instrument family` のモードを追加すると、先行研究との整合性と学習性が上がる。

## Direct Prior Art: Color Sonification

### See ColOr

[See ColOr](https://icad.org/Proceedings/2010/BolognaDevillePun2010.pdf) は、HSL 色空間を使った色ソニフィケーションの代表的な研究である。色相を楽器音色、彩度を音高、明度を声やベース系の音へ割り当てる。CHROMALUM の現在実装とは異なり、色相を直接ピッチへ割り当てるよりも、色相を音色カテゴリへ割り当てる設計を重視している。

開発上の示唆:

- 色相をピッチへ写すモードは維持できるが、学習しやすい代替として `hue -> timbre` モードを検討する価値がある。
- 色相間を滑らかに移動する場合、隣接する音色のゲインを補間する設計が使える。
- 音源が増えすぎると聴取が難しくなるため、同時発音数や空間化は制限する。

### Colorophone 2.0

[Colorophone 2.0](https://www.mdpi.com/1424-8220/21/21/7351) は、色をリアルタイムにステレオ音景へ変換するウェアラブル装置である。色ソニフィケーション、ユーザビリティ、実装、装置としての運用をまとめて扱っている。

開発上の示唆:

- CHROMALUM の Music タブも、単なる数式デモではなく、聴取疲労、音量安全、ミュート、プリセット、学習導線を含めて設計する必要がある。
- 音の情報密度を上げすぎると意味が取りにくくなる。代数的情報を全部鳴らすより、モードごとに主目的を分ける方がよい。
- ステレオ定位は有効だが、視覚位置と音像位置を一貫させる必要がある。

### Mobile Video-to-Audio Sensory Substitution Review

[Mobile Video-to-Audio Transducer and Motion Detection for Sensory Substitution](https://www.frontiersin.org/articles/10.3389/fict.2015.00020/full) は、The vOICe、EyeMusic、SoundView、SeeColOr、PSVA、VIBE、KromoPhone などの視覚から聴覚への感覚代行システムを比較している。

開発上の示唆:

- 色、明度、位置、動きを同時に音へ写すシステムは既に多数ある。
- CHROMALUM の差別化は、一般的な画像理解ではなく、離散代数的な色構造を操作・聴取できる点に置くべきである。
- `x position -> pan`、`brightness/luma -> gain`、`vertical position -> pitch` は既存の定番設計なので、新規性ではなく操作上の自然さとして説明する。

### Sonifyd:Colormatrics

[Sonifyd:Colormatrics](https://nime.pubpub.org/pub/efyd2zra/release/1) は、画像やピクセルの色を音へ写す NIME 系の実践であり、hue を musical pitch、saturation を detune、brightness を amplitude に対応させる。CHROMALUM の `hue -> pitch`、`luma -> gain` にかなり近い。

開発上の示唆:

- `hue -> pitch` と `brightness -> amplitude` の組み合わせは既存例があるため、CHROMALUM では「どの色集合を鳴らすか」と「どの対称性を操作できるか」を強調する。
- 彩度がない CHROMALUM の 8 頂点モデルでは、saturation の代わりに補色ペア、位相差、Hamming distance、Fano line membership などを音響パラメータへ割り当てる余地がある。
- 作曲・演奏ツールとして扱う場合は、視覚音楽インターフェースとしての文脈で評価する。

## Broader Sonification Design References

### Systematic Review of Mapping Strategies

[A Systematic Review of Mapping Strategies for the Sonification of Physical Quantities](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0082491) は、物理量を音響パラメータへ写す多数のソニフィケーション研究をレビューしている。

開発上の示唆:

- ピッチはよく使われるが、万能の写像先ではない。
- 複数の値を同時に pitch, loudness, timbre, tempo, pan へ割り当てると、認知負荷が急に上がる。
- CHROMALUM では、モードごとに「今聴かせたい構造」を限定する方がよい。例: luma mode、complement mode、Fano line mode、Hamming mode。

### The Sonification Handbook

[The Sonification Handbook](https://sonification.de/handbook/downloads/) は、聴覚表示、パラメータマッピング、聴取可能性、ユーザー評価を体系的に扱う基礎資料である。

開発上の示唆:

- 連続値の可聴化では、値域、スケーリング、クリッピング、聴取疲労を先に設計する。
- 直接的な数式対応より、ユーザーが比較・識別できる音の差を優先する。
- デモ用途と分析用途では、同じ音響写像でも適切な密度や音量が異なる。

## Color Space and Luma References

### ITU-R BT.601

[ITU-R BT.601](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.601-7-201103-I!!PDF-E.pdf) は、CHROMALUM が使う luma 係数 `Y = 0.299 R' + 0.587 G' + 0.114 B'` の一次資料である。

開発上の示唆:

- この luma は gamma-corrected video signal の重み付き和であり、CIE lightness や WCAG relative luminance ではない。
- ドキュメントでは `luma` と `luminance` と `lightness` を混同しない。
- Music タブで `luma -> radius/gain` を使う場合も、物理輝度ではなく CHROMALUM の離散信号値として説明する。

### RGB/HSV/HSY Models

[Alvy Ray Smith, Color Gamut Transform Pairs](https://alvyray.com/Papers/CG/color78.pdf) は、RGB cube、HSV/HSL 的な色空間、色相・彩度・明度の計算モデルを理解するうえで重要である。[Krita の HSX blending mode documentation](https://docs.krita.org/en/reference_manual/blending_modes/hsx.html) は、HSY のように hue/saturation と luma を分けて扱う実用的な説明として参照できる。

開発上の示唆:

- CHROMALUM の hue angle は知覚均等色空間の hue ではなく、RGB/HSV 型の計算色相である。
- luma を固定して純色候補を探す設計は、知覚的等明度ではなく、信号値上の制約として説明する。
- UI 表記では `perceptual hue` や `equal lightness` のような表現を避ける。

### WCAG Relative Luminance

[WCAG 2.2 relative luminance definition](https://www.w3.org/TR/WCAG22/relative-luminance.html) は、アクセシビリティ文脈で使われる相対輝度の参照である。CHROMALUM の BT.601 luma とは異なる。

開発上の示唆:

- コントラスト評価やアクセシビリティを扱う場合、BT.601 luma とは別に WCAG relative luminance を使う必要がある。
- Music Linked Visualization の半径や音量は WCAG コントラスト指標ではない。

## Color-Sound Correspondence and Synesthesia

### Historical and Critical Reviews

[Coloured hearing, colour music, colour organs, and the search for perceptually meaningful correspondences between colour and sound](https://journals.sagepub.com/doi/10.1177/20416695221092802) は、色聴、カラーオルガン、色と音の対応史を批判的に整理している。

開発上の示唆:

- 色相と音高に普遍的な対応がある、という主張は避ける。
- 色音対応は芸術的・文化的・個人的・タスク依存的な側面が大きい。
- CHROMALUM では「色を音で正しく再現する」ではなく「色彩構造を音でも操作・比較できる」と表現する方がよい。

### Pitch Class and Color Synesthesia

[Musical pitch classes have rainbow hues in pitch class-color synesthesia](https://www.nature.com/articles/s41598-017-18150-y) は、pitch class と色相円を結びつける発想の参考になる。ただし、これは共感覚者に関する研究であり、一般ユーザーに普遍的な hue-pitch 対応があることを意味しない。

開発上の示唆:

- 円環としての hue と pitch class は構造的に相性がよい。
- 一方で、現在の 12TET モードは 360 度を 2 オクターブの pitch height に写しているため、円環性と上下方向の pitch height が混ざる。
- より円環的にしたい場合は、pitch class 固定、Shepard tone 的表現、または octave equivalence を明示する UI が候補になる。

### Recent Empirical Work

[One- or two-step? New insights into two-step hypothesis and rainbow-like theory for pitch class-color synesthesia](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1482714/full) は、pitch class と色の対応について近年の実験的な議論を示している。

開発上の示唆:

- 明度・彩度と pitch-height の対応は比較的説明しやすいが、色相と pitch class の対応は安定しにくい。
- `hue -> pitch` はデフォルトの数学的写像としては使えるが、ユーザー設定可能にするのが望ましい。

## Audio Implementation References

### Web Audio API

[Web Audio API](https://www.w3.org/TR/webaudio/) は、ブラウザで OscillatorNode、GainNode、StereoPannerNode、AnalyserNode、DynamicsCompressorNode などを使って音を生成・処理する標準仕様である。

開発上の示唆:

- CHROMALUM の実装は Web Audio の標準部品で構成できるため、音響エンジン自体は特殊な技術ではない。
- 実装上の品質は、クリックノイズ回避、ゲインランプ、リミッター、ミュート初期値、CPU 使用量、同時発音数制御で決まる。
- `deltaAlpha` によるゲイン制御は、実際に位相の異なる音波を合成してキャンセルしているわけではなく、視覚モデルに由来する象徴的な gain mapping として明記する。

## Development Recommendations

### 1. Keep `hue -> pitch`, but frame it correctly

現在の `theta + activeAlpha -> frequency` は、視覚上の回転と音高表示が同期する点で CHROMALUM らしい。ただし、これは色相と音高の普遍的な心理対応ではない。ドキュメントと UI では「structural mapping」「musical mapping」「sonification layer」として扱う。

### 2. Use an algebraic `Bit Spectrum` timbre mode

See ColOr や Colorophone 系を踏まえると、色相を音色や楽器カテゴリへ割り当てるモードは有力である。ただし、CHROMALUM では単純な `hue -> timbre` より、Theory タブと同じ `GF(2)^3` ビット基底を音色成分へ写す `Bit Spectrum` の方が整合的である。

基本形は次の通りである。

```text
lv = 4G + 2R + B
T(lv) = B * tau_B + R * tau_R + G * tau_G
```

これにより、Gray cycle は音色成分が 1 つだけ変わる巡回、Hamming distance は変化する音色成分数、White は全成分、Black は成分なしとして聴ける。通常の音響加算は XOR ではないため、XOR を示す場合はコード側で `a xor b` を計算し、その結果の `T(a xor b)` を鳴らす。

CHROMALUM では 6 有彩レベルと補色ペアがあるため、追加の写像候補は次のように整理できる。

| color structure | possible sound parameter |
| --- | --- |
| hue angle | pitch or timbre |
| luma radius | gain or filter brightness |
| complement pair | FM pair, call-and-response, stereo split |
| Hamming distance | interval size or modulation depth |
| Fano line membership | chord or arpeggio group |
| alpha0/alpha7 phase | phase-gain, delay, tremolo phase |

### 3. Distinguish symbolic phase from acoustic phase

`abs(cos(deltaAlpha / 2))` は、視覚モデルの位相差を音量へ写す設計として分かりやすい。一方で、Web Audio 上で本当に同周波数・逆位相の波形を合成しているわけではない。実装説明では、これは `phase-derived gain` または `symbolic interference gain` と呼ぶのがよい。

### 4. Revisit scale modes

12TET の 2 オクターブ写像は連続的で分かりやすいが、hue circle の円環性とは完全には一致しない。開発候補は次の通り。

1. 現行の 2 octave continuous mode を維持する。
2. pitch class を中心にした 1 octave cyclic mode を追加する。
3. Shepard/Risset 的な循環音高表現を将来候補にする。
4. JI mode の比率は、CHROMALUM の代数的理由があるなら文書化し、一般的な音楽性を優先するなら標準的な just intervals も候補にする。

### 5. Keep mappings sparse

一度に多くの代数構造を鳴らすと、情報量が増えて聴取しにくくなる。デフォルトは少数のパラメータに絞る。

推奨プリセット:

| preset | main purpose |
| --- | --- |
| Pure Pitch | hue rotation and scale snapping |
| Luma Gain | luma radius and complement symmetry |
| Complement FM | complement-pair interaction |
| Fano Chords | line/chord membership |
| Quiet Accessibility | low fatigue, limited range, soft timbre |

### 6. Maintain audio safety

Music タブは長時間鳴らせるため、次を標準にする。

1. 初期状態は muted または低音量。
2. ゲイン変更は ramp で行い、クリックを避ける。
3. DynamicsCompressorNode または limiter を維持する。
4. 高周波・高音量・急激な FM を制限する。
5. ユーザーが一発で停止できる control を常に表示する。

## What to Put in `music-linked-visualization.md`

メインの `music-linked-visualization.md` には、詳細な文献レビューをそのまま入れない方がよい。入れるべきなのは、次の短い境界線である。

1. BT.601 luma、RGB/HSV 型 hue、三角関数射影、位相干渉、12TET は標準的要素である。
2. 色ソニフィケーションには See ColOr、Colorophone、Colormatrics などの先行例がある。
3. `hue -> pitch` は心理物理的な普遍対応ではなく、CHROMALUM 内部の構造的・作曲的写像である。
4. CHROMALUM の固有性は、離散代数的色彩モデルと Music タブの音響写像を統合している点にある。

詳細な先行研究、開発メモ、候補機能は本ノートに残す。

## References

- ITU-R. [Recommendation BT.601-7: Studio encoding parameters of digital television](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.601-7-201103-I!!PDF-E.pdf).
- Alvy Ray Smith. [Color Gamut Transform Pairs](https://alvyray.com/Papers/CG/color78.pdf). SIGGRAPH, 1978.
- W3C. [WCAG 2.2 Relative Luminance](https://www.w3.org/TR/WCAG22/relative-luminance.html).
- Krita Documentation. [HSX blending modes](https://docs.krita.org/en/reference_manual/blending_modes/hsx.html).
- Guido Bologna, Benoit Deville, Thierry Pun. [Sonification of Color and Depth in a Mobility Aid for Blind People](https://icad.org/Proceedings/2010/BolognaDevillePun2010.pdf). ICAD, 2010.
- Frontiers in ICT. [Mobile Video-to-Audio Transducer and Motion Detection for Sensory Substitution](https://www.frontiersin.org/articles/10.3389/fict.2015.00020/full). 2015.
- MDPI Sensors. [Colorophone 2.0: A Wearable Color Sonification Device Generating Live Stereo-Soundscapes](https://www.mdpi.com/1424-8220/21/21/7351). 2021.
- NIME. [Sonifyd:Colormatrics](https://nime.pubpub.org/pub/efyd2zra/release/1). 2022.
- Thomas Hermann, Andy Hunt, John G. Neuhoff, editors. [The Sonification Handbook](https://sonification.de/handbook/downloads/). 2011.
- PLOS ONE. [A Systematic Review of Mapping Strategies for the Sonification of Physical Quantities](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0082491). 2013.
- Scientific Reports. [Musical pitch classes have rainbow hues in pitch class-color synesthesia](https://www.nature.com/articles/s41598-017-18150-y). 2017.
- Charles Spence, Nicola Di Stefano. [Coloured hearing, colour music, colour organs, and the search for perceptually meaningful correspondences between colour and sound](https://journals.sagepub.com/doi/10.1177/20416695221092802). 2022.
- Frontiers in Psychology. [One- or two-step? New insights into two-step hypothesis and rainbow-like theory for pitch class-color synesthesia](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1482714/full). 2025.
- W3C. [Web Audio API](https://www.w3.org/TR/webaudio/).
