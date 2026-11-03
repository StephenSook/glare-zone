// Shared helpers for the Glare Zone LEAF scenarios.
import {awaitEventOnce, findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {InteractionManager} from "SpectaclesInteractionKit.lspkg/Core/InteractionManager/InteractionManager"
import {InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {GlareZoneController} from "../Scripts/GlareZoneController"
import * as G from "../Scripts/GlareMath"
import {LAYOUT} from "../Scripts/GlareLayout"
import {DragKnob} from "../Scripts/DragKnob"

export function controller(): GlareZoneController {
  const so = findSceneObjectByName("Glare Zone")
  if (!so) throw new Error('Scene object "Glare Zone" not found')
  const c = so.getComponent(GlareZoneController.getTypeName()) as GlareZoneController
  if (!c) throw new Error("GlareZoneController not found on Glare Zone")
  return c
}

export function interactable(name: string): Interactable {
  const found = findInteractablesByName(name, undefined, true)[0]
  if (!found) throw new Error(`Interactable "${name}" not found or not enabled`)
  return found
}

/**
 * Standard placement: both lights 80.78 cm out, aimed at the print centre, full dimmer,
 * standing eyes, back at the start position (3 m from the wall, on the centre line), the wall
 * set down in front of the viewer as at launch ("Place in front of me", 3 m).
 */
export async function resetToStandard(c: GlareZoneController): Promise<void> {
  const D0 = G.standardPlacementCm()
  const tilt = G.tiltForAim(50, D0, 150)
  for (let i = 0; i < 2; i++) {
    c.setLightDistance(i, D0)
    c.setLightTilt(i, tilt)
    c.setDimmer(i, 1)
  }
  c.setWorksOnPaper(false)
  c.setViewingArea(G.VIEWING_NEAR_CM, G.VIEWING_FAR_CM)
  c.restart() // also closes any results
  c.placeInFront(LAYOUT.startDistanceCm) // also stops any wall aiming
  c.setEyePreset("standing")
  c.setMoreOpen(false)
  await stepTo(c, new vec3(0, c.eyeLocal().y, LAYOUT.startDistanceCm))
  c.recallPanels() // near panels back in front of the viewer at once
  await sleep(1600) // let the adjusting highlight settle back to faint
}

/** Press a button the way a user would (LEAF's scripted pinch on its Interactable). */
export async function press(interactor: {trigger: (i: Interactable) => Promise<void>}, name: string): Promise<void> {
  await interactor.trigger(interactable(name))
  await sleep(300)
}

/** World direction for a gallery-local direction (the gallery is placed at runtime). */
export function galleryDir(c: GlareZoneController, local: vec3): vec3 {
  return c.galleryObject().getTransform().getWorldRotation().multiplyVec3(local)
}

/** Move the practice gallery so the real camera sits at this gallery-local eye position. */
export async function stepTo(c: GlareZoneController, eyeLocal: vec3, waitMs: number = 200): Promise<void> {
  const gt = c.galleryObject().getTransform()
  const camLocal = c.eyeLocal()
  const worldShift = gt.getWorldRotation().multiplyVec3(camLocal.sub(eyeLocal))
  gt.setWorldPosition(gt.getWorldPosition().add(worldShift))
  if (waitMs > 0) await sleep(waitMs)
}

/** Media captures only: switch off LEAF's on-screen log camera so no overlay is captured. */
export function hideLeafOverlay(): void {
  const ui = findSceneObjectByName("LeafDebugUICamera")
  if (ui) ui.enabled = false
}

/** Media captures only (icon, preview image): hide every text and the near panels. */
export function hideTextForArt(c: GlareZoneController): void {
  const walk = (so: SceneObject) => {
    const t = so.getComponent("Component.Text") as Text
    if (t) t.enabled = false
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
  }
  walk(c.galleryObject())
  const panels = findSceneObjectByName("Near panels (eye-anchored)")
  if (panels) panels.enabled = false
}

export function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol
}

/**
 * Samples taken only while `held()` reports the control is being dragged, so a value that
 * changes only on release is never sampled as "during the drag".
 */
export async function sampleWhileHeld(
  dragDone: Promise<void>,
  held: () => boolean,
  read: () => number[],
): Promise<number[][]> {
  const samples: number[][] = []
  let finished = false
  dragDone.then(() => (finished = true), () => (finished = true))
  while (!finished) {
    if (held()) samples.push(read())
    await sleep(60)
  }
  await dragDone
  return samples
}

/** True from an Interactable's drag start to its drag end (for UIKit sliders). */
export function dragFlag(i: Interactable): () => boolean {
  const state = {held: false}
  i.onDragStart.add(() => (state.held = true))
  i.onDragEnd.add(() => (state.held = false))
  return () => state.held
}

/**
 * Test-only bridge for LEAF's IK arm pressing within arm reach (B4, BUILD_LOG row 24).
 *
 * Within arm reach, LEAF's IK hand presses by SIK's physical proximity: it replaces
 * `getPokeStartPoint` / `getPokeEndPoint` on the hand interactor's PhysicalInteractionProvider
 * so SIK's poke spherecast follows the IK finger. This project's SIK (package 2.0.0, runtime
 * 0.18.0) binds those two methods once, in the provider's constructor
 * (`cachedGetPokeEndPoint = frameCache.wrapMethod(..., this.getPokeEndPoint)`, which calls
 * `fn.bind(this)`), and only ever calls the bound copies, so LEAF's replacements are never
 * used: no press within reach can hover (convergence_timeout on hoverEnter), for any
 * Interactable, whatever its targeting mode. Leaf 2.0.2 is the newest LEAF this SIK takes
 * (Leaf 4.0.0 imports a newer SIK, BUILD_LOG row 2).
 *
 * This points the provider's bound copies at LEAF's replacements, so SIK's own provider runs
 * on the IK finger as LEAF intends; the press still goes through SIK's proximity detection and
 * the Interactable's own events. It changes nothing in the Lens. Call it after
 * createIKInteractor(); it returns a function that restores SIK's bound copies.
 */
export function bridgeLeafDirectPoke(hand: "left" | "right"): () => void {
  const type = hand === "left" ? InteractorInputType.LeftHand : InteractorInputType.RightHand
  const interactor = InteractionManager.getInstance().getInteractorsByType(type)[0] as unknown as
    {[k: string]: any} | undefined
  const provider = interactor ? interactor["physicalInteractionProvider"] : undefined
  if (!provider || !Object.prototype.hasOwnProperty.call(provider, "getPokeEndPoint")) {
    throw new Error(`bridgeLeafDirectPoke: LEAF's IK poke override not found on the ${hand} hand (create the IK interactor first)`)
  }
  const saved = {start: provider["cachedGetPokeStartPoint"], end: provider["cachedGetPokeEndPoint"]}
  provider["cachedGetPokeStartPoint"] = () => provider.getPokeStartPoint()
  provider["cachedGetPokeEndPoint"] = () => provider.getPokeEndPoint()
  return () => {
    provider["cachedGetPokeStartPoint"] = saved.start
    provider["cachedGetPokeEndPoint"] = saved.end
  }
}

/**
 * A held drag in fixed steps (B2). LEAF's drag() moves its target by the drag vector once per
 * frame for a time, so how far the knob travels, and where the samples land, depends on the
 * frame rate. This drives the same SIK interactor path (hover, select, drag vector), but each
 * step delivers exactly one drag update of `step` and then holds still (zero drag vector) for
 * `settleFrames` frames before `atStep(k)` reads the Lens: every sample is taken at a known
 * knob position, while the knob is still held. Returns how many steps were delivered.
 */
export class SteppedDragInteractor extends DefaultLeafInteractor {
  async stepDrag(target: Interactable, step: vec3, steps: number, atStep: (k: number) => void,
    settleFrames: number = 3): Promise<number> {
    const still = vec3.zero()
    let delivered = 0
    const unsubscribe = target.onDragUpdate.add(() => {
      const v = this.overrideDragVector
      if (v && v.length > 0) {
        delivered++
        this.startPoint = this.startPoint.add(step)
        this.endPoint = this.endPoint.add(step)
        this.overrideDragVector = still // one update per step
      }
    })
    const dragStarted = awaitEventOnce(target.onDragStart)
    const dragEnded = awaitEventOnce(target.onDragEnd)
    await this.enterHover(target)
    await nextFrame()
    await nextFrame()
    this.startSelecting()
    await nextFrame()
    this.overrideDragVector = still
    await dragStarted
    try {
      for (let k = 1; k <= steps; k++) {
        const before = delivered
        this.overrideDragVector = step
        for (let f = 0; f < 30 && delivered === before; f++) await nextFrame()
        if (delivered === before) throw new Error(`stepDrag: step ${k} was not delivered`)
        for (let f = 0; f < settleFrames; f++) await nextFrame()
        atStep(k)
      }
    } finally {
      unsubscribe()
      this.stopSelecting()
      await dragEnded
      this.resetStartEndPoint()
      this.overrideDragVector = undefined
      await this.exitHover()
    }
    return delivered
  }
}

/**
 * The fixture's published photometry, copied by hand from the TSLight RXT series
 * specification sheet (CBCP table, page 2, RXT13 at 3000K, CRI 83), not from GlareMath:
 * full beam angle and centre-beam candlepower per reflector. Manufacturer data, not measured.
 */
export const SHEET_RXT13 = {
  wide: {beamDeg: 40, candela: 2700}, // the 40 deg reflector (the Lens's default)
  narrow: {beamDeg: 20, candela: 5000}, // the 20 deg reflector
}

/**
 * Independent of GlareMath: the highest point of the glazing (x -50..50, y 100..200 cm) inside
 * a light's beam, found by testing points against the cone directly. The light hangs at
 * (x, 300, D), pans to the print's centre line and tilts tiltDeg from straight down, so its
 * axis points at (0, 300 - sqrt(x^2 + D^2) / tan(tilt), 0); the beam is beamDeg wide (the
 * RXT13's 40 deg reflector unless given). Returns null when no glazing point is lit.
 */
export function coneLitTopCm(xL: number, D: number, tiltDeg: number, beamDeg: number = SHEET_RXT13.wide.beamDeg): number | null {
  const horiz = Math.sqrt(xL * xL + D * D)
  const aimY = 300 - horiz / Math.tan((tiltDeg * Math.PI) / 180)
  const ax = new vec3(-xL, aimY - 300, -D).normalize()
  const cosHalf = Math.cos(((beamDeg / 2) * Math.PI) / 180)
  const lit = (x: number, y: number) => new vec3(x - xL, y - 300, -D).normalize().dot(ax) >= cosHalf
  let best: number | null = null
  for (let x = -50; x <= 50; x += 0.5) {
    for (let y = 200; y >= 100; y -= 1) {
      if (!lit(x, y)) continue
      // Refine between y and y + 1 (the edge), unless y is the glass top.
      let lo = y
      let hi = Math.min(200, y + 1)
      if (hi > lo && !lit(x, hi)) {
        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2
          if (lit(x, mid)) lo = mid
          else hi = mid
        }
      } else lo = hi
      if (best === null || lo > best) best = lo
      break
    }
  }
  return best
}

