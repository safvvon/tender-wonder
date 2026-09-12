import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import profileData from './exact_profile.json';

// ======================================================================
// 0. INTRO LOADING SCREEN (INITIAL ASSET LOAD ONLY)
// ======================================================================
const loadingScreen = document.getElementById('loading-screen');
const progressBar = document.getElementById('loading-progress-bar');

let progress = 0;
const loadInterval = setInterval(() => {
  progress += Math.random() * 25 + 15;
  if (progress > 100) progress = 100;
  if (progressBar) progressBar.style.width = `${progress}%`;

  if (progress >= 100) {
    clearInterval(loadInterval);
    setTimeout(() => {
      if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
          loadingScreen.style.display = 'none';
        }, 600);
      }
    }, 350);
  }
}, 75);

// ======================================================================
// 1. SLIDE NAVIGATION & SCROLL ENGINE (NATIVE SCROLL-LINKED)
// ======================================================================
let currentSlide = 1;
const totalSlides = 7;

const pureWord = document.querySelector('.word-pure');
const tenderWord = document.querySelector('.word-tender');
const drinkWord = document.querySelector('.word-drink');

function renderHeroText(progress1, progress2 = 0) {
  if (!pureWord || !tenderWord || !drinkWord) return;

  // progress1: 0.0 (off-screen) to 1.0 (center reached)
  const clamped1 = Math.max(0, Math.min(1, progress1));
  const offset = (1 - clamped1) * 115;
  // Fade out as progress2 advances towards slide 2
  const fadeOut = Math.max(0, 1.0 - progress2 * 1.4);
  const opacity = Math.min(clamped1 * 1.5, 1.0) * fadeOut;

  pureWord.style.transform = `translate3d(${offset}vw, 0, 0)`;
  pureWord.style.opacity = opacity;

  tenderWord.style.transform = `translate3d(${-offset}vw, 0, 0)`;
  tenderWord.style.opacity = opacity;

  drinkWord.style.transform = `translate3d(${offset}vw, 0, 0)`;
  drinkWord.style.opacity = opacity;
}

let targetPhase1Progress = 0.0;
let targetPhase2Progress = 0.0;
let currentPhase1Progress = 0.0;
let currentPhase2Progress = 0.0;
let isHeroStageVisible = true;
let isScrollPending = false;

// Cached DOM references to eliminate repeated getElementById queries
const slide1El = document.getElementById('slide-1');
const slide2El = document.getElementById('slide-2');
const slide3El = document.getElementById('slide-3');

function updateScrollMetrics() {
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const vh = window.innerHeight || 800;

  // Phase 1 (0 to 1.0 * vh): Bottle ascends from below and locks at center
  const p1 = Math.min(Math.max(scrollY / (vh * 1.0), 0), 1);
  targetPhase1Progress = p1;

  // Phase 2: Bottle moves to Slide 2 as scrolling reaches the second page
  let p2 = 0.0;
  if (slide2El) {
    const s2Rect = slide2El.getBoundingClientRect();
    p2 = Math.min(Math.max((vh - s2Rect.top) / vh, 0), 1);

    // Update active slide indicator and 3D stage visibility
    if (heroStage) {
      const visible = s2Rect.bottom > vh * 0.15 && scrollY < (vh * 3.6);
      if (isHeroStageVisible !== visible) {
        isHeroStageVisible = visible;
        heroStage.style.opacity = visible ? '1' : '0';
      }
      heroStage.style.pointerEvents = (visible && (p1 > 0.5 || p2 > 0.5)) ? 'auto' : 'none';

      if (s2Rect.top <= vh * 0.5 && s2Rect.bottom > vh * 0.5) {
        updateActiveSlideUI(2);
      } else if (s2Rect.top > vh * 0.5) {
        updateActiveSlideUI(1);
      }
    }
  }
  targetPhase2Progress = p2;

  renderHeroText(p1, p2);

  // Trigger 1-by-1 left bottle sequence ONLY after 3D bottle docks at Slide 2
  if (p2 >= 0.95 || (slide2El && scrollY >= slide2El.offsetTop - 60)) {
    triggerLeftBottlesSequence();
  } else if (p2 < 0.35 && scrollY < vh * 1.3) {
    resetLeftBottlesSequence();
  }

  // Update target 3D transform cache when scrolling near slide 2
  if (typeof updateSlide2TargetCache === 'function') {
    updateSlide2TargetCache();
  }
}

// DIRECT SCROLL HANDLER: RAF-throttled to avoid redundant multi-fire layout reflows
function onWindowScroll() {
  if (!isScrollPending) {
    isScrollPending = true;
    requestAnimationFrame(() => {
      isScrollPending = false;
      updateScrollMetrics();
    });
  }
}

