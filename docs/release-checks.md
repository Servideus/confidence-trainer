# Beta 0.1.0 verification — 2026-10-03

Local Windows checks, Node 24, clean installation from package-lock.json:

- npm ci: succeeds; npm audit reports zero known vulnerabilities at check time.
- npm run test: 17 tests in four files pass.
- npm run lint: passes.
- npm run validate:bank: 2,067 records pass structural validation.
- npm run e2e: five Chromium tests pass against a newly built production preview.
- Forecast date remains due after page reload; Yes resolution succeeds.
- Offline test waits for an active service worker, disables network, reloads and submits an answer.
- RU/EN language choice persists after reload.
- All 1,764 threshold answers agree with bundled values/thresholds; three records source-checked in bank-review.md.

Publication scan: no matches for tested Google/GitHub/Telegram token formats, private-key headers or personal Windows paths in staged text files. This is a bounded pattern scan, not a guarantee against every secret format. Environment files, generator cache, dependencies, build and browser test outputs are ignored.

Limits: Chromium desktop was tested; mobile installation and other engines were not. The build emits a large-chunk warning due to the bundled bank. No hosted live website is configured. These checks verify application behavior, not full bank accuracy or educational effectiveness.
