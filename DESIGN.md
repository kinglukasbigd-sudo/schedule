# TERM — Design system

Apple Notes meets Linear meets Things 3: quiet surfaces, confident type, one accent, soft subject
colour, motion that feels physical and never decorative.

| | |
| --- | --- |
| Status | Target design for TERM 2.0. Supersedes the v1 design doc. |
| Source of truth for values | `src/design/tokens.css` (CSS variables) → `tailwind.config.ts` (the only Tailwind theme). |
| Enforced by | `src/design/discipline.test.ts` (no arbitrary values, no raw hex outside tokens, 4 px grid) and `src/design/contrast.test.ts` (every pair below). |
| Behaviour | `SPEC.md` (feature `F-x`, rule `R-x`, edge case `E-x` references). Decisions in `DECISIONS.md`. |

---

## 1. Principles

1. **One primary action per screen.** It is the only accent-filled *button* on screen (the FAB on
   the three main tabs, the sticky footer button in sheets). Accent elsewhere only marks state —
   selection, today, now, a checked box — never a second call to action. Everything else is ink.
2. **Three taps to anything**, counted from anywhere including the tab switch (SPEC §5.5 lists
   every path).
3. **Delete UI before adding UI.** No confirm dialogs (undo instead), no filters, no badges that
   don't change a decision, no settings for things the app can decide.
4. **Colour carries meaning, never decoration.** Accent = action/selection/now. Pastel = subject.
   Danger = overdue/destructive. Neutral ramp = load. Shape distinguishes tests (square) from other
   work (circle) so colour is never the only signal.
5. **Direct manipulation, always reversible.** Swipe, long-press and drag act immediately and
   optimistically; every destructive action can be undone.
6. **Friendly, short copy.** Second person, sentence case, no exclamation marks. Empty states say
   what's good about being empty and what to do next.
7. **Both themes are first-class.** Every token, illustration and screenshot exists in light and
   dark; neither is derived by inverting the other.

---

## 2. Tokens

All values live in `src/design/tokens.css`. Colours are stored as space-separated RGB channels
(`--ink: 23 23 26`) so Tailwind can apply alpha (`bg-ink/80`). Tailwind's default palette, spacing,
type scale, radii and shadows are **replaced**, not extended.

### 2.1 Neutral and semantic colour

| Token | Light | Dark | Use | Allowed under text/graphics |
| --- | --- | --- | --- | --- |
| `bg` | `#FBFBFA` | `#0F0F11` | App background | — |
| `surface` | `#FFFFFF` | `#18181B` | Cards, sheets, rows | — |
| `surface-2` | `#F3F3F1` | `#222226` | Chips, segmented track, pressed/hover rows, inputs on surface | — |
| `surface-3` | `#E9E9E6` | `#2C2C31` | Hover on `surface-2`, swipe *Move* action | — |
| `line` | `#E4E4E0` | `#2A2A2F` | Hairlines, dark-theme card outlines, holiday hatch | decorative only |
| `line-strong` | `#8A8A90` | `#727279` | Input and checkbox outlines (≥ 3:1) | on `bg`, `surface`, `surface-2` only (2.8:1 on `surface-3`) |
| `ink` | `#17171A` | `#F4F4F5` | Primary text, icons, snackbar fill | all surfaces |
| `ink-2` | `#55555C` | `#B4B4BB` | Secondary text, inactive icons | all surfaces |
| `ink-3` | `#66666E` | `#9A9AA2` | Tertiary text: meta, captions, past lessons, placeholders | all surfaces (≥ 4.68:1) |
| `danger` | `#C0271B` | `#FF6B5F` | Overdue text, destructive actions | all surfaces, `danger-soft` |
| `danger-soft` | `#FBE9E7` | `#3A1E1C` | Error banner fill, danger hover | — |
| `danger-fg` *(new)* | `#FFFFFF` | `#0B0B0E` | Text/icon on a `danger` fill (swipe *Delete*) | on `danger` (5.92 / 7.04:1) |
| `scrim` | `#0F0F11` @ 40 % | `#000000` @ 40 % | Behind sheets and menus (20 % for menus) | — |
| `bar` | `bg` @ 80 % + 20 px blur | same | Tab bar, compact headers | text uses `ink`/`ink-3` |

Measured contrast (WCAG 2.x), the floor for every pair the UI uses:

| Text token | on `bg` | on `surface` | on `surface-2` | on `surface-3` |
| --- | --- | --- | --- | --- |
| `ink` light / dark | 17.28 / 17.42 | 17.89 / 16.12 | 16.10 / 14.42 | 14.71 / 12.64 |
| `ink-2` light / dark | 7.14 / 9.29 | 7.39 / 8.59 | 6.65 / 7.69 | 6.08 / 6.74 |
| `ink-3` light / dark | 5.50 / 6.85 | 5.69 / 6.34 | 5.12 / 5.67 | 4.68 / 4.97 |
| `danger` light / dark | 5.72 / 6.86 | 5.92 / 6.34 | 5.33 / 5.68 | 4.87 / 4.97 |
| `line-strong` (UI, ≥ 3) | 3.31 / 4.01 | 3.43 / 3.71 | 3.09 / 3.32 | *not allowed* |

### 2.2 Accent

One user-selected accent. Each defines `accent` (fill and accent text), `accent-fg` (text on the
fill) and `accent-soft` (selected tint, current-lesson row). Light: deep fill, white text. Dark:
luminous fill, near-black text.

| Accent | Light `accent` / `accent-soft` | fg on fill | accent on surface | Dark `accent` / `accent-soft` | fg on fill | accent on surface |
| --- | --- | --- | --- | --- | --- | --- |
| blue | `#2457D6` / `#E5EBFA` | 6.16 | 6.16 | `#6EA0FF` / `#273044` | 7.61 | 6.86 |
| indigo | `#4B44D9` / `#E9E9FA` | 6.71 | 6.71 | `#9D98FF` / `#302F44` | 7.83 | 7.06 |
| violet | `#7438DB` / `#EEE7FB` | 6.30 | 6.30 | `#B794FF` / `#352E44` | 8.14 | 7.33 |
| pink | `#C2266D` / `#F8E5ED` | 5.54 | 5.54 | `#FF85B8` / `#422C37` | 8.70 | 7.85 |
| red | `#C42D1D` / `#F8E6E4` | 5.61 | 5.61 | `#FF7A6B` / `#422A29` | 7.72 | 6.96 |
| orange | `#B04509` / `#F6E9E1` | 5.67 | 5.67 | `#FFA05A` / `#423026` | 9.76 | 8.80 |
| green | `#1D7A3E` / `#E4EFE8` | 5.38 | 5.38 | `#4FD282` / `#22392E` | 10.18 | 9.17 |
| graphite | `#3A3A40` / `#E7E7E8` | 11.30 | 11.30 | `#D4D4D8` / `#3A3A3D` | 13.30 | 11.99 |

`accent` text on `accent-soft` is ≥ 4.56:1 for every accent in both themes. The focus ring is
always `accent`. With *red* accent, overdue text stays `danger` and is also marked by the word
"Overdue" — colour is never the only signal.

### 2.3 Subject pastel generator

Subjects store a hue (`Subject.hue`, 0–359) or `null` for neutral. Colours are generated in OKLCH
with fixed lightness and chroma per role and theme, then mapped into sRGB by reducing chroma in
steps of 0.002 until in gamut. Implementation: `src/design/pastel.ts`, a pure function
`pastel(hue: number | null, theme: 'light' | 'dark') → { bg, fg, dot }` returning RGB channels.

| Role | Light `oklch(L C h)` | Dark `oklch(L C h)` | Used for |
| --- | --- | --- | --- |
| `bg` | `0.935 0.045 h` | `0.31 0.045 h` | Week cell, subject chip (selected), current subject tint |
| `fg` | `0.40 0.085 h` | `0.90 0.05 h` | Text and markers on `bg` |
| `dot` | `0.62 0.15 h` | `0.74 0.13 h` | Subject dot, lesson bar in Today, lesson dots in the date picker |
| neutral | same L, `C = 0` | same L, `C = 0` | `hue: null` ("stone") |

Verified over **all 360 integer hues** (script in the test suite, asserted in
`contrast.test.ts`):

| Check | Light min | Dark min | Requirement |
| --- | --- | --- | --- |
| `fg` on `bg` | 7.38:1 (h 140) | 9.67:1 (h 179) | ≥ 4.5 (text) |
| `dot` on `surface-2` (light) / `surface-3` (dark) | 3.05:1 (h 155) | 5.64:1 (h 355) | ≥ 3 (graphics) |
| neutral `fg` on `bg` | 7.53:1 | 9.81:1 | ≥ 4.5 |

**Presets** (the swatches in the subject sheet; also the v1 → v2 migration map):

| Preset | rose | coral | amber | lime | mint | teal | sky | iris | lilac | orchid | stone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hue | 5 | 35 | 75 | 125 | 160 | 190 | 235 | 270 | 300 | 335 | `null` |
| Light `bg` | `#FEE1E6` | `#FFE2DB` | `#FCE6C9` | `#E2EFCF` | `#D1F3DF` | `#C8F4F0` | `#D4EEFE` | `#E2E9FE` | `#EDE5FE` | `#FEDFF6` | `#E9E9E9` |
| Dark `bg` | `#44262D` | `#442821` | `#3E2D15` | `#2B341A` | `#1A3728` | `#0E3835` | `#173444` | `#272F47` | `#342B44` | `#3E2739` | `#303030` |

**Assignment.** A new subject takes the least-used preset in preset order. When all ten hued
presets are used, it takes the integer hue that maximises the minimum circular distance to every
existing hue (ties → lowest hue). Students can pick any preset later; a non-preset hue shows as an
extra "current" swatch.

**Applying.** Components never read `pastel()` directly: `<SubjectScope hue>` sets
`--subj-bg/-fg/-dot` for light and `--subj-*-dark` for dark as inline custom properties on a wrapper,
and `tokens.css` selects the pair for the active theme, so a theme switch needs no re-render.
Tailwind exposes `bg-subj-bg`, `text-subj-fg`, `bg-subj-dot`.

### 2.4 Load (heat) ramp

Load is neutral so it never competes with the accent or subject colours. A **heat bar** encodes the
level twice — by length and by darkness — so it reads without colour perception.

