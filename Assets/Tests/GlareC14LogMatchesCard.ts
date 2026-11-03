// LEAF scenario: every light move writes one session log line, and the line matches what the
// answer card shows (BUILD_LOG row 13). devpost/tools/summarize_session.py reads the same lines
// from a Logger export and recomputes the verdict with the same rule.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import * as G from "../Scripts/GlareMath"
import {DragKnob} from "../Scripts/DragKnob"
import {GlareZoneController} from "../Scripts/GlareZoneController"
import {controller, galleryDir, interactable, near, resetToStandard, sampleWhileHeld} from "./GlareLeafHelpers"

const EYES = ["standing", "seated", "child"]
const SETTLE_MS = 1600 // longer than the Lens's 1.2 s adjusting hold, so the move has closed

/** The verdict from a log line's own fields: the rule summarize_session.py uses. */
function recompute(f: {[k: string]: string}): string {
  for (const e of EYES) {
    const end = parseFloat(f[`${e}_end_cm`])
    if (!isFinite(end)) return "glare"
    if (f[`${e}_in_cm`] !== "-") return "glare"
  }
  return "clear"
}

/** The reach a legend line on the answer card states, in cm ("...glare up to 73.5 cm (2 ft 5 in)..."). */
function cardReach(text: string): number {
  const m = text.match(/glare up to ([0-9.]+) cm/)
  return m ? parseFloat(m[1]) : 0
}

/** The newest log line must match the light, the answer card and the Lens's own verdict. */
function checkLine(c: GlareZoneController, tag: string, seq: number, light: number): void {
  const lines = c.logLines()
  const f = G.parseLogLine(lines[lines.length - 1])!
  expect(f !== null, `${tag}: a GLARE_LOG line`).toBe(true)
  expect(f.seq, `${tag}: sequence number`).toBe(`${seq}`)
  expect(f.light, `${tag}: which light`).toBe(light === 0 ? "L" : "R")
  expect(f.distance_cm, `${tag}: light distance`).toBe(c.lights[light].distanceCm.toFixed(2))
  expect(f.tilt_deg, `${tag}: light tilt`).toBe(c.lights[light].tiltDeg.toFixed(2))
  const area = c.getViewingArea()
  expect(f.viewing_near_cm, `${tag}: viewing area near edge`).toBe(area.min.toFixed(2))
  expect(f.viewing_far_cm, `${tag}: viewing area far edge`).toBe(area.max.toFixed(2))
  const now = c.eyeResults()
  for (const e of EYES) {
    const end = parseFloat(f[`${e}_end_cm`])
    expect(f[`${e}_end_cm`], `${tag}: ${e} zone end`).toBe(c.zoneFarEdgeCm(e as "standing").toFixed(2))
    // The answer card's line shows the chosen eye height's reach (Standing here) to one
    // decimal: equal to the exact reach rounded, and within both roundings of the logged value
    // (0.05 + 0.005 cm). Re-rounding the log's two decimals is not the same: 77.5488 logs as
    // 77.55 but shows as 77.5.
    if (e === c.getEyePreset()) {
      const shown = cardReach(c.headlineText())
      const exact = G.oneDecimal(c.zoneFarEdgeCm(e as "standing"))
      expect(shown.toFixed(1), `${tag}: ${e} on the card ${shown} vs the zone ${exact}`).toBe(exact)
      expect(Math.abs(shown - end) <= 0.0551, `${tag}: ${e} on the card ${shown} vs log ${end}`).toBe(true)
    }
    const inside = now.filter((r) => r.key === e)[0].insideCm
    expect(f[`${e}_in_cm`], `${tag}: ${e} depth into the viewing area`).toBe(inside === null ? "-" : inside.toFixed(2))
  }
  expect(f.verdict, `${tag}: logged verdict is the Lens's verdict`).toBe(c.verdict())
  // The card's verdict line says the same as the log.
  expect(c.verdictLineText() === "All three: clear", `${tag}: card verdict "${c.verdictLineText()}" vs log ${f.verdict}`)
    .toBe(f.verdict === "clear")
  expect(recompute(f), `${tag}: verdict recomputed from the line`).toBe(f.verdict)
}

