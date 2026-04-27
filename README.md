# CHROMALUM

CHROMALUM is a React/Vite pixel-art and color-theory application built around
an 8-level BT.601 luma model. It includes drawing, color mapping, glaze
variants, gallery/statistics views, and Theory/Music tabs that explore the same
8-color system through `GF(2)^3`, RGB cube geometry, Fano planes, Hamming codes,
and related polyhedral structures.

## Development

This project uses Node.js and npm. The repository declares the expected
toolchain through Volta:

```text
node 24.14.1
npm 11.9.0
```

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Create an itch.io-style relative-path build:

```bash
npm run build:itch
```

Run tests:

```bash
npm test
```

Run end-to-end tests:

```bash
npm run test:e2e
```

Run linting:

```bash
npm run lint
```

Check formatting:

```bash
npm run format:check
```

## Documentation

The three documents in `docs/` form the *Tractatus Chromaticus*
("Chromatic Treatise"), a unified treatise on the discrete algebraic
color model that underlies the application:

- Pars I — [離散代数的色彩モデル 技術ノート](./docs/algebraic-color-model.md)
- Pars II — [離散代数的色彩モデル 先行研究調査ノート](./docs/prior-art-algebraic-color-model.md)
- Pars III — [Theoryタブ 先行研究調査と改善提案](./docs/theory-tab-prior-art-and-improvements.md)

The corpus is attributed to the pseudonym **Doctor Chromaticus**.

## License

- **Application source code, tests, build config, and non-scholarly app assets**:
  [MIT License](./LICENSE)
- **Scholarly/explanatory content**:
  [Creative Commons Attribution 4.0 International (CC BY 4.0)](./docs/LICENSE.md)

The CC BY 4.0 content includes the *Tractatus Chromaticus* documents in
`docs/` and the authored prose, labels, and rendered explanatory diagrams in
the Theory tab. The code that implements those views remains MIT-licensed.

When reusing material from the CC BY 4.0 content, see the
[citation templates](./docs/LICENSE.md#how-to-cite) for academic, blog, book,
slide, translation, and short-form attribution formats.
