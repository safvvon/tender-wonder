import fs from 'fs';
import path from 'path';
import { createCanvas } from '@napi-rs/canvas';

async function renderWireframe() {
  console.log('--- Generating Topology Wireframe Render ---');

  const width = 800;
  const height = 1200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0a0e0c';
  ctx.fillRect(0, 0, width, height);

  const camY = 0.132;
  const camZ = 0.44;
  const fov = 38 * (Math.PI / 180);
  const focalLength = (height / 2) / Math.tan(fov / 2);

  function project(x, y, z) {
    const relY = y - camY;
    const relZ = camZ - z;
    const px = width / 2 + (x / relZ) * focalLength;
    const py = height / 2 - (relY / relZ) * focalLength;
    return { px, py };
  }

  const R_body = 0.04125;
  const R_neck = 0.0190;
  const R_cap = 0.0203;

  // Build profile rings
  const profile = [];
  profile.push({ r: 0.000, z: 0.005 });
  profile.push({ r: 0.015, z: 0.004 });
  profile.push({ r: 0.028, z: 0.0012 });
  profile.push({ r: 0.0355, z: 0.000 });
  profile.push({ r: 0.0385, z: 0.0025 });
  profile.push({ r: 0.0405, z: 0.007 });
  profile.push({ r: R_body, z: 0.012 });

  const nBody = 24;
  for (let i = 1; i <= nBody; i++) {
    const t = i / nBody;
    const z = 0.012 + t * (0.185 - 0.012);
    profile.push({ r: R_body, z });
  }
  const nShoulder = 20;
  for (let i = 1; i <= nShoulder; i++) {
    const t = i / nShoulder;
    const z = 0.185 + t * (0.236 - 0.185);
    const smoothT = 0.5 * (1.0 - Math.cos(t * Math.PI));
    profile.push({ r: R_body * (1.0 - smoothT) + R_neck * smoothT, z });
  }
  profile.push({ r: R_neck, z: 0.238 });

  // Cap profile
  const capProfile = [
    { r: R_cap, z: 0.238 },
    { r: R_cap, z: 0.2415 },
    { r: R_cap + 0.0005, z: 0.2425 },
    { r: R_cap + 0.0005, z: 0.2545 },
    { r: R_cap - 0.002, z: 0.2565 },
    { r: 0.000, z: 0.2575 }
  ];

  const radSegs = 48;

  // Draw horizontal rings
  ctx.lineWidth = 0.8;
  profile.forEach((pt, idx) => {
    ctx.strokeStyle = idx % 2 === 0 ? 'rgba(134, 197, 35, 0.45)' : 'rgba(100, 160, 25, 0.25)';
    ctx.beginPath();
    for (let s = 0; s <= radSegs; s++) {
      const angle = (2 * Math.PI * s) / radSegs;
      const x = pt.r * Math.cos(angle);
      const z = pt.r * Math.sin(angle);
      if (z <= 0.002) { // front half
        const p = project(x, pt.z, z);
        if (s === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
    }
    ctx.stroke();
  });

  // Draw cap rings
  capProfile.forEach((pt) => {
    ctx.strokeStyle = 'rgba(170, 240, 50, 0.7)';
    ctx.beginPath();
    for (let s = 0; s <= 64; s++) {
      const angle = (2 * Math.PI * s) / 64;
      const x = pt.r * Math.cos(angle);
      const z = pt.r * Math.sin(angle);
      if (z <= 0.002) {
        const p = project(x, pt.z, z);
        if (s === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
    }
    ctx.stroke();
  });

  // Draw vertical longitude quad loops
  ctx.strokeStyle = 'rgba(134, 197, 35, 0.35)';
  for (let s = 0; s < radSegs; s += 2) {
    const angle = (2 * Math.PI * s) / radSegs;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    if (sinA <= 0.002) {
      ctx.beginPath();
      profile.forEach((pt, idx) => {
        const p = project(pt.r * cosA, pt.z, pt.r * sinA);
        if (idx === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      });
      ctx.stroke();
    }
  }

  // Draw 64 vertical cap ridges
  ctx.strokeStyle = 'rgba(200, 255, 100, 0.6)';
  for (let s = 0; s < 64; s++) {
    const angle = (2 * Math.PI * s) / 64;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    if (sinA <= 0.002) {
      ctx.beginPath();
      capProfile.forEach((pt, idx) => {
        const p = project(pt.r * cosA, pt.z, pt.r * sinA);
        if (idx === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      });
      ctx.stroke();
    }
  }

  // Title
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillStyle = '#86c523';
  ctx.textAlign = 'center';
  ctx.fillText('QUAD TOPOLOGY & WIREFRAME MESH STRUCTURE', width / 2, 50);
  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = '#888888';
  ctx.fillText('Subdivision-ready quad loops • 64-ridge precision cap • Manifold engineering geometry', width / 2, 75);

  const wirePath = 'C:/Users/Asus/.gemini/antigravity-ide/brain/e6ad2aad-1564-4ed0-8275-5d3f4f90231d/tender_wonder_wireframe_render.png';
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(wirePath, buf);
  console.log(`Saved Wireframe: ${wirePath}`);
}

renderWireframe().catch(console.error);
