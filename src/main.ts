/**
 * \file main.ts
 * \brief 
 *
 * \author Stanley Arnaud
 * \date 2026-11-10
 */

import "./style.css"

import font from "./assets/fonts/LiberationSerif.woff"
import bgImg from "./assets/os.webp"
import cursorCursorImg from "./assets/Cursor79.webp"
import cursorPointerImg from "./assets/Cursor107.webp"

import crtVertShader from './shaders/crt.vert.glsl?raw';
import crtFragShader from './shaders/crt.frag.glsl?raw';

import * as THREE from 'three';
import { EffectComposer, OutputPass, RenderPass, ShaderPass, UnrealBloomPass } from "three/examples/jsm/Addons.js";

import { WindowViewport } from "./WindowViewport.ts";
import Home from "./views/Home";
import type { AppContext } from "./AppContext";
import Project from "./views/Project";
import { type View } from "./views/View.ts"

const assetsUrl = import.meta.env.VITE_ASSETS_URL;

type Manifest = Record<string, string>;
let manifestPromise: Promise<Manifest | null> | null = null;

const getManifest = (): Promise<Manifest | null> => {
    if (manifestPromise === null) {
        manifestPromise = fetch(`${assetsUrl}/manifest.json`)
            .then(async (res) => {
                if (!res.ok) {
                    console.warn(`Failed to get manifest: ${res.status}`);
                    return null;
                }

                return await res.json() as Manifest;
            })
            .catch((error) => {
                console.warn("Failed to get manifest:", error);
                return null;
            });
    }

    return manifestPromise;
};

const getAssetUrl = async (path: string): Promise<string | null> => {
    const manifest = await getManifest();

    if (!manifest) {
        return null;
    }

    const assetPath = manifest[path];

    if (!assetPath) {
        console.warn(`Asset not found in manifest: ${path}`);
        return null;
    }

    return `${assetsUrl}/${assetPath}`;
};

let width = 1;
let height = 1;

const renderer = new THREE.WebGLRenderer({
    antialias: false,
    stencil: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 0.95;

const app = document.querySelector("#app")!;
app.appendChild(renderer.domElement);

const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: true,
});
const composer = new EffectComposer(renderer, renderTarget);
const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0, 1);
camera.position.z = 1;

/* Render passes */
const crtPass = new ShaderPass({
    uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2() },
        uTime: { value: 0 },
        uCurvature: { value: 1.0 },
        uScanSpeed: { value: 2.0 },
    },
    vertexShader: crtVertShader,
    fragmentShader: crtFragShader
});

const bloomCfg = {
    strength: 0.01,
    radius: 0.02,
    threshold: 0.10,

    // Flicker
    flickerSpeed: 7.0,

    strengthFlicker: 0.008,
    radiusFlicker: 0.004,
    thresholdFlicker: 0.01,
};

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    bloomCfg.strength,
    bloomCfg.radius,
    bloomCfg.threshold
);

composer.addPass(new RenderPass(scene, camera));
composer.addPass(crtPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

/* Meshes */
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 1.0, 0.0,
]), 3));
geometry.setIndex([0, 1, 2, 2, 1, 3]);
geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
    0.0, 1.0,
    0.0, 0.0,
    1.0, 1.0,
    1.0, 0.0,
]), 2));

const bg = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
scene.add(bg);

const backBtn = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: "#D4D0C8", opacity: 1, transparent: true, side: THREE.DoubleSide }));
backBtn.position.z = 0.2;
backBtn.userData.href = "/";
backBtn.userData.clickable = false;
scene.add(backBtn);

let cursorTexCursor: THREE.Texture | null = null;
let cursorTexPointer: THREE.Texture | null = null;
const cursor = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ alphaTest: 0.5 }));
cursor.position.z = 0.9;
scene.add(cursor);

const viewport = new WindowViewport({
    geometry,
    stencilRef: 1,
    renderOrder: 10,
});

scene.add(viewport);

let cursorType: "pointer" | "cursor" | null = null;

