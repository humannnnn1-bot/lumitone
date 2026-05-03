# Security Policy

## Supported Versions

CHROMALUM is currently maintained from the `main` branch and deployed as a
static browser application through GitHub Pages.

Security fixes target the latest source on `main` and the latest public
deployment. Versioned release branches are not maintained while the project is
pre-release.

## Reporting a Vulnerability

Please do not report security vulnerabilities in public issues or pull
requests.

Use GitHub's private vulnerability reporting flow if it is available for this
repository:

<https://github.com/humannnnn1-bot/chromalum/security/advisories/new>

Include:

- A clear description of the issue and impact.
- Reproduction steps or a minimal proof of concept.
- The affected browser, dependency, workflow, or deployed page.
- Any relevant logs, screenshots, or dependency versions.

If private vulnerability reporting is unavailable, contact the repository
owner through GitHub and avoid publishing exploit details in public channels.

## Scope

Relevant security reports include, but are not limited to:

- Cross-site scripting or unsafe rendering of imported content.
- Data loss or unintended persistence behavior involving browser storage.
- Dependency or build-chain vulnerabilities that affect the shipped app.
- GitHub Actions or deployment configuration issues.

CHROMALUM does not currently run a backend service, collect credentials, or
store user data on a project server. Most user-created artwork and settings
remain local to the browser unless the user exports or shares them.

## Response

Security reports are handled on a best-effort basis. Valid issues will be
triaged, fixed on `main`, and deployed when appropriate. If a public advisory or
release note is useful for downstream users, it will be published after a fix is
available.
