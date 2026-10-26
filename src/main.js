import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import profile1L from './exact_profile.json';
import profile500ml from './profile_500ml.json';
import profile250ml from './profile_250ml.json';
const profileData = profile1L;
import { CoconutModelBuilder, exportCoconutToOBJ } from './coconut_model_builder.js';

window.THREE = THREE;

// Always start at starting page (top of Slide 1) on refresh / reload
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);
if (window.location.hash) {
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch (e) {}
}
window.addEventListener('beforeunload', () => {
  window.scrollTo(0, 0);
});
window.addEventListener('load', () => {
  if (typeof updateScrollMetrics === 'function') {
    updateScrollMetrics();
  }
});

// ======================================================================
// 0. INTRO LOADING SCREEN (FAST NON-BLOCKING ASSET INITIALIZATION)
// ======================================================================
const loadingScreen = document.getElementById('loading-screen');
const progressBar = document.getElementById('loading-progress-bar');

function dismissLoadingScreen() {
  if (!loadingScreen || loadingScreen.classList.contains('fade-out')) return;
  if (progressBar) progressBar.style.width = '100%';
  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 450);
  }, 120);
}

// Fast dismiss: as soon as DOM and WebGL initialize, or max 350ms safety fallback
if (document.readyState === 'complete') {
  dismissLoadingScreen();
} else {
  window.addEventListener('load', dismissLoadingScreen, { once: true });
  setTimeout(dismissLoadingScreen, 350);
}

// ======================================================================
// 1. SLIDE NAVIGATION & SCROLL ENGINE (NATIVE SCROLL-LINKED)
// ======================================================================
let currentSlide = 1;
const totalSlides = 7;

const pureWord = document.querySelector('.word-pure, .word-taste');
const tenderWord = document.querySelector('.word-tender, .word-natures');
const drinkWord = document.querySelector('.word-drink, .word-wonder');

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

  const heroScrollPrompt = document.getElementById('hero-scroll-prompt');
  if (heroScrollPrompt) {
    const promptOpacity = Math.max(0, 1.0 - clamped1 * 3.5);
    heroScrollPrompt.style.opacity = promptOpacity.toFixed(3);
  }
}

let targetPhase1CenterProgress = 0.0;
let targetPhase1EmergeProgress = 0.0;
let currentPhase1CenterProgress = 0.0;
let currentPhase1EmergeProgress = 0.0;
let targetPhase1Progress = 0.0;
let currentPhase1Progress = 0.0;
let targetPhase2Progress = 0.0;
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

  // Phase 1A (0 to 1.0 * vh): First scroll - Center 1L bottle ascends and text slides in
  const pCenter = Math.min(Math.max(scrollY / (vh * 1.0), 0), 1);
  targetPhase1CenterProgress = pCenter;

  // Phase 1B (1.0 * vh to 2.0 * vh): Second scroll - Remaining 2 bottles emerge with rotation from behind center bottle
  const pEmerge = Math.min(Math.max((scrollY - vh) / (vh * 1.0), 0), 1);
  targetPhase1EmergeProgress = pEmerge;

  // Combined progress for backward compatibility
  targetPhase1Progress = pCenter * 0.5 + pEmerge * 0.5;

  // Phase 2: Bottle moves smoothly to Slide 2 as scrolling reaches the second page (2.0 * vh to 3.0 * vh)
  let p2 = 0.0;
  if (slide2El) {
    const s2Rect = slide2El.getBoundingClientRect();
    p2 = Math.min(Math.max((vh - s2Rect.top) / vh, 0), 1);

    // Update active slide indicator and 3D stage visibility
    if (heroStage) {
      let stageOpacity = 0;
      if (slide2El) {
        if (scrollY <= slide2El.offsetTop) {
          stageOpacity = (s2Rect.bottom > vh * 0.15) ? 1 : 0;
        } else {
          // Leaving Slide 2 towards Slide 3: cleanly fade out so bottle never lingers on Slide 3
          const exitProgress = Math.min(1, Math.max(0, (scrollY - slide2El.offsetTop) / (vh * 0.35)));
          stageOpacity = 1 - exitProgress;
        }
      }
      heroStage.style.opacity = stageOpacity > 0.01 ? stageOpacity.toFixed(3) : '0';
      const visible = stageOpacity > 0.05;
      const isInteractive = visible && p2 < 0.95;
      heroStage.classList.toggle('interactive', isInteractive);
      heroStage.style.pointerEvents = isInteractive ? 'auto' : 'none';
      heroStage.style.display = stageOpacity > 0.01 ? 'flex' : 'none';
      isHeroStageVisible = stageOpacity > 0.01;

      if (s2Rect.top <= vh * 0.5 && s2Rect.bottom > vh * 0.5) {
        updateActiveSlideUI(2);
      } else if (s2Rect.top > vh * 0.5) {
        updateActiveSlideUI(1);
      }
    }
  }
  targetPhase2Progress = p2;

  renderHeroText(pCenter, p2);

  // DONT MOVE THE SECOND PAGE UNTILL THE BOTTLE ALL COMING FROM THE SIDE WHILE SCROLLING
  if (slide2El && !isLeftBottlesSequenceFinished() && (scrollY >= slide2El.offsetTop - 60 && scrollY <= slide2El.offsetTop + vh * 0.5)) {
    const s2Top = slide2El.offsetTop;
    if (Math.abs(scrollY - s2Top) > 2 && !isStepTransitioning) {
      window.scrollTo(0, s2Top);
      return;
    }
  }

  // Reset left bottles if user scrolls back up to Slide 1
  if (p2 < 0.35 && scrollY < vh * 2.3) {
    resetLeftBottlesSequence();
  } else if (slide3El && scrollY >= slide3El.offsetTop - 60) {
    setLeftBottlesStep(3);
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
// SLIDE 2: SCROLL-DRIVEN 3-BOTTLE STAGGERED ENTRANCE CONTROLLER
// Bottles enter ONLY on user scroll while at Slide 2:
// Scroll 1: Bottle 1 (1L) enters
// Scroll 2: Bottle 2 (500ml) enters
// ======================================================================
// SLIDE 2: SCROLL-DRIVEN 3-BOTTLE STAGGERED ENTRANCE CONTROLLER
// As user scrolls on Slide 2, the 3 horizontal bottles enter from the side:
// Bottle 1 (1L) -> Bottle 2 (500ml) -> Bottle 3 (250ml)
// The viewport STRICTLY STAYS on Slide 2 until all 3 bottles have come and settled.
// Only after the 3-bottle entry finishes does scrolling down advance to Slide 3.
// ======================================================================
let leftBottlesStep = 0; // 0: none, 1: 1L, 2: 500ml, 3: 250ml
let lastBottleStepTime = 0;

function setLeftBottlesStep(step) {
  leftBottlesStep = Math.max(0, Math.min(3, step));
  const b1 = document.querySelector('.h-bottle-1');
  const b2 = document.querySelector('.h-bottle-2');
  const b3 = document.querySelector('.h-bottle-3');
  if (b1) b1.classList.toggle('entered', leftBottlesStep >= 1);
  if (b2) b2.classList.toggle('entered', leftBottlesStep >= 2);
  if (b3) b3.classList.toggle('entered', leftBottlesStep >= 3);
}

function advanceSlide2BottlesOnScroll() {
  const now = performance.now();
  if (leftBottlesStep < 3 && now - lastBottleStepTime >= 260) {
    setLeftBottlesStep(leftBottlesStep + 1);
    lastBottleStepTime = now;
    return true;
  }
  return false;
}

function stepLeftBottlesForward() {
  const now = performance.now();
  if (leftBottlesStep < 3 && now - lastBottleStepTime >= 260) {
    setLeftBottlesStep(leftBottlesStep + 1);
    lastBottleStepTime = now;
    return true;
  }
  return false;
}

function stepLeftBottlesBackward() {
  const now = performance.now();
  if (leftBottlesStep > 0 && now - lastBottleStepTime >= 260) {
    setLeftBottlesStep(leftBottlesStep - 1);
    lastBottleStepTime = now;
    return true;
  }
  return false;
}

function resetLeftBottlesSequence() {
  lastBottleStepTime = 0;
  setLeftBottlesStep(0);
}

function isLeftBottlesSequenceFinished() {
  return leftBottlesStep === 3;
}

// Expose for testing/debugging
window.setLeftBottlesStep = setLeftBottlesStep;
window.stepLeftBottlesForward = stepLeftBottlesForward;
window.stepLeftBottlesBackward = stepLeftBottlesBackward;
window.advanceSlide2BottlesOnScroll = advanceSlide2BottlesOnScroll;
window.resetLeftBottlesSequence = resetLeftBottlesSequence;
window.isLeftBottlesSequenceFinished = isLeftBottlesSequenceFinished;
window.getLeftBottlesStep = () => leftBottlesStep;
window.isLastBottleSettled = () => leftBottlesStep === 3;
window.canAdvancePastSlide2 = () => leftBottlesStep === 3;

window.addEventListener('scroll', onWindowScroll, { passive: true });

// Initial hero presentation: establish fast LCP and readable headline immediately
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
  targetPhase1CenterProgress = 1.0;
  currentPhase1CenterProgress = 1.0;
  targetPhase1EmergeProgress = 1.0;
  currentPhase1EmergeProgress = 1.0;
  renderHeroText(1.0, 0.0);
} else {
  // Smooth initial hero entrance on arrival
  targetPhase1CenterProgress = 1.0;
  currentPhase1CenterProgress = 0.0;
  renderHeroText(1.0, 0.0);
}

// In case page was reloaded at a scrolled position, sync immediately:
setTimeout(onWindowScroll, 50);

let currentScrollAnimationId = null;
let isStepTransitioning = false;
let lastTransitionEndTime = 0;

function animateScrollTo(targetY, duration = null, callback) {
  if (currentScrollAnimationId) {
    cancelAnimationFrame(currentScrollAnimationId);
  }

  const startY = window.scrollY || window.pageYOffset || 0;
  const distance = targetY - startY;

  if (Math.abs(distance) < 2) {
    window.scrollTo(0, targetY);
    isStepTransitioning = false;
    lastTransitionEndTime = performance.now();
    if (callback) callback();
    return;
  }

  // Accessibility: instant scroll if user prefers reduced motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, targetY);
    isStepTransitioning = false;
    lastTransitionEndTime = performance.now();
    if (callback) callback();
    return;
  }

  isStepTransitioning = true;
  const startTime = performance.now();

  // Cinematic, slow, luxurious scroll duration (~980ms - 1300ms)
  const actualDuration = duration !== null
    ? duration
    : Math.min(1300, Math.max(980, Math.abs(distance) * 0.45 + 600));

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / actualDuration, 1.0);

    if (progress >= 0.99) {
      window.scrollTo(0, targetY);
      currentScrollAnimationId = null;
      isStepTransitioning = false;
      lastTransitionEndTime = performance.now();
      if (callback) callback();
      return;
    }

    // Quintic smoothstep ease (sublime luxury deceleration)
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    window.scrollTo(0, startY + distance * ease);
    currentScrollAnimationId = requestAnimationFrame(tick);
  }
  currentScrollAnimationId = requestAnimationFrame(tick);
}

