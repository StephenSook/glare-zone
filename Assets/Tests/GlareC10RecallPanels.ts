// LEAF scenario: "Bring panels here" (palm-up hand menu) recalls the near panels in front of
// the viewer at once (Snap: users should be able to recall or summon any critical UI).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {
  aabbCorners,
  controller,
  interactable,
  outOfView,
  resetToStandard,
  stepTo,
  targetVisual,
  turnHeadBy,
} from "./GlareLeafHelpers"
import {GlareZoneController} from "../Scripts/GlareZoneController"

const BUTTONS = ["Eye height button", "Save results button", "More button"]

/** Answer card and main buttons inside the display ("" when all are in view). */
function panelsOutOfView(c: GlareZoneController): string {
  let out = outOfView(c, c.answerCardCorners(), 0.5)
  for (const n of BUTTONS) out += outOfView(c, aabbCorners(targetVisual(interactable(n).getSceneObject())), 0.5)
  return out
}

/**
 * 10. Turn away, or walk 2 m: the panels are out of view; raise the palm and press "Bring
 * panels here": the panels are in front of you at once, facing you.
 */
@component
export class GlareC10RecallPanels extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)
    const y = c.eyeLocal().y
    const cam = c.cameraObject.getTransform()
    // Where a raised left palm would put the button: about 40 cm out, 20 cm down.
    const palmUp = () => c.handMenu().showAt(cam.getWorldTransform().multiplyPoint(new vec3(0, -20, -40)), 3)

    // Positive control: in view at the start. The button only shows while the palm is up.
    expect(panelsOutOfView(c), "panels in view at the start").toBe("")
    expect(c.handMenu().isShowing(), "no hand menu without a raised palm").toBe(false)

    // Turn around: the panels stay in the room (they follow walking, not turning), so they are
    // out of view, and waiting does not bring them.
    await turnHeadBy(c, 180)
    await sleep(1000)
    expect(panelsOutOfView(c) !== "", "panels behind you after turning around").toBe(true)
    palmUp()
    await sleep(200)
    expect(c.handMenu().isShowing(), "hand menu shows with the palm up").toBe(true)
    await interactor.trigger(interactable("Bring panels here button"))
    await sleep(150)
    expect(panelsOutOfView(c), "after Bring panels here: panels in front of you").toBe("")
    expect(Math.abs(Math.abs(c.panelFollowState().yaw) - Math.PI) < 0.05, `panels turned to face you: yaw ${c.panelFollowState().yaw}`).toBe(true)

    // Walk 2 m away (from 1 m to 3 m from the wall, still facing away from it) and press it at
    // once, before any glide could finish: the panels are there straight away.
    await stepTo(c, new vec3(0, y, 100), 0)
    c.recallPanels()
    await sleep(100)
    await stepTo(c, new vec3(0, y, 300), 0)
    expect(panelsOutOfView(c) !== "", "right after walking 2 m the panels are not in view yet").toBe(true)
    palmUp()
    await sleep(100)
    await interactor.trigger(interactable("Bring panels here button"))
    await sleep(100)
    expect(panelsOutOfView(c), "after Bring panels here: in view at once").toBe("")
    // A recall snaps (at rest, exactly at the eye); the lazy glide could not have finished yet.
    const f = c.panelFollowState()
    expect(!f.moving && Math.abs(f.z - 300) < 0.5, `snapped, not gliding: ${JSON.stringify(f)}`).toBe(true)

    await turnHeadBy(c, -180)
    await resetToStandard(c)
    expect(panelsOutOfView(c), "back at the start, facing the wall").toBe("")
  }
}
