# Local handoff — 2026-10-05

## Paths and isolation

- Independent review Git repository: `D:\transfer\UNC\AfterUNC\Illustory-DeepSpace-Submission`
- Private adapter, excluded from review repository: `D:\transfer\UNC\AfterUNC\Illustory-Private-Adapter`
- Original Illustory Git root: `D:\transfer\UNC\AfterUNC\Illustory.ai` (read only)

The original Git root had 136 pre-existing status entries at the start and still had 136 after implementation. No source files in that repository were edited, moved, cleaned, staged, reset or committed. The submission repo is separately initialized and its only remote is the new public review repository at `https://github.com/susunbourne/illustory-deepspace-submission`.

## Implemented

| Area | Main files | Status |
|---|---|---|
| DeepSpace auth shell and protected Studio | `src/pages/(app)/_layout.tsx`, `studio.tsx`, `worker.ts` | Registered and started locally; test-account browser flow passed |
| Workspace/project/storyboard and role checks | `src/actions/index.ts`, `src/schemas/illustory-schemas.ts` | Unit and four-account browser tests passed |
| Durable job and asset version control | `src/jobs.ts`, `src/illustory/private-workflow.ts` | Unit tested, including adapter phase/timing persistence; external provider not exercised |
| DeepSpace Catalog integrations | `src/illustory/original-creative.ts`, `src/illustory/creative.ts`, `src/illustory/catalog.ts`, `src/integrations.ts` | Two-stage original Character Bible and scene/shot parsing, original character/scene image prompts, ElevenLabs voices/speech, YouTube research, Email export notice wired; offline checks only |
| Private media proxy and access check | `src/server/illustory-routes.ts` | Code and private range contract tested |
| Existing-engine bridge | Private adapter `bridge.py` outside repo | Auth/idempotency/restart/path and telemetry migration tests pass; model/GPU path unverified |
| Reviewer-facing UI | `studio.tsx`, `studio.css`, `src/pages/index.tsx` | Video pipeline and execution details added in Edit & Export; narrow-layout and four-role browser tests passed; full stage review pending |

Commands and observed results:

```sh
npm run type-check       # passed
npm run test:unit        # 31 tests passed
npm run lint             # passed
npm run build            # passed after official app init
npx deepspace test run smoke --port 5174                # 6 passed
npx deepspace test run tests/roles.spec.ts --port 5174  # 1 four-account flow passed
# In private adapter dir, with ILLUSTORY_SOURCE_ROOT set and original .venv Python:
python -m pytest -q -p no:cacheprovider test_contract.py  # 12 passed, 1 third-party deprecation warning
```

The owner signed in to the CLI and official `app init` minted this checkout's ID. `npx deepspace dev start --json` reported ready at `http://localhost:5173/`. SDK test accounts verified sign-in, manual storyboard persistence after reload and owner/editor/reviewer/viewer controls. The owner has reviewed parts of the local Studio and requested the GPU execution explanation. The Edit & Export panel was visually inspected in the local browser; it truthfully says no video run is recorded. The owner separately approved up to $10 incremental Azure setup cost. A private Azure adapter is now deployed, with authenticated HTTPS, PostgreSQL task persistence, private Blob upload/Range, and a local DeepSpace Worker-to-Azure query verified without model calls. Its generation worker remains disabled while Vast SSH authorization and the replacement template are unresolved. The renamed DeepSpace app is live at `https://illustory.app.space` and permanently uses GitHub source from the review repository; the homepage and signed-out Studio passed online smoke checks. The owner personally signed in before the URL rename, created a harmless workspace and project, and confirmed both persisted after refresh. After the rename, the owner signed in at the new URL and confirmed the same workspace/project remained visible; the immutable app ID was retained. Live media, Catalog billing and paid one-shot rendering have not been verified. Nothing has been submitted to the portal.

`npm audit` reports four high advisories in the build-only route generator dependency chain (`@generouted/react-router` → `fast-glob` → `micromatch` → `braces`) with no upstream fix published, and one low advisory in `esbuild`'s Windows development server. `npm audit --omit=dev` reports only that low `esbuild` advisory. No vulnerable service endpoint is intentionally exposed by the app; the advisories should be revisited when fixes are available.

