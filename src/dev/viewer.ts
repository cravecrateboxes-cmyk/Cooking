import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import url from '../assets/character.glb?url';
import foodUrl from '../assets/food.glb?url';
import propsUrl from '../assets/props.glb?url';
import { toonify } from '../engine/toon';

const params = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe8f5');
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
const view = params.get('view') ?? 'front';
if (view === 'top') cam.position.set(0, 9, 9);
else if (view === 'side') cam.position.set(0, 1.0, 9);
else cam.position.set(0, 1.4, 9);
cam.lookAt(0, 0.6, 0);
scene.add(new THREE.HemisphereLight('#ffffff', '#8fa3b5', 1.6));
const sun = new THREE.DirectionalLight('#ffffff', 2.2);
sun.position.set(3, 6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#f4f6f8' }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const t = Number(params.get('t') ?? '0.25');
if (params.get('props')) {
  new GLTFLoader().load(propsUrl, (g) => {
    const kids = [...g.scene.children];
    scene.background = new THREE.Color('#ffb36b');
    (ground.material as THREE.MeshStandardMaterial).color.set('#ffa75a');
    cam.position.set(14, 16, 14);
    cam.fov = 30; cam.updateProjectionMatrix();
    cam.lookAt(0, 0.5, 0);
    kids.forEach((k, i) => {
      toonify(k);
      k.position.set(((i % 6) - 2.5) * 3.2, 0, Math.floor(i / 6) * 3.2 - 6.4);
      k.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
      scene.add(k);
    });
    renderer.render(scene, cam);
    (window as unknown as { ready: boolean }).ready = true;
  });
} else if (params.get('food')) {
  new GLTFLoader().load(foodUrl, (g) => {
    const kids = [...g.scene.children];
    cam.position.set(0, 2.2, 3.4);
    cam.lookAt(0, 0.05, 0);
    kids.forEach((k, i) => {
      k.position.set(((i % 6) - 2.5) * 0.42, 0, Math.floor(i / 6) * 0.5 - 0.25);
      k.traverse((o) => { o.castShadow = true; });
      scene.add(k);
    });
    renderer.render(scene, cam);
    (window as unknown as { ready: boolean }).ready = true;
  });
} else new GLTFLoader().load(url, (g) => {
  const names = g.animations.map((a) => a.name);
  const only = params.get('anim');
  const strip = params.get('strip');
  const list = strip ? Array.from({ length: 6 }, () => strip) : only ? [only] : names;
  const cols = Math.min(list.length, 6);
  list.forEach((n, i) => {
    const m = clone(g.scene);
    const col = ['#3fa9f5', '#f0533f', '#36c46d', '#f5b82e', '#a66cf0', '#ff7ab0'][i % 6];
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({ color: col, roughness: 0.38 });
        mesh.castShadow = true;
      }
    });
    const off = ((i % cols) - (cols - 1) / 2) * 1.3;
     m.position.set(off, 0, -Math.floor(i / cols) * 1.6);
    if (view === 'side') m.rotation.y = Math.PI / 2;
    scene.add(m);
    const mixer = new THREE.AnimationMixer(m);
    const clip = g.animations.find((a) => a.name === n)!;
    const a = mixer.clipAction(clip);
    a.play();
    mixer.setTime(clip.duration * (strip ? i / 6 : t));
  });
  renderer.render(scene, cam);
  (window as unknown as { ready: boolean }).ready = true;
});
