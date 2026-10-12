const { createCanvas, loadImage } = require('@napi-rs/canvas');
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

const n1 = makeNoise2D(617);
const n2 = makeNoise2D(1039);
const n3 = makeNoise2D(1693);
const n4 = makeNoise2D(2287);
const n5 = makeNoise2D(3407);

async function generatePhotorealisticSuite() {
  const W = 4096;
  const H = 2048;
  const outDir = path.resolve('public/textures/coconut');

  console.log(`Loading real-life photographic source textures...`);
  const patchSkin = await loadImage('scratch/harvested_patches/patch_center_skin.png');
  const patchScratch = await loadImage('scratch/harvested_patches/patch_center_scratch.png');
  const patchCalyx = await loadImage('scratch/harvested_patches/patch_calyx_scar_ring.png');
  const patchSunlit = await loadImage('scratch/harvested_patches/patch_top_yellow_green.png');

  // Convert patches to pixel buffers
  function getPixelData(img) {
    const cvs = createCanvas(img.width, img.height);
    const ctx = cvs.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return {
      w: img.width,
      h: img.height,
      data: new Float32Array(ctx.getImageData(0, 0, img.width, img.height).data)
    };
  }

  const skinBuf = getPixelData(patchSkin);
  const scratchBuf = getPixelData(patchScratch);
  const calyxBuf = getPixelData(patchCalyx);
  const sunlitBuf = getPixelData(patchSunlit);

  function sampleTile(buf, u, v) {
    u = ((u % 1.0) + 1.0) % 1.0;
    v = ((v % 1.0) + 1.0) % 1.0;
    const x = Math.floor(u * (buf.w - 1));
    const y = Math.floor(v * (buf.h - 1));
    const idx = (y * buf.w + x) << 2;
    return [buf.data[idx], buf.data[idx + 1], buf.data[idx + 2]];
  }

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

  console.log('Synthesizing 4K photographic albedo and tactile height layers...');

  for (let y = 0; y < H; y++) {
    const v = y / H; // v=0 at circular stem/calyx pole, v=1 at bottom pole

    // 1. Biological Macro Color Gradient from reference photo:
    // v < 0.08: Circular stem/calyx scar (layered fibrous woody collar + central pith)
    // 0.08 - 0.32: Sunlit upper shoulder dome (warm glowing yellow-green #a8cc42 to #98be36)
    // 0.32 - 0.72: Prime tender green body (#80ad2c to #709e24)
    // 0.72 - 1.00: Deepening botanical green into tapered bottom apex (#5a8818 to #4a7512)
    let baseR, baseG, baseB;

    if (v < 0.035) {
      // Very center of stem scar: pale fibrous pith
      const t = v / 0.035;
      baseR = 210 * (1 - t) + 155 * t;
      baseG = 205 * (1 - t) + 128 * t;
      baseB = 145 * (1 - t) + 42 * t;
    } else if (v >= 0.035 && v < 0.08) {
      // Woody brown-green concentric collar
      const t = (v - 0.035) / 0.045;
      baseR = 155 * (1 - t) + 168 * t;
      baseG = 128 * (1 - t) + 204 * t;
      baseB = 42 * (1 - t) + 66 * t;
    } else if (v >= 0.08 && v < 0.35) {
      // Warm sunlit yellow-green shoulder
      const t = (v - 0.08) / 0.27;
      baseR = 168 * (1 - t) + 140 * t;
      baseG = 204 * (1 - t) + 188 * t;
      baseB = 66 * (1 - t) + 48 * t;
    } else if (v >= 0.35 && v < 0.75) {
      // Prime fresh tender green body
      const t = (v - 0.35) / 0.40;
      baseR = 140 * (1 - t) + 115 * t;
      baseG = 188 * (1 - t) + 168 * t;
      baseB = 48 * (1 - t) + 36 * t;
    } else {
      // Deep botanical green lower belly & apex
      const t = (v - 0.75) / 0.25;
      baseR = 115 * (1 - t) + 95 * t;
      baseG = 168 * (1 - t) + 148 * t;
      baseB = 36 * (1 - t) + 28 * t;
    }

    const rowOffset = y * W;

    for (let x = 0; x < W; x++) {
      const u = x / W; // u in [0, 1] wrapping seamlessly
      const angle = u * Math.PI * 2.0;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // A. Sample real photographic high-frequency skin texture:
      // Tile photographic skin with organic noise warping
      const warpU = n1(cosA * 3.5, v * 3.5) * 0.08;
      const warpV = n2(sinA * 3.5, v * 3.5) * 0.08;
      const photoU = u * 6.0 + warpU;
      const photoV = v * 5.0 + warpV;
      const pColor = sampleTile(skinBuf, photoU, photoV);
      const pSun = sampleTile(sunlitBuf, photoU * 1.2, photoV * 1.2);

      // Extract real photo luminance variation
      const photoLum = (pColor[0] * 0.299 + pColor[1] * 0.587 + pColor[2] * 0.114) / 195.0;
      const photoDetail = (photoLum - 1.0) * 0.22;

      // B. Fine vertical fibers & natural shallow grooves (meridian growth flow)
      const fiberGrain = n1(cosA * 70.0, sinA * 70.0 + v * 4.5) * 0.024
                       + n2(cosA * 25.0, sinA * 25.0 + v * 12.0) * 0.020;

      // Natural organic growth bumps & slight uneven facets
      const organicBump = n3(cosA * 6.5, sinA * 6.5 + v * 8.0) * 0.032
                        + n4(cosA * 14.0, sinA * 14.0 + v * 12.0) * 0.016;

      // Soft natural mottling & darker green patches
      const mottle = n5(cosA * 4.0, sinA * 4.0 + v * 5.0) * 0.040;

      // C. Authentic Curved Scratch Mark (from front coconut in reference image)
      // Realistic narrow curved scratch with dark woody core and pale tan halo
      let scratchWeight = 0.0;
      // Main scratch centered at u=0.34, running from v=0.28 to v=0.74
      if (v >= 0.26 && v <= 0.76) {
        const vProg = (v - 0.26) / 0.50;
        const curveOffset = Math.sin(vProg * Math.PI) * 0.015;
        let du = Math.abs(u - (0.34 + curveOffset));
        if (du > 0.5) du = 1.0 - du;
        const wScratch = 0.0032;
        if (du < wScratch) {
          const profile = 1.0 - du / wScratch;
          const vTaper = Math.sin(vProg * Math.PI);
          const roughness = 1.0 + n3(cosA * 80.0, v * 90.0) * 0.25;
          scratchWeight = Math.pow(profile, 1.8) * vTaper * roughness;
        }
      }

      // Secondary fine scratch at u=0.74, v=0.38..0.66
      if (v >= 0.38 && v <= 0.66) {
        const vProg2 = (v - 0.38) / 0.28;
        const curveOffset2 = -Math.sin(vProg2 * Math.PI) * 0.008;
        let du2 = Math.abs(u - (0.74 + curveOffset2));
        if (du2 > 0.5) du2 = 1.0 - du2;
        const wScratch2 = 0.0022;
        if (du2 < wScratch2) {
          const profile2 = 1.0 - du2 / wScratch2;
          const vTaper2 = Math.sin(vProg2 * Math.PI);
          scratchWeight = Math.max(scratchWeight, Math.pow(profile2, 1.6) * vTaper2 * 0.75);
        }
      }

      // D. Circular stem/calyx area at top pole (v < 0.08)
      let stemScarFactor = 0.0;
      if (v < 0.08) {
        const ringT = v / 0.08;
        const radialFiber = n1(cosA * 16.0, sinA * 16.0) * 0.12;
        stemScarFactor = Math.max(0, 1.0 - ringT + radialFiber * (1.0 - ringT));
      }

      // E. Tiny dark spots / lenticels / natural imperfections
      const speckNoise = n4(cosA * 120.0, sinA * 120.0 + v * 90.0);
      const isSpeck = speckNoise > 0.78;
      const speckWeight = isSpeck ? (speckNoise - 0.78) / 0.22 : 0.0;

      // --- COLOR MIXING ---
      let r = baseR * (1.0 + photoDetail + fiberGrain + organicBump * 0.5 + mottle);
      let g = baseG * (1.0 + photoDetail * 0.8 + fiberGrain * 0.7 + organicBump * 0.4 + mottle * 0.8);
      let b = baseB * (1.0 + photoDetail * 0.5 + fiberGrain * 0.3 + mottle * 0.4);

      // Blend real photo sunlit tones on upper half
      if (v > 0.08 && v < 0.45) {
        const sunFactor = Math.sin((v - 0.08) / 0.37 * Math.PI) * 0.20;
        r = r * (1 - sunFactor) + (pSun[0] * 0.85) * sunFactor;
        g = g * (1 - sunFactor) + (pSun[1] * 0.88) * sunFactor;
        b = b * (1 - sunFactor) + (pSun[2] * 0.70) * sunFactor;
      }

      // Blend circular stem scar details
      if (stemScarFactor > 0.001) {
        const sR = 148;
        const sG = 118;
        const sB = 46;
        r = r * (1.0 - stemScarFactor * 0.8) + sR * (stemScarFactor * 0.8);
        g = g * (1.0 - stemScarFactor * 0.8) + sG * (stemScarFactor * 0.8);
        b = b * (1.0 - stemScarFactor * 0.8) + sB * (stemScarFactor * 0.8);
      }

      // Blend authentic scratch marks
      if (scratchWeight > 0.001) {
        const scarCoreR = 112;
        const scarCoreG = 92;
        const scarCoreB = 45;
        r = r * (1.0 - scratchWeight * 0.88) + scarCoreR * (scratchWeight * 0.88);
        g = g * (1.0 - scratchWeight * 0.88) + scarCoreG * (scratchWeight * 0.88);
        b = b * (1.0 - scratchWeight * 0.88) + scarCoreB * (scratchWeight * 0.88);
      }

      // Blend natural dark specks (lenticels)
      if (speckWeight > 0.0) {
        const dR = 75;
        const dG = 65;
        const dB = 28;
        const sf = speckWeight * 0.65;
        r = r * (1.0 - sf) + dR * sf;
        g = g * (1.0 - sf) + dG * sf;
        b = b * (1.0 - sf) + dB * sf;
      }

      const pixelIdx = (rowOffset + x) << 2;
      albedoData[pixelIdx] = Math.max(0, Math.min(255, Math.round(r)));
      albedoData[pixelIdx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      albedoData[pixelIdx + 2] = Math.max(0, Math.min(255, Math.round(g * 0.98 ? g : b))); // maintain healthy chlorophyll ratio
      albedoData[pixelIdx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      albedoData[pixelIdx + 3] = 255;

      // --- ROUGHNESS MAP ---
      // Real tender coconut has a taut, satin-matte living fruit cuticle (roughness 0.44 - 0.52)
      // This produces a gentle, natural specular bloom under studio lighting, showing the plump form
      // Scratches and stem scar are rough and dry (0.78 - 0.86)
      let rough = 0.46 + photoDetail * 0.06 + fiberGrain * 0.04 + organicBump * 0.03;
      if (stemScarFactor > 0.001) {
        rough = rough * (1.0 - stemScarFactor) + 0.84 * stemScarFactor;
      }
      if (scratchWeight > 0.001) {
        rough = rough * (1.0 - scratchWeight) + 0.80 * scratchWeight;
      }
      if (speckWeight > 0.0) {
        rough = Math.min(0.80, rough + speckWeight * 0.18);
      }

      const byteRough = Math.max(0, Math.min(255, Math.round(rough * 255)));
      roughData[pixelIdx] = byteRough;
      roughData[pixelIdx + 1] = byteRough;
      roughData[pixelIdx + 2] = byteRough;
      roughData[pixelIdx + 3] = 255;

      // --- HEIGHT RELIEF FOR TANGENT NORMAL SYNTHESIS ---
      // Micro-pores + fine fibers + organic bumps + scratch groove depth
      const hFiber = fiberGrain * 0.50;
      const hBump = organicBump * 0.55;
      const hScratch = -scratchWeight * 0.007; // physical recessed groove for realistic scratch
      const hStem = stemScarFactor * (n1(cosA * 18.0, sinA * 18.0) * 0.0035 + 0.0025);
      const hMicroPores = (photoLum - 1.0) * 0.0018 + (n5(cosA * 95.0, sinA * 95.0 + v * 85.0) * 0.0012);

      heightMap[rowOffset + x] = hFiber + hBump + hScratch + hStem + hMicroPores;
    }
  }

  // --- SEAMLESS TANGENT NORMAL DERIVATION ---
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

generatePhotorealisticSuite().catch(console.error);
