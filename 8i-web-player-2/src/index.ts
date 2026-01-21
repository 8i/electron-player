import * as THREE from "three";
import { DashPlayer } from "./DashPlayer";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { DashPlayerWebGLImplementation } from "./implementations/WebGLImplementation";
import { fileLogger } from "./classes/FileLogger";

// Load manifest URL from query parameters
// Example: http://localhost:1234/?contentPort=8888&manifest=seanalexv3r3off_S01_T03_v07_local/manifest.mpd
function getManifestUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const contentPort = params.get('contentPort') || '8888';
  const manifestPath = params.get('manifest');

  // If manifest param provided, use local server
  if (manifestPath) {
    // Use 127.0.0.1 for file:// protocol (Electron) or current hostname for http://
    const hostname = window.location.hostname || '127.0.0.1';
    console.log(`[MeshViewer] Loading manifest from http://${hostname}:${contentPort}/${manifestPath}`);
    return `http://${hostname}:${contentPort}/${manifestPath}`;
  }

  // Fallback to default CDN URL
  return "https://dash-cdn.8i.com/31/shows/175/takes/842/manifest.mpd";
}

const manifestUrl = getManifestUrl();

// Editor state
interface EditorState {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  scale: number;
}

const state: EditorState = {
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  positionX: 0,
  positionY: -0.75,
  positionZ: 0,
  scale: 0.01
};

let player: DashPlayer = null;
let implementation: DashPlayerWebGLImplementation = null;

let scene: THREE.Scene = null
let renderer: THREE.WebGLRenderer = null;
let camera: THREE.PerspectiveCamera = null;
let controls: OrbitControls = null;
let gridHelper: THREE.GridHelper = null;

