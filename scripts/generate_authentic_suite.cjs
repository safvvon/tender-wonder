const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

function makeNoise2D(seed = 42) {
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

const n1 = makeNoise2D(421);
const n2 = makeNoise2D(883);
const n3 = makeNoise2D(1297);
const n4 = makeNoise2D(1741);
const n5 = makeNoise2D(2333);

async function generateAuthenticTenderCoconutSuite(W = 4096, H = 2048) {
  console.log(`Generating Flawless Reference-Matched 4K Tender Coconut Suite (${W}x${H})...`);
  const outDir = path.resolve('public/textures/coconut');

  const albedoCanvas = createCanvas(W, H);
  const albedoCtx = albedoCanvas.getContext('2d');
  const albedoImg = albedoCtx.createImageData(W, H);
  const albedoData = albedoImg.data;

  const normalCanvas = createCanvas(W, H);
  const normalCtx = normalCanvas.getContext('2d');
  const normalImg = normalCtx.createImageData(W, H);
  const normalData = normalImg.data;

  const roughCanvas = createCanvas(W, H);
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(W, H);
  const roughData = roughImg.data;

  const heightMap = new Float32Array(W * H);

  // Corky weathered tan/buff patches placed around upper shoulder/calyx zone (v: 0.05 to 0.28)
  // as observed on the reference tree coconuts
  const corkyPatches = [
    { u: 0.22, v: 0.16, radU: 0.14, radV: 0.10, strength: 0.95 },
    { u: 0.70, v: 0.19, radU: 0.11, radV: 0.08, strength: 0.75 },
    { u: 0.48, v: 0.10, radU: 0.08, radV: 0.06, strength: 0.85 }
  ];

  console.log('Synthesizing botanical layers with photographic color fidelity...');

  for (let y = 0; y < H; y++) {
    const v = y / H; // v=0 at top crown/calyx, v=1 at bottom pole

    // 1. Photographic Color Palette (Directly matched to user reference photograph):
    // - Crown collar (v < 0.07): Woody tan transition near calyx
    // - Upper shoulder dome (0.07 - 0.32): Luminous golden lime / sunlit chartreuse (#e7e224, #f5ed98)
    // - Equator & mid-body (0.32 - 0.72): Fresh, juicy tropical spring lime (#a2d832, #92ce26)
    // - Lower belly & bottom pole (0.72 - 1.00): Deep rich leaf green (#6ca518, #5a9212)
    let baseR, baseG, baseB;

    if (v < 0.07) {
      const t = v / 0.07;
      baseR = 192 * (1 - t) + 225 * t;
      baseG = 180 * (1 - t) + 235 * t;
      baseB = 92 * (1 - t) + 42 * t;
    } else if (v >= 0.07 && v < 0.32) {
      const t = (v - 0.07) / 0.25;
      baseR = 225 * (1 - t) + 190 * t;
      baseG = 235 * (1 - t) + 224 * t;
      baseB = 42 * (1 - t) + 30 * t;
    } else if (v >= 0.32 && v < 0.72) {
      const t = (v - 0.32) / 0.40;
      baseR = 190 * (1 - t) + 152 * t;
      baseG = 224 * (1 - t) + 202 * t;
      baseB = 30 * (1 - t) + 24 * t;
    } else {
      const t = (v - 0.72) / 0.28;
      // Seamlessly blends into bottom pole (no dark spot!)
      baseR = 152 * (1 - t) + 138 * t;
      baseG = 202 * (1 - t) + 188 * t;
      baseB = 24 * (1 - t) + 20 * t;
    }

    const rowOffset = y * W;

    for (let x = 0; x < W; x++) {
      const u = x / W; // u in [0, 1] wrapping seamlessly
      const angle = u * Math.PI * 2.0;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // A. Fine longitudinal growth micro-grain (fibrous channels running vertically)
      const fiberNoise = n1(cosA * 55.0, sinA * 55.0 + v * 3.5) * 0.016
                       + n2(cosA * 12.0, sinA * 12.0 + v * 24.0) * 0.024;

      // B. Gentle organic color mottling (natural chlorophyll density shifts)
      const mottle = n3(cosA * 5.0, sinA * 5.0 + v * 6.0) * 0.038
                   + n4(cosA * 11.0, sinA * 11.0 + v * 10.0) * 0.018;

      // C. Sunlit golden-yellow warm sheen wash (as seen in tropical sunlight)
      const sunGlow = Math.max(0, cosA * 0.70 + 0.30) * Math.sin(Math.pow(v, 0.7) * Math.PI * 0.9) * 0.09;

      // D. 3 Longitudinal Carpellary Suture Creases (Soft natural rounding lines)
      const suturePhase = (angle * 3.0) % (Math.PI * 2.0);
      const distToSuture = Math.abs(suturePhase - Math.PI) / Math.PI;
      const sutureCrease = Math.pow(Math.max(0, 1.0 - distToSuture * 4.0), 2.2);
      const sutureWeight = Math.sin(v * Math.PI);
      const sutureShade = sutureCrease * sutureWeight * 0.04;

      // E. Weathered Corky Tan/Buff Shoulder Patches (with organic fibrous edges)
      let corkyFactor = 0.0;
      for (const cp of corkyPatches) {
        let du = Math.abs(u - cp.u);
        if (du > 0.5) du = 1.0 - du;
        const dv = Math.abs(v - cp.v);
        const normDist = Math.hypot(du / cp.radU, dv / cp.radV);
        if (normDist < 1.35) {
          const edgeNoise = n5(cosA * 18.0, sinA * 18.0 + v * 25.0) * 0.24;
          const patchVal = Math.max(0, 1.0 - (normDist + edgeNoise));
          corkyFactor = Math.max(corkyFactor, Math.pow(patchVal, 1.3) * cp.strength);
        }
      }

      // F. Subtle Natural Scratch / Fine Corky Striations (Whisper thin, organic)
      let streakFactor = 0.0;
      // Slender vertical streak at u=0.38, v=0.35..0.65
      let duS1 = Math.abs(u - 0.38);
      if (duS1 > 0.5) duS1 = 1.0 - duS1;
      if (v > 0.32 && v < 0.68 && duS1 < 0.008) {
        const sNoise = n1(cosA * 40.0, v * 50.0) * 0.002;
        const sDist = Math.abs(duS1 + sNoise) / 0.004;
        const sEnvelope = Math.sin((v - 0.32) / 0.36 * Math.PI);
        if (sDist < 1.0) {
          streakFactor = Math.pow(1.0 - sDist, 2.0) * sEnvelope * 0.65;
        }
      }

      // G. Tiny Natural Lenticels (Minute brown botanical pores)
      const lenticelNoise = n3(cosA * 110.0, sinA * 110.0 + v * 85.0);
      const isLenticel = lenticelNoise > 0.78;
      const lenticelStrength = isLenticel ? (lenticelNoise - 0.78) / 0.22 : 0.0;

      // --- COLOR MIXING ---
      let r = baseR * (1.0 + mottle + fiberNoise + sunGlow) * (1.0 - sutureShade * 0.4);
      let g = baseG * (1.0 + mottle * 0.8 + fiberNoise * 0.6 + sunGlow * 0.8) * (1.0 - sutureShade * 0.2);
      let b = baseB * (1.0 + mottle * 0.5 + sunGlow * 1.5);

      // Blend Corky Shoulder Patches (Colors from reference: #ebb473, #d4a25b, #9e7538)
      if (corkyFactor > 0.001) {
        const cNoise = n4(cosA * 35.0, sinA * 35.0 + v * 45.0) * 0.12;
        const cR = 218 * (1.0 + cNoise);
        const cG = 176 * (1.0 + cNoise * 0.8);
        const cB = 112 * (1.0 + cNoise * 0.5);

        r = r * (1.0 - corkyFactor) + cR * corkyFactor;
        g = g * (1.0 - corkyFactor) + cG * corkyFactor;
        b = b * (1.0 - corkyFactor) + cB * corkyFactor;
      }

      // Blend Subtle Scratches / Streaks
      if (streakFactor > 0.001) {
        const streakR = 120;
        const streakG = 110;
        const streakB = 55;
        r = r * (1.0 - streakFactor) + streakR * streakFactor;
        g = g * (1.0 - streakFactor) + streakG * streakFactor;
        b = b * (1.0 - streakFactor) + streakB * streakFactor;
      }

      // Apply Lenticel Specks
      if (lenticelStrength > 0.0) {
        const lR = 105;
        const lG = 95;
        const lB = 45;
        const lFactor = lenticelStrength * 0.55;
        r = r * (1.0 - lFactor) + lR * lFactor;
        g = g * (1.0 - lFactor) + lG * lFactor;
        b = b * (1.0 - lFactor) + lB * lFactor;
      }

      const pixelIdx = (rowOffset + x) << 2;
      albedoData[pixelIdx] = Math.max(0, Math.min(255, Math.round(r)));
      albedoData[pixelIdx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      albedoData[pixelIdx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      albedoData[pixelIdx + 3] = 255;

      // --- ROUGHNESS MAP (0.28 to 0.40 for taut living waxy skin, ~0.75 for corky patches) ---
      let roughVal = 0.31 + mottle * 0.04 + fiberNoise * 0.03;
      if (sunGlow > 0.04) roughVal -= 0.03; // Smooth waxy sunlit highlight
      if (corkyFactor > 0.001) {
        roughVal = roughVal * (1.0 - corkyFactor) + 0.74 * corkyFactor;
      }
      if (streakFactor > 0.001) {
        roughVal = roughVal * (1.0 - streakFactor) + 0.60 * streakFactor;
      }
      if (lenticelStrength > 0.0) {
        roughVal = Math.min(0.70, roughVal + lenticelStrength * 0.15);
      }

      const byteRough = Math.max(0, Math.min(255, Math.round(roughVal * 255)));
      roughData[pixelIdx] = byteRough;
      roughData[pixelIdx + 1] = byteRough;
      roughData[pixelIdx + 2] = byteRough;
      roughData[pixelIdx + 3] = 255;

      // --- HEIGHT RELIEF FOR NORMAL DERIVATION ---
      const hGrowth = fiberNoise * 0.45;
      const hSuture = -sutureCrease * sutureWeight * 0.005;
      const hCorky = corkyFactor * (n5(cosA * 30.0, sinA * 30.0 + v * 35.0) * 0.004 + 0.002);
      const hStreak = -streakFactor * 0.003;
      const hSkin = (n2(cosA * 70.0, sinA * 70.0 + v * 60.0) * 0.0012);

      heightMap[rowOffset + x] = hGrowth + hSuture + hCorky + hStreak + hSkin;
    }
  }

  // --- SEAMLESS TANGENT NORMAL SYNTHESIS ---
  console.log('Deriving 4K tangent normal map with seamless wrapping...');
  const normalScale = 18.0;

  for (let y = 0; y < H; y++) {
    const rowOffset = y * W;
    const yPrev = Math.max(0, y - 1) * W;
    const yNext = Math.min(H - 1, y + 1) * W;

    for (let x = 0; x < W; x++) {
      const xPrev = (x - 1 + W) % W;
      const xNext = (x + 1) % W;

      const hL = heightMap[rowOffset + xPrev];
      const hR = heightMap[rowOffset + xNext];
      const hU = heightMap[yPrev + x];
      const hD = heightMap[yNext + x];

      const dx = (hR - hL) * normalScale;
      const dy = (hD - hU) * normalScale;
      const dz = 1.0;

      const len = Math.hypot(dx, dy, dz);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = dz / len;

      const targetIdx = (rowOffset + x) << 2;
      normalData[targetIdx] = Math.round((nx * 0.5 + 0.5) * 255);
      normalData[targetIdx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalData[targetIdx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalData[targetIdx + 3] = 255;
    }
  }

  albedoCtx.putImageData(albedoImg, 0, 0);
  normalCtx.putImageData(normalImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  fs.writeFileSync(path.join(outDir, 'coconut_husk_albedo_4k.png'), albedoCanvas.toBuffer('image/png'));
  console.log('   -> Successfully saved coconut_husk_albedo_4k.png');

  fs.writeFileSync(path.join(outDir, 'coconut_husk_normal_4k.png'), normalCanvas.toBuffer('image/png'));
  console.log('   -> Successfully saved coconut_husk_normal_4k.png');

  fs.writeFileSync(path.join(outDir, 'coconut_husk_roughness_4k.png'), roughCanvas.toBuffer('image/png'));
  console.log('   -> Successfully saved coconut_husk_roughness_4k.png');
}

// Generate matching Calyx Albedo as well!
// The calyx sepals in reference photo are fresh yellowish-green with dry tan margins
function generateCalyxTexture() {
  const W = 1024;
  const H = 1024;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  console.log('Generating Reference-Matched Calyx Albedo...');

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;

      // Radial pattern from center to petal tips
      const cu = (u - 0.5) * 2.0;
      const cv = (v - 0.5) * 2.0;
      const dist = Math.hypot(cu, cv);
      const angle = Math.atan2(cv, cu);

      // 6 petal lobes
      const petal = Math.pow(Math.max(0, Math.cos(angle * 3.0)), 2.0);

      // Center is woody stem collar, mid petal is vibrant yellow-green, outer tip is weathered tan
      let r, g, b;
      if (dist < 0.25) {
        // Inner collar
        r = 135; g = 115; b = 65;
      } else if (dist < 0.70) {
        // Main fleshy sepal
        const t = (dist - 0.25) / 0.45;
        r = 165 * (1 - t) + 195 * t;
        g = 190 * (1 - t) + 215 * t;
        b = 45 * (1 - t) + 40 * t;
      } else {
        // Weathered dry margin edge
        const t = Math.min(1.0, (dist - 0.70) / 0.30);
        r = 195 * (1 - t) + 160 * t;
        g = 215 * (1 - t) + 130 * t;
        b = 40 * (1 - t) + 70 * t;
      }

      const idx = (y * W + x) << 2;
      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  fs.writeFileSync('public/textures/coconut/coconut_calyx_albedo.png', canvas.toBuffer('image/png'));
  console.log('   -> Successfully saved coconut_calyx_albedo.png');
}

// Generate matching Stalk Texture
function generateBotanicalStalkTexture() {
  const W = 1024;
  const H = 1024;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  console.log('Generating Reference-Matched Stalk Texture...');

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;

      // Vertical woody fibrous striations
      const grain = n1(u * 40.0, v * 6.0) * 0.10;
      const nodeRings = Math.pow(Math.max(0, Math.sin(v * Math.PI * 16.0)), 4.0) * 0.14;

      // Fresh tropical stem green (#7a9c22 to #a4c436) with tan node rings
      let r = 145 * (1.0 + grain) + nodeRings * 45;
      let g = 182 * (1.0 + grain * 0.8) + nodeRings * 25;
      let b = 48 * (1.0 + grain * 0.5) + nodeRings * 30;

      const idx = (y * W + x) << 2;
      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  fs.writeFileSync('public/textures/coconut/coconut_stalk_green.png', canvas.toBuffer('image/png'));
  console.log('   -> Successfully saved coconut_stalk_green.png');
}

async function main() {
  await generateAuthenticTenderCoconutSuite(4096, 2048);
  generateCalyxTexture();
  generateBotanicalStalkTexture();
  console.log('--- ALL REFERENCE-MATCHED TEXTURES GENERATED SUCCESSFULLY ---');
}

main().catch(console.error);