window.goToSlide = function(index) {
  if (index < 1 || index > totalSlides) return;
  updateActiveSlideUI(index);

  const vh = window.innerHeight || 800;
  if (index === 1) {
    resetLeftBottlesSequence();
    const curY = window.scrollY || 0;
    if (curY < 50) {
      animateScrollTo(vh, 1200);
    } else if (curY > vh * 2.2) {
      animateScrollTo(vh * 2, 850);
    } else {
      animateScrollTo(vh, 850);
    }
    return;
  }

  if (index === 2) {
    resetLeftBottlesSequence();
  } else if (index >= 3) {
    setLeftBottlesStep(3);
  }

  if (index === 3 && typeof setProcessStep === 'function') {
    setProcessStep(1);
  }

  const targetElement = document.getElementById(`slide-${index}`);
  if (targetElement) {
    animateScrollTo(targetElement.offsetTop);
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

// Universal Anchor Links Smooth Navigation (handles all in-page # links smoothly via delegation)
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const hash = link.getAttribute('href');
  if (!hash || hash === '#') return;
  const targetElem = document.querySelector(hash);
  if (targetElem) {
    e.preventDefault();
    const slideMatch = hash.match(/slide-(\d+)/);
    if (slideMatch) {
      window.goToSlide(parseInt(slideMatch[1], 10));
    } else {
      const top = targetElem.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
      animateScrollTo(top);
    }
  }
});

// ======================================================================
// UNIFIED BULLETPROOF SLIDE NAVIGATION ENGINE
// Stop 0: Slide 1 Top (0vh)
// Stop 1: Slide 1 Center Checkpoint (100vh) - Center 1L Bottle arrives
// Stop 2: Slide 1 Trio Checkpoint (200vh) - Remaining 2 bottles emerge with rotation
// Stop 3: Slide 2 (New Collection) - 1L Bottle docked + 3 Left Bottles Staggered
// Stop 4: Slide 3 (The Product / 10 Stages)
// Stop 5: Slide 4 (Catalog)
// Stop 6: Slide 5 (Global Reach)
// Stop 7: Slide 6 (Customer Details)
// Stop 8: Slide 7 (Valued Clients)
// ======================================================================
const STOP_HERO_TOP = 0;
const STOP_HERO_CENTER = 1;
const STOP_HERO_TRIO = 2;
const STOP_SLIDE_2 = 3;
const STOP_SLIDE_3 = 4;
const STOP_SLIDE_4 = 5;
const STOP_SLIDE_5 = 6;
const STOP_SLIDE_6 = 7;
const STOP_SLIDE_7 = 8;
const TOTAL_STOPS = 8;

function getCurrentStop() {
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const vh = window.innerHeight || 800;

  if (scrollY < vh * 0.45) return STOP_HERO_TOP;
  if (scrollY < vh * 1.45) return STOP_HERO_CENTER;

  const s2 = document.getElementById('slide-2');
  const s2Top = s2 ? s2.offsetTop : vh * 3;
  if (scrollY < (vh * 2 + s2Top) / 2) return STOP_HERO_TRIO;

  for (let i = 2; i < totalSlides; i++) {
    const s = document.getElementById(`slide-${i}`);
    const nextS = document.getElementById(`slide-${i + 1}`);
    const stopIdx = i + 1; // Slide 2 -> Stop 3, Slide 3 -> Stop 4, etc.
    if (s && nextS) {
      const mid = (s.offsetTop + nextS.offsetTop) / 2;
      if (scrollY < mid) {
        return stopIdx;
      }
    } else if (s) {
      if (scrollY < s.offsetTop + vh * 0.5) {
        return stopIdx;
      }
    }
  }
  return TOTAL_STOPS;
}
window.getCurrentStop = getCurrentStop;

// ======================================================================
// SLIDE 3: "FROM COCONUT TO BOTTLE" INTERACTIVE PROCESS ENGINE
// 9 Sequential Stages + Stage 10 (Final Reveal Screen)
// Coconut Cutting -> Bottle Washing -> Water Filling ->
// Sealing -> Pasteurization -> Labeling ->
// Micro Lab (268 Quality Tests Passed) -> Packaging ->
// Loading & Dispatch -> Final Reveal ("FROM NATURE. THROUGH CARE. TO YOU.")
// ======================================================================
let currentProcessStep = 1;
let lastProcessStepTime = 0;

const PROCESS_STEPS = {
  1: {
    heading: "Coconut Cutting",
    desc: "Fresh tender coconuts are carefully selected and opened under hygienic processing conditions."
  },
  2: {
    heading: "Bottle Washing",
    desc: "Bottles undergo thorough sanitization and precision rinsing to ensure absolute purity."
  },
  3: {
    heading: "Coconut Water Filling",
    desc: "Direct sterile transfer fills bottles cleanly while preserving natural freshness and minerals."
  },
  4: {
    heading: "Sealing",
    desc: "Precision airtight capping and hermetic sealing prevent exposure to preserve natural taste and freshness."
  },
  5: {
    heading: "PASTEURIZATION",
    desc: "Carefully controlled heat treatment helps ensure product safety and extend shelf life while preserving the coconut water’s natural taste and quality."
  },
  6: {
    heading: "Labeling",
    desc: "High-speed sleeve application and thermal contour labeling ensure perfect bottle presentation."
  },
  7: {
    heading: "268 Quality Tests Passed",
    desc: "Tender Wonder Coconut Water has successfully passed 268 rigorous laboratory tests, confirming its quality, purity, and safety. Refresh naturally with coconut water you can trust.",
    descHtml: "Tender Wonder Coconut Water has successfully passed <strong class=\"highlight-268-num\">268 rigorous laboratory tests</strong>, confirming its quality, purity, and safety. Refresh naturally with coconut water you can trust."
  },
  8: {
    heading: "Packaging",
    desc: "Protective boxing and packing prepare each batch securely for safe transit."
  },
  9: {
    heading: "Loading & Dispatch",
    desc: "Efficient distribution ensures fresh tender coconut water reaches destinations swiftly."
  },
  10: {
    heading: "From Nature. Through Care. To You.",
    desc: "A carefully controlled journey from fresh tender coconut to a finished product."
  }
};

const PROCESS_DESCRIPTIONS = {
  1: "COCONUT CUTTING — Fresh tender coconuts are carefully selected and opened under hygienic processing conditions.",
  2: "BOTTLE WASHING — Bottles undergo thorough sanitization and precision rinsing to ensure absolute purity.",
  3: "COCONUT WATER FILLING — Direct sterile transfer fills bottles cleanly while preserving natural freshness and minerals.",
  4: "SEALING — Precision airtight capping and hermetic sealing prevent exposure to preserve natural taste and freshness.",
  5: "PASTEURIZATION — Carefully controlled heat treatment helps ensure product safety and extend shelf life while preserving the coconut water’s natural taste and quality.",
  6: "LABELING — High-speed sleeve application and thermal contour labeling ensure perfect bottle presentation.",
  7: "268 QUALITY TESTS PASSED — Tender Wonder Coconut Water has successfully passed 268 rigorous laboratory tests, confirming its quality, purity, and safety. Refresh naturally with coconut water you can trust.",
  8: "PACKAGING — Protective boxing and packing prepare each batch securely for safe transit.",
  9: "LOADING & DISPATCH — Efficient distribution ensures fresh tender coconut water reaches destinations swiftly.",
  10: "FROM NATURE. THROUGH CARE. TO YOU. — A carefully controlled journey from fresh tender coconut to a finished product."
};

function setProcessStep(step) {
  currentProcessStep = Math.max(1, Math.min(10, step));

  // 1. Stage visual items
  const stageItems = document.querySelectorAll('#process-viewport .process-stage-item');
  stageItems.forEach(item => {
    const s = parseInt(item.dataset.stage, 10);
    const isActive = s === currentProcessStep;
    item.classList.toggle('active', isActive);

    const vid = item.querySelector('video.stage-process-video');
    if (vid) {
      if (isActive) {
        if (vid.preload !== 'auto') vid.preload = 'auto';
        vid.currentTime = 0;
        const p = vid.play();
        if (p !== undefined) p.catch(() => {});
      } else {
        vid.pause();
      }
    }
  });

  // Lazy-preload next step's video metadata so it plays seamlessly on advance
  const nextItem = document.querySelector(`#process-viewport .process-stage-item[data-stage="${currentProcessStep + 1}"]`);
  const nextVid = nextItem?.querySelector('video.stage-process-video');
  if (nextVid && nextVid.preload === 'none') {
    nextVid.preload = 'metadata';
  }

  // 2. Timeline nodes
  const nodeItems = document.querySelectorAll('.process-timeline-bar .process-node-item');
  nodeItems.forEach(node => {
    const nodeStep = parseInt(node.dataset.step, 10);
    node.classList.toggle('active', currentProcessStep <= 9 ? nodeStep === currentProcessStep : nodeStep === 9);
    node.classList.toggle('completed', nodeStep < currentProcessStep);
  });

  // 3. Continuous progress track fill bar (centers perfectly on active node dot)
  updateProcessTrackFill();

  // 4. Dynamic Heading and Description text (No numbers, heading with description below)
  const headingEl = document.getElementById('process-desc-heading');
  const descEl = document.getElementById('process-desc-text');
  const cardEl = document.querySelector('.process-desc-card');
  const stepData = PROCESS_STEPS[currentProcessStep];
  if (stepData) {
    if (headingEl) headingEl.textContent = stepData.heading;
    if (descEl) {
      if (stepData.descHtml) descEl.innerHTML = stepData.descHtml;
      else descEl.textContent = stepData.desc;
    }
  }
  if (cardEl) {
    cardEl.classList.toggle('highlight-stage-7', currentProcessStep === 7);
  }
}

