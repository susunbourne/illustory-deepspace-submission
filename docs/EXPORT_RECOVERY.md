# Activity visibility and export recovery — 2026-10-06

## Evidence
The live project had 17 jobs. The UI reversed the newest-first server response
and rendered only 12 rows, hiding the latest H3/export jobs. Export
`040fcb6a-6545-cd43-6b32-777f0002a2f9` had succeeded in the private adapter but
failed publication in DeepSpace with `Private asset integrity check failed`.
The immutable MP4 is 22,183,196 bytes. Its Azure HEAD reports matching length
and checksum, but the edge HEAD fallback rejected any file over 20 MiB.

## Changes
- Activity sorted newest first, six jobs per page, with explicit page navigation.
- Cast, Scenes, Shots and Edit use four items per page; the full draft remains
  in memory so paging does not discard edits. New items open their page.
- Job history currently exposes the newest 500 records (explicitly labeled at
  the boundary). The installed SDK query interface has no offset/cursor. This
  is a bounded UI history, not an unlimited audit archive.
- List responses omit frozen scripts/storyboards. Private inputs remain saved
  server-side on each job for execution and revision checks.
- Export's latest status/error is visible beside Final export.
- Large asset verification falls back to an authenticated JSON metadata
  endpoint that reads immutable Blob properties. Wrong key, length or digest
  is rejected. No large video is buffered in the Worker for hashing.
- Failed jobs with an existing private job ID can be checked again without
  another provider submission. Existing revision/owner checks still apply.

## Decision
Keep integrity validation; fix the transport boundary instead of relaxing
checksum checks or forcing a second paid render. Original production source
remains unchanged. The metadata endpoint lives only in the private adapter.

## Local verification
TypeScript check and 65 unit tests passed. Adapter contract tests: 11 passed,
4 skipped because original-engine dependencies are absent in this interpreter.
No model or GPU generation was invoked by this verification.

## Live verification
Released public app commit e8e0e77 and private adapter revision 0000004.
ACR build cj3 completed in 106 seconds; no inference was submitted.
The authenticated metadata endpoint returned the expected byte size and SHA-256.
Resumed the SAME export job from Activity. It became succeeded with output v1;
asset count went from 12 to 13, with no new render request. Browser decoded the
MP4 at 1920x1080, duration 32.789333 seconds, readyState 4, no media error.
Playback advanced to 11.742057 seconds before pausing for the user.
Activity navigation verified ranges 1–6, 7–12, 13–17 with correct boundaries.

Export email status is failed: `Email sender is not configured`. This is a
separate configuration gap and did not block video publication. No email was
sent during recovery.

Credential checks found no private key/API key patterns in tracked source and
no matches to four local secret values in the client bundle. Both checks are
bounded scans, not a claim of comprehensive security certification.
