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
  DS->>DS: Check owner role and selected first frame; pin revision and asset snapshot
  DS->>Bridge: POST job with stable ID and idempotency key
  Bridge->>Bridge: Persist request; reject conflicting replay
  Bridge->>GPU: Build H3 request and execute private workflow
  GPU-->>Bridge: Rendered video or failure
  Bridge->>Store: Save private MP4
  DS->>Bridge: Poll job status and asset metadata
  DS->>Store: HEAD asset; verify SHA-256 and byte size
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

## Evidence still required

No paid GPU run from this deployed DeepSpace app has been verified. A real one-shot acceptance record must contain the job IDs, input revision, selected source asset versions, actual start/finish time, output hash, playable result, provider bill, and any failure log. Record those values after a capped real run; never substitute a static example for production evidence. The private adapter is reachable through authenticated HTTPS from DeepSpace. Its general worker handles first-frame requests. On October 6 the owner installed the original H3 model set on a new A100; the agent verified dedicated SSH and ComfyUI node/model discovery from Azure itself. Azure revision 0000003 and the DeepSpace GPU gate are enabled for owner testing. No inference was submitted by the agent. SeedVR2 has not been installed on this instance.
