# Working on Illustory

Read [.agents/skills/deepspace/SKILL.md](.agents/skills/deepspace/SKILL.md) before
changing platform integration. Use official docs and installed types for SDK APIs.

## Project map

- `src/illustory/`: domain, creative rules, schemas and provider clients.
- `src/actions/index.ts`: workspace authorization and user operations.
- `src/jobs.ts`: durable workflow execution and asset publication.
- `src/pages/(app)/(protected)/studio.tsx`: editor and job UI.
- `worker.ts`, `src/server/`: DeepSpace runtime and HTTP wiring.
- `docs/VERIFICATION.md`: current evidence and unverified stages.

## Boundaries

Keep private engine implementation, credentials and customer media outside this
repository. Preserve the original Illustory repository. Do not change prompt
rules or schema semantics as part of a transport or formatting fix.

Workspace membership and sponsored spending approval are separate server checks.
Never replace them with client-only controls. Do not run paid model/GPU tests
without the user's applicable authorization and spending ceiling.

## Checks and release

Run `npm run validate`, `npm run lint`, `npm run format:check` and `npm run build`.
Update verification evidence when behavior or a known limitation changes.

This deployed app uses **GitHub source**. Use Git for source control and
`npx deepspace deploy` for an authorized release. Do not use `deepspace push`.
Check the working tree before deployment: GitHub-source deploy ships local files.
