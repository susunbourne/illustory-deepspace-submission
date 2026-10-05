# Implementation and engineering review

## Customer deployment brief

**Assumption, not a known customer fact:** the first buyer is a 20–50 person short-video studio. Writers draft scripts; editors refine a shot list; a producer approves paid generation; reviewers select versions; delivery staff export a cut. A wrong result wastes GPU/API spend and editorial time; an unauthorized read exposes unreleased creative IP. The studio may already use Microsoft Entra and Azure Blob through the original Illustory development deployment. Expected pilot load is a few projects and tens of generation requests per day, with minutes-long GPU jobs. No customer-specific SLO, data residency, budget, or quality rubric has been supplied. This exercise should not assert production readiness.

## Source reconstruction and trust boundaries

The original Illustory source is a FastAPI app with a browser UI, Entra-based production auth, PostgreSQL metadata, workspace RBAC, leased generation jobs, versioned assets, Azure Blob, an OpenAI-backed parser/image path, Vast/ComfyUI H3 and SeedVR2 providers, and FFmpeg composition. The original engine is private and has not been copied. Its Azure deployment is described in its own README as a development environment with remaining production gates.

```text
Browser
  ├─ DeepSpace Auth → verified JWT
  └─ protected Studio → server actions (Bearer JWT)
       ├─ membership check on every workspace/project/asset operation
       ├─ DeepSpace RecordRoom: workspaces, memberships, projects, jobs, assets
       ├─ DeepSpace JobRoom: durable orchestration and checkpoints
       │     ├─ Catalog OpenAI: screenplay structure + character/scene images
       │     ├─ Catalog ElevenLabs: voice list + selected speech
       │     └─ HTTPS + private bearer secret → owner-operated private adapter
                   ├─ SQLite idempotency ledger + private asset directory
                   └─ imports original Illustory RealPipeline / ComposerService
                         ├─ reference-conditioned first frame
                         ├─ Vast GPU / ComfyUI H3 and SeedVR2
                         └─ FFmpeg trims and export
       ├─ Catalog YouTube: optional top-three reference search
       └─ Catalog Email: optional export-ready notice
```

Trust boundaries: the browser cannot reach the private adapter or read its token; RecordRoom product collections deny direct client access; server actions use app-level record tools only after checking workspace membership; the media proxy checks membership before forwarding file bytes. Browser WebSocket routes and generic browser Catalog integration routes are closed. Catalog calls occur only behind role-checked actions or jobs. The private adapter authenticates the Worker bearer token, rejects key traversal, validates replay hashes and keeps binaries off the public app scope. Operator-controlled environment variables and DeepSpace secrets hold service credentials.

## Actual data and control flow

1. `src/actions/index.ts` creates a project with a script, empty storyboard, revision 1 and workspace ID. Each edit requires owner/editor membership and an expected revision.
2. The owner submits a job. The action validates operation/target/dependencies, derives a deterministic job record ID from the project and idempotency key, copies selected asset metadata into an input snapshot, persists a `workflow-jobs` row, and enqueues `illustory-workflow` in JobRoom. Concurrent requests for the same key converge on the same row.
3. For parse, character images, scene anchors or speech, `src/jobs.ts` calls the relevant DeepSpace Catalog endpoint. Parse output is validated against the public storyboard contract; image/audio data URIs are checksum-verified and copied to the protected private adapter. The job records Catalog intent before billing and checkpoints its result before publication. No automatic Catalog retry can create a duplicate bill after an ambiguous crash.
4. For first frame, H3, SeedVR2 and export, `src/jobs.ts` POSTs the snapshot to the private adapter with the same key, saves its stable ID, polls with `ctx.continue`, and updates user-visible job state. A Worker restart may replay POST safely because the private adapter enforces idempotency. The adapter imports the original reference-conditioned image, GPU and composition pipeline. It writes binaries to an isolated private directory and returns a relative storage key, hash, size and MIME type. The public storyboard projection supplies editable character, scene, camera, dialogue and beat data; the original richer parser snapshot is no longer generated in this adaptation.
5. The Worker re-reads project revision and cancellation status. For media it also checks HEAD hash/size before creating an immutable asset version. It selects the new version only while the input revision is current. A failed, cancelled or stale job does not select an asset.
6. The Studio polls authorized actions every three seconds. Images use authenticated asset fetches; video streams through a same-origin, membership-checked route that supports Range.

## State and dependencies

DeepSpace RecordRoom holds persistent workspace membership, projects, scripts, storyboards, job metadata and asset version metadata. JobRoom holds queue/checkpoint state. The private adapter has a SQLite idempotency ledger and private media directory; its engine imports the original source and uses its existing provider credentials for reference-conditioned first frames, GPU motion, enhancement and export. The browser has only transient edit drafts and object URLs. The public repository contains reviewable script and image prompts, but no proprietary H3/ComfyUI prompt assembly or workflow, customer script, generated binary, or private credential.

## Acceptance evidence and known gaps

