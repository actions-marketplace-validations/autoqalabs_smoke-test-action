# AutoQALabs Smoke Test Action

Catch broken deploys before your users do. This action opens your deployed site in a real Chromium browser, checks each page you list, and posts a pass/fail table to the job summary.

A page fails if it:

- returns an HTTP error (4xx or 5xx) or does not load in time,
- throws an uncaught JavaScript exception or logs a console error (optional),
- is missing text you expect to see (optional).

Failed pages get a full-page screenshot saved to `smoke-results/`.

## Usage

```yaml
name: Smoke test

on:
  deployment_status:

jobs:
  smoke:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: autoqalabs/smoke-test-action@v1
        with:
          url: ${{ github.event.deployment_status.environment_url }}
          paths: |
            /
            /pricing
            /login
          expect-text: Sign in
```

To keep screenshots of failed pages, add an upload step after it:

```yaml
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: smoke-results
          path: smoke-results/
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `url` | required | Base URL of the deployment to test. |
| `paths` | `/` | Paths to check, one per line or comma separated. |
| `expect-text` | | Text that must appear on every checked page. |
| `fail-on-console-errors` | `true` | Fail a page on console errors or uncaught exceptions. |
| `timeout` | `30000` | Per-page timeout in milliseconds. |
| `screenshots` | `true` | Save screenshots of failed pages to `smoke-results/`. |

## Outputs

| Output | Description |
| --- | --- |
| `passed` | Number of pages that passed. |
| `failed` | Number of pages that failed. |

## Running locally

```bash
npm install
npx playwright install chromium
SMOKE_URL=https://example.com SMOKE_PATHS="/" npm run smoke
```

## Need more than a smoke test?

This action covers the basics. [AutoQALabs](https://autoqalabs.com) adds AI-powered regression testing built into your CI/CD.

## License

[MIT](LICENSE)
