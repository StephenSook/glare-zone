// Media helper, not a test: film still 04. Seated eyes, both lights slid to 62 cm (the demo
// target): every zone ends before the viewing area's 60 cm edge.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {controller, hideLeafOverlay, resetToStandard} from "./GlareLeafHelpers"

@component
export class GlareMediaFilm04 extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    await resetToStandard(c)
    c.setEyePreset("seated")
    c.setLightDistance(0, 62)
    c.setLightDistance(1, 62)
    await sleep(1600)
  }
}
