# Current handoff — 2026-10-06

## Source and isolation

- Public review repository: https://github.com/susunbourne/illustory-deepspace-submission
- Live DeepSpace app: https://illustory.app.space
- Private adapter: `D:\transfer\UNC\AfterUNC\Illustory-Private-Adapter` (outside the review repository)
- Original product: `D:\transfer\UNC\AfterUNC\Illustory.ai\illustory_integrated_v1_4_0\illustory_integrated_v1_4_0` (read only during this adaptation)

The DeepSpace app uses GitHub source. The portal currently shows **Task submitted**. This repository does not contain the private ComfyUI workflow, Vast credentials, Azure secrets, customer data, or generated media.

## Implemented path

| Layer | Responsibility | Verified |
|---|---|---|
| DeepSpace Auth, RecordRoom, JobRoom | Workspace identity, server-side roles, project/storyboard persistence, job status and asset versions | Local role tests; owner online login and refresh |
| Direct OpenAI Responses from the Worker | Two-stage Character Bible and scene/shot parsing with strict JSON Schema | Offline tests and owner live parse |
| DeepSpace Catalog | GPT Image 2 character and scene images; ElevenLabs voice selection/speech; optional YouTube search and Email | Character and scene images live; other paid paths still need live evidence |
| Private Azure adapter | Authenticated HTTPS, idempotent PostgreSQL job ledger, private Blob media, reference-conditioned GPT Image 2 first frames, FFmpeg export | Contract tests and no-model Azure health/auth; live first frame pending |
| Vast GPU | H3 and optional SeedVR2 | Disabled in the deployed app pending a separately capped render test |

The adapter image `firstframe-20261006-1` is deployed to `illustory-private-adapter-dev`. Its worker is enabled, GPU execution is disabled, and the Container App has `minReplicas=0`, `maxReplicas=1`. DeepSpace production has `PRIVATE_WORKFLOW_EXECUTION_ENABLED=1`; `PRIVATE_WORKFLOW_GPU_ENABLED` is unset. The private client allows up to 60 seconds for a cold start. The latest adapter revision passed `/health`; an unauthenticated job request returned 401. No paid image or GPU call was made by the agent during this rollout.

## Verification commands and results

```powershell
# Public repository
npm run validate  # 38 tests passed
npm run build     # passed

# Private adapter, with ILLUSTORY_SOURCE_ROOT set to the original source
& 'D:\transfer\UNC\AfterUNC\Illustory.ai\illustory_integrated_v1_4_0\illustory_integrated_v1_4_0\.venv\Scripts\python.exe' -m pytest -q test_contract.py  # 14 passed
```

The owner previously completed a live parse and selected character and scene images. The next live check is one first-frame job in **Shots** using those selected references. Capture the DeepSpace job ID, private job ID, pinned revision, output asset version, image quality, duration, and actual OpenAI charge. A failure must leave the current asset unchanged. Do not claim an end-to-end video run from this deployed app until H3, optional enhancement, and export are independently exercised.

## Costs and limits

The owner approved up to $10 of additional Azure infrastructure cost for this rollout. ACR image `firstframe-20261006-1` was built once; the Container App scales to zero when idle, although ACR, storage, database, and requests may still incur charges. This is not a hard Azure spending cap. The first-frame provider uses the owner's Azure Key Vault OpenAI secret; its model charges are separate and no agent-initiated paid call has been approved. OpenAI's [image guide](https://developers.openai.com/api/docs/guides/image-generation) lists about $0.041 in output tokens for a medium 1536×1024 GPT Image 2 image, plus text and reference-image input tokens. Actual cost depends on the input and provider bill.

The pilot's background thread depends on DeepSpace polling to keep a scale-to-zero Azure replica active during a job. A platform interruption can leave a private job requiring manual reconciliation. For an unattended customer workload, move private execution to a durable event-driven worker or keep a replica running under a measured cost budget.