function updateProcessTrackFill() {
  const trackFill = document.getElementById('process-track-fill');
  const trackBg = document.querySelector('.process-track-bg');
  const timelineBar = document.querySelector('.process-timeline-bar');
  const nodeItems = document.querySelectorAll('.process-timeline-bar .process-node-item');
  if (!trackFill || !timelineBar || !nodeItems.length) return;

  const barRect = timelineBar.getBoundingClientRect();
  const firstDot = nodeItems[0].querySelector('.node-dot');
  const lastDot = nodeItems[nodeItems.length - 1].querySelector('.node-dot');
  if (!firstDot || !lastDot) return;

  const firstDotRect = firstDot.getBoundingClientRect();
  const lastDotRect = lastDot.getBoundingClientRect();

  // If bounding rects haven't rendered yet (e.g. 0 width), use fallback formula
  if (barRect.width === 0 || firstDotRect.width === 0) {
    const activeStep = Math.min(Math.max(currentProcessStep, 1), 9);
    const pct = (activeStep - 1) / 8;
    trackFill.style.left = '39px';
    trackFill.style.width = `calc((100% - 78px) * ${pct})`;
    trackFill.classList.toggle('has-progress', pct > 0);
    if (trackBg) {
      trackBg.style.left = '39px';
      trackBg.style.right = '39px';
      trackBg.style.width = 'auto';
    }
    return;
  }

  // Exact pixel positions measured directly from the DOM
  const startX = (firstDotRect.left + firstDotRect.width / 2) - barRect.left;
  const endX = (lastDotRect.left + lastDotRect.width / 2) - barRect.left;
  const centerY = (firstDotRect.top + firstDotRect.height / 2) - barRect.top;

  // Background track spanning from center of dot 1 to center of dot 9
  if (trackBg) {
    trackBg.style.left = `${startX}px`;
    trackBg.style.width = `${endX - startX}px`;
    trackBg.style.right = 'auto';
    trackBg.style.top = `${centerY - 1.5}px`;
  }

  // Active step fill: terminates precisely at the center of the active dot
  const activeStep = Math.min(Math.max(currentProcessStep, 1), 9);
  const activeNode = nodeItems[activeStep - 1];
  const activeDot = activeNode ? activeNode.querySelector('.node-dot') : null;

  if (activeDot) {
    const activeDotRect = activeDot.getBoundingClientRect();
    const currentX = (activeDotRect.left + activeDotRect.width / 2) - barRect.left;
    const fillWidth = Math.max(0, currentX - startX);

    trackFill.style.left = `${startX}px`;
    trackFill.style.width = `${fillWidth}px`;
    trackFill.style.top = `${centerY - 1.5}px`;
    trackFill.classList.toggle('has-progress', fillWidth > 0);
  }
}

window.updateProcessTrackFill = updateProcessTrackFill;
window.setProcessStep = setProcessStep;
window.getProcessStep = () => currentProcessStep;

function initProcessControls() {
  document.querySelectorAll('.process-timeline-bar .process-node-item').forEach(node => {
    node.addEventListener('click', () => {
      const step = parseInt(node.dataset.step, 10);
      if (step) {
        setProcessStep(step);
        lastProcessStepTime = performance.now();
      }
    });
  });

  const replayBtn = document.getElementById('btn-replay-process');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      setProcessStep(1);
      lastProcessStepTime = performance.now();
    });
  }

  window.addEventListener('resize', () => {
    updateProcessTrackFill();
  });

  requestAnimationFrame(() => {
    updateProcessTrackFill();
  });
}

function navigateToStop(targetStop) {
  const vh = window.innerHeight || 800;
  const cur = getCurrentStop();

  if (targetStop <= STOP_HERO_TOP) {
    resetLeftBottlesSequence();
    animateScrollTo(0);
  } else if (targetStop === STOP_HERO_CENTER) {
    resetLeftBottlesSequence();
    animateScrollTo(vh);
  } else if (targetStop === STOP_HERO_TRIO) {
    resetLeftBottlesSequence();
    animateScrollTo(vh * 2);
  } else if (targetStop === STOP_SLIDE_2) {
    const s2 = document.getElementById('slide-2');
    const top = s2 ? s2.offsetTop : vh * 3;
    animateScrollTo(top);
  } else if (targetStop >= STOP_SLIDE_3 && targetStop <= TOTAL_STOPS) {
    const slideNum = targetStop - 1; // STOP_SLIDE_3 (4) -> slide 3, etc.
    if (cur === STOP_SLIDE_2 && !isLeftBottlesSequenceFinished()) {
      stepLeftBottlesForward();
      const s2 = document.getElementById('slide-2');
      const top = s2 ? s2.offsetTop : vh * 3;
      animateScrollTo(top);
      return;
    }
    setLeftBottlesStep(3);
    const s = document.getElementById(`slide-${slideNum}`);
    if (s) {
      animateScrollTo(s.offsetTop);
      if (slideNum === 3) {
        setTimeout(() => updateProcessTrackFill(), 350);
      }
    }
  }
}
window.navigateToStop = navigateToStop;
window.handleAdvance = handleAdvance;

function handleAdvance() {
  const cur = getCurrentStop();
  // On Slide 2: ONLY scroll down to Slide 3 after the 3 bottles have entered!
  // If not all 3 bottles have come in yet, step the bottles in while keeping viewport locked:
  if (cur === STOP_SLIDE_2 && !isLeftBottlesSequenceFinished()) {
    stepLeftBottlesForward();
    const s2 = document.getElementById('slide-2');
    const s2Top = s2 ? s2.offsetTop : window.innerHeight * 3;
    if (Math.abs(window.scrollY - s2Top) > 2) {
      window.scrollTo(0, s2Top);
    }
    return;
  }

  // On Slide 3: step through stages 1 to 10 before advancing to Slide 4
  if (cur === STOP_SLIDE_3 && currentProcessStep < 10) {
    setProcessStep(currentProcessStep + 1);
    lastProcessStepTime = performance.now();
    return;
  }

  // Once all 3 bottles have come in (or on any other stop), advance to the next stop!
  if (cur < TOTAL_STOPS) {
    navigateToStop(cur + 1);
  }
}

