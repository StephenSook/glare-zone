---
status: approved
---

# Design brief: Glare Zone

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
I'm standing about 2 m back from a gallery wall with my hand on the aim handle beside the print. I slide and tilt the light with the handle and watch the print plus a glare band drawn on the wall at each eye height, so everything I need is in one view. The floor zones are a quick glance down to confirm: where a standing visitor would see glare in the glass, and where a seated visitor would. I keep sliding and tilting until the seated zone is out of the area where people stand to look.

The demo: the standard placement passes standing visitors and fails seated ones, then a slide toward the wall to 62 cm makes all three eye heights pass (standing, seated and child seated).

Who it is for: museum and gallery preparators, the people who aim gallery lights. The usual rule of thumb assumes one adult eye height of about 160 cm. The Smithsonian's accessibility guide says to eliminate reflection and glare "for those who are seated or short as well as for those who are standing", with seated eye heights around 109 to 129 cm for an adult wheelchair user and about 104 cm for a child. A light that looks fine standing can put glare in the picture glass for someone seated. This Lens shows that while the light is being aimed.

## Why it belongs on glasses
- Uses: shares your view, draws in the world, leaves your body free.
- Why it's better than the phone or laptop version: glare only exists from an eye position, my hands are on the fixture, and the answer belongs on the real floor and on the real picture.