| Level | Meaning (R-10) | Bar width × height | Fill | Light / dark contrast on `surface` |
| --- | --- | --- | --- | --- |
| 0 | nothing planned | — (no bar) | — | — |
| 1 | < ⅓ of daily cap | 8 × 4 | `ink` @ 25 % | 1.72 / 2.17 (redundant: length) |
| 2 | < ⅔ | 12 × 4 | `ink` @ 45 % | 2.92 / 4.19 |
| 3 | < cap | 16 × 4 | `ink` @ 65 % | 5.56 / 7.38 |
| 4 | ≥ cap | 20 × 4 | `ink` @ 85 % | 11.35 / 10.60 |

Tokens: `--heat-1 … --heat-4` (alpha values), `--heat-w-1 … --heat-w-4`. Every heat bar's day has a
text alternative (§7).

### 2.5 Typography

System UI stack — SF Pro / Segoe UI Variable / Roboto — full Cyrillic and German coverage, zero
downloads (`--font-sans`). Sizes in px on a 4 px line-height grid; the app also honours browser
text zoom up to 200 % (layouts reflow, no fixed text heights).

| Token | Size / line | Weight · tracking | Use |
| --- | --- | --- | --- |
| `text-caption` | 12 / 16 | 600 · +4 % uppercase (section labels), 400 otherwise | Section labels, meta, grid times |
| `text-small` | 14 / 20 | 400–500 | Secondary rows, chips, due text |
| `text-body` | 16 / 24 | 400; 500 for row titles | Default. Inputs are never smaller (no iOS zoom) |
| `text-lead` | 18 / 24 | 600 | Card titles, empty-state titles |
| `text-title` | 22 / 28 | 600 · −1 % | Sheet titles, Next-up title |
| `text-large` | 28 / 36 | 600 · −2 % | Screen titles |
| `text-display` | 34 / 40 | 700 · −2.5 % | Onboarding hero only |

Numbers that change (times, counts, dates in grids) use `tabular-nums` (`.tabular`). Long words
hyphenate (`hyphens: auto`, correct `lang`). Truncation: one line with ellipsis in rows; titles in
sheets wrap.

### 2.6 Spacing and layout

Strict 4 px grid. Spacing tokens (key → px): `1`=4, `2`=8, `3`=12, `4`=16, `5`=20, `6`=24, `7`=28,
`8`=32, `9`=36, `10`=40, `11`=44, `12`=48, `14`=56, `16`=64, `18`=72, `20`=80, `24`=96, `28`=112,
`32`=128, `40`=160, `48`=192, `64`=256, plus `px` for hairlines.

| Layout token | Value |
| --- | --- |
| Screen gutter | 16 (`max(16px, safe-area)` in landscape) |
| Section gap | 32 |
| Card padding | 16; rows inside cards 16 horizontal |
| Row min height | 56 (two-line), 48 (one-line), 44 (dense menu rows never below) |
| Content max width | 560 (`max-w-content`); Week and the timetable editor 960 (`max-w-wide`) |
| Tab bar | 56 + bottom safe area; rail 72 wide at ≥ 900 px |
| FAB | 56, 16 from the right gutter, 16 above the tab bar |
| Sheet | max height 90 dvh; detail sheets open at 90 dvh, quick add and menus at content height |
| Breakpoints | `sm` 640 (sheets → centred dialogs), `md` 900 (rail, wider grid cells) |
| Bottom padding of scroll views | tab bar + safe area + 96 (FAB clearance) |

### 2.7 Radius

`xs` 4 (test markers) · `sm` 8 (thumbnails) · `md` 12 (buttons, inputs, grid cells) · `lg` 16
(cards, snackbar) · `xl` 20 (onboarding tiles) · `2xl` 24 · `3xl` 28 (sheet top corners, dialogs) ·
`full` (chips, FAB, swatches, checkboxes for homework).

### 2.8 Elevation and borders

Light theme uses soft shadows; dark theme replaces shadows with a 1 px `line` ring (shadows are
invisible on near-black and muddy the surface).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `shadow-card` | `0 1px 2px ink/4%, 0 2px 8px ink/4%` | `0 0 0 1px line` | Cards, inputs |
| `shadow-thumb` | `0 1px 3px ink/12%` | `0 0 0 1px #38383E` | Segmented thumb |
| `shadow-fab` | `0 4px 12px ink/16%, 0 1px 3px ink/12%` | `0 4px 16px black/50%` | FAB, snackbar |
| `shadow-menu` *(new)* | `0 8px 24px ink/12%, 0 1px 3px ink/8%` | `0 0 0 1px line, 0 8px 24px black/50%` | Context menu, lifted row |
| `shadow-sheet` | `0 −8px 32px ink/12%` | `0 0 0 1px line, 0 −8px 32px black/40%` | Sheets |

Borders: 1 px default, 2 px for checkbox outlines and focus rings only.

### 2.9 Layers

`base` 1 · `bar` 20 · `fab` 30 · `sheet` 40 · `menu` 45 *(new)* · `snackbar` 50. The snackbar sits
above sheets so undo works from inside a sheet.

### 2.10 Motion

Springs are defined once in `src/lib/motion.ts`; durations and easing in `tokens.css`.

| Token | Value | Use |
| --- | --- | --- |
| `spring.snappy` | stiffness 520, damping 38, mass 1 | Taps, toggles, checkbox, chips, snap-back after a cancelled swipe, snackbar |
| `spring.gentle` | stiffness 320, damping 32, mass 1 | Layout changes, list insert/remove, pushed screens, week change, progress |
| `spring.sheet` | stiffness 420, damping 40, mass 1 | Sheets and dialogs (no visible overshoot) |
| `--duration-fast` | 120 ms | Colour/opacity of hover and press states |
| `--duration-base` | 200 ms | Crossfades (tab switch uses 160 ms `fade`) |
| `--duration-slow` *(new)* | 320 ms | Completed-row hold before collapse |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | All CSS transitions |
| `press` | scale 0.97 (grid cells 0.96, FAB 0.94) with `snappy` | Every pressable |
| Long-press | 450 ms; row scales to 0.98 while held | Context menus |

Choreography:

| Moment | Motion |
| --- | --- |
| Tab switch | Content crossfade 160 ms; no slide (tabs are peers). |
| Push screen | New screen x 24 → 0 + fade, `gentle`; back reverses. |
| Sheet | y 100 % → 0, `sheet`; scrim fade; on ≥ 640 px scale 0.96 → 1 + fade. Dragging follows the finger 1:1 with 0.7 elastic below; release > 120 px or > 600 px/s closes. |
| Complete a task | Check path draws (180 ms), box pulses 1 → 0.82 → 1, row holds `--duration-slow`, then collapses (height → 0, `gentle`) and neighbours move up (layout). |
| Swipe | Row follows the finger; action icon scales 1 → 1.15 at the threshold with a haptic; release commits (row slides out) or snaps back (`snappy`). |
| Next-up change | Old card scales to 0.97 and fades; new card y 8 → 0 + fade (`gentle`, popLayout). |
| Week change | Grid x ±24 + fade in the direction of travel (`gentle`). |
| Current-lesson progress | scaleX on a 4 px bar, updated each minute (`gentle`). |
| FAB | Scale 0.6 → 1 + fade on enter; lifts by snackbar height + 8 while a snackbar is shown. |
| Import | Icon tile rocks ±6° on a 1.6 s loop while working. |

