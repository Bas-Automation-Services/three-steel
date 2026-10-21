// three-steel playground: pick a profile, shape a member, copy the code.
// three-steel works in millimetres with Z up; the scene keeps both (camera.up = Z).
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-semi-condensed/400.css';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/400-italic.css';
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ALL_STEEL_PROFILES,
  Arc3D,
  BeamGeometry,
  buildCrossSection,
  getProfile,
  Helix3D,
  Line3D,
  Plane3D,
  Point3D,
  polygonArea,
  tessellateOutline,
  Vector3D,
  type CrossSection,
  type MemberCurve,
  type ProfileDefinition,
  type ProfileShape,
} from '../src';
import { beamToBufferGeometry } from '../src/three';

// --- state (mirrored in the URL hash so a setup can be shared) ---

type Kind = 'straight' | 'arc' | 'spiral';

const DEFAULTS = {
  profile: 'IPE300',
  kind: 'straight' as Kind,
  length: 6000,
  radius: 6000,
  sweep: 90,
  spiralRadius: 1200,
  turns: 0.75,
  rise: 3600,
  roll: 0,
  startCut: 0,
  endCut: 0,
};
type State = typeof DEFAULTS;
type NumberKey = Exclude<keyof State, 'profile' | 'kind'>;
const NUMBER_KEYS: NumberKey[] = ['length', 'radius', 'sweep', 'spiralRadius', 'turns', 'rise', 'roll', 'startCut', 'endCut'];

function readHash(): State {
  const params = new URLSearchParams(location.hash.slice(1));
  const state = { ...DEFAULTS };
  const profile = params.get('profile');
  if (profile && getProfile(profile)) state.profile = getProfile(profile)!.id;
  const kind = params.get('kind');
  if (kind === 'straight' || kind === 'arc' || kind === 'spiral') state.kind = kind;
  for (const key of NUMBER_KEYS) {
    const value = Number(params.get(key));
    if (params.has(key) && Number.isFinite(value)) state[key] = value;
  }
  return state;
}

function writeHash(state: State): void {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value !== DEFAULTS[key as keyof State]) params.set(key, String(value));
  }
  history.replaceState(null, '', params.size ? `#${params}` : location.pathname);
}

let state = readHash();

// --- catalog ---

const FAMILY_NAMES: Record<string, string> = {
  IPE: 'European I-beam, EN 10365',
  HEA: 'European wide flange beam, light series, EN 10365',
  HEB: 'European wide flange beam, EN 10365',
  HEM: 'European wide flange beam, heavy series, EN 10365',
  UPN: 'Channel with tapered flanges, EN 10365',
  UPE: 'Channel with parallel flanges, EN 10365',
  Angle: 'Angle, EN 10056',
  SHS: 'Square hollow section, EN 10219',
  RHS: 'Rectangular hollow section, EN 10219',
  CHS: 'Circular hollow section, EN 10219',
  Flat: 'Flat bar',
  Round: 'Round bar',
  UB: 'Universal beam, BS 4-1',
  UC: 'Universal column, BS 4-1',
  PFC: 'Parallel flange channel, BS 4-1',
};

const families = new Map<string, ProfileDefinition[]>();
for (const profile of ALL_STEEL_PROFILES) {
  const family = profile.category ?? 'Other';
  families.set(family, [...(families.get(family) ?? []), profile]);
}