/**
 * Independent of GlareMath: lux on the glass at (x, y) from the RXT13's published photometry
 * (SHEET_RXT13; a light's own beamDeg and candela, else the 40 deg reflector's): inside a
 * light's cone, E = I x cos(incidence) / d^2, d in metres, cos = D / d for glass facing the
 * room. Lights as {xCm, distanceCm, tiltDeg, dimmer, beamDeg?, candela?}.
 */
export function handLux(lights: {xCm: number; distanceCm: number; tiltDeg: number; dimmer: number;
  beamDeg?: number; candela?: number}[], x: number, y: number): number {
  let sum = 0
  for (const l of lights) {
    const beamDeg = l.beamDeg ?? SHEET_RXT13.wide.beamDeg
    const candela = l.candela ?? SHEET_RXT13.wide.candela
    const horiz = Math.sqrt(l.xCm * l.xCm + l.distanceCm * l.distanceCm)
    const aimY = 300 - horiz / Math.tan((l.tiltDeg * Math.PI) / 180)
    const axis = new vec3(-l.xCm, aimY - 300, -l.distanceCm).normalize()
    const v = new vec3(x - l.xCm, y - 300, -l.distanceCm)
    const d = v.length
    if (v.normalize().dot(axis) < Math.cos(((beamDeg / 2) * Math.PI) / 180)) continue
    const cos = l.distanceCm / d
    sum += (candela * l.dimmer * cos) / ((d / 100) * (d / 100))
  }
  return sum
}

