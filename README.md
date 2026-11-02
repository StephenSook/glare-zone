# Glare Zone

See where a gallery light's glare lands for wheelchair, child and standing visitors, then move the light until the glare stays out of the viewing area.

A Lens for SPECS, built with CLAD in Lens Studio 5.23.2 and tested in the Lens Studio preview (no SPECS device).
The wall, print and lamp values are samples. The reflection is computed from the geometry, not measured.

## Judge it in 90 seconds

1. Watch the demo video (link added when it is published, before Nov 9).
2. Read `devpost/design-brief.md` (the plan-lens brief) and `devpost/BUILD_LOG.md` (CLAD sessions, LEAF runs).
3. Run the glare math tests: `node --test tests/glareMath.test.mjs` (32 tests; the z_hit, near and far formulas were
   each broken on purpose once, and 7, 5 and 9 tests turned red). The 12 LEAF scenarios passed in the last full run, 09:21 to 09:37 ET on 2026-11-02.

## Why it belongs on glasses

Glare is about where your eye is. A floor plan shows where the light hangs, not where its reflection lands for each
visitor. Glare Zone is built for glasses: you move the light with your hands, the zones sit on the floor at true
scale in front of a practice wall, and you can step into one and see the reflection from that height. In this
build the wall is a practice wall placed in front of you; anchoring it to a real gallery wall is next.

## What it does

- Three example eye heights: 160 cm standing (the eye height the standard aiming rule assumes), 109 cm seated in a
  wheelchair, and 104 cm for a child wheelchair user aged 6 to 9 (Smithsonian accessible exhibition guidelines).
- The floor shows each height's predicted reflection zone. Slide the light and the zones move; tilt it and they
  update, since a reflection only counts where the beam reaches the glass.
- Pick a height and step into its zone: a glare spot appears on the glass, with a faint "ghost" of the lamp behind
  the wall showing where the reflection comes from.
- Save a light sheet that records whether each zone overlaps the chosen viewing area.

## How it was built

| Layer | CLAD skill or tool | Files |
|---|---|---|
| Plan | plan-lens | devpost/design-brief.md |
| Glare math | plain TypeScript functions | Assets/Scripts/GlareMath.ts, tests/glareMath.test.mjs |
| Scene and UI | CLAD agents in Lens Studio | Assets/Scripts/GlareZoneController.ts, GlareZoneUI.ts, GlareLayout.ts, DrawKit.ts, DragKnob.ts, GlareHandMenu.ts |
| Tests | live-lens-tester, LEAF | Assets/Tests/ (C1 to C12) |

8 CLAD sessions, about 1,045 tool calls over about 383 minutes (per the session table in `devpost/BUILD_LOG.md`).

## The geometry, in one line

With the wall at x = 0, the light at (d, H) and an eye at height ze standing x from the wall, the eye sees the lamp's
mirror image at height z_hit = ze + (H - ze) x / (x + d). Glare needs that point on the glass, between its bottom
edge zb and top edge zt. Example (3 m ceiling, glass 120 to 200 cm, light 81 cm out as the standard rule gives):
standing 0 to 32 cm from the wall, wheelchair 5 to 74 cm, child 7 to 78 cm.

## What the preview cannot prove

| Not proven | Why |
|---|---|
| How strong the glare looks | Plane-mirror model; real glass, anti-reflective coatings and beam spread change it |
| Real gallery placement | On glasses the Lens would find the picture with marker tracking and the floor with a world query; not built |
| How often glare bothers seated visitors | No published figure found, so none is claimed |

## Prior work

We did not find an existing tool that maps reflection zones for seated and child visitors (patents, app stores,
GitHub, and English, German, Japanese, Korean, French and Dutch museum sources, searched November 2026).

## Snap's Spectacles guidance (Snap's own words; developers.snap.com: Publishing Your Spectacles Lens, Design Best Practices, Positioning & Sizing Content)

| Snap asks for | Glare Zone | Evidence |
|---|---|---|
| "Target 60 FPS at all times" | Desktop preview only, not SPECS, traced on v0.3.1 and v0.3.2: idle opening view ProcessFrame p50 9.50 ms, p95 13.93 ms; a foreground drag trace ran at about 21 fps because the preview was throttled | BUILD_LOG "Perf" |
| "Show the version number visibly on Lens launch" and log "Lens Opened: vX.X.X" | visible v0.3.3 label + "Lens Opened: v0.3.3" log line | `GlareLayout.ts`, `GlareZoneController.ts` |
| "Provide a debug menu and in-lens tests" | 12 LEAF scenarios + 32 glare-math unit tests; new checks were broken on purpose to prove they turn red | devpost/BUILD_LOG.md |
| "Add an onboarding" / headline | headline states the answer for the selected eye height | LEAF check |
| "a beginning, middle and end, and a way to repeat" | Save results, Done / Restart | LEAF check |
| "Avoid Steep Neck Angles" | main panels near eye level, floor handles on the floor, nothing at the ceiling lamp | layout |
| "Provide a background behind text" | light backing panels on floor labels and legend | captures |
| Targets "at least 2 degrees in angular size", "spaced at least 1 degree apart" | measured at the four eye-height presets (v0.3.3): panel targets 2.20 to 2.23 deg with More open, 2.48 to 2.50 closed; smallest gap 1.01 to 1.03 deg with More open (thin margin over the 1 deg minimum), 1.08 closed; floor handles 2.10 deg | LEAF C8 |
| Preview image, custom icon, release notes | `devpost/media/icon_512.png`, `preview_3x4.png`; release notes in BUILD_LOG | files |
| On-device testing | Not possible: built and tested in the Lens Studio preview only | stated |

## What I learned


I learned that the usual rule for aiming a gallery light assumes one standing eye at 160 cm. The accessibility
guides say to check seated and child eye heights too, and I couldn't find a tool that puts both in one place. When
we ran it, a light 65 cm from the wall still put the child's glare zone into the viewing area, so the demo setback
moved to 62 cm.

A Codex review also caught a mistake in how I explained it. Tilting a light doesn't move the reflection by itself.
The zone moves with where the light sits, and the beam decides whether the reflection is lit at all. I fixed the
wording everywhere.

I built this one on my Windows PC while Case Light ran on my Mac. CLAD did the building, and my job was the brief,
the decisions and catching what the tests couldn't prove. That matters here, because the people it's for are
visitors who sit lower than the rule assumes.

## Checks that run on every push

`.github/workflows/checks.yml`: the 32 glare-math unit tests (`node --test`), a gitleaks scan of the full history,
and `tools/check_repo.py`, which counts the LEAF scenarios, fails if this README's count disagrees with the code, and
fails on tracked local-only files, saved tokens in the scene, or em dashes in the docs.

## License

Our code and docs: MIT (see LICENSE). Packages under `Packages/` keep their own licenses.