// ======================================================================
// SLIDE 2: SEQUENCED 1-BY-1 LEFT HORIZONTAL BOTTLE ENTRANCE CONTROLLER
// Triggers ONLY after 3D bottle docks into right card position
// Bottle 1 (1L) enters -> Wait 1.0s -> Bottle 2 (500ml) -> Wait 1.0s -> Bottle 3 (250ml)
// Slide 2 remains strictly scroll-locked until all 3 bottles complete entrance
// ======================================================================
let leftBottlesStep = 0;
let isLeftBottlesSequenceFinished = false;
let leftBottlesFinishedTimestamp = 0;
let leftBottleTimers = [];

function resetLeftBottlesSequence() {
  leftBottleTimers.forEach(t => clearTimeout(t));
  leftBottleTimers = [];
  leftBottlesStep = 0;
  isLeftBottlesSequenceFinished = false;
  leftBottlesFinishedTimestamp = 0;
  const b1 = document.querySelector('.h-bottle-1');
  const b2 = document.querySelector('.h-bottle-2');
  const b3 = document.querySelector('.h-bottle-3');
  if (b1) b1.classList.remove('entered');
  if (b2) b2.classList.remove('entered');
  if (b3) b3.classList.remove('entered');
}

function enterBottle(num) {
  const el = document.querySelector(`.h-bottle-${num}`);
  if (el) {
    el.classList.add('entered');
  }
  leftBottlesStep = Math.max(leftBottlesStep, num);
  if (num === 3) {
    // Full 1.0s for Bottle 3 to slide in and settle before unlocking
    const finishTimer = setTimeout(() => {
      isLeftBottlesSequenceFinished = true;
      leftBottlesFinishedTimestamp = performance.now();
    }, 1000);
    leftBottleTimers.push(finishTimer);
  }
}

function triggerLeftBottlesSequence() {
  if (leftBottlesStep > 0 || isLeftBottlesSequenceFinished) return;
  // Step 1: 3D bottle reached position -> Bottle 1 enters immediately
  enterBottle(1);

  // Step 2: Wait 1.0s (1000ms) -> Bottle 2 enters
  const t1 = setTimeout(() => {
    enterBottle(2);
  }, 1000);
  leftBottleTimers.push(t1);

  // Step 3: Wait another 1.0s (2000ms from start) -> Bottle 3 enters
  const t2 = setTimeout(() => {
    enterBottle(3);
  }, 2000);
  leftBottleTimers.push(t2);
}

// Expose for testing/debugging
window.triggerLeftBottlesSequence = triggerLeftBottlesSequence;
window.resetLeftBottlesSequence = resetLeftBottlesSequence;
window.isLeftBottlesSequenceFinished = () => isLeftBottlesSequenceFinished;

window.addEventListener('scroll', onWindowScroll, { passive: true });

// Initial render: starting nothing is there (progress = 0)
renderHeroText(0.0);
// In case page was reloaded at a scrolled position, sync immediately:
setTimeout(onWindowScroll, 50);

let currentScrollAnimationId = null;
let isStepTransitioning = false;
let isWheelIdle = true;
let wheelIdleTimer = null;
let lastTransitionEndTime = 0;

function animateScrollTo(targetY, duration = 850, callback) {
  if (currentScrollAnimationId) {
    cancelAnimationFrame(currentScrollAnimationId);
  }
  isStepTransitioning = true;

  const startY = window.scrollY || window.pageYOffset || 0;
  const distance = targetY - startY;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1.0);
    // Quintic smoothstep ease for butter-smooth arrival
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    window.scrollTo(0, startY + distance * ease);

    if (progress < 1.0) {
      currentScrollAnimationId = requestAnimationFrame(tick);
    } else {
      window.scrollTo(0, targetY);
      currentScrollAnimationId = null;
      isStepTransitioning = false;
      lastTransitionEndTime = performance.now();
      if (callback) callback();
    }
  }
  currentScrollAnimationId = requestAnimationFrame(tick);
}

window.goToSlide = function(index) {
  if (index < 1 || index > totalSlides) return;
  updateActiveSlideUI(index);

  const vh = window.innerHeight || 800;
  if (index === 1) {
    animateScrollTo(0, 800);
    return;
  }

  const targetElement = document.getElementById(`slide-${index}`);
  if (targetElement) {
    animateScrollTo(targetElement.offsetTop, 850, () => {
      if (index === 2) {
        triggerLeftBottlesSequence();
      }
    });
  }
};

