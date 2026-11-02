// Media helper, not a test: the Seated preset from the start position, for a capture.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, hideLeafOverlay, press, resetToStandard} from "./GlareLeafHelpers"

@component
export class GlareMediaSeated extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    await resetToStandard(c)
    await press(new DefaultLeafInteractor(), "Eye height button")
    await sleep(1600)
  }
}
