/* ============================================================
   TYREFLOW — MAIN ORCHESTRATOR
   Scene init, animate loop, hero tyre, export
   ============================================================ */
window.TF = window.TF || {};

(function() {
    'use strict';

    let scene, camera, renderer, controls, clock;
    let tyreMesh;
    let userInteracting = false;
    let particles; // ambient dust

    // ---------- INIT ----------
    function init() {
        // Scene — dark industrial palette
        scene = new THREE.Scene();
        const ENV_BG = 0x1b2534;
        scene.background = new THREE.Color(ENV_BG);
        scene.fog = new THREE.Fog(ENV_BG, 220, 950);

        // Camera
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(70, 48, 130);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.92;
        document.getElementById('canvas-container').appendChild(renderer.domElement);

        // Controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(0, 22, -70);
        controls.minDistance = 25;
        controls.maxDistance = 620;
        controls.maxPolarAngle = Math.PI / 2.05;
        controls.addEventListener('start', () => { userInteracting = true; });
        controls.addEventListener('end',   () => { userInteracting = false; });

        // Lighting
        setupLighting();

        // Ambient particles (floating dust motes)
        createParticles();

        // Build warehouse scene
        if (TF.warehouse && TF.warehouse.buildWarehouse) {
            TF.warehouse.buildWarehouse(scene);
        }

        // Build logistics flow
        if (TF.logistics && TF.logistics.buildLogistics) {
            TF.logistics.buildLogistics(scene);
        }

        // Initial hero tyre
        requestAnimationFrame(() => updateMainTyre(false));

        // Init subsystems
        clock = new THREE.Clock();

        if (TF.tour) TF.tour.init(camera, controls);
        if (TF.ui) TF.ui.init();

        // Window resize
        window.addEventListener('resize', onWindowResize, false);

        // Start render loop
        animate();
    }

    function setupLighting() {
        // Hemisphere fill
        const hemi = new THREE.HemisphereLight(0xcde0ff, 0x2a3038, 0.55);
        scene.add(hemi);

        // Warm key light
        const mainLight = new THREE.DirectionalLight(0xfff4e6, 0.85);
        mainLight.position.set(60, 120, 90);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 600;
        mainLight.shadow.camera.left = -260;
        mainLight.shadow.camera.right = 260;
        mainLight.shadow.camera.top = 260;
        mainLight.shadow.camera.bottom = -260;
        mainLight.shadow.bias = -0.0005;
        scene.add(mainLight);

        // Cool fill
        const fillLight = new THREE.DirectionalLight(0x9fc6ff, 0.30);
        fillLight.position.set(-60, 40, 60);
        scene.add(fillLight);

        // Cool aisle accent glow (cheap, no shadows)
        const accentA = new THREE.PointLight(0x38bdf8, 0.6, 320, 2);
        accentA.position.set(0, 55, -140);
        scene.add(accentA);
        const accentB = new THREE.PointLight(0x38bdf8, 0.45, 260, 2);
        accentB.position.set(0, 40, -250);
        scene.add(accentB);
    }

    // ---------- Ambient Particles ----------
    function createParticles() {
        const count = 150;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 400;
            positions[i * 3 + 1] = Math.random() * 120 + 5;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 500 - 50;
            velocities[i * 3]     = (Math.random() - 0.5) * 0.3;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.userData.velocities = velocities;

        const mat = new THREE.PointsMaterial({
            color: 0x94a3b8,
            size: 0.6,
            transparent: true,
            opacity: 0.35,
            sizeAttenuation: true,
            depthWrite: false
        });

        particles = new THREE.Points(geo, mat);
        scene.add(particles);
    }

    function updateParticles(dt) {
        if (!particles) return;
        const pos = particles.geometry.attributes.position.array;
        const vel = particles.geometry.userData.velocities;
        for (let i = 0; i < pos.length; i += 3) {
            pos[i]     += vel[i] * dt;
            pos[i + 1] += vel[i + 1] * dt;
            pos[i + 2] += vel[i + 2] * dt;

            // Wrap around
            if (pos[i] > 200) pos[i] = -200;
            if (pos[i] < -200) pos[i] = 200;
            if (pos[i + 1] > 130) pos[i + 1] = 5;
            if (pos[i + 1] < 5) pos[i + 1] = 130;
            if (pos[i + 2] > 200) pos[i + 2] = -350;
            if (pos[i + 2] < -350) pos[i + 2] = 200;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }

    // ---------- Hero Tyre ----------
    function updateMainTyre(isPreview) {
        if (tyreMesh) {
            scene.remove(tyreMesh);
            tyreMesh.geometry.dispose();
        }

        const R     = parseFloat(document.getElementById('param-radius').value);
        const w     = parseFloat(document.getElementById('param-width').value);
        const rim   = parseFloat(document.getElementById('param-rim').value);
        const tread = parseFloat(document.getElementById('param-tread').value);
        const N     = parseInt(document.getElementById('param-count').value);

        // Update slider labels
        if (TF.ui) TF.ui.updateSliderLabels();

        // Generate geometry
        const geo = TF.tyre.generateTyreGeometry(R, w, rim, tread, N, isPreview);

        tyreMesh = new THREE.Mesh(geo, TF.tyre.rubberMaterial);
        tyreMesh.rotation.x = Math.PI / 2;

        // Position on staging pedestal
        const STAGE = TF.warehouse ? TF.warehouse.STAGE : { x: 0, z: 40 };
        tyreMesh.position.set(STAGE.x, R + 2.1, STAGE.z);
        tyreMesh.castShadow = true;
        tyreMesh.receiveShadow = true;

        scene.add(tyreMesh);

        if (TF.ui) TF.ui.hideLoading();
    }

    // ---------- OBJ Export ----------
    function exportToOBJ() {
        if (TF.ui) TF.ui.showLoading('Compiling CAD File...');

        setTimeout(() => {
            const exporter = new THREE.OBJExporter();
            const result = exporter.parse(tyreMesh);

            const blob = new Blob([result], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = url;
            link.download = 'PCR_Custom_Solid_Tyre.obj';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            if (TF.ui) TF.ui.hideLoading();
        }, 100);
    }

    // ---------- Animate Loop ----------
    function animate() {
        requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.05);

        controls.update();

        // Hero tyre slow rotate — keep spinning even during the tour
        // (it is the subject of the hero-tyre stop). Only user grabs pause it.
        if (tyreMesh && !userInteracting) {
            tyreMesh.rotation.z -= 0.35 * dt;
        }

        // Update subsystems (order per _BUILD_CONTRACT.md §MODULE API)
        if (TF.warehouse && TF.warehouse.updateCranes) {
            TF.warehouse.updateCranes(dt);
        }
        if (TF.warehouse && TF.warehouse.updateStations) {
            TF.warehouse.updateStations(dt); // NEW — continuous ambient station motion
        }
        if (TF.logistics && TF.logistics.updateLogistics) {
            TF.logistics.updateLogistics(dt);
        }
        if (TF.tour) TF.tour.update();

        // Ambient particles
        updateParticles(dt);

        // HUD
        if (TF.ui) TF.ui.updateHUD();

        renderer.render(scene, camera);
    }

    // ---------- Resize ----------
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ---------- Expose API ----------
    TF.main = {
        init,
        updateMainTyre,
        exportToOBJ,
        // Read-only debug hooks (harmless getters) for offline render capture / QA.
        get _scene()    { return scene; },
        get _camera()   { return camera; },
        get _renderer() { return renderer; },
        get _controls() { return controls; }
    };

    // ---------- Boot ----------
    window.onload = init;
})();
