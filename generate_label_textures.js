import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { createCanvas, loadImage } from '@napi-rs/canvas';

async function main() {
  console.log('--- Generating Calibrated High-Res Label Textures ---');

  const refPath = path.resolve('C:/Users/Asus/.gemini/antigravity-ide/brain/e6ad2aad-1564-4ed0-8275-5d3f4f90231d/reference_bottle.png');
  const refBuf = fs.readFileSync(refPath);
  const refPng = PNG.sync.read(refBuf);
  const { width: refW, height: refH, data: refData } = refPng;

  // 1. Profile extraction for precise cylindrical de-warping
  const profile = [];
  for (let y = 0; y < refH; y++) {
    const bgL = [refData[(y * refW + 1) * 4], refData[(y * refW + 1) * 4 + 1], refData[(y * refW + 1) * 4 + 2]];
    const bgR = [refData[(y * refW + refW - 2) * 4], refData[(y * refW + refW - 2) * 4 + 1], refData[(y * refW + refW - 2) * 4 + 2]];

    let left = -1, right = -1;
    for (let x = 0; x < refW / 2; x++) {
      const idx = (y * refW + x) * 4;
      if (Math.hypot(refData[idx] - bgL[0], refData[idx + 1] - bgL[1], refData[idx + 2] - bgL[2]) > 20) {
        left = x; break;
      }
    }
    for (let x = refW - 1; x >= refW / 2; x--) {
      const idx = (y * refW + x) * 4;
      if (Math.hypot(refData[idx] - bgR[0], refData[idx + 1] - bgR[1], refData[idx + 2] - bgR[2]) > 20) {
        right = x; break;
      }
    }

    if (left === -1) left = Math.round(refW * 0.05);
    if (right === -1) right = Math.round(refW * 0.95);
    const center = (left + right) / 2;
    const radius = (right - left) / 2;
    profile.push({ y, left, right, center, radius });
  }

  // Smooth profile
  for (let y = 1; y < refH - 1; y++) {
    profile[y].radius = (profile[y - 1].radius + profile[y].radius + profile[y + 1].radius) / 3;
    profile[y].center = (profile[y - 1].center + profile[y].center + profile[y + 1].center) / 3;
  }

  const texW = 2048;
  const texH = 2048;
  const canvas = createCanvas(texW, texH);
  const ctx = canvas.getContext('2d');

  // Background ivory white
  ctx.fillStyle = '#FAFDF6';
  ctx.fillRect(0, 0, texW, texH);

  const LIME_GREEN = '#86C523';
  const DARK_GREEN = '#155829';

  // Upper lime green band across the whole label
  ctx.fillStyle = LIME_GREEN;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(texW, 0);
  ctx.lineTo(texW, texH * 0.14);
  ctx.bezierCurveTo(texW * 0.75, texH * 0.12, texW * 0.25, texH * 0.15, 0, texH * 0.14);
  ctx.closePath();
  ctx.fill();

  // Lower lime green band across the whole label
  ctx.beginPath();
  ctx.moveTo(0, texH);
  ctx.lineTo(texW, texH);
  ctx.lineTo(texW, texH * 0.935);
  ctx.bezierCurveTo(texW * 0.75, texH * 0.94, texW * 0.25, texH * 0.93, 0, texH * 0.935);
  ctx.closePath();
  ctx.fill();

  // 2. Inverse cylindrical de-warping of front panel
  // Front hemisphere: u in [0.25, 0.75]
  const frontData = ctx.createImageData(texW, texH);
  const out = frontData.data;
  for (let i = 0; i < out.length; i += 4) out[i + 3] = 0;

  for (let ty = 0; ty < texH; ty++) {
    // In texture, ty=0 is top of sleeve (row y=0 in reference), ty=texH-1 is bottom (row y=1018)
    const refY = (ty / (texH - 1)) * (refH - 6);
    const y0 = Math.floor(refY);
    const y1 = Math.min(refH - 1, y0 + 1);
    const fy = refY - y0;

    const center = profile[y0].center * (1 - fy) + profile[y1].center * fy;
    const radius = profile[y0].radius * (1 - fy) + profile[y1].radius * fy;

    for (let tx = 0; tx < texW; tx++) {
      const u = tx / texW;
      const theta = (u - 0.5) * 2.0 * Math.PI;

      if (Math.abs(theta) <= Math.PI * 0.48) {
        const xProj = center + radius * Math.sin(theta);

        if (xProj >= 0 && xProj < refW) {
          const x0 = Math.floor(xProj);
          const x1 = Math.min(refW - 1, x0 + 1);
          const fx = xProj - x0;

          const i00 = (y0 * refW + x0) * 4;
          const i10 = (y0 * refW + x1) * 4;
          const i01 = (y1 * refW + x0) * 4;
          const i11 = (y1 * refW + x1) * 4;

          const r = (1 - fy) * ((1 - fx) * refData[i00] + fx * refData[i10]) +
                    fy * ((1 - fx) * refData[i01] + fx * refData[i11]);
          const g = (1 - fy) * ((1 - fx) * refData[i00 + 1] + fx * refData[i10 + 1]) +
                    fy * ((1 - fx) * refData[i01 + 1] + fx * refData[i11 + 1]);
          const b = (1 - fy) * ((1 - fx) * refData[i00 + 2] + fx * refData[i10 + 2]) +
                    fy * ((1 - fx) * refData[i01 + 2] + fx * refData[i11 + 2]);

          const outIdx = (ty * texW + tx) * 4;
          out[outIdx] = Math.round(r);
          out[outIdx + 1] = Math.round(g);
          out[outIdx + 2] = Math.round(b);

          // Smooth feathering near extreme edges
          const edgeDist = (Math.PI * 0.48 - Math.abs(theta)) / (Math.PI * 0.05);
          const alpha = Math.min(1.0, Math.max(0.0, edgeDist));
          out[outIdx + 3] = Math.round(alpha * 255);
        }
      }
    }
  }

  const frontCanvas = createCanvas(texW, texH);
  frontCanvas.getContext('2d').putImageData(frontData, 0, 0);
  ctx.drawImage(frontCanvas, 0, 0);

  // 3. Side Panels (Left & Right)
  const leftX = texW * 0.03;
  const leftW = texW * 0.21;

  // Nutrition Facts Box
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = DARK_GREEN;
  ctx.lineWidth = 3;
  const nutY = texH * 0.32;
  const nutH = texH * 0.36;
  ctx.fillRect(leftX, nutY, leftW, nutH);
  ctx.strokeRect(leftX, nutY, leftW, nutH);

  ctx.fillStyle = DARK_GREEN;
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText('NUTRITION FACTS', leftX + 16, nutY + 32);
  ctx.font = '14px Arial, sans-serif';
  ctx.fillStyle = '#555555';
  ctx.fillText('Typical Values Per 100ml', leftX + 16, nutY + 54);

  const nutrients = [
    ['Energy', '20 kcal / 84 kJ'],
    ['Total Fat', '0.0 g'],
    ['Cholesterol', '0.0 mg'],
    ['Sodium', '25.0 mg'],
    ['Potassium', '210.0 mg'],
    ['Total Carbohydrate', '4.8 g'],
    ['Total Sugars', '4.5 g'],
    ['Added Sugars', '0.0 g'],
    ['Protein', '0.1 g'],
    ['Calcium', '24.0 mg'],
    ['Magnesium', '10.0 mg'],
    ['Vitamin C', '5.0 mg (10% RDA)']
  ];

  let rowY = nutY + 84;
  nutrients.forEach(([name, val], idx) => {
    ctx.strokeStyle = '#E2E8DF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftX + 10, rowY - 18);
    ctx.lineTo(leftX + leftW - 10, rowY - 18);
    ctx.stroke();

    ctx.fillStyle = idx === 0 || idx === 7 ? DARK_GREEN : '#222222';
    ctx.font = idx === 0 || idx === 7 ? 'bold 16px Arial, sans-serif' : '15px Arial, sans-serif';
    ctx.fillText(name, leftX + 14, rowY - 4);
    const valWidth = ctx.measureText(val).width;
    ctx.fillText(val, leftX + leftW - 14 - valWidth, rowY - 4);
    rowY += 25;
  });

  // Barcode
  const bcY = nutY + nutH + 30;
  const bcW = leftW * 0.75;
  const bcH = 65;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(leftX + 20, bcY, bcW, bcH + 20);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;

  const bars = [
    3,1,1,2,1,3,2,1,1,3,1,1,2,2,1,2,3,1,1,2,
    1,1,1,1,1,
    2,1,2,1,1,3,2,1,1,2,2,1,3,1,1,2,1,3,1,2
  ];
  let curX = leftX + 35;
  bars.forEach((barWidth, i) => {
    if (i % 2 === 0) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(curX, bcY + 6, barWidth * 2.2, bcH - 12);
    }
    curX += barWidth * 2.2;
  });
  ctx.fillStyle = '#000000';
  ctx.font = '12px Courier, monospace';
  ctx.fillText('8 908012 345678', leftX + 45, bcY + bcH + 12);

  // RIGHT SIDE PANEL: "KEEP THE BODY HYDRATED"
  const rightX = texW * 0.76;
  const rightW = texW * 0.21;

  ctx.save();
  ctx.translate(rightX + 40, texH * 0.50);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = DARK_GREEN;
  ctx.font = '900 32px Arial, sans-serif';
  ctx.fillText('KEEP THE BODY HYDRATED', -220, 0);
  ctx.restore();

  const mfgY = texH * 0.32;
  ctx.fillStyle = DARK_GREEN;
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('TENDER WONDER', rightX + 80, mfgY);
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText('Pure Natural Refreshment', rightX + 80, mfgY + 24);

  ctx.font = '14px Arial, sans-serif';
  ctx.fillStyle = '#333333';
  ctx.fillText('Manufactured & Packed by:', rightX + 80, mfgY + 55);
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText('SAKTHI COCO PRODUCTS', rightX + 80, mfgY + 75);
  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = '#555555';
  ctx.fillText('Pollachi, Coimbatore - 642 001', rightX + 80, mfgY + 95);
  ctx.fillText('Tamil Nadu, INDIA', rightX + 80, mfgY + 115);

  const assetsDir = path.resolve('public/textures');
  fs.mkdirSync(assetsDir, { recursive: true });

  const albedoPath = path.join(assetsDir, 'label_albedo.png');
  fs.writeFileSync(albedoPath, canvas.toBuffer('image/png'));
  console.log(`Saved Calibrated Albedo Map: ${albedoPath}`);

  // Roughness & Normal Maps
  const roughCanvas = createCanvas(texW, texH);
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = '#3A3A3A';
  rctx.fillRect(0, 0, texW, texH);
  rctx.fillStyle = '#1E1E1E';
  rctx.beginPath();
  rctx.arc(texW * 0.5, texH * 0.70, 240, 0, Math.PI * 2);
  rctx.fill();
  fs.writeFileSync(path.join(assetsDir, 'label_roughness.png'), roughCanvas.toBuffer('image/png'));

  const normCanvas = createCanvas(texW, texH);
  const nctx = normCanvas.getContext('2d');
  nctx.fillStyle = '#8080FF';
  nctx.fillRect(0, 0, texW, texH);
  nctx.fillStyle = '#7878FF';
  nctx.fillRect(0, 0, 4, texH);
  nctx.fillStyle = '#8888FF';
  nctx.fillRect(texW - 4, 0, 4, texH);
  fs.writeFileSync(path.join(assetsDir, 'label_normal.png'), normCanvas.toBuffer('image/png'));

  console.log('--- Textures Generated Successfully ---');
}

main().catch(console.error);