/** Table rows per shape: symbol and value in mm. */
function dimensionRows(shape: ProfileShape): [string, number][] {
  switch (shape.kind) {
    case 'i':
    case 't':
      return [['h', shape.height], ['b', shape.flangeWidth], ['tw', shape.webThickness], ['tf', shape.flangeThickness], ['r', shape.filletRadius]];
    case 'u':
      return [['h', shape.height], ['b', shape.flangeWidth], ['tw', shape.webThickness], ['tf', shape.flangeThickness], ['r', shape.innerFilletRadius]];
    case 'z':
      return [['h', shape.height], ['b', shape.width], ['tw', shape.webThickness], ['tf', shape.flangeThickness], ['r', shape.filletRadius]];
    case 'angle':
      return [['h', shape.legHeight], ['b', shape.legWidth], ['t', shape.thickness], ['r', shape.outerFilletRadius]];
    case 'roundEdgedAngle':
      return [['h', shape.legHeight], ['b', shape.legWidth], ['t', shape.thickness], ['r', shape.rootRadius]];
    case 'rectHollow':
      return [['h', shape.height], ['b', shape.width], ['t', shape.wallThickness], ['r', shape.outerCornerRadius]];
    case 'circHollow':
      return [['d', shape.outerDiameter], ['t', shape.wallThickness]];
    case 'rect':
      return [['h', shape.height], ['b', shape.width]];
    case 'circle':
      return [['d', shape.diameter]];
    case 'hexagon':
      return [['s', shape.widthAcrossFlats]];
  }
}

// --- number formatting ---

const nf = (digits: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format;
const mm = nf(1);
const fmtCode = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
};

// --- section geometry ---

const SAG = 0.2;

function sectionLoops(section: CrossSection): [number, number][][] {
  return [section.outerCurves, ...section.innerContours].map((c) => tessellateOutline(c, SAG));
}

function sectionAreaMm2(section: CrossSection): number {
  const [outer, ...holes] = sectionLoops(section);
  return Math.abs(polygonArea(outer)) - holes.reduce((s, h) => s + Math.abs(polygonArea(h)), 0);
}

// --- the member ---

interface Member {
  beam: BeamGeometry<MemberCurve>;
  startCut?: Plane3D;
  endCut?: Plane3D;
}

