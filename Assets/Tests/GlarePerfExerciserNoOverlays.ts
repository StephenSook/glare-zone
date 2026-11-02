// Perf helper, not a test: the same exerciser with the translucent floor overlays and the
// beam cones hidden, for an A/B comparison of what the transparent layers cost.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {exerciseHandle} from "./GlarePerfExerciser"

const HIDE = ["Floor overlays", "Beam L", "Beam R"]

@component
export class GlarePerfExerciserNoOverlays extends Scenario {
  async run(): Promise<void> {
    const hidden: SceneObject[] = []
    for (const name of HIDE) {
      const so = findSceneObjectByName(name)
      if (so) {
        so.enabled = false
        hidden.push(so)
      }
    }
    try {
      await exerciseHandle()
    } finally {
      for (const so of hidden) so.enabled = true
    }
  }
}
