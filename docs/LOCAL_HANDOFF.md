# Local handoff — 2026-10-05

## Paths and isolation

- Independent review Git repository: `D:\transfer\UNC\AfterUNC\Illustory-DeepSpace-Submission`
- Private adapter, excluded from review repository: `D:\transfer\UNC\AfterUNC\Illustory-Private-Adapter`
- Original Illustory Git root: `D:\transfer\UNC\AfterUNC\Illustory.ai` (read only)

The original Git root had 136 pre-existing status entries at the start and still had 136 after implementation. No source files in that repository were edited, moved, cleaned, staged, reset or committed. The submission repo is separately initialized and has no remote.

## Implemented

| Area | Main files | Status |
|---|---|---|
| DeepSpace auth shell and protected Studio | `src/pages/(app)/_layout.tsx`, `studio.tsx`, `worker.ts` | Registered and started locally; test-account browser flow passed |
| Workspace/project/storyboard and role checks | `src/actions/index.ts`, `src/schemas/illustory-schemas.ts` | Unit and four-account browser tests passed |
| Durable job and asset version control | `src/jobs.ts`, `src/illustory/private-workflow.ts` | Unit tested; external provider not exercised |
| DeepSpace Catalog integrations | `src/illustory/creative.ts`, `src/illustory/catalog.ts`, `src/integrations.ts` | OpenAI parse/images, ElevenLabs voices/speech, YouTube research, Email export notice wired; offline checks only |
| Private media proxy and access check | `src/server/illustory-routes.ts` | Code and private range contract tested |
| Existing-engine bridge | Private adapter `bridge.py` outside repo | Auth/idempotency/restart/path tests pass; model/GPU path unverified |
| Reviewer-facing UI | `studio.tsx`, `studio.css`, `src/pages/index.tsx` | Build and browser smoke passed; owner identified a narrow-layout issue, now corrected and role-browser tested; full stage review pending |

Commands and observed results:

```sh
npm run type-check       # passed
npm run test:unit        # 24 tests passed
npm run lint             # passed
npm run build            # passed after official app init
npx deepspace test run smoke --port 5174                # 6 passed
npx deepspace test run tests/roles.spec.ts --port 5174  # 1 four-account flow passed
# In private adapter dir, with ILLUSTORY_SOURCE_ROOT set and original .venv Python:
python -m pytest -q -p no:cacheprovider test_contract.py  # 8 passed, 1 deprecation warning
```

The owner signed in to the CLI and official `app init` minted this checkout's ID. `npx deepspace dev start --json` reported ready at `http://localhost:5173/`. SDK test accounts verified sign-in, manual storyboard persistence after reload and owner/editor/reviewer/viewer controls. The owner's own browser review, live media, Catalog billing and paid one-shot rendering have not been verified. The app source remains unclaimed; no remote, push, deploy or portal submission exists.

`npm audit` reports four high advisories in the build-only route generator dependency chain (`@generouted/react-router` → `fast-glob` → `micromatch` → `braces`) with no upstream fix published, and one low advisory in `esbuild`'s Windows development server. `npm audit --omit=dev` reports only that low `esbuild` advisory. No vulnerable service endpoint is intentionally exposed by the app, and this repository has not been deployed; recheck advisories before release.

## Next verification gate

1. The owner reviews the local Studio at `http://localhost:5173/studio` with their own browser account and identifies product/UX mismatches. The server must be running; `npx deepspace dev start` restarts it if needed.
2. Configure the private adapter in the owner's private environment and expose it through an authenticated HTTPS ingress. Put URL/token in the DeepSpace encrypted secrets store; restart dev. Do not copy those values into this repository.
3. After setting an approved cost ceiling, run one short script/one shot from Catalog parse through OpenAI references, an ElevenLabs voice, private first frame and H3, optional SeedVR2, and export. Search optional YouTube references and enable Email export notice if a sender address is available. Record job IDs, revisions, asset hashes, error outcomes, timing and actual bills. Then deliberately edit during a running job and cancel one to verify stale/cancel behavior in the live runtime.

## Cost planning

One representative run needs one Catalog text parse, two Catalog image operations, one private reference-conditioned first frame, one ElevenLabs voice list and short speech synthesis, one YouTube search, one H3 render, optional SeedVR2, and FFmpeg. Optional Email is one request. Catalog list/search/mail base prices shown by the current CLI are $0.004, $0.013, and $0.013 respectively (free-tier rates, subject to account status). Speech is $0.0002 per character at the displayed free-tier rate. OpenAI calls vary with tokens. Actual total is:

`OpenAI text/image tokens × account rates + speech characters × rate + fixed search/list/mail calls + original first-frame provider cost + Vast instance hourly price × occupied hours + storage/egress`.

OpenAI's [image generation guide](https://developers.openai.com/api/docs/guides/image-generation) explains that `gpt-image-2` output token use depends on size and quality; the original image path requests medium 1536×1024. [Vast's live pricing](https://vast.ai/pricing) varies by offer and bills per second. The selected Vast host rate, queue/setup duration, actual token usage, and DeepSpace account credits are not available here, so a defensible dollar total cannot yet be calculated. Set a **single-run cap before any paid test**. A tentative $10 cap is a planning proposal, not an observed or approved price; confirm the live Vast rate and provider quotas first. No paid calls were launched in this work.

## Source and reviewer access recommendation

Recommend a **new GitHub repository containing only this review code** and choosing **GitHub source** on the first DeepSpace deploy, because the exercise requires a repository URL. The source choice is permanent on first source-producing action. Create and connect that remote only after the owner approves the disclosure scan, then deploy and verify online; do not use `deepspace push` first if GitHub source is chosen. If the owner prefers DeepSpace source, keep it as the sole authority and separately decide how to provide a reviewable repository URL. No GitHub repo, remote, push, deploy, or portal entry has been created.

## Portal note draft — edit after hands-on verification

> I built Illustory Studio, a workspace-based film production app that turns a script into an editable storyboard, versioned character/scene/shot assets, voiced H3 motion, optional enhancement, and a final cut. DeepSpace provides authentication, RecordRoom persistence, JobRoom background work, and encrypted server secrets. Its Catalog provides OpenAI parsing and visual references, ElevenLabs voice selection and speech, optional YouTube reference research, and optional export email. I kept reference-conditioned first-frame, tuned GPU motion and FFmpeg execution in my private Illustory service because the Catalog image endpoint cannot accept my existing visual references and the H3/ComfyUI workflow is proprietary. The coding agent implemented the DeepSpace adaptation, public data and prompt contracts, private adapter boundary, UI and tests; I personally verified **[replace with actual login, role, one-shot generation, export and online evidence after running them]**. **[State any remaining external-stage limitation honestly.]**

This draft is not ready to paste into the portal until the bracketed personal verification and live URL/repository fields are real.
