# Glare Zone

A Snap Spectacles (SPECS 27) Lens that draws, on the floor in front of a framed print, how far each gallery light's reflection in the glazing reaches toward standing, seated and child-height eyes, and says "All three: clear" only when none of them reaches the viewing area.
Planned with plan-lens from the Devpost Learn AR with SPECS skill pack, built with CLAD (the ls-clad Lens Studio agent skills), and driven in Lens Studio 5.23.2 through the Lens Studio MCP server.
v0.4 · computed reflection with sample lamp values, not measured · tested in the Lens Studio preview, not on a SPECS device.

## Judge it in 90 seconds

1. Watch the demo video (link added when it is published, before Nov 9).
2. Read `devpost/design-brief.md` (the plan-lens brief), `devpost/BUILD_LOG.md` (CLAD sessions, LEAF runs) and
   `devpost/PROMPTS.md` (the prompts used to build Glare Zone).
3. Run the unit tests: `node --test tests/glareMath.test.mjs tests/placement.test.mjs` (41 tests; the z_hit, near and
   far formulas were each broken on purpose once, and 7, 5 and 9 tests turned red).
4. The 19 LEAF scenarios (C1 to C19) passed 19 of 19 in the v0.4 full run, 21:53 to 22:06 ET on 2026-11-02 (BUILD_LOG
   "Latest full run"). C19 runs with `__leaf__diagnostic_policy` = fail-fast. Every v0.4 behaviour has a planted break
   that turned its scenario red, with the file restored byte-identical (rows 9 to 20). The other 13 registered
   scenarios are media and perf helpers, not tests.

## Why it belongs on glasses

Glare off framed glass depends on where your eyes are. At the standard placement the same two lights keep their
reflection out of a standing visitor's eyes across the whole viewing area, yet send it into the eyes of seated
visitors and children up to 74 and 78 cm from the wall, well inside it. On glasses the zones are drawn full size on
the real floor in front of the real wall, so the person hanging the work sees each eye height's glare zone exactly
where those visitors will stand or sit. They can walk into a zone to see the reflection appear on the print from that
spot, step into a floor ring to switch eye height, and slide or tilt a light with their hands while the zones redraw,
all with both hands free and nothing held up between them and the wall. A phone or a floor plan would show the same
numbers at arm's length or at the wrong scale. The point of the Lens is that the answer sits on the floor where the
decision is made. (This describes the design. The Lens has been tested in the Lens Studio preview only, not on a
SPECS device.)

## What it does

- Three example eye heights: 160 cm standing (the eye height the standard aiming rule assumes), 109 cm seated in a
  wheelchair, and 104 cm for a child wheelchair user aged 6 to 9 (Smithsonian accessible exhibition guidelines).
- The floor shows each height's predicted reflection zone. Slide the light and the zones move; tilt it and they
  update, since a reflection only counts where the beam reaches the glass.
- The answer card gives one line per eye height plus the verdict. It says "All three: clear" only when all three are
  clear, and while a light moves it shows each height's change ("Seated 73.5 to 56.4 cm").
- Step into a floor ring and hold still for 1 s to switch to that eye height. Step into a zone to see the glare spot
  on the glass, with a faint "ghost" of the lamp behind the wall showing where the reflection comes from.
- Place the practice wall on a real wall by aiming and pinching (World Query hit tests), or in front of you.
- Every light move writes one log line, and `devpost/tools/summarize_session.py` recomputes the verdict from it.
- Save a light sheet that records whether each zone overlaps the chosen viewing area.

## How it was built

| Layer | CLAD skill or tool | Files |
|---|---|---|
| Plan | plan-lens | devpost/design-brief.md |
| Glare math | plain TypeScript functions | Assets/Scripts/GlareMath.ts, tests/glareMath.test.mjs |
| Scene and UI | CLAD agents in Lens Studio | Assets/Scripts/GlareZoneController.ts, GlareZoneUI.ts, GlareLayout.ts, DrawKit.ts, DragKnob.ts, GlareHandMenu.ts |
| Tests | live-lens-tester, LEAF | Assets/Tests/ (C1 to C19) |

CLAD skills that BUILD_LOG records as used in v0.4, and what each made:

| CLAD skill | Used for | Files it made or changed | BUILD_LOG row |
|---|---|---|---|
| specs-world-query | Wall placement: aim at a real wall and pinch (World Query hit tests) | `Assets/Scripts/PlacementMath.ts`, `Assets/Scripts/GlareWallPlacer.ts`, `Assets/Tests/GlareC13WallPlacement.ts`, `tests/placement.test.mjs`; changes to `GlareZoneController.ts` and `GlareHandMenu.ts` | 9 |
| specs-capture-perf-trace | Preview performance traces (p50, p90, p99 frame time) | `performance_traces/glare_v04_*.pftrace` (kept locally, gitignored), `Assets/Tests/GlarePerfExerciserLong.ts` (the 36 s drag helper) | 11 |
| editor-api | Lens Studio Editor API calls through the MCP | No new files: removed `Icons.lspkg` and `Motion.lspkg` (row 10); after a Lens Studio crash, re-added `GlareBase.mat`'s unlit pass and saved the scene (row 15) | 10, 15 |

21 CLAD sessions, about 1,725 tool calls over about 816 minutes (summed from the session table in `devpost/BUILD_LOG.md`).

## The geometry, in one line

With the wall at x = 0, the light at (d, H) and an eye at height ze standing x from the wall, the eye sees the lamp's
mirror image at height z_hit = ze + (H - ze) x / (x + d). Glare needs that point on the glass, between its bottom
edge zb and top edge zt. Example (3 m ceiling, glass 120 to 200 cm, light 81 cm out as the standard rule gives):
standing 0 to 32 cm from the wall, wheelchair 5 to 74 cm, child 7 to 78 cm.

