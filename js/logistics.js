(function () {
    window.TF = window.TF || {};

    // -------------------------------------------------------------------------
    // Constants & Waypoints
    // -------------------------------------------------------------------------
    const asrsFrontZ = -18;

    // Tyre flow positions (tyreY = conveyor bed top + half tyre width)
    const bedTopY = 6;
    const tyreY = bedTopY + 7.0 / 2 + 0.2; // ~9.7

    const WAYPOINTS = {
        OUT: new THREE.Vector3(0, tyreY, asrsFrontZ),      // ASRS central aisle output
        QC: new THREE.Vector3(20, tyreY, asrsFrontZ),      // QC inspection arch
        CORNER: new THREE.Vector3(72, tyreY, asrsFrontZ),  // conveyor elbow
        LABEL: new THREE.Vector3(72, tyreY, 5),            // labeling station
        PALLET: new THREE.Vector3(72, tyreY, 22),          // above palletizer
        palletBase: new THREE.Vector3(72, 0, 22),
        WRAP: new THREE.Vector3(72, 0, 35),                // stretch wrap station  
        DOCK: new THREE.Vector3(72, 0, 55),                // loading dock
        GATE: new THREE.Vector3(72, 0, 85),                // security gate
        TRUCK: new THREE.Vector3(72, 0, 90),               // truck position
    };

    // Delivery route waypoints
    const ROUTE = [
        new THREE.Vector3(72, 0, 110),
        new THREE.Vector3(-30, 0, 120),
        new THREE.Vector3(-170, 0, 128)
    ];
    const CUSTOMER = new THREE.Vector3(-215, 0, 130);

    // -------------------------------------------------------------------------
    // Shared Materials
    // -------------------------------------------------------------------------
    const truckCabMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.4, roughness: 0.4 });
    const truckBoxMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.2, roughness: 0.6 });
    const tyreDarkMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.12, roughness: 0.82 });
    const releasedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, metalness: 0.0, roughness: 0.9 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.55 });
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    // -------------------------------------------------------------------------
    // State Machine
    // -------------------------------------------------------------------------
    const logi = {
        phase: 'retrieve',
        t: 0,
        tyreCount: 0,
        palletCount: 0,
        routeIdx: 0,
        serial: 'TR-00000',
        activePallet: null,
        activeTruck: null,
        flowTyre: null,
        robot: null, // References to robot arm parts
        kpis: { tyres: 0, pallets: 0, trucks: 0 },
        sceneGroup: null
    };

    const PIPELINE_INDEX = {
        'retrieve': 0,
        'qc_scan': 1,
        'conveyA': 2,
        'conveyB': 2,
        'label': 3,
        'conveyC': 4,
        'place': 4,
        'wrap': 5,
        'loadpallet': 6,
        'gate': 7,
        'depart': 7,
        'delivered': 8
    };

    // -------------------------------------------------------------------------
    // Helper Functions
    // -------------------------------------------------------------------------
    function approach(cur, target, step) {
        return cur + (target - cur) * step;
    }

    function moveTo(pos, target, speed, dt) {
        const v = new THREE.Vector3().subVectors(target, pos);
        const d = v.length();
        const moveDist = speed * dt;
        if (d <= moveDist) {
            pos.copy(target);
            return true;
        }
        v.normalize().multiplyScalar(moveDist);
        pos.add(v);
        return false;
    }

    function faceDir(obj, from, to, dt) {
        if (from.distanceToSquared(to) < 0.001) return;
        const targetAngle = Math.atan2(to.x - from.x, to.z - from.z);
        
        // Simple smoothing for angle wrapping
        let diff = targetAngle - obj.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        obj.rotation.y += diff * (dt * 5);
    }

    function generateSerial() {
        return 'TR-' + Math.floor(10000 + Math.random() * 90000);
    }

    // -------------------------------------------------------------------------
    // Builders
    // -------------------------------------------------------------------------
    function makePallet() {
        const pallet = new THREE.Group();
        
        // Deck
        const deckGeo = new THREE.BoxGeometry(20, 1.5, 20);
        const deck = new THREE.Mesh(deckGeo, woodMat);
        deck.position.y = 2.25;
        pallet.add(deck);

        // Feet
        const footGeo = new THREE.BoxGeometry(20, 1.5, 4);
        for (let i = 0; i < 3; i++) {
            const foot = new THREE.Mesh(footGeo, woodMat);
            foot.position.set(0, 0.75, -8 + i * 8);
            pallet.add(foot);
        }

        // Tyres on pallet
        pallet.userData.tyres = [];
        const tyreGeo = (window.TF.tyre && window.TF.tyre.FLOW_TYRE_GEO) ? window.TF.tyre.FLOW_TYRE_GEO : new THREE.TorusGeometry(3.5, 1.5, 16, 32);
        
        for (let i = 0; i < 4; i++) {
            const t = new THREE.Mesh(tyreGeo, tyreDarkMat);
            t.rotation.x = Math.PI / 2;
            t.position.y = 3.0 + 3.5 + (i * 7.0); // Stack upwards
            t.visible = false;
            pallet.userData.tyres.push(t);
            pallet.add(t);
        }

        return pallet;
    }

    function makeTruck() {
        const truck = new THREE.Group();
        
        // Flatbed
        const bedGeo = new THREE.BoxGeometry(24, 2, 70);
        const bed = new THREE.Mesh(bedGeo, steelMat);
        bed.position.y = 6;
        truck.add(bed);

        // Cab
        const cabGeo = new THREE.BoxGeometry(24, 16, 20);
        const cab = new THREE.Mesh(cabGeo, truckCabMat);
        cab.position.set(0, 15, 25);
        truck.add(cab);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(4, 4, 3, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelPositions = [
            [-12, 4, 25], [12, 4, 25],   // Front
            [-12, 4, -15], [12, 4, -15], // Mid-Rear
            [-12, 4, -25], [12, 4, -25]  // Rear
        ];
        
        wheelPositions.forEach(pos => {
            const w = new THREE.Mesh(wheelGeo, tyreDarkMat);
            w.position.set(pos[0], pos[1], pos[2]);
            truck.add(w);
        });

        truck.userData.pallets = [];
        truck.userData.palletSlots = [
            new THREE.Vector3(0, 7, -20),
            new THREE.Vector3(0, 7, 0),
            new THREE.Vector3(0, 7, 20)
        ];

        return truck;
    }

    function makeConveyor(x, y, z, width, length, isRotated) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        if (isRotated) group.rotation.y = Math.PI / 2;

        const frameGeo = new THREE.BoxGeometry(width, 1, length);
        const frame = new THREE.Mesh(frameGeo, steelMat);
        group.add(frame);

        // Rollers
        const rollerGeo = new THREE.CylinderGeometry(0.8, 0.8, width - 1, 8);
        rollerGeo.rotateZ(Math.PI / 2);
        const numRollers = Math.floor(length / 2.5);
        for(let i = 0; i < numRollers; i++) {
            const r = new THREE.Mesh(rollerGeo, steelMat);
            r.position.set(0, 0.5, -length/2 + 1 + i * 2.5);
            group.add(r);
        }
        return group;
    }

    function buildRobot() {
        const robot = new THREE.Group();
        
        const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 4, 16), truckCabMat);
        base.position.y = 2;
        robot.add(base);

        const shoulder = new THREE.Group();
        shoulder.position.y = 4;
        robot.add(shoulder);

        const shoulderMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), steelMat);
        shoulderMesh.position.y = 3;
        shoulder.add(shoulderMesh);

        const upperArm = new THREE.Group();
        upperArm.position.y = 6;
        shoulder.add(upperArm);

        const upperArmMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 3), truckCabMat);
        upperArmMesh.position.y = 6;
        upperArm.add(upperArmMesh);

        const elbow = new THREE.Group();
        elbow.position.y = 12;
        upperArm.add(elbow);

        const forearmMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 2), steelMat);
        forearmMesh.position.y = 5;
        elbow.add(forearmMesh);

        const gripper = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 5), tyreDarkMat);
        gripper.position.y = 10;
        elbow.add(gripper);

        robot.position.set(WAYPOINTS.PALLET.x - 15, 0, WAYPOINTS.PALLET.z);

        logi.robot = { group: robot, shoulder, upperArm, elbow };
        return robot;
    }

    function buildLogistics(scene, warehouseGroup) {
        logi.sceneGroup = new THREE.Group();

        // 1. Conveyors
        // OUT to CORNER (along X)
        const conv1 = makeConveyor(36, bedTopY, asrsFrontZ, 12, 72, true);
        logi.sceneGroup.add(conv1);
        
        // CORNER to PALLET (along Z)
        const conv2 = makeConveyor(72, bedTopY, 2, 12, 40, false);
        logi.sceneGroup.add(conv2);

        // 2. Robot
        logi.sceneGroup.add(buildRobot());

        // 3. Roads
        const roadGeo = new THREE.PlaneGeometry(30, 250);
        roadGeo.rotateX(-Math.PI / 2);
        const road1 = new THREE.Mesh(roadGeo, roadMat);
        road1.position.set(72, 0.1, 80);
        logi.sceneGroup.add(road1);

        // 4. Flow Tyre Actor
        const tyreGeo = (window.TF.tyre && window.TF.tyre.FLOW_TYRE_GEO) ? window.TF.tyre.FLOW_TYRE_GEO : new THREE.TorusGeometry(3.5, 1.5, 16, 32);
        logi.flowTyre = new THREE.Group();
        const tMesh = new THREE.Mesh(tyreGeo, tyreDarkMat);
        tMesh.rotation.x = Math.PI / 2;
        
        const tagRing = new THREE.Mesh(
            new THREE.TorusGeometry(3.6, 0.2, 8, 32),
            releasedMat
        );
        tagRing.rotation.x = Math.PI / 2;
        tagRing.position.y = 1.0;

        logi.flowTyre.add(tMesh);
        logi.flowTyre.add(tagRing);
        logi.flowTyre.visible = false;
        logi.sceneGroup.add(logi.flowTyre);

        // 5. Initial Pallet
        logi.activePallet = makePallet();
        logi.activePallet.position.copy(WAYPOINTS.palletBase);
        logi.sceneGroup.add(logi.activePallet);

        // 6. Initial Truck
        logi.activeTruck = makeTruck();
        logi.activeTruck.position.copy(WAYPOINTS.TRUCK);
        logi.sceneGroup.add(logi.activeTruck);

        // 7. Customer Building
        const custGroup = new THREE.Group();
        custGroup.position.copy(CUSTOMER);
        
        const building = new THREE.Mesh(new THREE.BoxGeometry(60, 40, 50), truckBoxMat);
        building.position.y = 20;
        custGroup.add(building);
        
        const roof = new THREE.Mesh(new THREE.ConeGeometry(50, 15, 4), new THREE.MeshStandardMaterial({color: 0x166534}));
        roof.rotation.y = Math.PI/4;
        roof.position.y = 47.5;
        custGroup.add(roof);

        logi.sceneGroup.add(custGroup);

        scene.add(logi.sceneGroup);
    }

    // -------------------------------------------------------------------------
    // Main Update Loop
    // -------------------------------------------------------------------------
    function updateLogistics(dt) {
        if (!logi.sceneGroup) return;

        const w = window.TF.warehouse;

        switch (logi.phase) {
            case 'retrieve':
                logi.t += dt;
                if (logi.t > 1.1) {
                    logi.phase = 'qc_scan';
                    logi.t = 0;
                    logi.flowTyre.position.copy(WAYPOINTS.OUT);
                    logi.flowTyre.visible = true;
                    logi.serial = generateSerial();
                }
                break;

            case 'qc_scan':
                if (moveTo(logi.flowTyre.position, WAYPOINTS.QC, 50, dt)) {
                    logi.phase = 'conveyA';
                    if (w && w.qcLight) w.qcLight.material.color.setHex(0x22c55e); // Green
                }
                if (w && w.qcBeam) {
                    w.qcBeam.rotation.x = Math.sin(Date.now() * 0.005) * 0.5;
                }
                break;

            case 'conveyA':
                logi.flowTyre.children[0].rotation.z -= dt * 5; // Roll
                if (moveTo(logi.flowTyre.position, WAYPOINTS.CORNER, 60, dt)) {
                    logi.phase = 'conveyB';
                }
                break;

            case 'conveyB':
                logi.flowTyre.children[0].rotation.z -= dt * 5; // Roll
                if (moveTo(logi.flowTyre.position, WAYPOINTS.LABEL, 60, dt)) {
                    logi.phase = 'label';
                    logi.t = 0;
                }
                break;

            case 'label':
                logi.t += dt;
                if (w && w.labelArm) {
                    w.labelArm.rotation.y = Math.sin(logi.t * Math.PI / 0.8) * 1.5;
                }
                if (logi.t > 0.8) {
                    logi.phase = 'conveyC';
                    logi.t = 0;
                }
                break;

            case 'conveyC':
                logi.flowTyre.children[0].rotation.z -= dt * 5;
                if (moveTo(logi.flowTyre.position, WAYPOINTS.PALLET, 60, dt)) {
                    logi.phase = 'place';
                    logi.t = 0;
                }
                break;

            case 'place':
                logi.t += dt;
                const p = Math.min(logi.t / 1.5, 1.0);
                
                // Animate robot arm (simplified kinematics)
                if (logi.robot) {
                    logi.robot.shoulder.rotation.y = Math.sin(p * Math.PI) * 1.5;
                    logi.robot.upperArm.rotation.z = Math.sin(p * Math.PI) * 0.8;
                }

                // Lower tyre
                logi.flowTyre.position.y = approach(logi.flowTyre.position.y, 3 + (logi.tyreCount * 7.0), dt * 3);

                if (p >= 1.0) {
                    logi.flowTyre.visible = false;
                    logi.activePallet.userData.tyres[logi.tyreCount].visible = true;
                    logi.tyreCount++;
                    logi.kpis.tyres++;

                    if (logi.tyreCount >= 4) {
                        logi.phase = 'wrap';
                        logi.t = 0;
                        // Move pallet to wrap station immediately for visual flow
                        logi.activePallet.position.copy(WAYPOINTS.WRAP);
                    } else {
                        logi.phase = 'retrieve';
                        logi.t = 0;
                    }
                }
                break;

            case 'wrap':
                logi.t += dt;
                if (w && w.wrapRing) {
                    w.wrapRing.rotation.y += dt * 5;
                }
                if (logi.t > 2.0) {
                    logi.phase = 'loadpallet';
                    logi.t = 0;
                }
                break;

            case 'loadpallet':
                // Move pallet to truck
                const targetSlot = new THREE.Vector3().copy(logi.activeTruck.position)
                    .add(logi.activeTruck.userData.palletSlots[logi.palletCount]);
                
                if (moveTo(logi.activePallet.position, targetSlot, 40, dt)) {
                    // Attach to truck
                    logi.sceneGroup.remove(logi.activePallet);
                    logi.activeTruck.add(logi.activePallet);
                    logi.activePallet.position.copy(logi.activeTruck.userData.palletSlots[logi.palletCount]);
                    
                    logi.palletCount++;
                    logi.kpis.pallets++;
                    
                    if (logi.palletCount >= 3) {
                        logi.phase = 'gate';
                        logi.t = 0;
                    } else {
                        logi.tyreCount = 0;
                        logi.activePallet = makePallet();
                        logi.activePallet.position.copy(WAYPOINTS.palletBase);
                        logi.sceneGroup.add(logi.activePallet);
                        logi.phase = 'retrieve';
                    }
                }
                break;

            case 'gate':
                logi.t += dt;
                
                // Drive to gate
                moveTo(logi.activeTruck.position, WAYPOINTS.GATE, 30, dt);

                if (w && w.gateArm) {
                    w.gateArm.rotation.z = approach(w.gateArm.rotation.z, Math.PI / 2, dt * 2);
                }
                if (logi.t > 2.5) { // 1.5s to get there + 1s dwell
                    logi.phase = 'depart';
                    logi.t = 0;
                    logi.routeIdx = 0;
                }
                break;

            case 'depart':
                const routeTarget = ROUTE[logi.routeIdx];
                if (moveTo(logi.activeTruck.position, routeTarget, 50, dt)) {
                    logi.routeIdx++;
                    if (logi.routeIdx >= ROUTE.length) {
                        logi.routeIdx = ROUTE.length - 1; // Cap it
                        if (moveTo(logi.activeTruck.position, CUSTOMER, 50, dt)) {
                            logi.phase = 'delivered';
                            logi.t = 0;
                        } else {
                            faceDir(logi.activeTruck, logi.activeTruck.position, CUSTOMER, dt);
                        }
                    }
                } else {
                    faceDir(logi.activeTruck, logi.activeTruck.position, routeTarget, dt);
                }

                if (w && w.dockDoor) {
                    w.dockDoor.position.y = approach(w.dockDoor.position.y, 0, dt * 2); // Close door
                }
                break;

            case 'delivered':
                logi.t += dt;
                if (logi.t > 1.5) {
                    // Reset
                    logi.kpis.trucks++;
                    logi.sceneGroup.remove(logi.activeTruck);
                    
                    logi.activeTruck = makeTruck();
                    logi.activeTruck.position.copy(WAYPOINTS.TRUCK);
                    logi.sceneGroup.add(logi.activeTruck);
                    
                    logi.tyreCount = 0;
                    logi.palletCount = 0;
                    logi.activePallet = makePallet();
                    logi.activePallet.position.copy(WAYPOINTS.palletBase);
                    logi.sceneGroup.add(logi.activePallet);
                    
                    if (w && w.gateArm) {
                        w.gateArm.rotation.z = 0;
                    }
                    
                    logi.phase = 'retrieve';
                    logi.t = 0;
                }
                break;
        }
    }

    // -------------------------------------------------------------------------
    // API Exposure
    // -------------------------------------------------------------------------
    window.TF.logistics = {
        logi,
        WAYPOINTS,
        ROUTE,
        CUSTOMER,
        buildLogistics,
        updateLogistics,
        getPhaseText: () => {
            const map = {
                'retrieve': 'ASRS RETRIEVAL',
                'qc_scan': 'QC INSPECTION — SCANNING',
                'conveyA': 'CONVEYANCE',
                'conveyB': 'CONVEYANCE',
                'label': 'LABELING — BARCODE APPLIED',
                'conveyC': 'CONVEYANCE',
                'place': 'PALLETIZING',
                'wrap': 'STRETCH WRAPPING PALLET',
                'loadpallet': 'LOADING DOCK',
                'gate': 'SECURITY CHECK — CLEARED',
                'depart': 'IN TRANSIT — GPS TRACKING ACTIVE',
                'delivered': 'DELIVERED TO CUSTOMER'
            };
            return map[logi.phase] || '';
        },
        getPipelineIndex: () => PIPELINE_INDEX[logi.phase] || 0,
        getKPIs: () => logi.kpis,
        getSerial: () => logi.serial
    };

})();
