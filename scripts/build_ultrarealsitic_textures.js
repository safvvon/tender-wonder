import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/textures/coconut');
fs.mkdirSync(outDir, { recursive: true });

function generateNormalMap(canvas, strength = 2.8) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, w, h).data;

  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i << 2;
    lum[i] = (d[idx] * 0.299 + d[idx + 1] * 0.587 + d[idx + 2] * 0.114) / 255.0;
  }

  const outCanvas = createCanvas(w, h);
  const outCtx = outCanvas.getContext('2d');
  const outImg = outCtx.createImageData(w, h);
  const outD = outImg.data;

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(h - 1, y + 1);

    for (let x = 0; x < w; x++) {
      const x0 = (x - 1 + w) % w;
      const x1 = (x + 1) % w;

      const tl = lum[y0 * w + x0];
      const tc = lum[y0 * w + x];
      const tr = lum[y0 * w + x1];
      const ml = lum[y * w + x0];
      const mr = lum[y * w + x1];
      const bl = lum[y1 * w + x0];
      const bc = lum[y1 * w + x];
      const br = lum[y1 * w + x1];

      const dx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
      const dy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);

      const nx = -dx * strength;
      const ny = -dy * strength;
      const nz = 1.0;

      const len = Math.hypot(nx, ny, nz) || 1.0;
      const idx = (y * w + x) << 2;

      outD[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      outD[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      outD[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      outD[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

function generateRoughnessMap(canvas, baseRough = 0.30, highRough = 0.55, waterRough = 0.04) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, w, h).data;

  const outCanvas = createCanvas(w, h);
  const outCtx = outCanvas.getContext('2d');
  const outImg = outCtx.createImageData(w, h);
  const outD = outImg.data;

  for (let i = 0; i < w * h; i++) {
    const idx = i << 2;
    const r = d[idx], g = d[idx + 1], b = d[idx + 2];
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0;

    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
    const isDroplet = (lum > 0.72 && sat < 0.35);

    let rough;
    if (isDroplet) {
      rough = waterRough;
    } else {
      rough = baseRough + (1.0 - lum) * (highRough - baseRough) * 0.5;
    }

    const val = Math.max(0, Math.min(255, Math.round(rough * 255)));
    outD[idx] = val;
    outD[idx + 1] = val;
    outD[idx + 2] = val;
    outD[idx + 3] = 255;
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

async function run() {
  const skinImgPath = 'C:/Users/Asus/.gemini/antigravity-ide/brain/5cb424d2-7482-4b9e-ac4d-4a24d9a14bf8/photoreal_coconut_skin_1791562699036.jpg';
  const calyxImgPath = 'C:/Users/Asus/.gemini/antigravity-ide/brain/5cb424d2-7482-4b9e-ac4d-4a24d9a14bf8/photoreal_coconut_calyx_1791562727504.jpg';
  const cutTopImgPath = 'C:/Users/Asus/.gemini/antigravity-ide/brain/5cb424d2-7482-4b9e-ac4d-4a24d9a14bf8/photoreal_coconut_cut_top_1791562751748.jpg';
  const realisticCutMeatPath = 'public/textures/coconut/coconut_cut_meat_realistic.jpg';

  console.log('1. Building 1:1 single-wrap 2K master skin...');
  const skinRaw = await loadImage(skinImgPath);
  const W = 2048, H = 2048;
  const skinCanvas = createCanvas(W, H);
  const sCtx = skinCanvas.getContext('2d');

  sCtx.drawImage(skinRaw, 0, 0, W, H);

  const imgData = sCtx.getImageData(0, 0, W, H);
  const d = imgData.data;

  const colMeans = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = 0; y < H; y++) {
      const idx = (y * W + x) << 2;
      sum += (d[idx] * 0.299 + d[idx + 1] * 0.587 + d[idx + 2] * 0.114);
    }
    colMeans[x] = sum / H;
  }

  const smoothed = new Float32Array(W);
  const r = 80;
  let gMean = 0;
  for (let x = 0; x < W; x++) {
    let s = 0, count = 0;
    for (let dx = -r; dx <= r; dx++) {
      const kx = Math.max(0, Math.min(W - 1, x + dx));
      s += colMeans[kx];
      count++;
    }
    smoothed[x] = s / count;
    gMean += colMeans[x];
  }
  gMean /= W;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2;
      const factor = gMean / smoothed[x];
      d[idx] = Math.max(0, Math.min(255, d[idx] * factor));
      d[idx + 1] = Math.max(0, Math.min(255, d[idx + 1] * factor));
      d[idx + 2] = Math.max(0, Math.min(255, d[idx + 2] * factor));
    }
  }

  // Seamless boundary wrap between x=0 and x=W across margin=160
  const margin = 160;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < margin; x++) {
      const t = x / margin;
      const smoothT = t * t * (3 - 2 * t);
      const lIdx = (y * W + x) << 2;
      const rIdx = (y * W + (W - margin + x)) << 2;

      for (let ch = 0; ch < 3; ch++) {
        const lv = d[lIdx + ch];
        const rv = d[rIdx + ch];
        const b = rv * (1 - smoothT) + lv * smoothT;
        d[lIdx + ch] = b;
        d[rIdx + ch] = b;
      }
    }
  }

  // Botanical color tuning: fresh vibrant spring green with sun highlights
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const belly = Math.sin(v * Math.PI) * 0.08;
    const topTaper = (v < 0.12) ? (0.92 + 0.08 * (v / 0.12)) : 1.0;
    const botTaper = (v > 0.85) ? (0.92 + 0.08 * ((1.0 - v) / 0.15)) : 1.0;

    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2;
      let r = d[idx];
      let g = d[idx + 1];
      let b = d[idx + 2];

      r = Math.min(255, (r * 0.95 + 16) * (1.0 + belly) * topTaper * botTaper);
      g = Math.min(255, (g * 1.08 + 14) * (1.0 + belly * 0.8) * topTaper * botTaper);
      b = Math.max(0, (b * 0.72 - 6) * topTaper * botTaper);

      d[idx] = Math.round(r);
      d[idx + 1] = Math.round(g);
      d[idx + 2] = Math.round(b);
      d[idx + 3] = 255;
    }
  }

  sCtx.putImageData(imgData, 0, 0);
  fs.writeFileSync(path.join(outDir, 'coconut_husk_albedo_4k.png'), skinCanvas.toBuffer('image/png'));
  console.log('   ✓ Saved coconut_husk_albedo_4k.png');

  const skinNormal = generateNormalMap(skinCanvas, 3.2);
  fs.writeFileSync(path.join(outDir, 'coconut_husk_normal_4k.png'), skinNormal.toBuffer('image/png'));
  console.log('   ✓ Saved coconut_husk_normal_4k.png');

  const skinRough = generateRoughnessMap(skinCanvas, 0.28, 0.52, 0.03);
  fs.writeFileSync(path.join(outDir, 'coconut_husk_roughness_4k.png'), skinRough.toBuffer('image/png'));
  console.log('   ✓ Saved coconut_husk_roughness_4k.png');

  // 2. Calyx Rosette
  console.log('2. Calyx Normal & Roughness maps...');
  const calyxImg = await loadImage(path.join(outDir, 'coconut_calyx_albedo.png'));
  const calyxCvs = createCanvas(calyxImg.width, calyxImg.height);
  calyxCvs.getContext('2d').drawImage(calyxImg, 0, 0);
  const calyxNormal = generateNormalMap(calyxCvs, 3.0);
  fs.writeFileSync(path.join(outDir, 'coconut_calyx_normal.png'), calyxNormal.toBuffer('image/png'));
  console.log('   ✓ Saved coconut_calyx_normal.png');

  const calyxRough = generateRoughnessMap(calyxCvs, 0.45, 0.75, 0.45);
  fs.writeFileSync(path.join(outDir, 'coconut_calyx_roughness.png'), calyxRough.toBuffer('image/png'));
  console.log('   ✓ Saved coconut_calyx_roughness.png');

  console.log('--- ALL MAPS READY ---');
}

run().catch(console.error);
