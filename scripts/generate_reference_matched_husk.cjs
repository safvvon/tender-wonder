const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// High-quality PRNG and Simplex/Perlin noise functions
function createRandom(seed = 59173) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

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

const n1 = makeNoise2D(317);
const n2 = makeNoise2D(743);
const n3 = makeNoise2D(929);
const n4 = makeNoise2D(1553);
const n5 = makeNoise2D(2111);
const rand = createRandom(8812);

// Seamless cylindrical noise sampling around u in [0, 1]
function cylinderNoise(noiseFn, u, v, radiusU = 2.0, freqV = 2.0) {
  const angle = u * Math.PI * 2.0;
  const nx = Math.cos(angle) * radiusU;
  const ny = Math.sin(angle) * radiusU;
  return noiseFn(nx, v * freqV + ny * 0.15);
}

function cylinderFbm(u, v, octaves = 4, radiusU = 2.5, freqV = 2.5) {
  let val = 0;
  let amp = 0.5;
  let r = radiusU;
  let f = freqV;
  for (let o = 0; o < octaves; o++) {
    const angle = u * Math.PI * 2.0;
    val += n1(Math.cos(angle) * r, v * f + Math.sin(angle) * 0.5) * amp;
    amp *= 0.5;
    r *= 2.0;
    f *= 2.0;
  }
  return val;
}

