// Media helper, not a test: Seated preset, standing inside the seated zone on the centre
// line, so the glare spots and their labels show. Pitch the preview camera up to frame them.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, hideLeafOverlay, press, resetToStandard, stepTo} from "./GlareLeafHelpers"

@component
export class GlareMediaInZone extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    await resetToStandard(c)
    await press(new DefaultLeafInteractor(), "Eye height button")
    await stepTo(c, new vec3(0, c.eyeLocal().y, c.zoneFarEdgeCm("seated") - 12))
    await sleep(800)
  }
}
