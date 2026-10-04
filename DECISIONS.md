# TERM — Decisions

Why things are the way they are. Newest last. Each entry: the decision, the reason, and what was
rejected. `SPEC.md` and `DESIGN.md` reference these by number.

---

## Phase 0 — spec and design (2026-10-04)

**D-001 The docs describe the 2.0 target; v1 code stays untouched in Phase 0.**
The repo already had a working v1 (one timetable, three tabs, no rotation) and thin docs. The new
docs are the full target, with an explicit delta and data migration (SPEC §9) instead of pretending
the code doesn't exist. Rejected: rewriting the docs to match v1 (would drop most of the brief) or
deleting v1 (it works and most of it survives).

**D-002 Four tabs: Today, Week, Tasks, Settings.** Required by the brief. The v1 gear button on
Today/Week goes away, so Settings is one tap from anywhere. Settings is the only tab with pushed
screens; it has no FAB.

**D-003 Floating local time.** Dates are `yyyy-MM-dd`, times `HH:mm`, no time zone stored. School
happens at wall-clock times; a trip abroad shouldn't move lessons; `.ics` floating times match.
All arithmetic uses calendar functions, never ±86 400 000 ms (DST, SPEC R-1, E-10). Rejected: UTC
instants (lessons would shift by an hour twice a year in any naive code path).

**D-004 Multiple timetables with non-overlapping date ranges; overlaps trim the neighbour.**
One timetable per date keeps every rule simple (R-2). Creating an overlap trims (or replaces) the
other timetable with an undo snackbar rather than a confirm dialog. Rejected: priority-ordered
overlapping timetables (hard to explain, hard to see).

**D-005 Rotation = continuous calendar weeks from a Monday anchor, skipping holiday-only weeks.**
Most A/B schools keep alternating across breaks, so `skipHolidayWeeks` defaults to on for 2+ week
cycles. Schools that use ISO-week parity drift after 53-week years (2026 is one), so *This is week B*
re-anchors in one action (E-12). Rejected: ISO-parity mode (another setting; one tap fixes drift).

**D-006 Stable lesson ids; tasks snapshot their due time.** Tasks point at a lesson (so a bell-time
fix moves the due time) and keep a time snapshot (so deleting/retargeting a lesson never loses the
due time). Changing a lesson's subject creates a new id — Math homework must not silently become
Biology homework. Rejected: storing only period indexes (v1; breaks when periods are inserted).

**D-007 "AI parser" = on-device parser by default; cloud parser only behind a build flag + consent.**
Users are 12–19; a timetable photo can carry a name and class. Sending it anywhere needs explicit
consent and a server that doesn't retain data. The on-device pipeline (pdf.js / Tesseract + layout
heuristics) stays the default and the only shipped path; the `TimetableParser` interface lets a
cloud reader be added without touching the UI. Rejected: always-on cloud parsing; API keys in the
client.

**D-008 OCR language data ships with the app (same origin).** v1 fetches it from jsDelivr on first
use, which breaks "offline-first" and "no third-party requests". Cost: ~10 MB of lazily cached
assets, fetched only when someone imports a picture.

