# Illustory Studio on DeepSpace

An authenticated, workspace-scoped production control plane for one short-video workflow: script → editable storyboard → character and scene references → first frame → H3 motion → optional SeedVR2 enhancement → selected versions and trims → FFmpeg export.

**Current status:** the [DeepSpace app](https://illustory.app.space) is live, with this [GitHub repository](https://github.com/susunbourne/illustory-deepspace-submission) as its source. The owner signed in online and confirmed a workspace/project persisted after refresh. Online OpenAI structured storyboard parsing and Catalog character/scene images have succeeded. The separate private adapter's authenticated HTTPS, PostgreSQL job ledger and private Blob storage passed no-model checks. Its first-frame worker is enabled; reference-conditioned image generation still awaits a live owner-triggered run. Vast GPU execution remains disabled, so H3 and SeedVR2 are blocked. No generated video or end-to-end render is claimed as verified. The GPU workflow engine is a separate private service that is **not included** in this review repository.

The Studio keeps project editing in the main column. Project jobs and asset counts open from **Activity**; owner-only membership controls open from **Workspace settings** beside the workspace selector. These panels stay off the bottom of laptop-width pages.

Private video jobs expose an **Execution details** panel in Activity. It shows persisted DeepSpace and private job IDs, pinned revision, adapter phase, real start-to-finish time when available, and the published asset's size and SHA-256. See [private GPU execution boundary](docs/GPU_EXECUTION.md) for the actual call chain and the evidence still needed from a paid render.

## Why this split

DeepSpace owns sign-in, the app Worker, persistent workspace/project/job/asset metadata through RecordRoom, a durable JobRoom, and useful Catalog integrations. OpenAI Responses parses the script with provider-enforced strict JSON Schema. The DeepSpace Catalog generates character/scene images; ElevenLabs supplies selectable voices and speech audio; YouTube provides optional visual references; Email can notify the workspace owner after export. The private Illustory service performs reference-conditioned shot first frames, Vast/ComfyUI H3, optional SeedVR2, private binary storage, and FFmpeg. The browser receives neither the OpenAI key nor the private service token.

The [Catalog endpoints](https://docs.deep.space/guides/external-apis) used in code are `openai/generate-image`, `elevenlabs/list-voices`, `elevenlabs/generate-speech`, `youtube/search-videos`, and `email/send`. Their contracts were checked with `npx deepspace integrations info ... --json`; paid responses still need live confirmation. Text parsing calls the official OpenAI Responses API directly from the server Worker because the current Catalog `openai/chat-completion` contract exposes no JSON Schema parameter. This requires an owner-managed encrypted `OPENAI_API_KEY` and is **not** a Catalog integration. Auth, RecordRoom, JobRoom and encrypted secrets are **SDK/platform primitives**. The private engine is an **owner-operated external service**. The Catalog image endpoint cannot accept existing reference images, so the private image-edit path remains responsible for coherent shot first frames.

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

For a fresh installation, configure `PRIVATE_WORKFLOW_URL`, `PRIVATE_WORKFLOW_TOKEN`, and `OPENAI_API_KEY` in the [DeepSpace encrypted secrets store](https://docs.deep.space/guides/secrets). This registered app has all three secret names bound in its production Worker; values are not in this repository. To set or rotate an OpenAI key, use `npx deepspace secrets set OPENAI_API_KEY --stdin` and redeploy. Do not put the key in chat, a shell argument, a `VITE_` variable, source control, logs, or a browser request. Character and scene parsing default to the original project's `gpt-5.5` and `gpt-5.6` with 5,000 and 50,000 maximum output tokens; optional server-only `OPENAI_CHARACTER_MODEL` and `OPENAI_SCENE_MODEL` settings may select other Structured Outputs models. These defaults can incur substantial model charges: approve a cap before any live test. For optional export mail, configure `EMAIL_FROM` to a sender address accepted by the Catalog email provider. The private URL must use HTTPS outside localhost. The adapter's engine source remains outside this repository.

Private first-frame and export jobs require `PRIVATE_WORKFLOW_EXECUTION_ENABLED=1` in the DeepSpace server environment. The Azure adapter now has its worker enabled and GPU disabled. H3 and SeedVR2 additionally require `PRIVATE_WORKFLOW_GPU_ENABLED=1` after Vast SSH and model dependencies are verified; that flag remains unset. The adapter uses `minReplicas=0` for this small pilot: a job POST wakes it and DeepSpace polls every 2.5 seconds while the job is active. The private client allows up to 60 seconds for a cold start; the first Azure health request after rollout took more than 30 seconds. Scaling to zero avoids an always-on replica, but an interrupted platform or polling cycle may leave a private job needing manual reconciliation. A production deployment should use a durable event-driven worker or an always-on replica with a cost budget.

## Representative flow

1. Sign in and create a workspace. The first user is its owner. For collaborators, have them sign in to this app once and copy their DeepSpace user ID from **Settings**. As owner, open **Workspace settings** beside the workspace selector, paste that ID, and grant owner/editor/reviewer/viewer.
2. Create a project with a script. `projects` records retain the script, storyboard, revision and selected asset IDs.
3. The owner requests parsing. `requestJob` pins the revision and snapshot, records an idempotency key, and enqueues a DeepSpace background job. Two server-side OpenAI Responses calls reproduce Illustory's Character Bible → scene/shot parse order with strict provider-enforced schemas. The original rules, full public schema (appearance, scene visual anchor, first-frame action, local environment, motion beats, emotions, dialogue), and character/scene image prompts are included here. The Worker validates the response again and publishes only while the project revision is current. The title/synopsis can also trigger an optional YouTube reference search.
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

`npm run validate` passes 38 TypeScript tests, and `npm run build` passes. Earlier local DeepSpace browser suites passed six smoke tests and a four-role flow with persisted edits. The private adapter's `test_contract.py` passes 14 offline tests with the original source configured; Azure no-model checks cover auth, job idempotency, PostgreSQL, Blob checksum and Range. In the live app, the owner completed structured storyboard parsing and published generated character and scene-anchor images through the authenticated private media route. Both are saved as version 1 and render in the Studio. The updated Azure adapter reports healthy, and unauthenticated private job access returns 401. Voice, first-frame generation, H3, enhancement and export have not been verified live. Vast SSH and GPU execution remain off, so the server explicitly blocks H3 and SeedVR2.

## Tradeoffs and limits

- The original Azure development environment and private rendering stack remain in use behind the adapter. This app is not a full replacement for the original deployment.
- Large media stays in the private service. App-scoped public file storage would expose customer material; user-scoped files do not model shared workspace permissions. Metadata lives in DeepSpace.
- One RecordRoom stores workflow metadata and server actions enforce workspace membership. The read-check-write edit path is not a database compare-and-swap transaction; simultaneous edits to the same project need a serialized project operation before a multi-editor production launch.
- The private bridge is a small single-worker service. Azure uses the existing PostgreSQL cluster for its idempotent job ledger and private Blob for media; local contract tests use SQLite. Interrupted GPU calls are marked failed and require reconciliation. Provider-side cancellation and automatic recovery from ambiguous remote outcomes require more work.
- Catalog calls have no provider idempotency key. JobRoom uses one automatic attempt and persists intent before billing. A crash between the provider response and result checkpoint needs operator reconciliation; it cannot safely auto-retry. Catalog media results are capped at 20 MB by this one-shot adapter.
- The first online parse exposed a migration error: Catalog chat returned an emotion outside the original enum and local validation rejected it. Text parsing now uses OpenAI Responses strict JSON Schema from the Worker, with `store: false` and a separate encrypted owner key. The public schema is in `src/illustory/structured-output.ts`; semantic checks such as beat timing and canonical character names remain in application code. The replacement passed offline tests and one live parse.
- Member invites currently use known DeepSpace user IDs. Email invite discovery is outside the one-shot exercise scope.
- No claim is made that a live end-to-end render has succeeded until a paid run and online verification are recorded.

See [implementation notes](docs/IMPLEMENTATION.md) and [local handoff](docs/LOCAL_HANDOFF.md) for the exact evidence, gaps, and review writeup draft.
