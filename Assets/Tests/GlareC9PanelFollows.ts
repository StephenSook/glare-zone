// LEAF scenario: the near panels follow the viewer lazily (Snap: users should be able to
// recall or summon any critical UI), and are never head-locked.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  aabbCorners,
  angularRect,
  angularSize,
  controller,
  interactable,
  near,
  outOfView,
  resetToStandard,
  stepTo,
  targetVisual,
  turnHeadBy,
  viewAngles,
} from "./GlareLeafHelpers"

const SETTLE_MS = 2500 // the glide takes about 4 x 0.45 s

/**
 * 9. Walk to 1 m from the wall: the answer card and the main buttons glide (not jump) into
 * the display rectangle, in front of the wall, with every button still at least 2 deg.
 * A small step inside the dead zone and a head turn do not move them.
 */
@component
export class GlareC9PanelFollows extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    const y = c.eyeLocal().y
    const buttons = ["Eye height button", "Save results button", "More button"]
    const inViewNow = (label: string) => {
      expect(outOfView(c, c.answerCardCorners(), 0.5), `${label}: answer card in view`).toBe("")
      for (const n of buttons) {
        expect(outOfView(c, aabbCorners(targetVisual(interactable(n).getSceneObject())), 0.5), `${label}: ${n} in view`).toBe("")
      }
    }

    // Positive control: at the start position everything is in view, panels at rest.
    inViewNow("start")
    const f0 = c.panelFollowState()
    expect(near(f0.z, 300, 0.5) && near(f0.s, 1, 0.001) && !f0.moving, `panels at rest at the start: ${JSON.stringify(f0)}`).toBe(true)

    // Walk to 1 m from the wall. Negative control for the in-view check: the panels were
    // 1 m in front of the start, so right after the step they are behind the viewer.
    await stepTo(c, new vec3(0, y, 100), 0)
    expect(outOfView(c, c.answerCardCorners()) !== "", "right after the step the card is not yet in view").toBe(true)
    // They glide rather than jump: sampled every ~30 ms, several positions lie in between.
    const path: number[] = []
    for (let i = 0; i < 40; i++) {
      path.push(c.panelFollowState().z)
      await sleep(30)
    }
    const between = path.filter((z) => z < 295 && z > 105)
    const distinct = between.filter((z, i) => i === 0 || Math.abs(z - between[i - 1]) > 0.5).length
    expect(distinct, `glide: ${distinct} in-between positions, ${path.map((z) => z.toFixed(0)).join(" ")}`).toBeGreaterThan(2)
    for (let i = 1; i < path.length; i++) {
      expect(path[i] <= path[i - 1] + 1e-6, "the glide only moves toward the viewer").toBe(true)
    }
    await sleep(SETTLE_MS)
    const f1 = c.panelFollowState()
    expect(f1.moving, "settled").toBe(false)
    expect(near(f1.z, 100, 1), `followed to the viewer: z ${f1.z}`).toBe(true)
    expect(near(f1.s, 0.85, 0.01), `nearer and smaller in front of the wall: scale ${f1.s}`).toBe(true)
    inViewNow("1 m from the wall")
    // In front of the wall, not inside it: the card plane is 15 cm out from the wall.
    const cardLocal = c.galleryObject().getTransform().getInvertedWorldTransform()
      .multiplyPoint(c.answerCardObject().getTransform().getWorldPosition())
    expect(cardLocal.z, `answer card ${cardLocal.z.toFixed(1)} cm in front of the wall`).toBeGreaterThan(5)
    for (const n of buttons) {
      const s = angularSize(angularRect(c, aabbCorners(targetVisual(interactable(n).getSceneObject()))))
      expect(s, `${n} still ${s.toFixed(2)} deg at 1 m`).toBeGreaterThan(2)
    }

    // A small step sideways (inside the 25 cm dead zone): the panels stay put.
    await stepTo(c, new vec3(15, y, 100))
    await sleep(1000)
    const f2 = c.panelFollowState()
    expect(near(f2.x, 0, 0.01) && near(f2.z, 100, 0.01), `lazy: no move for a 15 cm step: ${JSON.stringify(f2)}`).toBe(true)

    // Turn the head 20 deg: the panels stay in the room (not head-locked), so their
    // direction from the eye changes by about 20 deg.
    const before = viewAngles(c, c.answerCardObject().getTransform().getWorldPosition()).x
    await turnHeadBy(c, 20)
    await sleep(1000)
    const after = viewAngles(c, c.answerCardObject().getTransform().getWorldPosition()).x
    const f3 = c.panelFollowState()
    expect(near(f3.x, f2.x, 0.01) && near(f3.z, f2.z, 0.01), "a head turn does not move the panels").toBe(true)
    expect(Math.abs(after - before), `card direction moved ${(after - before).toFixed(1)} deg with the turn`).toBeGreaterThan(15)
    await turnHeadBy(c, -20)

    // Walk back to the start: they follow back.
    await stepTo(c, new vec3(0, y, 300))
    await sleep(SETTLE_MS)
    const f4 = c.panelFollowState()
    expect(near(f4.z, 300, 1) && near(f4.s, 1, 0.01), `followed back: ${JSON.stringify(f4)}`).toBe(true)
    inViewNow("back at the start")
    await resetToStandard(c)
  }
}
