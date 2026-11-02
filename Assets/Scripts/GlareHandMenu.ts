import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"

const BUTTON_W = 14
const BUTTON_H = 4.5 // at about 40 cm from the eye this is over 6 deg, well over 2
const ABOVE_PALM_CM = 9

/**
 * A palm-up hand menu with one plain control: "Bring panels here". It shows just above the
 * left palm while the palm faces you (SIK's TrackedHand.isFacingCamera), and calls back so
 * the near panels can be recalled in front of you wherever you are looking.
 *
 * showAt() shows it at a given place for a few seconds without a tracked hand: Lens Studio's
 * preview and the LEAF scenarios have no palm to turn up.
 */
@component
export class GlareHandMenu extends BaseScriptComponent {
  private _onRecall = new Event<void>()
  get onRecall(): PublicApi<void> {
    return this._onRecall.publicApi()
  }

  cameraObject: SceneObject | null = null

  private buttonObj!: SceneObject
  private ready = false
  private forcedUntil = -1
  private forcedPos: vec3 | null = null

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.buttonObj = global.scene.createSceneObject("Bring panels here button")
    this.buttonObj.setParent(this.sceneObject)
    const button = this.buttonObj.createComponent(Button.getTypeName()) as Button
    button.onInitialized.add(() => {
      button.size = new vec3(BUTTON_W, BUTTON_H, 1)
      this.ready = true
    })
    button.onTriggerUp.add(() => this._onRecall.invoke())
    const so = global.scene.createSceneObject("Label")
    so.setParent(this.buttonObj)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
    const t = so.createComponent("Component.Text") as Text
    t.text = "Bring panels here"
    t.depthTest = true
    t.size = 1.0 * 43.886
    ;(t as Text & {weight?: number}).weight = 600
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.layoutRect = Rect.create(-BUTTON_W / 2, BUTTON_W / 2, -1, 1)
    t.textFill.color = new vec4(1, 1, 1, 1)
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  /** Show the button at a world position for a while (preview and tests: no palm to turn up). */
  showAt(worldPos: vec3, seconds: number): void {
    this.forcedPos = worldPos
    this.forcedUntil = getTime() + seconds
  }

  isShowing(): boolean {
    return this.buttonObj.isEnabledInHierarchy
  }

  private update(): void {
    if (!this.ready) return // an element hidden before it initialises never initialises
    let pos: vec3 | null = null
    if (this.forcedPos && getTime() < this.forcedUntil) {
      pos = this.forcedPos
    } else {
      const hand = HandInputData.getInstance().getHand("left")
      const palm = hand.isTracked() && hand.isFacingCamera() ? hand.getPalmCenter() : null
      if (palm) pos = palm.add(vec3.up().uniformScale(ABOVE_PALM_CM))
    }
    this.buttonObj.enabled = pos !== null
    if (!pos) return
    const t = this.buttonObj.getTransform()
    t.setWorldPosition(pos)
    if (this.cameraObject) {
      const toEye = this.cameraObject.getTransform().getWorldPosition().sub(pos)
      if (toEye.length > 1e-3) t.setWorldRotation(quat.lookAt(toEye.normalize(), vec3.up()))
    }
  }
}