const updateCursor = () => {
    let relOffsetX = 0;

    if ((cursorType == "cursor" || cursorType === null) && onClickCb !== null) {
        cursor.material.map = cursorTexPointer;
        cursor.material.needsUpdate = true;
        relOffsetX = 0.2;
        layoutDirty = true;
        cursorType = "pointer";
    } else if ((cursorType == "pointer" || cursorType === null) && onClickCb === null) {
        layoutDirty = true;
        cursor.material.map = cursorTexCursor;
        cursor.material.needsUpdate = true;
        cursorType = "cursor";
    }

    cursor.position.set(pointer.x, pointer.y);
}

const texLoader = new THREE.TextureLoader();
texLoader.load(bgImg, (tex) => {
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    bg.material.map = tex;
    layoutDirty = true;
    bg.material.needsUpdate = true;
});

texLoader.load(cursorCursorImg, (tex) => {
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    cursorTexCursor = tex;
});

texLoader.load(cursorPointerImg, (tex) => {
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    cursorTexPointer = tex;
});

let layoutDirty = true;

const appCtx: AppContext = {
    fonts: {
        serif: font
    },
    textureLoader: texLoader,
    geometry: geometry,
    getAssetUrl: getAssetUrl,
};

let currentView: View | null = null;
const changeView = (newView: View, dispose = true) => {
    if (dispose && currentView)
        currentView.dispose();
    currentView = newView;
    currentView.layout(width, height);
    currentView.mount(viewport);
    layoutDirty = true;
}

const home = new Home(appCtx);
changeView(home);

/* Resize, Event listeners, Render functions */

const resize = () => {
    width = app.clientWidth;
    height = app.clientHeight;

    camera.top = 0;
    camera.right = width;
    camera.left = 0;
    camera.bottom = height;
    camera.updateProjectionMatrix();

    viewport.setPosition(0.107 * width, 0.243 * height);
    viewport.setSize(0.839 * width, 0.62 * height);

    /* Scene objects resizing */
    currentView?.layout(viewport.width, viewport.height);

    bg.scale.set(width, height);

    backBtn.scale.set(0.08 * width, 0.045 * height);
    backBtn.position.set(0.118 * width, 0.132 * height);

    if (cursor.material.map) {
        const tex = cursor.material.map as THREE.Texture<HTMLImageElement>;
        const aspect = tex.image.height / tex.image.width;
        const cursorHeight = 0.03 * height;
        cursor.scale.set(cursorHeight / aspect, cursorHeight);
    }

    crtPass.uniforms.uResolution.value.set(width, height);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
}

window.addEventListener('resize', resize);

let scrollY = 0;

function setScroll(y: number): void {
    if (viewport.contentHeight < viewport.height) return;
    scrollY = THREE.MathUtils.clamp(y, 0, viewport.contentHeight - viewport.height);
    viewport.setScroll(0, scrollY);
}

const curveUV = (x: number, y: number, curvature: number) => {
    const originalX = x;
    const originalY = y;

    // uv = (uv - 0.5) * 2.0
    x = (x - 0.5) * 2.0;
    y = (y - 0.5) * 2.0;

    // uv *= 1.1
    x *= 1.1;
    y *= 1.1;

    // uv.x *= 1.0 + pow(abs(uv.y) / 5.0, 2.0)
    x *= 1.0 + Math.pow(Math.abs(y) / 5.0, 2.0);

    // Important: this uses the MODIFIED x, exactly like the shader
    // uv.y *= 1.0 + pow(abs(uv.x) / 4.0, 2.0)
    y *= 1.0 + Math.pow(Math.abs(x) / 4.0, 2.0);

    // uv = uv / 2.0 + 0.5
    x = x / 2.0 + 0.5;
    y = y / 2.0 + 0.5;

    // return uv * 0.92 + 0.04
    x = x * 0.92 + 0.04;
    y = y * 0.92 + 0.04;

    // mix(vUv, curve(vUv), curvature)
    x = originalX * (1 - curvature) + x * curvature;
    y = originalY * (1 - curvature) + y * curvature;

    return { x, y };
}

