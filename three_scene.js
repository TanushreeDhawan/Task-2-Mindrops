const canvas = document.getElementById('ink-canvas');
const clock = new THREE.Clock();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);

const rig = new THREE.Group();
scene.add(rig);

// LIGHTING SETUP
const key = new THREE.DirectionalLight(0xbfe9ff, 3.2);
key.position.set(3, 8, 4);
scene.add(key);

const rimLight = new THREE.DirectionalLight(0x00d4ff, 2.2);
rimLight.position.set(-4, 5, -3);
scene.add(rimLight);

// Soft bottom bounce light to illuminate droplet lower half
const bottomFillLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
bottomFillLight.position.set(0, -6, 3);
scene.add(bottomFillLight);

scene.add(new THREE.AmbientLight(0x133b63, 2.6));

function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  const wide = w > 860;
  camera.position.set(wide ? -0.8 : 0, wide ? 3.6 : 3.2, wide ? 5.8 : 6.8);
  camera.lookAt(wide ? 1.5 : 0, wide ? -0.2 : -0.1, 0);
  rig.position.y = wide ? -0.4 : -0.2;
}

// LIQUID PLANE
const PLANE_SIZE = 14;
const SEGMENTS = 200;
const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, SEGMENTS, SEGMENTS);
planeGeo.rotateX(-Math.PI / 2);

const MAX_DROPS = 12;
const uniforms = {
  uTime:       { value: 0 },
  uDropTime:   { value: new Array(MAX_DROPS).fill(-1) },
  uDropOrigin: { value: new Array(MAX_DROPS).fill(0).map(() => new THREE.Vector2()) },
  uDropAmp:    { value: new Array(MAX_DROPS).fill(0.1) },
  uColorDeep:  { value: new THREE.Color(0x030d1c) },
  uColorMid:   { value: new THREE.Color(0x006ba6) },
  uColorRim:   { value: new THREE.Color(0x8ff2ff) },
};

const HEIGHT_GLSL = `
  uniform float uTime;
  uniform float uDropTime[${MAX_DROPS}];
  uniform vec2  uDropOrigin[${MAX_DROPS}];
  uniform float uDropAmp[${MAX_DROPS}];

  float heightAt(vec2 p){
    float h = 0.0;
    for(int i = 0; i < ${MAX_DROPS}; i++){
      float startT = uDropTime[i];
      float age = uTime - startT;
      if(startT > 0.0 && age >= 0.0 && age < 7.0){
        float d = distance(p, uDropOrigin[i]);
        float speed = 2.4;
        float wavefront = age * speed;
        float ring = sin(d * 5.0 - age * 5.5) * exp(-pow(d - wavefront, 2.0) * 1.2);
        float distanceFalloff = 1.0 / (1.0 + d * 0.8);
        float ageFalloff = exp(-age * 0.5);
        h += ring * distanceFalloff * ageFalloff * uDropAmp[i];
      }
    }
    h += sin(p.x * 0.6 + uTime * 0.4) * cos(p.y * 0.5 - uTime * 0.3) * 0.015;
    return h;
  }
`;

const planeMaterial = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  vertexShader: `
    ${HEIGHT_GLSL}
    varying vec3 vNormal;
    varying vec3 vViewPos;
    varying float vHeight;

    void main(){
      vec3 pos = position;
      float h = heightAt(pos.xz);

      float eps = 0.08;
      float hX = heightAt(pos.xz + vec2(eps, 0.0));
      float hZ = heightAt(pos.xz + vec2(0.0, eps));
      vec3 tangentX = vec3(eps, hX - h, 0.0);
      vec3 tangentZ = vec3(0.0, hZ - h, eps);
      vec3 n = normalize(cross(tangentZ, tangentX));

      pos.y += h;
      vHeight = h;
      vNormal = normalize(normalMatrix * n);
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      vViewPos = mv.xyz;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform vec3 uColorDeep;
    uniform vec3 uColorMid;
    uniform vec3 uColorRim;
    varying vec3 vNormal;
    varying vec3 vViewPos;
    varying float vHeight;

    void main(){
      vec3 viewDir = normalize(-vViewPos);
      vec3 lightDir = normalize(vec3(0.4, 1.0, 0.5));

      float diff = max(dot(vNormal, lightDir), 0.0);
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(vNormal, halfDir), 0.0), 70.0);

      float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

      vec3 base = mix(uColorDeep, uColorMid, clamp(vHeight * 6.0 + 0.3, 0.0, 1.0));
      vec3 color = base + diff * 0.15 * uColorRim;
      color += spec * uColorRim * 1.6;
      color = mix(color, uColorRim, fresnel * 0.4);

      float alpha = clamp(0.75 + fresnel * 0.25, 0.0, 1.0);
      gl_FragColor = vec4(color, alpha);
    }
  `
});

