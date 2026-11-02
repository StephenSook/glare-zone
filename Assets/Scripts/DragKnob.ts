import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

/**
 * A grab handle: a box collider plus a SIK Interactable. It reports the world-space drag
 * movement each frame and highlights while aimed at or held. Used for the aim handles
 * beside the print and the viewing-area edge handles on the floor.
 */
@component
export class DragKnob extends BaseScriptComponent {
  private interactable!: Interactable
  private material: Material | null = null
  private baseColor = new vec4(1, 1, 1, 1)
  private hoverColor = new vec4(1, 1, 1, 1)
  private hovered = false
  private held = false

  private _onDragStart = new Event<void>()
  private _onDragDelta = new Event<vec3>()
  private _onDragEnd = new Event<void>()

  get onDragStart(): PublicApi<void> {
    return this._onDragStart.publicApi()
  }
  get onDragDelta(): PublicApi<vec3> {
    return this._onDragDelta.publicApi()
  }
  get onDragEnd(): PublicApi<void> {
    return this._onDragEnd.publicApi()
  }
  get isHeld(): boolean {
    return this.held
  }

  onAwake(): void {
    // The Interactable is created in configure(), after the collider, so SIK finds the
    // grab volume instead of making a temporary one.
    this.createEvent("OnStartEvent").bind(() => {
      if (!this.interactable) return
      this.interactable.onHoverEnter.add(() => {
        this.hovered = true
        this.refreshColor()
      })
      this.interactable.onHoverExit.add(() => {
        this.hovered = false
        this.refreshColor()
      })
      this.interactable.onTriggerStart.add(() => {
        this.held = true
        this.refreshColor()
        this._onDragStart.invoke()
      })
      this.interactable.onDragUpdate.add((e) => {
        if (e.dragVector) this._onDragDelta.invoke(e.dragVector)
      })
      const release = () => {
        if (!this.held) return
        this.held = false
        this.refreshColor()
        this._onDragEnd.invoke()
      }
      this.interactable.onTriggerEnd.add(release)
      this.interactable.onTriggerCanceled.add(release)
    })
  }

  /** Give the handle its grab volume and the material it tints when aimed at. */
  configure(colliderSize: vec3, material: Material, baseColor: vec4, hoverColor: vec4): void {
    const collider = this.sceneObject.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = colliderSize
    collider.shape = shape
    collider.fitVisual = false
    this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable
    this.interactable.enableInstantDrag = true
    this.material = material
    this.baseColor = baseColor
    this.hoverColor = hoverColor
    this.refreshColor()
  }

  private refreshColor(): void {
    if (!this.material) return
    this.material.mainPass.baseColor = this.hovered || this.held ? this.hoverColor : this.baseColor
  }
}
