# Music-Linked Visualization — 先行研究と設計ノート

作成日: 2026-04-28
整理方針: 2026-04-29

## Purpose

このノートは、CHROMALUM の `LinkedVisualization` と Music タブにとって、研究・開発上の判断に直接効く先行研究だけを残す。網羅的な色音対応史や感覚代行システム一覧ではなく、次のどちらかに該当するものを保持する。

1. `hue -> pitch`、`luma/brightness -> gain`、`hue -> timbre` などが既知であることを示す文献。
2. Music タブの設計、聴取負荷、安全性、Web Audio 実装に直接効く文献。

## Executive Summary

Music タブの次の個別要素は既知であり、新規性として主張しない。

- 色相・彩度・明度などを音高、音色、音量、定位へ写す色ソニフィケーション。
- `hue -> pitch` と `brightness/luma -> amplitude` の組み合わせ。
- 音響パラメータ mapping の一般原則。
- ブラウザで Web Audio API を使って oscillator / gain / panner / analyser を構成すること。
- 色相と音高に普遍的な心理物理対応がある、という主張の危うさ。

CHROMALUM 側で主張しやすいのは、これらの既知要素そのものではない。主張できるのは、BT.601 luma 順の 8 頂点 RGB アトラス、L0/L7 補色半径、`alpha0` / `alpha7` 位相、GRB bit order、Fano/Hamming/K8/polyhedra などの代数的色彩構造と、音響写像を同じ操作体系で結合している点である。

## Essential Prior Art

| Keep | Source | Why it matters |
| --- | --- | --- |
| 必須 | See ColOr | 色ソニフィケーションの代表例。特に hue を直接 pitch ではなく timbre/instrument family へ写す設計が、Music タブの `Bit Spectrum` 方針に効く。 |
| 必須 | Colorophone 2.0 | 実装、ユーザビリティ、聴取負荷、ステレオ音景、音量安全の実践的参考。 |
| 必須 | Sonifyd:Colormatrics | `hue -> musical pitch`、`brightness -> amplitude` が CHROMALUM に近い直接比較対象。 |
| 必須 | The Sonification Handbook | パラメータ mapping、聴取可能性、評価設計の基礎。 |
| 重要 | Systematic Review of Mapping Strategies | pitch/loudness/timbre/tempo/pan などの mapping を設計判断として整理する根拠。 |
| 重要 | Spence & Di Stefano review | 色音対応や color organ 史を批判的に整理し、普遍的 hue-pitch 対応を強く主張しないための境界線になる。 |
| 必須 | Web Audio API | Music タブの実装基盤。音響エンジン自体は標準技術であることを示す。 |

## Direct Prior Art

### See ColOr