const pond = new THREE.Mesh(planeGeo, planeMaterial);
rig.add(pond);

// UPGRADED 3X SCALED TEARDROP GEOMETRY
const points = [];
for (let i = 0; i <= 36; i++) {
  const t = i / 36; // 0 to 1
  const y = -Math.cos(t * Math.PI); // -1 to 1
  let r = Math.sin(t * Math.PI);
  if (y > 0) {
    r *= Math.pow(1 - y, 1.4); // Taper sharp top tip
  }
  // Scaled ~2.8x larger
  points.push(new THREE.Vector2(r * 0.38, y * 0.55));
}
const dropletGeo = new THREE.LatheGeometry(points, 48);

const dropletMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x0088cc,              // Deeper blue base color (matches original GLB tone)
  transmission: 0.35,           // Lowered significantly so it looks semi-solid, not a ghost
  opacity: 0.92,                // Slightly transparent body
  transparent: true,
  roughness: 0.1,               // Smooth finish with clean highlights
  metalness: 0.1,               // Subtle depth
  ior: 1.33,                    // Clean water refraction
  thickness: 1.2,               // Gives it volume and richness inside
  emissive: 0x004477,          // Subtle deep blue glow to keep shadows colorful
  emissiveIntensity: 0.3,       
  clearcoat: 1.0,               // High gloss surface sheen
  clearcoatRoughness: 0.05,
  reflectivity: 1.0
});

/*
// HIGH-GLOSS TRANSLUCENT GLASS MATERIAL WITH EMISSIVE GLOW (OPTIMIZED COLOR & LIGHTING)
const dropletMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x88e5ff,              // Lighter, softer cyan-blue (blends naturally with background)
  transmission: 0.95,           // Keeps high transparency while catching surrounding colors
  opacity: 1,
  transparent: true,
  roughness: 0.05,             // Slight roughness to spread highlights evenly down to the bottom
  metalness: 0.0,              // Reduced to 0 to eliminate unwanted dark shadows/reflections
  ior: 1.33,                   // True water refraction index (prevents heavy dark edge bending)
  thickness: 0.4,              // Thinner depth to stop light from getting trapped at the bottom
  emissive: 0x1ac6ff,          // Soft cyan glow instead of intense neon
  emissiveIntensity: 0.2,      // Lowered so it illuminates the shadow without washing out glass details
  clearcoat: 1.0,
  clearcoatRoughness: 0.02,
  reflectivity: 0.9
}); */

const droplet = new THREE.Mesh(dropletGeo, dropletMaterial);
rig.add(droplet);

// INNER GLOWING CORE & POINT LIGHT ATTACHED TO DROPLET
const innerCoreGeo = new THREE.SphereGeometry(0.25, 24, 24);
const innerCoreMat = new THREE.MeshBasicMaterial({
  color: 0x73f3ff,
  transparent: true,
  opacity: 0.65
});
const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
droplet.add(innerCore);

// Slightly softer intensity, but wider distance to light up the bottom half evenly
const dropLight = new THREE.PointLight(0x73f3ff, 2.5, 8.0);
droplet.add(dropLight);

// SOFT CIRCULAR PARTICLE TEXTURE (Prevents square pixels)
function createCircularParticleTexture() {
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 64;
  pCanvas.height = 64;
  const ctx = pCanvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.3, 'rgba(143, 242, 255, 0.8)');
  grad.addColorStop(0.7, 'rgba(0, 212, 255, 0.2)');
  grad.addColorStop(1, 'rgba(0, 212, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(pCanvas);
}

