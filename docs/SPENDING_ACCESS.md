# Review access and spending controls

## Two separate permissions

1. **Workspace membership** decides which projects a user can see and edit.
2. **Sponsored spending approval** decides whether that user may spend the app
   owner's OpenAI, Catalog and private-engine funds.

A newly registered user can create a workspace and become its owner without
receiving sponsored credits. Approval never reveals a provider key.

## Enforcement

[billing-access.ts](../src/illustory/billing-access.ts) permits the platform's
`OWNER_USER_ID` and exact IDs in `BILLING_ALLOWED_USER_IDS`. Missing identity and
anonymous identities fail closed; wildcards do not grant access.

- Server actions check spending approval before generation, research, voice
  discovery and export, then check the required workspace role.
- Jobs recheck approval and membership before dispatching new provider work.
- Generic browser integration and WebSocket routes are blocked.
- The asset proxy checks workspace membership on each read.
- Existing private jobs may still be monitored or recovered after approval is
  revoked. This does not submit new generation or refund work already accepted.
- Export email rechecks approval separately.

The boolean returned to the UI controls its buttons; the server checks enforce
the boundary. [Authorization tests](../src/illustory/workflow.test.ts).

## Grant or revoke review access

The reviewer signs in and copies their user ID from **Settings**. Add them to
the relevant workspace with the role needed for the review. Granting read access
to an example project does not require sponsored spending approval.

To allow new generation, set the complete approved ID list using
`npx deepspace secrets set BILLING_ALLOWED_USER_IDS --stdin`, then redeploy.
Remove an ID and redeploy to revoke future sponsored calls. Reviewers who need
to generate must also have owner access to the designated test workspace.

To pause all new sponsored work, set `SPENDING_PAUSED=1` and redeploy. This also
blocks the app owner. The switch is implemented but not currently enabled.
It does not stop rented GPU instances, in-flight provider work or storage bills.

## Agreed budget policy — not yet enforced

On October 6, the owner approved a project-only, non-resetting **$50 cumulative
limit for each of OpenAI, Vast and Azure**, starting from that approval. Budget
configuration is deferred while review access and repository presentation are
being addressed. No automatic dollar cap is currently active. Establish and
reconcile the baseline before enabling the policy; do not silently restart the
allowance from a later deployment date.

| Provider | Control and limitation |
|---|---|
| OpenAI | Current official docs describe monthly hard project limits, with possible propagation overrun. The agreed non-resetting total needs separate accounting. Check which projects the parser and Azure first-frame keys bill. |
| Vast | Stopping compute still incurs disk charges. Deleting the instance is destructive and requires separate approval. |
| Azure | Budgets notify; billing data arrives late. A shutdown action must target agreed resources. Stopping the adapter does not eliminate shared database, registry and storage costs. |
| DeepSpace | Catalog image, voice, research and email credits are separate from the owner's direct OpenAI bill. These need their own spending policy. |

Sources checked October 6: [OpenAI spend limits](https://developers.openai.com/api/docs/guides/spend-limits),
[Azure budgets](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets),
[Vast billing FAQ](https://console.vast.ai/faq/).

The allowlist is not a quota. Do not advertise a hard dollar allowance until
accounting, reservation/enforcement and provider shutdown behavior are tested.
Public metadata and media traffic can also incur infrastructure costs.
