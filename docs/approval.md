# Storyboard approval

STORYBOARD APPROVED: 2026-11-18 (by the user: IDEA-8 / IDEA-9 / IDEA-10 screens, lattice watermark at 2x density, every photo watermarked).

Scope of this review round: IDEA-8 / IDEA-9 additions (TASK-7, TASK-10 to TASK-13). Other screens are unchanged.

## How to open
Double-click `storyboard/index.html` (no server needed), or open it from the file path in your browser. Then go to GALLERY, or open `storyboard/admin/index.html` directly (not in the site nav).
Each page has a yellow "Storyboard: show state" switcher bottom-left to click through the states.

## Screens and states to review
1. `storyboard/gallery.html` (TASK-10, TASK-7 look)
   - Tiles carry the tiled diagonal white @notpuzzkezz watermark at 40%.
   - Click a tile: display copy first, "LOADING FULL SIZE" bar, then cross-fade to full size (2s simulated).
   - Close button, Esc, Left/Right arrows; first/last photo hide Previous/Next.
   - Switcher: Layout = Desktop / Phone (375px); Full size = loads after 2s / stays loading / fails ("Full size unavailable").
2. `storyboard/admin/index.html` (TASK-11, TASK-12, TASK-13, TASK-7)
   - GitHub panel: not connected, testing, connected (token ends in ...x7Kq), error. Save, Test connection and Forget token also work.
   - Publish panel: pending changes (+ ~ -), Publish button, progress bar, confirmation dialog ("These 3 old files will be removed", Remove and publish / Cancel), success, error, stale-ref message, Try again.
   - Uploader: two-file cards (MASTER and DISPLAY, pixel and KB sizes), a processing card, and two error cards.

## To confirm
- Does the viewer look and behave as wanted on desktop and phone?
- Are the admin wording, states and layout fine?
- Is the watermark density/visibility acceptable?

Notes from user: (none yet)

## Online preview (any device)
https://claude.ai/artifact/JqLvB1N5ycBaANcdiTYpYZ - republished to this same link after every storyboard change.
Design source (Concept 6B canvas, "6B v2" row): https://claude.ai/code/artifact/799d4278-9b04-4a21-b73b-f0638b4f1680 - updated together with the storyboard.

## Addendum 2026-11-23: IDEA-12 Hall ??? 番外
STORYBOARD APPROVED (HOME screen update with Hall ??? as the last year, shy-kaomoji polaroid and album pop-up). The user said "storyboard approved" in chat on 2026-11-23. The IDEA-12 plan (TASK-19 to TASK-22 in docs/plan.md) is still PROPOSED and is NOT approved yet.

## Plan approval 2026-11-23
The user told the planner team to start TASK-19 and TASK-20, then continue with TASK-21 and TASK-22. IDEA-12 tasks TASK-19 to TASK-22 are approved to be built. Review, QA, bug fixing and release are done by the daily 19:30 (GMT+8) run.

## Addendum 2026-11-25: IDEA-14 / TASK-24 admin collapsible panels + event paging
STORYBOARD APPROVED (admin screen: all panels collapsible, only Events open on load, events list 5/10 per page). The user said "Approved all" in chat on 2026-11-25, covering the TASK-24 plan and the admin storyboard. Deploy is NOT approved yet; the release-manager must ask.
