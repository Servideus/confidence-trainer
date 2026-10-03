# Confidence Trainer

An offline probability calibration trainer. Give binary statements probabilities, see outcomes and Brier errors, and track calibration. Record personal forecasts and resolve them after their chosen date.

**Public beta 0.1.0.** A learning tool with a generated bank, not a validated assessment of forecasting skill.

![Daily probability question](docs/screenshots/today.png)

![Answer and Brier error](docs/screenshots/result.png)

## Run locally

Node.js 22.12+ (Node 24 recommended) and npm. No API keys or server account required.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite. To use the offline production app:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open http://127.0.0.1:4173 online once and wait for the service worker to install. Subsequent visits to the same origin work offline. Development mode does not provide production offline behavior. Deployment requires HTTPS, a dedicated domain/root path and an SPA fallback to `index.html`; subdirectory hosting is not configured.

## Features and storage

- Daily sessions of 10 binary facts, immediate outcomes, probability input/slider.
- Brier error `(probability - outcome)²`: lower is better.
- Calibration bins, confidence histogram and domain breakdown.
- Personal forecasts with local date/time and later Yes/No resolution.
- RU/EN interface and questions; language choice persists.
- IndexedDB and an offline production PWA.

Answers and forecasts stay in this browser profile and origin. No cloud sync, accounts, analytics or export/backup. Clearing site data removes progress. The bank is bundled; it does not refresh online during use.

## Bank limitations

The 2026-02-22 snapshot has 2,067 bilingual records: 1,764 geography thresholds and 303 history comparisons. Thresholds reuse 146 entities, so records are not independent facts. There are no science questions despite interface support for that domain.

Anti-repeat operates on question IDs, not entities. Repeated thresholds may teach values and affect later scores. Population statements refer to their stated year. Some Wikidata statements lack references or have competing values. The whole bank has not been independently fact-checked. See [sample review](docs/bank-review.md).

## Verify

```sh
npm ci
npx playwright install chromium
npm run test
npm run lint
npm run validate:bank
npm run e2e
```

E2E builds the app and starts a production preview; port 4173 must be free. It checks fact answers, ten-task sessions, forecast creation/date persistence/resolution, RU/EN persistence and offline reload/answering. Screenshots and traces are ignored test artifacts.

`npm run gen:bank` regenerates the bank from Wikidata and may require network access. It is not part of installation or normal use. Cache files are excluded from Git. Review new answers and metadata before committing regenerated data.

## Stack and license

React, TypeScript, Vite, Dexie, vite-plugin-pwa, Vitest and Playwright. Application code: [MIT](LICENSE). Wikidata structured data: CC0; see [attribution](DATA-LICENSE.md). Dependencies retain their respective licenses.