function updateActiveSlideUI(index) {
  currentSlide = index;
  document.querySelectorAll('.scroll-dots-nav .dot').forEach(d => {
    d.classList.toggle('active', parseInt(d.dataset.target) === currentSlide);
  });
  document.querySelectorAll('.slide-panel').forEach(p => {
    p.classList.toggle('active', parseInt(p.dataset.index) === currentSlide);
  });
}

// Track active slide when user scrolls between slides 2 to 7
const slideObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = parseInt(entry.target.dataset.index);
      const scrollY = window.scrollY || 0;
      const vh = window.innerHeight || 800;
      if (idx && (idx > 1 || scrollY < vh * 0.5)) {
        updateActiveSlideUI(idx);
      }
    }
  });
}, {
  threshold: 0.4
});

document.querySelectorAll('.slide-panel').forEach(panel => {
  slideObserver.observe(panel);
});

document.querySelectorAll('.scroll-dots-nav .dot').forEach(dot => {
  dot.addEventListener('click', () => {
    window.goToSlide(parseInt(dot.dataset.target));
  });
});

// ======================================================================
// UNIFIED BULLETPROOF SLIDE NAVIGATION ENGINE
// Stop 0: Slide 1 Top (0vh)
// Stop 1: Slide 1 Center Checkpoint (100vh) - "PURE TENDER DRINK" + 3D Bottle
// Stop 2: Slide 2 (New Collection) - 3D Bottle docked + 3 Left Bottles Staggered
// Stop 3: Slide 3 (The Product)
// Stop 4: Slide 4 (Catalog)
// Stop 5: Slide 5 (Global Reach)
// Stop 6: Slide 6 (Customer Details)
// Stop 7: Slide 7 (Valued Clients)
// ======================================================================

function getCurrentStop() {
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const vh = window.innerHeight || 800;

  if (scrollY < vh * 0.45) return 0;
  if (scrollY < vh * 1.45) return 1;

  for (let i = 2; i <= totalSlides; i++) {
    const s = document.getElementById(`slide-${i}`);
    if (s) {
      const top = s.offsetTop;
      const nextS = document.getElementById(`slide-${i + 1}`);
      const nextTop = nextS ? nextS.offsetTop : top + vh;
      if (scrollY >= top - 80 && scrollY < nextTop - 80) {
        return i;
      }
    }
  }
  return totalSlides;
}

function navigateToStop(targetStop) {
  const vh = window.innerHeight || 800;
  if (targetStop <= 0) {
    animateScrollTo(0, 800);
  } else if (targetStop === 1) {
    resetLeftBottlesSequence();
    animateScrollTo(vh, 850);
  } else if (targetStop === 2) {
    const s2 = document.getElementById('slide-2');
    const top = s2 ? s2.offsetTop : vh * 2;
    animateScrollTo(top, 900, () => {
      triggerLeftBottlesSequence();
    });
  } else if (targetStop >= 3 && targetStop <= totalSlides) {
    const s = document.getElementById(`slide-${targetStop}`);
    if (s) {
      animateScrollTo(s.offsetTop, 850);
    }
  }
}

function handleAdvance() {
  const cur = getCurrentStop();
  // If on Slide 2 and 3 bottles are not finished entering yet: STAY THERE!
  if (cur === 2 && !isLeftBottlesSequenceFinished) {
    return;
  }
  if (cur < totalSlides) {
    navigateToStop(cur + 1);
  }
}

function handleRetreat() {
  const cur = getCurrentStop();
  if (cur > 0) {
    navigateToStop(cur - 1);
  }
}

function isScrollableInside(target, deltaY) {
  let cur = target;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    if (cur.id === 'cart-drawer' || cur.classList?.contains('cart-items')) return true;
    const style = window.getComputedStyle(cur);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight + 6) {
      if (deltaY > 0 && cur.scrollTop + cur.clientHeight < cur.scrollHeight - 6) {
        return true;
      }
      if (deltaY < 0 && cur.scrollTop > 6) {
        return true;
      }
    }
    cur = cur.parentElement;
  }
  return false;
}

// Keyboard Navigation
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    if (!isStepTransitioning) {
      handleAdvance();
    }
  } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
    e.preventDefault();
    if (!isStepTransitioning) {
      handleRetreat();
    }
  }
});