/** 14. One log line per light move, matching the answer card. */
@component
export class GlareC14LogMatchesCard extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)
    await sleep(SETTLE_MS)

    // Controls for the recompute rule: a standard-placement line is glare, the same line with
    // every zone outside the area is clear, and a line with an end that cannot be computed is glare.
    const std = G.parseLogLine(G.moveLogLine(1, "R", 80.78, 32.35, 60, 182, [
      {key: "standing", endCm: 32.31, insideCm: null},
      {key: "seated", endCm: 73.51, insideCm: 13.51},
      {key: "child", endCm: 77.55, insideCm: 17.55},
    ]))!
    expect(recompute(std), "control: standard placement recomputes as glare").toBe("glare")
    const out = {...std, seated_in_cm: "-", child_in_cm: "-"}
    expect(recompute(out), "control: every zone outside recomputes as clear").toBe("clear")
    expect(recompute({...out, child_end_cm: "nan"}), "control: an end that cannot be computed is glare").toBe("glare")

    // A real drag of the right aim handle toward the wall: no line while it is held, one line
    // once the move settles.
    const n0 = c.logCount()
    const handle = interactable("Aim handle R")
    const knob = handle.getSceneObject().getComponent(DragKnob.getTypeName()) as DragKnob
    const drag = interactor.drag(handle, galleryDir(c, new vec3(0, 0, -0.3)), 1500)
    const during = await sampleWhileHeld(drag, () => knob.isHeld, () => [c.logCount()])
    expect(during.length, "samples taken while the handle was held").toBeGreaterThan(3)
    expect(during.every((s) => s[0] === n0), "no log line while the handle is held").toBe(true)
    expect(c.isMoveOpen(), "the move is still open right after release").toBe(true)
    await sleep(SETTLE_MS)
    expect(c.logCount(), "one line for the whole drag").toBe(n0 + 1)
    expect(c.lights[1].distanceCm, "the drag moved the light toward the wall").toBeLessThan(78)
    checkLine(c, "after the drag", n0 + 1, 1)

    // Both lights moved in one go: one line each, left then right, numbered in order.
    c.setLightDistance(0, 70)
    c.setLightDistance(1, 70)
    await sleep(SETTLE_MS)
    expect(c.logCount(), "two lights moved: two lines").toBe(n0 + 3)
    const both = c.logLines().slice(-2).map((l) => G.parseLogLine(l)!)
    expect(both[0].light + both[1].light, "left line then right line").toBe("LR")
    checkLine(c, "both lights at 70 cm", n0 + 3, 1)

    // A change that does not move a light (the dimmer) writes nothing.
    c.setDimmer(0, 0.5)
    await sleep(SETTLE_MS)
    expect(c.logCount(), "dimmer only: no new line").toBe(n0 + 3)

    // Both lights at 60 cm: the whole glass stays lit, so the child seated reach is
    // 0.96 x 60 = 57.6 cm, inside the 60 cm near edge; every zone outside: clear.
    c.setLightDistance(0, 60)
    c.setLightDistance(1, 60)
    await sleep(SETTLE_MS)
    expect(near(c.zoneFarEdgeCm("child"), 57.6, 0.1), `child reach at 60 cm ${c.zoneFarEdgeCm("child")} vs hand 57.6`).toBe(true)
    checkLine(c, "both lights at 60 cm", n0 + 5, 1)
    expect(G.parseLogLine(c.logLines()[c.logLines().length - 1])!.verdict, "clear at 60 cm").toBe("clear")

    // Back to the standard placement: glare again (seated 73.51 and child 77.55 reach the area).
    await resetToStandard(c)
    await sleep(SETTLE_MS)
    const last = G.parseLogLine(c.logLines()[c.logLines().length - 1])!
    expect(last.verdict, "standard placement logs glare").toBe("glare")
    expect(c.verdict(), "the Lens's verdict at the standard placement").toBe("glare")
  }
}