**Reduced motion** (`prefers-reduced-motion: reduce`, via `<MotionConfig reducedMotion="user">` and a
CSS override): every transform animation becomes an opacity crossfade of ≤ 120 ms or an instant
change; loops (import tile) stop; layout moves are instant; the checkbox still fills (state change,
not motion). Direct manipulation still tracks the finger (it's user-driven), but releases settle
without spring travel.

### 2.11 Icons

One custom line set (`src/components/Icon.tsx`), 24 px grid, 1.75 px stroke (2 px when active in
the tab bar), round caps and joins. Sizes: 16 (inline with small text), 20 (buttons), 24 (default),
32 (onboarding tiles). Icons never carry meaning alone: icon-only buttons have `aria-label` and a
tooltip (`title`) on pointer devices.

### 2.12 Haptics

Native only (`@capacitor/haptics`), silent on web: *selection* on tab change and segmented
changes; *light impact* on completing a task; *medium impact* when a swipe crosses its threshold and
when a long-press menu opens; *success* when an import finishes. Never on scroll or on every key.

---

## 3. Components

Every interactive component: ≥ 44 × 44 px target, visible `:focus-visible` ring (2 px `accent`,
2 px offset), pointer `hover` styles only under `(hover: hover)`, `press` scale, disabled = 40 %
opacity and no press feedback. States below list only what differs.

### Button
Anatomy: optional 20 px icon + label, `md` radius, 16 px horizontal padding.

| Variant | Rest | Hover | Pressed | Use |
| --- | --- | --- | --- | --- |
| `primary` | `accent` fill, `accent-fg` 600 | — | scale 0.97 | The one primary action |
| `secondary` | `surface-2`, `ink` 500 | `surface-3` | scale 0.97, `surface-3` | Secondary actions (Mark done on Next up) |
| `ghost` | transparent, `ink-2` | `surface-2` | `surface-2` | Tertiary (Start empty, Cancel) |
| `danger` | transparent, `danger` | `danger-soft` | `danger-soft` | Delete, Erase |

Sizes: `md` 44 min-height, `lg` 48 (sticky footers, onboarding). **Loading**: label stays, icon
becomes a 20 px spinner, width locked, `aria-busy`. **Two-step** (Erase everything): first tap turns
the label into "Tap again to erase everything" for 4 s.

### IconButton
44 × 44 round hit area, 24 px icon, `ink-2` (or `accent` tone), `surface-2` on hover/press,
`aria-label` + `title` required.

### Chip
36 px visible pill inside a 44 px hit target, `full` radius, `small` 500, 16 px padding.

| State | Look |
| --- | --- |
| Default | `surface-2`, `ink-2` |
| Hover | `surface-3` |
| Selected | `accent-soft`, `accent` text, `aria-pressed="true"` |
| Selected (subject) | `subj-bg`, `subj-fg`, leading 8 px `subj-dot` |
| **Token** (quick add) | Leading glyph (kind shape or subject dot) + value + chevron. *Empty*: placeholder in `ink-3` with `+`. *Open*: 2 px `accent` outline, chevron up, `aria-expanded="true"`; its option row appears below. |
| Removable (topics) | Trailing 20 px ✕ with its own 44 px target, `aria-label="Remove Mitosis"` |

### Segmented control
`surface-2` track, `md` radius, sliding `surface` thumb with `shadow-thumb` (shared-layout
animation, `snappy`). Selected label `ink` 600, others `ink-2`. Semantics: `radiogroup`; arrow keys
move selection. Full width in cards; segments never shrink below 44 px.

### Swatch
32 px circle in a 44 px target; selected = 2 px `ink` ring at 2 px offset plus a check in the
swatch's fg colour. Accent swatches: 8 in **two rows of four** below 400 px width (eight 44 px
targets don't fit a 311 px card row), one row of eight otherwise. Subject swatches: 11 presets
(+ current custom hue), wrapping rows of six. `radiogroup` semantics with colour names as labels.

### Checkbox
24 px visual, 44 px target, 2 px `line-strong` outline. **Circle** for homework and assignments,
**rounded square** (`xs`) for tests. Checked: `accent` fill, `accent-fg` check drawn. Hover: outline
`ink-2`. `role="checkbox"`, label = task label ("Mark Math ex. 4–7 done").

### Text field
48 px min height, `md` radius, `surface` (on `bg`) or `surface-2` (on `surface`), 16 px text,
`ink-3` placeholder, label above in `small` 500 `ink-2`. Focus: 2 px `accent` ring. Invalid:
1 px `danger` outline + message below (`small`, `danger`, leading alert icon), `aria-invalid`,
`aria-describedby`. Growing variant (manual builder, notes) grows with content up to 8 lines.

### Stepper
`[ − ] value [ + ]`: two 44 px IconButtons and a `tabular` value; `role="spinbutton"` on the value
with arrow-key support, min/max disable the buttons. Used for lesson length, sessions, daily cap.

### Card
`surface`, `lg` radius, `shadow-card`, 16 px padding, `overflow: hidden` so rows can bleed to the
edges. **Pressable** variant: whole card is one button; pressed = `surface-2` + scale 0.98.
Grouped rows inside a card are separated by 1 px `line` hairlines inset to the text.

### ListRow (with swipe actions)
Anatomy: leading control (44 px checkbox or 8 px subject dot), content (title `body` 500; meta line
`small` `ink-2`: subject dot + name · due), trailing meta (`small` `tabular`: steps "2/5", attachment
glyph, kind badge). Min height 56. Separators inset to the content column.

| State | Behaviour |
| --- | --- |
| Rest / hover / pressed | `surface` / `surface-2` / `surface-2` |
| Focus-visible | Inset 2 px `accent` ring |
| Overdue | Due text `danger` and prefixed "Overdue ·" |
| Done | Checkbox checked; title and meta `ink-3`; no strike-through |
| Dragging → right | `accent` fill revealed under the row with ✓ + "Done" in `accent-fg`. Threshold: 96 px or 35 % of width. Release past it completes. |
| Dragging ← left | Reveals two 88 px actions: **Next lesson** (`surface-3`, `ink`, shows the target date) and **Delete** (`danger`, `danger-fg`). Release past 40 % keeps them open; past 70 % deletes. Tap outside closes. |
| Axis lock | Horizontal only after 8 px of travel with \|dx\| > 1.5 × \|dy\|; touches starting within 24 px of the left screen edge are ignored (iOS back gesture). |
| Long-press | 450 ms → row lifts (`shadow-menu`, scale 1.02) and the context menu opens. |
| Disabled swipe | Inside sheets and while a row is being edited. |

Every swipe action is also available from the checkbox, the context menu and the detail sheet
(WCAG 2.5.1 / 2.5.7).

### Context menu
Popover anchored to the pressed element (above or below, whichever fits; full-width bottom action
sheet when neither fits). `surface`, `lg` radius, `shadow-menu`, 48 px rows with 20 px icon + label;
destructive items last, in `danger`, after a hairline. Scrim 20 %. Opens on long-press, right-click,
the **Menu** key or Shift + F10. Arrow keys move, Enter selects, Escape closes and returns focus.
`role="menu"` / `menuitem`.

### Sheet
Bottom sheet on phones, centred dialog (`3xl` radius, max-width 560) at ≥ 640 px. Anatomy: drag
handle (40 × 4, `line`), eyebrow (`caption` uppercase `ink-3`), title (`title` 600), close
IconButton, scrolling content, optional sticky footer (primary button, `pb-safe`).

| State | Behaviour |
| --- | --- |
| Opening / closing | `spring.sheet`; scrim fades |
| Dragging | Only from the handle/header; elastic below; closes past 120 px or 600 px/s |
| Keyboard open | Lifts by the on-screen keyboard inset (`visualViewport`), footer stays above the keyboard |
| Content height | Quick add, menus, small forms: fit content. Details: open at 90 dvh. |
| Focus | Trapped; first `[data-autofocus]` or the panel gets focus; focus returns to the trigger |
| Dismiss | Swipe down, scrim tap, Escape, Android back, close button. Never loses typed text (§5.6). |

### TabBar
Four items — **Today, Week, Tasks, Settings** — icon (24 px) over label (`caption` 500), 56 px +
safe area, `bar` background with blur and a top hairline. Active: `accent` icon (2 px stroke) and
label, `aria-current="page"`. Inactive: `ink-3`. No badges. Re-tap the active tab: pop to its
root; at the root, scroll to top. At ≥ 900 px: a 72 px left rail with the same items stacked.

### FAB
56 px `accent` circle, 24 px plus in `accent-fg`, `shadow-fab`, bottom-right above the tab bar.
Hidden on Settings and while a sheet is open. Tap → Quick add. Long-press → menu *Homework ·
Assignment · Test* (opens Quick add with that kind, §4.11). `aria-label="Add homework, assignment or
test"`. Lifts above a visible snackbar.

### EmptyState
48 px `accent-soft` circle with a 24 px `accent` icon, title (`lead` 600), body (`small` `ink-2`,
max 320 px), optional secondary button. Inline (inside a card, 32 px vertical padding) or full
(vertically centred in the screen). Copy in §6.

### Snackbar
`ink` fill with `bg` text (17:1), `lg` radius, `shadow-fab`, min height 48, max width 400, centred
above the tab bar (above the sheet footer when a sheet is open). Message `small`; optional action
button (`small` 600, 44 px target).

| State / type | Behaviour |
| --- | --- |
| Enter / exit | y 16 → 0 + fade (`snappy`) / y 8 + fade |
| Visible | 6 s timer (`SNACKBAR_MS`) |
| Paused | While hovered, focused or pressed; resumes 2 s after |
| Replace | A new snackbar replaces the current one; the replaced undo stays available via ⌘/Ctrl-Z |
| Undo | "Done · Undo", "Deleted · Undo", "Moved to Mon · Undo" |
| Offer | Contextual next step: "Test added · Plan studying"; once, for the first test or assignment on a native build with reminders off, "Remind me the day before" instead |
| Error | Leading alert icon, no auto-dismiss for storage errors, action "OK" |

`role="status"` (`aria-live="polite"`); errors use `role="alert"`.

### Banner
Full-width card-like strip for persistent context: holiday (`surface-2`, ◌ icon, "Autumn break —
back Mon 2 Nov"), import error (`danger-soft`, alert icon, `role="alert"`), install prompt
(`surface`, download icon, chevron). One banner per screen at most.

### DatePicker (sheet)
Header title names the purpose ("Due date", "Holiday starts"). Quick chips row: *Next lesson* (when
a subject is known), *Tomorrow*, *Next week* (the subject's first lesson next week, else Monday —
same as typing "next week", SPEC R-12). Month header with previous/next IconButtons and the
month name (`lead`). Weekday row (Monday first). 6 × 7 grid of 44 × 44 day cells.

| Cell state | Look |
| --- | --- |
| Default | `body` `tabular`, `ink` |
| Outside month | not rendered (blank) |
| Past | `ink-3` (still selectable, E-24) |
| Today | 2 px `accent` ring |
| Selected | `accent` fill, `accent-fg` text |
| Holiday | Diagonal hatch (`line` 1 px stripes at 45°, 6 px apart), number `ink-3`; name in the accessible label |
| Lesson of the subject | 4 px `subj-dot` dot under the number |
| Test due | 6 px `ink` square marker beside the lesson dot |
| Load | Heat bar (§2.4) at the bottom of the cell |

Choosing a date closes the sheet, unless the subject has lessons that day: then a **lesson row**
appears (`P5 · 11:25` chips + *End of day*) and choosing one closes. Keyboard: arrows move by day,
Page Up/Down by month, Home/End to week start/end, Enter selects, Escape closes (APG date-picker
dialog). Grid `role="grid"`, cells `role="gridcell"` with full labels ("Thursday 15 October,
Biology lesson, test due, light load").

### TimePicker
Two 2-digit fields `HH : MM` (`inputmode="numeric"`, 48 px tall, 56 px wide, `title` size, tabular)
inside a `role="group"` labelled by its row ("Starts"). Typing two digits advances to minutes;
↑/↓ change by 1 (hours) or 5 (minutes); invalid values show the text-field invalid state ("Ends
before it starts"). In 12-hour locales a segmented AM/PM follows. A **suggestion row** offers
likely times (the end of the previous period, +5, +10 min). Native `<input type="time">` is not
used: its rendering, step behaviour and 12/24 h handling differ per platform and cannot be styled
to the tokens.

### Other primitives
- **SubjectTag**: 8 px `subj-dot` + subject name (`small` `ink-2`).
- **KindBadge**: `caption` 600 uppercase `ink-3`, preceded by ○ (homework/assignment) or ■ (test).
- **Grid columns**: row-header column 40 px in Week (read-only) and 44 px in the review grid and
  timetable editor, where period headers are buttons; day columns share the rest with 4 px gaps and
  never drop below 44 px — otherwise the grid scrolls horizontally (SPEC E-29).
- **LessonCell** (Week): `subj-bg` fill, `subj-fg` text, `md` radius, min height 56, 8 px padding;
  abbreviation on phones, full name (2 lines) at ≥ 640 px; room in `caption`; up to three task
  markers at the bottom (hollow circle / filled square in `subj-fg`). Current lesson: 2 px `accent`
  ring with 2 px `bg` offset. Spanning lessons fill their rows plus the gaps between.
- **HolidayColumn**: hatched block spanning all period rows; the holiday name in `caption` `ink-3`,
  set vertically (`writing-mode: vertical-rl`) so it fits narrow columns.
- **HeatBar**: §2.4.
- **ProgressBar**: 4 px track (`accent` @ 20 %), fill `accent`, `role="progressbar"`.
- **ScreenHeader**: large title that hands over to a compact blurred bar once scrolled away;
  eyebrow above the title; trailing actions.
- **SectionLabel**: `caption` 600 uppercase `ink-3`, 8 px below, 32 px above (section gap).

---

## 4. Screens

Phone frames are 42 columns ≈ 375 pt. Letters in the right margin refer to the notes under each
frame. Example data is one consistent scenario: **Thursday 8 October 2026, 09:50, Week A**; a
teacher-training day on Monday 5 October; autumn break 26–30 October.

### 4.1 Welcome

```
┌─ Welcome ────────────────────────────────┐
│                       ┌────┬────┬────┐   │ (a)
│                       │ EN │ MK │ DE │   │
│                       └────┴────┴────┘   │
│                                          │
│  ┌──────┐                                │
│  │  ▦   │                                │ (b)
│  └──────┘                                │
│  TERM                                    │ (c)
│  Your school week,                       │
│  sorted.                                 │ (d)
│                                          │
│  Add your timetable once. Homework and   │
│  tests fall into place.                  │ (e)
│                                          │
│                                          │
│┌────────────────────────────────────────┐│
││            Add my timetable            ││ (f)
│└────────────────────────────────────────┘│
│              Start empty                 │ (g)
└──────────────────────────────────────────┘
```
(a) Language segmented, preselected from the device. (b) 64 px `accent` tile with the app glyph.
(c) Wordmark, `caption` `ink-3`. (d) `display`. (e) `lead` `ink-2`. (f) The one primary action.
(g) Ghost: skips to an empty *Today* whose "Add your timetable" card brings the flow back.

### 4.2 Upload flow

```
┌─ Upload flow 1 · Method ─────────────────┐
│‹                                         │ (a)
│How should we add it?                     │ (b)
│Takes about a minute.                     │
│                                          │
│┌────────────────────────────────────────┐│
││ ┌────┐ Photo, screenshot or PDF      › ││ (c)
││ │ ▣  │ Read on this phone              ││
││ └────┘                                 ││
│└────────────────────────────────────────┘│
│┌────────────────────────────────────────┐│
││ ┌────┐ Type it in                    › ││
││ │ Aa │ One line per day                ││
││ └────┘                                 ││
│└────────────────────────────────────────┘│
│┌────────────────────────────────────────┐│
││ ┌────┐ Calendar or backup file       › ││ (d)
││ │ ↓  │ .ics or a TERM backup           ││
││ └────┘                                 ││
│└────────────────────────────────────────┘│
│                                          │
│✓ Photos are read on this phone and       │ (e)
│  never uploaded.                         │
└──────────────────────────────────────────┘
```
(a) Back to Welcome (first run) or closes the flow (later). (b) `large`. (c) Primary option: `accent`
tile; opens the system picker (camera, library, files; `accept="image/*,application/pdf,.ics,.json"`).
(d) Calendar/backup import routes by file type (SPEC F-12). (e) Privacy promise, `small` `ink-3`.

```
┌─ Upload flow 1b · Method with error ─────┐
│‹                                         │
│How should we add it?                     │
│Takes about a minute.                     │
│                                          │
│┌────────────────────────────────────────┐│
││ ! We couldn't find a timetable in that ││ (a)
││   picture. Try a sharper, straight-on  ││
││   photo — or type it in.               ││
│└────────────────────────────────────────┘│
│                                          │
│┌────────────────────────────────────────┐│
││ ┌────┐ Photo, screenshot or PDF      › ││
│  …  (options as above)                   │
└──────────────────────────────────────────┘
```
(a) `danger-soft` banner, `role="alert"`, reason-specific copy (§6): unsupported file, no timetable
found, could not read. Focus moves to the banner.

```
┌─ Upload flow 2 · Importing ──────────────┐
│                                          │ (a)
│                                          │
│                                          │
│               ┌────────┐                 │
│               │   ▣    │                 │ (b)
│               └────────┘                 │
│            Reading the text…             │ (c)
│        ━━━━━━━━━━━━━━━━────────          │ (d)
│       Step 2 of 3 · on this phone        │ (e)
│                                          │
│                                          │
│                                          │
│                                          │
│                 Cancel                   │ (f)
└──────────────────────────────────────────┘
```
(a) No back button: Cancel is the only exit. (b) 64 px `accent-soft` tile; rocks ±6° (static under
reduced motion). (c) Phase title, announced once per phase: *Opening the file → Reading the text →
Arranging your week*. (d) Determinate during OCR, indeterminate otherwise. (e) Reassurance line.
(f) Ghost Cancel aborts the worker immediately.

```
┌─ Upload flow 3 · Smart reading consent ──┐
│──                                        │ (a)
│Read it with smart reading?            ✕  │
│                                          │
│Your photo is sent to TERM's reader,      │
│turned into a timetable and deleted.      │
│Nothing is kept. Needs internet.          │ (b)
│                                          │
│┌────────────────────────────────────────┐│
││           Use smart reading            ││ (c)
│└────────────────────────────────────────┘│
│             Not now                      │
└──────────────────────────────────────────┘
```
Only exists when the cloud parser is enabled at build time (SPEC F-1, D-007). (a) Opened from the
review banner *Some cells look unsure — Try smart reading*. (b) Plain-language data statement.
(c) Primary sends one downscaled, EXIF-stripped image; result replaces the draft (undoable).

### 4.3 Import review grid

```
┌─ Import review grid ─────────────────────┐
│‹                                         │
│Check your week                           │ (a)
│31 lessons · 9 subjects · 2 unsure        │ (b)
│┌────────────────────┬───────────────────┐│ (c)
││       Week A       │      Week B       ││
│└────────────────────┴───────────────────┘│
│This week is      ( A )  B                │ (d)
│ Mo  Tu  We  Th  Fr  Sa  Su               │ (e)
│      MON   TUE   WED   THU   FRI         │
│    ┌─────┬─────┬─────┬─────┬─────┐       │
│1   │Math │Engl │Bio  │Math │PE   │       │ (f)
│8:00│ R4  │     │     │     │     │       │
│    ├─────┼─────┤     ├─────┼─────┤       │ (g)
│2   │Math │Ger ?│     │Chem │Art  │       │ (h)
│8:50│     │┄┄┄┄┄│     │ R12 │     │       │
│    ├─────┼─────┼─────┼─────┼─────┤       │
│3   │Engl │PE   │     │Bio  │Hist │       │ (i)
│9:45│     │     │     │     │     │       │
│    └─────┴─────┴─────┴─────┴─────┘       │
│ + Add period                             │ (j)
│                                          │
│┌────────────────────────────────────────┐│
││               Looks good               ││ (k)
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
(a) `large`. (b) Summary; "2 unsure" is a button that focuses the first unsure cell. (c) Rotation
weeks segmented — only when the draft has 2+ weeks. (d) Anchor question, only when rotating.
(e) Day toggles (chips), at least one stays on. (f) Lesson cells use the subject pastels exactly as
they will be saved. (g) Wednesday Biology spans periods 1–2: one cell, no divider. (h) Unsure cell:
dashed `line-strong` outline + "?" glyph, `aria-label` "German, unsure — check this". (i) Empty cell
= free period. (j) Adds a period continuing the rhythm of the last one (same length, 5-min break).
(k) Saves (SPEC F-1.5). When another timetable already exists, a *Starts* date row sits above the
grid (SPEC F-1).
Tap a period number/time → period sheet; tap a cell → cell sheet. On 7-day weeks below 420 px the
grid scrolls horizontally (E-29).

```
┌─ Review / editor · Cell sheet ───────────┐
│──                                        │
│Tuesday · Period 2 · 8:50–9:35         ✕  │ (a)
│Subject                                   │
│┌────────────────────────────────────────┐│
││ German▏                                ││ (b)
│└────────────────────────────────────────┘│
│ German   Geography   Greek   + New       │ (c)
│Room                                      │
│┌──────────────┐                          │
││ 14           │                          │
│└──────────────┘                          │
│Length        [ − ]  1 period  [ + ]      │ (d)
│Same in both weeks                 ( ●○ ) │ (e)
│                                          │
│┌────────────────────────────────────────┐│
││                  Done                  ││
│└────────────────────────────────────────┘│
│           Clear this lesson              │ (f)
└──────────────────────────────────────────┘
```
(a) Context as the sheet title. (b) Autofocused field with suggestions from existing and draft
subjects. (c) Suggestion chips; *+ New* creates the typed name. (d) Stepper sets `span` (1–4,
bounded by the remaining periods). (e) Only when rotating: copies the cell into every week.
(f) Danger ghost; clears the cell (undo via snackbar).

```
┌─ Review / editor · Period sheet ─────────┐
│──                                        │
│Period 2                               ✕  │
│Starts         ┌────┐   ┌────┐            │
│               │ 08 │ : │ 50 │            │ (a)
│               └────┘   └────┘            │
│Ends           ┌────┐   ┌────┐            │
│               │ 09 │ : │ 35 │            │
│               └────┘   └────┘            │
│ 45 min lesson · 5 min break before       │ (b)
│ 8:45   8:50   8:55                       │ (c)
│                                          │
│┌────────────────────────────────────────┐│
││                  Done                  ││
│└────────────────────────────────────────┘│
│             Remove period                │ (d)
└──────────────────────────────────────────┘
```
(a) TimePicker. (b) Derived facts, live. (c) Suggestion chips for the start time. (d) Removes the
period and its lessons (E-21), undoable.

### 4.4 Manual builder

```
┌─ Manual builder ─────────────────────────┐
│‹                       Weeks differ ( ○) │ (a)
│Type your week                            │
│One subject per lesson, commas between.   │
│                                          │
│Monday                                    │
│┌────────────────────────────────────────┐│
││ Math, English, Biology, Biology, PE    ││
│└────────────────────────────────────────┘│
│Tuesday                                   │
│┌────────────────────────────────────────┐│
││ English, Chem▏                         ││ (b)
│└────────────────────────────────────────┘│
│Wednesday                                 │
│┌────────────────────────────────────────┐│
││                                        ││
│└────────────────────────────────────────┘│
│  … Thursday, Friday                      │
│+ Saturday                                │ (c)
│                                          │
│┌────────────────────────────────────────┐│
││                Continue                ││ (d)
│└────────────────────────────────────────┘│
│╶─ above the keyboard ───────────────────╴│
│ Chemistry   Math   English   Biology   › │ (e)
└──────────────────────────────────────────┘
```
(a) Switch: duplicates the fields per rotation week with a *Week A | Week B* segmented under the
title. (b) Focused field; Enter moves to the next day, Enter on the last day continues. (c) Adds
Saturday (then Sunday). (d) Primary, enabled once any day has text; sticky above the keyboard.
(e) Keyboard accessory row: subjects typed so far, tap to insert at the cursor followed by ", ".
Pasting multi-line text into any field parses the whole week and jumps to review.

### 4.5 Today

```
┌─ Today · school day ─────────────────────┐
│Thursday, 8 October · Week A              │ (a)
│Today                                     │ (b)
│                                          │
│NEXT UP                                   │
│┌────────────────────────────────────────┐│
││ ● German   HOMEWORK                    ││ (c)
││ Vocab list 3                           ││
││ Overdue · yesterday                    ││ (d)
││                                        ││
││ ┌───────────────┐                      ││
││ │  ✓ Mark done  │                      ││ (e)
││ └───────────────┘                      ││
│├────────────────────────────────────────┤│
││ THEN                                   ││
││ ● Worksheet p. 12                11:25 ││ (f)
││ ● Study: Mitosis · 25 min        17:00 ││
│└────────────────────────────────────────┘│
│                                          │
│TODAY'S LESSONS                           │
│┌────────────────────────────────────────┐│
││  8:00 ▌ Math          R4               ││ (g)
││  8:50 ▌ English                        ││
││  9:45 ▌ Chemistry     R12        NOW   ││ (h)
││ ━━━━━━━━━━━━━━━━━━━─────────────────── ││
││ 10:35   Free · 45 min                  ││ (i)
││ 11:25 ▌ Biology  11:25–13:00        ○  ││ (j)
││         Worksheet p. 12                ││
│└────────────────────────────────────────┘│
│                                          │
│COMING UP                                 │
│┌────────────────────────────────────────┐│
││ TUE  Geography test              TEST  ││ (k)
││ 13   ● Geography                       ││
│├────────────────────────────────────────┤│
││ THU  Bio test on cell division   TEST  ││
││ 15   ● Biology                         ││
│├────────────────────────────────────────┤│
││ FRI  History essay         ASSIGNMENT  ││
││ 16   ● History                         ││
│└────────────────────────────────────────┘│
│                                    ┌───┐ │
│                                    │ + │ │ (l)
│                                    └───┘ │
│──────────────────────────────────────────│
│  [▣]       [▦]       [☰]       [◎]       │ (m)
│ Today      Week     Tasks    Settings    │
└──────────────────────────────────────────┘
```
(a) Eyebrow: full date; rotation label only when rotating. (b) `large`; compacts into the blurred
bar on scroll. (c) Next-up card: subject tag + kind badge, title (`title`), due line. (d) Overdue:
`danger` + the word "Overdue". (e) Secondary *Mark done*: the card's only button (FAB stays the
screen's primary). (f) *Then*: two compact rows, tap opens detail; the worksheet due at 11:25 ranks
above the study session, which ranks at the preferred study time (17:00, SPEC R-8). (g) Past lessons in `ink-3`. (h) Current lesson: `accent-soft` row, *NOW* pill, 4 px
progress along the bottom, `aria-current="time"`. (i) Free period between lessons (E-5), not
pressable. (j) Double lesson as one row with its time range; ○/■ markers and task titles for work
due in it. (k) Coming up: date block, title, subject; kind badge; a *Show all* row appears after
six items. (l) FAB. (m) Tab bar.

```
┌─ Today · other states ───────────────────┐
│Holiday                                   │ (a)
│┌────────────────────────────────────────┐│
││ ◌  Autumn break                        ││
││    Back on Monday, 2 November          ││
│└────────────────────────────────────────┘│
│After the last lesson                     │ (b)
│LESSONS · FRIDAY                          │
│Done for today.                           │
│┌────────────────────────────────────────┐│
││  8:00 ▌ Math          R4            ○  ││
││  …                                     ││
│└────────────────────────────────────────┘│
│No timetable                              │ (c)
│┌────────────────────────────────────────┐│
││                ┌────┐                  ││
││                │ ▦  │                  ││
││                └────┘                  ││
││          Add your timetable            ││
││   Homework and tests fall into place   ││
││       once TERM knows your week.       ││
││          ┌─────────────────┐           ││
││          │ + Add timetable │           ││
││          └─────────────────┘           ││
│└────────────────────────────────────────┘│
│All clear                                 │ (d)
│┌────────────────────────────────────────┐│
││                ┌────┐                  ││
││                │ ✦  │                  ││
││                └────┘                  ││
││               All clear                ││
││    Nothing due. Enjoy it — or add      ││
││        what's coming with +.           ││
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
(a) Holiday banner replaces the lessons section; Next up still shows (holiday homework). (b) After
the last lesson: the next school day's lessons with a one-line reason. (c) No timetable (also
"Timetable ended" and "School starts Tue 1 Sep" variants with the same layout). (d) Nothing open.

### 4.6 Week

```
┌─ Week ───────────────────────────────────┐
│5 – 9 October · Week A ▾                  │ (a)
│Week                                      │
│‹               5 – 9 Oct               › │ (b)
│      MON   TUE   WED   THU   FRI         │
│       5     6     7    (8)    9          │ (c)
│      Off               ━━    ━           │ (d)
│    ┌─────┬─────┬─────┬─────┬─────┐       │
│1   │░░░░░│Engl │Bio  │Math │Math │       │ (e)
│8:00│░░T░░│     │     │ R4  │    ○│       │ (f)
│    │░░e░░├─────┤     ├─────┼─────┤       │ (g)
│2   │░░a░░│Ger  │     │Engl │PE   │       │
│8:50│░░c░░│     │     │     │     │       │
│    │░░h░░├─────┼─────┼─────┼─────┤       │
│3   │░░e░░│PE   │     │◉Chem│Hist │       │ (h)
│9:45│░░r░░│     │     │ R12 │     │       │ (i)
│    └─────┴─────┴─────┴─────┴─────┘       │
│                                    ┌───┐ │
│                                    │ + │ │
│                                    └───┘ │
└──────────────────────────────────────────┘
```
(a) Eyebrow range + rotation label; the label is a button → menu *This is week B* (E-12). (b) Week
navigation; *Today* appears between the arrows when not on the current week; horizontal swipe on
the grid also changes week (not from the screen edge). (c) Today's date in an `accent` pill.
(d) Load row: heat bars per day; past days show none; a holiday shows "Off". (e) Monday is a holiday:
hatched column with the name set vertically ("Teacher training"). (f) ○ = open homework due in that
lesson (Math ex. 4–7). (g) Wednesday's double Biology. (h) Current lesson ringed in `accent` (◉).
(i) Room in `caption`. Tap a lesson → lesson sheet. Long-press → menu below.

```
┌─ Week · Lesson sheet ────────────────────┐
│──                                        │
│MONDAY 12 OCT · 9:45–10:30 · R12          │ (a)
│● Chemistry                            ✕  │
│Week B · Mr. Novak                        │
│                                          │
│DUE THIS LESSON                           │
│○  Lab report draft             Homework  │ (b)
│                                          │
│┌────────────────────────────────────────┐│
││         + Add for this lesson          ││ (c)
│└────────────────────────────────────────┘│
│               Edit lesson                │ (d)
└──────────────────────────────────────────┘
```
(a) Eyebrow: date, time, room. Title: subject (scoped pastel dot). Meta: rotation week and teacher.
(b) Tasks due in this occurrence (R-7), checkable. (c) Primary: opens Quick add preset with this
subject and this occurrence as due. (d) Ghost → timetable editor focused on this cell.

```
┌─ Week · Long-press menu on a lesson ─────┐
│    ┌─────┬─────┬─────┬─────┐             │
│    │Engl │Bio  │Math │Math │             │ (a)
│    └─────┴─────┴─────┴─────┘             │
│     ┌──────────────────────────┐         │
│     │ ○  Add homework          │         │ (b)
│     │ ■  Add test              │         │
│     │ ▦  Edit lesson           │         │
│     │ ●  Edit subject          │         │
│     └──────────────────────────┘         │
└──────────────────────────────────────────┘
```
(a) The pressed cell lifts. (b) Context menu (§3) with lesson actions.

### 4.7 Tasks

```
┌─ Tasks ──────────────────────────────────┐
│7 open                                    │ (a)
│Tasks                                     │
│                                          │
│OVERDUE                                   │ (b)
│┌────────────────────────────────────────┐│
││ ○  Vocab list 3                        ││
││    ● German · Yesterday                ││ (c)
│└────────────────────────────────────────┘│
│TODAY                                     │
│┌────────────────────────────────────────┐│
││ ○  Worksheet p. 12                2/5  ││ (d)
││    ● Biology · 11:25                   ││
│└────────────────────────────────────────┘│
│TOMORROW                                  │
│┌────────────────────────────────────────┐│
││ ○  Math ex. 4–7                        ││
││    ● Math · 8:00                       ││
│└────────────────────────────────────────┘│
│THIS WEEK                                 │
│┌────────────────────────────────────────┐│
││ ○  Lab report draft                ⎘   ││ (e)
││    ● Chemistry · Mon 9:45              ││
│├────────────────────────────────────────┤│
││ □  Geography test                      ││ (f)
││    ● Geography · Tue 10:35             ││
│└────────────────────────────────────────┘│
│LATER                                     │
│┌────────────────────────────────────────┐│
││ □  Bio test on cell division     0/5   ││ (g)
││    ● Biology · Thu 15 Oct              ││
│└────────────────────────────────────────┘│
│                                          │
│ ▸ Done · 14                              │ (h)
└──────────────────────────────────────────┘
```
(a) Count as eyebrow, `large` title. (b) Section labels per bucket (R-9); empty buckets are omitted.
(c) Overdue meta in `danger` with "Overdue" in the accessible name. (d) Steps progress.
(e) Attachment glyph. (f) Tests use the square checkbox. (g) Study progress for planned tests.
(h) *Done* collapsed; expands in place (last 30 days). A **Written** group (not in this scenario)
sits above *Done*: tests whose date has passed, trailing "Add result", never in `danger` (E-38).

```
┌─ Tasks · Row gestures ───────────────────┐
│Swipe right — complete                    │ (a)
│┌────────────────────────────────────────┐│
││▓▓▓▓▓▓▓▓▓ ✓ ○  Worksheet p. 12          ││
││▓▓▓▓▓▓▓▓▓      ● Biology · 11:25        ││
│└────────────────────────────────────────┘│
│Swipe left — actions                      │ (b)
│┌────────────────────────────────────────┐│
││ p. 12           │ Next lesson│  Delete ││
││ 11:25           │   Mon      │         ││
│└────────────────────────────────────────┘│
│Long-press — menu                         │ (c)
│     ┌──────────────────────────┐         │
│     │ ✓  Mark done             │         │
│     │ →  Next lesson · Mon     │         │
│     │ ☼  Tomorrow              │         │
│     │ ▦  Pick a date…          │         │
│     │ ◷  Plan studying         │         │ (d)
│     ├──────────────────────────┤         │
│     │ ✕  Delete                │         │ (e)
│     └──────────────────────────┘         │
└──────────────────────────────────────────┘
```
(a) Swipe right past the threshold completes (§3 ListRow). (b) Swipe left reveals *Next lesson*
(shows the target) and *Delete*. (c) Long-press menu; same items on right-click / Menu key.
(d) Only for tests and assignments; adds a plan with default settings, undoable. (e) Destructive
last, `danger`.

### 4.8 Task detail

```
┌─ Task detail (homework / assignment) ────┐
│──                                        │ (a)
│● Math · Homework                      ✕  │ (b)
│Math ex. 4–7▏                             │ (c)
│                                          │
│┌────────────────────────────────────────┐│
││ Due     Fri 9 Oct · 8:00 · Math      › ││ (d)
│├────────────────────────────────────────┤│
││ Kind     Homework · Assignment · Test  ││ (e)
│├────────────────────────────────────────┤│
││ Subject  ● Math                      › ││
│├────────────────────────────────────────┤│
││ Remind   Thu 18:00 · default         › ││ (f)
│└────────────────────────────────────────┘│
│STEPS · 1/3                               │ (g)
│○  Ex. 4                                  │
│✓  Ex. 5                                  │
│○  Ex. 6–7                                │
│+  Add step                               │
│NOTES                                     │
│┌────────────────────────────────────────┐│
││ Show working. p. 112                   ││ (h)
│└────────────────────────────────────────┘│
│ATTACHMENTS                               │
│┌──────┐ ┌──────┐ ┌──────┐                │
││ ▧    │ │ PDF  │ │  +   │                │ (i)
│└──────┘ └──────┘ └──────┘                │
│             Delete task                  │ (j)
│╶─ sticky footer ────────────────────────╴│
│┌────────────────────────────────────────┐│
││              ✓ Mark done               ││ (k)
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
(a) Full-height sheet (90 dvh); dialog on ≥ 640 px. (b) Eyebrow: subject + kind. (c) Title edits in
place (`title` size, no box until focused); empty title shows "Math homework" as placeholder.
(d) Due row → date picker; shows lesson and time. (e) Kind segmented; changing kind keeps the undo
snapshot (SPEC F-5). (f) Reminder row → per-task override sheet (hidden on web, D-011).
(g) Steps: checkbox rows, *+ Add step* inline field; drag handle to reorder (keyboard: ⌥/Alt + ↑/↓).
(h) Notes: growing text field, URLs linkified. (i) Attachment thumbnails (64 px, `sm` radius), *+*
opens camera/library/files. (j) Danger ghost at the end of the content. (k) Sticky primary. All
edits save as you type (debounced 300 ms); there is no Save button and no edit mode.

### 4.9 Test detail

```
┌─ Test detail (before the test) ──────────┐
│──                                        │
│● Biology · Test                       ✕  │
│Bio test on cell division                 │
│Thu 15 Oct · 11:25 · in 7 days            │ (a)
│                                          │
│┌────────────────────────────────────────┐│
││ Due     Thu 15 Oct · 11:25 · Biology › ││
│├────────────────────────────────────────┤│
││ Remind   Mon & Wed 18:00 · default   › ││
│└────────────────────────────────────────┘│
│TOPICS                                    │
│ Mitosis ✕   Meiosis ✕   + Topic          │ (b)
│STUDY PLAN · 0/5 · 25 min      Re-plan    │ (c)
│○  Thu 8    Study: Mitosis       Today    │ (d)
│○  Sun 11   Study: Meiosis                │
│○  Mon 12   Study: Mitosis                │
│○  Tue 13   Study: Meiosis                │
│○  Wed 14   Full review                   │
│STEPS · NOTES · ATTACHMENTS               │ (e)
│  …                                       │
│╶─ sticky footer, only without a plan ───╴│
│┌────────────────────────────────────────┐│
││            Plan my studying            ││ (f)
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
(a) Countdown in the subtitle ("in 7 days", "tomorrow", "Overdue"). (b) Topic chips (removable) +
add chip; topics name the study sessions. (c) Plan header with progress and *Re-plan* (ghost).
(d) Sessions are steps with dates; today's is marked "Today" and also appears in *Next up*.
(e) Same sections as Task detail. (f) Sticky primary **only when there is no plan**; with a plan
the sheet has no footer (the sessions are the actions).

```
┌─ Test detail (after the test) ───────────┐
│──                                        │
│● Biology · Test                       ✕  │
│Bio test on cell division                 │
│Thu 15 Oct · written                      │ (a)
│                                          │
│RESULT                                    │
│┌──────────────┐ ┌───────┐   ┌───────┐    │
││ Grade   5    │ │  42   │ / │  50   │    │ (b)
│└──────────────┘ └───────┘   └───────┘    │
│┌────────────────────────────────────────┐│
││ Note                                   ││
│└────────────────────────────────────────┘│
│STUDY PLAN · 5/5 · 25 min                 │
│  …                                       │
│╶─ sticky footer ────────────────────────╴│
│┌────────────────────────────────────────┐│
││              Save result               ││ (c)
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
After the due moment: (a) subtitle "written" — never "overdue". (b) Result fields: grade (free
text), score / out of (numeric). (c) Saving records the result and marks the test done (SPEC F-13);
the sheet is reached from the *Written* group in Tasks.

### 4.10 Study-plan preview

```
┌─ Study-plan preview sheet ───────────────┐
│──                                        │
│Plan for Biology test                  ✕  │
│5 sessions · 25 min · test Thu 15 Oct     │ (a)
│                                          │
│  MO   TU   WE   TH   FR   SA   SU        │
│   5    6    7   (8)   9   10   11        │ (b)
│                  ●              ●        │ (c)
│                 ━━   ━         ━         │ (d)
│  12   13   14   15   16   17   18        │
│   ●    ●    ●    ■                       │ (e)
│  ━━   ━━━  ━━   ━    ━                   │
│  19   20   21   22   23   24   25        │
│                                          │
│Session length   15 · (25) · 45 · 60      │ (f)
│Sessions            [ − ]  5  [ + ]       │
│                                          │
│┌────────────────────────────────────────┐│
││                Add plan                ││ (g)
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
(a) Summary updates live as controls change. (b) Three weeks from the current week; today ringed.
(c) ● proposed sessions (`accent`), tap a day to add/remove a session manually. (d) Heat bars
include the proposed sessions. (e) ■ the test day. (f) Session length segmented and session count
stepper regenerate the proposal (R-11). (g) Primary adds the sessions as steps; undo via snackbar.

### 4.11 Quick add

```
┌─ Quick add ──────────────────────────────┐
│──                                        │ (a)
│┌────────────────────────────────────────┐│
││ Bio test on cell division thursday▏    ││ (b)
│└────────────────────────────────────────┘│
│┌────────┐ ┌────────────┐ ┌──────────────┐│
││■ Test ▾│ │● Biology ▾ │ │Thu 15 11:25 ▾││ (c)
│└────────┘ └────────────┘ └──────────────┘│
│                                          │
│┌────────────────────────────────────────┐│
││                  Add                   ││ (d)
│└────────────────────────────────────────┘│
│══════════════ keyboard ══════════════════│
└──────────────────────────────────────────┘
```
(a) Content-height sheet, keyboard open immediately. (b) Single field, `aria-label` "What do you
need to do?", placeholder "e.g. math ex 4–7 friday". (c) Token chips show what was understood,
updating as you type (no flicker: a chip changes only when the parse result changes). (d) Primary;
Enter adds. After adding, the sheet closes and a snackbar confirms ("Added for Thu 15 · Undo"; tests
and assignments: "Test added · Plan studying").

```
┌─ Quick add · due chip open ──────────────┐
│──                                        │
│┌────────────────────────────────────────┐│
││ Bio test on cell division▏             ││
│└────────────────────────────────────────┘│
│┌────────┐ ┌────────────┐ ┏━━━━━━━━━━━━━━┓│
││■ Test ▾│ │● Biology ▾ │ ┃Thu 15 11:25 ▴┃│ (a)
│└────────┘ └────────────┘ ┗━━━━━━━━━━━━━━┛│
│┌─────────────┐ ┌──────────┐ ┌──────────┐ │
││ Next lesson │ │ Tomorrow │ │ Pick…    │ │ (b)
││ Today 11:25 │ └──────────┘ └──────────┘ │
│└─────────────┘                           │
│                                          │
│┌────────────────────────────────────────┐│
││                  Add                   ││
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
(a) An open token chip: 2 px `accent` outline. (b) Its option row: *Next lesson* (with the resolved
date; "No upcoming lesson" when none, E-23), *Tomorrow*, *Pick…* (date picker). Kind chip opens
*Homework · Assignment · Test*; subject chip opens the subject row with *+ New subject*. Choosing an
option closes the row and marks the slot manual (it no longer follows the text).

```
┌─ FAB · Long-press menu ──────────────────┐
│                    ┌───────────────────┐ │
│                    │ ○  Homework       │ │ (a)
│                    │ ○  Assignment     │ │
│                    │ ■  Test           │ │
│                    └───────────────────┘ │
│                                    ┌───┐ │
│                                    │ + │ │ (b)
│                                    └───┘ │
└──────────────────────────────────────────┘
```
(a) Long-press on the FAB: Quick add opens with that kind preselected (manual, so typing doesn't
change it). (b) The FAB stays visible under the menu.

### 4.12 Date picker

```
┌─ Date picker sheet ──────────────────────┐
│──                                        │
│Due date                               ✕  │
│ Next lesson    Tomorrow    Next week     │ (a)
│‹             October 2026              › │ (b)
│  MO   TU   WE   TH   FR   SA   SU        │
│                  1    2    3    4        │
│                  •                       │ (c)
│   5    6    7   (8)   9   10   11        │ (d)
│             •    •                       │ (e)
│                 ━━   ━    ━              │
│  12   13   14  [15]  16   17   18        │ (f)
│        ■    •    •■                      │ (g)
│  ━━   ━━━  ━━   ━    ━                   │
│  19   20   21   22   23   24   25        │
│             •    •                       │
│ ░26░ ░27░ ░28░ ░29░ ░30░  31             │ (h)
│                                          │
│Lesson  ( P5 · 11:25 )   End of day       │ (i)
└──────────────────────────────────────────┘
```
(a) Quick chips. (b) Month navigation. (c) • lessons of the task's subject. (d) Today ringed.
(e) Past days in `ink-3`. (f) Selected date filled `accent`. (g) ■ tests due that day (Tue: the
Geography test; Thu: this test). (h) Holiday cells hatched (autumn break). (i) Lesson row appears
because Biology has a lesson on the chosen day.

### 4.13 Settings

```
┌─ Settings ───────────────────────────────┐
│Settings                                  │
│                                          │ (a)
│┌────────────────────────────────────────┐│
││ ⇩  Install TERM to keep data safe    › ││ (b)
│└────────────────────────────────────────┘│
│APPEARANCE                                │
│┌────────────────────────────────────────┐│
││ Theme                                  ││
││ ┌────────────┬────────────┬──────────┐ ││
││ │   System   │   Light    │   Dark   │ ││ (c)
││ └────────────┴────────────┴──────────┘ ││
│├────────────────────────────────────────┤│
││ Accent                                 ││
││    (●)    ●     ●     ●                ││ (d)
││     ●     ●     ●     ●                ││
│└────────────────────────────────────────┘│
│LANGUAGE                                  │
│┌────────────────────────────────────────┐│
││ ┌──────────┬──────────────┬──────────┐ ││
││ │ English  │  Македонски  │ Deutsch  │ ││ (e)
││ └──────────┴──────────────┴──────────┘ ││
│└────────────────────────────────────────┘│
│SCHOOL                                    │
│┌────────────────────────────────────────┐│
││ Timetables           Autumn term     › ││
│├────────────────────────────────────────┤│
││ Subjects              9              › ││
│├────────────────────────────────────────┤│
││ Holidays             Next: 26 Oct    › ││
│└────────────────────────────────────────┘│
│PLANNING                                  │
│┌────────────────────────────────────────┐│
││ Reminders            Day before      › ││ (f)
│├────────────────────────────────────────┤│
││ Study time           90 min a day    › ││
│└────────────────────────────────────────┘│
│DATA                                      │
│┌────────────────────────────────────────┐│
││ Back up               Last: 2 Oct      ││ (g)
│├────────────────────────────────────────┤│
││ Export to calendar                     ││
│├────────────────────────────────────────┤│
││ Import…                                ││
│├────────────────────────────────────────┤│
││ Erase everything                       ││ (h)
│└────────────────────────────────────────┘│
│       TERM 2.0 · Everything stays        │
│            on this device.               │
└──────────────────────────────────────────┘
```
(a) No primary action: Settings is a list. (b) Install row only in a browser tab (not standalone,
not native), E-18. (c) Theme segmented. (d) Accent swatches, two rows of four on phones. (e) Language
segmented with native names. (f) Summaries show the current value so most rows need no visit.
(g) Back up: share sheet/download; subtitle turns into "Last backup 34 days ago" (`danger`) after 30
days. (h) Two-step danger (§3 Button); undo snackbar holds the erased snapshot.

```
┌─ Settings · Timetables ──────────────────┐
│‹ Settings                                │
│Timetables                                │
│┌────────────────────────────────────────┐│
││ Autumn term                   NOW    › ││ (a)
││ 1 Sep – 31 Jan · Weeks A/B             ││
│├────────────────────────────────────────┤│
││ Spring term                          › ││
││ From 1 Feb · Every week                ││
│└────────────────────────────────────────┘│
│                                          │
│┌────────────────────────────────────────┐│
││            + Add timetable             ││ (b)
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
(a) *NOW* marks the timetable covering today; rows show range and rotation. (b) Adds a timetable
via the setup flow (Method); the date step pre-fills the day after the current one ends.

```
┌─ Settings · Timetable editor ────────────┐
│‹ Timetables                           ⋯  │ (a)
│Autumn term                               │
│┌────────────────────────────────────────┐│
││ Dates    1 Sep 2026 – 31 Jan 2027    › ││ (b)
│├────────────────────────────────────────┤│
││ Repeats   Every 2 weeks (A/B)        › ││ (c)
│├────────────────────────────────────────┤│
││ Skip holiday weeks               ( ●)  ││ (d)
│└────────────────────────────────────────┘│
│┌────────────────────┬───────────────────┐│
││       Week A       │      Week B       ││
│└────────────────────┴───────────────────┘│
│ Mo  Tu  We  Th  Fr  Sa  Su               │
│      MON   TUE   WED   THU   FRI         │
│    ┌─────┬─────┬─────┬─────┬─────┐       │
│1   │Math │Engl │Bio  │Math │PE   │       │ (e)
│8:00│ R4  │     │     │     │     │       │
│    └─────┴─────┴─────┴─────┴─────┘       │
│ + Add period                             │
└──────────────────────────────────────────┘
```
(a) Overflow menu: rename, duplicate (for next term), delete (undoable). (b) Date range → two date
pickers; overlapping ranges trim the neighbour with an undo snackbar (R-2). (c) Rotation picker:
every week / 2 (A/B) / 3 / 4 weeks; going down to fewer weeks asks which week to keep. (d) Only when
rotating; default on. (e) Same grid, cell sheet and period sheet as the review grid.

```
┌─ Settings · Subjects and Subject sheet ──┐
│‹ Settings                                │
│Subjects                                  │
│┌────────────────────────────────────────┐│
││ ● Biology              3 lessons     › ││
│├────────────────────────────────────────┤│
││ ● Chemistry            2 lessons     › ││
│├────────────────────────────────────────┤│
││ ● English              5 lessons     › ││
│└────────────────────────────────────────┘│
│──────────── Subject sheet ───────────────│
│Biology                                ✕  │
│Name   [ Biology                        ] │
│Short  [ Bio  ]  Teacher [ Ms. Petrova  ] │
│Colour                                    │ (a)
│  (●)  ●   ●   ●   ●   ●                  │
│   ●   ●   ●   ●   ●                      │
│            Delete subject                │ (b)
└──────────────────────────────────────────┘
```
Subject list with lesson counts → subject sheet: name, short name, teacher, colour. (a) Presets +
current custom hue; changing colour updates every screen live. (b) Deletes the subject, its lessons,
and unlinks its tasks (E-20); undoable.

```
┌─ Settings · Holidays and Holiday sheet ──┐
│‹ Settings                                │
│Holidays                                  │
│UPCOMING                                  │
│┌────────────────────────────────────────┐│
││ Autumn break                         › ││
││ Mon 26 Oct – Fri 30 Oct · 5 days       ││
│├────────────────────────────────────────┤│
││ Winter break                         › ││
││ Thu 24 Dec – Wed 6 Jan · 14 days       ││
│└────────────────────────────────────────┘│
│ ▸ Past · 1                               │
│                                          │
│┌────────────────────────────────────────┐│
││             + Add holiday              ││ (a)
│└────────────────────────────────────────┘│
│       Import from a calendar file        │ (b)
│──────────── Holiday sheet ───────────────│
│New holiday                            ✕  │
│Name  [ Autumn break                    ] │
│From  Mon 26 Oct                        › │ (c)
│To    Fri 30 Oct                        › │
│┌────────────────────────────────────────┐│
││                  Save                  ││
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
(a) Primary. (b) Imports all-day events from an `.ics` file as a checklist (SPEC F-12). (c) Date
rows open the date picker; *To* defaults to *From*; an end before the start swaps them.

```
┌─ Settings · Reminders ───────────────────┐
│‹ Settings                                │
│Reminders                                 │
│┌────────────────────────────────────────┐│
││ Reminders                        ( ●)  ││ (a)
│└────────────────────────────────────────┘│
│BEFORE SOMETHING IS DUE                   │
│┌────────────────────────────────────────┐│
││ Homework     Day before · 18:00      › ││
│├────────────────────────────────────────┤│
││ Tests       3 days, 1 day · 18:00    › ││
│├────────────────────────────────────────┤│
││ Assignments  2 days before · 18:00   › ││
│└────────────────────────────────────────┘│
│┌────────────────────────────────────────┐│
││ Study sessions  On the day 17:00 ( ●)  ││ (b)
│├────────────────────────────────────────┤│
││ Evening summary 20:00            (○ )  ││ (c)
│└────────────────────────────────────────┘│
│Web build instead shows:                  │ (d)
│┌────────────────────────────────────────┐│
││ Reminders need the TERM app on your    ││
││ phone.                      Install ›  ││
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
(a) Master switch; turning it on requests OS permission; denied → row explains how to allow it in
system settings. (b) Study-session reminders use the preferred study time. (c) Digest is off by
default. (d) In the web build this banner replaces the whole screen content (D-011).

```
┌─ Settings · Study time ──────────────────┐
│‹ Settings                                │
│Study time                                │
│┌────────────────────────────────────────┐│
││ Daily limit         [ − ] 90 min [ + ] ││ (a)
│├────────────────────────────────────────┤│
││ Session length    15 · (25) · 45 · 60  ││
│├────────────────────────────────────────┤│
││ Preferred time       17:00           › ││ (b)
│├────────────────────────────────────────┤│
││ Study on weekends                ( ●)  ││
│└────────────────────────────────────────┘│
│The planner keeps each day under your     │
│limit when it can.                        │ (c)
└──────────────────────────────────────────┘
```
(a) Daily limit 30–240 min in 15-min steps: the heat cap (R-10) and planner cap (R-11). (b) Time
picker sheet. (c) One-line explanation.

```
┌─ Settings · Restore summary sheet ───────┐
│──                                        │
│Restore this backup?                   ✕  │
│term-backup-2026-09-30.json               │ (a)
│┌────────────────────────────────────────┐│
││ From the backup        On this phone   ││ (b)
││ 2 timetables           1 timetable     ││
││ 11 subjects            9 subjects      ││
││ 38 tasks · 3 files     41 tasks        ││
│└────────────────────────────────────────┘│
│Everything on this phone is replaced.     │
│You can undo right after.                 │ (c)
│                                          │
│┌────────────────────────────────────────┐│
││          Replace with backup           ││ (d)
│└────────────────────────────────────────┘│
│                 Cancel                   │
└──────────────────────────────────────────┘
```
Opened by *Import…* with a `.json` file. (a) File name. (b) Side-by-side counts so the student sees
what changes. (c) Undo statement — the snackbar after replacing holds the previous data. (d) Primary
replaces; this is one of the two guarded actions (§5.3).

```
┌─ Settings · Calendar import checklist ───┐
│──                                        │
│From school-calendar.ics               ✕  │
│HOLIDAYS · 4 FOUND                        │ (a)
│┌────────────────────────────────────────┐│
││ ✓  Autumn break      26 Oct – 30 Oct   ││
│├────────────────────────────────────────┤│
││ ✓  Winter break      24 Dec – 6 Jan    ││
│├────────────────────────────────────────┤│
││ ○  Parents' evening  12 Nov            ││ (b)
│├────────────────────────────────────────┤│
││ ✓  Spring break      6 Apr – 17 Apr    ││
│└────────────────────────────────────────┘│
│Weekly lessons in this file: none         │ (c)
│                                          │
│┌────────────────────────────────────────┐│
││             Add 3 holidays             ││ (d)
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
Opened by *Import…* or *Holidays → Import from a calendar file* with an `.ics`. (a) All-day events
found, pre-ticked when they look like breaks (multi-day or holiday words in EN/MK/DE). (b) Single
non-holiday days start unticked. (c) If weekly timed events exist, a second step offers them as a
draft timetable in the review grid. (d) Primary counts the selection.

```
┌─ Task detail · Reminder sheet ───────────┐
│──                                        │
│Remind me                              ✕  │
│( Default )   Custom   None               │ (a)
│┌────────────────────────────────────────┐│
││ 1 day before           18:00         › ││ (b)
│├────────────────────────────────────────┤│
││ + Add reminder                         ││
│└────────────────────────────────────────┘│
│Default for tests: 3 days and 1 day       │ (c)
│before, 18:00.                            │
└──────────────────────────────────────────┘
```
Native builds only. (a) Segmented: follow defaults, custom list, or no reminders for this task.
(b) Each custom reminder: days before (stepper) and time (TimePicker). (c) The default it overrides.

### 4.14 Attachment viewer

```
┌─ Attachment viewer ──────────────────────┐
│✕            worksheet.jpg           ⇪    │ (a)
│╭────────────────────────────────────────╮│
││                                        ││
││                                        ││
││              ( image )                 ││ (b)
││                                        ││
││                                        ││
│╰────────────────────────────────────────╯│
│              1 of 2  ‹  ›                │ (c)
└──────────────────────────────────────────┘
```
(a) Close, file name, share. (b) Full-screen on `scrim` @ 100 %; pinch/double-tap zoom, swipe
down to close. (c) Pager when the task has several images. PDFs open in the system viewer.

---

## 5. Interaction principles

### 5.1 Swipe to complete
Right swipe on any task row completes it; left swipe offers *Next lesson* and *Delete* (§3 ListRow).
Thresholds give haptic feedback; releasing early always snaps back. Swipes are accelerators — the
checkbox is the canonical way and works identically.

### 5.2 Long-press quick actions
Long-press (450 ms), right-click or the Menu key opens a context menu on task rows, lessons, steps,
attachments and the FAB. Menus contain the 3–6 most useful actions for that object, destructive
last. Nothing is *only* reachable by long-press.

### 5.3 Undo, not confirm
No "Are you sure?" dialogs. Completing, deleting, moving, re-planning, removing a period or subject,
restoring a backup and erasing everything happen immediately and show an undo snackbar. Two
exceptions guard actions that destroy *everything*: *Erase everything* (two-step button) and
*Restore backup* (summary sheet naming what will be replaced) — both still undoable afterwards.
The last 10 actions are undoable with ⌘/Ctrl-Z while the app is open.

### 5.4 Optimistic UI
State changes render in the same frame as the input; IndexedDB writes follow. A failed write
reverts the change with an error snackbar (E-19). Lists animate items to their new place instead of
re-rendering. Nothing shows a spinner for local work; spinners exist only for imports.

### 5.5 Live editing
Detail sheets have no Save button and no edit mode: fields save as they change. Quick add and the
setup flow are the only places with a commit button, because they *create* something.

### 5.6 Never lose typed text
Closing Quick add with text keeps it as a draft (memory + `localStorage`) and restores it next time
with the cursor at the end; *Add* or clearing the field discards it. The setup flow keeps typed days
when going back and forth.

### 5.7 Gestures map

| Gesture | Where | Result | Alternative |
| --- | --- | --- | --- |
| Tap | Anything pressable | Primary meaning | — |
| Long-press / right-click | Rows, lessons, FAB, attachments | Context menu | Menu key, detail sheet |
| Swipe right | Task rows | Complete | Checkbox |
| Swipe left | Task rows | Next lesson / Delete | Context menu, detail sheet |
| Horizontal swipe | Week grid | Previous/next week | Arrow buttons, ← → keys |
| Drag down | Sheet handle/header | Close sheet | Close button, Escape, back |
| Drag (handle) | Steps | Reorder | ⌥/Alt + ↑/↓ |
| Pinch | Attachment viewer | Zoom | Double-tap, + / − keys |

### 5.8 Keyboard (desktop and hardware keyboards)
`N` new (Quick add) · `1`–`4` tabs · `Space` toggles done on the focused row · `Enter` opens it · `Delete`/`Backspace` deletes it (undoable) · `←`/`→` change week in
Week · `T` jumps to today in Week · `⌘/Ctrl-Z` undo · `Esc` closes sheet/menu. Shortcuts are
ignored while typing in a field and listed in the accessibility statement in Settings → About.

### 5.9 Feedback timing
Every input gets visible feedback within 100 ms (press scale, state change). Work that takes longer
than 1 s (imports) shows progress and can be cancelled.

---

## 6. Copy

Voice: a calm, competent older sibling. Short sentences, second person, sentence case, no
exclamation marks, no jargon ("OCR" → "reading the text"), numbers as digits. Same tone in EN, MK,
DE; translations are written, not word-for-word.

| Place | EN copy |
| --- | --- |
| Welcome | "Your school week, sorted." / "Add your timetable once. Homework and tests fall into place." |
| Method privacy | "Photos are read on this phone and never uploaded." |
| Import phases | "Opening the file…" · "Reading the text…" · "Arranging your week…" |
| Import errors | Unsupported: "That file type isn't supported. Try a photo, screenshot or PDF." · Nothing found: "We couldn't find a timetable in that picture. Try a sharper, straight-on photo — or type it in." · Failed: "Something went wrong reading that file. Try again, or type it in." |
| Next up empty | "All clear" / "Nothing due. Enjoy it — or add what's coming with +." |
| No timetable | "Add your timetable" / "Homework and tests fall into place once TERM knows your week." |
| Timetable ended | "Your timetable ended on 31 Jan" / "Add the new one to keep lessons and due dates right." |
| Holiday | "Autumn break" / "Back on Monday, 2 November" |
| Weekend | "No school today." |
| After school | "Done for today." |
| Tasks empty | "Nothing to do" / "Add homework, assignments and tests with +." |
| Done empty | "Finished work shows up here for 30 days." |
| Holidays empty | "No holidays yet" / "Add breaks so lessons and reminders skip them." |
| No upcoming lesson | "No upcoming Math lesson — pick a date." |
| Storage error | "Couldn't save — your device storage is full." |
| Snackbars | "Done · Undo" · "Deleted · Undo" · "Moved to Mon 12 Oct · Undo" · "Test added · Plan studying" · "Plan added · Undo" · "Autumn term now ends 31 Jan · Undo" |
| Notifications | Title "Biology test tomorrow · 11:25", body "Bio test on cell division · 3 of 5 sessions done". Homework: "Math ex. 4–7 is due tomorrow · 8:00" with action *Done*. Digest: "Tomorrow: 6 lessons · 2 things due". |
| Labels | Task without title: "Math homework", "Biology test". Due: "Tomorrow, 8:00", "Fri 9 Oct · Math", "Overdue · yesterday". |

---

## 7. Accessibility

- **Contrast** per §2.1–2.4, asserted in `contrast.test.ts`; `line-strong` and `ink-3` only on the
  backgrounds listed.
- **Focus**: 2 px `accent` outline, 2 px offset, `:focus-visible` only; logical order follows the
  visual order; sticky bars, FAB and snackbar never cover the focused element (`scroll-padding`).
- **Names**: every icon button labelled; checkboxes say what they complete; heat bars are
  `aria-hidden` and their day carries the text ("Thursday 8 October, busy — about 80 minutes,
  3 things"); lesson cells read "Biology, Wednesday, 8:00 to 9:35, room 12, 1 homework due";
  holiday columns read "Monday 5 October, Teacher training, no school".
- **Structure**: one `h1` per screen; sections have headings; Week and the review grid use grid
  semantics (`role="grid"`, row/column headers) with a roving `tabindex` — one tab stop for the
  whole grid, arrow keys move between cells, Home/End to row ends; lists are lists; the tab bar is
  `nav`.
- **Announcements** (polite live region): completion ("Math ex. 4–7 done"), undo, import phases and
  results ("Found 31 lessons, 2 unsure"), week change ("Week of 12 October, Week B").
- **Gestures** all have single-pointer and keyboard alternatives (§5.7).
- **Timing**: snackbars pause on hover/focus/press; undo also via ⌘/Ctrl-Z.
- **Motion**: §2.10 reduced-motion mapping.
- **Text size**: browser text zoom to 200 % reflows without clipping; rows grow; grids switch to
  horizontal scroll rather than shrinking text.
- **Language**: `lang` on `<html>` follows the app language; mixed-language subject names are fine.
- **Testing**: axe (serious/critical = 0) on every screen in light and dark in Playwright; manual
  VoiceOver (iOS) and TalkBack (Android) passes before each release.

---

## 8. Platform adaptation

| Platform | Adaptation |
| --- | --- |
| iOS (Capacitor + Safari PWA) | Safe areas on all edges; rows ignore swipes starting within 24 px of the left edge (system back); status bar style and the `theme-color` meta follow the active theme (`bg`); haptics via Capacitor; PWA shows the install row (E-18). |
| Android | Hardware/gesture back: closes menu → sheet → pops screen → leaves the app from a tab root; edge-to-edge with transparent system bars; Material ripple **not** used (press scale instead). |
| ≥ 640 px | Sheets become centred dialogs; hover states on. |
| ≥ 900 px | Left rail instead of bottom tab bar; Week cells show full subject names; content stays at 560 px except Week/editor (960). |
| Landscape phone | Gutters respect `safe-left/right`; sheets max 90 dvh with internal scroll. |
| Keyboard / pointer | §5.8 shortcuts; right-click menus; tooltips on icon buttons. |
