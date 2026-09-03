import getTHREE from 'headless-three';
import * as canvasPkg from '@napi-rs/canvas';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import pkg from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = pkg;
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const RENDERS_DIR = path.resolve('assets/renders');
if (!fs.existsSync(RENDERS_DIR)) {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
}

export const WEAPON_MODEL_MAP = {
  'VITA': 'VITA.glb',
  'SCAR': 'SCAR.glb',
  'SHARK': 'Shark.glb',
  'AR-9': 'AR-9.glb',
  'AR9': 'AR-9.glb',
  'LAR': 'LAR.glb',
  'SNIPER': 'LAR.glb',
  'M60': 'M60.glb',
  'MAC-10': 'MAC-10.glb',
  'MAC10': 'MAC-10.glb',
  'REVOLVER': 'Revolver.glb',
  'PISTOL': 'Revolver.glb',
  'TOMAHAWK': 'Tomahawk.glb',
  'BAYONET': 'Bayonet.glb',
  'KNIFE': 'Bayonet.glb',
  'WEATIE': 'Weatie.glb',
  'SHOTGUN': 'Weatie.glb',
};

function isCharacterSkin(type) {
  if (!type) return false;
  const n = type.trim().toUpperCase();
  return n === 'CHARACTER' || n === 'BODY_SKIN' || n === 'BODY SKIN' || n === 'BODY';
}

function cleanTextureUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  const dataIdx = trimmed.indexOf('data:image');
  if (dataIdx !== -1) {
    return trimmed.substring(dataIdx);
  }
  return trimmed;
}

function mapBoxUVs(geo, right, left, top, bottom, front, back) {
  const uv = geo.attributes.uv;
  const faces = [right, left, top, bottom, front, back];
  faces.forEach(([x1, y1, x2, y2], f) => {
    const uMin = x1 / 64;
    const uMax = (x2 + 1) / 64;
    const vMin = 1 - ((y2 + 1) / 64);
    const vMax = 1 - (y1 / 64);
    const off = f * 4;
    uv.setXY(off + 0, uMin, vMax);
    uv.setXY(off + 1, uMax, vMax);
    uv.setXY(off + 2, uMin, vMin);
    uv.setXY(off + 3, uMax, vMin);
  });
  uv.needsUpdate = true;
}

