import { createCanvas, GlobalFonts, ImageData } from '@napi-rs/canvas';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getCachedImage } from './imageLoader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, '../../assets/models');

try {
  GlobalFonts.registerFromPath(join(__dirname, '../../assets/Roboto-Bold.ttf'), 'FitBold');
} catch (err) {
  console.warn('[FitCard] Failed to register font:', err.message);
}

// Card layout (matches the kirkahub.online 3D Fit card)
const SCALE = 2;
const CARD_W = 690;
const VIEW_H = 620;
const SLOT_H = 150;
const GAP = 3;
const SUPERSAMPLE = 1.5; // on top of SCALE; 2 used ~2x the memory, too much for the 512 MB host

// Scene setup mirrored from the website viewer (orthographic lobby camera, ambient + key light)
const FRUSTUM_HEIGHT = 4.1;
const CAMERA_Y = 1.78;
const CHARACTER_SCALE = 1.65;
const AMBIENT = 1.9;
const KEY_LIGHT = 1.6;
const KEY_DIR = new THREE.Vector3(1.5, 3, 4).normalize();

const WEAPON_MODELS = {
  SCAR: 'SCAR.glb', VITA: 'VITA.glb', 'AR-9': 'AR-9.glb', LAR: 'LAR.glb', M60: 'M60.glb',
  'MAC-10': 'MAC-10.glb', WEATIE: 'Weatie.glb', REVOLVER: 'Revolver.glb', SHARK: 'Shark.glb',
  TOMAHAWK: 'Tomahawk.glb', BAYONET: 'Bayonet.glb',
};
const WEAPON_SCALE = {
  'SCAR.glb': 2.8, 'VITA.glb': 2.4, 'AR-9.glb': 2.7, 'LAR.glb': 3, 'M60.glb': 2.7, 'MAC-10.glb': 3,
  'Weatie.glb': 3, 'Revolver.glb': 1.6, 'Shark.glb': 1.6, 'Tomahawk.glb': 5, 'Bayonet.glb': 5,
};

export const FIT_POSES = ['pose1', 'pose2', 'pose3'];

const cleanName = (name) => (name || '').replace(/^_+/, '').trim();

// ---------------------------------------------------------------------------
// Asset loading
// ---------------------------------------------------------------------------
const gltfCache = new Map();
async function loadGltf(file) {
  if (!gltfCache.has(file)) {
    const promise = readFile(join(MODELS_DIR, file)).then((buf) => {
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
    });
    promise.catch(() => gltfCache.delete(file));
    gltfCache.set(file, promise);
  }
  return gltfCache.get(file);
}