function buildMember(s: State, section: CrossSection): Member {
  const roll = (s.roll * Math.PI) / 180;
  let curve: MemberCurve;
  if (s.kind === 'straight') {
    curve = new Line3D(new Point3D(0, 0, 0), new Point3D(s.length, 0, 0));
  } else if (s.kind === 'arc') {
    curve = arcThroughEnds(s.radius, s.sweep);
  } else {
    curve = new Helix3D(new Point3D(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, s.spiralRadius, 0, s.turns * 2 * Math.PI, s.rise);
  }
  const beam = new BeamGeometry<MemberCurve>(curve, section, undefined, roll);
  return {
    beam,
    startCut: s.startCut ? cutPlane(beam, 0, s.startCut) : undefined,
    endCut: s.endCut ? cutPlane(beam, 1, s.endCut) : undefined,
  };
}

/** An upright arch in the XZ plane with both ends on z = 0. */
function arcThroughEnds(radius: number, sweepDeg: number): Arc3D {
  const half = (sweepDeg * Math.PI) / 360;
  const chord = radius * Math.sin(half);
  const rise = radius * (1 - Math.cos(half));
  return Arc3D.fromThreePoints(new Point3D(-chord, 0, 0), new Point3D(0, 0, rise), new Point3D(chord, 0, 0))!;
}

/** Plane through a member end, tilted from square by `deg` about the section's X axis. */
function cutPlane(beam: BeamGeometry<MemberCurve>, t: number, deg: number): Plane3D {
  const cs = beam.getCoordinateSystemAt(t);
  const a = (deg * Math.PI) / 180;
  return new Plane3D(cs.origin, cs.zAxis.scale(Math.cos(a)).add(cs.yAxis.scale(Math.sin(a))));
}

// --- code snippet ---

function snippet(s: State, member: Member): string {
  const roll = (s.roll * Math.PI) / 180;
  const plane = (p: Plane3D) =>
    `new Plane3D(new Point3D(${[p.origin.x, p.origin.y, p.origin.z].map(fmtCode).join(', ')}), ` +
    `new Vector3D(${[p.normal.x, p.normal.y, p.normal.z].map(fmtCode).join(', ')}))`;
  const cuts = [
    member.startCut && `  startCut: ${plane(member.startCut)},`,
    member.endCut && `  endCut: ${plane(member.endCut)},`,
  ].filter(Boolean);
  const geometryImports = [...(cuts.length ? ['Plane3D', 'Point3D', 'Vector3D'] : [])];

  if (s.kind === 'straight') {
    const head = [
      geometryImports.length ? `import { ${geometryImports.join(', ')} } from 'three-steel';` : null,
      `import { createBeamGeometry } from 'three-steel/three';`,
    ].filter(Boolean);
    return [
      ...head,
      '',
      'const geometry = createBeamGeometry({',
      `  profile: '${s.profile}',`,
      '  start: [0, 0, 0],',
      `  end: [${fmtCode(s.length)}, 0, 0],`,
      ...(roll ? [`  rotation: ${fmtCode(roll)}, // ${s.roll}°`] : []),
      ...cuts,
      '});',
    ].join('\n');
  }

  const curve =
    s.kind === 'arc'
      ? (() => {
          const arc = member.beam.centerline as Arc3D;
          const p = (q: Point3D) => `new Point3D(${[q.x, q.y, q.z].map(fmtCode).join(', ')})`;
          return `const curve = Arc3D.fromThreePoints(${p(arc.startPoint)}, ${p(arc.pointAt(0.5))}, ${p(arc.endPoint)})!;`;
        })()
      : `const curve = new Helix3D(new Point3D(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, ${fmtCode(s.spiralRadius)}, 0, ${fmtCode(s.turns * 2 * Math.PI)}, ${fmtCode(s.rise)});`;
  const names = new Set(['BeamGeometry', 'buildCrossSection', 'getProfile', 'Point3D', s.kind === 'arc' ? 'Arc3D' : 'Helix3D', ...geometryImports]);
  if (s.kind === 'spiral') names.add('Vector3D');
  return [
    `import { ${[...names].sort().join(', ')} } from 'three-steel';`,
    `import { beamToBufferGeometry } from 'three-steel/three';`,
    '',
    `const section = buildCrossSection(getProfile('${s.profile}')!.shape);`,
    curve,
    `const beam = new BeamGeometry(curve, section${roll ? `, undefined, ${fmtCode(roll)}` : ''});`,
    `const geometry = beamToBufferGeometry(beam, {\n  maxDegPerStation: 2,\n${cuts.map((c) => `${c}\n`).join('')}});`,
  ].join('\n');
}

// --- section figure (steel-table style) ---

const SVG = 'http://www.w3.org/2000/svg';

function drawFigure(svg: SVGSVGElement, section: CrossSection): void {
  const box = section.boundingBox;
  const w = box.max.x - box.min.x;
  const h = box.max.y - box.min.y;
  // Lay out in screen pixels: room for the height dimension on the left and the width below.
  const { width: W, height: H } = svg.getBoundingClientRect();
  const margin = { left: 46, right: 26, top: 14, bottom: 42 };
  const ppu = Math.min((W - margin.left - margin.right) / w, (H - margin.top - margin.bottom) / h);
  const px = (n: number) => n / ppu; // screen pixels -> drawing units (mm)
  const ox = (W - (margin.left + w * ppu + margin.right)) / 2;
  const oy = (H - (margin.top + h * ppu + margin.bottom)) / 2;
  // Flip Y: the section's +Y is up, SVG's is down.
  svg.setAttribute(
    'viewBox',
    `${box.min.x - px(margin.left + ox)} ${-box.max.y - px(margin.top + oy)} ${px(W)} ${px(H)}`,
  );
  svg.replaceChildren();
  const el = (tag: string, attrs: Record<string, string | number>) => {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    svg.appendChild(node);
    return node;
  };
  const d = sectionLoops(section)
    .map((loop) => `M${loop.map(([x, y]) => `${x},${-y}`).join('L')}Z`)
    .join('');
  el('path', { d, class: 'body', 'vector-effect': 'non-scaling-stroke' });

  const cx = (box.min.x + box.max.x) / 2;
  const cy = -(box.min.y + box.max.y) / 2;
  const over = px(12);
  el('line', { x1: cx, y1: -box.max.y - over, x2: cx, y2: -box.min.y + over, class: 'axis', 'vector-effect': 'non-scaling-stroke' });
  el('line', { x1: box.min.x - over, y1: cy, x2: box.max.x + over, y2: cy, class: 'axis', 'vector-effect': 'non-scaling-stroke' });

  // Height on the left, width below.
  const tick = px(5);
  const dimX = box.min.x - px(22);
  const dimY = -box.min.y + px(18);
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    el('line', { x1, y1, x2, y2, class: 'dim', 'vector-effect': 'non-scaling-stroke' });
  line(dimX, -box.max.y, dimX, -box.min.y);
  line(dimX - tick, -box.max.y, box.min.x - tick, -box.max.y);
  line(dimX - tick, -box.min.y, box.min.x - tick, -box.min.y);
  line(box.min.x, dimY, box.max.x, dimY);
  line(box.min.x, dimY + tick, box.min.x, -box.min.y + tick);
  line(box.max.x, dimY + tick, box.max.x, -box.min.y + tick);
  const fontSize = px(14);
  const label = (x: number, y: number, text: string, rotate = false) => {
    const t = el('text', {
      x,
      y,
      'font-size': fontSize,
      'text-anchor': 'middle',
      ...(rotate ? { transform: `rotate(-90 ${x} ${y})` } : {}),
    });
    t.textContent = text;
  };
  label(dimX - fontSize * 0.45, cy, mm(h), true);
  label(cx, dimY + fontSize * 1.15, mm(w));
}

// --- three.js scene ---

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;
const camera = new THREE.PerspectiveCamera(35, 1, 10, 500000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const grid = new THREE.GridHelper(40000, 40);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

const steel = new THREE.MeshStandardMaterial({ metalness: 0.55, roughness: 0.45 });
const edgeMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.4 });
const mesh = new THREE.Mesh(new THREE.BufferGeometry(), steel);
const edges = new THREE.LineSegments(new THREE.BufferGeometry(), edgeMaterial);
const memberGroup = new THREE.Group();
memberGroup.add(mesh, edges);
scene.add(memberGroup);

