# Glare Zone

A Snap Spectacles (SPECS 27) Lens that draws, on the floor in front of a framed print, how far each gallery light's reflection in the glazing reaches toward standing, seated and child-height eyes, and says "All three: clear" only when none of them reaches the viewing area.
Planned with plan-lens from the Devpost Learn AR with SPECS skill pack, built with CLAD (the ls-clad Lens Studio agent skills), and driven in Lens Studio 5.23.2 through the Lens Studio MCP server.
v0.4 · computed reflection with a real lamp's published photometry (TSLight RXT13, manufacturer data, not measured) · tested in the Lens Studio preview, not on a SPECS device.

## Judge it in 90 seconds

1. Watch the demo video (link added when it is published, before Nov 9).
2. Read `devpost/design-brief.md` (the plan-lens brief) and [devpost/BUILD_LOG.md](devpost/BUILD_LOG.md) (CLAD sessions, LEAF runs).
3. Run the unit tests: `node --test tests/glareMath.test.mjs tests/placement.test.mjs` (50 tests).
4. Read the version and counts below for the 24 LEAF scenarios and the full run recorded in BUILD_LOG row 32.

## Version and counts

- Version: v0.4 (`LENS_VERSION` in `Assets/Scripts/GlareLayout.ts`).
- LEAF: 24 test scenarios (C1 to C24), 24 of 24 passed in the full run on 2026-11-03 13:32 to 14:08 (BUILD_LOG "Latest full run", row 32), every one with `__leaf__diagnostic_policy` = fail-fast. Every v0.4 behaviour has a planted break that turned its scenario red, with the file restored byte-identical (rows 9 to 31). The other 14 registered scenarios are media and perf helpers, not tests (`media-clip-v2` drives the preview clip, row 33).
- Unit tests: 50 in `tests/glareMath.test.mjs` (46) and `tests/placement.test.mjs` (4) (`node --test tests/glareMath.test.mjs tests/placement.test.mjs`), plus `python devpost/tools/summarize_session.py --selftest` (6 checks on labelled sample lines).
- Third-party notices and file provenance: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Why it belongs on glasses

Glare off framed glass depends on where your eyes are: at the standard placement the same two lights keep their reflection out of a standing visitor's eyes across the whole viewing area, yet send it into the eyes of seated visitors and children up to 74 and 78 cm from the wall, well inside it. On glasses the zones are drawn full size on the real floor in front of the real wall, so the person hanging the work sees each eye height's glare zone exactly where those visitors will stand or sit. They can walk into a zone to see the reflection appear on the print from that spot, step into a floor ring to switch eye height, and slide or tilt a light with their hands while the zones redraw, all with both hands free and nothing held up between them and the wall. A phone or a floor plan would show the same numbers at arm's length or at the wrong scale. The point of the Lens is that the answer sits on the floor where the decision is made. (This describes the design. The Lens has been tested in the Lens Studio preview only, not on a SPECS device.)

## What it does

- Three example eye heights: 160 cm standing (the eye height the standard aiming rule assumes), 109 cm seated in a
  wheelchair, and 104 cm for a child wheelchair user aged 6 to 9 (Smithsonian accessible exhibition guidelines).
- The floor shows each height's predicted reflection zone. Slide the light and the zones move. Tilt it and they
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
| Tests | live-lens-tester, LEAF | Assets/Tests/ (C1 to C24) |

CLAD skills that BUILD_LOG records as used in v0.4, and what each made:

| CLAD skill | Used for | Files it made or changed | BUILD_LOG row |
|---|---|---|---|
| specs-world-query | Wall placement: aim at a real wall and pinch (World Query hit tests) | `Assets/Scripts/PlacementMath.ts`, `Assets/Scripts/GlareWallPlacer.ts`, `Assets/Tests/GlareC13WallPlacement.ts`, `tests/placement.test.mjs`. Changes to `GlareZoneController.ts` and `GlareHandMenu.ts` | 9 |
| specs-capture-perf-trace | Preview performance traces (p50, p90, p99 frame time) | `performance_traces/glare_v04_idle_b_*.pftrace`, `performance_traces/glare_v04_drag_*.pftrace`, `Assets/Tests/GlarePerfExerciserLong.ts` (the 36 s drag helper) | 11 |
| build-sfx | The cue when the card turns "All three: clear": its `uiNotify` preset (two soft bells), low-passed and trimmed to 0.9 s, played at volume 0.35 | `Assets/GeneratedSFX/all_three_clear.wav`. The cue's player in `GlareZoneController.ts`. `Assets/Tests/GlareC23ClearCue.ts` | 30 |
| editor-api | Lens Studio Editor API calls through the MCP | No new files: removed `Icons.lspkg` and `Motion.lspkg` (row 10). After a Lens Studio crash, re-added `GlareBase.mat`'s unlit pass and saved the scene (row 15) | 10, 15 |

33 CLAD sessions, about 2,230 tool calls over about 1,236 minutes (summed from the session table in `devpost/BUILD_LOG.md`).

## Prompts

