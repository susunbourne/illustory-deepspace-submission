# Sponsored execution and review access

## Incident and requirement — 2026-10-06

The owner identified a billing exposure: any signed-in user could create a
workspace, become its owner and request work billed to the application's owner.
Code inspection confirmed this in `createWorkspace`, `requestJob`, `listVoices`
and `searchReferences`. No misuse or credential theft has been established by
this inspection. A workspace permission check did not authorize spending from
the app owner's accounts.

Acceptance: an unapproved signed-in workspace owner must trigger zero generation,
research, voice-discovery or export calls, including through forged HTTP requests
and previously queued jobs. Owner access must still require the appropriate
workspace permission. Viewing, editing and cancelling must remain available
according to workspace roles. Tests mock paid services; no paid validation call
is needed for this authorization boundary.

## Decision and enforcement

Default to the verified app owner only. `canSpendOwnerCredits` compares the
verified caller ID against `OWNER_USER_ID` or an exact ID in the server-only
`BILLING_ALLOWED_USER_IDS`. Missing app identity denies spending. Workspace role,
client parameters, client headers and email domains cannot grant approval.

- Server actions reject unapproved calls with HTTP 403 before creating jobs or
  invoking integrations. The action integration helper also enforces this gate.
- Jobs recheck sponsorship and current workspace membership before submitting new
  provider work. This protects queued jobs after revocation.
- A previously submitted private job may finish: monitoring does not submit a
  second job, and a saved result can be recovered without a new model call.
  Revocation does not cancel provider work already accepted or refund it.
- Export mail rechecks approval. If revoked, the export can remain available but
  no new mail is sent. Cancellation remains available to workspace owners.
- Generic browser Catalog and WebSocket job routes remain closed.
- Studio retrieves only the caller's approval boolean and explains why paid
  controls are unavailable. UI visibility is not the security boundary.

## Operator procedure

1. Ask the reviewer which account they will use. They sign in and obtain their
   verified user ID from Settings. Grant workspace access separately if sharing
   an existing demonstration project.
2. Agree on permitted tests and spend. If approving sponsored work, set the full
   intended ID list with `npx deepspace secrets set BILLING_ALLOWED_USER_IDS --stdin`
   and redeploy. No provider keys are shared with reviewers.
3. Check that account's controls and a forbidden account's denial. Monitor
   provider usage. Remove approval and redeploy after review.

The allowlist is not a monetary or rate limit. Approved users can make repeated
calls. A durable atomic budget reservation is required before promising a hard
per-user allowance. Basic hosting, metadata storage and authorized media reads
can still incur infrastructure costs. This fix does not claim zero-cost public
traffic or comprehensive abuse prevention.

## Engineering gap register

| Gap | Evidence | Severity | Category | Required action | Status |
|---|---|---|---|---|---|
| Workspace owners could spend app-owner funds | Self-service workspace creation plus role-only paid actions | High | Must Implement | Separate spending permission and enforce before provider dispatch | Implemented; see tests and release evidence |
| Approved accounts have no hard spend ceiling | Allowlist is boolean; no atomic budget ledger exists | Medium | Must Understand; Must Implement before capped/public generation | Define allowance and reserve budget before execution, reconcile actual costs | Explicit limitation; no quota claim |
| Abuse history is unknown | Code review establishes exposure, not historical usage | Medium | Must Understand | Inspect provider/app usage before concluding no misuse | Not audited in this fix |
| Full payment system for this evaluation | No current requirement to sell access | Low | Do Not Build | Keep controlled review access; revisit for paying customers | Deferred |

## Assumptions and revisit conditions

- `OWNER_USER_ID` is the platform-managed owner identity; missing identity fails closed.
- Approved IDs are trusted review accounts controlled by their holders. A public
  trial or a required dollar ceiling invalidates this assumption and requires
  durable spend limits, rate limits and an explicit budget policy.
- Environment changes take effect on deployment. Revocation is not retroactive
  for a running request or work accepted by an upstream provider.

## Verification

Unit and HTTP tests cover self-service workspace creation, all eight job types,
research, voice discovery, exact ID matching, spoofed owner input, independent
RBAC, queued-job revocation, role removal, and completing an existing private job
without new work or email after approval is revoked. Generic Catalog/WS bypasses
are checked too. These are deterministic authorization checks with paid services
mocked, not claims of a completed live model/GPU render.
