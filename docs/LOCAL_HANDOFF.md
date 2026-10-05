# Local handoff — 2026-10-04

## Paths and isolation

- Independent review Git repository: `D:\transfer\UNC\AfterUNC\Illustory-DeepSpace-Submission`
- Private adapter, excluded from review repository: `D:\transfer\UNC\AfterUNC\Illustory-Private-Adapter`
- Original Illustory Git root: `D:\transfer\UNC\AfterUNC\Illustory.ai` (read only)

The original Git root had 136 pre-existing status entries at the start and still had 136 after implementation. No source files in that repository were edited, moved, cleaned, staged, reset or committed. The submission repo is separately initialized and has no remote.

## Implemented

| Area | Main files | Status |
|---|---|---|
| DeepSpace auth shell and protected Studio | `src/pages/(app)/_layout.tsx`, `studio.tsx`, `worker.ts` | Code complete; login runtime unverified |
| Workspace/project/storyboard and role checks | `src/actions/index.ts`, `src/schemas/illustory-schemas.ts` | Unit tested |
| Durable job and asset version control | `src/jobs.ts`, `src/illustory/private-workflow.ts` | Unit tested; external provider not exercised |
| Private media proxy and access check | `src/server/illustory-routes.ts` | Code and private range contract tested |
| Existing-engine bridge | Private adapter `bridge.py` outside repo | Auth/idempotency/restart/path tests pass; model/GPU path unverified |
| Reviewer-facing UI | `studio.tsx`, `studio.css`, `src/pages/index.tsx` | Type/lint pass; browser runtime unverified |

Commands and observed results:

```sh
npm run type-check       # passed
npm run test:unit        # 14 tests passed
npm run lint             # passed
# In private adapter dir, with ILLUSTORY_SOURCE_ROOT set and original .venv Python:
python -m pytest -q -p no:cacheprovider test_contract.py  # 6 passed, 1 dependency warning
```

`npm run build` currently refuses the scaffold placeholder `__APP_ID__`; the official CLI reports `not_authenticated`. After logging in as the intended owner, run `npx deepspace app init` to mint and write the ID; `dev start` does not register the app. No ID was fabricated. `npx deepspace dev start`, login/browser interaction, persistence across reload, multi-user integration, live media and paid one-shot rendering have not been verified.

`npm audit` reports four high advisories in the build-only route generator dependency chain (`@generouted/react-router` → `fast-glob` → `micromatch` → `braces`) with no upstream fix published, and one low advisory in `esbuild`'s Windows development server. `npm audit --omit=dev` reports only that low `esbuild` advisory. No vulnerable service endpoint is intentionally exposed by the app, and this repository has not been deployed; recheck advisories before release.

## Next verification gate

1. Intended owner runs `npx deepspace auth login` in the new repository, confirms `auth whoami`, then `npx deepspace app init` and `npx deepspace dev start`. App init registers an ID but does not push or deploy or latch source.
2. In the browser, create a workspace and project, refresh, then verify the records survive. Use four test users to exercise owner/editor/reviewer/viewer with direct API attempts in addition to hidden controls.
3. Configure the private adapter in the owner's private environment and expose it through an authenticated HTTPS ingress. Put URL/token in the DeepSpace encrypted secrets store; restart dev. Do not copy those values into this repository.
4. After setting an approved cost ceiling, run one short script/one shot from parse through export. Record job IDs, revisions, asset hashes, error outcomes, timing and actual bills. Then deliberately edit during a running job and cancel one to verify stale/cancel behavior in the live runtime.

## Cost planning

One representative run needs a text parse, roughly three image operations, one H3 render, optional SeedVR2, and FFmpeg. Actual cost is:

`text tokens × model rates + image input/output tokens × image rates + Vast instance hourly price × occupied hours + storage/egress`.

OpenAI's [image generation guide](https://developers.openai.com/api/docs/guides/image-generation) explains that `gpt-image-2` output token use depends on size and quality; the original image path requests medium 1536×1024. [Vast's live pricing](https://vast.ai/pricing) varies by offer and bills per second. The selected Vast host rate, queue/setup duration, actual token usage, and DeepSpace account credits are not available here, so a defensible dollar total cannot yet be calculated. Set a **single-run cap before any paid test**. A tentative $10 cap is a planning proposal, not an observed or approved price; confirm the live Vast rate and provider quotas first. No paid calls were launched in this work.

## Source and reviewer access recommendation

Recommend a **new GitHub repository containing only this review code** and choosing **GitHub source** on the first DeepSpace deploy, because the exercise requires a repository URL. The source choice is permanent on first source-producing action. Create and connect that remote only after the owner approves the disclosure scan, then deploy and verify online; do not use `deepspace push` first if GitHub source is chosen. If the owner prefers DeepSpace source, keep it as the sole authority and separately decide how to provide a reviewable repository URL. No GitHub repo, remote, push, deploy, or portal entry has been created.

## Portal note draft — edit after hands-on verification

> I built Illustory Studio, a workspace-based production app that turns a script into an editable storyboard, versioned character/scene/shot assets, H3 motion, optional enhancement, and a final cut. DeepSpace provides authentication, persistent records, background jobs and encrypted server secrets. I inspected the integration catalog but did not add a separate catalog API because the existing private Illustory engine already runs parsing, image, GPU and FFmpeg work. My main tradeoff was exposing the full control plane and failure handling for review while keeping proprietary model prompts and GPU workflows in a protected external service. The coding agent built the DeepSpace adaptation, private API contract and tests; I personally verified **[replace with actual login, role, one-shot generation, export and online evidence after running them]**. **[State any remaining external-stage limitation honestly.]**

This draft is not ready to paste into the portal until the bracketed personal verification and live URL/repository fields are real.