// Create UI
function createUI() {
  // Add global styles first
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    canvas {
      z-index: 1;
    }
    #debug-toggle {
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      z-index: 10000;
      transition: background 0.2s;
      pointer-events: auto;
    }
    #debug-toggle:hover { background: rgba(0,0,0,0.9); }
    #editor-controls {
      position: fixed;
      top: 70px;
      left: 20px;
      background: rgba(0,0,0,0.9);
      padding: 20px;
      border-radius: 12px;
      width: 340px;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #eee;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      display: none;
      pointer-events: auto;
    }
    #editor-controls.visible {
      display: block;
    }
  `;
  document.head.appendChild(styleEl);
  console.log('[UI] Styles added to head');

  const container = document.createElement('div');
  container.id = 'editor-controls';
  container.innerHTML = `
    <style>
      #editor-controls h2 {
        margin: 0 0 15px 0;
        font-size: 18px;
        border-bottom: 1px solid #444;
        padding-bottom: 10px;
      }
      .control-group {
        margin-bottom: 16px;
      }
      .control-group label {
        display: block;
        margin-bottom: 6px;
        font-size: 11px;
        color: #aaa;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .axis-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .axis-label {
        width: 20px;
        font-weight: bold;
        font-size: 12px;
      }
      .axis-label.x { color: #ef4444; }
      .axis-label.y { color: #22c55e; }
      .axis-label.z { color: #3b82f6; }
      .axis-slider {
        flex: 1;
        margin: 0;
      }
      .axis-value {
        width: 60px;
        font-size: 11px;
        color: #6ee7b7;
        font-family: monospace;
        text-align: right;
      }
      .btn-row { display: flex; gap: 6px; flex-wrap: wrap; }
      .editor-btn {
        background: #3a3a5c;
        border: none;
        color: white;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      }
      .editor-btn:hover { background: #4a4a7c; }
      .editor-btn.primary { background: #2563eb; }
      .editor-btn.primary:hover { background: #3b82f6; }
      .editor-btn.small { padding: 4px 8px; font-size: 11px; }
      .editor-slider {
        width: 100%;
        margin: 8px 0;
      }
      .value-display {
        font-size: 12px;
        color: #6ee7b7;
        font-family: monospace;
        margin-top: 4px;
      }
      #editor-status {
        margin-top: 15px;
        padding: 10px;
        background: rgba(255,255,255,0.05);
        border-radius: 6px;
        font-size: 12px;
      }
      .preset-row {
        display: flex;
        gap: 4px;
        margin-top: 6px;
      }
    </style>

    <h2>Mesh Transform Editor</h2>

    <!-- ROTATION -->
    <div class="control-group">
      <label>Rotation (degrees)</label>

      <div class="axis-row">
        <span class="axis-label x">X</span>
        <input type="range" class="axis-slider" id="rot-x-slider" min="-180" max="180" step="1" value="0">
        <span class="axis-value" id="rot-x-value">0°</span>
      </div>
      <div class="preset-row">
        <button class="editor-btn small" data-rot-x="0">0°</button>
        <button class="editor-btn small" data-rot-x="90">90°</button>
        <button class="editor-btn small" data-rot-x="-90">-90°</button>
        <button class="editor-btn small" data-rot-x="180">180°</button>
      </div>

      <div class="axis-row" style="margin-top: 10px;">
        <span class="axis-label y">Y</span>
        <input type="range" class="axis-slider" id="rot-y-slider" min="-180" max="180" step="1" value="0">
        <span class="axis-value" id="rot-y-value">0°</span>
      </div>
      <div class="preset-row">
        <button class="editor-btn small" data-rot-y="0">0°</button>
        <button class="editor-btn small" data-rot-y="90">90°</button>
        <button class="editor-btn small" data-rot-y="-90">-90°</button>
        <button class="editor-btn small" data-rot-y="180">180°</button>
      </div>

      <div class="axis-row" style="margin-top: 10px;">
        <span class="axis-label z">Z</span>
        <input type="range" class="axis-slider" id="rot-z-slider" min="-180" max="180" step="1" value="0">
        <span class="axis-value" id="rot-z-value">0°</span>
      </div>
      <div class="preset-row">
        <button class="editor-btn small" data-rot-z="0">0°</button>
        <button class="editor-btn small" data-rot-z="90">90°</button>
        <button class="editor-btn small" data-rot-z="-90">-90°</button>
        <button class="editor-btn small" data-rot-z="180">180°</button>
      </div>
    </div>

    <!-- POSITION -->
    <div class="control-group">
      <label>Position</label>

      <div class="axis-row">
        <span class="axis-label x">X</span>
        <input type="range" class="axis-slider" id="pos-x-slider" min="-5" max="5" step="0.01" value="0">
        <span class="axis-value" id="pos-x-value">0.00</span>
      </div>

      <div class="axis-row">
        <span class="axis-label y">Y</span>
        <input type="range" class="axis-slider" id="pos-y-slider" min="-5" max="5" step="0.01" value="-0.75">
        <span class="axis-value" id="pos-y-value">-0.75</span>
      </div>

      <div class="axis-row">
        <span class="axis-label z">Z</span>
        <input type="range" class="axis-slider" id="pos-z-slider" min="-5" max="5" step="0.01" value="0">
        <span class="axis-value" id="pos-z-value">0.00</span>
      </div>

      <div class="btn-row" style="margin-top: 8px;">
        <button class="editor-btn small" id="reset-position">Reset Position</button>
      </div>
    </div>

    <!-- SCALE -->
    <div class="control-group">
      <label>Scale</label>
      <input type="range" class="editor-slider" id="scale-slider"
             min="0.001" max="0.1" step="0.001" value="0.01">
      <div class="value-display">Scale: <span id="scale-value">0.010</span></div>
    </div>

    <!-- PLAYBACK -->
    <div class="control-group">
      <label>Playback</label>
      <div class="btn-row">
        <button class="editor-btn" id="play-btn">▶ Play</button>
        <button class="editor-btn" id="pause-btn">⏸ Pause</button>
        <button class="editor-btn" id="seek-start">⏮ Start</button>
      </div>
    </div>

    <!-- DEBUG -->
    <div class="control-group">
      <label>Debug</label>
      <div class="btn-row">
        <button class="editor-btn" id="download-logs-btn">📥 Download Logs</button>
        <button class="editor-btn small" id="clear-logs-btn">Clear</button>
      </div>
      <div class="value-display">Log entries: <span id="log-count">0</span></div>
    </div>

    <div id="editor-status">Loading...</div>
  `;

  // Create debug toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'debug-toggle';
  toggleBtn.textContent = 'Debug Panel';
  toggleBtn.addEventListener('click', () => {
    console.log('[UI] Debug toggle clicked');
    container.classList.toggle('visible');
    toggleBtn.textContent = container.classList.contains('visible') ? 'Hide Panel' : 'Debug Panel';
  });

  document.body.appendChild(toggleBtn);
  document.body.appendChild(container);
  console.log('[UI] Debug toggle button added to body');
}

function setupUIControls() {
  // Rotation X presets and slider
  document.querySelectorAll('[data-rot-x]').forEach(btn => {
    btn.addEventListener('click', () => {
      const degrees = parseInt((btn as HTMLElement).dataset.rotX);
      setRotation('x', degrees);
      (document.getElementById('rot-x-slider') as HTMLInputElement).value = String(degrees);
    });
  });
  const rotXSlider = document.getElementById('rot-x-slider') as HTMLInputElement;
  rotXSlider.addEventListener('input', () => {
    setRotation('x', parseFloat(rotXSlider.value));
  });

  // Rotation Y presets and slider
  document.querySelectorAll('[data-rot-y]').forEach(btn => {
    btn.addEventListener('click', () => {
      const degrees = parseInt((btn as HTMLElement).dataset.rotY);
      setRotation('y', degrees);
      (document.getElementById('rot-y-slider') as HTMLInputElement).value = String(degrees);
    });
  });
  const rotYSlider = document.getElementById('rot-y-slider') as HTMLInputElement;
  rotYSlider.addEventListener('input', () => {
    setRotation('y', parseFloat(rotYSlider.value));
  });

  // Rotation Z presets and slider
  document.querySelectorAll('[data-rot-z]').forEach(btn => {
    btn.addEventListener('click', () => {
      const degrees = parseInt((btn as HTMLElement).dataset.rotZ);
      setRotation('z', degrees);
      (document.getElementById('rot-z-slider') as HTMLInputElement).value = String(degrees);
    });
  });
  const rotZSlider = document.getElementById('rot-z-slider') as HTMLInputElement;
  rotZSlider.addEventListener('input', () => {
    setRotation('z', parseFloat(rotZSlider.value));
  });

  // Position sliders
  const posXSlider = document.getElementById('pos-x-slider') as HTMLInputElement;
  posXSlider.addEventListener('input', () => {
    state.positionX = parseFloat(posXSlider.value);
    document.getElementById('pos-x-value').textContent = state.positionX.toFixed(2);
    updateMeshTransform();
  });

  const posYSlider = document.getElementById('pos-y-slider') as HTMLInputElement;
  posYSlider.addEventListener('input', () => {
    state.positionY = parseFloat(posYSlider.value);
    document.getElementById('pos-y-value').textContent = state.positionY.toFixed(2);
    updateMeshTransform();
  });

  const posZSlider = document.getElementById('pos-z-slider') as HTMLInputElement;
  posZSlider.addEventListener('input', () => {
    state.positionZ = parseFloat(posZSlider.value);
    document.getElementById('pos-z-value').textContent = state.positionZ.toFixed(2);
    updateMeshTransform();
  });

  // Reset position button
  document.getElementById('reset-position').addEventListener('click', () => {
    state.positionX = 0;
    state.positionY = 0;
    state.positionZ = 0;
    (document.getElementById('pos-x-slider') as HTMLInputElement).value = '0';
    (document.getElementById('pos-y-slider') as HTMLInputElement).value = '0';
    (document.getElementById('pos-z-slider') as HTMLInputElement).value = '0';
    document.getElementById('pos-x-value').textContent = '0.00';
    document.getElementById('pos-y-value').textContent = '0.00';
    document.getElementById('pos-z-value').textContent = '0.00';
    updateMeshTransform();
    setStatus('Position reset to origin');
  });

  // Scale slider
  const scaleSlider = document.getElementById('scale-slider') as HTMLInputElement;
  scaleSlider.addEventListener('input', () => {
    state.scale = parseFloat(scaleSlider.value);
    document.getElementById('scale-value').textContent = state.scale.toFixed(3);
    updateMeshTransform();
  });

  // Playback controls
  document.getElementById('play-btn').addEventListener('click', () => {
    if (player?.play) {
      player.play();
      setStatus('Playing');
    }
  });

  document.getElementById('pause-btn').addEventListener('click', () => {
    if (player?.pause) {
      player.pause();
      setStatus('Paused');
    }
  });

  document.getElementById('seek-start').addEventListener('click', async () => {
    if (player?.seek) {
      setStatus('Seeking to start...');
      try {
        await player.seek(0);
        setStatus('Seeked to start');
      } catch (error) {
        setStatus(`Seek failed: ${error.message}`);
      }
    }
  });

  // Debug controls
  document.getElementById('download-logs-btn').addEventListener('click', () => {
    fileLogger.downloadLogs();
    setStatus(`Downloaded ${fileLogger.getLogCount()} log entries`);
  });

  document.getElementById('clear-logs-btn').addEventListener('click', () => {
    fileLogger.clear();
    updateLogCount();
    setStatus('Logs cleared');
  });

  // Update log count periodically
  setInterval(updateLogCount, 1000);
}

function updateLogCount() {
  const countEl = document.getElementById('log-count');
  if (countEl) {
    countEl.textContent = String(fileLogger.getLogCount());
  }
}

function setRotation(axis: 'x' | 'y' | 'z', degrees: number) {
  switch (axis) {
    case 'x':
      state.rotationX = degrees;
      document.getElementById('rot-x-value').textContent = `${degrees}°`;
      break;
    case 'y':
      state.rotationY = degrees;
      document.getElementById('rot-y-value').textContent = `${degrees}°`;
      break;
    case 'z':
      state.rotationZ = degrees;
      document.getElementById('rot-z-value').textContent = `${degrees}°`;
      break;
  }
  updateMeshTransform();
  setStatus(`Rotation: X=${state.rotationX}° Y=${state.rotationY}° Z=${state.rotationZ}°`);
}

function updateMeshTransform() {
  if (player?.mesh) {
    player.mesh.rotation.x = THREE.MathUtils.degToRad(state.rotationX);
    player.mesh.rotation.y = THREE.MathUtils.degToRad(state.rotationY);
    player.mesh.rotation.z = THREE.MathUtils.degToRad(state.rotationZ);
    player.mesh.position.x = state.positionX;
    player.mesh.position.y = state.positionY;
    player.mesh.position.z = state.positionZ;
    player.mesh.scale.set(state.scale, state.scale, state.scale);
  }

  if (gridHelper) {
    gridHelper.position.y = state.positionY;
  }
}

function setStatus(message: string) {
  const statusEl = document.getElementById('editor-status');
  if (statusEl) {
    statusEl.textContent = message;
  }
}

const initialize = async () => {
  // Create UI first
  createUI();

  // Create a basic THREE.JS scene.
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  document.body.style.margin = "0";

  // Set up the initial camera position to match the volumetric video.
  camera.position.z = 2;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  implementation = new DashPlayerWebGLImplementation();

  player = new DashPlayer(renderer, implementation, {
    muted: true,
    autoplay: false,
    enableDirectionalLight: true,
    opacity: 1.0,
    contrast: 0.95,
    targetFPS: 60,
  });

  // Add default light sources
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  // Grid helper for floor visualization
  gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
  gridHelper.position.y = state.positionY;
  scene.add(gridHelper);

  scene.add(player.mesh);

  // Apply initial transforms from state
  updateMeshTransform();

  // Setup UI controls
  setupUIControls();

  fn();
};

const fn = async () => {
  setStatus('Loading manifest...');

  await player.loadManifest(manifestUrl);

  // Store reference to player on `window` object for debugging purposes.
  (window as any).dashPlayer = player;
  (window as any).editorState = state;

  setStatus('Ready - click to play');

  const onResize = () => {
    const { innerWidth, innerHeight, devicePixelRatio } = window;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setSize(innerWidth, innerHeight);
  };

  const animate = (ts: number) => {
    player.update(ts);
    controls.update();
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  };

  window.requestAnimationFrame(onResize);
  window.requestAnimationFrame(animate);

  window.addEventListener("resize", onResize);

  const onBodyClick = () => {
    player.play();
    player.setIsMuted(false);
    setStatus('Playing');
    document.body.removeEventListener("click", onBodyClick);
  };

  document.body.addEventListener("click", onBodyClick);
};

document.addEventListener("DOMContentLoaded", initialize);
