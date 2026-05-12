# Contributing

CHROMALUM is a browser-only React/Vite application. Contributions should keep
the app usable as a static site with no backend service.

## Setup

The expected toolchain is pinned through Volta:

```text
node 24.14.1
npm 11.9.0
```

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

## Local Checks

For most changes, run the standard local verification set:

```bash
npm run verify
```

This runs formatting, linting, dead-code detection, full type checking, the
production build, and the unit test suite. For focused work, the individual
checks are:

```bash
npm run format:check
npm run lint
npm run deadcode
npm run typecheck:all
npm run build
npm test
```

For browser, PWA, or layout-sensitive changes, also run the relevant Playwright
checks:

```bash
npm run test:e2e
npm run test:pwa
npm run test:visual
```

Visual regression is a local/manual gate. Update visual baselines with
`npm run test:visual:update` only after intentionally accepting the rendered UI
change.

## Documentation

Update documentation when a change affects public behavior, setup commands,
architecture, user workflow, security posture, deployment, or the research
claim boundary.

Useful entry points:

- [README.md](./README.md) for project overview, commands, docs map, security,
  and licensing.
- [docs/user-guide.md](./docs/user-guide.md) for first-time app usage.
- [docs/architecture.md](./docs/architecture.md) for runtime and state model
  details.
- [docs/README.md](./docs/README.md) for the technical and research
  documentation map.

## Licensing Boundaries

Application source code, tests, build configuration, and non-scholarly app
assets are MIT-licensed. Scholarly and explanatory content is covered by the
CC BY 4.0 notice in [docs/LICENSE.md](./docs/LICENSE.md).

When changing Theory-tab prose, rendered explanatory diagrams, research notes,
or citation templates, check whether [docs/LICENSE.md](./docs/LICENSE.md) also
needs an update.

## UI Copy

The app has English and Japanese UI text. When changing user-facing copy, update
both `src/i18n/en.ts` and `src/i18n/ja.ts` unless the change is intentionally
language-specific.

Theory copy should keep the established claim boundaries: use BT.601 `luma` /
`ルマ` wording for this signal model, avoid implying perceptual uniformity, and
describe XOR as an algebraic operation rather than physical color mixing.

## Security

Do not report vulnerabilities in public issues or pull requests. Follow
[SECURITY.md](./SECURITY.md) for private reporting scope and process.
