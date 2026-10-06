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
       │     ├─ OpenAI Responses: strict screenplay structure (server secret)
       │     ├─ Catalog OpenAI: character/scene images
       │     ├─ Catalog ElevenLabs: voice list + selected speech
       │     └─ HTTPS + private bearer secret → owner-operated private adapter
                   ├─ Azure PostgreSQL idempotency ledger + private Blob media
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
3. For parse, character images, scene anchors or speech, `src/jobs.ts` calls the relevant DeepSpace Catalog endpoint. Parsing first builds a Character Bible and then supplies it to the scene/shot pass, with the original Illustory system/shot rules and field contract. The Worker validates both JSON results strictly and retains appearance, anchors, first-frame action, local environment, motion beats, emotions and dialogue. Image/audio data URIs are checksum-verified and copied to the protected private adapter. The job records Catalog intent before billing and checkpoints its result before publication. No automatic Catalog retry can create a duplicate bill after an ambiguous crash.
4. For first frame, H3, SeedVR2 and export, `src/jobs.ts` POSTs the snapshot to the private adapter with the same key, saves its stable ID, polls with `ctx.continue`, and updates user-visible job state. A Worker restart may replay POST safely because the private adapter enforces idempotency. The adapter imports the original reference-conditioned image, GPU and composition pipeline. It maps the full public storyboard fields into the original domain records, writes binaries to private Azure Blob storage and returns a relative storage key, hash, size and MIME type. Older private parser snapshots remain a compatibility path.
5. The Worker re-reads project revision and cancellation status. For media it also checks HEAD hash/size before creating an immutable asset version. It selects the new version only while the input revision is current. A failed, cancelled or stale job does not select an asset.
6. The Studio polls authorized actions every three seconds. Images use authenticated asset fetches; video streams through a same-origin, membership-checked route that supports Range.

## State and dependencies

DeepSpace RecordRoom holds persistent workspace membership, projects, scripts, storyboards, job metadata and asset version metadata. JobRoom holds queue/checkpoint state. The Azure private adapter uses the original PostgreSQL cluster for an independent idempotency ledger and private Azure Blob for media; its local test mode uses SQLite. Its engine imports the original source and uses owner-operated credentials for reference-conditioned first frames, GPU motion, enhancement and export. The browser has only transient edit drafts and object URLs. The public repository contains reviewable script and image prompts, but no proprietary H3/ComfyUI prompt assembly or workflow, customer script, generated binary, or private credential.

## Acceptance evidence and known gaps

| Criterion | Current evidence | Classification |
|---|---|---|
| Four-role server authorization | Unit tests call server actions as owner/editor/reviewer/viewer; a real browser test signs in four SDK test accounts and checks their workspace controls | Implemented locally; direct live attack checks still required |
| Revision and stale result rejection | Unit tests change project revision before completion; no asset created | Implemented offline; concurrent edit race remains |
| Idempotent request and private submission | Concurrent action test creates one workflow row; adapter contract test repeats the same key and rejects changed input | Implemented offline |
| Cancelled/failed do not publish | Unit tests; adapter cancellation contract test | Implemented offline |
| Old media cannot attach to a reparsed storyboard | Parse clears current selections; creative edits invalidate them, trim-only edits preserve them | Implemented offline |
| Private asset integrity and access | Worker checks HEAD hash/size; adapter path isolation and Range tested | Implemented offline; live media test required |
| GPU execution evidence | Worker persists private phase and actual adapter timestamps; Studio shows job IDs, pinned revision, elapsed time and output checksum | Implemented offline and visually checked; live provider metrics and a paid render remain unverified |
| OpenAI Responses structured parsing | Original Pydantic fields and enums encoded as strict JSON Schema; server-only key bound in production; offline request/response tests | Implemented and deployed; budgeted live re-test pending |
| Catalog OpenAI image, ElevenLabs, YouTube and Email | Endpoint schemas checked with official CLI; server-side action/job paths implemented; offline call mocks verify search, voices and speech publication | Implemented offline; paid provider responses and billing unverified |
| Login, refresh persistence and browser workflow | Intended owner CLI login and app registration succeeded; six browser smoke tests include sign-in, workspace/project creation, manual storyboard editing and refresh persistence | Implemented locally; owner's hands-on review pending |
| One actual H3/export run | Azure private adapter is reachable, but Vast access, GPU worker and approved paid spend are missing | Not verified |
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
| Use four Catalog providers with distinct jobs | OpenAI image supplies visual references; ElevenLabs adds selectable speech; YouTube adds opt-in research; Email adds delivery notice. Strict text parsing uses direct OpenAI Responses because the Catalog chat contract has no schema field. | Remove any whose live value does not justify its price; reconsider direct parsing if Catalog exposes strict schema |
| Keep conditioned first-frame generation private | Catalog image endpoint accepts a text prompt only; the existing workflow edits with character and scene references | Catalog adds a reference-image edit endpoint with equivalent quality |

## Assumption register

| Assumption | Risk if false | Response |
|---|---|---|
| One editor changes a project at a time | Lost updates from non-atomic read-check-write | Serialize project edits or add transactional CAS |
| Private adapter can be reached over HTTPS | Jobs fail before execution | Provide private ingress and set Worker secret URL |
| Catalog parser supports a short representative script under its output cap | The original parser allowed a larger output; Catalog caps `max_tokens` at 16,384 and has no structured-output schema input | Measure a paid one-shot parse, then reject or segment longer scripts explicitly |
| GPU operations are idempotent at adapter boundary | Worker replay could spend twice | Private ledger dedupes; interrupted work is never automatically resubmitted |
| Studio pilot uses a small job volume | App-wide JobRoom serial execution becomes a bottleneck | Measure queue delay, then partition queues by workspace or project |

## Top engineering gaps

| Gap | Evidence | Severity | Category | Required action | Status |
|---|---|---|---|---|---|
| Owner hands-on acceptance | The owner reviewed the local page and reported misplaced status/membership panels; the layout was corrected and role-browser tested, but full stage acceptance is pending | Medium | Must Implement | Review the five Studio stages locally and fix remaining mismatches | In progress |
| Private one-shot execution | Azure adapter HTTPS, PostgreSQL and Blob are verified; Vast public key is not yet accepted and paid spend is not approved | High | Must Implement | Verify Vast access and its new template, approve a single-run ceiling, observe parse→export | Open |
| Catalog response and cost verification | No authenticated paid call yet; output envelopes and image/voice prices may vary by account | High | Must Implement | One capped call per selected endpoint; record response shape and actual charge | Open |
| Concurrent edit atomicity | Server action reads revision then updates separately | Medium | Must Understand | Add serialized/conditional project write before true multi-editor customer use | Open |
| Kubernetes, Kafka, second model vendor | No concrete pilot requirement | Low | Do Not Build | Avoid until measurements justify | Closed |
