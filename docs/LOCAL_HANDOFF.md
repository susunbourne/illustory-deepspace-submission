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
| Structured OpenAI parsing and Catalog integrations | `src/illustory/original-creative.ts`, `src/illustory/structured-output.ts`, `src/illustory/catalog.ts`, `src/integrations.ts` | Original two-stage Character Bible and scene/shot schemas via direct OpenAI Responses from the Worker; Catalog image, ElevenLabs, YouTube, and Email wired; corrected parse unverified live |
| Private media proxy and access check | `src/server/illustory-routes.ts` | Code and private range contract tested |
| Existing-engine bridge | Private adapter `bridge.py` outside repo | Auth/idempotency/restart/path and telemetry migration tests pass; model/GPU path unverified |
| Reviewer-facing UI | `studio.tsx`, `studio.css`, `src/pages/index.tsx` | Video pipeline and execution details added in Edit & Export; narrow-layout and four-role browser tests passed; full stage review pending |

Commands and observed results:

```sh
npm run type-check       # passed
npm run test:unit        # 34 tests passed after structured-output correction
npm run lint             # passed
npm run build            # passed after official app init
npx deepspace test run smoke --port 5174                # 6 passed
npx deepspace test run tests/roles.spec.ts --port 5174  # 1 four-account flow passed
# In private adapter dir, with ILLUSTORY_SOURCE_ROOT set and original .venv Python:
python -m pytest -q -p no:cacheprovider test_contract.py  # 12 passed, 1 third-party deprecation warning
```

The owner signed in to the CLI and official `app init` minted this checkout's ID. `npx deepspace dev start --json` reported ready at `http://localhost:5173/`. SDK test accounts verified sign-in, manual storyboard persistence after reload and owner/editor/reviewer/viewer controls. The owner separately approved up to $10 incremental Azure setup cost. A private Azure adapter is deployed, with authenticated HTTPS, PostgreSQL task persistence, private Blob upload/Range, and a local DeepSpace Worker-to-Azure query verified without model calls. Its generation worker remains disabled while Vast SSH authorization and the replacement template are unresolved. The DeepSpace app is live at `https://illustory.app.space` and permanently uses GitHub source from this review repository. The owner personally signed in, created a harmless workspace and project, and confirmed both persisted after refresh and the app URL rename. The owner then initiated one Catalog parse; it failed at the application validator because `emotion` was outside the original enum. Its bill is unknown. The server parsing path now uses the original strict schema through direct OpenAI Responses and passes offline tests. The owner set a server-only key through DeepSpace secrets, and release `rel_01M47HSWJJFEQJCYDDER82Z42T` bound it to the live Worker. A budgeted live parse is still needed. Live media and paid rendering remain unverified. Nothing has been submitted to the portal.

`npm audit` reports four high advisories in the build-only route generator dependency chain (`@generouted/react-router` → `fast-glob` → `micromatch` → `braces`) with no upstream fix published, and one low advisory in `esbuild`'s Windows development server. `npm audit --omit=dev` reports only that low `esbuild` advisory. No vulnerable service endpoint is intentionally exposed by the app; the advisories should be revisited when fixes are available.

## Next verification gate

Deferred UX notes from the owner: the first-time OAuth button says **Sign in** even though that action also creates a new DeepSpace account; clarify onboarding copy later without adding a separate password signup flow. The new-project script field is only four visible rows in the sidebar, although the server accepts up to 20,000 characters and the main project editor is larger. A larger creation surface and optional `.txt` import are possible follow-ups. Neither UI change has been implemented.

1. Inspect the owner-created online project for any remaining product/UX mismatches. Authenticated sign-in, project creation and refresh persistence have passed; generation has not.
2. Confirm the new Vast template's ComfyUI/model paths and attach the dedicated public SSH key to the current Vast instance. The owner's private Azure adapter and the DeepSpace encrypted `PRIVATE_WORKFLOW_URL`/`PRIVATE_WORKFLOW_TOKEN` are already configured; its worker remains off. Never copy those values into this repository.
3. After setting a separate approved model/GPU cost ceiling, run one short script/one shot from Catalog parse through OpenAI references, an ElevenLabs voice, private first frame and H3, optional SeedVR2, and export. Search optional YouTube references and enable Email export notice if a sender address is available. Record job IDs, revisions, asset hashes, error outcomes, timing and actual bills. Then deliberately edit during a running job and cancel one to verify stale/cancel behavior in the live runtime.

## Cost planning

One representative run needs two direct OpenAI Responses text parse calls, two Catalog image operations, one private reference-conditioned first frame, one ElevenLabs voice list and short speech synthesis, one YouTube search, one H3 render, optional SeedVR2, and FFmpeg. Optional Email is one request. Catalog list/search/mail base prices shown by the current CLI are $0.004, $0.013, and $0.013 respectively (free-tier rates, subject to account status). Speech is $0.0002 per character at the displayed free-tier rate. OpenAI calls vary with tokens. Actual total is:

`OpenAI text/image tokens × account rates + speech characters × rate + fixed search/list/mail calls + original first-frame provider cost + Vast instance hourly price × occupied hours + storage/egress`.

OpenAI's [image generation guide](https://developers.openai.com/api/docs/guides/image-generation) explains that `gpt-image-2` output token use depends on size and quality; the original image path requests medium 1536×1024. [Vast's live pricing](https://vast.ai/pricing) varies by offer and bills per second. The selected Vast host rate, queue/setup duration, actual token usage, and DeepSpace account credits are not available here, so a defensible dollar total cannot yet be calculated. Set a **single-run cap before further paid tests**. The owner initiated one online Catalog parse, which failed validation; its bill is not yet known. The separate $10 Azure infrastructure approval did not authorize model or GPU testing.

## Source and reviewer access recommendation

The owner approved a **new public GitHub review repository containing only this review code** and a first DeepSpace deploy. The review repository is `https://github.com/susunbourne/illustory-deepspace-submission`; the live URL is `https://illustory.app.space`. The first release latched GitHub source permanently. Use ordinary Git for future source changes; `deepspace push` is not the source path. The portal has not been submitted.

## Portal note draft — edit after paid workflow verification

> I built Illustory Studio, a workspace-based film production app that turns a script into an editable storyboard, versioned character/scene/shot assets, voiced H3 motion, optional enhancement, and a final cut. DeepSpace provides authentication, RecordRoom persistence, JobRoom background work, and encrypted server secrets. Its Catalog provides visual references, ElevenLabs voice selection and speech, optional YouTube research, and optional export email. Text parsing uses the OpenAI Responses API directly from the server Worker because the Catalog chat endpoint does not expose strict JSON Schema. I disclosed my original two-stage Character Bible and scene/shot rules and fields in this repository. I kept reference-conditioned first frames, tuned GPU motion and FFmpeg execution in my private Illustory service. The coding agent implemented the adaptation, public prompt/data contracts, private adapter boundary, UI and tests; I personally signed in online, created a workspace and project, confirmed persistence after refresh, and found an invalid-emotion parse failure. The agent restored strict schema enforcement and verified it offline. I installed the server-only OpenAI secret; live re-test awaits an approved model budget. The private GPU/export path remains unverified because its worker is disabled pending Vast configuration.

The live URL and repository are listed above. The final note should be updated only with further steps actually observed before portal submission.