// PARTICLE SPLASH SYSTEM (35 Micro-Droplets)
const PARTICLE_COUNT = 35;
const splashGeo = new THREE.BufferGeometry();
const splashPositions = new Float32Array(PARTICLE_COUNT * 3);
const splashVelocities = [];

for (let i = 0; i < PARTICLE_COUNT; i++) {
  splashPositions[i * 3 + 0] = 0;
  splashPositions[i * 3 + 1] = 0;
  splashPositions[i * 3 + 2] = 0;

  // Radial cone velocity
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.8 + Math.random() * 1.5;
  const upSpeed = 1.2 + Math.random() * 2.0;
  splashVelocities.push(new THREE.Vector3(
    Math.cos(angle) * speed,
    upSpeed,
    Math.sin(angle) * speed
  ));
}

splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));

const splashMat = new THREE.PointsMaterial({
  color: 0x8ff2ff,
  size: 0.16,
  map: createCircularParticleTexture(),
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const splashParticles = new THREE.Points(splashGeo, splashMat);
splashParticles.position.set(1.5, 0.05, 0.5); // Align with drop impact point

// ==============================================================================
// GLB MATERIAL CONFIGURATION TOGGLE
// Set to TRUE to use the EXACT original textures & materials from your droplet.glb!
// Set to FALSE to override with our custom cyan glowing glass shader.
const USE_GLB_ORIGINAL_TEXTURES = false;
// ==============================================================================

// BASE64 ARRAY BUFFER CONVERTER (Bypasses local file:// CORS restrictions)
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// HELPER TO LOAD & SETUP CUSTOM .GLB DROP MODEL
let customGLBDrop = null;
function setupGLBModel(gltf) {
  customGLBDrop = gltf.scene;
  
  // Auto-center & scale GLB model to fit scene
  const box = new THREE.Box3().setFromObject(customGLBDrop);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  
  const maxDim = Math.max(size.x, size.y, size.z);
  const scaleFactor = maxDim > 0 ? (1.5 / maxDim) : 1.0;
  
  customGLBDrop.scale.set(scaleFactor, scaleFactor, scaleFactor);
  customGLBDrop.position.sub(center.clone().multiplyScalar(scaleFactor));
  
  // Material Handling
  customGLBDrop.traverse((child) => {
    if (child.isMesh) {
      if (!USE_GLB_ORIGINAL_TEXTURES) {
        child.material = dropletMaterial;
      }
    }
  });

  // Attach inner core glow & light only if using custom shader
  if (!USE_GLB_ORIGINAL_TEXTURES) {
    const glbCore = innerCore.clone();
    const glbLight = dropLight.clone();
    customGLBDrop.add(glbCore);
    customGLBDrop.add(glbLight);
  }

  // Hide fallback procedural drop
  droplet.visible = false;
  
  rig.add(customGLBDrop);
  console.log('Custom GLB drop loaded & rendered successfully!');
}

function initGLBDrop() {
  if (typeof THREE.GLTFLoader === 'undefined') return;
  const loader = new THREE.GLTFLoader();

  // 1. Try embedded Base64 data (Bypasses browser local file:// CORS restrictions when double-clicking index.html!)
  if (window.DROPLET_GLB_BASE64) {
    try {
      const buffer = base64ToArrayBuffer(window.DROPLET_GLB_BASE64);
      loader.parse(buffer, '', (gltf) => {
        setupGLBModel(gltf);
      });
      return;
    } catch(e) {
      console.warn('Base64 GLB parse fallback:', e);
    }
  }

  // 2. Fallback to standard URL load if running on local server
  loader.load('droplet.glb', (gltf) => {
    setupGLBModel(gltf);
  });
}

initGLBDrop();
splashParticles.visible = false;
rig.add(splashParticles);

// DROPLET POSITION & STATE
const DROP_START_Y = 4.5;
const DROP_X = 2; // Right-mid space
const DROP_Z = 0.5;
let splashTriggered = false;

let dropCursor = 0;
function spawnDrop(x, z, amp) {
  uniforms.uDropTime.value[dropCursor] = clock.getElapsedTime();
  uniforms.uDropOrigin.value[dropCursor].set(x, z);
  uniforms.uDropAmp.value[dropCursor] = amp;
  dropCursor = (dropCursor + 1) % MAX_DROPS;
}

// SCROLL PROGRESS CALCULATOR (320vh Track)
const heroTrack = document.querySelector('.hero-track');
function getScrollProgress() {
  if (!heroTrack) return 0;
  const rect = heroTrack.getBoundingClientRect();
  const totalScrollable = rect.height - window.innerHeight;
  if (totalScrollable <= 0) return 0;
  const currentScroll = -rect.top;
  return Math.min(Math.max(currentScroll / totalScrollable, 0), 1);
}

// GRADIENT COLOR PALETTES FOR TRANSITION
const deepStart = new THREE.Color(0x030d1c);
const deepMid   = new THREE.Color(0x002d4a);
const deepEnd   = new THREE.Color(0x005c8a);

const midStart  = new THREE.Color(0x006ba6);
const midMid    = new THREE.Color(0x0088cc);
const midEnd    = new THREE.Color(0x00a8e8);

layout();
window.addEventListener('resize', layout);

function animate() {
  const t = clock.getElapsedTime();
  uniforms.uTime.value = t;

  const scrollProgress = getScrollProgress();

  // Dynamic Color Shift based on Scroll Progress
  uniforms.uColorDeep.value.lerpColors(deepStart, deepEnd, scrollProgress);
  uniforms.uColorMid.value.lerpColors(midStart, midEnd, scrollProgress);

  // Droplet position mapping:
  // scrollProgress 0.0 -> 0.70 : Droplet falls from 4.5 down to 0.05
  const IMPACT_PROGRESS = 0.70;
  let dropY = DROP_START_Y;

  if (scrollProgress <= IMPACT_PROGRESS) {
    const fallRatio = scrollProgress / IMPACT_PROGRESS;
    dropY = DROP_START_Y * (1.0 - fallRatio) + 0.05;
  } else {
    dropY = 0.05;
  }

  // Droplet Opacity & Visibility
  if (scrollProgress >= IMPACT_PROGRESS) {
    droplet.visible = false;
    if (customGLBDrop) customGLBDrop.visible = false;
    
    // Trigger Ripple Impact
    if (!splashTriggered) {
      spawnDrop(DROP_X, DROP_Z, 0.40);
      splashTriggered = true;
    }

    // Animate Splash Particles on Impact
    splashParticles.visible = true;
    const splashAge = (scrollProgress - IMPACT_PROGRESS) / (1.0 - IMPACT_PROGRESS); // 0 to 1
    const posAttr = splashGeo.attributes.position;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const vel = splashVelocities[i];
      // Gravity effect
      const py = Math.max(0, vel.y * splashAge * 1.8 - 0.5 * 9.8 * splashAge * splashAge * 0.3);
      posAttr.setXYZ(
        i,
        vel.x * splashAge * 1.5,
        py,
        vel.z * splashAge * 1.5
      );
    }
    posAttr.needsUpdate = true;
    splashMat.opacity = Math.max(0, 1.0 - splashAge * 1.1);

  } else {
    if (customGLBDrop) {
      customGLBDrop.visible = true;
      droplet.visible = false;
    } else {
      droplet.visible = true;
    }
    
    splashParticles.visible = false;
    splashTriggered = false; // Reset trigger so scrolling up re-arms the splash!
    
    // Fade opacity slightly right before impact
    const proximity = Math.min(1.0, dropY / 1.0);
    dropletMaterial.opacity = 0.4 + 0.6 * proximity;
  }

  // Hover bobbing animation when hanging in air
  let hoverY = dropY + Math.sin(t * 2.2) * 0.06;
  const finalDropPos = new THREE.Vector3(DROP_X, Math.max(hoverY, 0.05), DROP_Z);
  
  droplet.position.copy(finalDropPos);
  droplet.rotation.y = t * 0.4;

  if (customGLBDrop) {
    customGLBDrop.position.copy(finalDropPos);
    customGLBDrop.rotation.y = t * 0.4;
  }

  // Gentle ambient sway of rig
  rig.rotation.y = Math.sin(t * 0.08) * 0.02;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Pointer Click Ripple Interaction
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(0, 0);
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointerNDC, camera);
  const hit = raycaster.intersectObject(pond, false)[0];
  if (hit) spawnDrop(hit.point.x, hit.point.z, 0.22);
});
