# Illustory Studio on DeepSpace

An authenticated, workspace-scoped production control plane for one short-video workflow: script → editable storyboard → character and scene references → first frame → H3 motion → optional SeedVR2 enhancement → selected versions and trims → FFmpeg export.

**Current status:** the [DeepSpace app](https://illustory.app.space) is live, with this [GitHub repository](https://github.com/susunbourne/illustory-deepspace-submission) as its source. DeepSpace confirmed the release is serving; the homepage and signed-out Studio respond correctly. The owner personally signed in online, created a harmless workspace/project, and confirmed both persisted after refresh. Local authenticated browser tests exercised editable storyboard records and all four workspace roles. The separate private adapter is deployed on Azure and its authenticated HTTPS, PostgreSQL job ledger, private Blob storage, and local DeepSpace Worker connection have passed no-model smoke checks. Its GPU worker remains disabled. Online storyboard generation and a real paid render remain unverified; no generated video is claimed as a verified result. The GPU workflow engine is a separate private service that is **not included** in this review repository.

The Studio keeps project editing in the main column. Project jobs and asset counts open from **Activity**; owner-only membership controls open from **Workspace settings** beside the workspace selector. These panels stay off the bottom of laptop-width pages.

Private video jobs expose an **Execution details** panel in Activity. It shows persisted DeepSpace and private job IDs, pinned revision, adapter phase, real start-to-finish time when available, and the published asset's size and SHA-256. See [private GPU execution boundary](docs/GPU_EXECUTION.md) for the actual call chain and the evidence still needed from a paid render.

## Why this split

DeepSpace owns sign-in, the app Worker, persistent workspace/project/job/asset metadata through RecordRoom, a durable JobRoom, and four useful Catalog integrations. OpenAI parses the script and generates character/scene references. ElevenLabs supplies selectable voices and speech audio. YouTube provides three optional visual references from the title and synopsis. Email can notify the active workspace owner after a successful export, even when a reviewer requested it. The original private Illustory service performs reference-conditioned shot first frames, Vast/ComfyUI H3, optional SeedVR2, private binary storage, and FFmpeg. The browser never receives the private service token.

The [Catalog endpoints](https://docs.deep.space/guides/external-apis) used in code are `openai/chat-completion`, `openai/generate-image`, `elevenlabs/list-voices`, `elevenlabs/generate-speech`, `youtube/search-videos`, and `email/send`. Their current input/output contracts were checked using `npx deepspace integrations info ... --json`; paid responses still need live confirmation. Auth, RecordRoom, JobRoom and encrypted secrets are **SDK/platform primitives**, not Catalog integrations. The private Illustory engine is an **owner-operated external service**, not a DeepSpace integration. The Catalog's text-to-image endpoint cannot accept the existing character/scene images as reference inputs, so the original private image-edit path remains responsible for coherent shot first frames.

## Local setup

Node 22.15+ and npm 11.6+ are required. From this repository:

```sh
npm ci
npm run type-check
npm run test:unit
npm run lint
npx deepspace auth whoami --json
npx deepspace auth login       # only if signed out; complete in your browser
npx deepspace dev start
npx deepspace test run smoke --port 5174
npx deepspace test run tests/roles.spec.ts --port 5174
```

This checkout already has its server-minted immutable ID in `wrangler.toml`. For a fresh fork without an ID, run `npx deepspace app init` after login; it registers the app but does not deploy or select its permanent source. `dev start` runs the local Vite and Worker stack. The browser suites use local test accounts managed by `npx deepspace test accounts`; never put their passwords in this repository.

For a fresh installation, configure `PRIVATE_WORKFLOW_URL` and `PRIVATE_WORKFLOW_TOKEN` in the [DeepSpace encrypted secrets store](https://docs.deep.space/guides/secrets). This registered app already has those two secrets pointing to the owner's Azure adapter. For optional export mail, configure `EMAIL_FROM` to a sender address accepted by the Catalog email provider. The private URL must use HTTPS outside localhost. Never add the token to `VITE_` variables, source control, logs, or a browser request. The separate private adapter imports the existing Illustory engine without copying it here. Its source and data directory are intentionally outside this repository.

## Representative flow

1. Sign in and create a workspace. The first user is its owner. For collaborators, have them sign in to this app once and copy their DeepSpace user ID from **Settings**. As owner, open **Workspace settings** beside the workspace selector, paste that ID, and grant owner/editor/reviewer/viewer.
2. Create a project with a script. `projects` records retain the script, storyboard, revision and selected asset IDs.
3. The owner requests parsing. `requestJob` pins the revision and snapshot, records an idempotency key, and enqueues a DeepSpace background job. Two Catalog OpenAI calls reproduce Illustory's Character Bible → scene/shot parse order. The original parser and shot rules, full public schema (appearance, scene visual anchor, first-frame action, local environment, motion beats, emotions, dialogue), and character/scene image prompts are included here. The Worker validates JSON and publishes only while the project revision is current. The title/synopsis can also trigger an optional YouTube reference search; links can be attached to shots as research metadata.
4. Editors adjust the storyboard. A save increments the revision. Owners generate character and scene reference images through the Catalog. The Worker copies their bytes to the protected private media store and publishes versioned metadata. Owners may choose an ElevenLabs voice ID and generate a speech asset for a character. The selected audio is part of the later H3 input snapshot.
5. The owner asks the private engine for a first frame conditioned on the selected references, then H3 and optionally SeedVR2. The private service retains large binaries. Before publishing a version, the Worker verifies the private file exists and matches SHA-256 and byte size. Reviewers or owners can select a version.
6. Editors set trims. An owner or reviewer requests export; the private service uses selected clips and FFmpeg. The browser reads assets through a workspace-authorized proxy with range support for video. If the owner enables export mail, the Catalog Email endpoint sends a completion note to the active workspace owner's account email. A mail failure is recorded without changing export success.

The Studio refreshes authorized job and asset state every three seconds. Browser WebSocket routes are closed because the scaffold's rooms do not provide workspace-level authorization; JobRoom remains a DeepSpace background primitive. The authenticated workspace-discovery action seeds the SDK's `users` row from verified JWT claims because the normal WebSocket seeding path is closed. A server action filters reads by current workspace membership. Collection-level direct client reads/writes are denied for product data.

## Roles

| Operation | Owner | Editor | Reviewer | Viewer |
|---|---:|---:|---:|---:|
| View workspace, projects, jobs and assets | Yes | Yes | Yes | Yes |
| Create/edit project and storyboard | Yes | Yes | No | No |
| Submit billable AI/GPU generation | Yes | No | No | No |
| Request deterministic FFmpeg export | Yes | No | Yes | No |
| Select an asset version | Yes | No | Yes | No |
| Enable export email to the workspace owner | Yes | No | No | No |
| Manage membership / cancel jobs | Yes | No | No | No |

These checks live in `src/actions/index.ts` and `src/server/illustory-routes.ts`; hiding controls in React is only a UX aid.

## Private API contract

All endpoints require a server-side bearer token. `PUT /v1/catalog-assets/{jobId}` ingests one checksum-verified image/audio result by durable job ID. `POST /v1/jobs` requires `Idempotency-Key` and a fixed `inputRevision`, operation, target and snapshot. It returns a stable private job ID. `GET /v1/jobs/{id}` returns status, progress, and on success `{storageKey,mimeType,sha256,byteSize}`. `DELETE /v1/jobs/{id}` marks cancellation. `HEAD` and `GET /v1/assets/{key}` validate a private file and stream bytes. The same key and input must return the same job; a conflicting replay must fail. A restart with uncertain running GPU work is reconciled manually rather than retried automatically.

## Verification so far

`npm run type-check`, `npm run lint`, `npm run build`, and `npm run test:unit` pass locally (31 TypeScript tests). `npx deepspace test run smoke --port 5174` passed all six browser smoke tests, and `npx deepspace test run tests/roles.spec.ts --port 5174` passed the four-role browser flow. These tests exercised the real local DeepSpace runtime with SDK test accounts: project script and manually edited cast/scene/shot records survived refresh. The private adapter's `python -m pytest -q -p no:cacheprovider test_contract.py` passed 12 offline tests using the original app's `.venv`. Azure no-model checks covered auth, idempotent queued/cancelled jobs, PostgreSQL, Blob checksum and Range, and a local Worker-to-Azure HTTPS query. The first DeepSpace release was confirmed serving; the homepage and signed-out Studio returned 200 and showed the expected login gate. The owner personally signed in online and confirmed a new workspace/project persisted after refresh. Catalog responses, private media playback, and paid generation/export remain unverified. No paid model or GPU calls were approved or launched.

## Tradeoffs and limits

- The original Azure development environment and private rendering stack remain in use behind the adapter. This app is not a full replacement for the original deployment.
- Large media stays in the private service. App-scoped public file storage would expose customer material; user-scoped files do not model shared workspace permissions. Metadata lives in DeepSpace.
- One RecordRoom stores workflow metadata and server actions enforce workspace membership. The read-check-write edit path is not a database compare-and-swap transaction; simultaneous edits to the same project need a serialized project operation before a multi-editor production launch.
- The private bridge is a small single-worker service. Azure uses the existing PostgreSQL cluster for its idempotent job ledger and private Blob for media; local contract tests use SQLite. Interrupted GPU calls are marked failed and require reconciliation. Provider-side cancellation and automatic recovery from ambiguous remote outcomes require more work.
- Catalog calls have no provider idempotency key. JobRoom uses one automatic attempt and persists intent before billing. A crash between the provider response and result checkpoint needs operator reconciliation; it cannot safely auto-retry. Catalog media results are capped at 20 MB by this one-shot adapter.
- The original scene parser used OpenAI Responses structured parsing with up to 50,000 output tokens. DeepSpace Catalog `openai/chat-completion` caps `max_tokens` at 16,384 and exposes no schema parameter, so this adaptation requests JSON text and validates it locally. The original fields and rules are preserved, but long scripts can exceed that cap. A short representative project is the current acceptance scope. Paid parse quality has not yet been measured.
- Member invites currently use known DeepSpace user IDs. Email invite discovery is outside the one-shot exercise scope.
- No claim is made that a live end-to-end render has succeeded until a paid run and online verification are recorded.

See [implementation notes](docs/IMPLEMENTATION.md) and [local handoff](docs/LOCAL_HANDOFF.md) for the exact evidence, gaps, and review writeup draft.
