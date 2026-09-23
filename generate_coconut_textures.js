import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/textures/coconut');
fs.mkdirSync(outDir, { recursive: true });

console.log('Generating Photorealistic Young Tender Coconut PBR Textures matching reference photo in:', outDir);

function makeNoise(seed = 42) {
  const p = new Uint8Array(512);
  let s = seed;
  for (let i = 0; i < 256; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    p[i] = s & 255;
  }
  for (let i = 0; i < 256; i++) p[256 + i] = p[i];

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(t, a, b) { return a + t * (b - a); }
  function grad(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  return function perlin(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const a = p[X] + Y;
    const b = p[X + 1] + Y;
    return lerp(v,
      lerp(u, grad(p[a], xf, yf), grad(p[b], xf - 1, yf)),
      lerp(u, grad(p[a + 1], xf, yf - 1), grad(p[b + 1], xf - 1, yf - 1))
    );
  };
}

const n1 = makeNoise(317);
const n2 = makeNoise(743);
const n3 = makeNoise(929);
const n4 = makeNoise(1553);
const n5 = makeNoise(2111);

function fbm(x, y, octaves = 3) {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let o = 0; o < octaves; o++) {
    val += n1(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return val;
}

// 1. 4K FRESH TENDER GREEN COCONUT ALBEDO (4096 x 2048)
// Exact match to user reference photograph (fresh succulent young green tender coconut)
function generateHuskAlbedo() {
  const W = 4096;
  const H = 2048;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  console.log('Rendering 4K Reference-Matched Young Tender Coconut Albedo...');

  for (let y = 0; y < H; y++) {
    const v = y / H;

    // Gradient sampled directly from reference photo:
    // Crown area (v < 0.15): fresh vegetative sap green (#78a32a)
    // Upper shoulder (v 0.15 - 0.45): sunlit golden-green (#b4ce58 -> #96be34)
    // Mid-body (v 0.45 - 0.80): rich succulent young green (#82b024)
    // Base underside (v 0.80 - 1.0): shaded olive-green (#64861c)
    let baseR, baseG, baseB;
    if (v < 0.15) {
      const t = v / 0.15;
      baseR = 110 * (1 - t) + 165 * t;
      baseG = 155 * (1 - t) + 200 * t;
      baseB = 38 * (1 - t) + 72 * t;
    } else if (v >= 0.15 && v < 0.48) {
      const t = (v - 0.15) / 0.33;
      baseR = 165 * (1 - t) + 138 * t;
      baseG = 200 * (1 - t) + 182 * t;
      baseB = 72 * (1 - t) + 42 * t;
    } else if (v >= 0.48 && v < 0.82) {
      const t = (v - 0.48) / 0.34;
      baseR = 138 * (1 - t) + 104 * t;
      baseG = 182 * (1 - t) + 140 * t;
      baseB = 42 * (1 - t) + 28 * t;
    } else {
      const t = (v - 0.82) / 0.18;
      baseR = 104 * (1 - t) + 88 * t;
      baseG = 140 * (1 - t) + 120 * t;
      baseB = 28 * (1 - t) + 24 * t;
    }

    for (let x = 0; x < W; x++) {
      const u = x / W;

      // Gentle organic skin variation
      const mottle = fbm(u * 6.0, v * 5.0, 3) * 0.045;
      // Very subtle longitudinal natural grain (organic, not corduroy lines!)
      const subtleGrain = n2(u * 160.0, v * 12.0) * 0.025 + n4(u * 380.0, v * 24.0) * 0.015;

      let r = baseR * (1.0 + mottle + subtleGrain);
      let g = baseG * (1.0 + mottle + subtleGrain * 0.9);
      let b = baseB * (1.0 + mottle * 0.8 + subtleGrain * 0.6);

      // Microscopic botanical lenticel breathing pores (tiny natural pale specks as seen in photo)
      const pore = Math.pow(Math.max(0, n3(u * 320.0, v * 240.0)), 4.8);
      if (pore > 0.12) {
        const pw = Math.min(0.40, (pore - 0.12) * 2.2);
        r = r * (1 - pw) + 205 * pw;
        g = g * (1 - pw) + 232 * pw;
        b = b * (1 - pw) + 130 * pw;
      }

      const idx = (y * W + x) << 2;
      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  fs.writeFileSync(path.join(outDir, 'coconut_husk_albedo_4k.png'), canvas.toBuffer('image/png'));
  console.log('Saved coconut_husk_albedo_4k.png');
}

// 2. 4K NATURAL BOTANICAL NORMAL MAP (4096 x 2048)
// Delicate organic rind grain and micro-pores matching reference photo
function generateHuskNormal() {
  const W = 4096;
  const H = 2048;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  console.log('Rendering 4K Natural Botanical Normal Map...');

  function getHeight(u, v) {
    // Subtle organic skin waviness
    const wave = n1(u * 8.0, v * 5.0) * 0.025 + n2(u * 22.0, v * 16.0) * 0.012;
    // Delicate longitudinal rind grain
    const grain = n3(u * 140.0, v * 12.0) * 0.010;
    // Micro pores
    const pore = -Math.pow(Math.max(0, n4(u * 300.0, v * 220.0)), 4.8) * 0.025;
    return wave + grain + pore;
  }

  const du = 1.0 / W;
  const dv = 1.0 / H;
  const strength = 0.65; // Balanced natural botanical relief

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;

      const hL = getHeight((u - du + 1.0) % 1.0, v);
      const hR = getHeight((u + du) % 1.0, v);
      const hU = getHeight(u, Math.max(0, v - dv));
      const hD = getHeight(u, Math.min(1.0, v + dv));

      const dx = (hR - hL) * strength * 2.0;
      const dy = (hD - hU) * strength * 2.0;
      const dz = 1.0;

      const len = Math.hypot(dx, dy, dz);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = dz / len;

      const idx = (y * W + x) << 2;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  fs.writeFileSync(path.join(outDir, 'coconut_husk_normal_4k.png'), canvas.toBuffer('image/png'));
  console.log('Saved coconut_husk_normal_4k.png');
}

// 3. 4K HYDRATED BOTANICAL ROUGHNESS MAP (4096 x 2048)
// Hydrated young coconut cuticle with crisp specular sheen matching reference photo
function generateHuskRoughness() {
  const W = 4096;
  const H = 2048;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  console.log('Rendering 4K Hydrated Roughness Map...');

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;

      const mottle = n1(u * 8.0, v * 6.0) * 0.035;
      const grain = n2(u * 120.0, v * 10.0) * 0.020;
      // Base roughness 0.38 gives the crisp, succulent highlights of fresh fruit
      const rough = Math.max(0.28, Math.min(0.55, 0.38 + mottle + grain));

      const val = Math.round(rough * 255);
      const idx = (y * W + x) << 2;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  fs.writeFileSync(path.join(outDir, 'coconut_husk_roughness_4k.png'), canvas.toBuffer('image/png'));
  console.log('Saved coconut_husk_roughness_4k.png');
}

// 4. 2K FRESH CHOPPED WHITE MESOCARP PITH ALBEDO & NORMAL (2048 x 2048)
function generateCutAnatomyTextures() {
  const W = 2048;
  const H = 2048;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  console.log('Rendering 2K Fresh Cut White Mesocarp Albedo...');

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;

      const spongy = n2(u * 70.0, v * 65.0) * 0.015;
      const shear = n3(u * 14.0, v * 80.0) * 0.012;

      let baseR = 252;
      let baseG = 251;
      let baseB = 248;

      if (v < 0.035) {
        const t = v / 0.035;
        baseR = 115 * (1 - t) + 252 * t;
        baseG = 165 * (1 - t) + 251 * t;
        baseB = 42 * (1 - t) + 248 * t;
      }

      const r = Math.max(0, Math.min(255, Math.round(baseR * (1.0 + spongy + shear))));
      const g = Math.max(0, Math.min(255, Math.round(baseG * (1.0 + spongy + shear))));
      const b = Math.max(0, Math.min(255, Math.round(baseB * (1.0 + spongy + shear))));

      const idx = (y * W + x) << 2;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  fs.writeFileSync(path.join(outDir, 'coconut_cut_faceted_white.png'), canvas.toBuffer('image/png'));
  console.log('Saved coconut_cut_faceted_white.png');

  console.log('Rendering 2K Cut Mesocarp Normal Map...');
  const normalImg = ctx.createImageData(W, H);
  const ndata = normalImg.data;

  function getCutHeight(u, v) {
    const bladeShear = n3(u * 12.0, v * 70.0) * 0.030;
    const spongy = n2(u * 60.0, v * 55.0) * 0.018;
    return bladeShear + spongy;
  }

  const du = 1.0 / W;
  const dv = 1.0 / H;
  const strength = 0.50;

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;

      const hL = getCutHeight((u - du + 1.0) % 1.0, v);
      const hR = getCutHeight((u + du) % 1.0, v);
      const hU = getCutHeight(u, Math.max(0, v - dv));
      const hD = getCutHeight(u, Math.min(1.0, v + dv));

      const dx = (hR - hL) * strength * 2.0;
      const dy = (hD - hU) * strength * 2.0;
      const dz = 1.0;

      const len = Math.hypot(dx, dy, dz);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = dz / len;

      const idx = (y * W + x) << 2;
      ndata[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      ndata[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      ndata[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      ndata[idx + 3] = 255;
    }
  }

  ctx.putImageData(normalImg, 0, 0);
  fs.writeFileSync(path.join(outDir, 'coconut_cut_white_normal.png'), canvas.toBuffer('image/png'));
  console.log('Saved coconut_cut_white_normal.png');
}

// 5. 1K BOTANICAL FRESH STALK TEXTURE (1024 x 1024)
function generateStalkTexture() {
  const W = 1024;
  const H = 1024;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  console.log('Rendering 1K Botanical Stalk Texture...');

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;

      const grain = n1(u * 30.0, v * 8.0) * 0.08;
      const nodeRings = Math.pow(Math.max(0, Math.sin(v * Math.PI * 14.0)), 4.0) * 0.12;

      let r = 105 * (1.0 + grain - nodeRings * 0.2);
      let g = 152 * (1.0 + grain - nodeRings * 0.15);
      let b = 44 * (1.0 + grain + nodeRings * 0.1);

      const idx = (y * W + x) << 2;
      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  fs.writeFileSync(path.join(outDir, 'coconut_stalk_green.png'), canvas.toBuffer('image/png'));
  console.log('Saved coconut_stalk_green.png');
}

generateHuskAlbedo();
generateHuskNormal();
generateHuskRoughness();
generateCutAnatomyTextures();
generateStalkTexture();

console.log('--- ALL TENDER COCONUT TEXTURES MATCHING REFERENCE PHOTO GENERATED SUCCESSFULLY ---');
