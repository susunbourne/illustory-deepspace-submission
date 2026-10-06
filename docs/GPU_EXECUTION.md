# Private GPU execution: reviewable boundary

This document describes the real Illustory video path without publishing its H3/ComfyUI workflow JSON, node mapping, model settings, prompt assembly, credentials, or GPU tuning scripts. Those parts run in an owner-operated private service. The DeepSpace submission contains the authenticated control plane and its tests.

## What the code does

```mermaid
sequenceDiagram
  participant User
  participant DS as DeepSpace action and JobRoom
  participant Bridge as Private adapter
  participant GPU as Vast GPU and ComfyUI
  participant Store as Private media store
  User->>DS: Request H3 for selected shot
  DS->>DS: Check spending approval, owner role and first frame; pin inputs
  DS->>Bridge: POST job with stable ID and idempotency key
  Bridge->>Bridge: Persist request; reject conflicting replay
  Bridge->>GPU: Build H3 request and execute private workflow
  GPU-->>Bridge: Rendered video or failure
  Bridge->>Store: Save private MP4
  DS->>Bridge: Poll job status and asset metadata
  DS->>Bridge: Verify stored SHA-256 and byte size (HEAD or JSON metadata)
  DS->>DS: Recheck cancellation and revision; publish new version
  DS-->>User: Authorized video playback and job details
```

The original private `RealPipeline.generate_h3` checks the selected first-frame file, gathers selected character and voice references, converts the storyboard into its AI schema, validates shot duration, builds an H3 request, then invokes `VastH3Provider`. That provider connects to the existing Vast host, starts or reuses ComfyUI, submits a workflow to its API, polls completion, and retrieves the result. SeedVR2 and FFmpeg use separate private operations. None of these execution modules are bundled into this repository.

## What reviewers can verify here

- `src/actions/index.ts`: server-side owner permission, asset prerequisites, immutable input revision and idempotent request record.
- `src/jobs.ts`: DeepSpace JobRoom submission, private job polling, terminal error handling, cancellation and stale revision checks, version publication.
- `src/illustory/private-workflow.ts`: HTTPS bearer-authenticated client, stable job ID, private media checksum contract.
- `src/pages/(app)/(protected)/studio.tsx`: per-job execution details read from persisted job and asset records. A completed H3 card shows its DeepSpace ID, private ID, pinned revision, adapter phase, measured execution time, version, size and SHA-256.
- Offline tests cover role rejection, conflicting replay, one-version publication, cancellation, interrupted execution and the rich storyboard fields reaching a substituted H3 call.

The adapter reports `queued`, `private_execution`, and terminal phases. `private_execution` means the private engine is working; it is **not** a fabricated percentage for individual ComfyUI nodes. The UI does not claim measured GPU utilization or cost.

## Private API contract

All routes require a server-side bearer token. Media never enters public app
file scope. The client is [private-workflow.ts](../src/illustory/private-workflow.ts).

| Method and path | Contract |
|---|---|
| `POST /v1/jobs` | Frozen revision, operation, target and selected inputs; `Idempotency-Key` returns the same private job for the same request and rejects conflicting input |
| `GET /v1/jobs/{id}` | Queued/running/terminal state, actual timestamps and result metadata |
| `DELETE /v1/jobs/{id}` | Request cancellation; local cancellation prevents publication even if provider work has already started |
| `PUT /v1/catalog-assets/{jobId}` | Store a checksum-verified image/audio result once |
| `HEAD /v1/assets/{key}` | Stored size and checksum |
| `GET /v1/asset-metadata/{key}` | JSON stored size/checksum when edge HEAD handling loses headers |
| `GET /v1/assets/{key}` | Authorized bytes with video Range support |

A successful media result contains `storageKey`, `mimeType`, `sha256` and
`byteSize`. Large files are verified through stored metadata without buffering
the entire video in the Worker. Blob objects are immutable at their job keys.

## Live evidence and limitations

Four H3 clips and the final export have been observed in the deployed Studio.
The export was recovered using its existing private job, then played in-browser.
See [verification](VERIFICATION.md) and the [export incident](EXPORT_RECOVERY.md).

SeedVR2 is wired but not installed on the current Vast instance. GPU utilization,
per-render cost and speedup against a baseline have not been established. The
private adapter has a single worker and reconciles interrupted GPU work manually;
these limits matter before unattended customer use.
