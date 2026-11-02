// Perf helper, not a test: keeps the Lens busy the way a user would while a trace records.
// Drags the right aim handle toward the wall and back for about 10 seconds, so the floor
// zones, wall bands, map and beam are rebuilt every frame at full strength.
// Run with the trace already started (specs-capture-perf-trace).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, galleryDir, interactable, resetToStandard} from "./GlareLeafHelpers"

export async function exerciseHandle(): Promise<void> {
  const c = controller()
  const interactor = new DefaultLeafInteractor()
  await resetToStandard(c)
  const handle = interactable("Aim handle R")
  for (let i = 0; i < 3; i++) {
    await interactor.drag(handle, galleryDir(c, new vec3(0, 0, -0.3)), 1500)
    await interactor.drag(handle, galleryDir(c, new vec3(0, 0, 0.3)), 1500)
  }
  await sleep(200)
}

@component
export class GlarePerfExerciser extends Scenario {
  async run(): Promise<void> {
    await exerciseHandle()
  }
}