The prompts used to build Glare Zone: [devpost/PROMPTS.md](devpost/PROMPTS.md)

## The geometry, in one line

With the wall at x = 0, the light at (d, H) and an eye at height ze standing x from the wall, the eye sees the lamp's
mirror image at height z_hit = ze + (H - ze) x / (x + d). Glare needs that point on the glass, between its bottom
edge zb and top edge zt. Example (3 m ceiling, glass 100 to 200 cm, light 80.78 cm out as the standard rule gives):
standing 0 to 32.31 cm from the wall, wheelchair 0 to 73.51 cm, child 0 to 77.55 cm.
The zone ends are 0.40, 0.91 and 0.96 x 80.78 = 32.31, 73.51 and 77.55 cm (standing, seated, child seated).

## Real-scale check (LEAF C18)

C18 measures what is drawn at run time, in world centimetres along the practice wall's own axes, and compares each value with the brief. Measured in the Lens Studio preview on 2026-11-02 (BUILD_LOG row 19):

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

With the whole practice gallery scaled to 0.9 (a planted break), C18 failed on the opening check: "wall width cm: measured 360.00 cm vs brief 400.00 +/- 1".

## What is simulated, and what is not proven

| Area | What the Lens does | Status |
|---|---|---|
| Glare zones | Computed from the plane-mirror geometry of each lamp in the glazing (`Assets/Scripts/GlareMath.ts`, 46 unit tests with hand-worked values). The card says so under the verdict: `Computed for flat glass in this room; manufacturer lamp data, not measured` | Computed, not measured with a light meter or a camera |
| Lamps | TSLight RXT13 photometry from its specification sheet (https://www.tslight.com/downloads/m-512/1d99ff1244e54a47be5f206f3174b108/rxt-series-specification-sheet): the 40 deg reflector at 2,700 cd (default) or the 20 deg reflector at 5,000 cd, centre-beam candlepower at 3000K, CRI 83 (shown on the results cards as "TSLight RXT13, manufacturer data, not measured") | Manufacturer data, not measured. The model holds the centre-beam value across the whole beam angle, and the sheet's 45 deg maximum tilt is not enforced |
| Room | Practice wall, print and floor at the brief's sizes, 300 cm ceiling, viewing area 60 to 182 cm from the wall | A sample room. Real rooms differ |
| Eye heights | 160 cm (CCI Notes 2/3), 109 and 104 cm (Smithsonian guidance). A "My eyes" height under 104 cm is named beside the verdict (`All three: clear; My eyes (96 cm): glare`) | Published guidance, not measured visitors. The UK Inclusive Mobility guide gives wheelchair users' eye heights from 96 cm. At the 62 cm demo setback a 96 cm eye sees glare to 64.48 cm (C22), and "All three" does not cover it |
| Sound | One cue, when the card turns "All three: clear" (CLAD build-sfx) | LEAF checks that the cue starts on that frame in the preview (C23). Not heard on a device |
| Device | Every test ran in the Lens Studio preview (SPECS 27 simulated) on a desktop PC | Not tried on SPECS hardware |
| Wall placement | Real World Query hits in the preview's "Sunlit Room" | The pinch-release detection is untested (LEAF cannot make a free-space pinch). None of it was tried on a device |
| Palm-up menu | Shown and pressed in the preview | Palm-up detection is untested (LEAF cannot raise a palm) |
| Performance | Preview traces: idle frame interval p50 22.60 ms, drag p50 32.76 ms (BUILD_LOG "Perf") | Desktop preview numbers, not SPECS frame times |
| Session log | One `GLARE_LOG` line per light move. `devpost/tools/summarize_session.py` recomputes the verdict | Checked on LEAF runs (scripted), not on a real session |
| Real scale | See [Real-scale check (LEAF C18)](#real-scale-check-leaf-c18) (measured in the preview's world units) | Measured in the preview scene, not on a device |

## Prior work

We did not find an existing tool that maps reflection zones for seated and child visitors (patents, app stores,
GitHub, and English, German, Japanese, Korean, French and Dutch museum sources, searched November 2026).

## Snap's Spectacles guidance (Snap's own words, developers.snap.com: Publishing Your Spectacles Lens, Design Best Practices, Positioning & Sizing Content)

| Snap asks for | Glare Zone | Evidence |
|---|---|---|
| "Target 60 FPS at all times" | Desktop preview only, not SPECS. v0.4 traces: idle frame interval p50 22.60 ms, drag p50 32.76 ms | BUILD_LOG "Perf" |
| "Show the version number visibly on Lens launch" and log "Lens Opened: vX.X.X" | visible v0.4 label + "Lens Opened: v0.4" log line | `GlareLayout.ts`, `GlareZoneController.ts` |
| "Provide a debug menu and in-lens tests" | 24 LEAF scenarios + 50 unit tests. New checks were broken on purpose to prove they turn red | devpost/BUILD_LOG.md |
| "Add an onboarding" / headline | headline states the answer for the selected eye height | LEAF check |
| "a beginning, middle and end, and a way to repeat" | Save results, Done / Restart | LEAF check |
| "Avoid Steep Neck Angles" | main panels near eye level, floor handles on the floor, nothing at the ceiling lamp | layout |
| "Provide a background behind text" | light backing panels on floor labels and legend | captures |
| Targets "at least 2 degrees in angular size", "spaced at least 1 degree apart" | Smallest target 2.10 deg, smallest gap 1.04 deg. Measurements below from the row 32 run on 2026-11-03 13:42 | LEAF C8, BUILD_LOG row 32 |
| Preview image, custom icon, release notes | `devpost/media/icon_512.png`, `preview_3x4.png`. Release notes in BUILD_LOG | files |
| On-device testing | Not possible: built and tested in the Lens Studio preview only | stated |

### Pinch target sizes, as measured

| What | Measured (C8) | Snap guidance |
|---|---|---|
| Smallest target, buttons | 2.20 deg (More open, Standing and My eyes), 2.48 deg with More closed | at least 2 deg |
| Smallest target, floor and aim handles | 2.10 deg (viewing area near edge handle). Aim handles 2.42 deg | at least 2 deg |
| Smallest gap between targets | 1.04 deg (More open, Seated and Child seated), 1.08 deg with More closed | at least 1 deg |
| Palm menu buttons | 5.37 deg, gap 1.85 deg | at least 2 deg |
| Results view | 2.50 deg, gap 1.14 deg | at least 2 deg |

## Done criteria, measured in the running Lens

From the row 32 run (2026-11-03, Lens Studio preview, fail-fast), each value read from the running Lens by the named scenario. Hand values are worked from the brief's geometry check, not from `GlareMath.ts`.

| Done criterion | Measured in the running Lens | Tolerance | Test |
|---|---|---|---|
| Seated and Standing zones appear, with depth in cm | Seated 73.51 cm, Standing 32.31 cm, Child seated 77.55 cm (hand 0.91, 0.40 and 0.96 x 80.78). Every zone starts at the wall (glass bottom 100 cm) | 0.05 cm | C1 |
| Sliding updates both zones while dragging | Both zones match 0.91 x D and 0.40 x D at every sample taken while held (aim handle and distance slider) | 1.0 cm (one frame of lag) | C2 |
| Tilting updates both zones while dragging | 22 fixed knob positions: tilt 31.341 to 18.618 deg. Seated 73.51 cm at steps 1 to 15, then 71.50, 69.21, 67.05, 65.00, 63.06, 61.21 and 59.45 cm at steps 16 to 22 | tilt 0.01 deg, zones 0.15 cm | C2 |
| Paper art: parts over 50 lux glow amber. Dimming clears it | Print centre 779 lux at full (glows). At 5% some cells still over 50 lux. At 3% none. Every cell checked against the fixture computed in the test | each of 400 cells | C3, C21 |
| Inside a zone: a spot on the glass. Stepping out removes it | Spot positions at the hand positions for Seated, Child seated and Standing. No spot past the far edge | 0.05 cm | C4 |
| Save: a card per light with tilt, distance, dimmer, pass or fail | "Tilt 32.3 deg from vertical", "Distance from wall 80.8 cm", "Dimmer 100%" (and 50%), Standing PASS 32.3 cm, Seated FAIL 73.5 cm, Child seated FAIL 77.5 cm, "TSLight RXT13, manufacturer data, not measured" | exact text | C5 |
| Pass = zone outside the viewing area | Floor overlap at the standard placement runs from the 60 cm near edge to 73.51 cm. Gone at 62 cm | 0.1 cm | C12 |
| Real scale | Wall 400.00 x 300.00 cm. Print 100.00 x 100.00 cm, centre 150.00 cm, glass bottom 100.00 cm. Lights 80.78 cm from the wall, 300.00 cm up, at -50.00 and +50.00 cm. Eyes 160.00, 109.00, 104.00 cm | 1 cm (wall), 0.1 cm (light distance), 0.5 cm (the rest) | C18 |
| Suggest a setback | 62.499 cm (hand 60 / 0.96 = 62.5), labelled "All three clear at 62.4 cm". Solved in 23.4 ms | 0.01 cm | C20 |
| Reflector | 40 deg: seated 73.51 cm, 20 deg: seated 72.41 cm, standing 31.50 cm | 0.15 cm | C21 |
| My eyes below the verdict heights | 96 cm eye, lights at 62 cm: glare to 64.48 cm (hand 62 x 104 / 100). Card `All three: clear; My eyes (96 cm): glare` | 0.05 cm | C22 |
| Clear cue | Played on frame 60, the frame the card turned clear, 0.90 s, volume 0.35 | same frame | C23 |
| Model limits on the card | `Computed for flat glass in this room; manufacturer lamp data, not measured` shown, in view and inside the card in 9 card states | every state | C24 |
| Pinch targets | Smallest target 2.10 deg, smallest gap 1.04 deg ([pinch measurements above](#pinch-target-sizes-as-measured)) | over 2 and 1 deg | C8 |

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
