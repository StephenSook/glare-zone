import {DynamicMesh, Quad, discQuads, makeText, rectXY, tintedMaterial} from "./DrawKit"
import * as P from "./PlacementMath"
import {InteractionManager} from "SpectaclesInteractionKit.lspkg/Core/InteractionManager/InteractionManager"
import {InteractorInputType, InteractorTriggerType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

/** One World Query hit, in world cm, with the wall test already applied. */
export type WallHit = {position: vec3; normal: vec3; wall: boolean; at: number}

const HIT_PERIOD_S = 0.2 // World Query updates at about 5 Hz; ask no faster
const RAY_CM = 1000 // aim up to 10 m
const ARM_DELAY_S = 0.4 // ignore the pinch that pressed "Place on a wall"
const FRESH_S = 1.0 // a hit older than this is not used for a pinch
const RETICLE_RADIUS_CM = 6
const LABEL_DEG = 0.75 // label em height, as an angle from the eye, so it reads at any distance
const PROMPT_DISTANCE_CM = 100 // where the prompt hangs on the aim ray when nothing is hit
const RETICLE_RENDER_ORDER = 60 // over the practice wall: the real wall may be behind it

export const AIM_WALL = "Pinch to place the print here"
export const AIM_NOT_WALL = "Not a wall. Aim at a wall"
export const AIM_NOTHING = "No surface found. Aim at a wall, or use Place in front of me"

/**
 * Wall placement with World Query: while active, a HitTestSession is asked about the aim ray
 * about five times a second (the hand ray when SIK has one, else the head's forward ray). A
 * reticle shows each hit; a pinch places the practice wall at the latest hit if it is a wall
 * (normal close to horizontal, see PlacementMath). A null result means the ray left the depth
 * view or hit nothing: the prompt says so, nothing is invented.
 */
@component
export class GlareWallPlacer extends BaseScriptComponent {
  cameraObject: SceneObject | null = null
  baseMaterial: Material | null = null

  private _onPlace = new Event<WallHit>()
  get onPlace(): PublicApi<WallHit> {
    return this._onPlace.publicApi()
  }

  private session: HitTestSession | null = null
  private unavailable = ""
  private active = false
  private startedAt = -100
  private lastQueryAt = -100
  private pending = false
  private last: WallHit | null = null
  private lastWasNull = false
  private counts = {queries: 0, hits: 0, walls: 0, nulls: 0}
  private reticleRoot!: SceneObject
  private reticle!: DynamicMesh
  private reticleMat!: Material
  private prompt!: Text

  onAwake(): void {
    try {
      const wq = require("LensStudio:WorldQueryModule") as WorldQueryModule
      const options = HitTestSessionOptions.create()
      // No smoothing across results: each hit stands for its own ray. With the filter on, a
      // probe in the preview room got a front-wall hit back for a ray pointing behind the
      // eye; with it off, that ray returned null, as it should.
      options.filter = false
      this.session = wq.createHitTestSessionWithOptions(options)
    } catch (e) {
      this.unavailable = `${e}`
      print(`World Query unavailable: ${this.unavailable}`)
    }
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  private build(): void {
    this.reticleRoot = global.scene.createSceneObject("Wall reticle")
    this.reticleRoot.setParent(this.sceneObject)
    if (this.baseMaterial) {
      this.reticleMat = tintedMaterial(this.baseMaterial, new vec4(1, 1, 1, 0.85))
      this.reticleMat.mainPass.depthTest = false
      this.reticle = new DynamicMesh(this.reticleRoot, "Reticle", this.reticleMat)
      const ring: Quad[] = []
      const outer = discQuads(0, 0, RETICLE_RADIUS_CM, 0, 32)
      const inner = discQuads(0, 0, RETICLE_RADIUS_CM - 0.8, 0, 32)
      for (let i = 0; i < outer.length; i++) {
        ring.push({a: inner[i].b, b: outer[i].b, c: outer[i].c, d: inner[i].c})
      }
      ring.push(rectXY(0, 0, 0.6, 5, 0), rectXY(0, 0, 5, 0.6, 0))
      this.reticle.setQuads(ring, vec3.forward())
      this.reticle.visual.setRenderOrder(RETICLE_RENDER_ORDER)
    }
    this.prompt = makeText(this.sceneObject, "Wall prompt", AIM_NOTHING, 1, new vec4(1, 1, 1, 1))
    this.prompt.depthTest = false
    this.prompt.setRenderOrder(RETICLE_RENDER_ORDER + 1)
    this.showReticle(false)
    this.prompt.getSceneObject().enabled = false
  }

  /** Start aiming: the session runs and the reticle and prompt show until a wall is placed. */
  begin(): boolean {
    if (!this.session) return false
    this.active = true
    this.startedAt = getTime()
    this.last = null
    this.lastWasNull = false
    this.session.start()
    if (this.prompt) this.prompt.getSceneObject().enabled = true
    return true
  }

  /** Stop aiming: the session stops (no depth work) and the reticle and prompt hide. */
  stop(): void {
    if (this.active && this.session) this.session.stop()
    this.active = false
    this.pending = false
    this.showReticle(false)
    if (this.prompt) this.prompt.getSceneObject().enabled = false
  }

  isActive(): boolean {
    return this.active
  }

  isAvailable(): boolean {
    return this.session !== null
  }

  unavailableReason(): string {
    return this.unavailable
  }

  /** The latest hit (null before any, or after a null result). */
  lastHit(): WallHit | null {
    return this.last
  }

  promptText(): string {
    return this.prompt ? this.prompt.text : ""
  }

  promptVisible(): boolean {
    return this.prompt ? this.prompt.getSceneObject().isEnabledInHierarchy : false
  }

  reticleVisible(): boolean {
    return this.reticle ? this.reticle.visual.enabled : false
  }

  reticleWorldPosition(): vec3 {
    return this.reticleRoot.getTransform().getWorldPosition()
  }

  queryCounts(): {queries: number; hits: number; walls: number; nulls: number} {
    return {...this.counts}
  }

  /**
   * One World Query hit test along a world-space ray (cm). Resolves with the hit, with the
   * wall test applied, or with null when the ray hit nothing the depth view can see. The
   * session must be running (begin()).
   */
  hitTest(start: vec3, end: vec3): Promise<WallHit | null> {
    return new Promise((resolve) => {
      if (!this.session) {
        resolve(null)
        return
      }
      this.counts.queries++
      this.session.hitTest(start, end, (hit: WorldQueryHitTestResult) => {
        if (!hit) {
          this.counts.nulls++
          resolve(null)
          return
        }
        const wall = P.isWallNormal(hit.normal)
        this.counts.hits++
        if (wall) this.counts.walls++
        resolve({position: hit.position, normal: hit.normal, wall, at: getTime()})
      })
    })
  }

  /** The aim ray: the first SIK interactor that has one (hand, or mouse in the preview), else the head. */
  aimRay(): {start: vec3; end: vec3} {
    const interactors = InteractionManager.getInstance().getInteractorsByType(InteractorInputType.All)
    for (const it of interactors) {
      if (!it.isActive()) continue
      const s = it.startPoint
      const d = it.direction
      if (s && d && d.length > 1e-4) return {start: s, end: s.add(d.normalize().uniformScale(RAY_CM))}
    }
    const t = this.cameraObject!.getTransform()
    const s = t.getWorldPosition()
    const f = t.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    return {start: s, end: s.add(f.uniformScale(RAY_CM))}
  }

  /** Place at the latest hit if it is a fresh wall hit; else say why not. Called on a pinch. */
  confirm(): boolean {
    const h = this.last
    if (!h || getTime() - h.at > FRESH_S) {
      this.setPrompt(AIM_NOTHING)
      return false
    }
    if (!h.wall) {
      this.setPrompt(AIM_NOT_WALL)
      return false
    }
    this._onPlace.invoke(h)
    return true
  }

  private update(): void {
    if (!this.active || !this.cameraObject) return
    const now = getTime()
    if (!this.pending && now - this.lastQueryAt >= HIT_PERIOD_S) {
      this.lastQueryAt = now
      this.pending = true
      const ray = this.aimRay()
      this.hitTest(ray.start, ray.end).then((h) => {
        this.pending = false
        if (!this.active) return
        this.last = h
        this.lastWasNull = h === null
        this.showHit(h, ray)
      })
    }
    if (now - this.startedAt >= ARM_DELAY_S && this.pinchReleased()) this.confirm()
  }

  /** A free-space pinch released this frame (not a pinch on a button or handle). */
  private pinchReleased(): boolean {
    const interactors = InteractionManager.getInstance().getInteractorsByType(InteractorInputType.All)
    for (const it of interactors) {
      const was = (it.previousTrigger & InteractorTriggerType.Select) !== 0
      const now = it.currentTrigger === InteractorTriggerType.None
      if (was && now && !it.currentInteractable && !it.previousInteractable) return true
    }
    return false
  }

  private showHit(h: WallHit | null, ray: {start: vec3; end: vec3}): void {
    const eye = this.cameraObject!.getTransform().getWorldPosition()
    if (!h) {
      this.showReticle(false)
      const dir = ray.end.sub(ray.start).normalize()
      this.placePrompt(ray.start.add(dir.uniformScale(PROMPT_DISTANCE_CM)), eye)
      this.setPrompt(AIM_NOTHING)
      return
    }
    const t = this.reticleRoot.getTransform()
    t.setWorldPosition(h.position)
    const toEye = eye.sub(h.position)
    const n = h.normal.dot(toEye) < 0 ? h.normal.uniformScale(-1) : h.normal
    t.setWorldRotation(quat.lookAt(n.uniformScale(-1).normalize(), Math.abs(n.normalize().y) > 0.95 ? vec3.forward() : vec3.up()))
    this.reticleMat.mainPass.baseColor = h.wall ? new vec4(1, 1, 1, 0.85) : new vec4(1, 0.55, 0.35, 0.6)
    this.showReticle(true)
    const dist = toEye.length
    const scale = Math.max(0.3, dist / 200)
    t.setLocalScale(vec3.one().uniformScale(scale))
    this.placePrompt(h.position.add(vec3.up().uniformScale(RETICLE_RADIUS_CM * scale * 2)), eye)
    this.setPrompt(h.wall ? AIM_WALL : AIM_NOT_WALL)
  }

  private placePrompt(p: vec3, eye: vec3): void {
    const t = this.prompt.getSceneObject().getTransform()
    t.setWorldPosition(p)
    const toEye = eye.sub(p)
    if (toEye.length > 1e-3) t.setWorldRotation(quat.lookAt(toEye.normalize(), vec3.up()))
    // Keep the prompt the same angular size wherever it hangs.
    const em = 2 * toEye.length * Math.tan((LABEL_DEG * Math.PI) / 360)
    t.setLocalScale(vec3.one().uniformScale(em))
  }

  private setPrompt(s: string): void {
    if (this.prompt && this.prompt.text !== s) this.prompt.text = s
  }

  private showReticle(on: boolean): void {
    if (this.reticle) this.reticle.visual.enabled = on
  }
}
