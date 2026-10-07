# Running Illustory

## Offline checks

Use the Node/npm versions declared in [package.json](../package.json).

```sh
npm ci
npm run validate
npm run lint
npm run format:check
npm run build
```

Unit tests use synthetic data and substituted provider responses. They do not
spend model/GPU credits. `npm run format` applies the repository formatter.

Use npm with the committed `package-lock.json`. Prettier reads its options from
`package.json` and exclusions from `.prettierignore`. `npm run test:unit` and
`npm run test:watch` explicitly load `tests/vitest.config.ts`; running bare
`vitest` would instead load the app's Vite configuration. The build helper lives
in `tooling/prerender.ts`, imported by the root `vite.config.ts`.

## Start the app

```sh
npx deepspace auth whoami --json
npx deepspace auth login   # if signed out; complete browser authorization
npm run dev
```

Open the URL printed by the CLI. This checkout belongs to the deployed app
identified in `wrangler.toml`; it is not a ready-to-deploy independent fork.
For a separate app, start with `npx deepspace`, follow the official app identity
workflow, and port the application files. Do not deploy this checkout under a
different account or overwrite its registered ID to get around an auth error.

## Server configuration

Use DeepSpace's encrypted secrets store. Supply values interactively or over
standard input; do not put keys in source, shell arguments or `VITE_` variables.
Secret changes require redeployment; restart local development to reload them.

| Setting                                        | Purpose                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                               | Direct structured parsing; never sent to the browser                         |
| `PRIVATE_WORKFLOW_URL`                         | HTTPS endpoint for the private adapter                                       |
| `PRIVATE_WORKFLOW_TOKEN`                       | Server-to-server adapter credential                                          |
| `PRIVATE_WORKFLOW_EXECUTION_ENABLED=1`         | Enable private first-frame and export jobs                                   |
| `PRIVATE_WORKFLOW_GPU_ENABLED=1`               | Enable Vast operations after checking the GPU worker                         |
| `BILLING_ALLOWED_USER_IDS`                     | Optional comma-separated exact user IDs approved for sponsored work          |
| `SPENDING_PAUSED=1`                            | Block new sponsored calls, including the owner's calls                       |
| `EMAIL_FROM`                                   | Sender accepted by the Catalog email provider                                |
| `REVIEW_ACCESS_EMAIL`                          | Fixed recipient used in review-access email drafts; never set by the browser |
| `OPENAI_CHARACTER_MODEL`, `OPENAI_SCENE_MODEL` | Optional structured-parser model overrides                                   |

The parser defaults in `src/jobs.ts` are `gpt-5.5` and `gpt-5.6`, with maximum
output tokens of 5,000 and 50,000. These are output ceilings, not cost estimates.
The app accepts scripts up to 20,000 characters. Do not enable paid testing
without a budget and a reachable private engine.

The private engine is not distributed here. Its [API contract](GPU_EXECUTION.md)
is the integration boundary; the public app does not substitute canned videos
when it is unavailable. The current Vast instance has H3 but not SeedVR2.

## Browser tests

After setting up local DeepSpace test accounts:

```sh
npx deepspace test run smoke --port 5174
npx deepspace test run tests/roles.spec.ts --port 5174
```

Use `npx deepspace test accounts --help` for account setup. Account credentials
are local test configuration, not repository content. These suites are distinct
from testing real paid providers. See [verification](VERIFICATION.md).

## Deployment

This app has **GitHub source**, fixed at first deployment. Commit and push the
reviewed changes with Git, then run:

```sh
npx deepspace deploy
```

Do not use `deepspace push` for this repository. GitHub-source deployment ships
the local working tree, so check `git status` first. After deployment, check
login, persistence and authorized media playback. Do not trigger paid jobs as
an automatic smoke test.

## Private service operations

The current pilot uses a single Azure adapter worker, a PostgreSQL job ledger,
private Blob storage and a separately rented Vast GPU. Azure scales from zero
to one replica; DeepSpace polls active jobs. A cold start can take over 30 seconds,
so the private client allows 60 seconds per request.

Interrupted GPU work may require manual reconciliation. Do not blindly retry an
ambiguous result. If a private result exists but publication failed, use **Resume
saved media** or **Recover existing export** to recheck the same private job.
This does not submit another render. [Example incident](EXPORT_RECOVERY.md).

A workspace role does not grant spending permission. See [spending controls](SPENDING_ACCESS.md)
for approval, revocation and the limits of the current budget protection.
