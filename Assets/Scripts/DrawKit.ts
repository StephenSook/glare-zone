// DrawKit: small runtime mesh helpers for Glare Zone (quads, boxes, discs, cones and
// "row" meshes for the floor zones and the amber light-limit cells). Built with
// MeshBuilder so the practice wall, print, lights and overlays need no imported meshes.

const LAYOUT = [
  {name: "position", components: 3},
  {name: "normal", components: 3, normalized: true},
  {name: "texture0", components: 2},
]

export type Quad = {a: vec3; b: vec3; c: vec3; d: vec3}

// Texture coordinates of a quad's corners a, b, c, d.
const QUAD_UV = [0, 0, 1, 0, 1, 1, 0, 1]

/** A flat rectangle on a horizontal plane: x from xMin to xMax, z (out from the wall) from z0 to z1. */
export type RectXZ = {xMin: number; xMax: number; z0: number; z1: number}

/** The parts of a rectangle's four vertices that do not depend on its x and z: height, normal up, texture. */
function writeRectConstants(verts: number[], k: number, y: number): void {
  for (let c = 0; c < 4; c++, k += 8) {
    verts[k + 1] = y
    verts[k + 3] = 0
    verts[k + 4] = 1
    verts[k + 5] = 0
    verts[k + 6] = QUAD_UV[c * 2]
    verts[k + 7] = QUAD_UV[c * 2 + 1]
  }
}

