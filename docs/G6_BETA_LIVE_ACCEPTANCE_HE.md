# G6 Beta live acceptance — Historical reference

This historical checklist originally described a Beta 4 installation on real Home Assistant hardware. For the current release candidate use [Final stabilization acceptance](G6_FINAL_STABILIZATION.md).

## Principles still in force
- Run tests on the owner's actual G6, not merely simulated Xpengtk states in Chromium.
- Never publish the complete VIN, authentication tokens, precise vehicle location or personal addresses in test evidence.
- Validate charging state transitions, seven shortcuts, lock/window/tailgate/port commands, climate and seat controls against actual supported entities.
- On iPhone Safari check independent scrolling of long inner pages. On desktop confirm the card retains the night background and original car size.
- Confirm native GPS map centering and Honk/Flash with the user's permissions.
- Obtain owner approval before a stable merge.

Earlier test evidence and details remain in Git history; do not treat this historical note as evidence that current live tests passed.