/** The 5 cm amber cells' centres on the 100 x 100 cm glazing. */
export function amberCellCentres(): {x: number; y: number}[] {
  const out: {x: number; y: number}[] = []
  for (let x = -47.5; x < 50; x += 5) for (let y = 102.5; y < 200; y += 5) out.push({x, y})
  return out
}

/** How many different values (to 0.5) a column of samples takes. */
export function distinctValues(samples: number[][], column: number): number {
  const seen: {[k: string]: boolean} = {}
  for (const s of samples) seen[(Math.round(s[column] * 2) / 2).toFixed(1)] = true
  return Object.keys(seen).length
}

/** Turn the head by `deg` (positive to the right): the room turns the other way around the eye. */
export async function turnHeadBy(c: GlareZoneController, deg: number): Promise<void> {
  const gt = c.galleryObject().getTransform()
  const cam = c.cameraObject.getTransform().getWorldPosition()
  const camLocal = c.eyeLocal()
  const r = quat.angleAxis((-deg * Math.PI) / 180, vec3.up()).multiply(gt.getWorldRotation())
  gt.setWorldRotation(r)
  gt.setWorldPosition(cam.sub(r.multiplyVec3(camLocal)))
  await sleep(200)
}

export function has(text: string, part: string): boolean {
  return text.indexOf(part) >= 0
}

