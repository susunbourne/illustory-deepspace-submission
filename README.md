# Illustory Studio on DeepSpace

An authenticated, workspace-scoped production control plane for one short-video workflow: script → editable storyboard → character and scene references → first frame → H3 motion → optional SeedVR2 enhancement → selected versions and trims → FFmpeg export.

**Current status:** the reviewable app and offline tests are present. This checkout has **not** been registered, run with the intended DeepSpace account, deployed, or connected to a paid private engine. No generated video is claimed as a verified result. The GPU workflow engine is a separate private service that is **not included** in this review repository.

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
npx deepspace app init         # register this app and mint its immutable ID
npx deepspace dev start
```

`app init` registers the app under the logged-in account and writes its immutable ID to `wrangler.toml`; check `auth whoami` first. It does not select the app's permanent source. `dev start` runs the local Vite and Worker stack after registration. `vite build` needs the server-minted ID; do not replace `__APP_ID__` by hand. Local tests use an unmistakable test-only sentinel without registering an app.

To connect the private engine, configure `PRIVATE_WORKFLOW_URL` and `PRIVATE_WORKFLOW_TOKEN` in the [DeepSpace encrypted secrets store](https://docs.deep.space/guides/secrets). For optional export mail, configure `EMAIL_FROM` to a sender address accepted by the Catalog email provider. The private URL must use HTTPS outside localhost. Never add the token to `VITE_` variables, source control, logs, or a browser request. The separate private adapter runs from the owner's environment and imports the existing Illustory engine without copying it here. Its source and data directory are intentionally outside this repository.

## Representative flow

1. Sign in and create a workspace. The first user is its owner. Add collaborators by their DeepSpace user ID and grant owner/editor/reviewer/viewer.
2. Create a project with a script. `projects` records retain the script, storyboard, revision and selected asset IDs.
3. The owner requests parsing. `requestJob` pins the revision and snapshot, records an idempotency key, and enqueues a DeepSpace background job. A Catalog OpenAI call returns structured characters/scenes/shots; the Worker validates them and publishes only if the project revision is still current. The title/synopsis can also trigger an optional YouTube reference search; links can be attached to shots as research metadata.
4. Editors adjust the storyboard. A save increments the revision. Owners generate character and scene reference images through the Catalog. The Worker copies their bytes to the protected private media store and publishes versioned metadata. Owners may choose an ElevenLabs voice ID and generate a speech asset for a character. The selected audio is part of the later H3 input snapshot.
5. The owner asks the private engine for a first frame conditioned on the selected references, then H3 and optionally SeedVR2. The private service retains large binaries. Before publishing a version, the Worker verifies the private file exists and matches SHA-256 and byte size. Reviewers or owners can select a version.
6. Editors set trims. An owner or reviewer requests export; the private service uses selected clips and FFmpeg. The browser reads assets through a workspace-authorized proxy with range support for video. If the owner enables export mail, the Catalog Email endpoint sends a completion note to the active workspace owner's account email. A mail failure is recorded without changing export success.

The Studio refreshes authorized job and asset state every three seconds. Browser WebSocket routes are closed because the scaffold's rooms do not provide workspace-level authorization; JobRoom remains a DeepSpace background primitive. A server action filters reads by current workspace membership. Collection-level direct client reads/writes are denied for product data.

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

`npm run type-check`, `npm run lint`, and `npm run test:unit` pass locally (23 TypeScript tests). The private adapter's `python -m pytest -q -p no:cacheprovider test_contract.py` passes (8 tests using the original app's `.venv`). These are offline checks, including Catalog call boundaries, role decisions, media authorization, original H3 input mapping and result-publication rules. `npm run build` currently stops at the scaffold's `__APP_ID__` placeholder; the official CLI must mint an ID after the intended owner signs in. The real DeepSpace runtime, persistence after refresh, OAuth sign-in, media playback, and a paid one-shot generation/export remain unverified. The owner has postponed login and has not approved paid calls.

## Tradeoffs and limits

- The original Azure development environment and private rendering stack remain in use behind the adapter. This app is not a full replacement for the original deployment.
- Large media stays in the private service. App-scoped public file storage would expose customer material; user-scoped files do not model shared workspace permissions. Metadata lives in DeepSpace.
- One RecordRoom stores workflow metadata and server actions enforce workspace membership. The read-check-write edit path is not a database compare-and-swap transaction; simultaneous edits to the same project need a serialized project operation before a multi-editor production launch.
- The private bridge is a small single-worker service with persistent SQLite. Interrupted GPU calls are marked failed and require reconciliation. Provider-side cancellation and automatic recovery from ambiguous remote outcomes require more work.
- Catalog calls have no provider idempotency key. JobRoom uses one automatic attempt and persists intent before billing. A crash between the provider response and result checkpoint needs operator reconciliation; it cannot safely auto-retry. Catalog media results are capped at 20 MB by this one-shot adapter.
- Member invites currently use known DeepSpace user IDs. Email invite discovery is outside the one-shot exercise scope.
- No claim is made that a live end-to-end render has succeeded until a paid run and online verification are recorded.

See [implementation notes](docs/IMPLEMENTATION.md) and [local handoff](docs/LOCAL_HANDOFF.md) for the exact evidence, gaps, and review writeup draft.