function applyTheme(): void {
  const css = getComputedStyle(document.documentElement);
  const color = (name: string) => new THREE.Color(css.getPropertyValue(name).trim());
  scene.background = color('--viewport');
  steel.color = color('--steel');
  edgeMaterial.color = color('--ink');
  const gridMaterial = grid.material as THREE.LineBasicMaterial;
  gridMaterial.color = color('--rule');
  gridMaterial.vertexColors = false;
  gridMaterial.needsUpdate = true;
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

function fitView(): void {
  memberGroup.updateMatrixWorld();
  const sphere = new THREE.Box3().setFromObject(memberGroup).getBoundingSphere(new THREE.Sphere());
  const distance = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.95;
  const direction = new THREE.Vector3(0.62, -1, 0.55).normalize();
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(direction, distance);
  controls.update();
}

function resize(): void {
  const { clientWidth: w, clientHeight: h } = canvas.parentElement!;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement!);

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

// --- UI ---

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const familySelect = $<HTMLSelectElement>('familySelect');
const sizeSelect = $<HTMLSelectElement>('sizeSelect');
const sliders = Object.fromEntries(NUMBER_KEYS.map((k) => [k, $<HTMLInputElement>(k)])) as Record<NumberKey, HTMLInputElement>;
const UNITS: Record<NumberKey, (v: number) => string> = {
  length: (v) => `${mm(v)} mm`,
  radius: (v) => `${mm(v)} mm`,
  sweep: (v) => `${v}°`,
  spiralRadius: (v) => `${mm(v)} mm`,
  turns: (v) => nf(2)(v),
  rise: (v) => `${mm(v)} mm`,
  roll: (v) => `${v}°`,
  startCut: (v) => `${v}°`,
  endCut: (v) => `${v}°`,
};

for (const family of families.keys()) familySelect.add(new Option(family, family));

function fillSizes(family: string): void {
  sizeSelect.replaceChildren(...families.get(family)!.map((p) => new Option(p.displayName, p.id)));
}

function syncControls(): void {
  const profile = getProfile(state.profile)!;
  familySelect.value = profile.category ?? 'Other';
  fillSizes(familySelect.value);
  sizeSelect.value = profile.id;
  for (const radio of document.querySelectorAll<HTMLInputElement>('input[name=kind]')) radio.checked = radio.value === state.kind;
  for (const key of NUMBER_KEYS) sliders[key].value = String(state[key]);
}

let lastShape = '';

function render(): void {
  const profile = getProfile(state.profile)!;
  const section = buildCrossSection(profile.shape);
  const member = buildMember(state, section);

  // The sheet.
  const designation = $('designation');
  designation.textContent = profile.displayName;
  designation.style.fontSize = '';
  // Long names (SHS 100x100x5) shrink to the panel width rather than clip.
  if (designation.scrollWidth > designation.clientWidth) {
    const size = parseFloat(getComputedStyle(designation).fontSize);
    designation.style.fontSize = `${Math.floor((size * designation.clientWidth) / designation.scrollWidth)}px`;
  }
  $('family').textContent = FAMILY_NAMES[profile.category ?? ''] ?? profile.category ?? '';
  drawFigure(document.getElementById('figure') as unknown as SVGSVGElement, section);
  const area = sectionAreaMm2(section);
  const massPerM = area * 0.00785;
  const rows: [string, string][] = [
    ...dimensionRows(profile.shape).map(([k, v]) => [k, mm(v)] as [string, string]),
    ['A', `${nf(1)(area / 100)} cm²`],
    ['G', `${nf(1)(massPerM)} kg/m`],
  ];
  $('dims').replaceChildren(
    ...rows.map(([k, v]) => {
      const row = document.createElement('div');
      if (k === 'A') row.className = 'area';
      if (k === 'G') row.className = 'mass';
      row.innerHTML = `<dt>${k}</dt><dd>${v}</dd>`;
      return row;
    }),
  );

  // The member.
  for (const group of document.querySelectorAll<HTMLElement>('[data-kind]')) group.hidden = group.dataset.kind !== state.kind;
  for (const key of NUMBER_KEYS) sliders[key].nextElementSibling!.textContent = UNITS[key](state[key]);

  const geometry = beamToBufferGeometry(member.beam, {
    startCut: member.startCut,
    endCut: member.endCut,
    maxDegPerStation: 2,
  });
  mesh.geometry.dispose();
  edges.geometry.dispose();
  mesh.geometry = geometry;
  edges.geometry = new THREE.EdgesGeometry(geometry, 28);
  // Sit the member on the grid, centred.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  memberGroup.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -box.min.z);

  const length = member.beam.length;
  $('stats').innerHTML =
    `<b>${nf(0)(length)}</b> mm long, <b>${nf(0)((massPerM * length) / 1000)}</b> kg, ` +
    `${nf(0)(geometry.getAttribute('position').count / 3)} triangles`;

  $('snippet').textContent = snippet(state, member);
  writeHash(state);

  const shapeKey = `${state.profile}|${state.kind}`;
  if (shapeKey !== lastShape) {
    lastShape = shapeKey;
    fitView();
  }
}

familySelect.addEventListener('change', () => {
  fillSizes(familySelect.value);
  const sizes = families.get(familySelect.value)!;
  state.profile = sizes[Math.floor(sizes.length / 2)].id;
  sizeSelect.value = state.profile;
  render();
});
sizeSelect.addEventListener('change', () => {
  state.profile = sizeSelect.value;
  render();
});
for (const radio of document.querySelectorAll<HTMLInputElement>('input[name=kind]')) {
  radio.addEventListener('change', () => {
    state.kind = radio.value as Kind;
    render();
  });
}
for (const key of NUMBER_KEYS) {
  sliders[key].addEventListener('input', () => {
    state[key] = Number(sliders[key].value);
    render();
  });
}
$('fit').addEventListener('click', fitView);
$('copy').addEventListener('click', async () => {
  const button = $<HTMLButtonElement>('copy');
  await navigator.clipboard.writeText($('snippet').textContent ?? '');
  button.textContent = 'Copied';
  setTimeout(() => (button.textContent = 'Copy code'), 1500);
});
window.addEventListener('hashchange', () => {
  state = readHash();
  syncControls();
  render();
});

syncControls();
resize();
render();
// The designation fit and the figure layout depend on the web fonts and the panel size.
document.fonts.ready.then(render);
window.addEventListener('resize', render);
