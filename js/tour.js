/* ============================================================
   TYREFLOW — GUIDED CAMERA TOUR SYSTEM
   Cinematic multi-stop flythrough of the supply chain
   ============================================================ */
window.TF = window.TF || {};

(function() {
    'use strict';

    // ---------- Tour Stop Definitions ----------
    // Each stop: camera position, lookAt target, title, description, metrics, duration
    const STOPS = [
        {
            id: 'overview',
            cam:  { x: 120, y: 90, z: 160 },
            look: { x: 0,   y: 20, z: -80 },
            title: 'Full Facility Overview',
            desc: 'Welcome to the TyreFlow automated warehouse — a fully integrated tire supply chain from high-bay ASRS storage through QC, labeling, and stretch wrapping to final customer delivery.',
            metrics: ['6 PCR Categories', '5 ASRS Aisles', '9-Step Flow'],
            duration: 6000
        },
        {
            id: 'hero-tyre',
            cam:  { x: 25, y: 18, z: 60 },
            look: { x: 0,  y: 12, z: 40 },
            title: 'Precision-Engineered Tyre',
            desc: 'Every tyre features parametric Aures tread geometry — adjust radius, width, rim size, and tread depth in real-time with CAD-exportable meshes.',
            metrics: ['360-Seg Mesh', 'OBJ Export', 'Real-time Preview'],
            duration: 5000
        },
        {
            id: 'asrs',
            cam:  { x: 60, y: 65, z: -120 },
            look: { x: 0,  y: 40, z: -160 },
            title: 'Automated Storage & Retrieval',
            desc: 'High-bay ASRS with 5 aisles and 6 rack rows stores finished tyres across all PCR size categories. S/R cranes autonomously pick and stage orders.',
            metrics: ['5 S/R Cranes', '5-Level High-Bay', '~18,000 Positions'],
            duration: 6000
        },
        {
            id: 'qc',
            cam:  { x: 35, y: 18, z: -10 },
            look: { x: 20, y: 10, z: -18 },
            title: 'QC Inspection Station',
            desc: 'Laser-guided quality control scans each retrieved tyre for dimensional accuracy and defects. Only "Released" tyres proceed downstream.',
            metrics: ['Laser Scan', 'Auto Pass/Fail', '< 2s Cycle'],
            duration: 5000
        },
        {
            id: 'conveyor',
            cam:  { x: 50, y: 20, z: -5 },
            look: { x: 72, y: 10, z: 5 },
            title: 'Conveyor & Labeling',
            desc: 'L-shaped roller conveyor transports tyres from QC to the labeling station where serialized barcodes are applied for full chain-of-custody traceability.',
            metrics: ['60 m/min Speed', 'Barcode Label', 'Serial Tracking'],
            duration: 5000
        },
        {
            id: 'palletizer',
            cam:  { x: 50, y: 25, z: 22 },
            look: { x: 65, y: 10, z: 22 },
            title: 'Robotic Palletizer',
            desc: 'A 6-axis robot arm stacks 4 tyres per pallet with precision placement. Completed pallets move to the stretch wrap station.',
            metrics: ['4 Tyres/Pallet', '6-Axis Robot', 'Auto Stacking'],
            duration: 5000
        },
        {
            id: 'wrap-dock',
            cam:  { x: 100, y: 22, z: 45 },
            look: { x: 72,  y: 12, z: 50 },
            title: 'Wrap & Loading Dock',
            desc: 'Pallets are stretch-wrapped for transit protection, then loaded onto the flatbed. The dock door opens automatically for truck access.',
            metrics: ['Auto Wrap', 'Dock Leveler', '3 Pallets/Load'],
            duration: 5000
        },
        {
            id: 'transit',
            cam:  { x: 40, y: 35, z: 110 },
            look: { x: -30, y: 5, z: 120 },
            title: 'GPS-Tracked Transit',
            desc: 'Loaded trucks pass through the security gate and weighbridge. Full GPS tracking and chain-of-custody documentation accompany every shipment.',
            metrics: ['GPS Tracking', 'Weighbridge', 'Security Gate'],
            duration: 5000
        },
        {
            id: 'delivery',
            cam:  { x: -180, y: 35, z: 150 },
            look: { x: -215, y: 15, z: 130 },
            title: 'Customer Delivery',
            desc: 'Shipments arrive at the customer\'s receiving dock with complete traceability — from ASRS slot to final handoff. Chain of custody: closed.',
            metrics: ['Proof of Delivery', 'Full Traceability', 'CoC Closed'],
            duration: 5000
        }
    ];

    // ---------- Tour State ----------
    let active = false;
    let currentStop = -1;
    let transitioning = false;
    let transitionStart = 0;
    let transitionDuration = 2200; // ms for camera move
    let dwellStart = 0;
    let fromCam = new THREE.Vector3();
    let fromLook = new THREE.Vector3();
    let toCam = new THREE.Vector3();
    let toLook = new THREE.Vector3();

    // References set by main.js
    let camera = null;
    let controls = null;
    let onStopArrive = null; // callback(stopIndex, stopData)
    let onTourEnd = null;    // callback

    function init(cam, ctrl) {
        camera = cam;
        controls = ctrl;
    }

    // Smooth easing
    function easeInOutCubic(t) {
        return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
    }

    function startTour() {
        active = true;
        currentStop = -1;
        nextStop();
    }

    function nextStop() {
        currentStop++;
        if (currentStop >= STOPS.length) {
            endTour();
            return;
        }

        const stop = STOPS[currentStop];

        // Capture current camera state as "from"
        fromCam.copy(camera.position);
        fromLook.copy(controls.target);

        // Set target
        toCam.set(stop.cam.x, stop.cam.y, stop.cam.z);
        toLook.set(stop.look.x, stop.look.y, stop.look.z);

        transitioning = true;
        transitionStart = performance.now();

        // Disable user controls during transition
        controls.enabled = false;
    }

    function prevStop() {
        if (currentStop <= 0) return;
        currentStop -= 2; // will be incremented by nextStop
        nextStop();
    }

    function skipToStop(index) {
        if (index < 0 || index >= STOPS.length) return;
        currentStop = index - 1;
        nextStop();
    }

    function endTour() {
        active = false;
        transitioning = false;
        controls.enabled = true;
        if (onTourEnd) onTourEnd();
    }

    function update() {
        if (!active) return;
        const now = performance.now();

        if (transitioning) {
            const elapsed = now - transitionStart;
            let t = Math.min(1, elapsed / transitionDuration);
            t = easeInOutCubic(t);

            camera.position.lerpVectors(fromCam, toCam, t);
            controls.target.lerpVectors(fromLook, toLook, t);
            controls.update();

            if (t >= 1) {
                transitioning = false;
                dwellStart = now;
                // Notify UI to show info card
                if (onStopArrive) onStopArrive(currentStop, STOPS[currentStop]);
            }
        } else {
            // Dwelling at a stop — gentle camera bob
            const elapsed = now - dwellStart;
            const bob = Math.sin(elapsed * 0.0008) * 0.3;
            camera.position.y = toCam.y + bob;
            controls.update();
        }
    }

    function isActive() { return active; }
    function getCurrentStop() { return currentStop; }
    function getTotalStops() { return STOPS.length; }
    function getStopData(index) { return STOPS[index]; }

    // ---------- Expose API ----------
    TF.tour = {
        STOPS,
        init,
        startTour,
        nextStop,
        prevStop,
        skipToStop,
        endTour,
        update,
        isActive,
        getCurrentStop,
        getTotalStops,
        getStopData,
        set onStopArrive(fn) { onStopArrive = fn; },
        set onTourEnd(fn) { onTourEnd = fn; }
    };
})();