const checkIntersection = () => {
    raycaster.setFromCamera(pointerNDC, camera);

    const intersections = raycaster.intersectObjects(
        scene.children,
        true
    );

    const hit = intersections[0]?.object ?? null;
    if (hit) {
        if (hit.userData.clickable) {
            if (hit.userData.video) {
                onClickCb = () => {
                    const video = hit.userData.video as HTMLVideoElement;

                    if (video.paused) {
                        void video.play();
                    } else {
                        video.pause();
                    }
                }
            } else {
                onClickCb = () => {
                    const href = hit.userData.href ?? "/";
                    scrollY = 0;
                    viewport.setScroll(0, 0);
                    if (href === "/") {
                        backBtn.userData.clickable = false;
                        backBtn.material.opacity = 1;
                        changeView(home, true);
                    }
                    else {
                        backBtn.material.opacity = 0;
                        backBtn.userData.clickable = true;
                        changeView(new Project(appCtx, hit.userData.href), false);
                    }
                    checkIntersection();
                    updateCursor();
                };
            }
        }
        else {
            onClickCb = null;
        }
    } else {
        onClickCb = null;
    }
}

// --------------------------------------------------
// Desktop / trackpad
// --------------------------------------------------

renderer.domElement.addEventListener(
    "wheel",
    (event: WheelEvent) => {
        event.preventDefault();

        const sensitivity = 1;

        setScroll(
            scrollY + event.deltaY * sensitivity
        );

        checkIntersection();
        updateCursor();
    },
    { passive: false }
);


// --------------------------------------------------
// Touch / phone
// --------------------------------------------------

let lastPointerY: number | null = null;
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const pointer = new THREE.Vector2();
let onClickCb: (() => void) | null = null;

function updatePointer(event: PointerEvent): void {
    const rect = renderer.domElement.getBoundingClientRect();

    // Canvas UV
    let x = (event.clientX - rect.left) / rect.width;
    let y = (event.clientY - rect.top) / rect.height;

    const curved = curveUV(x, y, crtPass.uniforms.uCurvature.value);
    x = curved.x;
    y = curved.y;

    // UV -> NDC
    pointer.x = x * width;
    pointer.y = y * height;
    pointerNDC.x = x * 2 - 1;
    pointerNDC.y = 1 - y * 2;
}

renderer.domElement.addEventListener("pointerdown", (event: PointerEvent) => {
    onClickCb?.();

    if (event.pointerType !== "touch") {
        return;
    }

    lastPointerY = event.clientY;
});

renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
    updatePointer(event);
    checkIntersection();
    updateCursor();

    if (
        event.pointerType !== "touch" ||
        lastPointerY === null
    ) {
        return;
    }

    const deltaY =
        lastPointerY - event.clientY;

    lastPointerY = event.clientY;

    const sensitivity = 1;

    setScroll(
        scrollY + deltaY * sensitivity
    );
});

renderer.domElement.addEventListener("pointerup", () => {
    lastPointerY = null;
});

renderer.domElement.addEventListener("pointercancel", () => {
    lastPointerY = null;
});

const timer = new THREE.Timer();

const render = () => {
    requestAnimationFrame(render);

    if (layoutDirty) {
        resize();
        layoutDirty = false;
    }

    timer.update();
    const time = timer.getElapsed();

    crtPass.uniforms.uTime.value = time;

    const flicker =
        Math.sin(time * bloomCfg.flickerSpeed) * 0.50 +
        Math.sin(time * bloomCfg.flickerSpeed * 2.47) * 0.25 +
        Math.sin(time * bloomCfg.flickerSpeed * 7.67) * 0.15 +
        Math.sin(time * bloomCfg.flickerSpeed * 16.73) * 0.10;

    bloomPass.strength =
        bloomCfg.strength +
        flicker * bloomCfg.strengthFlicker;

    bloomPass.radius =
        bloomCfg.radius +
        flicker * bloomCfg.radiusFlicker;

    // Invert this one: brighter bloom -> slightly lower threshold
    bloomPass.threshold =
        bloomCfg.threshold -
        flicker * bloomCfg.thresholdFlicker;

    composer.render();
}

render();