| Criterion | Current evidence | Classification |
|---|---|---|
| Four-role server authorization | Unit tests call server actions as owner/editor/reviewer/viewer; read/edit/billable behavior checked | Implemented offline; runtime verification required |
| Revision and stale result rejection | Unit tests change project revision before completion; no asset created | Implemented offline; concurrent edit race remains |
| Idempotent request and private submission | Concurrent action test creates one workflow row; adapter contract test repeats the same key and rejects changed input | Implemented offline |
| Cancelled/failed do not publish | Unit tests; adapter cancellation contract test | Implemented offline |
| Old media cannot attach to a reparsed storyboard | Parse clears current selections; creative edits invalidate them, trim-only edits preserve them | Implemented offline |
| Private asset integrity and access | Worker checks HEAD hash/size; adapter path isolation and Range tested | Implemented offline; live media test required |
| Catalog OpenAI, ElevenLabs, YouTube and Email | Endpoint schemas checked with official CLI; server-side action/job paths implemented; offline call mocks verify search, voices, parse and speech publication | Implemented offline; provider responses and billing unverified |
| Login, refresh persistence and browser workflow | Requires intended owner DeepSpace CLI login and minted app ID | Blocked for runtime verification |
| One actual H3/export run | Requires reachable private adapter and approved paid spend | Not verified |
| Atomic same-project concurrent edits | RecordRoom action performs read then update without transactional compare-and-swap | Must implement before shared production editing; not needed for one-editor exercise proof |

## Acceptance criteria for an honest submission

The app should start under the intended account; a signed-in owner can create a workspace/project and see them after refresh; a second editor can edit but cannot submit paid work; reviewer can select a version but cannot edit; viewer can only read. A single short script should parse, produce one character/scene/first frame, H3 a short shot, optionally enhance it, and export a cut. Every job should have input revision, terminal state, error or output version, and private media should play through the authenticated route. One cancelled/stale run should prove no current asset replacement. Record actual runtime observations and provider costs. Do not claim this criterion has been met from unit tests alone.

## Decision log

The [StoryNest](https://github.com/deepdotspace/storynest) reference uses a JobRoom to run its storybook pipeline and records to surface page progress. [ThreadHunt](https://github.com/deepdotspace/threadhunt) checkpoints scan state with `ctx.continue` to respect Worker limits. This app borrows those platform patterns but uses an external idempotent execution service because image/video generation already exists in the private Illustory stack.

| Decision | Why | Revisit when |
|---|---|---|
| Keep original engine private behind an API | Protects proprietary implementation while exposing real control-plane code; avoids reimplementing tuned GPU workflow | A customer needs complete self-hosted source or portable engine |
| DeepSpace RecordRoom + JobRoom | Native persistence, auth integration and durable background state meet the exercise scope | Cross-project throughput or concurrency evidence demands a different partition |
| Server actions for product records | Membership is per workspace; app roles alone cannot authorize one tenant's records | SDK supports first-class membership-aware row policy at required granularity |
| Keep binaries in private service | App-public file scope is wrong for customer media; private user scope is not shared workspace scope | A workspace-private storage primitive and measured file caps fit |
| Three-second authorized status refresh | Generic scaffold WebSocket rooms lack workspace-level authorization | Add workspace-scoped subscriptions only if the SDK provides enforceable tenant filters |
| Use four Catalog integrations with distinct jobs | OpenAI exposes reviewable parser/visual direction; ElevenLabs adds selectable speech; YouTube adds opt-in research; Email adds delivery notice | Remove any whose live value does not justify its price |
| Keep conditioned first-frame generation private | Catalog image endpoint accepts a text prompt only; the existing workflow edits with character and scene references | Catalog adds a reference-image edit endpoint with equivalent quality |

## Assumption register

| Assumption | Risk if false | Response |
|---|---|---|
| One editor changes a project at a time | Lost updates from non-atomic read-check-write | Serialize project edits or add transactional CAS |
| Private adapter can be reached over HTTPS | Jobs fail before execution | Provide private ingress and set Worker secret URL |
| Public storyboard projection retains enough shot direction for H3 | Reduced motion metadata may produce weak video | Run a one-shot visual evaluation and refine schema/adapter fields if needed |
| GPU operations are idempotent at adapter boundary | Worker replay could spend twice | Private ledger dedupes; interrupted work is never automatically resubmitted |
| Studio pilot uses a small job volume | App-wide JobRoom serial execution becomes a bottleneck | Measure queue delay, then partition queues by workspace or project |

## Top engineering gaps

| Gap | Evidence | Severity | Category | Required action | Status |
|---|---|---|---|---|---|
| Runtime app identity and browser flow | CLI reports `not_authenticated`; `vite build` rejects `__APP_ID__` | High | Must Implement | Intended owner logs in; run `dev start`, browser and multi-user tests | Open |
| Private one-shot execution | No private HTTPS URL, provider credentials or spend approval supplied | High | Must Implement | Connect adapter, approve a single-run ceiling, observe parse→export | Open |
| Catalog response and cost verification | No authenticated paid call yet; output envelopes and image/voice prices may vary by account | High | Must Implement | One capped call per selected endpoint; record response shape and actual charge | Open |
| Concurrent edit atomicity | Server action reads revision then updates separately | Medium | Must Understand | Add serialized/conditional project write before true multi-editor customer use | Open |
| Kubernetes, Kafka, second model vendor | No concrete pilot requirement | Low | Do Not Build | Avoid until measurements justify | Closed |
