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

---

## Phase 0.5 — e2e repair on v1 (2026-10-04)

`npm run e2e` failed 14 of 30 on the v1 code. Fixed against v1 behaviour; no 2.0 features started.

| Test | Root cause | Kind | Fix |
| --- | --- | --- | --- |
| tasks · completing shows undo | Completions were announced twice: the toast (a live region) and `LiveRegion` both carried the text. | App | One announcement per message (D-042); locator scoped to the toast. |
| tasks · next up puts overdue first | "Bio worksheet tomorrow" has no Tuesday lesson, so it is due at 23:59 — not overdue on Tuesday evening, where the test looked. | Test | Clock set to Wednesday 07:30 with `setSystemTime` (D-041). |
| settings · theme, accent, language | German dates lacked the ordinal dot ("Montag, 5 Oktober"): one pattern for all languages. The clock was fine. | App | Per-language patterns (`5. Oktober`, `Mo., 5. Okt.`). |
| settings · backup round-trip | `hydrate()` fell back to the in-memory settings when the table was empty, so *Erase everything* kept `onboarded: true`. | App | Fall back to fresh defaults; erase (and its undo) lands on Today. |
| settings · rename/recolour subject | Clicked "Physical Education" while Today was still fading out; it hit Today's lesson row and opened the lesson sheet. | Test (+ app) | Wait for the Settings screen; outgoing screens ignore pointer input (D-041). |
| onboarding · start without a timetable | The no-timetable card had no heading (DESIGN §7: sections have headings). | App | Empty-state title is the section's `h2` (Today and Week). |
| import · screenshot | Tesseract's automatic page segmentation read the ruled cells as pictures. | App | Sparse-text segmentation (D-038). |
| import · PDF, file without a timetable | The "one line per day" text fallback turned any OCR'd page into a timetable; locally, the OCR data CDN was also unreachable. | App + test | Files need timetable structure (D-039); language data served locally (D-040). |
| a11y · axe light/dark | A second *Back* during the step transition hit the outgoing screen; a fixed 400 ms sleep let axe measure half-faded text. | Test (+ app) | Wait for each step; `settle()` instead of sleeps (D-041). |
| a11y · tap targets | The FAB was measured mid scale-in. The test never visited Settings, where swatches (40 px) and segments (36 px) were too small. | Test + app | Measure after `settle()`, also on Settings; D-037. |

**D-037 Accent swatches: one row only from `sm` (640 px); segments fill their track.** Supersedes
D-018's threshold. Eight 44 px swatches need a 352 px row; on a 412 px phone (Pixel 7, the e2e device)
the card row is 348 px, so "below 400 px" would still give 40 px targets. `sm` is an existing
breakpoint (no new token). Fixed in v1 already because the v1 tap-target test enforces 44 px.
Segmented controls had 36 px segments inside a 44 px track: each segment now fills the track and the
thumb is drawn 4 px inside it — same look, 44 px targets.

**D-038 OCR uses sparse-text segmentation (Tesseract PSM 11).** The default automatic mode treats
the boxed cells of a timetable as images and returns noise ("Te ee wees" for the e2e screenshot,
which the text fallback turned into "6 lessons, 6 subjects"). Sparse text reads every cell at
≥ 95 % confidence; reading order doesn't matter because the layout parser rebuilds the grid from
word positions. Rejected: stripping grid lines before OCR (more code, same result).

**D-039 Only typed text may be read as "one line per day".** The text fallback guesses Monday,
Tuesday, … for lines without day names. That is right for what a student types or pastes in the
setup flow, but applied to a file it turned "Shopping list: milk, eggs, bread." into a Monday with
three lessons. Files now need a grid (layout parser) or day names; otherwise the import says *We
couldn't find a timetable* and offers *Type it in* (F-1.3).

**D-040 E2E serves OCR language data from a devDependency.** v1 still fetches `eng` from jsDelivr
at runtime (D-008 bundles it in 2.0). The import tests route that URL to `@tesseract.js-data/eng`
in `node_modules`, with `context.route` so the request is caught when the service worker makes it.
The tests no longer depend on a third-party CDN, and the `E2E_OFFLINE` skip is gone. Cost: a 14 MB
dev-only package that never ships.

