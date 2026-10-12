const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// 3D Simplex-style Gradient Noise for seamless cylindrical mapping
function createNoise3D(seed = 1337) {
  const perm = new Uint8Array(512);
  let s = seed;
  for (let i = 0; i < 256; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    perm[i] = s & 255;
  }
  for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];

  const grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];

  return function noise(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const fz = z - Math.floor(z);
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const w = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;

    function dotGrad(hash, x, y, z) {
      const g = grad3[hash % 12];
      return g[0] * x + g[1] * y + g[2] * z;
    }
    function lerp(a, b, t) { return a + t * (b - a); }

    return lerp(w,
      lerp(v,
        lerp(u, dotGrad(perm[AA], fx, fy, fz), dotGrad(perm[BA], fx - 1, fy, fz)),
        lerp(u, dotGrad(perm[AB], fx, fy - 1, fz), dotGrad(perm[BB], fx - 1, fy - 1, fz))
      ),
      lerp(v,
        lerp(u, dotGrad(perm[AA + 1], fx, fy, fz - 1), dotGrad(perm[BA + 1], fx - 1, fy, fz - 1)),
        lerp(u, dotGrad(perm[AB + 1], fx, fy - 1, fz - 1), dotGrad(perm[BB + 1], fx - 1, fy - 1, fz - 1))
      )
    );
  };
}

const nA = createNoise3D(743);
const nB = createNoise3D(1297);
const nC = createNoise3D(2111);
const nD = createNoise3D(3571);

// Deterministic PRNG for natural stochastic scattering of spots/scratches
function createRng(seed = 49271) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

