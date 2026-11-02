// Media helper, not a test: "More controls" open, standard placement, for a capture.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, hideLeafOverlay, press, resetToStandard} from "./GlareLeafHelpers"

@component
export class GlareMediaMoreOpen extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    await resetToStandard(c)
    await press(new DefaultLeafInteractor(), "More button")
    await sleep(500)
  }
}