[See ColOr](https://icad.org/Proceedings/2010/BolognaDevillePun2010.pdf) は、HSL 色空間を使った色ソニフィケーションの代表例である。色相を楽器音色、彩度を音高、明度を声やベース系の音へ割り当てる。

開発上の要点:

- 色相を pitch だけに固定しない。
- hue -> timbre / instrument family の方が学習しやすい場合がある。
- CHROMALUM では、単純な hue -> timbre よりも `GF(2)^3` の bit basis を音色成分へ写す `Bit Spectrum` の方がモデルに合う。

### Colorophone 2.0

[Colorophone 2.0](https://www.mdpi.com/1424-8220/21/21/7351) は、色をリアルタイムにステレオ音景へ変換するウェアラブル装置である。色ソニフィケーションを、実装・装置・ユーザビリティまで含めて扱っている。

開発上の要点:

- Music タブは数式デモだけでなく、音量安全、ミュート、停止操作、低疲労プリセットを持つべきである。
- 情報量を詰め込みすぎると聴取できない。代数構造はモードごとに分けて鳴らす。
- stereo pan を使う場合は、視覚位置と音像位置の一貫性を保つ。

### Sonifyd:Colormatrics

[Sonifyd:Colormatrics](https://nime.pubpub.org/pub/efyd2zra) は、Woohun Joo による NIME 2022 installation であり、画像やピクセルの色を音へ写す NIME 系の実践である。hue を musical pitch、saturation を detune、brightness を amplitude に対応させる。

開発上の要点:

- `hue -> pitch` と `brightness -> amplitude` は既存例があるため、CHROMALUM の新規性にはしない。
- CHROMALUM では、どの色集合を鳴らすか、どの対称性を操作できるかを差別化点にする。
- saturation の代わりに、補色ペア、位相差、Hamming distance、Fano line membership を音響パラメータへ写す。

## Design References

### The Sonification Handbook

[The Sonification Handbook](https://sonification.de/handbook/downloads/) は、聴覚表示、パラメータ mapping、聴取可能性、評価設計の基礎資料である。

開発上の要点:

- 数式対応より、ユーザーが識別できる音の差を優先する。
- 音量、周波数範囲、同時発音数、聴取疲労を最初から設計に入れる。
- デモ用途と分析用途では、同じ mapping でも音の密度を変える。

### Systematic Review of Mapping Strategies

[A Systematic Review of Mapping Strategies for the Sonification of Physical Quantities](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0082491) は、物理量を音響パラメータへ写す mapping 戦略を広く整理する。

開発上の要点:

- pitch はよく使われるが、万能ではない。
- 複数の値を pitch, loudness, timbre, tempo, pan へ同時に割り当てると認知負荷が上がる。
- CHROMALUM では、`luma mode`、`complement mode`、`Fano line mode`、`Hamming mode` のように目的別に分ける。

### Spence & Di Stefano Review

[Coloured hearing, colour music, colour organs, and the search for perceptually meaningful correspondences between colour and sound](https://doi.org/10.1177/20416695221092802) は、Spence と Di Stefano による i-Perception 2022 年論文であり、色聴、カラーオルガン、色と音の対応史を批判的に整理している。

開発上の要点:

- `hue -> pitch` を心理物理的な普遍対応として主張しない。
- CHROMALUM では「色を音で正しく再現する」ではなく、「離散代数的な色彩構造を音でも操作・比較できる」と表現する。
- 12TET、JI、diatonic などは、知覚的真理ではなく作曲的・構造的 mapping として扱う。

## Implementation Reference

### Web Audio API

[Web Audio API](https://www.w3.org/TR/webaudio/) は、ブラウザで OscillatorNode、GainNode、StereoPannerNode、AnalyserNode、DynamicsCompressorNode などを使って音を生成・処理する標準仕様である。

開発上の要点:

- 音響エンジン自体は特殊な技術ではない。
- 品質は、クリックノイズ回避、gain ramp、limiter/compressor、mute 初期値、停止操作、同時発音数制御で決まる。
- `deltaAlpha` の `abs(cos(deltaAlpha / 2))` は実際の音波干渉ではなく、視覚モデルに由来する symbolic / phase-derived gain として説明する。

## Development Positioning

Music タブの中心主張は、色音対応の発見ではなく、Theory タブの離散代数構造を音響操作へ接続したことである。

実装・説明では次を守る。

1. `hue -> pitch` は structural / compositional mapping と呼ぶ。
2. `luma -> radius/gain` は BT.601 signal luma に基づく写像であり、知覚明度ではない。
3. `Bit Spectrum` は `GF(2)^3` の bit basis を音色成分へ写すモードとして扱う。
4. Fano、Hamming、K8、tetra、octahedron は、pitch ではなく structure-specific sonification で分けて鳴らす。
5. 初期状態、音量、停止操作、長時間聴取の安全性を UI 設計に含める。

## References

- Guido Bologna, Benoit Deville, Thierry Pun. [Sonification of Color and Depth in a Mobility Aid for Blind People](https://icad.org/Proceedings/2010/BolognaDevillePun2010.pdf). ICAD, 2010.
- MDPI Sensors. [Colorophone 2.0: A Wearable Color Sonification Device Generating Live Stereo-Soundscapes](https://www.mdpi.com/1424-8220/21/21/7351). 2021.
- Woohun Joo. [Sonifyd:Colormatrics](https://nime.pubpub.org/pub/efyd2zra). NIME 2022 Installations, 2022.
- Thomas Hermann, Andy Hunt, John G. Neuhoff, editors. [The Sonification Handbook](https://sonification.de/handbook/downloads/). 2011.
- PLOS ONE. [A Systematic Review of Mapping Strategies for the Sonification of Physical Quantities](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0082491). 2013.
- Charles Spence, Nicola Di Stefano. [Coloured hearing, colour music, colour organs, and the search for perceptually meaningful correspondences between colour and sound](https://doi.org/10.1177/20416695221092802). i-Perception 13(3), 2022.
- W3C. [Web Audio API](https://www.w3.org/TR/webaudio/).