// ------------------------------------------------------------------ view geometry

const DEG = 180 / Math.PI

/** The camera's half field of view in degrees (vertical from its fov, across from its aspect). */
export function viewHalfAngles(c: GlareZoneController): {h: number; v: number} {
  const cam = c.cameraObject.getComponent("Component.Camera") as Camera
  const v = cam.fov / 2
  return {v: v * DEG, h: Math.atan(Math.tan(v) * cam.aspect) * DEG}
}

/** A world point's direction from the eye: degrees right (x) and up (y) of the view axis. */
export function viewAngles(c: GlareZoneController, p: vec3): {x: number; y: number; front: boolean} {
  const local = c.cameraObject.getTransform().getInvertedWorldTransform().multiplyPoint(p)
  return {x: Math.atan2(local.x, -local.z) * DEG, y: Math.atan2(local.y, -local.z) * DEG, front: local.z < 0}
}

/** True when a world point is inside the display rectangle, with a margin in degrees. */
export function inView(c: GlareZoneController, p: vec3, marginDeg: number = 0): boolean {
  const half = viewHalfAngles(c)
  const a = viewAngles(c, p)
  return a.front && Math.abs(a.x) <= half.h - marginDeg && Math.abs(a.y) <= half.v - marginDeg
}

/** The 8 corners of a visual's world-space bounding box. */
export function aabbCorners(v: BaseMeshVisual): vec3[] {
  const a = v.worldAabbMin()
  const b = v.worldAabbMax()
  const out: vec3[] = []
  for (const x of [a.x, b.x]) for (const y of [a.y, b.y]) for (const z of [a.z, b.z]) out.push(new vec3(x, y, z))
  return out
}

/** Which corners of a visual fall outside the display rectangle ("" when all are in view). */
export function outOfView(c: GlareZoneController, corners: vec3[], marginDeg: number = 0): string {
  const bad = corners.filter((p) => !inView(c, p, marginDeg)).map((p) => {
    const a = viewAngles(c, p)
    return `(${a.x.toFixed(1)}, ${a.y.toFixed(1)})`
  })
  return bad.join(" ")
}

export type AngularRect = {x0: number; x1: number; y0: number; y1: number}

/** The rectangle a set of world points covers, in view degrees. */
export function angularRect(c: GlareZoneController, corners: vec3[]): AngularRect {
  const r = {x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9}
  for (const p of corners) {
    const a = viewAngles(c, p)
    r.x0 = Math.min(r.x0, a.x)
    r.x1 = Math.max(r.x1, a.x)
    r.y0 = Math.min(r.y0, a.y)
    r.y1 = Math.max(r.y1, a.y)
  }
  return r
}

/** A pinch target's angular size: the smaller of its width and height in degrees. */
export function angularSize(r: AngularRect): number {
  return Math.min(r.x1 - r.x0, r.y1 - r.y0)
}

/** Clear space between two targets in degrees (negative when they overlap). */
export function angularGap(a: AngularRect, b: AngularRect): number {
  const gx = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1)
  const gy = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1)
  return Math.max(gx, gy)
}

/** The visual a user pinches for a control: its own mesh, or a slider's knob. */
export function targetVisual(so: SceneObject): BaseMeshVisual {
  for (let i = 0; i < so.getChildrenCount(); i++) {
    const child = so.getChild(i)
    if (child.name === "SliderKnob" || child.name === "Knob" || child.name === "Handle") {
      const v = child.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (v) return v
    }
  }
  const own = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  if (own) return own
  throw new Error(`No visual found for pinch target "${so.name}"`)
}