/** Make idx hold exactly n quads' triangle indices (0 1 2, 0 2 3 per quad), writing only new ones. */
function growQuadIndices(idx: number[], n: number): void {
  for (let i = idx.length / 6, base = i * 4; i < n; i++, base += 4) {
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  idx.length = n * 6
}

/**
 * A mesh that can be rebuilt every frame from a list of quads and triangles.
 *
 * Rebuilds run every frame while a light is dragged, so they avoid per-vertex allocations
 * and repeated vec3 reads (each vec3 component read crosses into the engine): one
 * preallocated vertex array, the normal read once, the extent taken in the same pass
 * (BUILD_LOG B1).
 */
export class DynamicMesh {
  readonly builder: MeshBuilder
  readonly visual: RenderMeshVisual
  readonly sceneObject: SceneObject
  private quadCount = 0
  private meshAssigned = false

  constructor(parent: SceneObject, name: string, material: Material) {
    this.sceneObject = global.scene.createSceneObject(name)
    this.sceneObject.setParent(parent)
    this.builder = new MeshBuilder(LAYOUT)
    this.builder.topology = MeshTopology.Triangles
    this.builder.indexType = MeshIndexType.UInt16
    this.visual = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.visual.mainMaterial = material
    this.visual.enabled = false
  }

  /** Replace the mesh with these quads (each quad a, b, c, d in order around its edge). */
  setQuads(quads: Quad[], normal: vec3 = vec3.up()): void {
    const n = quads.length
    const verts: number[] = new Array(n * 32)
    const nx = normal.x
    const ny = normal.y
    const nz = normal.z
    let x0 = Infinity, y0 = Infinity, z0 = Infinity
    let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
    let k = 0
    for (let i = 0; i < n; i++) {
      const q = quads[i]
      for (let c = 0; c < 4; c++) {
        const p = c === 0 ? q.a : c === 1 ? q.b : c === 2 ? q.c : q.d
        const x = p.x
        const y = p.y
        const z = p.z
        verts[k] = x
        verts[k + 1] = y
        verts[k + 2] = z
        verts[k + 3] = nx
        verts[k + 4] = ny
        verts[k + 5] = nz
        verts[k + 6] = QUAD_UV[c * 2]
        verts[k + 7] = QUAD_UV[c * 2 + 1]
        k += 8
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
        if (z < z0) z0 = z
        if (z > z1) z1 = z
      }
    }
    const idx: number[] = []
    growQuadIndices(idx, n)
    this.commit(verts, idx, n, x0, y0, z0, x1, y1, z1)
  }

  /**
   * Replace the mesh with flat rectangles on the plane at height y, facing up: the same
   * vertices as setQuads(rects.map((r) => rectXZ(r.xMin, r.xMax, r.z0, r.z1, y))), built
   * without making four vec3 per rectangle.
   */
  setRectsXZ(rects: RectXZ[], y: number): void {
    const n = rects.length
    // The arrays are kept between rebuilds (the floor zones are rebuilt on every frame of a
    // drag): the height, normal, texture and index entries never change for a slot, so a
    // rebuild writes only each corner's x and z (BUILD_LOG B1).
    const verts = this.rectVerts
    if (y !== this.rectY) {
      this.rectY = y
      for (let i = 0; i < verts.length / 32; i++) writeRectConstants(verts, i * 32, y)
    }
    for (let i = verts.length / 32; i < n; i++) writeRectConstants(verts, i * 32, y)
    verts.length = n * 32
    growQuadIndices(this.rectIdx, n)
    let x0 = Infinity, z0 = Infinity
    let x1 = -Infinity, z1 = -Infinity
    for (let i = 0, k = 0; i < n; i++, k += 32) {
      const r = rects[i]
      const xa = r.xMin
      const xb = r.xMax
      const za = r.z0
      const zb = r.z1
      // Corners a, b, c, d of rectXZ: (xMin, z0), (xMax, z0), (xMax, z1), (xMin, z1).
      verts[k] = xa
      verts[k + 2] = za
      verts[k + 8] = xb
      verts[k + 10] = za
      verts[k + 16] = xb
      verts[k + 18] = zb
      verts[k + 24] = xa
      verts[k + 26] = zb
      if (xa < x0) x0 = xa
      if (xa > x1) x1 = xa
      if (xb < x0) x0 = xb
      if (xb > x1) x1 = xb
      if (za < z0) z0 = za
      if (za > z1) z1 = za
      if (zb < z0) z0 = zb
      if (zb > z1) z1 = zb
    }
    this.commit(verts, this.rectIdx, n, x0, y, z0, x1, y, z1)
  }

  private rectVerts: number[] = []
  private rectIdx: number[] = []
  private rectY = Number.NaN

  private commit(verts: number[], idx: number[], n: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const vCount = this.builder.getVerticesCount()
    if (vCount > 0) this.builder.eraseVertices(0, vCount)
    const iCount = this.builder.getIndicesCount()
    if (iCount > 0) this.builder.eraseIndices(0, iCount)
    this.quadCount = n
    // The quads' own extent (mesh-local). The visual's AABB is not used for this: it can
    // include the origin, so it overstates a strip that sits away from it.
    this.extentNow = n > 0 ? {min: new vec3(x0, y0, z0), max: new vec3(x1, y1, z1)} : null
    if (n > 0) {
      this.builder.appendVerticesInterleaved(verts)
      this.builder.appendIndices(idx)
      this.builder.updateMesh()
      // The builder's mesh stays linked to it, so it is assigned once.
      if (!this.meshAssigned) {
        this.visual.mesh = this.builder.getMesh()
        this.meshAssigned = true
      }
    }
    this.visual.enabled = n > 0
  }

  get count(): number {
    return this.quadCount
  }

  private extentNow: {min: vec3; max: vec3} | null = null

  /** The drawn quads' extent in this mesh's local space (null when empty). */
  get extent(): {min: vec3; max: vec3} | null {
    return this.extentNow
  }
}

/** Flat rectangle in the local XY plane, centred at (cx, cy), at depth z. */
export function rectXY(cx: number, cy: number, w: number, h: number, z: number = 0): Quad {
  return {
    a: new vec3(cx - w / 2, cy - h / 2, z),
    b: new vec3(cx + w / 2, cy - h / 2, z),
    c: new vec3(cx + w / 2, cy + h / 2, z),
    d: new vec3(cx - w / 2, cy + h / 2, z),
  }
}

/** Flat rectangle on a horizontal plane at height y (x along the wall, z out from it). */
export function rectXZ(x0: number, x1: number, z0: number, z1: number, y: number): Quad {
  return {
    a: new vec3(x0, y, z0),
    b: new vec3(x1, y, z0),
    c: new vec3(x1, y, z1),
    d: new vec3(x0, y, z1),
  }
}

/** Six quads of an axis-aligned box. */
export function boxQuads(center: vec3, size: vec3): Quad[] {
  const hx = size.x / 2
  const hy = size.y / 2
  const hz = size.z / 2
  const p = (sx: number, sy: number, sz: number) => new vec3(center.x + sx * hx, center.y + sy * hy, center.z + sz * hz)
  return [
    {a: p(-1, -1, 1), b: p(1, -1, 1), c: p(1, 1, 1), d: p(-1, 1, 1)},
    {a: p(1, -1, -1), b: p(-1, -1, -1), c: p(-1, 1, -1), d: p(1, 1, -1)},
    {a: p(-1, 1, 1), b: p(1, 1, 1), c: p(1, 1, -1), d: p(-1, 1, -1)},
    {a: p(-1, -1, -1), b: p(1, -1, -1), c: p(1, -1, 1), d: p(-1, -1, 1)},
    {a: p(1, -1, 1), b: p(1, -1, -1), c: p(1, 1, -1), d: p(1, 1, 1)},
    {a: p(-1, -1, -1), b: p(-1, -1, 1), c: p(-1, 1, 1), d: p(-1, 1, -1)},
  ]
}

/** A thin square bar from a to b (used for tracks, outlines and the handle's line to its light). */
export function barQuads(a: vec3, b: vec3, thickness: number): Quad[] {
  const dir = b.sub(a)
  const len = dir.length
  if (len < 1e-6) return []
  const f = dir.uniformScale(1 / len)
  const helper = Math.abs(f.y) < 0.9 ? vec3.up() : vec3.right()
  const s = f.cross(helper).normalize().uniformScale(thickness / 2)
  const t = f.cross(s).normalize().uniformScale(thickness / 2)
  const c = [s.add(t), s.sub(t), s.uniformScale(-1).sub(t), s.uniformScale(-1).add(t)]
  const quads: Quad[] = []
  for (let i = 0; i < 4; i++) {
    const c0 = c[i]
    const c1 = c[(i + 1) % 4]
    quads.push({a: a.add(c0), b: a.add(c1), c: b.add(c1), d: b.add(c0)})
  }
  return quads
}

/** A flat disc in the local XY plane as thin quads (a fan written as degenerate quads). */
export function discQuads(cx: number, cy: number, radius: number, z: number, segments: number = 24): Quad[] {
  const quads: Quad[] = []
  const c = new vec3(cx, cy, z)
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    const p0 = new vec3(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, z)
    const p1 = new vec3(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, z)
    quads.push({a: c, b: p0, c: p1, d: c})
  }
  return quads
}

/** Clone a material and set its colour, transparent and two-sided. */
export function tintedMaterial(base: Material, color: vec4): Material {
  const m = base.clone()
  m.mainPass.baseColor = color
  m.mainPass.twoSided = true
  m.mainPass.blendMode = BlendMode.Normal
  m.mainPass.depthWrite = color.w >= 0.99
  return m
}

/** World-space text. Size is given as em height in centimetres. */
export function makeText(
  parent: SceneObject,
  name: string,
  text: string,
  emCm: number,
  color: vec4,
  align: HorizontalAlignment = HorizontalAlignment.Center,
): Text {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  const t = so.createComponent("Component.Text") as Text
  t.text = text
  t.size = emCm * 43.886
  t.depthTest = true
  t.horizontalAlignment = align
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
  t.textFill.color = color
  const w = 200
  if (align === HorizontalAlignment.Left) t.layoutRect = Rect.create(0, w, -emCm, emCm)
  else if (align === HorizontalAlignment.Right) t.layoutRect = Rect.create(-w, 0, -emCm, emCm)
  else t.layoutRect = Rect.create(-w / 2, w / 2, -emCm, emCm)
  return t
}