// Wheel Navigation
function handleGlobalWheel(e) {
  // If scrolling inside an active scrollable dialog / element, let it scroll naturally
  if (isScrollableInside(e.target, e.deltaY)) {
    return;
  }

  // Filter out tiny trackpad jitter
  if (Math.abs(e.deltaY) < 10) return;

  e.preventDefault();

  const wasIdle = isWheelIdle;
  isWheelIdle = false;

  clearTimeout(wheelIdleTimer);
  wheelIdleTimer = setTimeout(() => {
    isWheelIdle = true;
  }, 350);

  if (isStepTransitioning) return;

  const timeSinceLastTransition = performance.now() - lastTransitionEndTime;
  if (!wasIdle || timeSinceLastTransition < 400) return;

  const cur = getCurrentStop();
  if (cur === 2 && !isLeftBottlesSequenceFinished) {
    // Hold strictly on Slide 2 until all 3 bottles finish!
    const s2 = document.getElementById('slide-2');
    const s2Top = s2 ? s2.offsetTop : window.innerHeight * 2;
    if (Math.abs(window.scrollY - s2Top) > 15) {
      window.scrollTo(0, s2Top);
    }
    return;
  }

  if (e.deltaY > 10) {
    handleAdvance();
  } else if (e.deltaY < -10) {
    handleRetreat();
  }
}

window.addEventListener('wheel', handleGlobalWheel, { passive: false });

// Touch Gestures
let touchStartY = 0;
let touchMoved = false;

window.addEventListener('touchstart', (e) => {
  if (e.touches && e.touches[0]) {
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
  }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!e.touches || !e.touches[0]) return;
  const currentY = e.touches[0].clientY;
  const deltaY = touchStartY - currentY;
  if (Math.abs(deltaY) > 10) {
    touchMoved = true;
  }
  if (!isScrollableInside(e.target, deltaY) && e.cancelable) {
    e.preventDefault();
  }
}, { passive: false });

window.addEventListener('touchend', (e) => {
  if (!touchMoved || isStepTransitioning) return;
  const currentY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : touchStartY;
  const deltaY = touchStartY - currentY;

  const cur = getCurrentStop();
  if (cur === 2 && !isLeftBottlesSequenceFinished) {
    return;
  }

  if (deltaY > 30) {
    handleAdvance();
  } else if (deltaY < -30) {
    handleRetreat();
  }
});

// ======================================================================
// 2. HERO 3D BOTTLE EMBEDDED IN SECTION 1 (PRODUCT DETAIL)
// ======================================================================
const heroStage = document.getElementById('hero-3d-bottle-container');
let scene, camera, renderer, controls;

