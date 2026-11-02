// Media helper, not a test: the Lens with no text and no panels, for the icon and the 3x4
// preview image (Snap asks for bright colours and no text). Seated preset, standing just
// inside the seated zone so the glare spots and the lamp rays show. Frame with the preview
// camera after it runs; refresh the preview to get the text back.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, hideLeafOverlay, hideTextForArt, press, resetToStandard, stepTo} from "./GlareLeafHelpers"

@component
export class GlareMediaArt extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    await resetToStandard(c)
    await press(new DefaultLeafInteractor(), "Eye height button")
    await stepTo(c, new vec3(0, c.eyeLocal().y, c.zoneFarEdgeCm("seated") - 12))
    c.setMoreOpen(false)
    await sleep(800)
    hideTextForArt(c)
  }
}