function createGecko3pxCharacter(THREE, texture) {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.4,
    metalness: 0.05,
    side: THREE.DoubleSide
  });
  const skinMatAlpha = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.4,
    metalness: 0.05,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide
  });

  const p = 0.06;

  // Head
  const headGeo = new THREE.BoxGeometry(8 * p, 8 * p, 8 * p);
  mapBoxUVs(headGeo, [0, 8, 7, 15], [16, 8, 23, 15], [8, 0, 15, 7], [16, 0, 23, 7], [8, 8, 15, 15], [24, 8, 31, 15]);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 10 * p, 0);
  group.add(headMesh);

  // Hat
  const hatGeo = new THREE.BoxGeometry(8.6 * p, 8.6 * p, 8.6 * p);
  mapBoxUVs(hatGeo, [32, 8, 39, 15], [48, 8, 55, 15], [40, 0, 47, 7], [48, 0, 55, 7], [40, 8, 47, 15], [56, 8, 63, 15]);
  const hatMesh = new THREE.Mesh(hatGeo, skinMatAlpha);
  hatMesh.position.set(0, 10 * p, 0);
  group.add(hatMesh);

  // Torso
  const torsoGeo = new THREE.BoxGeometry(8 * p, 12 * p, 4 * p);
  mapBoxUVs(torsoGeo, [16, 20, 19, 31], [28, 20, 31, 31], [20, 16, 27, 19], [28, 16, 35, 19], [20, 20, 27, 31], [32, 20, 39, 31]);
  const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
  group.add(torsoMesh);

  // Jacket
  const jacketGeo = new THREE.BoxGeometry(8.6 * p, 12.6 * p, 4.6 * p);
  mapBoxUVs(jacketGeo, [16, 36, 19, 47], [28, 36, 31, 47], [20, 32, 27, 35], [28, 32, 35, 35], [20, 36, 27, 47], [32, 36, 39, 47]);
  const jacketMesh = new THREE.Mesh(jacketGeo, skinMatAlpha);
  group.add(jacketMesh);

  // Right Arm (3px slim)
  const rArmGeo = new THREE.BoxGeometry(3 * p, 12 * p, 4 * p);
  mapBoxUVs(rArmGeo, [40, 20, 43, 31], [47, 20, 50, 31], [44, 16, 46, 19], [47, 16, 49, 19], [44, 20, 46, 31], [51, 20, 53, 31]);
  const rArmMesh = new THREE.Mesh(rArmGeo, skinMat);
  rArmMesh.position.set(-5.5 * p, 0, 0);
  group.add(rArmMesh);

  const rSleeveGeo = new THREE.BoxGeometry(3.6 * p, 12.6 * p, 4.6 * p);
  mapBoxUVs(rSleeveGeo, [40, 36, 43, 47], [47, 36, 50, 47], [44, 32, 46, 35], [47, 32, 49, 35], [44, 36, 46, 47], [51, 36, 53, 47]);
  const rSleeveMesh = new THREE.Mesh(rSleeveGeo, skinMatAlpha);
  rSleeveMesh.position.set(-5.5 * p, 0, 0);
  group.add(rSleeveMesh);

  // Left Arm (3px slim)
  const lArmGeo = new THREE.BoxGeometry(3 * p, 12 * p, 4 * p);
  mapBoxUVs(lArmGeo, [32, 52, 35, 63], [39, 52, 42, 63], [36, 48, 38, 51], [39, 48, 41, 51], [36, 52, 38, 63], [43, 52, 45, 63]);
  const lArmMesh = new THREE.Mesh(lArmGeo, skinMat);
  lArmMesh.position.set(5.5 * p, 0, 0);
  group.add(lArmMesh);

  const lSleeveGeo = new THREE.BoxGeometry(3.6 * p, 12.6 * p, 4.6 * p);
  mapBoxUVs(lSleeveGeo, [48, 52, 51, 63], [55, 52, 58, 63], [52, 48, 54, 51], [55, 48, 57, 51], [52, 52, 54, 63], [59, 52, 61, 63]);
  const lSleeveMesh = new THREE.Mesh(lSleeveGeo, skinMatAlpha);
  lSleeveMesh.position.set(5.5 * p, 0, 0);
  group.add(lSleeveMesh);

  // Right Leg
  const rLegGeo = new THREE.BoxGeometry(4 * p, 12 * p, 4 * p);
  mapBoxUVs(rLegGeo, [0, 20, 3, 31], [8, 20, 11, 31], [4, 16, 7, 19], [8, 16, 11, 19], [4, 20, 7, 31], [12, 20, 15, 31]);
  const rLegMesh = new THREE.Mesh(rLegGeo, skinMat);
  rLegMesh.position.set(-2 * p, -12 * p, 0);
  group.add(rLegMesh);

  const rPantGeo = new THREE.BoxGeometry(4.6 * p, 12.6 * p, 4.6 * p);
  mapBoxUVs(rPantGeo, [0, 36, 3, 47], [8, 36, 11, 47], [4, 32, 7, 35], [8, 32, 11, 35], [4, 36, 7, 47], [12, 36, 15, 47]);
  const rPantMesh = new THREE.Mesh(rPantGeo, skinMatAlpha);
  rPantMesh.position.set(-2 * p, -12 * p, 0);
  group.add(rPantMesh);

  // Left Leg
  const lLegGeo = new THREE.BoxGeometry(4 * p, 12 * p, 4 * p);
  mapBoxUVs(lLegGeo, [16, 52, 19, 63], [24, 52, 27, 63], [20, 48, 23, 51], [24, 48, 27, 51], [20, 52, 23, 63], [28, 52, 31, 63]);
  const lLegMesh = new THREE.Mesh(lLegGeo, skinMat);
  lLegMesh.position.set(2 * p, -12 * p, 0);
  group.add(lLegMesh);

  const lPantGeo = new THREE.BoxGeometry(4.6 * p, 12.6 * p, 4.6 * p);
  mapBoxUVs(lPantGeo, [0, 52, 3, 63], [8, 52, 11, 63], [4, 48, 7, 51], [8, 48, 11, 51], [4, 52, 7, 63], [12, 52, 15, 63]);
  const lPantMesh = new THREE.Mesh(lPantGeo, skinMatAlpha);
  lPantMesh.position.set(2 * p, -12 * p, 0);
  group.add(lPantMesh);

  return group;
}