## Product or overlay
- Type: overlay. On real glasses it would sit on a real gallery wall. For this Lens it is a practice wall: a real-size wall, one glazed print and two track lights.
- What the real version would sense: the real wall, the framed print, the track lights and where my eyes are.
- Stand-in for the preview:
  - The practice wall, print and lights are built in the Lens at real size.
  - The reflection is computed from the geometry, not a real optical reflection, and the light level on the print is computed from the fixture's numbers. Both are labelled on screen: "Computed reflection from your eye position, not optical" and "Light level computed from sample fixture values, not measured" (default wording).
  - Eye heights are big buttons (Seated, Child seated, Standing) instead of crouching. (default) A button moves my eye height by placing the practice gallery's floor so the camera sits exactly at that height; the glare check uses the same height.
  - (default) Computed reflection: mirror each light across the glass plane. An eye sees glare where the line from the eye to the mirrored light passes through the lit part of the glass (inside that light's beam). A glare zone for an eye height is every floor position where that happens at that height.
  - Geometry check (a model, labelled as computed): seen from the side, a light at ceiling height C and distance D from the wall puts glare in the glass, for an eye at height h, out to D x (Y - h) / (C - Y) from the wall, where Y is the top of the lit glass. With a 300 cm ceiling and the print top at 200 cm, that is 0.91 x D for seated 109 cm eyes and 0.40 x D for standing 160 cm eyes. Tilt mostly decides whether the beam lights the glass (and so sets Y); sliding changes D.
  - (default) Computed light level at a point on the print: intensity toward that point x cos(angle of incidence) / distance squared, scaled by the dimmer, summed over both lights.
  - (default) Sample fixture values, labelled as sample on screen: 25 degree beam, 1,500 cd at full. Replace with a real fixture's published values (no brand shown) before quoting any lux figure.

## Where things live
- Where the user is looking during the main task: at the print, the aim handle and the glare bands on the wall, from about 2 m back. The floor zones are a quick glance down.
- Gallery wall: real size, about 3 m tall, (default) 400 cm wide, placed about 2 m in front of me at start.
- Glazed print: 100 cm wide, hung at a normal height: (default) 100 cm tall, centre 150 cm above the floor, so the top of the glass is at 200 cm as in the geometry check. A public-domain image (licence checked) or a plain sample labelled "Sample print". No museum name or logo.
- Two track lights: on the ceiling (300 cm). Each slides along its ceiling track toward or away from the wall, (default) 30 to 150 cm out. (default) 100 cm apart, one each side of the print's centre line. (default) Both start at the standard placement, about 81 cm out ((300 - 160) x 0.577, the rule of thumb for 160 cm eyes; the interview said "about 1 m out"), aimed at the print centre.
- Aim handles: a grab handle beside the print at eye level controls the ceiling light. (default) One handle per light, each 15 cm outside its side of the frame, centre 150 cm high, a 12 cm knob standing 10 cm off the wall, with a thin faint line up to the light it controls.
- Dimmer slider: you said "on the fixture". (default) Placed directly under that light's aim handle, 25 cm long, so it stays in the same view as the print.
- Distance slider: a "Distance from wall" slider under the dimmer slides that light along its track, the same job as pushing or pulling the aim handle, so sliding works with a mouse in the preview. (default) 25 cm long, 30 to 150 cm, showing the distance in cm.
- Glare bands: drawn on the wall at each eye height. (default) A 3 cm strip on the wall either side of the print at 160, 109 and 104 cm, coloured to match its floor zone, labelled with the eye height and how far its glare zone reaches from the wall in cm. Labels must not overlap (109 and 104 are only 5 cm apart).
- Floor zones: drawn flat on the floor in front of the wall, each with its depth from the wall in cm. (default) One zone per eye height (Standing 160 cm, Seated 109 cm, Child seated 104 cm), combining both lights. Bright, distinct colours; amber is kept only for the light limit. Depth label at each zone's far edge, facing me, text about 6 cm tall.
- Viewing area: a strip on the floor from 60 to 182 cm out from the wall (60 cm is a close look; 122 cm is a wheelchair user's clear floor space in the Smithsonian guide). (default) As wide as the print plus 50 cm each side, outlined, labelled "Viewing area 60 to 182 cm".
- Buttons: Seated, Child seated, Standing, "Works on paper", "Save light sheet". (default) One row on the wall just below the print, centre 85 cm high, each about 18 x 10 cm.
- Light sheet card: by the fixture. (default) Because the fixture is about 55 degrees above my eye line from 2 m back, the card sits on the wall next to that light's aim handle, about 25 x 18 cm.
- Nothing floats in front of my face.

## Hands and input
- Slide and tilt a light: pinch-grab its aim handle and drag. The aim handle slides the light toward or away from the wall along the ceiling track and tilts it. (default) Drag up or down to tilt (up aims higher on the wall); push toward the wall or pull toward you to slide the light the same way. The light on the ceiling moves to match.
- Slide a light with the slider: drag the "Distance from wall" slider under its dimmer; the light moves along its track the same way as with the handle.
- Dim a light: drag the dimmer slider under its aim handle.
- Change eye height: pinch Seated, Child seated or Standing.
- Light limit: pinch "Works on paper" (a toggle) to turn on the 50 lux limit.
- Save: pinch "Save light sheet".
- Change the viewing area per gallery: (default) pinch-drag a handle on the near or far edge of the floor strip, snapping in 5 cm steps.
- Targets are big and highlight when aimed at.
- Voice: none. No custom gestures.

## When things show
- Floor zones: show while I am adjusting a light and stay faint afterwards.
- Glare bands on the wall: (default) same as the floor zones: full while adjusting, faint afterwards.
- Amber glow: with "Works on paper" on, any part of the print over 50 lux glows amber until I dim the light.
- Glare spot: if I stand inside a zone at its eye height, a glare spot appears on the glass at the computed point; stepping out removes it. (default) A soft bright spot about 8 cm across.
- Light sheet card: "Save light sheet" puts a card by the fixture with tilt, distance, dimmer and pass or fail per eye height. A light passes for an eye height only if that height's glare zone stays outside the viewing area. (default) One card per light; tilt in degrees from vertical, distance is the light's distance from the wall in cm, dimmer in percent. A new save replaces that light's card.
- Viewing area strip: (default) always shown, faint.
- If something needs attention out of view: none. Everything for the main task sits on the wall in one view; the floor is a glance down.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. "Seated" and "Standing" glare zones appear on the floor, each showing its depth from the wall in cm.
2. Sliding or tilting a light updates both zones while dragging.
3. With "Works on paper" on, parts of the print over 50 lux glow amber; turning the dimmer down clears it.
4. At an eye height, standing inside that height's zone shows a glare spot on the glass; stepping out removes it.
5. "Save light sheet" puts a card by the fixture with tilt, distance, dimmer and pass or fail per eye height, where pass means that height's zone stays outside the 60 to 182 cm viewing area.

## Unit test plan: glare reach
The glare math lives in one pure module with no scene objects, so it can be tested on its own (default). Expected values below are worked by hand from the geometry check. They show the code implements the model; they don't show the model matches real glass, so label them computed wherever they appear.

- Model: reach(D, C, Y, h) = D x (Y - h) / (C - Y), the furthest distance from the wall at which an eye at height h sees a light's reflection. If h is at or above Y, reach is 0. A light passes for an eye height when reach is less than the viewing area's near edge (60 cm).
- Inputs unless stated: C = 300 cm, Y = 200 cm. Tolerance 0.1 cm.

1. Factor (Y - h) / (C - Y): seated 109 cm gives 0.91; standing 160 gives 0.40; child seated 104 gives 0.96.
2. Standard placement: D = (300 - 160) x 0.577 = 80.78 cm (the CCI example, about 81 cm; re-read the source before quoting it).
3. At D = 80.78: standing reach 32.31 cm, pass; seated 73.51 cm, fail; child seated 77.55 cm, fail.
4. At D = 65: standing 26.00, pass; seated 59.15, pass; child seated 62.40, fail.
5. At D = 62 (the demo target): standing 24.80, seated 56.42, child seated 59.52: all pass.
6. Boundary: a reach of 59.9 passes and 60.1 fails (pass means strictly inside the near edge) (default).
7. Eye above the lit glass: h = 210 gives reach 0.
8. Tilt lowers the lit top: Y = 180 gives a seated factor of 0.5917, so at D = 80.78 seated reach is 47.79 cm, pass.
9. Beam misses the glass entirely: no glare zone at any eye height.
10. Reach is linear in D: doubling D doubles reach.
11. 3D check: an eye in line with a light (same position along the wall) gives the 2D reach; an eye far enough to the side that the reflection falls outside the print's width sees no glare.
12. Viewing area edited to 40 to 182 cm: seated at D = 62 (56.42 cm) now fails.

## Later (after the core passes)
- More prints or walls.
- Keeping light sheets between sessions.

**Not in this Lens:** real optical measurement, recognising real objects, voice, custom gestures, recording anyone.

## Risks and open questions
- The reflection is computed, not optical; I say so on screen.
- It can read as a specialist tool, so the pitch leads with glare on a framed picture and the seated visitor.
- The 160 cm aiming rule's source (CCI Notes 2/3) gets re-read before it is quoted.
- The geometry check is a 2D point-source mirror model, not a measurement. It says seated passes only at about 65.9 cm out or closer (at exactly 66 cm seated reaches 60.06 cm, a fail), and child seated only at 62.5 cm or closer. So a slide to about 65 cm makes standing and seated pass while child seated still fails on the light sheet; sliding to 62 cm passes all three, so the demo target is 62 cm. Keep these numbers out of the film until the shipped code computes them.
- Sliding by pushing or pulling the handle toward or away from the wall may be hard with a mouse in the preview (unverified). The "Distance from wall" slider does the same job, so done criterion 2 stays showable.
- The print is 100 cm tall (default) so its top sits at 200 cm, as the geometry check assumes. A shorter print changes every number above.
- The eye-height buttons move the practice gallery, not me. On real glasses I would sit or crouch. Feel unproven.
- The aim handle stands in for my hand on the fixture. Feel unproven.
- Seated uses 109 cm, the low end of the 109 to 129 cm range, because the lowest eye gives the zone that reaches furthest (default).
- Child seated is drawn as a third zone and band, beyond the two zones named in done criterion 1 (default).
- Sample fixture values are not a real fixture. Replace them with a real fixture's published values before quoting any lux figure.
- The print image licence is checked before it ships. If a real preparator gives feedback, quote only with consent.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