## Real-scale check (LEAF C18)

C18 measures what is drawn at run time, in world centimetres along the practice wall's own axes, and compares each
value with the brief. Measured in the Lens Studio preview on 2026-11-02 (BUILD_LOG row 19):

| What | Measured | Brief | Tolerance |
|---|---|---|---|
| Practice wall width | 400.00 cm | 400 cm (default) | 1 cm |
| Practice wall height | 300.00 cm | about 3 m | 1 cm |
| Glazed print width x height | 100.00 x 100.00 cm | 100 x 100 cm | 0.5 cm |
| Print centre above the floor | 150.00 cm | 150 cm | 0.5 cm |
| Bottom of the glass above the floor | 100.00 cm | 100 cm | 0.5 cm |
| Track lights from the wall (standard placement) | 80.78 cm, both | (300 - 160) x 0.577 = 80.78 cm | 0.1 cm |
| Track lights above the floor | 300.00 cm, both | 300 cm ceiling | 0.5 cm |
| Track lights along the wall | -50.00 and +50.00 cm | 100 cm apart, one each side | 0.5 cm |
| Eye heights (camera above the practice floor) | 160.00, 109.00, 104.00 cm | 160, 109, 104 cm | 0.5 cm |

With the whole practice gallery scaled to 0.9 (a planted break), C18 failed on the first check: "wall width cm:
measured 360.00 cm vs brief 400.00 +/- 1".

## What is simulated, and what is not proven

| Area | What the Lens does | Status |
|---|---|---|
| Glare zones | Computed from the plane-mirror geometry of each lamp in the glazing (`Assets/Scripts/GlareMath.ts`, unit tests with hand-worked values) | Computed, not measured with a light meter or a camera |
| How strong the glare looks | Plane-mirror model | Real glass, anti-reflective coatings and beam spread change it |
| Lamps | A sample fixture: 25 deg beam, 1,500 cd (shown on the results cards as "Sample fixture (not real)") | Sample values, not a real product's photometry |
| Room | Practice wall, print and floor at the brief's sizes; 300 cm ceiling; viewing area 60 to 182 cm from the wall | A sample room; real rooms differ |
| Eye heights | 160 cm (CCI Notes 2/3), 109 and 104 cm (Smithsonian guidance) | Published guidance, not measured visitors |
| How often glare bothers seated visitors | Not claimed | No published figure found |
| Device | Every test ran in the Lens Studio preview (SPECS 27 simulated) on a desktop PC | Not tried on SPECS hardware |
| Wall placement | Real World Query hits in the preview's "Sunlit Room" | The pinch-release detection is untested (LEAF cannot make a free-space pinch); none of it was tried on a device |
| Palm-up menu | Shown and pressed in the preview | Palm-up detection is untested (LEAF cannot raise a palm) |
| Performance | Preview traces: idle frame interval p50 22.60 ms, drag p50 32.76 ms (BUILD_LOG "Perf") | Desktop preview numbers, not SPECS frame times |
| Session log | One `GLARE_LOG` line per light move; `devpost/tools/summarize_session.py` recomputes the verdict | Checked on LEAF runs (scripted), not on a real session |

## Prior work

We did not find an existing tool that maps reflection zones for seated and child visitors (patents, app stores,
GitHub, and English, German, Japanese, Korean, French and Dutch museum sources, searched November 2026).

## Snap's Spectacles guidance (Snap's own words; developers.snap.com: Publishing Your Spectacles Lens, Design Best Practices, Positioning & Sizing Content)

| Snap asks for | Glare Zone | Evidence |
|---|---|---|
| "Target 60 FPS at all times" | Desktop preview only, not SPECS. v0.4 traces: idle frame interval p50 22.60 ms, drag p50 32.76 ms | BUILD_LOG "Perf" |
| "Show the version number visibly on Lens launch" and log "Lens Opened: vX.X.X" | visible v0.4 label + "Lens Opened: v0.4" log line | `GlareLayout.ts`, `GlareZoneController.ts` |
| "Provide a debug menu and in-lens tests" | 19 LEAF scenarios + 41 unit tests; new checks were broken on purpose to prove they turn red | devpost/BUILD_LOG.md |
| "Add an onboarding" / headline | headline states the answer for the selected eye height | LEAF check |
| "a beginning, middle and end, and a way to repeat" | Save results, Done / Restart | LEAF check |
| "Avoid Steep Neck Angles" | main panels near eye level, floor handles on the floor, nothing at the ceiling lamp | layout |
| "Provide a background behind text" | light backing panels on floor labels and legend | captures |
| Targets "at least 2 degrees in angular size", "spaced at least 1 degree apart" | measured at the four eye-height presets (v0.3.3): panel targets 2.20 to 2.23 deg with More open, 2.48 to 2.50 closed; smallest gap 1.01 to 1.03 deg with More open (thin margin over the 1 deg minimum), 1.08 closed; floor handles 2.10 deg; C8 still passes in v0.4 | LEAF C8 |
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

`.github/workflows/checks.yml`: the unit tests (`node --test` on both test files), a gitleaks scan of the full
history, and `tools/check_repo.py`, which counts the LEAF scenarios, fails if this README's count disagrees with the
code, and fails on tracked local-only files, private keys, saved tokens in the scene, or em dashes in the docs.

## License

Our code and docs: MIT (see LICENSE). Packages under `Packages/` keep their own licenses. Third-party notices and file
provenance: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
