import fs from 'fs';
import path from 'path';

function generate3DAssets() {
  console.log('--- Generating Exact-Profile 3D Assets (OBJ, MTL) ---');

  const outDir = path.resolve('public/models');
  fs.mkdirSync(outDir, { recursive: true });

  // Load exact pixel-measured profile
  const profileData = JSON.parse(fs.readFileSync('./src/exact_profile.json', 'utf8'));
  const points = profileData.points;
  const numRad = 64;

  let allVerts = [];
  let allNorms = [];
  let allUVs = [];
  let groups = {};

  function addGroup(name, mtlName) {
    if (!groups[name]) groups[name] = { mtl: mtlName, faces: [] };
  }

  function addRevolvedSurface(groupName, mtlName, profilePts, radialSegs, zMin, zMax) {
    addGroup(groupName, mtlName);
    const g = groups[groupName];

    const vStart = allVerts.length;
    const vnStart = allNorms.length;
    const vtStart = allUVs.length;

    const numPts = profilePts.length;
    const zSpan = Math.max(0.0001, zMax - zMin);

    // Compute profile normal directions
    const profNormals = [];
    for (let i = 0; i < numPts; i++) {
      let dz, dr;
      if (i === 0) {
        dr = profilePts[1].r - profilePts[0].r;
        dz = profilePts[1].z - profilePts[0].z;
      } else if (i === numPts - 1) {
        dr = profilePts[numPts - 1].r - profilePts[numPts - 2].r;
        dz = profilePts[numPts - 1].z - profilePts[numPts - 2].z;
      } else {
        dr = profilePts[i + 1].r - profilePts[i - 1].r;
        dz = profilePts[i + 1].z - profilePts[i - 1].z;
      }
      const len = Math.hypot(-dz, dr);
      profNormals.push({ nr: -dz / len, nz: dr / len });
    }

    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      // Front alignment: u = 0.5 faces camera (+Z)
      const phi = 2.0 * Math.PI * (u - 0.5);
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      for (let i = 0; i < numPts; i++) {
        const pt = profilePts[i];
        const pn = profNormals[i];

        const x = pt.r * sinPhi;
        const y = pt.z;
        const z = pt.r * cosPhi;

        const nx = pn.nr * sinPhi;
        const ny = pn.nz;
        const nz = pn.nr * cosPhi;

        const v = Math.max(0, Math.min(1, (pt.z - zMin) / zSpan));

        allVerts.push([x, y, z]);
        allNorms.push([nx, ny, nz]);
        allUVs.push([u, v]);
      }
    }

    for (let s = 0; s < radialSegs; s++) {
      for (let i = 0; i < numPts - 1; i++) {
        const i0 = vStart + s * numPts + i + 1;
        const i1 = vStart + (s + 1) * numPts + i + 1;
        const i2 = vStart + (s + 1) * numPts + (i + 1) + 1;
        const i3 = vStart + s * numPts + (i + 1) + 1;

        g.faces.push([
          [i0, i0, i0],
          [i1, i1, i1],
          [i2, i2, i2],
          [i3, i3, i3]
        ]);
      }
    }
  }

  // 1. Bottle Body (All 40 points from base to neck finish)
  addRevolvedSurface('Bottle_Body', 'Mat_Translucent_PP', points, numRad, 0.0, points[points.length - 1].z);

  // 2. Shrink Sleeve Label (From base resting ring to shoulder top at row y=0)
  // Slight offset +0.08mm
  const sleevePts = points
    .filter(p => p.z <= profileData.sleeveTopZ + 0.0005)
    .map(p => ({ r: p.r + 0.00008, z: p.z }));

  addRevolvedSurface('Bottle_Label', 'Mat_Shrink_Sleeve', sleevePts, numRad, sleevePts[0].z, sleevePts[sleevePts.length - 1].z);

  // 3. Bright Green Screw Cap with 64 Grip Ridges
  addGroup('Bottle_Cap', 'Mat_Green_Cap');
  const gCap = groups['Bottle_Cap'];

  const capVStart = allVerts.length;
  const numCapRidges = 64;
  const numCapSegs = numCapRidges * 2; // 128
  const R_base = 0.0202;
  const R_ridge = 0.0207;
  const capBotZ = profileData.capBottomZ;
  const capTopZ = profileData.capTopZ;

  const zCapLevels = [
    capBotZ,                    // 0: tamper ring bottom
    capBotZ + 0.0025,           // 1: tamper ring top
    capBotZ + 0.0035,           // 2: skirt bottom
    capTopZ - 0.0020,           // 3: skirt top
    capTopZ,                    // 4: bevel peak
    capTopZ + 0.0008            // 5: dome center
  ];

  for (let s = 0; s <= numCapSegs; s++) {
    const u = s / numCapSegs;
    const phi = 2.0 * Math.PI * (u - 0.5);
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const isPeak = (s % 2 === 1);

    // Ring 0: tamper ring bottom
    const r0 = R_base - 0.0003;
    allVerts.push([r0 * sinPhi, zCapLevels[0], r0 * cosPhi]);
    allNorms.push([sinPhi, 0, cosPhi]);
    allUVs.push([u, 0.0]);

    // Ring 1: tamper ring top
    allVerts.push([r0 * sinPhi, zCapLevels[1], r0 * cosPhi]);
    allNorms.push([sinPhi, 0, cosPhi]);
    allUVs.push([u, 0.2]);

    // Ring 2: skirt bottom
    const r2 = isPeak ? R_ridge : R_base;
    allVerts.push([r2 * sinPhi, zCapLevels[2], r2 * cosPhi]);
    allNorms.push([sinPhi, 0, cosPhi]);
    allUVs.push([u, 0.3]);

    // Ring 3: skirt top
    allVerts.push([r2 * sinPhi, zCapLevels[3], r2 * cosPhi]);
    allNorms.push([sinPhi, 0, cosPhi]);
    allUVs.push([u, 0.8]);

    // Ring 4: top bevel
    const r4 = R_base - 0.0022;
    allVerts.push([r4 * sinPhi, zCapLevels[4], r4 * cosPhi]);
    allNorms.push([sinPhi * 0.707, 0.707, cosPhi * 0.707]);
    allUVs.push([u, 0.95]);
  }

  const topCenterIdx = allVerts.length + 1;
  allVerts.push([0, zCapLevels[5], 0]);
  allNorms.push([0, 1, 0]);
  allUVs.push([0.5, 1.0]);

  const ringsPerSeg = 5;
  for (let s = 0; s < numCapSegs; s++) {
    for (let r = 0; r < 4; r++) {
      const i0 = capVStart + s * ringsPerSeg + r + 1;
      const i1 = capVStart + (s + 1) * ringsPerSeg + r + 1;
      const i2 = capVStart + (s + 1) * ringsPerSeg + (r + 1) + 1;
      const i3 = capVStart + s * ringsPerSeg + (r + 1) + 1;

      gCap.faces.push([
        [i0, i0, i0],
        [i1, i1, i1],
        [i2, i2, i2],
        [i3, i3, i3]
      ]);
    }
    const t0 = capVStart + s * ringsPerSeg + 4 + 1;
    const t1 = capVStart + (s + 1) * ringsPerSeg + 4 + 1;
    gCap.faces.push([
      [t0, t0, t0],
      [t1, t1, t1],
      [topCenterIdx, topCenterIdx, topCenterIdx]
    ]);
  }

  // 4. Save MTL and OBJ
  const mtlContent = `# Material Library for Tender Wonder 1L Bottle

newmtl Mat_Translucent_PP
Ka 0.2 0.2 0.2
Kd 0.94 0.97 0.94
Ks 0.6 0.6 0.6
Ns 45.0
d 0.88
illum 2

newmtl Mat_Green_Cap
Ka 0.1 0.2 0.05
Kd 0.48 0.76 0.12
Ks 0.4 0.4 0.4
Ns 35.0
d 1.0
illum 2

newmtl Mat_Shrink_Sleeve
Ka 0.2 0.2 0.2
Kd 1.0 1.0 1.0
Ks 0.3 0.3 0.3
Ns 40.0
d 1.0
illum 2
map_Kd ../textures/label_albedo.png
map_Ns ../textures/label_roughness.png
map_Bump -bm 0.05 ../textures/label_normal.png
`;

  fs.writeFileSync(path.join(outDir, 'tender_wonder_bottle.mtl'), mtlContent);

  let objLines = [
    '# Tender Wonder 1L Coconut Water Bottle',
    '# 1:1 Pixel-Calibrated Physical 3D Model',
    'mtllib tender_wonder_bottle.mtl\n'
  ];

  for (const v of allVerts) {
    objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
  }
  for (const vt of allUVs) {
    objLines.push(`vt ${vt[0].toFixed(6)} ${vt[1].toFixed(6)}`);
  }
  for (const vn of allNorms) {
    objLines.push(`vn ${vn[0].toFixed(6)} ${vn[1].toFixed(6)} ${vn[2].toFixed(6)}`);
  }

  for (const [groupName, grp] of Object.entries(groups)) {
    objLines.push(`\ng ${groupName}`);
    objLines.push(`usemtl ${grp.mtl}`);
    objLines.push('s 1');
    for (const f of grp.faces) {
      const fStr = f.map(([vi, vti, vni]) => `${vi}/${vti}/${vni}`).join(' ');
      objLines.push(`f ${fStr}`);
    }
  }

  const objPath = path.join(outDir, 'tender_wonder_bottle.obj');
  fs.writeFileSync(objPath, objLines.join('\n'));
  console.log(`Saved OBJ: ${objPath} (${(fs.statSync(objPath).size / 1024).toFixed(1)} KB)`);
  console.log('--- 3D Geometry Regeneration Completed ---');
}

generate3DAssets();