function handleRetreat() {
  const cur = getCurrentStop();
  if (cur === STOP_SLIDE_3 && currentProcessStep > 1) {
    setProcessStep(currentProcessStep - 1);
    lastProcessStepTime = performance.now();
    return;
  }
  if (cur > STOP_HERO_TOP) {
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
let wheelDeltaAccumulator = 0;
let wheelDecayTimer = null;
let isFirstScrollLocked = false;

function handleGlobalWheel(e) {
  // If scrolling inside an active scrollable dialog / element, let it scroll naturally
  if (isScrollableInside(e.target, e.deltaY)) {
    return;
  }

  // Prevent browser default on all wheel events to eliminate micro-scroll drift and jitter
  if (e.cancelable) {
    e.preventDefault();
  }

  // Filter out tiny trackpad noise
  if (Math.abs(e.deltaY) < 1.0) return;

  const now = performance.now();

  // Reset accumulator and first scroll lock when user pauses
  clearTimeout(wheelDecayTimer);
  wheelDecayTimer = setTimeout(() => {
    wheelDeltaAccumulator = 0;
    isFirstScrollLocked = false;
  }, 140);

  // If transition is actively animating, swallow wheel events until slide arrives
  if (isStepTransitioning) {
    wheelDeltaAccumulator = 0;
    return;
  }

  // Graceful cooldown (95ms) to ensure smooth slide arrival before next scroll
  if (now - lastTransitionEndTime < 95) {
    wheelDeltaAccumulator = 0;
    return;
  }

  const cur = getCurrentStop();

  // Slide 2: 3 horizontal bottles entrance according to user scrolling
  // Bottles enter cleanly with responsive cooldown (260ms).
  // Once all 3 bottles are on screen, scrolling down directly advances to Slide 3.
  if (cur === STOP_SLIDE_2) {
    if (e.deltaY > 0) {
      if (leftBottlesStep < 3) {
        if (now - lastBottleStepTime < 260) {
          wheelDeltaAccumulator = 0;
          return;
        }
        wheelDeltaAccumulator += e.deltaY;
        const BOTTLE_SCROLL_THRESHOLD = 20;
        if (wheelDeltaAccumulator >= BOTTLE_SCROLL_THRESHOLD) {
          wheelDeltaAccumulator = 0;
          stepLeftBottlesForward();
        }
        return;
      }
      // All 3 bottles have entered! Allow natural advance to Slide 3 immediately
    } else if (e.deltaY < 0) {
      if (now - lastBottleStepTime < 260) {
        wheelDeltaAccumulator = 0;
        return;
      }
      wheelDeltaAccumulator += e.deltaY;
      const BOTTLE_SCROLL_THRESHOLD = -20;
      if (wheelDeltaAccumulator <= BOTTLE_SCROLL_THRESHOLD) {
        wheelDeltaAccumulator = 0;
        if (leftBottlesStep > 0) {
          stepLeftBottlesBackward();
          return;
        } else {
          handleRetreat();
          return;
        }
      }
      return;
    }
  }

  // Slide 3: 9 Stages Process Journey + Stage 10 Reveal scrubbed via scroll
  if (cur === STOP_SLIDE_3) {
    if (e.deltaY > 0) {
      if (currentProcessStep < 10) {
        if (now - lastProcessStepTime < 380) {
          wheelDeltaAccumulator = 0;
          return;
        }
        wheelDeltaAccumulator += e.deltaY;
        const PROCESS_SCROLL_THRESHOLD = 24;
        if (wheelDeltaAccumulator >= PROCESS_SCROLL_THRESHOLD) {
          wheelDeltaAccumulator = 0;
          setProcessStep(currentProcessStep + 1);
          lastProcessStepTime = now;
        }
        return;
      }
      // Reached Stage 10 (Final Reveal)! Allow brief pause before advancing down to Slide 4
      if (now - lastProcessStepTime < 500) {
        wheelDeltaAccumulator = 0;
        return;
      }
    } else if (e.deltaY < 0) {
      if (now - lastProcessStepTime < 320) {
        wheelDeltaAccumulator = 0;
        return;
      }
      wheelDeltaAccumulator += e.deltaY;
      const PROCESS_SCROLL_THRESHOLD = -24;
      if (wheelDeltaAccumulator <= PROCESS_SCROLL_THRESHOLD) {
        wheelDeltaAccumulator = 0;
        if (currentProcessStep > 1) {
          setProcessStep(currentProcessStep - 1);
          lastProcessStepTime = now;
          return;
        } else {
          handleRetreat();
          return;
        }
      }
      return;
    }
  }

  // Enforce rule: A big first scroll starting at Slide 1 Top ends at Center Checkpoint (100vh).
  // The next scroll down (after brief pause) goes to Trio Checkpoint (200vh).
  if (cur === STOP_HERO_CENTER && isFirstScrollLocked && e.deltaY > 0) {
    return;
  }

  // Slide transitions: accumulate wheel delta with measured, smooth threshold
  wheelDeltaAccumulator += e.deltaY;

  const THRESHOLD = 28;
  if (wheelDeltaAccumulator >= THRESHOLD) {
    wheelDeltaAccumulator = 0;
    if (cur === STOP_HERO_TOP) {
      isFirstScrollLocked = true;
    }
    handleAdvance();
  } else if (wheelDeltaAccumulator <= -THRESHOLD) {
    wheelDeltaAccumulator = 0;
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

  if (deltaY > 25) {
    handleAdvance();
  } else if (deltaY < -25) {
    handleRetreat();
  }
}, { passive: true });

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
  camera.position.set(0.0, 0.213, 0.76);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  const maxDpr = (window.innerWidth < 768) ? 1.25 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false;
  heroStage.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0.0, 0.213, 0.0);
  controls.maxDistance = 1.4;
  controls.minDistance = 0.08; // Allow macro close-up inspection of fibers
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.8;
  controls.enableZoom = false; // Disable wheel zoom so mousewheel scrolls pages smoothly!
  // Frontal hero azimuth constraints: camera remains in frontal perspective where bottle is always foreground
  controls.minAzimuthAngle = -Math.PI / 4;
  controls.maxAzimuthAngle = Math.PI / 4;
  controls.minPolarAngle = Math.PI / 2.8;
  controls.maxPolarAngle = Math.PI / 1.8;
  window.controls = controls;
  window.camera = camera;
  window.scene = scene;
  window.renderer = renderer;

  // Studio Lighting (Calibrated to natural botanical daylight and studio photo reference)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.38);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xfffaee, 1.42);
  keyLight.position.set(-0.25, 0.45, 0.70);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xf5fff0, 0.55);
  fillLight.position.set(0.35, 0.20, 0.60);
  scene.add(fillLight);

  const rimLight1 = new THREE.DirectionalLight(0xeeffee, 0.50);
  rimLight1.position.set(0.40, 0.35, -0.40);
  scene.add(rimLight1);

  const rimLight2 = new THREE.DirectionalLight(0xf2fff0, 0.50);
  rimLight2.position.set(-0.40, 0.30, -0.40);
  scene.add(rimLight2);

  const underFill = new THREE.DirectionalLight(0xffffff, 0.25);
  underFill.position.set(0.0, -0.20, 0.40);
  scene.add(underFill);

  // Top Soft Light for Coconut Meat & Water Brilliance
  const topSoftLight = new THREE.DirectionalLight(0xffffff, 0.85);
  topSoftLight.position.set(0.0, 0.75, 0.25);
  scene.add(topSoftLight);

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

  // Precision Reusable Commercial Screw Cap with 64 Fluted Grip Ridges & Tamper Ring
  function createCapGeometry(profile) {
    const numRidges = 64;
    const numSegs = numRidges * 2;
    const R_base = profile.capRadius;
    const R_ridge = profile.capRadius + 0.00055;
    const capBotZ = profile.capBottomZ;
    const capTopZ = profile.capTopZ;
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

  const texLoader = new THREE.TextureLoader();

  // Unified factory to build an authentic 3D commercial bottle with crystal-clear PET bottle, pure liquid, shrink sleeve, and cap
  function createBottleMeshGroup(profile, labelTexturePath, labelOffsetX, capColorHex, name) {
    const points = profile.points;

    // A. Full Crystal-Clear Transparent PET Bottle
    const bottleGeo = createRevolvedGeometry(points, 64, points[0].z, points[points.length - 1].z);

    const petMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffffff), // Pristine crystal-clear PET bottle plastic
      roughness: 0.03,
      metalness: 0.0,
      transparent: true,
      opacity: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      ior: 1.52,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    petMat.userData = { baseOpacity: 0.18 };
    const bottleMesh = new THREE.Mesh(bottleGeo, petMat);

    // B. Natural Tender Coconut Water Liquid (Inner Core)
    // The liquid fills up to the neck base / fill line, leaving the upper neck clear
    const sleeveTopZ = profile.sleeveTopZ || (profile.capBottomZ - 0.025);
    const liquidTopZ = Math.min(profile.capBottomZ - 0.012, sleeveTopZ + 0.006);
    const liquidPts = points
      .filter(p => p.z <= liquidTopZ)
      .map(p => ({
        r: Math.max(0, p.r - 0.0009),
        z: p.z
      }));
    const rNeck = Math.max(0.010, (points.find(p => p.z >= liquidTopZ)?.r || 0.018) - 0.0009);
    liquidPts.push({ r: rNeck, z: liquidTopZ });

    const liquidGeo = createRevolvedGeometry(liquidPts, 64, liquidPts[0].z, liquidTopZ);

    const meniscusGeo = new THREE.CircleGeometry(rNeck, 64);
    meniscusGeo.rotateX(-Math.PI / 2);
    meniscusGeo.translate(0, liquidTopZ, 0);

    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf6fbf2), // Pure, clear, authentic tender coconut water
      roughness: 0.08,
      metalness: 0.0,
      transparent: true,
      opacity: 0.22,
      clearcoat: 0.5,
      clearcoatRoughness: 0.04,
      side: THREE.FrontSide,
      depthWrite: false
    });
    liquidMat.userData = { baseOpacity: 0.22 };
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    const meniscusMesh = new THREE.Mesh(meniscusGeo, liquidMat);

    // C. Shrink Sleeve Label
    const sleeveBottomZ = profile.sleeveBottomZ || 0.008;
    const sleevePts = points
      .filter(p => p.z >= sleeveBottomZ - 0.001 && p.z <= sleeveTopZ + 0.001)
      .map(p => ({ r: p.r + 0.00025, z: p.z }));

    const sleeveGeo = createRevolvedGeometry(sleevePts, 64, sleevePts[0].z, sleevePts[sleevePts.length - 1].z);

    const labelTex = texLoader.load(labelTexturePath, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.offset.x = labelOffsetX;
      if (renderer && renderer.capabilities) {
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
    });
    labelTex.wrapS = THREE.RepeatWrapping;
    labelTex.offset.x = labelOffsetX;

    const sleeveMat = new THREE.MeshStandardMaterial({
      map: labelTex,
      roughness: 0.28,
      metalness: 0.0,
      side: THREE.FrontSide,
      transparent: false // Pure, opaque, vibrant label graphics
    });
    sleeveMat.userData = { baseOpacity: 1.0 };
    const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveMat);

    // D. Precision Screw Cap
    const capGeo = createCapGeometry(profile);
    const capMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(capColorHex),
      roughness: 0.30,
      metalness: 0.02,
      transparent: true,
      opacity: 1.0
    });
    capMat.userData = { baseOpacity: 1.0 };
    const capMesh = new THREE.Mesh(capGeo, capMat);

    const totalH = profile.totalHeight || profile.capTopZ || 0.3033;
    const centerY = totalH * 0.5;
    const group = new THREE.Group();
    group.name = name;
    group.add(bottleMesh);
    group.add(liquidMesh);
    group.add(meniscusMesh);
    group.add(sleeveMesh);
    group.add(capMesh);
    group.position.set(0, -centerY, 0);

    return {
      group,
      centerY,
      totalHeight: totalH,
      bottleMesh,
      liquidMesh,
      meniscusMesh,
      sleeveMesh,
      capMesh,
      labelTex,
      materials: [petMat, liquidMat, sleeveMat, capMat]
    };
  }

  // ====================================================================
  // THREE-BOTTLE 3D HOMEPAGE SHOWCASE (1L Hero Center, 500ml Left, 250ml Right)
  // ====================================================================
  const BOTTLE_CENTER_Y = 0.1516; // Exact center of 303.3mm tall commercial 1L bottle

  // 1. Center Hero Bottle (1L) - Authentic commercial green cap & centered previous label
  const bottle1LData = createBottleMeshGroup(profile1L, '/textures/label_albedo.png?v=29', 0.025, 0x6ed618, 'Bottle1L');
  const bottleMeshGroup = bottle1LData.group;
  window.bottleMeshGroup = bottleMeshGroup;
  window.labelAlbedoTex = bottle1LData.labelTex;

  // 2. Left Flanking Bottle (500ml Cylinder) - AUTHENTIC WHITE CAP (0xf4f6f8) & centered 500ml master vector label
  const bottle500Data = createBottleMeshGroup(profile500ml, '/textures/label_500ml_albedo.png?v=29', 0.0, 0xf4f6f8, 'Bottle500ml');
  window.bottle500Data = bottle500Data;

  // 3. Right Flanking Bottle (250ml Hourglass) - AUTHENTIC WHITE CAP (0xf4f6f8) & centered 250ml master vector label
  const bottle250Data = createBottleMeshGroup(profile250ml, '/textures/label_250ml_albedo.png?v=29', 0.0, 0xf4f6f8, 'Bottle250ml');
  window.bottle250Data = bottle250Data;

  // Uniform size scaling preserving exact physical aspect ratios and silhouettes
  const BOTTLE_1L_SCALE = 0.90; // Primary hero focus
  const B500_SCALE = 0.92;      // Authentic medium cylinder height
  const B250_SCALE = 0.95;      // Authentic compact hourglass height

  // Interactive Rigs for independent rotation around each bottle's center
  const bottleInteractiveRig = new THREE.Group();
  bottleInteractiveRig.name = 'BottleInteractiveRig';
  bottleInteractiveRig.add(bottleMeshGroup);
  bottleInteractiveRig.scale.set(BOTTLE_1L_SCALE, BOTTLE_1L_SCALE, BOTTLE_1L_SCALE);
  window.bottleInteractiveRig = bottleInteractiveRig;

  const bottle500InteractiveRig = new THREE.Group();
  bottle500InteractiveRig.name = 'Bottle500InteractiveRig';
  bottle500InteractiveRig.add(bottle500Data.group);
  bottle500InteractiveRig.scale.set(B500_SCALE, B500_SCALE, B500_SCALE);
  window.bottle500InteractiveRig = bottle500InteractiveRig;

  const bottle250InteractiveRig = new THREE.Group();
  bottle250InteractiveRig.name = 'Bottle250InteractiveRig';
  bottle250InteractiveRig.add(bottle250Data.group);
  bottle250InteractiveRig.scale.set(B250_SCALE, B250_SCALE, B250_SCALE);
  window.bottle250InteractiveRig = bottle250InteractiveRig;

  // Shared Tabletop Ground Plane Baseline:
  // Baseline is at -BOTTLE_CENTER_Y * BOTTLE_1L_SCALE = -0.1516 * 0.90 = -0.13644
  // 500ml: totalHeight = 0.236m, halfHeight = 0.118m -> center Y = -0.13644 + (0.118 * 0.92) = -0.02788
  // 250ml: totalHeight = 0.192m, halfHeight = 0.096m -> center Y = -0.13644 + (0.096 * 0.95) = -0.04524
  const B500_POS_X = -0.128;
  const B500_POS_Y = -0.0279;
  const B500_POS_Z = -0.032;

  const bottle500Rig = new THREE.Group();
  bottle500Rig.name = 'Bottle500Rig';
  bottle500Rig.position.set(B500_POS_X, B500_POS_Y, B500_POS_Z);
  bottle500Rig.rotation.set(0.015, 0.12, -0.02);
  bottle500Rig.add(bottle500InteractiveRig);

  const B250_POS_X = +0.122;
  const B250_POS_Y = -0.0452;
  const B250_POS_Z = -0.024;

  const bottle250Rig = new THREE.Group();
  bottle250Rig.name = 'Bottle250Rig';
  bottle250Rig.position.set(B250_POS_X, B250_POS_Y, B250_POS_Z);
  bottle250Rig.rotation.set(0.015, -0.14, 0.025);
  bottle250Rig.add(bottle250InteractiveRig);

  // Soft Radial Contact Shadows for photorealistic tabletop grounding
  function createContactShadowMesh(rx, rz) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(25, 45, 15, 0.45)');
    grad.addColorStop(0.35, 'rgba(25, 45, 15, 0.22)');
    grad.addColorStop(0.70, 'rgba(25, 45, 15, 0.06)');
    grad.addColorStop(1.0, 'rgba(25, 45, 15, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(rx * 2, rz * 2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    return new THREE.Mesh(geo, mat);
  }

  const BASELINE_Y = -0.1360;
  const shadow1L = createContactShadowMesh(0.052, 0.046);
  shadow1L.position.set(0, BASELINE_Y, 0);

  const shadow500 = createContactShadowMesh(0.044, 0.038);
  shadow500.position.set(B500_POS_X, BASELINE_Y, B500_POS_Z);

  const shadow250 = createContactShadowMesh(0.040, 0.035);
  shadow250.position.set(B250_POS_X, BASELINE_Y, B250_POS_Z);

  // Outer Master Rig carries 3D diagonal drift, natural tilt, and weightless floating physics
  const bottleRig = new THREE.Group();
  bottleRig.position.set(0, BOTTLE_CENTER_Y, 0);
  bottleRig.add(bottleInteractiveRig);
  bottleRig.add(bottle500Rig);
  bottleRig.add(bottle250Rig);
  bottleRig.add(shadow1L);
  bottleRig.add(shadow500);
  bottleRig.add(shadow250);
  scene.add(bottleRig);
  window.bottleRig = bottleRig;
  window.bottle500Rig = bottle500Rig;
  window.bottle250Rig = bottle250Rig;
  window.shadow1L = shadow1L;
  window.shadow500 = shadow500;
  window.shadow250 = shadow250;

  // ====================================================================
  // ULTRA-REALISTIC 3D TENDER COCONUT SUITE (THREE INDEPENDENT OBJECTS)
  // Recreated exactly from the uploaded reference image:
  // 1. 01_Tender_Coconut_Whole_Left
  // 2. 02_Tender_Coconut_Open_Center
  // 3. 03_Tender_Coconut_Whole_Right
  // ====================================================================
  const coconutBuilder = new CoconutModelBuilder();
  const c1Left = coconutBuilder.buildCoconut01Left();
  const c2Center = coconutBuilder.buildCoconut02Center();
  const c3Right = coconutBuilder.buildCoconut03Right();

  // Expose as separate global objects with exact requested naming
  window['01_Tender_Coconut_Whole_Left'] = c1Left;
  window['02_Tender_Coconut_Open_Center'] = c2Center;
  window['03_Tender_Coconut_Whole_Right'] = c3Right;

  window.exportCoconutOBJ = (modelKey) => {
    if (modelKey === 'c1-left') exportCoconutToOBJ(c1Left, '01_Tender_Coconut_Whole_Left.obj');
    else if (modelKey === 'c2-center') exportCoconutToOBJ(c2Center, '02_Tender_Coconut_Open_Center.obj');
    else if (modelKey === 'c3-right') exportCoconutToOBJ(c3Right, '03_Tender_Coconut_Whole_Right.obj');
    else {
      exportCoconutToOBJ(coconutRig, 'Tender_Coconut_Reference_Trio.obj');
    }
  };

  // Dedicated containers for bilateral showcase flanking the 1L bottle:
  // Left Rig: Houses Coconut 1 (Whole Left) & Coconut 2 (Open Center)
  // Right Rig: Houses Coconut 3 (Whole Right on side with vertical stalk)
  // Master Rig: Carries unified breath floating and Slide 2 scroll docking/fadeout
  const coconutRig = new THREE.Group();
  coconutRig.name = 'TenderCoconutBilateralMasterRig';

  const COCONUT_LEFT_X = -0.072;  // Left cluster (Cut Coconut 2 & Whole Coconut 1)
  const COCONUT_RIGHT_X = +0.076; // Right cluster (Whole Coconut 3 with vertical stalk)
  const COCONUT_SIDE_Y = 0.0616;  // Exact ground plane baseline matching bottle base at Y=0.0616
  const COCONUT_SIDE_Z = -0.065;  // Slightly behind bottle for natural depth
  const COCONUT_BASE_SCALE = 0.88; // Anatomically calibrated to 1L commercial bottle (30.3cm)

  const coconutRigLeft = new THREE.Group();
  coconutRigLeft.name = 'TenderCoconutLeftRig';
  coconutRigLeft.position.set(COCONUT_LEFT_X, COCONUT_SIDE_Y, COCONUT_SIDE_Z);
  coconutRigLeft.scale.setScalar(COCONUT_BASE_SCALE);

  const coconutRigRight = new THREE.Group();
  coconutRigRight.name = 'TenderCoconutRightRig';
  coconutRigRight.position.set(COCONUT_RIGHT_X, COCONUT_SIDE_Y, COCONUT_SIDE_Z);
  coconutRigRight.scale.setScalar(COCONUT_BASE_SCALE);

  // Authentic Trio Composition Matching Reference Photo:
  // Left: Coconut 1 (Whole Left with calyx rosette & curved stem) & Coconut 2 (Cut Open with juicy meat)
  // Right: Coconut 3 (Horizontal body on side with tall segmented vertical green stalk)
  c1Left.visible = true;
  c1Left.position.set(-0.095, 0.000, -0.040);
  c1Left.scale.setScalar(0.95);
  c1Left.rotation.set(0.04, 0.22, 0.05);

  const c2InteractiveRig = new THREE.Group();
  c2InteractiveRig.name = 'C2InteractiveRig';
  c2Center.position.set(0.000, 0.000, 0.000);
  c2Center.rotation.set(0.02, 0.05, 0.00);
  c2InteractiveRig.add(c2Center);

  const c3InteractiveRig = new THREE.Group();
  c3InteractiveRig.name = 'C3InteractiveRig';
  c3Right.position.set(0.000, 0.000, 0.000);
  c3Right.rotation.set(-0.06, 0.32, 0.02);
  c3InteractiveRig.add(c3Right);

  coconutRigLeft.add(c1Left);
  coconutRigLeft.add(c2InteractiveRig);
  coconutRigRight.add(c3InteractiveRig);

  coconutRig.add(coconutRigLeft);
  coconutRig.add(coconutRigRight);

  window.c2InteractiveRig = c2InteractiveRig;
  window.c3InteractiveRig = c3InteractiveRig;

  // Guarantee bottle is always rendered in front of coconuts
  bottleRig.renderOrder = 20;
  bottleRig.traverse(c => { if (c.isMesh) c.renderOrder = 20; });
  coconutRig.renderOrder = 5;
  coconutRig.traverse(c => { if (c.isMesh) c.renderOrder = 5; });
  coconutRig.visible = false;

  // scene.add(coconutRig); // Coconuts removed as requested

  window.coconutRig = coconutRig;
  window.coconutRigLeft = coconutRigLeft;
  window.coconutRigRight = coconutRigRight;
  window.c1Left = c1Left;
  window.c2Center = c2Center;
  window.c3Right = c3Right;

  // ====================================================================
  // INDEPENDENT MOUSE CONTROLLER (Separate 3D Control for Bottle & Coconuts)
  // Allows users to drag and inspect Bottle, Left Coconut, or Right Coconut separately!
  // ====================================================================
  const raycaster = new THREE.Raycaster();
  const mouseCoords = new THREE.Vector2();

  let activeDragObject = null; // 'bottle' | 'bottle500' | 'bottle250' | 'c2' | 'c3' | null
  let isPointerDownOnObject = false;
  let lastPointerPos = { x: 0, y: 0 };

  const bottleVel = { x: 0, y: 0 };
  const bottle500Vel = { x: 0, y: 0 };
  const bottle250Vel = { x: 0, y: 0 };
  const c2Vel = { x: 0, y: 0 };
  const c3Vel = { x: 0, y: 0 };

  function getHitObject(clientX, clientY) {
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    mouseCoords.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseCoords.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseCoords, camera);

    const candidates = [];
    if (bottleMeshGroup && bottleMeshGroup.visible) {
      bottleMeshGroup.traverse(child => {
        if (child.isMesh) {
          child.userData.hitTarget = 'bottle';
          candidates.push(child);
        }
      });
    }
    if (bottle500Rig && bottle500Rig.visible) {
      bottle500Rig.traverse(child => {
        if (child.isMesh) {
          child.userData.hitTarget = 'bottle500';
          candidates.push(child);
        }
      });
    }
    if (bottle250Rig && bottle250Rig.visible) {
      bottle250Rig.traverse(child => {
        if (child.isMesh) {
          child.userData.hitTarget = 'bottle250';
          candidates.push(child);
        }
      });
    }
    if (coconutRig && coconutRig.visible) {
      if (coconutRigLeft && coconutRigLeft.visible) {
        if (c2Center) {
          c2Center.traverse(child => {
            if (child.isMesh && child.geometry && child.geometry.type !== 'PlaneGeometry') {
              child.userData.hitTarget = 'c2';
              candidates.push(child);
            }
          });
        }
        if (c1Left) {
          c1Left.traverse(child => {
            if (child.isMesh && child.geometry && child.geometry.type !== 'PlaneGeometry') {
              child.userData.hitTarget = 'c2';
              candidates.push(child);
            }
          });
        }
      }
      if (coconutRigRight && coconutRigRight.visible && c3Right) {
        c3Right.traverse(child => {
          if (child.isMesh && child.geometry && child.geometry.type !== 'PlaneGeometry') {
            child.userData.hitTarget = 'c3';
            candidates.push(child);
          }
        });
      }
    }

    const hits = raycaster.intersectObjects(candidates, false);
    if (hits.length > 0) {
      return hits[0].object.userData.hitTarget;
    }
    return null;
  }

  const canvasEl = renderer.domElement;

  canvasEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const hit = getHitObject(e.clientX, e.clientY);
    if (hit) {
      activeDragObject = hit;
      isPointerDownOnObject = true;
      lastPointerPos = { x: e.clientX, y: e.clientY };
      if (controls) controls.enabled = false;
      canvasEl.classList.add('is-dragging');
      if (canvasEl.setPointerCapture) {
        try { canvasEl.setPointerCapture(e.pointerId); } catch (_) {}
      }
    } else {
      activeDragObject = null;
      isPointerDownOnObject = false;
      if (controls) controls.enabled = true;
    }
  });

  canvasEl.addEventListener('pointermove', (e) => {
    if (isPointerDownOnObject && activeDragObject) {
      const dx = e.clientX - lastPointerPos.x;
      const dy = e.clientY - lastPointerPos.y;
      lastPointerPos = { x: e.clientX, y: e.clientY };

      const SENSITIVITY = 0.007;
      if (activeDragObject === 'bottle') {
        bottleVel.y += dx * SENSITIVITY;
        bottleVel.x += dy * SENSITIVITY;
      } else if (activeDragObject === 'bottle500') {
        bottle500Vel.y += dx * SENSITIVITY;
        bottle500Vel.x += dy * SENSITIVITY;
      } else if (activeDragObject === 'bottle250') {
        bottle250Vel.y += dx * SENSITIVITY;
        bottle250Vel.x += dy * SENSITIVITY;
      } else if (activeDragObject === 'c2') {
        c2Vel.y += dx * SENSITIVITY;
        c2Vel.x += dy * SENSITIVITY;
      } else if (activeDragObject === 'c3') {
        c3Vel.y += dx * SENSITIVITY;
        c3Vel.x += dy * SENSITIVITY;
      }
    } else if (!isPointerDownOnObject) {
      const hit = getHitObject(e.clientX, e.clientY);
      if (hit) {
        canvasEl.style.cursor = 'grab';
      } else {
        canvasEl.style.cursor = 'default';
      }
    }
  });

  function handlePointerRelease(e) {
    if (isPointerDownOnObject) {
      isPointerDownOnObject = false;
      activeDragObject = null;
      if (controls) controls.enabled = true;
      canvasEl.classList.remove('is-dragging');
      const hit = getHitObject(e.clientX, e.clientY);
      canvasEl.style.cursor = hit ? 'grab' : 'default';
      if (canvasEl.releasePointerCapture) {
        try { canvasEl.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    }
  }

  canvasEl.addEventListener('pointerup', handlePointerRelease);
  canvasEl.addEventListener('pointercancel', handlePointerRelease);

  // Double click resets the clicked object's orientation back to showcase default
  canvasEl.addEventListener('dblclick', (e) => {
    const hit = getHitObject(e.clientX, e.clientY);
    if (hit === 'bottle' && bottleInteractiveRig) {
      bottleInteractiveRig.rotation.set(0, 0, 0);
      bottleVel.x = 0; bottleVel.y = 0;
    } else if (hit === 'bottle500' && bottle500InteractiveRig) {
      bottle500InteractiveRig.rotation.set(0, 0, 0);
      bottle500Vel.x = 0; bottle500Vel.y = 0;
    } else if (hit === 'bottle250' && bottle250InteractiveRig) {
      bottle250InteractiveRig.rotation.set(0, 0, 0);
      bottle250Vel.x = 0; bottle250Vel.y = 0;
    } else if (hit === 'c2' && c2InteractiveRig) {
      c2InteractiveRig.rotation.set(0, 0, 0);
      c2Vel.x = 0; c2Vel.y = 0;
    } else if (hit === 'c3' && c3InteractiveRig) {
      c3InteractiveRig.rotation.set(0, 0, 0);
      c3Vel.x = 0; c3Vel.y = 0;
    }
  });

  let active3DModel = 'bottle';
  c1Left.visible = false;
  c2Center.visible = false;
  c3Right.visible = false;
  coconutRigLeft.visible = false;
  coconutRigRight.visible = false;
  coconutRig.visible = false;
  bottleMeshGroup.visible = true; // BOTTLE IS ALWAYS VISIBLE WITH ITS PREVIOUS MOTION!

  function set3DModel(modelType) {
    active3DModel = modelType;
    coconutRig.visible = false;
    bottleMeshGroup.visible = true;

    coconutRigLeft.visible = false;
    coconutRigRight.visible = false;
    c1Left.visible = false;
    c2Center.visible = false;
    c3Right.visible = false;
    c2Center.position.set(0.012, 0.000, 0.008);
    c2Center.rotation.set(0.02, 0.05, 0.00);
    c3Right.position.set(0.000, 0.000, 0.000);
    c3Right.rotation.set(-0.06, 0.32, 0.02);
    if (bottleInteractiveRig) { bottleInteractiveRig.rotation.set(0, 0, 0); bottleVel.x = 0; bottleVel.y = 0; }
    if (c2InteractiveRig) { c2InteractiveRig.rotation.set(0, 0, 0); c2Vel.x = 0; c2Vel.y = 0; }
    if (c3InteractiveRig) { c3InteractiveRig.rotation.set(0, 0, 0); c3Vel.x = 0; c3Vel.y = 0; }
    coconutRigLeft.position.set(COCONUT_LEFT_X, COCONUT_SIDE_Y, COCONUT_SIDE_Z);
    coconutRigRight.position.set(COCONUT_RIGHT_X, COCONUT_SIDE_Y, COCONUT_SIDE_Z);
    coconutRigLeft.scale.setScalar(COCONUT_BASE_SCALE);
    coconutRigRight.scale.setScalar(COCONUT_BASE_SCALE);
    coconutRigLeft.rotation.set(0, 0, 0);
    coconutRigRight.rotation.set(0, 0, 0);
  }

  window.set3DModel = set3DModel;
  window.coconutRig = coconutRig;
  window.coconutRigLeft = coconutRigLeft;
  window.coconutRigRight = coconutRigRight;
  window.c1Left = c1Left;
  window.c2Center = c2Center;
  window.c3Right = c3Right;
  window.updateScrollMetrics = updateScrollMetrics;
  window.setPhaseProgress = (p1, p2 = 0) => {
    if (p1 <= 0.50) {
      targetPhase1CenterProgress = p1 / 0.50;
      currentPhase1CenterProgress = targetPhase1CenterProgress;
      targetPhase1EmergeProgress = 0.0;
      currentPhase1EmergeProgress = 0.0;
    } else {
      targetPhase1CenterProgress = 1.0;
      currentPhase1CenterProgress = 1.0;
      targetPhase1EmergeProgress = (p1 - 0.50) / 0.50;
      currentPhase1EmergeProgress = targetPhase1EmergeProgress;
    }
    targetPhase1Progress = p1;
    currentPhase1Progress = p1;
    targetPhase2Progress = p2;
    currentPhase2Progress = p2;
    renderHeroText(targetPhase1CenterProgress, p2);
  };
  window.renderFrame = () => {
    if (renderer && scene && camera) renderer.render(scene, camera);
  };

  // Settle at Center: Upright, centered with bottle base resting on ground plane (Y=0.0620)
  const SETTLE_Y = 0.213;
  const SETTLE_X = 0.0;
  const SETTLE_Z = 0.0;

  // Initial ascent entrance coordinates
  const START_Y = SETTLE_Y - 0.40; // Coming from down below the viewport
  const START_X = 0.04;            // Subtle diagonal arc
  const START_Z = 0.0;             // Foreground Z plane: bottle never starts behind coconuts

  // Rotation while down: tilted and rotated around central axis (cinematic animation)
  const START_ROTX = 0.16;         // ~9° forward pitch
  const START_ROTY = -Math.PI * 1.5; // 270° axial spin as it ascends
  const START_ROTZ = -0.28;        // ~-16° natural tilt

  const SETTLE_ROTX = 0.0;
  const SETTLE_ROTY = 0.0; // FRONT of bottle (Tender WONDER, 1L, Product of India)
  const SETTLE_ROTZ = 0.0;

  window.forceSettle = () => {
    const vh = window.innerHeight || 800;
    window.scrollTo(0, vh * 2);
    targetPhase1CenterProgress = 1.0;
    currentPhase1CenterProgress = 1.0;
    targetPhase1EmergeProgress = 1.0;
    currentPhase1EmergeProgress = 1.0;
    targetPhase1Progress = 1.0;
    currentPhase1Progress = 1.0;
    targetPhase2Progress = 0.0;
    currentPhase2Progress = 0.0;
    bottleRig.position.set(SETTLE_X, SETTLE_Y, SETTLE_Z);
    bottleRig.rotation.set(SETTLE_ROTX, SETTLE_ROTY, SETTLE_ROTZ);
    bottleRig.scale.setScalar(1.0);
    bottleMeshGroup.visible = true;
    if (bottleInteractiveRig) { bottleInteractiveRig.rotation.set(0, 0, 0); bottleVel.x = 0; bottleVel.y = 0; }
    if (bottle500InteractiveRig) { bottle500InteractiveRig.rotation.set(0, 0, 0); bottle500Vel.x = 0; bottle500Vel.y = 0; }
    if (bottle250InteractiveRig) { bottle250InteractiveRig.rotation.set(0, 0, 0); bottle250Vel.x = 0; bottle250Vel.y = 0; }
    renderHeroText(1.0, 0.0);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  };

  // Quintic smoothstep easing for zero jerk
  function smoothstep5(x) {
    x = Math.max(0, Math.min(1, x));
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  // Replay: smoothly scrolls to top and re-runs the starting ascent and text arrival, followed by side emergence
  window.replayBottleAnimation = function() {
    const vh = window.innerHeight || 800;
    animateScrollTo(0, 500, () => {
      setTimeout(() => {
        animateScrollTo(vh, 1000, () => {
          setTimeout(() => {
            animateScrollTo(vh * 2, 1000);
          }, 300);
        });
      }, 250);
    });
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
        x: halfW * 0.50,
        y: BOTTLE_CENTER_Y + 0.045,
        z: -0.02,
        scale: 0.76
      };
      return;
    }

    const rect = slide2TargetEl.getBoundingClientRect();
    const slotCenterX = Math.round(rect.left + rect.width / 2);
    const slotCenterY = Math.round(rect.top + rect.height / 2);

    const normX = (slotCenterX - vw / 2) / (vw / 2);
    const normY = -(slotCenterY - vh / 2) / (vh / 2);

    // Calibrated reach position: elevated slightly up and shifted inward towards center
    const leftOffset = -halfW * 0.065;
    const worldX = normX * halfW + leftOffset;
    const worldY = 0.195 + normY * halfH;

    const slotH = rect.height > 60 ? rect.height : vh * 0.68;
    const computedScale = (slotH / vh) / (0.302 / (2 * halfH));
    const scale = Math.max(0.55, Math.min(0.95, computedScale));

    cachedSlide2Slot = {
      x: worldX,
      y: worldY,
      z: -0.02,
      scale: scale / BOTTLE_1L_SCALE
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
    currentPhase1CenterProgress += (targetPhase1CenterProgress - currentPhase1CenterProgress) * Math.min(1.0, dt * 4.5);
    currentPhase1EmergeProgress += (targetPhase1EmergeProgress - currentPhase1EmergeProgress) * Math.min(1.0, dt * 4.5);
    currentPhase2Progress += (targetPhase2Progress - currentPhase2Progress) * Math.min(1.0, dt * 4.5);
    if (Math.abs(targetPhase1CenterProgress - currentPhase1CenterProgress) < 0.0005) {
      currentPhase1CenterProgress = targetPhase1CenterProgress;
    }
    if (Math.abs(targetPhase1EmergeProgress - currentPhase1EmergeProgress) < 0.0005) {
      currentPhase1EmergeProgress = targetPhase1EmergeProgress;
    }
    if (Math.abs(targetPhase2Progress - currentPhase2Progress) < 0.0005) {
      currentPhase2Progress = targetPhase2Progress;
    }
    currentPhase1Progress = currentPhase1CenterProgress * 0.5 + currentPhase1EmergeProgress * 0.5;

    const ease2 = smoothstep5(currentPhase2Progress);

    // ================================================================
    // STRICT SEQUENTIAL HERO CHOREOGRAPHY:
    // 1. Center 1L bottle ascends and completely reaches the center first (Scroll 1: 0 -> 100vh)
    // 2. ONLY once the center bottle has reached the center (Scroll 2: 100vh -> 200vh),
    //    the remaining two bottles emerge from behind the center bottle with rotation.
    // ================================================================
    const tCenter = smoothstep5(currentPhase1CenterProgress);
    const tEmerge = smoothstep5(currentPhase1EmergeProgress);

    // 1. Phase 1: Ascent from down below to center of screen (Center 1L bottle arrives first)
    const p1X = THREE.MathUtils.lerp(START_X, SETTLE_X, tCenter);
    const p1Y = THREE.MathUtils.lerp(START_Y, SETTLE_Y, tCenter);
    const p1Z = THREE.MathUtils.lerp(START_Z, SETTLE_Z, tCenter);

    const p1RotX = THREE.MathUtils.lerp(START_ROTX, SETTLE_ROTX, tCenter);
    const p1RotY = THREE.MathUtils.lerp(START_ROTY, SETTLE_ROTY, tCenter);
    const p1RotZ = THREE.MathUtils.lerp(START_ROTZ, SETTLE_ROTZ, tCenter);

    // 2. Phase 2: Glide from center to Slide 2's own image place (reading cached transform)
    const slot = cachedSlide2Slot;
    const baseX = THREE.MathUtils.lerp(p1X, slot.x, ease2);
    const baseY = THREE.MathUtils.lerp(p1Y, slot.y, ease2);
    const baseZ = THREE.MathUtils.lerp(p1Z, slot.z, ease2);
    const baseScale = THREE.MathUtils.lerp(1.0, slot.scale, ease2);

    const baseRotX = THREE.MathUtils.lerp(p1RotX, 0.0, ease2);
    const baseRotY = THREE.MathUtils.lerp(p1RotY, 0.0, ease2);
    const baseRotZ = THREE.MathUtils.lerp(p1RotZ, 0.0, ease2);

    // 3. Weightless Harmonic Floating (subtle breathing - active only on Slide 1 hero)
    // On Slide 2, the bottle is docked in its slot - floatWeight fades completely to 0 so it stays rock-solid
    const floatWeight = tCenter * Math.max(0, 1.0 - ease2 * 1.6);
    const floatY = floatWeight > 0.0001 ? Math.sin(now * 0.0016) * 0.007 * floatWeight : 0;
    const floatX = floatWeight > 0.0001 ? Math.cos(now * 0.0011) * 0.004 * floatWeight : 0;
    const floatZ = floatWeight > 0.0001 ? Math.sin(now * 0.0009) * 0.003 * floatWeight : 0;

    // Subtle multi-axis precession
    const floatRotX = floatWeight > 0.0001 ? Math.cos(now * 0.0013) * 0.016 * floatWeight : 0;
    const floatRotZ = floatWeight > 0.0001 ? Math.sin(now * 0.0012 + 0.6) * 0.020 * floatWeight : 0;
    const floatRotY = floatWeight > 0.0001 ? Math.sin(now * 0.0008) * 0.06 * floatWeight : 0;

    // Apply Transform
    const targetX = baseX + floatX;
    const targetY = baseY + floatY;
    const targetZ = baseZ + floatZ;

    const targetRotX = baseRotX + floatRotX;
    const targetRotY = baseRotY + floatRotY;
    const targetRotZ = baseRotZ + floatRotZ;

    const lerpFactor = Math.min(1.0, dt * 4.5);
    if (Math.abs(targetX - bottleRig.position.x) < 0.0002) bottleRig.position.x = targetX;
    else bottleRig.position.x += (targetX - bottleRig.position.x) * lerpFactor;

    if (Math.abs(targetY - bottleRig.position.y) < 0.0002) bottleRig.position.y = targetY;
    else bottleRig.position.y += (targetY - bottleRig.position.y) * lerpFactor;

    if (Math.abs(targetZ - bottleRig.position.z) < 0.0002) bottleRig.position.z = targetZ;
    else bottleRig.position.z += (targetZ - bottleRig.position.z) * lerpFactor;

    if (Math.abs(targetRotX - bottleRig.rotation.x) < 0.0002) bottleRig.rotation.x = targetRotX;
    else bottleRig.rotation.x += (targetRotX - bottleRig.rotation.x) * lerpFactor;

    if (Math.abs(targetRotY - bottleRig.rotation.y) < 0.0002) bottleRig.rotation.y = targetRotY;
    else bottleRig.rotation.y += (targetRotY - bottleRig.rotation.y) * lerpFactor;

    if (Math.abs(targetRotZ - bottleRig.rotation.z) < 0.0002) bottleRig.rotation.z = targetRotZ;
    else bottleRig.rotation.z += (targetRotZ - bottleRig.rotation.z) * lerpFactor;

    bottleRig.scale.setScalar(baseScale);

    // ================================================================
    // THREE-BOTTLE 3D SHOWCASE ANIMATION & TRANSITION
    // ================================================================
    bottleMeshGroup.visible = true;

    // The remaining two bottles remain strictly hidden until the center bottle has completely reached center!
    // During second scroll (tEmerge > 0), they emerge from behind with rotation flourish.
    const sideBottleFade = tEmerge * Math.max(0, 1.0 - ease2 * 2.2);

    // Dynamic rotation flourish while emerging from behind center bottle:
    // 500ml spins smoothly as it slides out to the left and settles squarely facing forward
    const emerge500RotY = THREE.MathUtils.lerp(0.0 - Math.PI * 1.5, 0.0, tEmerge);
    const emerge500RotX = THREE.MathUtils.lerp(0.10, 0.0, tEmerge);
    const emerge500RotZ = THREE.MathUtils.lerp(-0.16, 0.0, tEmerge);

    // 250ml spins in opposite direction as it slides out to the right and settles squarely facing forward
    const emerge250RotY = THREE.MathUtils.lerp(0.0 + Math.PI * 1.5, 0.0, tEmerge);
    const emerge250RotX = THREE.MathUtils.lerp(0.10, 0.0, tEmerge);
    const emerge250RotZ = THREE.MathUtils.lerp(0.16, 0.0, tEmerge);

    // Positions: originate directly behind center bottle (X = 0, Z = -0.090) and curve outward
    const emerge500X = THREE.MathUtils.lerp(0.0, B500_POS_X, tEmerge);
    const emerge500Y = THREE.MathUtils.lerp(B500_POS_Y - 0.015, B500_POS_Y, tEmerge);
    const emerge500Z = THREE.MathUtils.lerp(-0.090, B500_POS_Z, tEmerge);

    const emerge250X = THREE.MathUtils.lerp(0.0, B250_POS_X, tEmerge);
    const emerge250Y = THREE.MathUtils.lerp(B250_POS_Y - 0.015, B250_POS_Y, tEmerge);
    const emerge250Z = THREE.MathUtils.lerp(-0.090, B250_POS_Z, tEmerge);

    const emergeScale500 = THREE.MathUtils.lerp(0.001, 1.0, Math.min(1.0, tEmerge * 1.35));
    const emergeScale250 = THREE.MathUtils.lerp(0.001, 1.0, Math.min(1.0, tEmerge * 1.35));

    if (bottle500Rig) {
      bottle500Rig.visible = sideBottleFade > 0.005;
      bottle500Rig.scale.setScalar(sideBottleFade > 0.005 ? emergeScale500 : 0.0001);

      // Subtle organic breathing float once settled on Slide 1
      const breath500Y = (tEmerge > 0.95 && sideBottleFade > 0.005) ? Math.sin(now * 0.0014 + 1.2) * 0.0022 : 0;
      const breath500X = (tEmerge > 0.95 && sideBottleFade > 0.005) ? Math.cos(now * 0.0010 + 0.8) * 0.0012 : 0;

      bottle500Rig.position.set(emerge500X + breath500X, emerge500Y + breath500Y, emerge500Z);
      bottle500Rig.rotation.set(emerge500RotX, emerge500RotY, emerge500RotZ);

      if (bottle500Data && bottle500Data.materials) {
        bottle500Data.materials.forEach((mat, idx) => {
          const base = mat.userData?.baseOpacity !== undefined ? mat.userData.baseOpacity : 1.0;
          mat.opacity = base * sideBottleFade;
          // Keep shrink sleeve and cap completely opaque when settled for maximum vibrancy
          mat.transparent = (sideBottleFade < 0.99) || (idx === 0 || idx === 1);
        });
      }
    }

    if (bottle250Rig) {
      bottle250Rig.visible = sideBottleFade > 0.005;
      bottle250Rig.scale.setScalar(sideBottleFade > 0.005 ? emergeScale250 : 0.0001);

      // Subtle organic breathing float once settled on Slide 1
      const breath250Y = (tEmerge > 0.95 && sideBottleFade > 0.005) ? Math.sin(now * 0.0017 + 2.4) * 0.0020 : 0;
      const breath250X = (tEmerge > 0.95 && sideBottleFade > 0.005) ? Math.cos(now * 0.0012 + 1.6) * 0.0010 : 0;

      bottle250Rig.position.set(emerge250X + breath250X, emerge250Y + breath250Y, emerge250Z);
      bottle250Rig.rotation.set(emerge250RotX, emerge250RotY, emerge250RotZ);

      if (bottle250Data && bottle250Data.materials) {
        bottle250Data.materials.forEach((mat, idx) => {
          const base = mat.userData?.baseOpacity !== undefined ? mat.userData.baseOpacity : 1.0;
          mat.opacity = base * sideBottleFade;
          // Keep shrink sleeve and cap completely opaque when settled for maximum vibrancy
          mat.transparent = (sideBottleFade < 0.99) || (idx === 0 || idx === 1);
        });
      }
    }

    // Soft Contact Shadows tracking
    if (window.shadow1L) {
      const shadowFade1L = Math.max(0, (tCenter - 0.4) / 0.6) * Math.max(0, 1.0 - ease2 * 2.0);
      window.shadow1L.material.opacity = shadowFade1L * 0.45;
    }
    if (window.shadow500) {
      window.shadow500.material.opacity = sideBottleFade * 0.40;
      window.shadow500.position.x = emerge500X;
      window.shadow500.position.z = emerge500Z;
    }
    if (window.shadow250) {
      window.shadow250.material.opacity = sideBottleFade * 0.40;
      window.shadow250.position.x = emerge250X;
      window.shadow250.position.z = emerge250Z;
    }

    if (coconutRig) {
      coconutRig.visible = false;
    }

    // ================================================================
    // INDEPENDENT MOUSE ROTATION PHYSICS (Inertia & Smooth Damping)
    // ================================================================
    if (bottleInteractiveRig) {
      bottleInteractiveRig.rotation.y += bottleVel.y;
      bottleInteractiveRig.rotation.x += bottleVel.x;
      bottleInteractiveRig.rotation.x = Math.max(-1.25, Math.min(1.25, bottleInteractiveRig.rotation.x));
      bottleVel.y *= 0.91;
      bottleVel.x *= 0.91;
    }
    if (bottle500InteractiveRig) {
      bottle500InteractiveRig.rotation.y += bottle500Vel.y;
      bottle500InteractiveRig.rotation.x += bottle500Vel.x;
      bottle500InteractiveRig.rotation.x = Math.max(-1.25, Math.min(1.25, bottle500InteractiveRig.rotation.x));
      bottle500Vel.y *= 0.91;
      bottle500Vel.x *= 0.91;
    }
    if (bottle250InteractiveRig) {
      bottle250InteractiveRig.rotation.y += bottle250Vel.y;
      bottle250InteractiveRig.rotation.x += bottle250Vel.x;
      bottle250InteractiveRig.rotation.x = Math.max(-1.25, Math.min(1.25, bottle250InteractiveRig.rotation.x));
      bottle250Vel.y *= 0.91;
      bottle250Vel.x *= 0.91;
    }
    if (c2InteractiveRig) {
      c2InteractiveRig.rotation.y += c2Vel.y;
      c2InteractiveRig.rotation.x += c2Vel.x;
      c2InteractiveRig.rotation.x = Math.max(-1.25, Math.min(1.25, c2InteractiveRig.rotation.x));
      c2Vel.y *= 0.91;
      c2Vel.x *= 0.91;
    }
    if (c3InteractiveRig) {
      c3InteractiveRig.rotation.y += c3Vel.y;
      c3InteractiveRig.rotation.x += c3Vel.x;
      c3InteractiveRig.rotation.x = Math.max(-1.25, Math.min(1.25, c3InteractiveRig.rotation.x));
      c3Vel.y *= 0.91;
      c3Vel.x *= 0.91;
    }

    if (controls && controls.enabled && isHeroStageVisible) controls.update();
    // Occlusion culling: strictly render only when heroStage is visible in viewport
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

  let qty = parseInt(qtyVal?.textContent || '0', 10) || 0;

  minus?.addEventListener('click', () => {
    if (qty > 0) {
      qty--;
      qtyVal.textContent = qty;
    }
  });

  plus?.addEventListener('click', () => {
    qty++;
    qtyVal.textContent = qty;
  });

  addBtn?.addEventListener('click', () => {
    if (qty <= 0) {
      showToast('Please select at least 1 item before adding to cart');
      return;
    }

    const size = addBtn.dataset.size;
    const price = parseFloat(addBtn.dataset.price) || 0;

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
// 4. CONTACT US & DIRECT WHATSAPP INTEGRATION (+971 503130165)
// ======================================================================
window.submitContactForm = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const nameInput = document.getElementById('cust-name');
  const phoneInput = document.getElementById('cust-phone');
  const emailInput = document.getElementById('cust-email');
  const subjectInput = document.getElementById('cust-subject');
  const messageInput = document.getElementById('cust-message');

  const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : 'Valued Customer';
  const phone = phoneInput && phoneInput.value.trim() ? phoneInput.value.trim() : '';
  const email = emailInput && emailInput.value.trim() ? emailInput.value.trim() : '';
  const subject = subjectInput ? subjectInput.value : 'General Inquiry';
  const message = messageInput && messageInput.value.trim() ? messageInput.value.trim() : '';

  let cartDetails = '';
  if (typeof cart !== 'undefined' && Array.isArray(cart) && cart.length > 0) {
    const items = cart.map(item => `  • ${item.size}: ${item.qty} pcs @ $${item.price.toFixed(2)} = $${(item.qty * item.price).toFixed(2)}`).join('\n');
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(2);
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    cartDetails = `\n\n🛒 *Selected Bottles from Catalog (${totalQty} pcs):*\n${items}\n💰 *Total Price: $${total}*`;
  }

  const textLines = [
    `🌴 *Tender Wonder Contact Inquiry* 🌴`,
    `--------------------------------------`,
    `👤 *Name:* ${name}`,
    `📞 *Phone / WhatsApp:* ${phone || 'Not specified'}`,
    `✉️ *Email:* ${email || 'Not specified'}`,
    `📌 *Inquiry Type:* ${subject}`,
    message ? `💬 *Message:* ${message}` : `💬 *Message:* Hello, I would like to inquire about Tender Wonder pure tender coconut water.`,
    cartDetails
  ].filter(Boolean).join('\n');

  const whatsappUrl = `https://wa.me/971503130165?text=${encodeURIComponent(textLines)}`;

  showToast('Connecting to WhatsApp (+971 50 313 0165)...');
  
  // Open WhatsApp in new tab, with failover to same-window navigation if popups are blocked
  try {
    const newWin = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
      window.location.href = whatsappUrl;
    }
  } catch (err) {
    window.location.href = whatsappUrl;
  }
};

window.submitOrder = window.submitContactForm;

// Direct WhatsApp Order from Shopping Cart Drawer with Order Items & Price
window.sendCartOrderToWhatsApp = function() {
  if (!cart || cart.length === 0) {
    showToast('Your cart is empty! Please add bottles from the catalog.');
    window.goToSlide(4);
    return;
  }

  const itemsList = cart.map(item => {
    const itemTotal = (item.price * item.qty).toFixed(2);
    return `  • ${item.size} — ${item.qty} pcs @ $${item.price.toFixed(2)} = $${itemTotal}`;
  }).join('\n');

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(2);
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);

  const textLines = [
    `🌴 *Tender Wonder — WhatsApp Order* 🌴`,
    `----------------------------------------`,
    `Hello! I would like to place an order for Tender Wonder 100% Pure Natural Tender Coconut Water:`,
    ``,
    `🛒 *Order Details (${totalQty} bottles):*`,
    itemsList,
    ``,
    `💰 *Total Price: $${total}*`,
    `----------------------------------------`,
    `📍 Please share delivery details and confirm my order. Thank you!`
  ].join('\n');

  const whatsappUrl = `https://wa.me/971503130165?text=${encodeURIComponent(textLines)}`;
  showToast('Connecting to WhatsApp with your order...');

  try {
    const newWin = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
      window.location.href = whatsappUrl;
    }
  } catch (err) {
    window.location.href = whatsappUrl;
  }
};

const btnCartCheckout = document.getElementById('btn-cart-checkout');
if (btnCartCheckout) {
  btnCartCheckout.addEventListener('click', (e) => {
    e.preventDefault();
    window.sendCartOrderToWhatsApp();
  });
}

// Explicit Click Handlers for Contact Us Buttons
const whatsappDirectBanner = document.getElementById('whatsapp-direct-banner') || document.querySelector('.whatsapp-direct-banner');
if (whatsappDirectBanner) {
  whatsappDirectBanner.addEventListener('click', (e) => {
    e.preventDefault();
    const chatUrl = 'https://wa.me/971503130165?text=' + encodeURIComponent('Hello Tender Wonder, I would like to inquire about pure tender coconut water.');
    showToast('Connecting to WhatsApp (+971 50 313 0165)...');
    try {
      const win = window.open(chatUrl, '_blank', 'noopener,noreferrer');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = chatUrl;
      }
    } catch (err) {
      window.location.href = chatUrl;
    }
  });
}

const btnChatNow = document.getElementById('btn-chat-now');
if (btnChatNow) {
  btnChatNow.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    whatsappDirectBanner?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

const btnWhatsappConnect = document.getElementById('btn-whatsapp-connect') || document.querySelector('.btn-form-whatsapp');
if (btnWhatsappConnect) {
  btnWhatsappConnect.addEventListener('click', (e) => {
    e.preventDefault();
    window.submitContactForm(e);
  });
}

// ======================================================================
// 5. VALUED CLIENTS (SLIDE 7) & PROCESS JOURNEY (SLIDE 3) INITIALIZATION
// ======================================================================
const clientsSection = document.getElementById('slide-7');
if (clientsSection) {
  const clientObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        clientsSection.classList.add('in-view');
        document.querySelectorAll('.client-grid-item').forEach(item => {
          item.classList.add('revealed');
        });
      }
    });
  }, { threshold: 0.2 });
  clientObserver.observe(clientsSection);
}

// Initialize Slide 3 process stage controls & sync to step 1
if (typeof initProcessControls === 'function') {
  initProcessControls();
  setProcessStep(1);
}

console.log('Tender Wonder native website experience running.');