if (heroStage) {
  scene = new THREE.Scene();

  const width = heroStage.clientWidth || window.innerWidth;
  const height = heroStage.clientHeight || window.innerHeight;

  camera = new THREE.PerspectiveCamera(30, width / height, 0.01, 10.0);
  camera.position.set(0.0, 0.155, 0.76);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false;
  heroStage.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0.0, 0.155, 0.0);
  controls.maxDistance = 1.4;
  controls.minDistance = 0.40;
  controls.autoRotate = false; // Starts facing straight ahead so the label is perfectly readable!
  controls.autoRotateSpeed = 0.8;
  controls.enableZoom = false; // Disable wheel zoom so mousewheel scrolls pages smoothly!

  // Studio Lighting (Calibrated to match DSLR Studio lighting of real product)
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.20);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xfffdf6, 1.35);
  keyLight.position.set(-0.15, 0.35, 0.65);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xf5fff0, 0.95);
  fillLight.position.set(0.25, 0.15, 0.60);
  scene.add(fillLight);

  const rimLight1 = new THREE.DirectionalLight(0xeeffee, 1.1);
  rimLight1.position.set(0.40, 0.35, -0.40);
  scene.add(rimLight1);

  const rimLight2 = new THREE.DirectionalLight(0xf2fff0, 1.0);
  rimLight2.position.set(-0.40, 0.30, -0.40);
  scene.add(rimLight2);

  const underFill = new THREE.DirectionalLight(0xffffff, 0.5);
  underFill.position.set(0.0, -0.20, 0.40);
  scene.add(underFill);

  // Geometry Construction (Pixel-calibrated 1:1 contour with TRUE outward normals)
  function createRevolvedGeometry(profilePts, radialSegs, zMin, zMax) {
    const numPts = profilePts.length;
    const zSpan = Math.max(0.0001, zMax - zMin);

    const positions = [];
    const uvs = [];
    const indices = [];

    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const phi = 2.0 * Math.PI * (u - 0.5);
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      for (let i = 0; i < numPts; i++) {
        const pt = profilePts[i];
        positions.push(pt.r * sinPhi, pt.z, pt.r * cosPhi);
        uvs.push(u, Math.max(0, Math.min(1, (pt.z - zMin) / zSpan)));
      }
    }

    // Counter-clockwise winding for true outward normals
    for (let s = 0; s < radialSegs; s++) {
      for (let i = 0; i < numPts - 1; i++) {
        const a = s * numPts + i;
        const b = (s + 1) * numPts + i;
        const c = (s + 1) * numPts + (i + 1);
        const d = s * numPts + (i + 1);
        indices.push(a, b, c);
        indices.push(a, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  const points = profileData.points;

  // A. Translucent PET Bottle (Exposed Neck & Base Foot only, so shrink sleeve is 100% crisp)
  const neckPts = points.filter(p => p.z >= profileData.sleeveTopZ - 0.001);
  const neckGeo = createRevolvedGeometry(neckPts, 64, neckPts[0].z, neckPts[neckPts.length - 1].z);

  const basePts = points.filter(p => p.z <= profileData.sleeveBottomZ + 0.001);
  const baseGeo = createRevolvedGeometry(basePts, 64, basePts[0].z, basePts[basePts.length - 1].z);

  const petMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xb8c5a4), // natural cloudy coconut water tint
    transparent: true,
    opacity: 0.28,
    roughness: 0.04,
    ior: 1.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    side: THREE.FrontSide
  });
  const neckMesh = new THREE.Mesh(neckGeo, petMat);
  const baseMesh = new THREE.Mesh(baseGeo, petMat);

  // B. Natural Coconut Water Liquid (Inner Core)
  const liquidPts = points
    .filter(p => p.z <= profileData.capBottomZ)
    .map(p => ({
      r: Math.max(0, p.r - 0.0008),
      z: Math.min(profileData.capBottomZ - 0.0005, p.z)
    }));

  const topLiquidZ = liquidPts[liquidPts.length - 1].z;
  const liquidGeo = createRevolvedGeometry(liquidPts, 64, liquidPts[0].z, topLiquidZ);

  // Top liquid meniscus disc
  const topLiquidRadius = liquidPts[liquidPts.length - 1].r;
  const meniscusGeo = new THREE.CircleGeometry(topLiquidRadius, 64);
  meniscusGeo.rotateX(-Math.PI / 2);
  meniscusGeo.translate(0, topLiquidZ, 0);

  const liquidMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xa4b28c), // authentic tender coconut water color
    roughness: 0.2,
    metalness: 0.0
  });
  const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
  const meniscusMesh = new THREE.Mesh(meniscusGeo, liquidMat);

  // C. Shrink Sleeve Label (Wrap right below collar ring down to heel)
  const sleevePts = points
    .filter(p => p.z >= profileData.sleeveBottomZ - 0.001 && p.z <= profileData.sleeveTopZ + 0.001)
    .map(p => ({ r: p.r + 0.00015, z: p.z }));

  const sleeveGeo = createRevolvedGeometry(sleevePts, 64, sleevePts[0].z, sleevePts[sleevePts.length - 1].z);

  const texLoader = new THREE.TextureLoader();
  const labelAlbedoTex = texLoader.load('/textures/label_albedo.png?v=13', (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.offset.x = -0.258; // Align the exact center of front Tender WONDER logo to rotation.y = 0
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });
  labelAlbedoTex.wrapS = THREE.RepeatWrapping;
  labelAlbedoTex.offset.x = -0.258;

  const sleeveMat = new THREE.MeshStandardMaterial({
    map: labelAlbedoTex,
    roughness: 0.32,
    metalness: 0.0,
    side: THREE.FrontSide
  });
  const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveMat);

  // D. Precision 1L Commercial Screw Cap with 64 Fluted Grip Ridges & Tamper Ring
  function createCapGeometry() {
    const numRidges = 64;
    const numSegs = numRidges * 2;
    const R_base = profileData.capRadius;
    const R_ridge = profileData.capRadius + 0.00055;
    const capBotZ = profileData.capBottomZ;
    const capTopZ = profileData.capTopZ;
    const capH = capTopZ - capBotZ;

    const zLevels = [
      capBotZ,
      capBotZ + capH * 0.16,
      capBotZ + capH * 0.20,
      capBotZ + capH * 0.23,
      capTopZ - capH * 0.04,
      capTopZ
    ];

    const positions = [];
    const uvs = [];
    const indices = [];

    for (let s = 0; s <= numSegs; s++) {
      const u = s / numSegs;
      const phi = 2.0 * Math.PI * (u - 0.5);
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const isPeak = (s % 2 === 1);

      // Level 0: Tamper ring bottom
      const r0 = R_base - 0.0002;
      positions.push(r0 * sinPhi, zLevels[0], r0 * cosPhi);
      uvs.push(u, 0.0);

      // Level 1: Tamper ring top
      positions.push(r0 * sinPhi, zLevels[1], r0 * cosPhi);
      uvs.push(u, 0.15);

      // Level 2: Slit gap indent
      const rSlit = R_base - 0.0006;
      positions.push(rSlit * sinPhi, zLevels[2], rSlit * cosPhi);
      uvs.push(u, 0.20);

      // Level 3: Knurled ridges bottom
      const rRidge = isPeak ? R_ridge : R_base;
      positions.push(rRidge * sinPhi, zLevels[3], rRidge * cosPhi);
      uvs.push(u, 0.25);

      // Level 4: Knurled ridges top
      positions.push(rRidge * sinPhi, zLevels[4], rRidge * cosPhi);
      uvs.push(u, 0.95);

      // Level 5: Top rim (flat top edge)
      const rTopRim = R_base - 0.0003;
      positions.push(rTopRim * sinPhi, zLevels[5], rTopRim * cosPhi);
      uvs.push(u, 1.0);
    }

    const topCenterIdx = positions.length / 3;
    // Flat top center vertex at capTopZ
    positions.push(0, zLevels[5], 0);
    uvs.push(0.5, 0.5);

    const ringsPerSeg = 6;
    for (let s = 0; s < numSegs; s++) {
      for (let r = 0; r < 5; r++) {
        const i0 = s * ringsPerSeg + r;
        const i1 = (s + 1) * ringsPerSeg + r;
        const i2 = (s + 1) * ringsPerSeg + (r + 1);
        const i3 = s * ringsPerSeg + (r + 1);
        indices.push(i0, i1, i2);
        indices.push(i0, i2, i3);
      }
      const t0 = s * ringsPerSeg + 5;
      const t1 = (s + 1) * ringsPerSeg + 5;
      indices.push(t0, t1, topCenterIdx);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  const capGeo = createCapGeometry();
  const capMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x6ed618), // Vibrant commercial lime green matching real 1L bottle photo
    roughness: 0.32,
    metalness: 0.02
  });
  const capMesh = new THREE.Mesh(capGeo, capMat);

  // ====================================================================
  // UNIFIED 3D BOTTLE ASSEMBLY & CINEMATIC MOTION RIG
  // ====================================================================
  // Exact center of mass for physical 303.3mm tall commercial bottle
  const BOTTLE_CENTER_Y = 0.1516;

  const bottleMeshGroup = new THREE.Group();
  bottleMeshGroup.add(neckMesh);
  bottleMeshGroup.add(baseMesh);
  bottleMeshGroup.add(liquidMesh);
  bottleMeshGroup.add(meniscusMesh);
  bottleMeshGroup.add(sleeveMesh);
  bottleMeshGroup.add(capMesh);
  // Center meshes relative to pivot so all rotations naturally pivot around center of mass
  bottleMeshGroup.position.set(0, -BOTTLE_CENTER_Y, 0);

  // Outer Rig carries 3D diagonal drift, natural tilt, and weightless floating physics
  const bottleRig = new THREE.Group();
  bottleRig.position.set(0, BOTTLE_CENTER_Y, 0);
  bottleRig.add(bottleMeshGroup);
  scene.add(bottleRig);

  // Settle at Center: Upright, centered, raised slightly for harmonious typography alignment
  const SETTLE_Y = BOTTLE_CENTER_Y + 0.022;
  const SETTLE_X = 0.0;
  const SETTLE_Z = 0.0;

  // Starts DOWN below the center, tilted and rotated
  const START_Y = SETTLE_Y - 0.40; // Coming from the down below the viewport
  const START_X = 0.05;                   // Subtle diagonal arc
  const START_Z = -0.09;

  // Rotation while down: tilted and rotated around central axis (previous cinematic animation)
  const START_ROTX = 0.16;                // ~9° pitch
  const START_ROTY = -Math.PI * 1.5;      // 270° axial spin as it ascends
  const START_ROTZ = -0.36;               // ~-20.5° tilt

  const SETTLE_ROTX = 0.0;
  const SETTLE_ROTY = 0.0;                // 0.0: FRONT of bottle (Tender WONDER, 1L, Product of India)
  const SETTLE_ROTZ = 0.0;

  // Quintic smoothstep easing for zero jerk
  function smoothstep5(x) {
    x = Math.max(0, Math.min(1, x));
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  // Replay: smoothly scrolls to show the bottle rising from down and rotating to front
  window.replayBottleAnimation = function() {
    const vh = window.innerHeight || 800;
    const scrollY = window.scrollY || 0;
    if (scrollY < 50) {
      animateScrollTo(vh, 850);
    } else {
      animateScrollTo(0, 600, () => {
        setTimeout(() => {
          animateScrollTo(vh, 850);
        }, 300);
      });
    }
  };



  // Cached target 3D transform for Slide 2 image place to prevent 60fps layout thrashing
  const slide2TargetEl = document.getElementById('slide-2-bottle-target');
  let cachedSlide2Slot = {
    x: 0,
    y: BOTTLE_CENTER_Y,
    z: -0.02,
    scale: 0.76
  };

  window.updateSlide2TargetCache = function() {
    const vh = window.innerHeight || 800;
    const vw = window.innerWidth || 1200;

    const camDist = camera ? camera.position.z : 0.76;
    const fovRad = camera ? THREE.MathUtils.degToRad(camera.fov) : THREE.MathUtils.degToRad(30);
    const halfH = camDist * Math.tan(fovRad / 2);
    const aspect = vw / vh;
    const halfW = halfH * aspect;

    if (!slide2TargetEl) {
      cachedSlide2Slot = {
        x: halfW * 0.54,
        y: BOTTLE_CENTER_Y,
        z: -0.02,
        scale: 0.76
      };
      return;
    }

    const rect = slide2TargetEl.getBoundingClientRect();
    const slotCenterX = rect.left + rect.width / 2;
    const slotCenterY = rect.top + rect.height / 2;

    const normX = (slotCenterX - vw / 2) / (vw / 2);
    const normY = -(slotCenterY - vh / 2) / (vh / 2);

    // Shift bottle reach position slightly to the left side as requested
    const leftOffset = -halfW * 0.025;
    const worldX = normX * halfW + leftOffset;
    const worldY = 0.155 + normY * halfH;

    const slotH = rect.height > 60 ? rect.height : vh * 0.68;
    const computedScale = (slotH / vh) / (0.302 / (2 * halfH));
    const scale = Math.max(0.55, Math.min(0.95, computedScale));

    cachedSlide2Slot = {
      x: worldX,
      y: worldY,
      z: -0.02,
      scale: scale
    };
  };

  // Initial calculation
  window.updateSlide2TargetCache();

  // Animation Loop with Real Physical Inertia, Scroll Scrubbing & Multi-Phase Motion
  let lastTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    // Damped progress tracking for butter-smooth physical response
    currentPhase1Progress += (targetPhase1Progress - currentPhase1Progress) * Math.min(1.0, dt * 7.5);
    currentPhase2Progress += (targetPhase2Progress - currentPhase2Progress) * Math.min(1.0, dt * 7.5);

    const ease1 = smoothstep5(currentPhase1Progress);
    const ease2 = smoothstep5(currentPhase2Progress);

    // 1. Phase 1: Ascent from down below to center of screen
    const p1X = THREE.MathUtils.lerp(START_X, SETTLE_X, ease1);
    const p1Y = THREE.MathUtils.lerp(START_Y, SETTLE_Y, ease1);
    const p1Z = THREE.MathUtils.lerp(START_Z, SETTLE_Z, ease1);

    const p1RotX = THREE.MathUtils.lerp(START_ROTX, SETTLE_ROTX, ease1);
    const p1RotY = THREE.MathUtils.lerp(START_ROTY, SETTLE_ROTY, ease1);
    const p1RotZ = THREE.MathUtils.lerp(START_ROTZ, SETTLE_ROTZ, ease1);

    // 2. Phase 2: Glide from center to Slide 2's own image place (reading cached transform)
    const slot = cachedSlide2Slot;
    const baseX = THREE.MathUtils.lerp(p1X, slot.x, ease2);
    const baseY = THREE.MathUtils.lerp(p1Y, slot.y, ease2);
    const baseZ = THREE.MathUtils.lerp(p1Z, slot.z, ease2);
    const baseScale = THREE.MathUtils.lerp(1.0, slot.scale, ease2);

    const baseRotX = THREE.MathUtils.lerp(p1RotX, 0.0, ease2);
    const baseRotY = THREE.MathUtils.lerp(p1RotY, 0.0, ease2);
    const baseRotZ = THREE.MathUtils.lerp(p1RotZ, 0.0, ease2);

    // 3. Weightless Harmonic Floating (subtle breathing)
    const floatWeight = ease1 * (1.0 - ease2 * 0.45);
    const floatY = Math.sin(now * 0.0016) * 0.007 * floatWeight;
    const floatX = Math.cos(now * 0.0011) * 0.004 * floatWeight;
    const floatZ = Math.sin(now * 0.0009) * 0.003 * floatWeight;

    // Subtle multi-axis precession
    const floatRotX = Math.cos(now * 0.0013) * 0.016 * floatWeight;
    const floatRotZ = Math.sin(now * 0.0012 + 0.6) * 0.020 * floatWeight;
    const floatRotY = Math.sin(now * 0.0008) * 0.06 * floatWeight;

    // Apply Transform
    const targetX = baseX + floatX;
    const targetY = baseY + floatY;
    const targetZ = baseZ + floatZ;

    const targetRotX = baseRotX + floatRotX;
    const targetRotY = baseRotY + floatRotY;
    const targetRotZ = baseRotZ + floatRotZ;

    const lerpFactor = Math.min(1.0, dt * 6.0);
    bottleRig.position.x += (targetX - bottleRig.position.x) * lerpFactor;
    bottleRig.position.y += (targetY - bottleRig.position.y) * lerpFactor;
    bottleRig.position.z += (targetZ - bottleRig.position.z) * lerpFactor;

    bottleRig.rotation.x += (targetRotX - bottleRig.rotation.x) * lerpFactor;
    bottleRig.rotation.y += (targetRotY - bottleRig.rotation.y) * lerpFactor;
    bottleRig.rotation.z += (targetRotZ - bottleRig.rotation.z) * lerpFactor;

    bottleRig.scale.setScalar(baseScale);

    if (controls) controls.update();
    // Occlusion culling: only render when heroStage is in viewport
    if (isHeroStageVisible && renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }
  animate();

  function onStageResize() {
    if (!heroStage || !camera || !renderer) return;
    const w = heroStage.clientWidth || window.innerWidth;
    const h = heroStage.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (typeof window.updateSlide2TargetCache === 'function') {
      window.updateSlide2TargetCache();
    }
  }

  window.addEventListener('resize', onStageResize);
}

