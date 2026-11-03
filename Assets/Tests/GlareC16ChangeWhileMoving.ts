// LEAF scenario: while a light moves, the answer card shows each eye height's change, from
// where its zone ended when the move began to where it ends now ("Seated 73.5 to 56.4 cm"),
// using the same numbers as the zones (v0.4 item B, BUILD_LOG row 15).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import * as G from "../Scripts/GlareMath"
import {DragKnob} from "../Scripts/DragKnob"
import {controller, galleryDir, interactable, resetToStandard, sampleWhileHeld} from "./GlareLeafHelpers"

const EYES: ["standing" | "seated" | "child", string][] = [["standing", "Standing"], ["seated", "Seated"], ["child", "Child seated"]]
const SETTLE_MS = 1600

/** 16. Each eye height's change while a light moves, matching the zone ends. */
@component
export class GlareC16ChangeWhileMoving extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)
    await sleep(SETTLE_MS)

    // At rest: no per-height lines on the card (item D: one line plus the verdict).
    expect(c.isMoveOpen(), "no move open at rest").toBe(false)
    expect(c.mapLaneText("seated"), "no change line at rest").toBe("")
    const before: {[k: string]: number} = {}
    for (const [k] of EYES) before[k] = c.zoneFarEdgeCm(k)

    // The brief's demo move: both lights to 62 cm. Hand values: seated 0.91 x 80.78 = 73.51
    // to 0.91 x 62 = 56.42; standing 32.31 to 24.8; child seated 77.55 to 59.52.
    c.setLightDistance(0, 62)
    c.setLightDistance(1, 62)
    await sleep(300)
    expect(c.isMoveOpen(), "the move is open").toBe(true)
    expect(c.mapLaneText("seated"), "seated change").toBe("Seated 73.5 to 56.4 cm")
    expect(c.mapLaneText("standing"), "standing change").toBe("Standing 32.3 to 24.8 cm")
    expect(c.mapLaneText("child"), "child seated change").toBe("Child seated 77.5 to 59.5 cm")
    // The same numbers as the zones: where they ended when the move began, and now.
    for (const [k, name] of EYES) {
      expect(c.moveStartEnd(k).toFixed(4), `${name}: change starts at the zone end before the move`).toBe(before[k].toFixed(4))
      expect(c.mapLaneText(k), `${name}: change line from the zones`)
        .toBe(`${name} ${G.oneDecimal(before[k])} to ${G.oneDecimal(c.zoneFarEdgeCm(k))} cm`)
    }
    // Once the move settles, the change lines go and the card's line holds the new reach.
    await sleep(SETTLE_MS)
    expect(c.isMoveOpen(), "move closed").toBe(false)
    expect(c.mapLaneText("seated"), "no change line after the move").toBe("")
    expect(c.headlineText(), "the card's line after the move").toBe("Standing: glare up to 24.8 cm (10 in) from the wall")

    // A real drag of the right aim handle: at every sample while it is held, each line reads
    // from the zone end before the drag to the zone end at that moment.
    // Only the right light lights the glass: the left one tilted to 80 deg misses it (as in C2),
    // so the drag changes the combined zones.
    await resetToStandard(c)
    c.setLightTilt(0, 80)
    await sleep(SETTLE_MS)
    for (const [k] of EYES) before[k] = c.zoneFarEdgeCm(k)
    const handle = interactable("Aim handle R")
    const knob = handle.getSceneObject().getComponent(DragKnob.getTypeName()) as DragKnob
    const drag = interactor.drag(handle, galleryDir(c, new vec3(0, 0, -0.3)), 1500)
    // Each sample reads the lines and the zones in the same frame: [lines matching, move open,
    // seated end now].
    const matches = () => EYES.filter(([k, name]) =>
      c.mapLaneText(k) === `${name} ${G.oneDecimal(before[k])} to ${G.oneDecimal(c.zoneFarEdgeCm(k))} cm`).length
    const samples = await sampleWhileHeld(drag, () => knob.isHeld,
      () => [matches(), c.isMoveOpen() ? 1 : 0, c.zoneFarEdgeCm("seated")])
    expect(samples.length, "samples taken while held").toBeGreaterThan(3)
    let changed = 0
    for (const [m, open, seated] of samples) {
      expect(m, `all three lines match the zone ends while held (seated now ${seated.toFixed(2)})`).toBe(3)
      expect(open, "move open while held").toBe(1)
      if (Math.abs(seated - before["seated"]) > 0.05) changed++
    }
    expect(changed > 0, `the seated zone changed during the drag (${changed} of ${samples.length} samples)`).toBe(true)
    await sleep(SETTLE_MS)
    expect(c.mapLaneText("seated"), "change lines gone after the drag").toBe("")
    await resetToStandard(c)
  }
}
