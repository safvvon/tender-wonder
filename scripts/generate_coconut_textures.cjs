const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const outDir = path.join(__dirname, '..', 'public', 'textures', 'coconut');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Simple deterministic hash for noise
function hash2d(x, y) {
  let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = hash2d(i, j);
  const n10 = hash2d(i + 1, j);
  const n01 = hash2d(i, j + 1);
  const n11 = hash2d(i + 1, j + 1);

  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

// -------------------------------------------------------------
// 1. FRESH VIBRANT TENDER COCONUT SKIN (ALBEDO, NORMAL, ROUGHNESS)
// -------------------------------------------------------------
console.log('Generating 1024x1024 Photorealistic Tender Coconut Skin...');
const W = 1024;
const H = 1024;

const albedo = new PNG({ width: W, height: H });
const normal = new PNG({ width: W, height: H });
const roughness = new PNG({ width: W, height: H });

// Height buffer for Sobel normal generation
const heightMap = new Float32Array(W * H);

// Seeded droplets
const numDroplets = 120;
const droplets = [];
for (let d = 0; d < numDroplets; d++) {
  const dx = hash2d(d * 17.1, 41.3) * W;
  // More droplets on the belly and lower body (y: 200 to 900)
  const dy = 200 + hash2d(d * 31.7, 89.1) * (H - 300);
  const dr = 2.0 + hash2d(d * 73.5, 13.9) * 3.5;
  droplets.push({ x: dx, y: dy, r: dr });
}

// Compute height and albedo
for (let y = 0; y < H; y++) {
  const v = y / H;
  
  // Base color gradient:
  // Top: sunny lime-chartreuse (R: 165, G: 208, B: 52)
  // Mid: juicy vibrant tender green (R: 148, G: 198, B: 44)
  // Base: rich deep fresh green (R: 124, G: 172, B: 36)
  let baseR, baseG, baseB;
  if (v < 0.5) {
    const t = v / 0.5;
    baseR = 165 * (1 - t) + 148 * t;
    baseG = 208 * (1 - t) + 198 * t;
    baseB = 52 * (1 - t) + 44 * t;
  } else {
    const t = (v - 0.5) / 0.5;
    baseR = 148 * (1 - t) + 124 * t;
    baseG = 198 * (1 - t) + 172 * t;
    baseB = 44 * (1 - t) + 36 * t;
  }

  for (let x = 0; x < W; x++) {
    const u = x / W;
    const idx = (y * W + x);

    // Continuous seamless vertical micro-fibers (integer harmonics across U!)
    const f1 = Math.sin(32 * 2 * Math.PI * u + 0.4 * Math.sin(y * 0.04));
    const f2 = Math.sin(64 * 2 * Math.PI * u + 0.3 * Math.cos(y * 0.07));
    const f3 = Math.sin(128 * 2 * Math.PI * u + 0.2 * Math.sin(y * 0.11));
    const f4 = Math.sin(256 * 2 * Math.PI * u + 0.15 * Math.cos(y * 0.18));
    const f5 = Math.sin(512 * 2 * Math.PI * u);
    const fiber = f1 * 0.35 + f2 * 0.28 + f3 * 0.20 + f4 * 0.12 + f5 * 0.05;

    // Organic chlorophyll variegation
    const m1 = Math.sin(6 * 2 * Math.PI * u) * Math.cos(y * 0.015) * 0.5;
    const m2 = Math.sin(12 * 2 * Math.PI * u + 1.2) * 0.3;
    const mottling = m1 + m2;

    // Micro pores
    const poreNoise = hash2d(x * 0.31, y * 0.31);
    const isPore = poreNoise > 0.985 ? (poreNoise - 0.985) * 60 : 0;

    // Fiber height
    let h = 0.5 + fiber * 0.08 + mottling * 0.03;

    // Check droplets
    let dropletH = 0;
    let inDroplet = false;
    let dropHighlight = 0;

    for (let d = 0; d < numDroplets; d++) {
      const drop = droplets[d];
      let distSq = (x - drop.x) * (x - drop.x) + (y - drop.y) * (y - drop.y);
      // Handle wrapping in X
      const distSqWrap1 = (x - (drop.x - W)) * (x - (drop.x - W)) + (y - drop.y) * (y - drop.y);
      const distSqWrap2 = (x - (drop.x + W)) * (x - (drop.x + W)) + (y - drop.y) * (y - drop.y);
      distSq = Math.min(distSq, distSqWrap1, distSqWrap2);

      if (distSq < drop.r * drop.r) {
        const dist = Math.sqrt(distSq);
        const normDist = dist / drop.r;
        dropletH = Math.sqrt(Math.max(0, 1.0 - normDist * normDist)) * 0.4;
        inDroplet = true;

        // Specular highlight spot towards top-left
        const lx = (x - drop.x) / drop.r + 0.35;
        const ly = (y - drop.y) / drop.r + 0.35;
        if (lx * lx + ly * ly < 0.12) {
          dropHighlight = 1.0 - Math.sqrt(lx * lx + ly * ly) / Math.sqrt(0.12);
        }
        break;
      }
    }

    h += dropletH;
    heightMap[idx] = h;

    // Color computation
    let r = baseR + fiber * 9 + mottling * 5 + isPore * 12;
    let g = baseG + fiber * 11 + mottling * 6 + isPore * 12;
    let b = baseB + fiber * 3 + mottling * 2 + isPore * 8;

    if (inDroplet) {
      // Water bead refractive sheen & highlight
      r = r * 0.96 + 30 * dropletH + dropHighlight * 140;
      g = g * 0.98 + 40 * dropletH + dropHighlight * 140;
      b = b * 0.95 + 25 * dropletH + dropHighlight * 140;
    }

    const pIdx = idx * 4;
    albedo.data[pIdx + 0] = Math.min(255, Math.max(0, Math.round(r)));
    albedo.data[pIdx + 1] = Math.min(255, Math.max(0, Math.round(g)));
    albedo.data[pIdx + 2] = Math.min(255, Math.max(0, Math.round(b)));
    albedo.data[pIdx + 3] = 255;

    // Roughness
    let roughVal = 92 + fiber * 12; // base waxy cuticle ~ 0.36
    if (inDroplet) {
      roughVal = 14; // glassy water droplet ~ 0.05
    }
    roughness.data[pIdx + 0] = Math.min(255, Math.max(0, Math.round(roughVal)));
    roughness.data[pIdx + 1] = Math.min(255, Math.max(0, Math.round(roughVal)));
    roughness.data[pIdx + 2] = Math.min(255, Math.max(0, Math.round(roughVal)));
    roughness.data[pIdx + 3] = 255;
  }
}

// Compute Sobel Normal Map from heightMap (with seamless X wrap!)
for (let y = 0; y < H; y++) {
  const yPrev = Math.max(0, y - 1);
  const yNext = Math.min(H - 1, y + 1);

  for (let x = 0; x < W; x++) {
    const xPrev = (x - 1 + W) % W;
    const xNext = (x + 1) % W;

    const tl = heightMap[yPrev * W + xPrev];
    const t  = heightMap[yPrev * W + x];
    const tr = heightMap[yPrev * W + xNext];
    const l  = heightMap[y * W + xPrev];
    const r  = heightMap[y * W + xNext];
    const bl = heightMap[yNext * W + xPrev];
    const b  = heightMap[yNext * W + x];
    const br = heightMap[yNext * W + xNext];

    // Sobel gradients
    const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
    const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);

    const scale = 2.4;
    let nx = -dX * scale;
    let ny = -dY * scale;
    let nz = 1.0;
    const len = Math.hypot(nx, ny, nz) || 1.0;
    nx /= len;
    ny /= len;
    nz /= len;

    const pIdx = (y * W + x) * 4;
    normal.data[pIdx + 0] = Math.round((nx * 0.5 + 0.5) * 255);
    normal.data[pIdx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    normal.data[pIdx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    normal.data[pIdx + 3] = 255;
  }
}

fs.writeFileSync(path.join(outDir, 'coconut_skin_photoreal.png'), PNG.sync.write(albedo));
fs.writeFileSync(path.join(outDir, 'coconut_skin_photoreal_normal.png'), PNG.sync.write(normal));
fs.writeFileSync(path.join(outDir, 'coconut_skin_photoreal_roughness.png'), PNG.sync.write(roughness));
console.log('Saved coconut_skin_photoreal maps.');

// -------------------------------------------------------------
// 2. CLEAN SUCCULENT WHITE MESOCARP & MEAT TEXTURES (512x512)
// -------------------------------------------------------------
console.log('Generating Mesocarp, Meat, Stalk & Calyx maps...');
const mesoW = 512, mesoH = 512;
const mesoAlbedo = new PNG({ width: mesoW, height: mesoH });
const mesoNormal = new PNG({ width: mesoW, height: mesoH });
const meatAlbedo = new PNG({ width: mesoW, height: mesoH });

for (let y = 0; y < mesoH; y++) {
  const fy = (y / mesoH - 0.5) * 2.0;
  for (let x = 0; x < mesoW; x++) {
    const fx = (x / mesoW - 0.5) * 2.0;
    const radius = Math.hypot(fx, fy);
    const angle = Math.atan2(fy, fx);
    const pIdx = (y * mesoW + x) * 4;

    // Mesocarp: radial fibrous grain radiating from center to rind
    const mesoGrain = Math.sin(angle * 80 + Math.sin(radius * 30)) * 0.03 + Math.sin(radius * 120) * 0.02;
    const mesoBase = 248 + mesoGrain * 20;
    mesoAlbedo.data[pIdx + 0] = Math.min(255, Math.max(235, Math.round(mesoBase + 3)));
    mesoAlbedo.data[pIdx + 1] = Math.min(255, Math.max(232, Math.round(mesoBase + 1)));
    mesoAlbedo.data[pIdx + 2] = Math.min(255, Math.max(225, Math.round(mesoBase - 4)));
    mesoAlbedo.data[pIdx + 3] = 255;

    // Mesocarp normal
    const nx = Math.cos(angle * 60) * 0.15;
    const ny = Math.sin(angle * 60) * 0.15;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    mesoNormal.data[pIdx + 0] = Math.round((nx * 0.5 + 0.5) * 255);
    mesoNormal.data[pIdx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    mesoNormal.data[pIdx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    mesoNormal.data[pIdx + 3] = 255;

    // Meat: succulent, soft, pearl-white jelly kernel
    const meatGrain = Math.sin(radius * 40 + angle * 8) * 0.015;
    const meatBase = 253 + meatGrain * 10;
    meatAlbedo.data[pIdx + 0] = Math.min(255, Math.max(248, Math.round(meatBase)));
    meatAlbedo.data[pIdx + 1] = Math.min(255, Math.max(248, Math.round(meatBase)));
    meatAlbedo.data[pIdx + 2] = Math.min(255, Math.max(245, Math.round(meatBase - 2)));
    meatAlbedo.data[pIdx + 3] = 255;
  }
}

fs.writeFileSync(path.join(outDir, 'coconut_mesocarp_white.png'), PNG.sync.write(mesoAlbedo));
fs.writeFileSync(path.join(outDir, 'coconut_mesocarp_normal.png'), PNG.sync.write(mesoNormal));
fs.writeFileSync(path.join(outDir, 'coconut_meat_pearl.png'), PNG.sync.write(meatAlbedo));

// -------------------------------------------------------------
// 3. FRESH YOUNG TENDER GREEN STALK TEXTURE (512x512)
// -------------------------------------------------------------
const stalk = new PNG({ width: 512, height: 512 });
for (let y = 0; y < 512; y++) {
  const v = y / 512;
  // Node rings along vertical length
  const node = Math.pow(Math.max(0, Math.sin(v * Math.PI * 6.0)), 6.0) * 25;

  for (let x = 0; x < 512; x++) {
    const u = x / 512;
    const fiber = Math.sin(32 * 2 * Math.PI * u) * 8 + Math.sin(64 * 2 * Math.PI * u) * 4;

    const r = Math.min(255, Math.max(0, Math.round(145 + fiber + node)));
    const g = Math.min(255, Math.max(0, Math.round(188 + fiber * 1.2 + node * 1.2)));
    const b = Math.min(255, Math.max(0, Math.round(52 + fiber * 0.5 + node * 0.8)));

    const pIdx = (y * 512 + x) * 4;
    stalk.data[pIdx + 0] = r;
    stalk.data[pIdx + 1] = g;
    stalk.data[pIdx + 2] = b;
    stalk.data[pIdx + 3] = 255;
  }
}
fs.writeFileSync(path.join(outDir, 'coconut_stalk_fresh.png'), PNG.sync.write(stalk));

// -------------------------------------------------------------
// 4. FRESH OLIVE-GREEN CALYX TEXTURE (512x512)
// -------------------------------------------------------------
const calyx = new PNG({ width: 512, height: 512 });
for (let y = 0; y < 512; y++) {
  const fy = (y / 512 - 0.5) * 2.0;
  for (let x = 0; x < 512; x++) {
    const fx = (x / 512 - 0.5) * 2.0;
    const radius = Math.hypot(fx, fy);
    const angle = Math.atan2(fy, fx);

    // 6-petaled radial variation
    const petal = Math.cos(angle * 6.0);
    const radMod = 1.0 - radius * 0.4;

    const baseR = 142 + petal * 12 + radMod * 15;
    const baseG = 168 + petal * 14 + radMod * 18;
    const baseB = 68 + petal * 6 + radMod * 10;

    const pIdx = (y * 512 + x) * 4;
    calyx.data[pIdx + 0] = Math.min(255, Math.max(0, Math.round(baseR)));
    calyx.data[pIdx + 1] = Math.min(255, Math.max(0, Math.round(baseG)));
    calyx.data[pIdx + 2] = Math.min(255, Math.max(0, Math.round(baseB)));
    calyx.data[pIdx + 3] = 255;
  }
}
fs.writeFileSync(path.join(outDir, 'coconut_calyx_fresh.png'), PNG.sync.write(calyx));

console.log('ALL PROCEDURAL COCONUT TEXTURE MAPS GENERATED SUCCESSFULLY!');