**D-009 Subject colours come from an OKLCH generator, keyed by hue.** Fixed L/C per role and theme
guarantees AA for *every* hue (verified for all 360: text ≥ 7.38:1 light, ≥ 9.67:1 dark), supports
any number of subjects, and the v1 palette names map 1:1 to preset hues. Rejected: hand-picking more
named swatches (doesn't scale, each needs manual contrast work).

**D-010 Workload uses a neutral ink ramp, encoded by length and darkness.** Accent means action and
subjects own the pastels, so load can't reuse either. Two encodings (bar length + darkness) keep it
readable without colour perception and without overlapping day numbers. Rejected: accent-tinted
heat (collides with selection; looks like an error with the red accent); full-cell shading
(illegible numbers at level 4).

**D-011 No background reminders in the web/PWA build.** Notification Triggers never shipped; Web
Push needs a server, which TERM doesn't have. Native builds use Capacitor Local Notifications. The
web build says so honestly and offers installing the app, instead of half-working reminders.
Permission is asked in context (after the first test/assignment), never during onboarding.

**D-012 "Next lesson" skips the rest of today once that subject's lesson has started; 120-day
horizon.** Homework given in period 2 is due next time, not in period 6 the same day; before school
starts, today's lesson is still the next one. 120 days covers summer and A/B + long breaks; v1's 14
days failed across a two-week break in a 2-week rotation.

**D-013 Quick add only strips the date phrase from the title; night-owl rule until 04:00.**
Stripping subject and kind words ("bio test cell division" → "cell division") misfires on titles
like "history of art essay"; what you type is what you get, minus the date (which goes stale). At
01:00, "tomorrow" means the day after you sleep — the parsed date is always visible in the chip.

**D-014 Detail sheets edit live; only creation has a commit button.** Apple Notes model: no edit
mode, no Save, no "discard changes?" question. Quick add, the setup flow and the result form are the
places where something is *created*, so they have a primary button.

**D-015 Undo instead of confirm; two guarded exceptions.** Every destructive action is immediate and
undoable. *Erase everything* (two-step button) and *Restore backup* (summary sheet) replace *all*
data, so they get one deliberate extra step — and are still undoable. A ⌘/Ctrl-Z history (10 steps)
backs up the snackbar.

**D-016 Snackbar: 6 s, paused while hovered/focused/pressed.** WCAG 2.2.1 (timing adjustable). v1's
5 s with no pause was too short for screen-reader users to reach *Undo*.

**D-017 Custom TimePicker instead of `<input type="time">`.** Native time inputs differ per platform
(wheels, steppers, 12/24 h quirks, no styling hooks). Two numeric fields with arrow keys and
suggestion chips are faster for bell times and fully accessible.

**D-018 Accent swatches wrap to 2 × 4 below 400 px.** Eight 44 px targets need 352 px; a phone card
row has 311 px. v1 squeezes them into ~35 px targets (a bug to fix in Phase 1).

**D-019 Study plans are steps with dates (`origin: 'plan'`), generated deterministically.**
Sessions behave like any step (tick, move, delete) and show up in Next up on their day. The
algorithm (expanding intervals back from the test, respecting the daily cap; SPEC R-11) is pure so
it can be unit-tested and *Re-plan* is predictable. Holidays are allowed for studying. Rejected: a
separate "study session" entity and calendar (more UI, same value).

**D-020 Non-goals.** Accounts/sync (no server, privacy of minors), sharing, teacher/parent
features, grade averages (grading scales differ: MK 1–5, DE 1–6 with 1 best, Oberstufe 0–15 points,
letters), per-date substitutions (would need a whole exceptions model; editing the due date covers
the common case), absence tracking, gamification, search (lists are short and grouped). Each can be
revisited with evidence.

**D-021 Test results are free text plus optional score.** Matches how grades are written on paper
in all three countries without a grade-scale setting. No averages (D-020).

**D-022 Tests are never overdue — they are "written".** A test whose time has passed happened; red
"Overdue" would be false and stressful. It waits for a result in a *Written* group for 14 days, then
counts as done. Homework and assignments do become overdue.

**D-023 `.ics` export: floating times, segmented RRULEs, 26-week cap, no homework.** Floating times
match D-003. Skipped holiday weeks can't be expressed in one RRULE, so series are split at each skip.
Open-ended timetables would recur forever, so exports cover 26 weeks (re-export updates thanks to
stable UIDs). Homework would flood a calendar; tests, assignments and holidays are what belongs there.

**D-024 Attachments are Blobs in IndexedDB, downscaled on add, base64 in backups.** Keeps everything
on-device and in one backup file. Photos are downscaled to 2048 px / JPEG 0.85 with EXIF stripped
(privacy: location). 10 MB per file.

**D-025 No quiet-hours setting.** Every reminder rule has an explicit time chosen by the student;
quiet hours would contradict it. One fewer setting.

**D-026 Load allocation heuristics (SPEC R-10).** Homework → the evening before; unplanned
tests/assignments → spread across their lead days; planned → their sessions. Simple, explainable,
good enough to spot a busy Wednesday. Levels are relative to the student's daily study cap.

**D-027 One lesson per slot.** Parallel groups (Religion/Ethics, language sets) are resolved by the
student choosing their subject in review; alternating subjects use rotation weeks.

**D-028 Seven-day weeks scroll horizontally on narrow phones.** Seven columns on 375 px are < 44 px;
shrinking text or targets would break the design rules, so 48 px columns scroll and snap.

**D-029 iOS storage-eviction mitigation.** Safari may evict IndexedDB of non-installed sites after 7
days unused. Request persistent storage, prompt to install, show the last backup date and nudge
after 30 days. Not a modal, not on every launch.

**D-030 Done tasks are kept forever; the UI shows 30 days.** Data is cheap; history shows up in
backups and in subject/test results without cluttering Tasks.

**D-031 The FAB lifts above the snackbar.** On a 375 px phone a centred snackbar overlaps the FAB;
moving the FAB (Material-style) keeps both reachable.

**D-032 Wireframes use one real, consistent scenario.** Thursday 8 October 2026, 09:50, Week A. The
first draft used weekdays that don't match the 2026 calendar and example tasks that contradicted the
ranking rule — a design doc whose examples disagree with its rules teaches the wrong behaviour.

**D-033 Quick-add kind words exclude "ex", "HA" and "final".** "ex" (Bavarian *Stegreifaufgabe*)
collides with "math ex 4–7"; "HA" with ordinary words; "final" with "final draft". Missing a kind is
cheap (the chip shows it, one tap fixes it); a wrong *test* is not. v1 still contains "final" — fix
in Phase 1.

**D-034 Strict CSP with `wasm-unsafe-eval` and a hashed boot script.** OCR needs WebAssembly
compilation; the no-flash theme bootstrap in `index.html` is inline. Allowing exactly those two
things keeps the policy strict. Rejected: `unsafe-inline`/`unsafe-eval`.

**D-035 No orientation lock.** v1's manifest locks portrait; tablets and landscape phones on a desk
are real use. The layouts already reflow.

---

## Phase 0 — adversarial review log

Both documents were written, then reviewed against each other, against the existing code and
against the brief's edge cases (holidays, DST, A/B weeks, free periods, lessons spanning periods).
Found and fixed:

| # | Finding | Fix |
| --- | --- | --- |
| 1 | Example dates didn't exist (Thu 9 Oct 2026 is a Friday; "Mon 1 Sep", "Mon 3 Nov" wrong). | All examples rebuilt on the real 2026 calendar (D-032). |
| 2 | Today's example showed a test as *Next up* while a study session and an overdue item should rank first under R-8. | Scenario rebuilt so every screen agrees with R-8, R-9, R-11. |
| 3 | A past test would show as red "Overdue" — wrong and stressful. | New *written* state, *Written* group, E-38 (D-022). |
| 4 | "Ex" as a German test word turns "math ex 4–7" into a test; "final" catches "final draft". | Removed from the grammar (D-033). |
| 5 | A typed time ("at 10") with a lesson link would resolve to the lesson start (9:45), ignoring the student. | Explicit time clears `lessonId` (R-6, R-12). |
| 6 | Unresolved-lesson attachment always used the first lesson of the day, even for a 14:00 due time. | R-7 picks the containing / previous occurrence when a time is set. |
| 7 | R-2 said "saving asks to replace" — a confirm dialog, contradicting undo-not-confirm. | Replace + undo snackbar. |
| 8 | E-24 allowed typing past dates, but R-12 ignores past day-months beyond 120 days. | Quick add never yields past dates; the date picker can (E-24). |
| 9 | Spec said heat is "cell shading" in the date picker; that makes day numbers unreadable at level 4. | Heat bar at the cell bottom, length + darkness (D-010). |
| 10 | Eight accent swatches can't have 44 px targets in a phone card; v1 ships ~35 px. | 2 × 4 below 400 px (D-018). |
| 11 | Snackbar centred above the tab bar overlaps the FAB on phones. | FAB lifts (D-031). |
| 12 | Two snackbar offers for the same event (first test: reminders *and* plan). | Priority rule: reminder offer once, plan offer otherwise. |
| 13 | Tap budget row for planning from a test was 4 taps. | Long-press *Plan studying* (3) and snackbar (2); preview path documented as optional. |
| 14 | Tab re-tap order ("scroll, then pop") disagreed between docs and with iOS convention. | Pop to root, then scroll to top — both docs. |
| 15 | Week tab: mixed weeks (timetable changes mid-week) said "union of period rows" — unbuildable. | Per-day lessons, row headers from the majority timetable, per-cell times (E-13). |
| 16 | CSP as written would block Tesseract's WebAssembly and the inline theme-boot script. | `wasm-unsafe-eval` + script hash (D-034). |
| 17 | `line-strong` is 2.8:1 on `surface-3` — below 3:1. | Usage restricted to `bg`/`surface`/`surface-2`, stated in the token table. |
| 18 | Light heat level 1 at 12 % ink was 1.28:1 — effectively invisible. | Ramp 25/45/65/85 % plus length encoding. |
| 19 | Subject `dot` at L 0.66 fell to 2.9:1 on light surfaces for greens. | L 0.62 → ≥ 3.05:1 on `surface-2` for all hues. |
| 20 | Review grid had no way to set the date range when adding a second timetable. | *Starts* row in review (F-1). |
| 21 | "Swipe left → Move / Delete" (SPEC) vs "Next lesson / Delete" (DESIGN). | Unified to *Next lesson* / *Delete*. |
| 22 | F-5 talked about "dropped on save" although details have no save. | Dropped on kind change, undoable. |
| 23 | Missing wireframes for sheets referenced in text (restore summary, `.ics` checklist, reminder override, FAB menu). | Added (DESIGN §4.11, §4.13). |
| 24 | Week grid as 30+ tab stops for keyboard users. | Roving tabindex grid (DESIGN §7). |
| 25 | iOS edge-swipe-back conflicts with row swipes and the Week swipe. | Ignore touches starting within 24 px of the left edge. |
| 26 | Garbled edge-case text (E-36) and a contradictory "Today" button on the current week's wireframe. | Rewritten. |
| 27 | Moving a test after planning left sessions after the new date. | E-39: flag + *Re-plan* offer. |
| 28 | Reducing rotation weeks would silently drop lessons. | E-42: choose the week to keep, undoable. |
| 29 | Large backups as one JSON string can exhaust memory on phones. | Assemble from Blob parts (N-5). |
| 30 | Manifest locks portrait while N-7 promises landscape/tablet. | No lock (D-035). |

Second pass — a full re-read of both documents after the fixes above:

| # | Finding | Fix |
| --- | --- | --- |
| 31 | R-8 ranked a study session for next week's test above homework due in a lesson 90 minutes later, and missed sessions jumped to the top of *Next up*. | Sessions rank at `max(plannedFor, today)` + the preferred study time (D-036). Today's wireframe reordered. |
| 32 | Period headers in the editable grids are buttons but only 40 px wide. | 44 px row-header column in review/editor; 40 px only in the read-only Week grid. |
| 33 | F-2 said new subjects get "the hue farthest from existing ones"; DESIGN says least-used preset first. | F-2 aligned with DESIGN §2.3. |
| 34 | "Nothing lesson-based fires on holidays" named no actual rule. | Replaced by the concrete digest rule (skipped when tomorrow has no lessons and nothing due). |
| 35 | DESIGN said "three taps from a tab root", SPEC "counted from anywhere". | Both: from anywhere, including the tab switch. |
| 36 | Keyboard list mentioned a `/` shortcut that does nothing. | Removed. |

Checked and consistent after the second pass: terms (*written*, *heat bar*, *Next lesson*, *Snackbar*),
tap counts, cross-references (F-/R-/E-/D- ids), and every wireframe's example data against R-5
(next lesson), R-8 (ranking), R-9 (buckets), R-10 (load) and R-11 (study-plan dates).

**D-036 Study sessions rank at the preferred study time.** A session is meant for the afternoon;
treating it as due at midnight made it outrank homework due later the same morning. Missed sessions
come back at today's study time instead of jumping the queue.
