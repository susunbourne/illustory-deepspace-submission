# Verification

Last reviewed: October 7, 2026. This page separates live observations from
local tests. It is the current status reference for this repository.

## Live app

| Path                       | Evidence                                                                                                                                                                                                                                                                                                                                   | Still unverified                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Login and persistence      | Owner signed in, created a workspace/project, refreshed and confirmed both remained                                                                                                                                                                                                                                                        | Independent live multi-user role testing                   |
| Structured parsing         | Owner parsed a script into an editable Character Bible and scene/shot plan                                                                                                                                                                                                                                                                 | Quality and cost across a broader script set               |
| Character and scene images | Generated images were saved as versioned assets and displayed in Studio                                                                                                                                                                                                                                                                    | Broader visual consistency evaluation                      |
| YouTube research           | Three returned links appeared in the project                                                                                                                                                                                                                                                                                               | Relevance evaluation across different project descriptions |
| First frames and H3        | Owner generated first frames and four H3 clips; selected versions appeared in the editor                                                                                                                                                                                                                                                   | Measured cost per clip and reproducible speed comparison   |
| Export                     | Same export job recovered after a verification failure; 22,183,196-byte MP4 published as v1                                                                                                                                                                                                                                                | A broad set of codecs, trims and long cuts                 |
| Video playback             | Browser decoded 1920×1080, duration 32.789333 seconds; playback advanced to 11.742057 seconds without a media error                                                                                                                                                                                                                        | Cross-browser/device coverage                              |
| Activity pagination        | All 17 jobs visible across ranges 1–6, 7–12 and 13–17                                                                                                                                                                                                                                                                                      | Large-history performance                                  |
| ElevenLabs speech          | Implementation and deterministic response tests                                                                                                                                                                                                                                                                                            | Recorded live voice-generation acceptance                  |
| Completion email           | Export reports sender-not-configured independently of video success                                                                                                                                                                                                                                                                        | Sender setup and actual delivery                           |
| Review access request      | One saved request per signed-in user, fixed-recipient mail draft, and no automatic permission grant passed local tests. The reviewer must send the draft from their own email client; the app cannot observe delivery. An earlier server-sent preflight was rejected by the email provider and charged $0.013; that path has been removed. | Live reviewer click and mail-client handoff                |
| SeedVR2                    | Private operation is wired                                                                                                                                                                                                                                                                                                                 | Installation and a real enhancement run                    |

The owner initiated the live model and GPU generation. The agent verified the
stored jobs and assets, repaired the export publication boundary, and checked
playback without another render. [Export incident and recovery](EXPORT_RECOVERY.md).

No benchmark here establishes a 90% speed improvement. Such a claim needs a
repeatable baseline, hardware/model versions, sample set and timing results.

## Local checks

```sh
npm run validate       # TypeScript and deterministic unit tests
npm run lint
npm run format:check
npm run build
```

The latest local run passed TypeScript, **66 unit tests**, lint, formatting
checks and the production build. Seven prompt/style constants were compared
byte-for-byte with their pre-format values and were unchanged. The previous
65-test report included test declarations imported through shared fixtures.
Fixtures now live in a separate module; obsolete chat-response tests were replaced
with voice-text checks. This count change is not a loss of workflow coverage.

Tests cover server-side roles, spending approval, schema validation, pinned
revisions, cancellation, stale results, idempotency, private asset validation
and recovery without another provider submission. Test fixtures are synthetic.

The latest local browser run passed seven smoke cases, including a signed-in
reviewer saving an access request and reopening the email draft after refresh;
earlier runs covered the four workspace
roles. They are not live provider acceptance tests. The private adapter is
outside this repository; the last local contract run there passed 11 tests and
skipped four tests requiring original-engine dependencies. Earlier runs with
those dependencies are historical evidence, not a substitute for the latest run.

## Security and dependency checks

The last credential scan found no private key/API key patterns in tracked files,
and no matches to four configured local secret values in the browser bundle.
This is a bounded scan, not a security audit. Service secrets remain server-side;
private media reads require current workspace membership.

`npm audit` currently reports five affected packages (four high, one low), including
the build-time `@generouted/react-router` → `fast-glob` / `micromatch` / `braces`
chain and `esbuild`. Exploitability and a compatible dependency update require
separate investigation; a clean test run does not resolve those advisories.

## What needs to happen next

1. Verify the reviewer's email-client handoff on a signed-in account. Export-completion email still needs an accepted sender if that optional feature is used.
2. Enforce and test the agreed provider budgets before granting sponsored access.
3. Before a multi-editor customer pilot, serialize project writes or add an atomic
   revision check; the current read-check-update sequence can lose a concurrent edit.
