// Media helper, not a test: leaves the Lens showing saved results for a capture.
// Both lights slid to 62 cm (the demo target), then "Save results" pressed.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, hideLeafOverlay, interactable, resetToStandard} from "./GlareLeafHelpers"

@component
export class GlareMediaSavedSheet extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)
    c.setLightDistance(0, 62)
    c.setLightDistance(1, 62)
    await sleep(1600)
    await interactor.trigger(interactable("Save results button"))
    await sleep(500)
  }
}
