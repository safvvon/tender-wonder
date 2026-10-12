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

const n1 = makeNoise2D(509);
const n2 = makeNoise2D(977);
const n3 = makeNoise2D(1481);
const n4 = makeNoise2D(2027);
const n5 = makeNoise2D(3191);

// Generate 4K suite matching harvested tender coconut reference photograph exactly
async function generateHarvestedTenderCoconutSuite(W = 4096, H = 2048) {
  console.log(`Generating Exact Reference-Matched 4K Tender Coconut Suite (${W}x${H})...`);
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

  // Natural scratch / scar definitions matching the reference photograph:
  // e.g. the prominent vertical curved scratch on the front coconut, plus secondary scratches & rub marks
  const scars = [
    // Prominent primary curved vertical scratch (as seen on front coconut in photo)
    { uCenter: 0.35, vStart: 0.28, vEnd: 0.72, width: 0.0035, curve: 0.012, depth: 0.95 },
    // Branch rub scratch mark 2
    { uCenter: 0.78, vStart: 0.40, vEnd: 0.65, width: 0.0025, curve: -0.008, depth: 0.75 },
    // Short diagonal scratch mark 3
    { uCenter: 0.12, vStart: 0.32, vEnd: 0.52, width: 0.0028, curve: 0.010, depth: 0.70 },
    // Subtle lower body scratch mark 4
    { uCenter: 0.58, vStart: 0.55, vEnd: 0.78, width: 0.0022, curve: -0.006, depth: 0.60 }
  ];

  // Natural brownish scuff patches & discolorations (where coconuts contact each other in cluster)
  const scuffs = [
    { u: 0.26, v: 0.36, rU: 0.09, rV: 0.07, intensity: 0.80 },
    { u: 0.68, v: 0.42, rU: 0.11, rV: 0.08, intensity: 0.70 },
    { u: 0.85, v: 0.28, rU: 0.08, rV: 0.06, intensity: 0.65 }
  ];

  console.log('Rendering 4K biological layers...');

  for (let y = 0; y < H; y++) {
    const v = y / H; // v=0 at circular stem/calyx pole, v=1 at bottom apex

    // 1. Biological Macro Color Gradient (Fresh Young Tender Coconut):
    // v < 0.09: Characteristic circular stem/calyx area (brown-green layered fibrous scar)
    // 0.09 - 0.35: Light tender green with subtle yellow-green variation
    // 0.35 - 0.75: Medium fresh tender green with organic mottling
    // 0.75 - 1.00: Deepening botanical green into the tapered bottom apex
    let baseR, baseG, baseB;

    if (v < 0.035) {
      // Very center of stem scar: pale fibrous pith stump
      const t = v / 0.035;
      baseR = 198 * (1 - t) + 145 * t;
      baseG = 192 * (1 - t) + 120 * t;
      baseB = 140 * (1 - t) + 45 * t;
    } else if (v >= 0.035 && v < 0.09) {
      // Layered fibrous brown-green circular woody collar / calyx scar
      const t = (v - 0.035) / 0.055;
      baseR = 145 * (1 - t) + 185 * t;
      baseG = 120 * (1 - t) + 215 * t;
      baseB = 45 * (1 - t) + 65 * t;
    } else if (v >= 0.09 && v < 0.38) {
      // Light fresh green with subtle warm yellow-green tones
      const t = (v - 0.09) / 0.29;
      baseR = 185 * (1 - t) + 165 * t;
      baseG = 215 * (1 - t) + 205 * t;
      baseB = 65 * (1 - t) + 48 * t;
    } else if (v >= 0.38 && v < 0.76) {
      // Medium natural fresh coconut green
      const t = (v - 0.38) / 0.38;
      baseR = 165 * (1 - t) + 138 * t;
      baseG = 205 * (1 - t) + 184 * t;
      baseB = 48 * (1 - t) + 38 * t;
    } else {
      // Lower belly and tapered apex tip
      const t = (v - 0.76) / 0.24;
      baseR = 138 * (1 - t) + 122 * t;
      baseG = 184 * (1 - t) + 168 * t;
      baseB = 38 * (1 - t) + 30 * t;
    }

    const rowOffset = y * W;

    for (let x = 0; x < W; x++) {
      const u = x / W; // u in [0, 1] wrapping seamlessly
      const angle = u * Math.PI * 2.0;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // A. Fine vertical fibers & shallow irregular longitudinal grooves
      // Thick fibrous young coconut husk has directional vertical fibrils running along the fruit
      const fineFibers = n1(cosA * 80.0, sinA * 80.0 + v * 5.0) * 0.028
                       + n2(cosA * 30.0, sinA * 30.0 + v * 15.0) * 0.022;

      // Natural wrinkles & slightly uneven/bumpy surface caused by natural growth
      const growthUneven = n3(cosA * 7.0, sinA * 7.0 + v * 9.0) * 0.035
                         + n4(cosA * 16.0, sinA * 16.0 + v * 14.0) * 0.018;

      // Natural organic mottling & slight darker green patches
      const colorPatch = n5(cosA * 4.5, sinA * 4.5 + v * 5.5) * 0.045;

      // B. Circular stem/calyx area radial fibrous pattern (at v < 0.10)
      let stemScarIntensity = 0.0;
      if (v < 0.10) {
        const ringT = v / 0.10;
        const radialGrain = n1(cosA * 14.0, sinA * 14.0) * 0.15;
        stemScarIntensity = Math.max(0, 1.0 - ringT + radialGrain * (1.0 - ringT));
      }

      // C. Scratches, scars & brownish marks
      let scarIntensity = 0.0;
      for (const sc of scars) {
        if (v >= sc.vStart && v <= sc.vEnd) {
          const vProgress = (v - sc.vStart) / (sc.vEnd - sc.vStart);
          const curvatureOffset = Math.sin(vProgress * Math.PI) * sc.curve;
          let du = Math.abs(u - (sc.uCenter + curvatureOffset));
          if (du > 0.5) du = 1.0 - du;
          const dist = du / sc.width;
          if (dist < 1.0) {
            const edgeTaper = Math.sin(vProgress * Math.PI);
            const crossProfile = 1.0 - dist * dist;
            const roughnessNoise = n2(cosA * 60.0, v * 80.0) * 0.2;
            scarIntensity = Math.max(scarIntensity, crossProfile * edgeTaper * sc.depth * (1.0 + roughnessNoise));
          }
        }
      }

      // D. Natural brownish scuffs & contact discolorations
      let scuffIntensity = 0.0;
      for (const sc of scuffs) {
        let du = Math.abs(u - sc.u);
        if (du > 0.5) du = 1.0 - du;
        const dv = Math.abs(v - sc.v);
        const d = Math.hypot(du / sc.rU, dv / sc.rV);
        if (d < 1.3) {
          const edgeFray = n3(cosA * 20.0, sinA * 20.0 + v * 20.0) * 0.25;
          const val = Math.max(0, 1.0 - (d + edgeFray));
          scuffIntensity = Math.max(scuffIntensity, Math.pow(val, 1.4) * sc.intensity);
        }
      }

      // E. Tiny dark spots, brownish specks and natural imperfections (lenticels)
      const speckNoise = n4(cosA * 130.0, sinA * 130.0 + v * 95.0);
      const isSpeck = speckNoise > 0.77;
      const speckFactor = isSpeck ? (speckNoise - 0.77) / 0.23 : 0.0;

      // --- COLOR MIXING ---
      let r = baseR * (1.0 + colorPatch + fineFibers + growthUneven * 0.5);
      let g = baseG * (1.0 + colorPatch * 0.8 + fineFibers * 0.7 + growthUneven * 0.4);
      let b = baseB * (1.0 + colorPatch * 0.4 + fineFibers * 0.3);

      // Blend circular stem scar (woody brown-green layered details)
      if (stemScarIntensity > 0.001) {
        const woodyR = 142;
        const woodyG = 118;
        const woodyB = 48;
        r = r * (1.0 - stemScarIntensity * 0.75) + woodyR * (stemScarIntensity * 0.75);
        g = g * (1.0 - stemScarIntensity * 0.75) + woodyG * (stemScarIntensity * 0.75);
        b = b * (1.0 - stemScarIntensity * 0.75) + woodyB * (stemScarIntensity * 0.75);
      }

      // Blend brownish scratches / scars (dark woody core with slight lighter border)
      if (scarIntensity > 0.001) {
        const scarR = 125;
        const scarG = 105;
        const scarB = 52;
        r = r * (1.0 - scarIntensity * 0.85) + scarR * (scarIntensity * 0.85);
        g = g * (1.0 - scarIntensity * 0.85) + scarG * (scarIntensity * 0.85);
        b = b * (1.0 - scarIntensity * 0.85) + scarB * (scarIntensity * 0.85);
      }

      // Blend natural brownish scuffs
      if (scuffIntensity > 0.001) {
        const scuffR = 175;
        const scuffG = 162;
        const scuffB = 88;
        r = r * (1.0 - scuffIntensity * 0.6) + scuffR * (scuffIntensity * 0.6);
        g = g * (1.0 - scuffIntensity * 0.6) + scuffG * (scuffIntensity * 0.6);
        b = b * (1.0 - scuffIntensity * 0.6) + scuffB * (scuffIntensity * 0.6);
      }

      // Apply tiny dark spots (natural blemishes)
      if (speckFactor > 0.0) {
        const darkR = 85;
        const darkG = 75;
        const darkB = 32;
        const f = speckFactor * 0.65;
        r = r * (1.0 - f) + darkR * f;
        g = g * (1.0 - f) + darkG * f;
        b = b * (1.0 - f) + darkB * f;
      }

      const pixelIdx = (rowOffset + x) << 2;
      albedoData[pixelIdx] = Math.max(0, Math.min(255, Math.round(r)));
      albedoData[pixelIdx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      albedoData[pixelIdx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      albedoData[pixelIdx + 3] = 255;

      // --- ROUGHNESS MAP ---
      // Realistic young coconut husk: slightly rough and organic surface, NEVER perfectly smooth, NO artificial gloss!
      // Base husk: ~0.60 - 0.68
      // Stem scar & scars: ~0.80 - 0.86
      // Scuffs: ~0.74
      // Specks: ~0.70
      let roughVal = 0.62 + growthUneven * 0.06 + fineFibers * 0.05;
      if (stemScarIntensity > 0.001) {
        roughVal = roughVal * (1.0 - stemScarIntensity) + 0.84 * stemScarIntensity;
      }
      if (scarIntensity > 0.001) {
        roughVal = roughVal * (1.0 - scarIntensity) + 0.80 * scarIntensity;
      }
      if (scuffIntensity > 0.001) {
        roughVal = roughVal * (1.0 - scuffIntensity) + 0.74 * scuffIntensity;
      }
      if (speckFactor > 0.0) {
        roughVal = Math.min(0.85, roughVal + speckFactor * 0.15);
      }

      const byteRough = Math.max(0, Math.min(255, Math.round(roughVal * 255)));
      roughData[pixelIdx] = byteRough;
      roughData[pixelIdx + 1] = byteRough;
      roughData[pixelIdx + 2] = byteRough;
      roughData[pixelIdx + 3] = 255;

      // --- HEIGHT RELIEF FOR TACTILE NORMAL SYNTHESIS ---
      // Organic bumpy surface + shallow fiber lines + physical scratch groove depth
      const hFiber = fineFibers * 0.55;
      const hBump = growthUneven * 0.60;
      const hScar = -scarIntensity * 0.0065; // physical recessed groove for scratch
      const hStem = stemScarIntensity * (n1(cosA * 20.0, sinA * 20.0) * 0.004 + 0.003);
      const hPores = (n5(cosA * 90.0, sinA * 90.0 + v * 70.0) * 0.0018);

      heightMap[rowOffset + x] = hFiber + hBump + hScar + hStem + hPores;
    }
  }

  // --- SEAMLESS TANGENT NORMAL DERIVATION ---
  console.log('Synthesizing tactile 4K normal map with seamless wrapping...');
  const normalScale = 24.0; // tactile fibrous micro-relief

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

// Generate matching circular stem/calyx cap texture
function generateCircularStemCapTexture() {
  const W = 1024;
  const H = 1024;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  console.log('Rendering Layered Fibrous Circular Calyx Cap Texture...');

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const cu = (u - 0.5) * 2.0;
      const cv = (v - 0.5) * 2.0;
      const rDist = Math.hypot(cu, cv);
      const angle = Math.atan2(cv, cu);

      const radialFiber = n1(Math.cos(angle * 8.0) * 3.0, Math.sin(angle * 8.0) * 3.0 + rDist * 12.0) * 0.08;

      let r, g, b;
      if (rDist < 0.22) {
        // Pale fibrous center pith
        r = 205 + radialFiber * 100;
        g = 196 + radialFiber * 80;
        b = 138 + radialFiber * 60;
      } else if (rDist < 0.65) {
        // Layered woody brown-green circular collar
        const t = (rDist - 0.22) / 0.43;
        r = (125 * (1 - t) + 165 * t) * (1.0 + radialFiber);
        g = (95 * (1 - t) + 185 * t) * (1.0 + radialFiber);
        b = (35 * (1 - t) + 55 * t) * (1.0 + radialFiber);
      } else {
        // Outer green husk blend
        const t = Math.min(1.0, (rDist - 0.65) / 0.35);
        r = 165 * (1 - t) + 155 * t;
        g = 185 * (1 - t) + 205 * t;
        b = 55 * (1 - t) + 50 * t;
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

async function main() {
  await generateHarvestedTenderCoconutSuite(4096, 2048);
  generateCircularStemCapTexture();
  console.log('--- HARVESTED TENDER COCONUT TEXTURES COMPLETED ---');
}

main().catch(console.error);
