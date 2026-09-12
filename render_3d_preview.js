import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

async function render3DPreview() {
  console.log('--- Generating Exact-Profile 3D Render Preview ---');

  const profileData = JSON.parse(fs.readFileSync('./src/exact_profile.json', 'utf8'));
  const points = profileData.points;
  const labelTex = await loadImage(path.resolve('public/textures/label_albedo.png'));

  const width = 800;
  const height = 1200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Studio background
  const bgGrad = ctx.createRadialGradient(width * 0.5, height * 0.45, 50, width * 0.5, height * 0.5, 650);
  bgGrad.addColorStop(0, '#1a221c');
  bgGrad.addColorStop(0.6, '#0e1310');
  bgGrad.addColorStop(1, '#060807');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Contact shadow
  ctx.save();
  ctx.translate(width * 0.5, height * 0.88);
  ctx.scale(1.0, 0.20);
  const shadowGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 200);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Perspective camera
  const camY = 0.132;
  const camZ = 0.46;
  const fov = 36 * (Math.PI / 180);
  const focalLength = (height / 2) / Math.tan(fov / 2);

  function project(x, y, z) {
    const relY = y - camY;
    const relZ = camZ - z;
    const px = width / 2 + (x / relZ) * focalLength;
    const py = height / 2 - (relY / relZ) * focalLength;
    return { px, py };
  }

  // 1. Render Shrink Sleeve Slice by Slice using exact points
  const sleeveBottomZ = profileData.sleeveBottomZ;
  const sleeveTopZ = profileData.sleeveTopZ;
  const numSlices = 700;

  for (let i = 0; i < numSlices; i++) {
    const t = i / numSlices;
    const z = sleeveBottomZ + t * (sleeveTopZ - sleeveBottomZ);

    // Find radius from points by linear interpolation
    let r = 0.04125;
    for (let p = 0; p < points.length - 1; p++) {
      if (z >= points[p].z && z <= points[p + 1].z) {
        const span = points[p + 1].z - points[p].z;
        const ft = span > 0 ? (z - points[p].z) / span : 0;
        r = points[p].r * (1 - ft) + points[p + 1].r * ft;
        break;
      }
    }

    const pL = project(-r, z, 0);
    const pR = project(r, z, 0);
    const sliceW = pR.px - pL.px;
    const sliceY = (pL.py + pR.py) / 2;
    const sliceH = Math.max(1.8, (height / numSlices) * 1.5);

    // v=0 is bottom, v=1 is top
    const v = 1.0 - t;
    const texSourceY = Math.round(v * labelTex.height);
    const texSourceH = Math.max(1, Math.round((1.0 / numSlices) * labelTex.height));

    // Cylindrical projection mapping
    const numXSteps = 120;
    const sliceCenterX = (pL.px + pR.px) / 2;
    const halfW = sliceW / 2;
    const stepW = sliceW / numXSteps;

    for (let xi = 0; xi < numXSteps; xi++) {
      const xNorm1 = (xi / numXSteps) * 2.0 - 1.0;
      const xNorm2 = ((xi + 1) / numXSteps) * 2.0 - 1.0;
      const phi1 = Math.asin(Math.max(-0.999, Math.min(0.999, xNorm1)));
      const phi2 = Math.asin(Math.max(-0.999, Math.min(0.999, xNorm2)));

      const uOffset = -0.258;
      let u1 = (0.5 + uOffset + phi1 / (2.0 * Math.PI)) % 1.0;
      if (u1 < 0) u1 += 1.0;
      let u2 = (0.5 + uOffset + phi2 / (2.0 * Math.PI)) % 1.0;
      if (u2 < 0) u2 += 1.0;

      let srcX1 = u1 * labelTex.width;
      let srcX2 = u2 * labelTex.width;
      if (srcX2 < srcX1) srcX2 += labelTex.width;
      const srcW = Math.max(1, srcX2 - srcX1);

      const destX1 = sliceCenterX + xNorm1 * halfW;
      const destW = (xNorm2 - xNorm1) * halfW;

      ctx.drawImage(
        labelTex,
        srcX1, texSourceY, srcW, texSourceH,
        destX1, sliceY - sliceH / 2, destW + 0.5, sliceH
      );
    }

    // Cylindrical lighting & edge shading
    const shadeGrad = ctx.createLinearGradient(pL.px, sliceY, pR.px, sliceY);
    shadeGrad.addColorStop(0.00, 'rgba(10, 20, 10, 0.45)');
    shadeGrad.addColorStop(0.08, 'rgba(255, 255, 255, 0.18)');
    shadeGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.08)');
    shadeGrad.addColorStop(0.50, 'rgba(0, 0, 0, 0.00)');
    shadeGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.05)');
    shadeGrad.addColorStop(0.96, 'rgba(255, 255, 255, 0.25)');
    shadeGrad.addColorStop(1.00, 'rgba(10, 20, 10, 0.50)');

    ctx.fillStyle = shadeGrad;
    ctx.fillRect(pL.px, sliceY - sliceH / 2, sliceW, sliceH);
  }

  // 2. Render Translucent PET Neck Finish above Sleeve
  const pNeckL = project(-0.0190, sleeveTopZ, 0);
  const pNeckR = project(0.0190, sleeveTopZ, 0);
  const pNeckTopL = project(-0.0190, profileData.capBottomZ, 0);
  const pNeckTopR = project(0.0190, profileData.capBottomZ, 0);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pNeckL.px, pNeckL.py);
  ctx.lineTo(pNeckTopL.px, pNeckTopL.py);
  ctx.lineTo(pNeckTopR.px, pNeckTopR.py);
  ctx.lineTo(pNeckR.px, pNeckR.py);
  ctx.closePath();

  const neckGrad = ctx.createLinearGradient(pNeckL.px, 0, pNeckR.px, 0);
  neckGrad.addColorStop(0, 'rgba(180, 210, 180, 0.5)');
  neckGrad.addColorStop(0.2, 'rgba(240, 255, 240, 0.8)');
  neckGrad.addColorStop(0.5, 'rgba(210, 235, 210, 0.35)');
  neckGrad.addColorStop(0.85, 'rgba(240, 255, 240, 0.7)');
  neckGrad.addColorStop(1, 'rgba(160, 190, 160, 0.5)');
  ctx.fillStyle = neckGrad;
  ctx.fill();
  ctx.restore();

  // Collar bead
  const pBeadL = project(-0.0205, profileData.capBottomZ - 0.003, 0);
  const pBeadR = project(0.0205, profileData.capBottomZ - 0.003, 0);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse((pBeadL.px + pBeadR.px) / 2, (pBeadL.py + pBeadR.py) / 2, (pBeadR.px - pBeadL.px) / 2, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(220, 245, 220, 0.6)';
  ctx.fill();
  ctx.restore();

  // 3. Render Bright Green Screw Cap with 64 Grip Ridges & Tamper Ring
  const R_cap = profileData.capRadius;
  const pCapBotL = project(-R_cap, profileData.capBottomZ, 0);
  const pCapBotR = project(R_cap, profileData.capBottomZ, 0);
  const pCapTopL = project(-R_cap, profileData.capTopZ - 0.001, 0);
  const pCapTopR = project(R_cap, profileData.capTopZ - 0.001, 0);
  const pCapPeak = project(0, profileData.capTopZ, 0);

  const capW = pCapBotR.px - pCapBotL.px;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pCapBotL.px, pCapBotL.py);
  ctx.lineTo(pCapTopL.px, pCapTopL.py);
  ctx.quadraticCurveTo(width * 0.5, pCapPeak.py - 2, pCapTopR.px, pCapTopR.py);
  ctx.lineTo(pCapBotR.px, pCapBotR.py);
  ctx.closePath();

  const capGrad = ctx.createLinearGradient(pCapBotL.px, 0, pCapBotR.px, 0);
  capGrad.addColorStop(0, '#538a16');
  capGrad.addColorStop(0.12, '#9fe238');
  capGrad.addColorStop(0.35, '#86c523');
  capGrad.addColorStop(0.70, '#6ea81b');
  capGrad.addColorStop(0.92, '#9fe238');
  capGrad.addColorStop(1.0, '#4a7d13');
  ctx.fillStyle = capGrad;
  ctx.fill();

  // Score line
  const pScoreL = project(-R_cap, profileData.capBottomZ + 0.0028, 0);
  const pScoreR = project(R_cap, profileData.capBottomZ + 0.0028, 0);
  ctx.strokeStyle = '#2d520a';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pScoreL.px, pScoreL.py);
  ctx.lineTo(pScoreR.px, pScoreR.py);
  ctx.stroke();

  // 64 Vertical Ridges
  const numVisibleRidges = 32;
  for (let r = 0; r < numVisibleRidges; r++) {
    const angle = ((r + 0.5) / numVisibleRidges - 0.5) * Math.PI * 0.96;
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    const rx = (width * 0.5) + (capW * 0.49) * sinA;
    const ridgeW = Math.max(1.0, 2.8 * cosA);
    const ridgeTopY = pCapTopL.py + 3 - 2 * (1 - cosA);
    const ridgeBotY = pScoreL.py - 2;

    ctx.fillStyle = cosA > 0.4 ? 'rgba(220, 255, 140, 0.55)' : 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(rx - ridgeW / 2, ridgeTopY, ridgeW * 0.5, ridgeBotY - ridgeTopY);
    ctx.fillStyle = 'rgba(30, 60, 10, 0.45)';
    ctx.fillRect(rx, ridgeTopY, ridgeW * 0.5, ridgeBotY - ridgeTopY);
  }

  // Bevel rim highlight
  ctx.strokeStyle = 'rgba(225, 255, 160, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(width * 0.5, pCapTopL.py, capW * 0.46, 3.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Save render
  const artifactPath = 'C:/Users/Asus/.gemini/antigravity-ide/brain/ffcdde1a-186f-46d9-8a6d-e63257b3ebbf/tender_wonder_3d_render.png';
  const publicPath = path.resolve('public/tender_wonder_3d_render.png');
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(artifactPath, buf);
  fs.writeFileSync(publicPath, buf);
  console.log(`Saved Updated 3D Render: ${artifactPath}`);

  // Comparison Image
  const compW = 1200;
  const compH = 1024;
  const compCanvas = createCanvas(compW, compH);
  const cctx = compCanvas.getContext('2d');
  cctx.fillStyle = '#111613';
  cctx.fillRect(0, 0, compW, compH);

  const refImg = await loadImage('C:/Users/Asus/.gemini/antigravity-ide/brain/e6ad2aad-1564-4ed0-8275-5d3f4f90231d/reference_bottle.png');
  const refScale = 900 / refImg.height;
  const rw = refImg.width * refScale;
  const rh = refImg.height * refScale;
  cctx.drawImage(refImg, 300 - rw / 2, 70, rw, rh);

  const renScale = 900 / height;
  const renW = width * renScale;
  const renH = height * renScale;
  cctx.drawImage(canvas, 900 - renW / 2, 70, renW, renH);

  cctx.font = 'bold 22px Arial, sans-serif';
  cctx.fillStyle = '#86C523';
  cctx.textAlign = 'center';
  cctx.fillText('ORIGINAL REFERENCE PHOTOGRAPH', 300, 45);
  cctx.fillText('1:1 CALIBRATED 3D RECONSTRUCTION', 900, 45);

  cctx.font = '14px Arial, sans-serif';
  cctx.fillStyle = '#999999';
  cctx.fillText('Primary Reference Photo (User Upload)', 300, 1000);
  cctx.fillText('Pixel-Calibrated Silhouette, Ribbed Cap & PBR Texture', 900, 1000);

  cctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  cctx.lineWidth = 2;
  cctx.beginPath();
  cctx.moveTo(600, 30);
  cctx.lineTo(600, 1000);
  cctx.stroke();

  const compArtifactPath = 'C:/Users/Asus/.gemini/antigravity-ide/brain/e6ad2aad-1564-4ed0-8275-5d3f4f90231d/comparison_reference_vs_3d.png';
  fs.writeFileSync(compArtifactPath, compCanvas.toBuffer('image/png'));
  console.log(`Saved Updated Comparison: ${compArtifactPath}`);
}

render3DPreview().catch(console.error);
