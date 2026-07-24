/* ============================================================
   TYREFLOW — GUIDED CAMERA TOUR SYSTEM
   Auto-play cinematic flythrough of the supply chain.
   Play / pause / prev / next, progress bar, arc'd fly-ins,
   gentle dwell drift, and reduced-motion instant cuts.
   Owns nothing outside this file. API frozen by _BUILD_CONTRACT.md.
   ============================================================ */
window.TF = window.TF || {};

(function() {
    'use strict';

    // ---------- Tour Stop Definitions ----------
    // Anchors + framing come from _BUILD_CONTRACT.md §Camera framing.
    //   cam   : camera eye (x,y,z)   — kept y >= MIN_Y (never under floor)
    //   look  : orbit / lookAt target (a real station center)
    //   dwell : ms parked at the stop (progress bar fills over this)
    //   glide : ms fly-in from the previous stop (eased arc)
    // Narration is quantified, outcome-first, 3 metric chips, matched to geometry.
    const STOPS = [
        {
            id: 'overview',
            cam:  { x: 150, y: 120, z: 215 },
            look: { x: 30,  y: 22,  z: -20 },
            dwell: 6500,
            glide: 2600,
            title: 'One Platform, Full Chain of Custody',
            desc: 'Every tyre is tracked on a single automated platform — high-bay storage, in-line QC, palletizing, wrapping and GPS-tracked delivery. One system, one record, from ASRS slot to signed handoff.',
            metrics: ['100% Traceability', '240 tyres/hr', '9-Stage Flow']
        },
        {
            id: 'hero-tyre',
            cam:  { x: 34, y: 20, z: 78 },
            look: { x: 0,  y: 13, z: 40 },
            dwell: 5500,
            glide: 2200,
            title: 'Engineered to Spec, Verified in CAD',
            desc: 'Each SKU is modeled parametrically — radius, width, rim and tread depth — with production-accurate geometry. Specs stay auditable and export straight to CAD for tooling and QA.',
            metrics: ['6 PCR Categories', '360-Segment Mesh', 'CAD / OBJ Export']
        },
        {
            id: 'asrs',
            cam:  { x: 56, y: 82, z: 96 },
            look: { x: 56, y: 42, z: -110 },
            dwell: 6500,
            glide: 2400,
            title: 'Automated High-Bay Storage',
            desc: 'A five-aisle high-bay ASRS stores finished tyres at maximum density. Autonomous S/R cranes retrieve any SKU on demand and stage orders without manual handling.',
            metrics: ['~18,000 Positions', '<60s Retrieval', '99.6% Uptime']
        },
        {
            id: 'qc',
            cam:  { x: 48, y: 22, z: 16 },
            look: { x: 20, y: 12, z: -18 },
            dwell: 5000,
            glide: 2000,
            title: 'In-Line Quality Assurance',
            desc: 'Every retrieved tyre passes under the laser scan arch for dimensional and defect checks. Pass or fail is decided automatically — only released units continue downstream.',
            metrics: ['100% Inspected', 'Auto Pass/Fail', '<2s Cycle']
        },
        {
            id: 'conveyor',
            cam:  { x: 30, y: 26, z: 52 },
            look: { x: 64, y: 10, z: -6 },
            dwell: 5000,
            glide: 2000,
            title: 'Serialized Track & Trace',
            desc: 'The L-conveyor carries tyres to the labeling arm, which applies a unique serialized barcode at line speed. From here on, every unit has a scannable identity.',
            metrics: ['60 m/min Line', 'Serialized Barcode', 'Zero Stops']
        },
        {
            id: 'palletizer',
            cam:  { x: 34, y: 26, z: 30 },
            look: { x: 66, y: 12, z: 22 },
            dwell: 5000,
            glide: 2000,
            title: 'Lights-Out Palletizing',
            desc: 'A six-axis robot stacks tyres onto pallets with repeatable precision and no manual lifting. Completed loads index straight to the stretch-wrap station.',
            metrics: ['4 Tyres/Pallet', '6-Axis Robot', 'Zero Manual Handling']
        },
        {
            id: 'wrap-dock',
            cam:  { x: 40, y: 30, z: 100 },
            look: { x: 72, y: 14, z: 50 },
            dwell: 5000,
            glide: 2200,
            title: 'Wrap, Stage & Load',
            desc: 'Pallets are stretch-wrapped for load integrity, then staged at the dock where the roll-up door opens for the flatbed. Loading is sequenced for fast, damage-free turnaround.',
            metrics: ['Secured Loads', '3 Pallets/Truck', '<8min Dock Turn']
        },
        {
            id: 'transit',
            cam:  { x: 150, y: 55, z: 155 },
            look: { x: 72,  y: 6,  z: 128 },
            dwell: 5000,
            glide: 2200,
            title: 'GPS Chain-of-Custody Transit',
            desc: 'Each truck clears the weighbridge before the security boom lifts. Live GPS and a sealed digital manifest travel with the shipment for continuous chain of custody.',
            metrics: ['Live GPS', 'Weighbridge Verified', 'Sealed Manifest']
        },
        {
            id: 'delivery',
            cam:  { x: -140, y: 42, z: 150 },
            look: { x: -215, y: 16, z: 190 },
            dwell: 6000,
            glide: 2600,
            title: 'Proof of Delivery, Closed Loop',
            desc: 'Shipments arrive at the customer dock with the full chain of custody intact — from ASRS slot to signed handoff. The loop closes on-time and in-full.',
            metrics: ['98% OTIF', 'Signed PoD', 'CoC Closed']
        }
    ];

    // Keep a `duration` alias equal to dwell for backward-compat readers.
    STOPS.forEach(s => { s.duration = s.dwell; });

    // ---------- Constants ----------
    const MIN_Y = 8;          // camera never dips under the floor
    const RM_DWELL_MULT = 1.4; // reduced-motion: linger longer (no glide/drift)

    // ---------- Tour State ----------
    let active = false;
    let paused = false;
    let phase = 'idle';       // 'idle' | 'glide' | 'dwell'
    let currentStop = -1;

    let glideStart = 0;       // performance.now() when current glide began
    let glideDuration = 2200;
    let dwellElapsed = 0;     // accrued dwell ms (frozen while paused)
    let dwellDuration = 5000;
    let lastNow = 0;          // for frame-dt accumulation

    let reducedMotion = false;

    const fromCam  = new THREE.Vector3();
    const fromLook = new THREE.Vector3();
    const toCam    = new THREE.Vector3();
    const toLook   = new THREE.Vector3();
    const ctrlCam  = new THREE.Vector3(); // arc control point for the glide
    const _off     = new THREE.Vector3(); // scratch for drift

    // References set by main.js
    let camera = null;
    let controls = null;

    // Callbacks (set via setters below)
    let onStopArrive = null;      // fn(stopIndex, stopData)
    let onTourEnd = null;         // fn()
    let onProgress = null;        // fn(fraction 0..1) — drives #tour-progress-fill
    let onPlayStateChange = null; // fn(isPaused)

    // matchMedia handle (evaluated live on each tour start)
    const mmReduced = (typeof window.matchMedia === 'function')
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    function init(cam, ctrl) {
        camera = cam;
        controls = ctrl;
    }

    // ---------- Easing / math ----------
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Quadratic bezier into `out` (p0 -> p1 -> p2)
    function bezier3(p0, p1, p2, t, out) {
        const mt = 1 - t;
        const a = mt * mt, b = 2 * mt * t, c = t * t;
        out.x = a * p0.x + b * p1.x + c * p2.x;
        out.y = a * p0.y + b * p1.y + c * p2.y;
        out.z = a * p0.z + b * p1.z + c * p2.z;
        return out;
    }

    // ---------- Core transition ----------
    // Fly (or cut) to STOPS[index]. Works from any phase, so next/prev/skip
    // re-trigger a fresh glide during auto-play.
    function goToStop(index) {
        if (index < 0 || index >= STOPS.length) return;
        currentStop = index;
        const stop = STOPS[index];

        fromCam.copy(camera.position);
        fromLook.copy(controls.target);
        toCam.set(stop.cam.x, stop.cam.y, stop.cam.z);
        toLook.set(stop.look.x, stop.look.y, stop.look.z);

        // User cannot orbit while the camera is choreographed.
        controls.enabled = false;

        if (reducedMotion) {
            // Instant cut — no glide, no drift.
            camera.position.copy(toCam);
            if (camera.position.y < MIN_Y) camera.position.y = MIN_Y;
            controls.target.copy(toLook);
            controls.update();
            arrive();
            return;
        }

        // Anti-clipping arc: lift up and bow outward (+x, away from the deep
        // racks) at the path midpoint, scaled by travel distance. Keeps long
        // hops (e.g. delivery -> overview) from cutting through geometry.
        const dist = fromCam.distanceTo(toCam);
        ctrlCam.copy(fromCam).add(toCam).multiplyScalar(0.5);
        ctrlCam.y += Math.min(dist * 0.18, 70);
        ctrlCam.x += Math.min(dist * 0.12, 45);

        phase = 'glide';
        glideStart = performance.now();
        glideDuration = stop.glide;
        if (onProgress) onProgress(0);
    }

    // Called on arrival at a stop (end of glide, or immediately on a cut).
    function arrive() {
        const stop = STOPS[currentStop];
        phase = 'dwell';
        dwellElapsed = 0;
        dwellDuration = reducedMotion ? stop.dwell * RM_DWELL_MULT : stop.dwell;
        controls.enabled = false;
        if (onStopArrive) onStopArrive(currentStop, stop);
        if (onProgress) onProgress(0);
    }

    // Advance from a completed dwell.
    function advance() {
        if (currentStop + 1 >= STOPS.length) {
            endTour();
        } else {
            goToStop(currentStop + 1);
        }
    }

    // Gentle cinematic drift while parked: a very slow orbital sway around the
    // look target + subtle push-in + faint vertical bob. Driven by dwellElapsed
    // so it freezes when paused.
    function applyDrift() {
        _off.copy(toCam).sub(toLook);
        const e = dwellElapsed;

        // Slow orbit around vertical axis (amplitude ~2.9 deg, long period).
        const theta = Math.sin(e * 0.00016) * 0.05;
        const cos = Math.cos(theta), sin = Math.sin(theta);
        const ox = _off.x * cos - _off.z * sin;
        const oz = _off.x * sin + _off.z * cos;
        _off.x = ox;
        _off.z = oz;

        // Subtle push-in over the dwell (up to 4% closer).
        _off.multiplyScalar(1 - 0.04 * Math.min(1, e / dwellDuration));

        camera.position.copy(toLook).add(_off);
        camera.position.y += Math.sin(e * 0.0006) * 0.5; // faint bob
        if (camera.position.y < MIN_Y) camera.position.y = MIN_Y;
        controls.target.copy(toLook);
    }

    // ---------- Per-frame update (from main.js animate loop) ----------
    function update() {
        if (!active) return;

        const now = performance.now();
        let dt = now - lastNow;
        lastNow = now;
        if (dt < 0) dt = 0;
        if (dt > 100) dt = 100; // clamp tab-switch spikes

        if (phase === 'glide') {
            // Glide always runs in real time so manual next/prev animate even
            // when the auto-play is paused.
            const rawT = Math.min(1, (now - glideStart) / glideDuration);
            const te = easeInOutCubic(rawT);
            bezier3(fromCam, ctrlCam, toCam, te, camera.position);
            if (camera.position.y < MIN_Y) camera.position.y = MIN_Y;
            controls.target.lerpVectors(fromLook, toLook, te);
            controls.update();
            if (onProgress) onProgress(0);
            if (rawT >= 1) arrive();
        } else if (phase === 'dwell') {
            if (!paused) dwellElapsed += dt;
            if (!reducedMotion) {
                applyDrift();
            } else {
                controls.target.copy(toLook); // static hold
            }
            controls.update();
            const frac = Math.min(1, dwellElapsed / dwellDuration);
            if (onProgress) onProgress(frac);
            if (!paused && dwellElapsed >= dwellDuration) advance();
        }
    }

    // ---------- Lifecycle ----------
    function startTour() {
        if (!camera || !controls) return;
        active = true;
        paused = false;
        reducedMotion = mmReduced ? mmReduced.matches : false;
        currentStop = -1;
        lastNow = performance.now();
        if (onPlayStateChange) onPlayStateChange(false);
        goToStop(0);
    }

    function endTour() {
        active = false;
        paused = false;
        phase = 'idle';
        if (controls) {
            controls.enabled = true;               // hand control back to the user
            controls.target.copy(toLook);          // continue from the last framing
            if (camera && camera.position.y < MIN_Y) camera.position.y = MIN_Y;
            controls.update();
        }
        if (onProgress) onProgress(0);
        if (onTourEnd) onTourEnd();
    }

    // ---------- Navigation (valid during auto-play) ----------
    function nextStop() {
        if (!active) return;
        if (currentStop + 1 >= STOPS.length) { endTour(); return; }
        goToStop(currentStop + 1);
    }

    function prevStop() {
        if (!active) return;
        goToStop(Math.max(0, currentStop - 1));
    }

    function skipToStop(index) {
        if (!active) return;
        if (index < 0 || index >= STOPS.length) return;
        goToStop(index);
    }

    // ---------- Play / pause ----------
    function play() {
        if (!active || !paused) return;
        paused = false;
        lastNow = performance.now();
        if (onPlayStateChange) onPlayStateChange(false);
    }

    function pause() {
        if (!active || paused) return;
        paused = true;
        if (onPlayStateChange) onPlayStateChange(true);
    }

    function togglePlay() {
        if (paused) play(); else pause();
    }

    function isPaused() { return paused; }

    // ---------- Getters ----------
    function isActive() { return active; }
    function getCurrentStop() { return currentStop; }
    function getTotalStops() { return STOPS.length; }
    function getStopData(index) { return STOPS[index]; }

    // ---------- Expose API (names frozen by _BUILD_CONTRACT.md) ----------
    TF.tour = {
        STOPS,
        init,
        startTour,
        endTour,
        nextStop,
        prevStop,
        skipToStop,
        play,
        pause,
        togglePlay,
        isPaused,
        update,
        isActive,
        getCurrentStop,
        getTotalStops,
        getStopData,
        set onStopArrive(fn)      { onStopArrive = fn; },
        set onTourEnd(fn)         { onTourEnd = fn; },
        set onProgress(fn)        { onProgress = fn; },
        set onPlayStateChange(fn) { onPlayStateChange = fn; }
    };
})();