async function buildMasterPhotorealSuite() {
  const W = 4096;
  const H = 2048;
  const outDir = path.resolve('public/textures/coconut');

  console.log(`--- Synthesizing True Photorealistic 4K Tender Coconut Suite (${W}x${H}) ---`);

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

  // Generate realistic botanical scars matching the reference photograph:
  // 1. Prominent curved vertical scratch on front coconut
  // 2. Secondary curved rub marks
  const scars = [
    { uCenter: 0.38, vStart: 0.28, vEnd: 0.74, width: 0.0032, curve: 0.016, depth: 1.0 },
    { uCenter: 0.72, vStart: 0.42, vEnd: 0.68, width: 0.0022, curve: -0.009, depth: 0.75 },
    { uCenter: 0.15, vStart: 0.35, vEnd: 0.58, width: 0.0026, curve: 0.012, depth: 0.70 },
    { uCenter: 0.88, vStart: 0.50, vEnd: 0.76, width: 0.0020, curve: -0.006, depth: 0.60 }
  ];

  // Natural brownish contact scuff patches (where coconuts nestled in the bunch)
  const scuffs = [
    { u: 0.28, v: 0.35, rU: 0.10, rV: 0.08, intensity: 0.75 },
    { u: 0.64, v: 0.45, rU: 0.12, rV: 0.09, intensity: 0.65 },
    { u: 0.82, v: 0.30, rU: 0.09, rV: 0.07, intensity: 0.60 }
  ];

  // Pre-generate ~180 realistic individual lenticel spots scattered naturally across the body
  const rng = createRng(99281);
  const lenticels = [];
  for (let i = 0; i < 220; i++) {
    lenticels.push({
      u: rng(),
      v: 0.12 + rng() * 0.76, // across main body
      rU: 0.0006 + rng() * 0.0010,
      rV: 0.0012 + rng() * 0.0018, // slightly elongated along growth axis
      strength: 0.6 + rng() * 0.4
    });
  }

  console.log('Rendering seamless non-repeating 3D cylindrical botanical field...');

  for (let y = 0; y < H; y++) {
    const v = y / H; // v=0 is top crown pole, v=1 is bottom apex pole

    // Continuous biological macro color gradient (strictly non-tiled):
    let baseR, baseG, baseB;

    if (v < 0.024) {
      // 1. Central pale fibrous pith stump (where stem detached)
      const t = v / 0.024;
      baseR = 215 * (1 - t) + 165 * t;
      baseG = 208 * (1 - t) + 135 * t;
      baseB = 155 * (1 - t) + 52 * t;
    } else if (v >= 0.024 && v < 0.075) {
      // 2. Concentric fibrous woody collar / calyx scar
      const t = (v - 0.024) / 0.051;
      baseR = 165 * (1 - t) + 178 * t;
      baseG = 135 * (1 - t) + 212 * t;
      baseB = 52 * (1 - t) + 68 * t;
    } else if (v >= 0.075 && v < 0.34) {
      // 3. Sunlit upper shoulder dome (vibrant fresh yellow-green / chartreuse #a8d638)
      const t = (v - 0.075) / 0.265;
      baseR = 178 * (1 - t) + 142 * t;
      baseG = 212 * (1 - t) + 192 * t;
      baseB = 68 * (1 - t) + 46 * t;
    } else if (v >= 0.34 && v < 0.76) {
      // 4. Prime fresh tender green body (#82b82e / #74a826)
      const t = (v - 0.34) / 0.42;
      baseR = 142 * (1 - t) + 116 * t;
      baseG = 192 * (1 - t) + 168 * t;
      baseB = 46 * (1 - t) + 34 * t;
    } else {
      // 5. Tapered lower belly and bottom apex pole (#568616 / #487610)
      const t = (v - 0.76) / 0.24;
      baseR = 116 * (1 - t) + 98 * t;
      baseG = 168 * (1 - t) + 148 * t;
      baseB = 34 * (1 - t) + 26 * t;
    }

    const rowOffset = y * W;

    for (let x = 0; x < W; x++) {
      const u = x / W; // u in [0, 1] wrapping perfectly seamlessly

      // Continuous 3D cylindrical coordinates: NO TILING EVER!
      const angle = u * Math.PI * 2.0;
      const cx = Math.cos(angle);
      const cz = Math.sin(angle);
      const cy = v * 4.0; // vertical dimension

      // A. Fine directional growth fibers (flowing along vertical meridian lines)
      const f1 = nA(cx * 40.0, cy * 0.8, cz * 40.0) * 0.022;
      const f2 = nB(cx * 90.0, cy * 1.5, cz * 90.0) * 0.015;
      const fineFibers = f1 + f2;

      // B. Natural organic growth undulations (slightly uneven bumpy surface)
      const b1 = nC(cx * 5.0, cy * 0.9, cz * 5.0) * 0.032;
      const b2 = nD(cx * 12.0, cy * 1.6, cz * 12.0) * 0.016;
      const organicBump = b1 + b2;

      // C. Soft natural color mottling (chlorophyll density variation)
      const mottle = nA(cx * 3.5, cy * 0.7, cz * 3.5) * 0.040;

      // D. Characteristic circular stem/calyx collar radial details at top pole (v < 0.08)
      let stemScarIntensity = 0.0;
      if (v < 0.08) {
        const ringT = v / 0.08;
        const radialGrain = nB(cx * 15.0, cz * 15.0, 0.0) * 0.12;
        stemScarIntensity = Math.max(0, 1.0 - ringT + radialGrain * (1.0 - ringT));
      }

      // E. Scratches & Scars (Authentic narrow curved scratch marks)
      let scarWeight = 0.0;
      for (const sc of scars) {
        if (v >= sc.vStart && v <= sc.vEnd) {
          const vProg = (v - sc.vStart) / (sc.vEnd - sc.vStart);
          const curveOffset = Math.sin(vProg * Math.PI) * sc.curve;
          let du = Math.abs(u - (sc.uCenter + curveOffset));
          if (du > 0.5) du = 1.0 - du;
          if (du < sc.width) {
            const distNorm = du / sc.width;
            const profile = Math.pow(1.0 - distNorm, 2.0);
            const vTaper = Math.sin(vProg * Math.PI);
            const roughness = 1.0 + nC(cx * 60.0, cy * 15.0, cz * 60.0) * 0.2;
            scarWeight = Math.max(scarWeight, profile * vTaper * sc.depth * roughness);
          }
        }
      }

      // F. Natural brownish scuffs
      let scuffWeight = 0.0;
      for (const sc of scuffs) {
        let du = Math.abs(u - sc.u);
        if (du > 0.5) du = 1.0 - du;
        const dv = Math.abs(v - sc.v);
        const d = Math.hypot(du / sc.rU, dv / sc.rV);
        if (d < 1.3) {
          const edge = nD(cx * 18.0, cy * 4.0, cz * 18.0) * 0.22;
          const val = Math.max(0, 1.0 - (d + edge));
          scuffWeight = Math.max(scuffWeight, Math.pow(val, 1.3) * sc.intensity);
        }
      }

      // G. Realistic individual lenticels (pores/spots)
      let lenticelWeight = 0.0;
      for (const l of lenticels) {
        let du = Math.abs(u - l.u);
        if (du > 0.5) du = 1.0 - du;
        const dv = Math.abs(v - l.v);
        if (du < l.rU && dv < l.rV) {
          const d = Math.hypot(du / l.rU, dv / l.rV);
          if (d < 1.0) {
            lenticelWeight = Math.max(lenticelWeight, (1.0 - d) * l.strength);
          }
        }
      }

      // --- COLOR MIXING ---
      let r = baseR * (1.0 + mottle + fineFibers + organicBump * 0.5);
      let g = baseG * (1.0 + mottle * 0.8 + fineFibers * 0.7 + organicBump * 0.4);
      let b = baseB * (1.0 + mottle * 0.4 + fineFibers * 0.3);

      // Blend circular stem scar details
      if (stemScarIntensity > 0.001) {
        const sR = 145;
        const sG = 115;
        const sB = 44;
        r = r * (1.0 - stemScarIntensity * 0.82) + sR * (stemScarIntensity * 0.82);
        g = g * (1.0 - stemScarIntensity * 0.82) + sG * (stemScarIntensity * 0.82);
        b = b * (1.0 - stemScarIntensity * 0.82) + sB * (stemScarIntensity * 0.82);
      }

      // Blend authentic scratch marks (dark woody core with slight pale fibrous halo)
      if (scarWeight > 0.001) {
        const scarR = 110;
        const scarG = 88;
        const scarB = 42;
        r = r * (1.0 - scarWeight * 0.90) + scarR * (scarWeight * 0.90);
        g = g * (1.0 - scarWeight * 0.90) + scarG * (scarWeight * 0.90);
        b = b * (1.0 - scarWeight * 0.90) + scarB * (scarWeight * 0.90);
      }

      // Blend natural brownish scuffs
      if (scuffWeight > 0.001) {
        const scuffR = 168;
        const scuffG = 155;
        const scuffB = 78;
        r = r * (1.0 - scuffWeight * 0.6) + scuffR * (scuffWeight * 0.6);
        g = g * (1.0 - scuffWeight * 0.6) + scuffG * (scuffWeight * 0.6);
        b = b * (1.0 - scuffWeight * 0.6) + scuffB * (scuffWeight * 0.6);
      }

      // Apply lenticels (tiny dark brown specks)
      if (lenticelWeight > 0.0) {
        const dR = 72;
        const dG = 62;
        const dB = 26;
        const f = lenticelWeight * 0.70;
        r = r * (1.0 - f) + dR * f;
        g = g * (1.0 - f) + dG * f;
        b = b * (1.0 - f) + dB * f;
      }

      const pixelIdx = (rowOffset + x) << 2;
      albedoData[pixelIdx] = Math.max(0, Math.min(255, Math.round(r)));
      albedoData[pixelIdx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      albedoData[pixelIdx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      albedoData[pixelIdx + 3] = 255;

      // --- ROUGHNESS MAP ---
      // Taut, satin-matte living tender coconut cuticle: 0.44 - 0.50
      // Gives a natural, soft biological specular sheen under lighting showing the plump 3D shape
      // Dry woody stem scar: 0.84 - 0.88
      // Scratches: 0.82
      // Scuffs: 0.74
      // Lenticels: 0.72
      let rough = 0.46 + organicBump * 0.04 + fineFibers * 0.03;
      if (stemScarIntensity > 0.001) {
        rough = rough * (1.0 - stemScarIntensity) + 0.85 * stemScarIntensity;
      }
      if (scarWeight > 0.001) {
        rough = rough * (1.0 - scarWeight) + 0.82 * scarWeight;
      }
      if (scuffWeight > 0.001) {
        rough = rough * (1.0 - scuffWeight) + 0.74 * scuffWeight;
      }
      if (lenticelWeight > 0.0) {
        rough = Math.min(0.85, rough + lenticelWeight * 0.22);
      }

      const byteRough = Math.max(0, Math.min(255, Math.round(rough * 255)));
      roughData[pixelIdx] = byteRough;
      roughData[pixelIdx + 1] = byteRough;
      roughData[pixelIdx + 2] = byteRough;
      roughData[pixelIdx + 3] = 255;

      // --- PHYSICAL HEIGHT RELIEF ---
      const hFiber = fineFibers * 0.45;
      const hBump = organicBump * 0.60;
      const hScar = -scarWeight * 0.0075; // physical recessed groove
      const hStem = stemScarIntensity * (nB(cx * 18.0, cz * 18.0, 0.0) * 0.004 + 0.003);
      const hPore = (nD(cx * 90.0, cy * 25.0, cz * 90.0) * 0.0015);

      heightMap[rowOffset + x] = hFiber + hBump + hScar + hStem + hPore;
    }
  }

  // --- SEAMLESS 4K TANGENT NORMAL DERIVATION ---
  console.log('Deriving 4K tangent normal map...');
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

buildMasterPhotorealSuite().catch(console.error);