let threeHelper = null;
async function getHelper() {
  if (!threeHelper) {
    threeHelper = await getTHREE(canvasPkg);
  }
  return threeHelper;
}

/**
 * Render a genuine 3D rotating GIF for any skin
 */
export async function generate3dGif(item, customTextureUrl = null, customType = null) {
  const cleanName = (item?.name || 'skin').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const outputFile = path.join(RENDERS_DIR, `${cleanName}.gif`);

  if (fs.existsSync(outputFile)) {
    console.log(`[Skip] Already exists: ${outputFile}`);
    return outputFile;
  }

  const resolvedType = customType || (item?.type === 'BODY_SKIN' ? 'CHARACTER' : item?.parent?.name || '');
  const isChar = isCharacterSkin(resolvedType) || item?.type === 'BODY_SKIN';
  const normType = resolvedType.trim().toUpperCase().replace(/^_+/, '');
  const modelFilename = WEAPON_MODEL_MAP[normType];

  if (!isChar && !modelFilename) {
    return null;
  }

  const rawTextureUrl = customTextureUrl || item?.textureUrl;
  const cleanedTextureUrl = cleanTextureUrl(rawTextureUrl);
  if (!cleanedTextureUrl) return null;

  let textureBuffer;
  if (cleanedTextureUrl.startsWith('data:image')) {
    const b64 = cleanedTextureUrl.split(',')[1];
    textureBuffer = Buffer.from(b64, 'base64');
  } else {
    const res = await fetch(cleanedTextureUrl);
    if (!res.ok) return null;
    textureBuffer = Buffer.from(await res.arrayBuffer());
  }

  const { data: rawPixels, info } = await sharp(textureBuffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { THREE, render } = await getHelper();

  const dataTexture = new THREE.DataTexture(new Uint8Array(rawPixels), info.width, info.height, THREE.RGBAFormat);
  dataTexture.flipY = false;
  dataTexture.magFilter = THREE.NearestFilter;
  dataTexture.minFilter = THREE.NearestFilter;
  dataTexture.needsUpdate = true;

  const scene = new THREE.Scene();
  const pivot = new THREE.Group();

  // Studio Lighting (identical to website)
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
  scene.add(ambientLight);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(3, 4, 3);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.2);
  fillLight.position.set(-3, -1, -2);
  scene.add(fillLight);

  let width = 360;
  let height = 240;
  let camera;

  if (isChar) {
    width = 300;
    height = 300;
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, -0.05, 2.3);

    const charGroup = createGecko3pxCharacter(THREE, dataTexture);
    pivot.add(charGroup);
  } else {
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.15, 1.85);

    const modelPath = path.resolve(`assets/models/${modelFilename}`);
    if (!fs.existsSync(modelPath)) return null;

    const glbBuf = fs.readFileSync(modelPath);
    const arrayBuf = glbBuf.buffer.slice(glbBuf.byteOffset, glbBuf.byteOffset + glbBuf.byteLength);

    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(arrayBuf, '', resolve, reject);
    });

    const model = gltf.scene;
    model.traverse(child => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: dataTexture,
          roughness: 0.35,
          metalness: 0.1,
          side: THREE.DoubleSide
        });
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetScale = 2.2 / (maxDim || 1);
    model.scale.setScalar(targetScale);
    model.position.x = -center.x * targetScale;
    model.position.y = -center.y * targetScale;
    model.position.z = -center.z * targetScale;

    pivot.add(model);
  }

  scene.add(pivot);

  const frames = 16;
  const gif = GIFEncoder();

  for (let i = 0; i < frames; i++) {
    pivot.rotation.y = (i / frames) * Math.PI * 2;
    const pngBuf = await render({ scene, camera, width, height, background: '#0e1017' });
    const { data: framePixels } = await sharp(pngBuf).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const palette = quantize(framePixels, 64);
    const index = applyPalette(framePixels, palette);
    gif.writeFrame(index, width, height, { palette, delay: 1000 / 12 });
  }

  gif.finish();
  const gifBuffer = Buffer.from(gif.bytes());
  fs.writeFileSync(outputFile, gifBuffer);
  console.log(`✅ [Rendered 3D] ${cleanName}.gif (${(gifBuffer.length / 1024).toFixed(1)} KB)`);
  return outputFile;
}
