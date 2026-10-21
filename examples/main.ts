// A small steel scene: portal frames with mitered rafters, purlins, a curved tube arch and a
// spiral stair stringer. three-steel works in millimetres with Z up; the group below turns that
// into three.js metres with Y up.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Arc3D, BeamGeometry, buildCrossSection, getProfile, Helix3D, Plane3D, Point3D, Vector3D } from '../src';
import { beamToBufferGeometry, createBeamGeometry, type BeamSpec } from '../src/three';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9ecef);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(9.5, 8.5, 13.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(3.5, 1.8, -2.5);
controls.update();

const steel = new THREE.MeshStandardMaterial({ color: 0x8a939d, metalness: 0.6, roughness: 0.42 });
const world = new THREE.Group();
world.rotation.x = -Math.PI / 2; // Z up -> Y up
world.scale.setScalar(0.001); // mm -> m
scene.add(world);
scene.add(new THREE.GridHelper(40, 40, 0xb8bec5, 0xd3d8dd));

const add = (geometry: THREE.BufferGeometry) => world.add(new THREE.Mesh(geometry, steel));
const beam = (spec: BeamSpec) => add(createBeamGeometry(spec));

// Portal frames: HEA240 columns, IPE300 rafters mitered at the ridge.
const span = 8000, eaves = 4000, ridge = 5000;
for (const y of [0, 5000]) {
  beam({ profile: 'HEA240', start: [0, y, 0], end: [0, y, eaves] });
  beam({ profile: 'HEA240', start: [span, y, 0], end: [span, y, eaves] });
  const apex = new Plane3D(new Point3D(span / 2, y, ridge), new Vector3D(1, 0, 0));
  beam({ profile: 'IPE300', start: [0, y, eaves], end: [span / 2, y, ridge], endCut: apex });
  beam({ profile: 'IPE300', start: [span, y, eaves], end: [span / 2, y, ridge], endCut: apex });
}
// Purlins along the roof slope.
for (let i = 0; i <= 3; i++) {
  const x = (i / 3) * (span / 2 - 300);
  const z = eaves + (x / (span / 2)) * (ridge - eaves) + 210;
  for (const side of [x, span - x]) beam({ profile: 'SHS80x80x4', start: [side, -300, z], end: [side, 5300, z] });
}

// A curved CHS arch beside the frames.
const arch = Arc3D.fromThreePoints(new Point3D(11000, 0, 0), new Point3D(11000, 2500, 2600), new Point3D(11000, 5000, 0))!;
add(beamToBufferGeometry(new BeamGeometry(arch, buildCrossSection(getProfile('CHS139.7x4')!.shape))));

// Spiral stair: a UPE200 stringer round a CHS168.3 post.
const axis = new Point3D(-3500, 2500, 0);
const stringer = new Helix3D(axis, Vector3D.Z_AXIS, Vector3D.X_AXIS, 1300, 0, 1.5 * Math.PI, 4000);
add(beamToBufferGeometry(new BeamGeometry(stringer, buildCrossSection(getProfile('UPE200')!.shape))));
beam({ profile: 'CHS168.3x4.5', start: [axis.x, axis.y, 0], end: [axis.x, axis.y, 3200] });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.setAnimationLoop(() => renderer.render(scene, camera));