async function generatePhotoMatchedTextures(W = 4096, H = 2048) {
  console.log(`Generating Reference-Matched 4K Tender Coconut Husk Suite (${W}x${H})...`);
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

  // Height map buffer for normal synthesis
  const heightMap = new Float32Array(W * H);

  // Pre-generate corky patch center coordinates (e.g. upper shoulder dry patches as in photo)
  // In reference photo: prominent patch on one side of shoulder (around u=0.28, v=0.18) and a second minor patch (u=0.75, v=0.22)
  // Also a vertical scar streak on lower body (u=0.45, v=0.45 to 0.75)
  const corkyCenters = [
    { u: 0.28, v: 0.17, radU: 0.11, radV: 0.09, strength: 1.0 },
    { u: 0.76, v: 0.20, radU: 0.08, radV: 0.07, strength: 0.8 },
    { u: 0.52, v: 0.12, radU: 0.07, radV: 0.05, strength: 0.6 } // calyx crown border patch
  ];

  console.log('Calculating biological layers, color gradients, and height relief...');

  for (let y = 0; y < H; y++) {
    const v = y / H; // v=0 at top crown, v=1 at bottom apex

    // 1. Biological Macro Color Gradient (Calibrated to reference photograph):
    // v < 0.06: Calyx collar (tan-green woody transition)
    // 0.06 - 0.28: Sunlit upper shoulder dome (warm glowing chartreuse / lime-yellow)
    // 0.28 - 0.68: Prime tender belly (vibrant, juicy, spring lime green)
    // 0.68 - 1.00: Deepening botanical green into lower apex
    let baseR, baseG, baseB;

    if (v < 0.06) {
      // Crown socket / collar
      const t = v / 0.06;
      baseR = 185 * (1 - t) + 215 * t;
      baseG = 175 * (1 - t) + 228 * t;
      baseB = 90 * (1 - t) + 40 * t;
    } else if (v >= 0.06 && v < 0.28) {
      // Upper sunlit shoulder (glowing golden lime / chartreuse)
      const t = (v - 0.06) / 0.22;
      baseR = 215 * (1 - t) + 185 * t;
      baseG = 228 * (1 - t) + 218 * t;
      baseB = 40 * (1 - t) + 28 * t;
    } else if (v >= 0.28 && v < 0.68) {
      // Prime mid-body (vibrant fresh tropical green)
      const t = (v - 0.28) / 0.40;
      baseR = 185 * (1 - t) + 155 * t;
      baseG = 218 * (1 - t) + 198 * t;
      baseB = 28 * (1 - t) + 22 * t;
    } else {
      // Lower belly and apex tip (deep lush leaf green)
      const t = (v - 0.68) / 0.32;
      baseR = 155 * (1 - t) + 125 * t;
      baseG = 198 * (1 - t) + 170 * t;
      baseB = 22 * (1 - t) + 16 * t;
    }

    const rowOffset = y * W;

    for (let x = 0; x < W; x++) {
      const u = x / W; // u in [0, 1] wrapping seamlessly

      // A. Seamless cylindrical noise coordinates
      const angle = u * Math.PI * 2.0;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Fine longitudinal growth grain (fibrous micro-veins along fruit meridian)
      const fiberFreq = 75.0;
      const fiberNoise = n1(cosA * 4.0, sinA * 4.0 + v * 28.0) * 0.035
                       + n2(cosA * fiberFreq, sinA * fiberFreq + v * 4.0) * 0.018;

      // Soft natural mottled color variation (chlorophyll pooling)
      const mottle = n3(cosA * 6.0, sinA * 6.0 + v * 8.0) * 0.045
                   + n4(cosA * 14.0, sinA * 14.0 + v * 12.0) * 0.022;

      // Sun-dappled warm golden wash on one side (facing primary light)
      const sunWash = Math.max(0, cosA * 0.65 + 0.35) * Math.sin(v * Math.PI * 0.85) * 0.12;

      // B. 3 Longitudinal Suture Creases (Carpellary boundaries meeting at apex)
      // Trigonous symmetry: 3 creases at angles 0, 2PI/3, 4PI/3
      const suturePhase = (angle * 3.0) % (Math.PI * 2.0);
      const distToSuture = Math.abs(suturePhase - Math.PI) / Math.PI; // 0 at suture, 1 between
      const sutureCrease = Math.pow(Math.max(0, 1.0 - distToSuture * 3.5), 2.5);
      const sutureWeight = Math.sin(v * Math.PI); // strongest in mid body
      const sutureColorMod = sutureCrease * sutureWeight * 0.08;

      // C. Corky Weathered Tan/Brown Patches (Matching reference photo shoulders!)
      let corkyIntensity = 0.0;
      for (const cp of corkyCenters) {
        // Distance in toroidal/cylindrical space
        let du = Math.abs(u - cp.u);
        if (du > 0.5) du = 1.0 - du;
        const dv = Math.abs(v - cp.v);
        const normDist = Math.hypot(du / cp.radU, dv / cp.radV);
        if (normDist < 1.3) {
          // Organic frayed ragged edge with high frequency noise
          const edgeFray = n5(cosA * 22.0, sinA * 22.0 + v * 30.0) * 0.22;
          const patchVal = Math.max(0, 1.0 - (normDist + edgeFray));
          corkyIntensity = Math.max(corkyIntensity, Math.pow(patchVal, 1.4) * cp.strength);
        }
      }

      // D. Vertical Brown Corky Scar / Scratch Striations (Seen on center coconut!)
      let scarIntensity = 0.0;
      // Scar 1 at u=0.42, running from v=0.38 to v=0.68
      let sDu = Math.abs(u - 0.42);
      if (sDu > 0.5) sDu = 1.0 - sDu;
      if (v > 0.36 && v < 0.70 && sDu < 0.018) {
        const sWarp = n1(cosA * 30.0, v * 40.0) * 0.003;
        const sDist = Math.abs(sDu + sWarp) / 0.008;
        const sVProfile = Math.sin((v - 0.36) / 0.34 * Math.PI);
        if (sDist < 1.0) {
          scarIntensity = Math.pow(1.0 - sDist, 2.0) * sVProfile * 0.85;
        }
      }

      // Scar 2 minor at u=0.88, v=0.45 to 0.62
      let sDu2 = Math.abs(u - 0.88);
      if (sDu2 > 0.5) sDu2 = 1.0 - sDu2;
      if (v > 0.45 && v < 0.62 && sDu2 < 0.012) {
        const sDist2 = sDu2 / 0.006;
        if (sDist2 < 1.0) {
          scarIntensity = Math.max(scarIntensity, (1.0 - sDist2) * 0.6);
        }
      }

      // E. Tiny Natural Lenticels & Micro-Specks
      const lenticelNoise = n2(cosA * 120.0, sinA * 120.0 + v * 90.0);
      const isLenticel = lenticelNoise > 0.76;
      const lenticelStrength = isLenticel ? (lenticelNoise - 0.76) / 0.24 : 0.0;

      // --- COLOR COMPOSITION ---
      // Start with rich base botanical gradient
      let r = baseR * (1.0 + mottle + fiberNoise + sunWash);
      let g = baseG * (1.0 + mottle * 0.8 + fiberNoise * 0.5 + sunWash * 0.85);
      let b = baseB * (1.0 + mottle * 0.5 + sunWash * 1.6);

      // Deepen slightly in suture creases
      r *= (1.0 - sutureColorMod * 0.5);
      g *= (1.0 - sutureColorMod * 0.2);
      b *= (1.0 - sutureColorMod * 0.1);

      // Blend Corky Weathered Tan/Brown Patch
      if (corkyIntensity > 0.001) {
        // Authentic weathered corky colors from reference: #ebb473 -> #c89e5a -> #8b6834
        const corkyNoise = n4(cosA * 45.0, sinA * 45.0 + v * 55.0) * 0.15;
        const corkyR = 210 * (1.0 + corkyNoise);
        const corkyG = 168 * (1.0 + corkyNoise * 0.8);
        const corkyB = 105 * (1.0 + corkyNoise * 0.5);

        r = r * (1.0 - corkyIntensity) + corkyR * corkyIntensity;
        g = g * (1.0 - corkyIntensity) + corkyG * corkyIntensity;
        b = b * (1.0 - corkyIntensity) + corkyB * corkyIntensity;
      }

      // Blend Vertical Dark Corky Scars
      if (scarIntensity > 0.001) {
        const scarR = 75;
        const scarG = 60;
        const scarB = 35;
        r = r * (1.0 - scarIntensity) + scarR * scarIntensity;
        g = g * (1.0 - scarIntensity) + scarG * scarIntensity;
        b = b * (1.0 - scarIntensity) + scarB * scarIntensity;
      }

      // Apply Lenticel Specks
      if (lenticelStrength > 0.0) {
        const darkR = 95;
        const darkG = 85;
        const darkB = 40;
        const lFactor = lenticelStrength * 0.65;
        r = r * (1.0 - lFactor) + darkR * lFactor;
        g = g * (1.0 - lFactor) + darkG * lFactor;
        b = b * (1.0 - lFactor) + darkB * lFactor;
      }

      const pixelIdx = (rowOffset + x) << 2;
      albedoData[pixelIdx] = Math.max(0, Math.min(255, Math.round(r)));
      albedoData[pixelIdx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      albedoData[pixelIdx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      albedoData[pixelIdx + 3] = 255;

      // --- ROUGHNESS MAP COMPOSITION ---
      // Real fresh tender coconut has a waxy, smooth, taut cuticle (roughness ~0.30 - 0.36)
      // Corky patches are dry and rough (~0.75 - 0.82)
      // Scars are slightly rougher (~0.70)
      // Lenticels slightly rougher (~0.55)
      let roughVal = 0.33 + mottle * 0.05 + fiberNoise * 0.04;
      if (sunWash > 0.05) roughVal -= 0.04; // Sunlit waxy surface has crisp glossy response
      if (corkyIntensity > 0.001) {
        roughVal = roughVal * (1.0 - corkyIntensity) + 0.78 * corkyIntensity;
      }
      if (scarIntensity > 0.001) {
        roughVal = roughVal * (1.0 - scarIntensity) + 0.72 * scarIntensity;
      }
      if (lenticelStrength > 0.0) {
        roughVal = Math.min(0.85, roughVal + lenticelStrength * 0.20);
      }

      const byteRough = Math.max(0, Math.min(255, Math.round(roughVal * 255)));
      roughData[pixelIdx] = byteRough;
      roughData[pixelIdx + 1] = byteRough;
      roughData[pixelIdx + 2] = byteRough;
      roughData[pixelIdx + 3] = 255;

      // --- HEIGHT MAP FOR NORMAL DERIVATION ---
      // Fine longitudinal fibers + suture groove + corky patch micro-relief
      const hFiber = fiberNoise * 0.6;
      const hSuture = -sutureCrease * sutureWeight * 0.008;
      const hCorky = corkyIntensity * (n5(cosA * 35.0, sinA * 35.0 + v * 40.0) * 0.006 + 0.003);
      const hScar = -scarIntensity * 0.005;
      const hPores = (n3(cosA * 80.0, sinA * 80.0 + v * 80.0) * 0.0015);

      heightMap[rowOffset + x] = hFiber + hSuture + hCorky + hScar + hPores;
    }
  }

  // --- DERIVE SEAMLESS 4K NORMAL MAP ---
  console.log('Synthesizing crisp tangent-space normal map...');
  const normalScale = 22.0;

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

generatePhotoMatchedTextures().catch(console.error);
