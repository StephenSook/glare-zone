import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"

const BUTTON_W = 14
const BUTTON_H = 4.5 // at about 40 cm from the eye this is over 6 deg, well over 2
const BUTTON_GAP = 1.5 // about 2 deg at 40 cm, over Snap's 1 deg
const ABOVE_PALM_CM = 9

type MenuButton = {name: string; label: string; event: Event<void>}

/**
 * A palm-up hand menu with three plain controls, stacked above the left palm while it faces
 * you (SIK's TrackedHand.isFacingCamera): "Bring panels here" (nearest the palm), "Place in
 * front of me" and "Place on a wall". Each calls back to the controller.
 *
 * showAt() shows it at a given place for a few seconds without a tracked hand: Lens Studio's
 * preview and the LEAF scenarios have no palm to turn up.
 */
@component
export class GlareHandMenu extends BaseScriptComponent {
  private _onRecall = new Event<void>()
  private _onPlaceFront = new Event<void>()
  private _onPlaceWall = new Event<void>()
  get onRecall(): PublicApi<void> {
    return this._onRecall.publicApi()
  }
  get onPlaceFront(): PublicApi<void> {
    return this._onPlaceFront.publicApi()
  }
  get onPlaceWall(): PublicApi<void> {
    return this._onPlaceWall.publicApi()
  }

  cameraObject: SceneObject | null = null

  private stack!: SceneObject
  private readyCount = 0
  private forcedUntil = -1
  private forcedPos: vec3 | null = null

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.stack = global.scene.createSceneObject("Hand menu buttons")
    this.stack.setParent(this.sceneObject)
    const specs: MenuButton[] = [
      {name: "Bring panels here button", label: "Bring panels here", event: this._onRecall},
      {name: "Place in front of me button", label: "Place in front of me", event: this._onPlaceFront},
      {name: "Place on a wall button", label: "Place on a wall", event: this._onPlaceWall},
    ]
    specs.forEach((spec, i) => this.buildButton(spec, i))
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  private buildButton(spec: MenuButton, index: number): void {
    const so = global.scene.createSceneObject(spec.name)
    so.setParent(this.stack)
    so.getTransform().setLocalPosition(new vec3(0, index * (BUTTON_H + BUTTON_GAP), 0))
    const button = so.createComponent(Button.getTypeName()) as Button
    button.onInitialized.add(() => {
      button.size = new vec3(BUTTON_W, BUTTON_H, 1)
      this.readyCount++
    })
    button.onTriggerUp.add(() => spec.event.invoke())
    const labelObj = global.scene.createSceneObject("Label")
    labelObj.setParent(so)
    labelObj.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
    const t = labelObj.createComponent("Component.Text") as Text
    t.text = spec.label
    t.depthTest = true
    t.size = 1.0 * 43.886
    ;(t as Text & {weight?: number}).weight = 600
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.layoutRect = Rect.create(-BUTTON_W / 2, BUTTON_W / 2, -1, 1)
    t.textFill.color = new vec4(1, 1, 1, 1)
  }

  /** Show the menu at a world position for a while (preview and tests: no palm to turn up). */
  showAt(worldPos: vec3, seconds: number): void {
    this.forcedPos = worldPos
    this.forcedUntil = getTime() + seconds
  }

  isShowing(): boolean {
    return this.stack.isEnabledInHierarchy
  }

  private update(): void {
    if (this.readyCount < 3) return // an element hidden before it initialises never initialises
    let pos: vec3 | null = null
    if (this.forcedPos && getTime() < this.forcedUntil) {
      pos = this.forcedPos
    } else {
      const hand = HandInputData.getInstance().getHand("left")
      const palm = hand.isTracked() && hand.isFacingCamera() ? hand.getPalmCenter() : null
      if (palm) pos = palm.add(vec3.up().uniformScale(ABOVE_PALM_CM))
    }
    this.stack.enabled = pos !== null
    if (!pos) return
    const t = this.stack.getTransform()
    t.setWorldPosition(pos)
    if (this.cameraObject) {
      const toEye = this.cameraObject.getTransform().getWorldPosition().sub(pos)
      if (toEye.length > 1e-3) t.setWorldRotation(quat.lookAt(toEye.normalize(), vec3.up()))
    }
  }
}