**D-041 E2E time and motion are deterministic.** Pinned instants carry an explicit offset
(`2026-10-05T09:10:00+02:00`): a bare ISO string is parsed in Node's zone, so on a UTC machine the
fake clock ran two hours ahead of the browser's Europe/Skopje. Time jumps use
`page.clock.setSystemTime` to a named instant instead of `fastForward` by a duration (the clock's
log replays across reloads either way, but a named instant says what the test means). Tests wait
for the destination screen before acting on it, and `settle()` (no running Web Animations, inline
styles stable) replaces fixed sleeps before axe and size checks. App side, a screen that is
animating out ignores pointer input (`ScreenFrame`), so a quick tap can't land on the screen that
is leaving.

**D-042 One announcement per message.** The toast container is the polite live region
(`role="status"`) for its own text; `LiveRegion` only carries messages without a toast (reopening a
task, import phases). Announcing both made screen readers say every completion twice.

---

## Phase 2 — data layer and pure logic (2026-10-04)

Numbering continues after Phase 0.5. Phase 1 was built in another worktree and isn't on this branch
yet; its planned entries (also starting at D-037) need new numbers when it is merged.

**D-043 Quick add reads a little more than R-12, and never guesses a past or ambiguous moment.**
Month names ("12 nov", "12. November", "12 ноември") are unambiguous, so they may point up to a year
ahead; numeric day-months keep the 120-day guard (E-24). Lowercase "may" and "march" are verbs too
("question 5 may be hard"): as months they need "of", the end of the text, or a year or date word
after them. Capitalised short words ("SAT") aren't weekdays; German two-letter days ("Fr") count only
in German and capitalised. "friday next week" is that Friday. Bare hours 1–6 mean the afternoon
("at 3" → 15:00), and "2h" is a duration (a glued "10h" is a time only from 07). A time alone is today
if still ahead, else tomorrow. A typed date attaches to the subject's lesson that day only if it hasn't
started — "math homework today" at 15:00 is not instantly overdue. The night-owl rule moves *tomorrow*,
*day after tomorrow*, weekdays and *next week*; not *today*, *in N days* or explicit dates. The time
phrase is stripped from the title along with the date phrase. Rejected: fuzzy matching, and locale-only
grammars (students mix languages).

**D-044 Pure logic and the v2 model live in `src/logic`.** Framework-free, no hidden clock or store:
every function takes `now` and the `Schedule` it needs, so it is deterministic and unit-testable. The
v2 types are in `src/logic/types.ts` rather than SPEC §3's `src/domain/types.ts`, because `src/domain`
still holds the v1 screens' shapes (D-045); when the last v1 screen goes, `src/domain` goes with it.
Signatures from the brief, made explicit: `nextOccurrenceOfLesson(lesson, from, schedule)`,
`resolveWeekType(date, timetable, holidays)`, `nextLessonOfSubject(subjectId, from, timetables,
holidays)`, `parseQuickAdd(text, subjects, now, locale)` plus `resolveQuickAddDue(parsed, now,
schedule)` (parsing needs no timetable; placing does), `workloadScore(week, tasks, options)` and
`generateStudyPlan(test, freeSlots, tasks)`, where free slots are the window, the student's limits and
choices, and the load comes from the other tasks.

**D-045 The v1 screens keep working through a view layer until each is rebuilt.** Stored data is v2
from now on; `db/legacy.ts` (pure, tested), `db/hooks.ts` and `db/repo.ts` give the v1 screens their
old shapes with the same function names, so Phase 1's screen edits still merge cleanly and the e2e
suite proves nothing regressed. Limits while it lasts: the screens see one timetable (the one covering
today, else the next, else the latest), today's rotation week, and no holidays; edits keep period ids by
position and lesson ids by slot while the subject is unchanged (R-4), so linked tasks survive them.
Rejected: porting every screen to v2 now (that is the screens' phase, and it would collide with Phase
1), and a second database for v2 (two sources of truth).

