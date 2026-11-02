// DrawKit: small runtime mesh helpers for Glare Zone (quads, boxes, discs, cones and
// "row" meshes for the floor zones and the amber light-limit cells). Built with
// MeshBuilder so the practice wall, print, lights and overlays need no imported meshes.

const LAYOUT = [
  {name: "position", components: 3},
  {name: "normal", components: 3, normalized: true},
  {name: "texture0", components: 2},
]

export type Quad = {a: vec3; b: vec3; c: vec3; d: vec3}

/** A mesh that can be rebuilt every frame from a list of quads and triangles. */
export class DynamicMesh {
  readonly builder: MeshBuilder
  readonly visual: RenderMeshVisual
  readonly sceneObject: SceneObject
  private quadCount = 0

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
    const vCount = this.builder.getVerticesCount()
    if (vCount > 0) this.builder.eraseVertices(0, vCount)
    const iCount = this.builder.getIndicesCount()
    if (iCount > 0) this.builder.eraseIndices(0, iCount)
    const verts: number[] = []
    const idx: number[] = []
    let base = 0
    for (const q of quads) {
      pushVert(verts, q.a, normal, 0, 0)
      pushVert(verts, q.b, normal, 1, 0)
      pushVert(verts, q.c, normal, 1, 1)
      pushVert(verts, q.d, normal, 0, 1)
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
      base += 4
    }
    this.quadCount = quads.length
    // The quads' own extent (mesh-local). The visual's AABB is not used for this: it can
    // include the origin, so it overstates a strip that sits away from it.
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (const q of quads) {
      for (const p of [q.a, q.b, q.c, q.d]) {
        const v = [p.x, p.y, p.z]
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], v[k])
          hi[k] = Math.max(hi[k], v[k])
        }
      }
    }
    this.extentNow = quads.length > 0 ? {min: new vec3(lo[0], lo[1], lo[2]), max: new vec3(hi[0], hi[1], hi[2])} : null
    if (quads.length > 0) {
      this.builder.appendVerticesInterleaved(verts)
      this.builder.appendIndices(idx)
      this.builder.updateMesh()
      this.visual.mesh = this.builder.getMesh()
    }
    this.visual.enabled = quads.length > 0
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

function pushVert(out: number[], p: vec3, n: vec3, u: number, v: number): void {
  out.push(p.x, p.y, p.z, n.x, n.y, n.z, u, v)
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