## Next verification gate

1. Inspect the owner-created online project for any remaining product/UX mismatches. Authenticated sign-in, project creation and refresh persistence have passed; generation has not.
2. Confirm the new Vast template's ComfyUI/model paths and attach the dedicated public SSH key to the current Vast instance. The owner's private Azure adapter and the DeepSpace encrypted `PRIVATE_WORKFLOW_URL`/`PRIVATE_WORKFLOW_TOKEN` are already configured; its worker remains off. Never copy those values into this repository.
3. After setting a separate approved model/GPU cost ceiling, run one short script/one shot from Catalog parse through OpenAI references, an ElevenLabs voice, private first frame and H3, optional SeedVR2, and export. Search optional YouTube references and enable Email export notice if a sender address is available. Record job IDs, revisions, asset hashes, error outcomes, timing and actual bills. Then deliberately edit during a running job and cancel one to verify stale/cancel behavior in the live runtime.

## Cost planning

One representative run needs two Catalog text parse calls, two Catalog image operations, one private reference-conditioned first frame, one ElevenLabs voice list and short speech synthesis, one YouTube search, one H3 render, optional SeedVR2, and FFmpeg. Optional Email is one request. Catalog list/search/mail base prices shown by the current CLI are $0.004, $0.013, and $0.013 respectively (free-tier rates, subject to account status). Speech is $0.0002 per character at the displayed free-tier rate. OpenAI calls vary with tokens. Actual total is:

`OpenAI text/image tokens × account rates + speech characters × rate + fixed search/list/mail calls + original first-frame provider cost + Vast instance hourly price × occupied hours + storage/egress`.

OpenAI's [image generation guide](https://developers.openai.com/api/docs/guides/image-generation) explains that `gpt-image-2` output token use depends on size and quality; the original image path requests medium 1536×1024. [Vast's live pricing](https://vast.ai/pricing) varies by offer and bills per second. The selected Vast host rate, queue/setup duration, actual token usage, and DeepSpace account credits are not available here, so a defensible dollar total cannot yet be calculated. Set a **single-run cap before any paid test**. A tentative $10 cap is a planning proposal, not an observed or approved price; confirm the live Vast rate and provider quotas first. No paid calls were launched in this work.

## Source and reviewer access recommendation

The owner approved a **new public GitHub review repository containing only this review code** and a first DeepSpace deploy. The review repository is `https://github.com/susunbourne/illustory-deepspace-submission`; the live URL is `https://illustory.app.space`. The first release latched GitHub source permanently. Use ordinary Git for future source changes; `deepspace push` is not the source path. The portal has not been submitted.

## Portal note draft — edit after paid workflow verification

> I built Illustory Studio, a workspace-based film production app that turns a script into an editable storyboard, versioned character/scene/shot assets, voiced H3 motion, optional enhancement, and a final cut. DeepSpace provides authentication, RecordRoom persistence, JobRoom background work, and encrypted server secrets. Its Catalog provides OpenAI parsing and visual references, ElevenLabs voice selection and speech, optional YouTube reference research, and optional export email. I disclosed my original two-stage Character Bible and scene/shot rules, full storyboard fields and character/scene image prompts in this repository. I kept reference-conditioned first frames, tuned GPU motion and FFmpeg execution in my private Illustory service because the Catalog image endpoint cannot accept my existing visual references and the H3/ComfyUI execution workflow is proprietary. The coding agent implemented the DeepSpace adaptation, public prompt/data contracts, private adapter boundary, UI and tests; I personally signed in online, created a workspace and project, and confirmed persistence after refresh. Local browser tests exercised the four workspace roles. Paid Catalog generation and the private GPU/export path remain unverified because the GPU worker is disabled pending Vast configuration and no separate model/GPU cost ceiling has been approved.

The live URL and repository are listed above. The final note should be updated only with further steps actually observed before portal submission.