// Decoded texture pixels, bounded so big 2048px weapon textures don't pile up in memory
const texelCache = new Map();
const TEXEL_CACHE_LIMIT = 12;
async function loadTexels(url) {
  if (!url) return null;
  if (texelCache.has(url)) return texelCache.get(url);
  const img = await getCachedImage(url);
  if (!img) return null;
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const texels = { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
  texelCache.set(url, texels);
  if (texelCache.size > TEXEL_CACHE_LIMIT) texelCache.delete(texelCache.keys().next().value);
  return texels;
}

// ---------------------------------------------------------------------------
// Loadout resolution (same rules as the website: WEAPON_1/2/3 slot types)
// ---------------------------------------------------------------------------
export function resolveLoadout(profile, inventory) {
  const selected = (inventory || [])
    .map((inv) => ({ ...(inv.item || inv), isSelected: inv.isSelected }))
    .filter((item) => item.isSelected);
  const weapons = selected.filter((item) => item.type === 'WEAPON_SKIN');
  const bySlot = (slotType) => weapons.find((item) => (item.parent?.type || '').toUpperCase() === slotType) || null;

  return {
    body: profile.activeBodySkin || selected.find((item) => item.type === 'BODY_SKIN') || null,
    primary: profile.activeWeapon1Skin || bySlot('WEAPON_1'),
    secondary: bySlot('WEAPON_2'),
    melee: bySlot('WEAPON_3'),
  };
}

function catalogMatch(catalog, item) {
  if (!item?.name) return null;
  const name = cleanName(item.name).toLowerCase();
  const parent = cleanName(item.parent?.name).toLowerCase();
  return (
    catalog.find((c) => c?.name && cleanName(c.name).toLowerCase() === name && cleanName(c.parent?.name).toLowerCase() === parent) ||
    catalog.find((c) => c?.name && cleanName(c.name).toLowerCase() === name) ||
    null
  );
}

// ---------------------------------------------------------------------------
// Hand the event loop back every few ms so Discord interactions and heartbeats aren't starved mid-render
const YIELD_MS = 25;
const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

// Software rasterizer: flat-shaded, nearest-sampled textures, alpha test, z-buffer.
// Kirka's models are low-poly blocks, so this matches the WebGL look closely.
// ---------------------------------------------------------------------------
const SRGB_TO_LINEAR = new Float32Array(256).map((_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
});
// Lookup table for linear -> sRGB bytes (Math.pow per pixel was the hottest part of the render)
const LINEAR_LUT_SIZE = 8192, LINEAR_LUT_MAX = 1.25;
const LINEAR_TO_SRGB = new Uint8ClampedArray(LINEAR_LUT_SIZE + 1).map((_, i) => {
  const c = (i / LINEAR_LUT_SIZE) * LINEAR_LUT_MAX;
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(v * 255);
});
const linearToSrgb = (c) => LINEAR_TO_SRGB[c <= 0 ? 0 : c >= LINEAR_LUT_MAX ? LINEAR_LUT_SIZE : Math.round((c / LINEAR_LUT_MAX) * LINEAR_LUT_SIZE)];

class Rasterizer {
  constructor(width, height, camera) {
    this.width = width;
    this.height = height;
    this.color = new Uint8ClampedArray(width * height * 4);
    this.lastYield = performance.now();
    this.depth = new Float32Array(width * height).fill(-Infinity);
    this.camera = camera;
  }

  toScreen(v, out) {
    const { left, right, top, bottom, y } = this.camera;
    out.x = ((v.x - left) / (right - left)) * this.width;
    out.y = ((top - (v.y - y)) / (top - bottom)) * this.height;
    out.z = v.z;
    return out;
  }

  async drawMesh(mesh, texels, fallbackColor) {
    const geometry = mesh.geometry;
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const index = geometry.index;
    const count = pos.count;

    // Transform every vertex to world space (CPU skinning for the character)
    const world = new Float32Array(count * 3);
    const v = new THREE.Vector3();
    const skinned = mesh.isSkinnedMesh;
    const boneTransform = skinned && (mesh.applyBoneTransform || mesh.boneTransform).bind(mesh);
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(pos, i);
      if (skinned) boneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld);
      world[i * 3] = v.x;
      world[i * 3 + 1] = v.y;
      world[i * 3 + 2] = v.z;
    }

    const triCount = index ? index.count / 3 : count / 3;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
    const sa = {}, sb = {}, sc = {};

    for (let t = 0; t < triCount; t++) {
      if (performance.now() - this.lastYield > YIELD_MS) { await yieldToEventLoop(); this.lastYield = performance.now(); }
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      a.set(world[i0 * 3], world[i0 * 3 + 1], world[i0 * 3 + 2]);
      b.set(world[i1 * 3], world[i1 * 3 + 1], world[i1 * 3 + 2]);
      c.set(world[i2 * 3], world[i2 * 3 + 1], world[i2 * 3 + 2]);

      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
      if (n.lengthSq() === 0) continue;
      n.normalize();
      if (n.z < 0) n.negate(); // double-sided: light the side facing the camera
      const shade = (AMBIENT + KEY_LIGHT * Math.max(0, n.dot(KEY_DIR))) / Math.PI;

      this.toScreen(a, sa);
      this.toScreen(b, sb);
      this.toScreen(c, sc);
      const uvs = uv ? [uv.getX(i0), uv.getY(i0), uv.getX(i1), uv.getY(i1), uv.getX(i2), uv.getY(i2)] : null;
      this.fillTriangle(sa, sb, sc, uvs, texels, fallbackColor, shade);
    }
  }

  fillTriangle(p0, p1, p2, uvs, texels, fallbackColor, shade) {
    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
    if (Math.abs(area) < 1e-9) return;
    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
    if (minX > maxX || minY > maxY) return;

    const { color, depth, width } = this;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((p1.x - px) * (p2.y - py) - (p1.y - py) * (p2.x - px)) / area;
        const w1 = ((p2.x - px) * (p0.y - py) - (p2.y - py) * (p0.x - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;

        const z = w0 * p0.z + w1 * p1.z + w2 * p2.z;
        const di = y * width + x;
        if (z <= depth[di]) continue;

        let r = fallbackColor[0], g = fallbackColor[1], bl = fallbackColor[2];
        if (texels && uvs) {
          let u = w0 * uvs[0] + w1 * uvs[2] + w2 * uvs[4];
          let v = w0 * uvs[1] + w1 * uvs[3] + w2 * uvs[5];
          u -= Math.floor(u);
          v -= Math.floor(v);
          const tx = Math.min(texels.width - 1, Math.floor(u * texels.width));
          const ty = Math.min(texels.height - 1, Math.floor(v * texels.height)); // glTF UVs: flipY = false
          const ti = (ty * texels.width + tx) * 4;
          if (texels.data[ti + 3] < 13) continue; // alphaTest 0.05
          r = texels.data[ti];
          g = texels.data[ti + 1];
          bl = texels.data[ti + 2];
        }

        depth[di] = z;
        const ci = di * 4;
        color[ci] = linearToSrgb(SRGB_TO_LINEAR[r] * shade);
        color[ci + 1] = linearToSrgb(SRGB_TO_LINEAR[g] * shade);
        color[ci + 2] = linearToSrgb(SRGB_TO_LINEAR[bl] * shade);
        color[ci + 3] = 255;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3D scene → image
// ---------------------------------------------------------------------------
async function renderScene({ bodyTextureUrl, weaponFile, weaponTextureUrl, pose }, width, height) {
  const [characterGltf, weaponGltf, bodyTexels, weaponTexels] = await Promise.all([
    loadGltf('KirkaCharacter.glb'),
    loadGltf(weaponFile),
    loadTexels(bodyTextureUrl),
    loadTexels(weaponTextureUrl),
  ]);

  // Clone per render so concurrent commands never share animated bones
  const { clone: cloneSkinned } = await import('three/examples/jsm/utils/SkeletonUtils.js');
  const character = cloneSkinned(characterGltf.scene);
  character.scale.setScalar(CHARACTER_SCALE);
  character.rotation.y = Math.PI;

  const clip = characterGltf.animations.find((a) => a.name === pose) || characterGltf.animations.find((a) => a.name === 'pose1');
  if (clip) {
    const mixer = new THREE.AnimationMixer(character);
    mixer.clipAction(clip).play();
    mixer.update(0);
  }

  const weapon = weaponGltf.scene.clone(true);
  const weaponScale = WEAPON_SCALE[weaponFile] ?? 3;
  const lever = weapon.getObjectByName('Lever');
  weapon.scale.setScalar(weaponScale);
  if (lever) weapon.position.copy(lever.position).multiplyScalar(-weaponScale);
  (character.getObjectByName(clip?.name || 'pose1') || character).add(weapon);

  character.updateMatrixWorld(true);

  const aspect = width / height;
  const camera = {
    left: (-FRUSTUM_HEIGHT * aspect) / 2,
    right: (FRUSTUM_HEIGHT * aspect) / 2,
    top: FRUSTUM_HEIGHT / 2,
    bottom: -FRUSTUM_HEIGHT / 2,
    y: CAMERA_Y,
  };
  const raster = new Rasterizer(width, height, camera);

  const meshes = [];
  character.traverse((obj) => { if (obj.isMesh) meshes.push(obj); });
  for (const obj of meshes) {
    const isWeapon = weapon === obj || obj.parent === weapon || weapon.getObjectById(obj.id);
    await raster.drawMesh(obj, isWeapon ? weaponTexels : bodyTexels, isWeapon ? [0x4b, 0x54, 0x68] : [0x2a, 0x31, 0x48]);
  }

  const canvas = createCanvas(width, height);
  canvas.getContext('2d').putImageData(new ImageData(raster.color, width, height), 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Card composition
// ---------------------------------------------------------------------------
function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

/**
 * Render a Kirka lobby-style fit card: character holding the primary, name + level banner,
 * and primary / secondary / melee slots. Returns a PNG buffer.
 */
// One render at a time: concurrent fits would each hold full-size buffers and can exhaust the host's memory
let renderQueue = Promise.resolve();
export function renderFitCard(options) {
  const run = renderQueue.then(() => renderFitCardNow(options));
  renderQueue = run.catch(() => {});
  return run;
}

async function renderFitCardNow({ profile, inventory, catalog = [], pose = 'pose1' }) {
  const loadout = resolveLoadout(profile, inventory);
  const primary = loadout.primary;
  const primaryMatch = catalogMatch(catalog, primary);
  const weaponFile = WEAPON_MODELS[cleanName(primary?.parent?.name).toUpperCase()] || 'SCAR.glb';
  const bodyMatch = catalogMatch(catalog, loadout.body);

  const viewW = CARD_W * SCALE;
  const viewH = VIEW_H * SCALE;
  const scene = await renderScene(
    {
      bodyTextureUrl: loadout.body?.textureUrl || bodyMatch?.textureUrl || null,
      weaponFile,
      weaponTextureUrl: primary ? primary.textureUrl || primaryMatch?.textureUrl || null : null,
      pose: FIT_POSES.includes(pose) ? pose : 'pose1',
    },
    viewW * SUPERSAMPLE,
    viewH * SUPERSAMPLE
  );

  const totalH = VIEW_H + GAP + SLOT_H;
  const canvas = createCanvas(CARD_W * SCALE, totalH * SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = '#1a2033';
  ctx.fillRect(0, 0, CARD_W, totalH);
  const bg = ctx.createRadialGradient(CARD_W / 2, VIEW_H * 0.45, 0, CARD_W / 2, VIEW_H * 0.45, CARD_W * 0.75);
  bg.addColorStop(0, '#2a3450');
  bg.addColorStop(0.55, '#222a42');
  bg.addColorStop(1, '#1c2338');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, VIEW_H);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(scene, 0, 0, CARD_W, VIEW_H);

  // Level badge + name banner
  const level = String(profile.level ?? 1);
  ctx.font = '34px FitBold';
  ctx.textBaseline = 'middle';
  const name = fitText(ctx, profile.name || 'Unknown', CARD_W - 140);
  const pad = 8;
  const gap = 10;
  const lw = ctx.measureText(level).width;
  const nw = ctx.measureText(name).width;
  const x = (CARD_W - (lw + pad * 2 + gap + nw)) / 2;
  const y = 98;
  ctx.fillStyle = 'rgba(26, 32, 49, 0.9)';
  ctx.fillRect(x, y - 21, lw + pad * 2, 42);
  ctx.fillStyle = '#f5a623';
  ctx.fillText(level, x + pad, y + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, x + lw + pad * 2 + gap, y + 1);

  // Loadout slots
  const slots = [
    { label: 'Primary', item: primary },
    { label: 'Secondary', item: loadout.secondary },
    { label: 'Melee', item: loadout.melee },
  ];
  const colW = (CARD_W - GAP * 2) / 3;
  const images = await Promise.all(
    slots.map(async ({ item }) => {
      if (!item) return null;
      const img = await getCachedImage(item.renderUrl || catalogMatch(catalog, item)?.renderUrl);
      // Kirka's generic pistol render is filtered as a placeholder, but it is the real default Shark render
      if (!img && cleanName(item.parent?.name).toUpperCase() === 'SHARK') {
        return getCachedImage(join(__dirname, '../../assets/render-mini.webp'));
      }
      return img;
    })
  );
  slots.forEach(({ label, item }, i) => {
    const sx = i * (colW + GAP);
    const sy = VIEW_H + GAP;
    ctx.fillStyle = '#252d45';
    ctx.fillRect(sx, sy, colW, SLOT_H);

    ctx.font = '18px FitBold';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fitText(ctx, item ? cleanName(item.name) : label, colW - 32), sx + 16, sy + 16);

    const img = images[i];
    if (img) {
      const maxW = colW * 0.8;
      const maxH = SLOT_H - 60;
      const r = Math.min(maxW / img.width, maxH / img.height);
      const iw = img.width * r;
      const ih = img.height * r;
      ctx.drawImage(img, sx + (colW - iw) / 2, sy + 44 + (maxH - ih) / 2, iw, ih);
    }
  });

  return canvas.encode('png'); // encodes off the main thread (toBuffer blocked the bot for ~0.5s)
}
