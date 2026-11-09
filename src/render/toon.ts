// 툰 재질·외곽선·둥근 상자 (design/style-preview.html 이식). 같은 색·같은 형상은 공유한다.
import * as THREE from 'three';

export const INK = '#2B2A33';
export const INK_HEX = 0x2b2a33;

// 3단 그라디언트 (95/175/255). r128 의 LuminanceFormat → RedFormat
const gt = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
gt.minFilter = THREE.NearestFilter;
gt.magFilter = THREE.NearestFilter;
gt.generateMipmaps = false;
gt.needsUpdate = true;
export const gradientMap = gt;

const matCache = new Map<number, THREE.MeshToonMaterial>();
export function toon(color: number): THREE.MeshToonMaterial {
  let m = matCache.get(color);
  if (!m) { m = new THREE.MeshToonMaterial({ color, gradientMap: gt }); matCache.set(color, m); }
  return m;
}

const olCache = new Map<number, THREE.ShaderMaterial>();
export function olMat(t: number): THREE.ShaderMaterial {
  let m = olCache.get(t);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { t: { value: t } },
      vertexShader: 'uniform float t;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*t,1.0);}',
      fragmentShader: 'void main(){gl_FragColor=vec4(0.169,0.165,0.2,1.0);}',
      side: THREE.BackSide,
    });
    olCache.set(t, m);
  }
  return m;
}

/** 위치가 같은 정점의 법선을 평균 → 각진 형상도 외곽선이 끊기지 않는다 */
export function smoothNormals(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const map = new Map<string, [number, number, number]>();
  const key = (i: number) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    let a = map.get(k);
    if (!a) { a = [0, 0, 0]; map.set(k, a); }
    a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i);
  }
  for (let i = 0; i < p.count; i++) {
    const a = map.get(key(i)) as [number, number, number];
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
  n.needsUpdate = true;
  return g;
}

const outlineGeo = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function outlineOf(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let o = outlineGeo.get(g);
  if (!o) { o = smoothNormals(g.clone()); outlineGeo.set(g, o); }
  return o;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
/** 같은 키의 형상은 한 번만 만든다 */
export function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g as T;
}

export interface MOpts {
  mat?: THREE.Material;
  p?: readonly [number, number, number];
  r?: readonly [number, number, number];
  s?: number | readonly [number, number, number];
  ol?: number;
  parent?: THREE.Object3D;
}

/** 메쉬 + 외곽선 복제 메쉬 */
export function M(g: THREE.BufferGeometry, color: number, o: MOpts = {}): THREE.Mesh {
  const m = new THREE.Mesh(g, o.mat ?? toon(color));
  if (o.p) m.position.set(o.p[0], o.p[1], o.p[2]);
  if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2]);
  if (o.s !== undefined) {
    if (typeof o.s === 'number') m.scale.setScalar(o.s);
    else m.scale.set(o.s[0], o.s[1], o.s[2]);
  }
  const ol = o.ol === undefined ? 0.035 : o.ol;
  if (ol) m.add(new THREE.Mesh(outlineOf(g), olMat(ol)));
  if (o.parent) o.parent.add(m);
  return m;
}

function rrShape(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** 모서리가 둥근 상자 (가운데 정렬) */
export function rbox(w: number, h: number, d: number, r = 0.1): THREE.BufferGeometry {
  return geo(`rbox:${w}:${h}:${d}:${r}`, () => {
    const b = Math.min(0.045, r * 0.5, h * 0.3);
    const rr = Math.max(0.01, Math.min(r - b, (w - 2 * b) / 2 - 0.001, (d - 2 * b) / 2 - 0.001));
    const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, d - 2 * b, rr), {
      depth: Math.max(0.01, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 5,
    });
    g.rotateX(-Math.PI / 2);
    g.center();
    return g;
  });
}

export const sphere = (r: number, w = 16, h = 12) => geo(`sph:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
export const cyl = (rt: number, rb: number, h: number, seg = 12) => geo(`cyl:${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const cone = (r: number, h: number, seg = 10) => geo(`cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const torus = (r: number, t: number, rs: number, ts: number, arc = Math.PI * 2) =>
  geo(`tor:${r}:${t}:${rs}:${ts}:${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));

export const shadowMat = new THREE.MeshBasicMaterial({ color: INK_HEX, transparent: true, opacity: 0.14, depthWrite: false });
export function blob(x: number, z: number, r: number, parent: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(geo(`circ:${r}`, () => new THREE.CircleGeometry(r, 24)), shadowMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.012, z);
  parent.add(m);
  return m;
}

export const inkBasic = new THREE.MeshBasicMaterial({ color: INK_HEX });
export const whiteBasic = new THREE.MeshBasicMaterial({ color: 0xffffff });