**D-046 The data store applies change sets optimistically and reloads on failure.** Every write is
`{ table: { put, delete } }`, applied to memory first and persisted in one Dexie transaction (several
tables land together or not at all). Undo is the inverse change, computed before applying. A failed
write reloads the affected tables from the database — the source of truth — instead of replaying an
inverse that might race other writes, then raises `onDataError` (snackbar, E-19). Callers that need
durability await the write (`Applied.done`); the v1 facade does, so a confirmation toast means "stored".
If the database can't be opened at all (blocked storage), the app starts empty and says so rather than
showing a blank screen. Single writer per tab: no cross-tab live sync (Dexie `liveQuery` dropped with
`dexie-react-hooks`); attachments stay in IndexedDB, not in memory; settings keep their own store.

**D-047 One migration, shared, defensive, tested in a real browser.** `migrateV1toV2` is pure and used
by both the Dexie upgrade (schema version 2) and v1 backup import, so they can't drift. It repairs
instead of dropping — duplicate subject names merge, broken bell times are rebuilt from neighbours, an
impossible due date falls back to the creation day — and reads raw v1 rows defensively, because one
corrupt row would otherwise abort the upgrade on every launch. `validFrom` is the earlier of the Monday
of the last timetable update and the earliest due date (SPEC §9.2). Tested on fixtures in unit tests and,
end to end, on a v1 IndexedDB database built exactly as v1 did, which the app upgrades on first launch.

**D-048 Calendar export keeps UIDs stable and always writes a rule.** Lesson series are split where a
skipped holiday week shifts the rotation (D-023). Series boundaries are worked out over the timetable's
whole life, not the export window, so UIDs (`<lesson>@term`, then `<lesson>-<yyyymmdd>@term` for a
restart) stay the same next week and calendars update instead of duplicating. Every lesson event has an
RRULE, even with one occurrence, so the rotation interval survives a re-import; import recognises
TERM's own restarted series as one lesson. A test or assignment with a time but no lesson lasts 45
minutes. Export is checked against ical.js (Mozilla's RFC 5545 implementation, dev only): every expanded
occurrence equals the app's own.

**D-049 Rotation results are memoised per Monday.** Counting skipped holiday weeks back to the anchor for
every date made a missed next-lesson search 51 ms (≈ 200 ms on a throttled phone, per keystroke in quick
add) and an export 1.8 s. Timetables and holiday lists are immutable values in the store, so their
identity keys a WeakMap cache: now 4 ms and 0.18 s. Callers pass the store's arrays, never copies.

**D-050 Workload and study-plan details.** Written tests count no load. Planned steps' minutes — done or
not — reduce the remainder that is spread like an unplanned task; whole minutes, the leftover on the days
nearest the due date. A plan window of one day or less (due today or tomorrow) is one *Quick review*
today (E-40). A neighbour tie goes to the day nearer the due date. *Re-plan* regenerates the stored
session count minus finished sessions, and nothing once all are done. Session titles are a structured
value the caller words (English by default), so plans can be stored in the student's language.

**D-051 Tests pin the zone and the coverage.** Unit tests run in Europe/Skopje (`test.env.TZ`), so results
don't depend on the machine; DST tests switch zones per file (Vitest's `forks` pool runs files in
separate processes). `npm run test:coverage` fails below 90 % of statements, branches, functions or
lines in `src/logic`, and `npm run check` runs it.

**D-052 Rarely used code loads on use.** Phase 2 pushed the initial chunk from 144.8 to 153.4 KB gzip,
over N-1's 150. Backup parsing and validation now load when the student exports or imports, and the
study planner when they plan: 149.3 KB. The margin is thin; the screens' phase should split further.

**D-053 Demo data is DESIGN's scenario, moved to this week.** `demoData(now)` builds the example week
(Thursday 8 October 2026, Week A, teacher training on Monday, autumn break 26–30 October) shifted by
whole weeks, with a study plan generated the way the app makes one. In development, `await
term.seedDemo()` in the console loads it.
