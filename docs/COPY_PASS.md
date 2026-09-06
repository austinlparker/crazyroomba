# Arcade UI copy pass

The stage preview should sell the game. The interface should tell the player what they can do next.

## Main screen

Keep the game title, selected stage, unlock condition when relevant, stage arrows, mode buttons, Play, Tutorial, and Skins. Keep account, leaderboard, profile, sound, and settings controls accessible. Remove the marketing eyebrow, introduction, numbered facts, scene caption, daily promotion, edition/version labels, and repeated footer branding.

Use `Arcade`, `Daily`, and `Free roam`. Their descriptions need only explain the time limit: `60 seconds`, `90 seconds · today's course`, and `No time limit`. Let each stage name identify its setting. A locked stage needs one specific requirement, not an additional description.

## During play

Keep points, time, cargo, boost, camera, pause, and local navigation. Objectives should respond to the current decision: `Collect dust`, `Dock → 12 m`, or `Hold BOOST to climb`. A nearby moving obstacle needs a short warning; its routine does not need narration. Use `Full bin = 2× points` to explain the delivery bonus once in the cargo panel.

Tutorial steps should have direct titles: `Drive`, `Boost`, `Collect`, `Deliver`. Give one instruction at a time and tailor controls to the current input device where possible. Detailed control mappings belong in Garage. Remove duplicate control paragraphs from Pause.

## Menus and account flows

Use direct titles: `Paused`, `Results`, `Leaderboard`, `Your stats`, `Garage`, `Sign in`. Remove repeated game branding and subtitles that only restate a heading. Keep dates, offline status, errors, unlock requirements, and account consent explanations; these support a decision. Do not replace authentication errors or permissions with jokes.

Music retains track and artist credits, volume, enable/disable, skip, and preview. Remove the genre slogan and normal playback explanatory text. Show a status message when audio is blocked or unavailable. Full license text remains linked from Garage.

## Presentation

- Functional body text: 14–18 px; compact HUD labels: at least 12 px.
- Main Play button: 30–36 px. Stage names: 28–40 px.
- Interactive targets: generally at least 44 px; stage arrows: 46–56 px wide.
- Dark outlines, flat yellow/orange panels, large score numerals, and strong selected states provide the arcade feel.
- Desktop uses left controls and a clear right stage preview. Portrait uses a lower control panel with preview space above. Short landscape screens scroll the menu instead of shrinking labels.
- Preserve visible keyboard focus, readable dialog scrolling, reduced-motion settings, modal focus/inert behavior, and touch controls.

The CSS removes obsolete decoration selectors as a fallback while the corresponding markup is deleted. It also supplies stage-selector and skin-card styling. Phone navigation icons must retain explicit accessible names when their visible labels collapse.

## Validation

CSS formatted with Prettier. Desktop, portrait, and landscape rules reviewed for explicit minimum font sizes, target sizes, and scrollable dialogs. The integrated main-screen and skin markup was reviewed against the stylesheet. This caught and fixed the skin-heading specificity, card spacing, centered swatches, and overflowing stage-dot glyphs. Desktop and 390 × 844 browser checks were attempted after the game typechecked, but computer-use access was blocked by the locked Mac; no browser result is claimed. Final viewport results belong in the release validation report.