// ======================================================================
// 3. CATALOG INTERACTIVITY (QUANTITY & ADD TO CART)
// ======================================================================
const cart = [];
const cartDrawer = document.getElementById('cart-drawer');
const toast = document.getElementById('toast');

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2200);
}

// Quantity spinners on luxury product cards
document.querySelectorAll('.luxury-product-card').forEach(card => {
  const minus = card.querySelector('.btn-qty-spin.minus');
  const plus = card.querySelector('.btn-qty-spin.plus');
  const qtyVal = card.querySelector('.qty-spin-val');
  const addBtn = card.querySelector('.btn-add-to-cart-luxury');

  let qty = 2;

  minus?.addEventListener('click', () => {
    if (qty > 1) {
      qty--;
      qtyVal.textContent = qty;
    }
  });

  plus?.addEventListener('click', () => {
    qty++;
    qtyVal.textContent = qty;
  });

  addBtn?.addEventListener('click', () => {
    const size = addBtn.dataset.size;
    const price = parseFloat(addBtn.dataset.price);

    const existing = cart.find(i => i.size === size);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ size, price, qty });
    }

    showToast(`Added ${qty}x ${size} to Cart!`);
    updateCartUI();
  });
});

function updateCartUI() {
  const list = document.getElementById('cart-items-list');
  const totalVal = document.getElementById('cart-total-val');
  if (!list) return;

  if (cart.length === 0) {
    list.innerHTML = '<div class="cart-empty-msg">Your cart is empty. Add fresh Tender Wonder bottles from the catalog!</div>';
    if (totalVal) totalVal.textContent = '$0.00';
    return;
  }

  let total = 0;
  list.innerHTML = cart.map(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    return `
      <div class="cart-item-row">
        <div>
          <div class="cart-item-name">${item.size}</div>
          <div class="cart-item-qty">${item.qty} &times; $${item.price.toFixed(2)}</div>
        </div>
        <div class="cart-item-price">$${itemTotal.toFixed(2)}</div>
      </div>
    `;
  }).join('');

  if (totalVal) totalVal.textContent = `$${total.toFixed(2)}`;

  // Update floating cart counter badge
  const counter = document.getElementById('cart-counter');
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  if (counter) counter.textContent = count;
}

document.getElementById('btn-close-cart')?.addEventListener('click', () => {
  cartDrawer?.classList.add('hidden');
});

document.getElementById('btn-floating-cart')?.addEventListener('click', () => {
  cartDrawer?.classList.toggle('hidden');
});

// ======================================================================
// 4. CUSTOMER DETAILS FORM SUBMISSION
// ======================================================================
window.submitOrder = function() {
  const nameInput = document.getElementById('cust-name');
  const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : 'Valued Customer';
  showToast(`Thank you, ${name}! Your order has been placed.`);
  setTimeout(() => {
    window.goToSlide(7); // Scroll smoothly to Valued Clients page
  }, 1200);
};

console.log('Tender Wonder native website experience running.');
