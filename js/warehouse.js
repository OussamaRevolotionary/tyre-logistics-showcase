window.TF = window.TF || {};

(function() {
    // Shared Constants
    const STAGE = { x: 0, z: 40 };  // Front staging position for hero tyre
    
    // API objects
    const cranes = [];
    let warehouseGroup = null;
    
    let qcBeam = null;
    let qcLight = null;
    let labelArm = null;
    let wrapRing = null;
    let gateArm = null;
    let gateBeacon = null;
    let dockDoor = null;
    const dockDoorOpenY = 28;

    // Helper functions
    function createRackLabel(text, sub) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        // Dark background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Orange frame
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        
        // Main text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 100px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 20);
        
        // Sub text
        ctx.fillStyle = '#94a3b8';
        ctx.font = '40px sans-serif';
        ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 50);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 16;
        
        const geo = new THREE.PlaneGeometry(30, 6);
        const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        return new THREE.Mesh(geo, mat);
    }

    function buildCrane(aisleX, zNear, zFar, height, mastMat) {
        const craneGroup = new THREE.Group();
        craneGroup.position.x = aisleX;
        
        const statusMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 }); // Cyan
        
        // Floor & top rails
        const railGeo = new THREE.BoxGeometry(2, 2, Math.abs(zFar - zNear));
        const floorRail = new THREE.Mesh(railGeo, statusMat);
        floorRail.position.set(0, 1, (zNear + zFar) / 2);
        craneGroup.add(floorRail);
        
        const topRail = new THREE.Mesh(railGeo, statusMat);
        topRail.position.set(0, height, (zNear + zFar) / 2);
        craneGroup.add(topRail);
        
        // Bridge (moves in Z)
        const bridge = new THREE.Group();
        bridge.position.z = (zNear + zFar) / 2;
        craneGroup.add(bridge);
        
        // Twin masts
        const mastGeo = new THREE.BoxGeometry(4, height, 4);
        const mastL = new THREE.Mesh(mastGeo, mastMat);
        mastL.position.set(-6, height / 2, 0);
        bridge.add(mastL);
        
        const mastR = new THREE.Mesh(mastGeo, mastMat);
        mastR.position.set(6, height / 2, 0);
        bridge.add(mastR);
        
        const topConnect = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 4), mastMat);
        topConnect.position.set(0, height, 0);
        bridge.add(topConnect);
        
        const baseConnect = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 8), mastMat);
        baseConnect.position.set(0, 2, 0);
        bridge.add(baseConnect);
        
        // Carriage (moves in Y)
        const carriage = new THREE.Group();
        carriage.position.y = 10;
        bridge.add(carriage);
        
        const platform = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 12), mastMat);
        carriage.add(platform);
        
        // Fork beam
        const fork = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 4), mastMat);
        fork.position.set(0, 1.5, 0);
        carriage.add(fork);
        
        // Register crane for animation
        cranes.push({
            bridge: bridge,
            carriage: carriage,
            statusMat: statusMat,
            zMin: Math.min(zNear, zFar) + 10,
            zMax: Math.max(zNear, zFar) - 10,
            yMin: 10,
            yMax: height - 10,
            tz: (Math.min(zNear, zFar) + Math.max(zNear, zFar)) / 2,
            ty: (10 + height - 10) / 2,
            dwell: Math.random() * 2,
            moving: false,
            speedZ: 22 + Math.random() * 10,
            speedY: 14 + Math.random() * 8
        });
        
        return craneGroup;
    }

    function buildWarehouse(scene) {
        warehouseGroup = new THREE.Group();
        
        // Shared Materials locally created
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.55 });
        const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, metalness: 0.0, roughness: 0.9 });
        const safetyMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.1, roughness: 0.8 }); // Yellow
        
        // --- 1. Floor ---
        const floorGeo = new THREE.PlaneGeometry(1400, 1400);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x2c3542, roughness: 0.8, metalness: 0.2 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        warehouseGroup.add(floor);
        
        const gridHelper = new THREE.GridHelper(1400, 140, 0x000000, 0x000000);
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        gridHelper.position.y = 0.1;
        warehouseGroup.add(gridHelper);
        
        // Safety line markings
        const safetyLineGeo = new THREE.BoxGeometry(300, 0.2, 2);
        const sl1 = new THREE.Mesh(safetyLineGeo, safetyMat);
        sl1.position.set(0, 0.2, -10);
        warehouseGroup.add(sl1);
        
        // --- 2. Hero Staging Area ---
        const stagingGroup = new THREE.Group();
        stagingGroup.position.set(STAGE.x, 0, STAGE.z);
        
        const pedGeo = new THREE.CylinderGeometry(8, 8, 2, 32);
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.7 });
        const pedestal = new THREE.Mesh(pedGeo, pedMat);
        pedestal.position.y = 1;
        stagingGroup.add(pedestal);
        
        const ringGeo = new THREE.TorusGeometry(10, 0.2, 16, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 }); // Glowing blue
        const glowRing = new THREE.Mesh(ringGeo, ringMat);
        glowRing.rotation.x = -Math.PI / 2;
        glowRing.position.y = 0.5;
        stagingGroup.add(glowRing);
        
        warehouseGroup.add(stagingGroup);
        
        // --- 3. ASRS Layout ---
        const rackXs = [-140, -84, -28, 28, 84, 140];
        const aisleXs = [-112, -56, 0, 56, 112];
        const zFront = -20;
        const zBack = -300;
        const rowLen = 280;
        const rowDepthX = 30;
        const numLevels = 5;
        const levelH = 34;
        const totalHeight = numLevels * levelH;
        
        const uprightMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, metalness: 0.6, roughness: 0.4 });
        const beamMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.4, roughness: 0.6 });
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        const mastMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5, roughness: 0.5 });
        
        // Calculate uprights for InstancedMesh
        const bays = 14;
        const bayLength = rowLen / bays;
        const totalUprights = rackXs.length * (bays + 1) * 2;
        const uprightGeo = new THREE.BoxGeometry(2, totalHeight, 2);
        const uprightsMesh = new THREE.InstancedMesh(uprightGeo, uprightMat, totalUprights);
        
        let uprightIdx = 0;
        const dummy = new THREE.Object3D();
        
        // Build Racks
        rackXs.forEach(xPos => {
            // Label
            const label = createRackLabel(`ROW ${Math.abs(xPos)}`, 'HIGH DENSITY STORAGE');
            label.position.set(xPos, totalHeight + 10, zFront + 2);
            warehouseGroup.add(label);
            
            // Beams and Decks
            for(let level = 1; level <= numLevels; level++) {
                const yPos = level * levelH;
                
                // Front and back beams
                const beamGeo = new THREE.BoxGeometry(2, 2, rowLen);
                const beamF = new THREE.Mesh(beamGeo, beamMat);
                beamF.position.set(xPos - rowDepthX/2 + 1, yPos, zFront - rowLen/2);
                warehouseGroup.add(beamF);
                
                const beamB = new THREE.Mesh(beamGeo, beamMat);
                beamB.position.set(xPos + rowDepthX/2 - 1, yPos, zFront - rowLen/2);
                warehouseGroup.add(beamB);
                
                // Deck
                const dGeo = new THREE.PlaneGeometry(rowDepthX - 2, rowLen);
                const deck = new THREE.Mesh(dGeo, deckMat);
                deck.rotation.x = -Math.PI / 2;
                deck.position.set(xPos, yPos + 1, zFront - rowLen/2);
                warehouseGroup.add(deck);
            }
            
            // Uprights instances
            for (let b = 0; b <= bays; b++) {
                const zP = zFront - (b * bayLength);
                
                dummy.position.set(xPos - rowDepthX/2 + 1, totalHeight/2, zP);
                dummy.updateMatrix();
                uprightsMesh.setMatrixAt(uprightIdx++, dummy.matrix);
                
                dummy.position.set(xPos + rowDepthX/2 - 1, totalHeight/2, zP);
                dummy.updateMatrix();
                uprightsMesh.setMatrixAt(uprightIdx++, dummy.matrix);
            }
        });
        
        warehouseGroup.add(uprightsMesh);
        
        // Cranes
        aisleXs.forEach(aX => {
            warehouseGroup.add(buildCrane(aX, zFront, zBack, totalHeight + 5, mastMat));
        });
        
        // Instanced Tyres
        if (TF.tyre && TF.tyre.makeStorageTyreGeo && TF.tyre.rubberMaterial) {
            const pcrSize = TF.tyre.pcrSizes ? TF.tyre.pcrSizes[0] : { width: 225, aspect: 45, rim: 18 };
            const storageTyreGeo = TF.tyre.makeStorageTyreGeo(pcrSize);
            const rubberMat = TF.tyre.rubberMaterial;
            
            // Estimate capacity
            const tyresPerBay = 6;
            const totalTyres = rackXs.length * bays * numLevels * tyresPerBay;
            
            const tyreMesh = new THREE.InstancedMesh(storageTyreGeo, rubberMat, totalTyres);
            let tIdx = 0;
            
            rackXs.forEach(xPos => {
                for(let level = 1; level <= numLevels; level++) {
                    const yPos = level * levelH + 4; // Above deck
                    for(let b = 0; b < bays; b++) {
                        const startZ = zFront - (b * bayLength) - 4;
                        for(let t = 0; t < tyresPerBay; t++) {
                            if (Math.random() > 0.2) { // 80% fill rate
                                dummy.position.set(
                                    xPos + (Math.random() * 4 - 2),
                                    yPos,
                                    startZ - (t * 3.5)
                                );
                                dummy.rotation.set(Math.PI/2, 0, (Math.random() - 0.5) * 0.5);
                                dummy.updateMatrix();
                                tyreMesh.setMatrixAt(tIdx++, dummy.matrix);
                            }
                        }
                    }
                }
            });
            tyreMesh.count = tIdx; // set actual count
            warehouseGroup.add(tyreMesh);
        }

        // --- 4. NEW: QC Inspection Station ---
        const qcGroup = new THREE.Group();
        qcGroup.position.set(20, 0, zFront + 2);
        
        const archGeo = new THREE.BoxGeometry(2, 20, 2);
        const archMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, metalness: 0.5, roughness: 0.5 });
        const archL = new THREE.Mesh(archGeo, archMat);
        archL.position.set(-8, 10, 0);
        qcGroup.add(archL);
        const archR = new THREE.Mesh(archGeo, archMat);
        archR.position.set(8, 10, 0);
        qcGroup.add(archR);
        const archTop = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 2), archMat);
        archTop.position.set(0, 21, 0);
        qcGroup.add(archTop);
        
        // Laser beam
        const beamGeoL = new THREE.BoxGeometry(14, 0.15, 0.15);
        const beamMatL = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.6 });
        qcBeam = new THREE.Mesh(beamGeoL, beamMatL);
        qcBeam.position.set(0, 15, 0);
        qcGroup.add(qcBeam);
        
        // Status light
        const lightGeo = new THREE.SphereGeometry(1, 16, 16);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        qcLight = new THREE.Mesh(lightGeo, lightMat);
        qcLight.position.set(6, 23, 0);
        qcGroup.add(qcLight);
        
        warehouseGroup.add(qcGroup);

        // --- 5. NEW: Labeling Station ---
        const labelGroup = new THREE.Group();
        labelGroup.position.set(72, 0, 5);
        
        const post = new THREE.Mesh(new THREE.BoxGeometry(2, 12, 2), steelMat);
        post.position.set(8, 6, 0);
        labelGroup.add(post);
        
        labelArm = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 1.5), steelMat);
        labelArm.position.set(5, 11, 0);
        labelGroup.add(labelArm);
        
        warehouseGroup.add(labelGroup);

        // --- 6. NEW: Stretch Wrap Station ---
        const wrapGroup = new THREE.Group();
        wrapGroup.position.set(72, 0, 35);
        
        const wFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
        const wPostL = new THREE.Mesh(new THREE.BoxGeometry(2, 24, 2), wFrameMat);
        wPostL.position.set(-10, 12, 0);
        wrapGroup.add(wPostL);
        const wPostR = new THREE.Mesh(new THREE.BoxGeometry(2, 24, 2), wFrameMat);
        wPostR.position.set(10, 12, 0);
        wrapGroup.add(wPostR);
        const wTop = new THREE.Mesh(new THREE.BoxGeometry(22, 2, 2), wFrameMat);
        wTop.position.set(0, 25, 0);
        wrapGroup.add(wTop);
        
        const ringG = new THREE.TorusGeometry(16, 0.8, 8, 32);
        const ringM = new THREE.MeshStandardMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.15 });
        wrapRing = new THREE.Mesh(ringG, ringM);
        wrapRing.position.set(0, 12, 0);
        wrapGroup.add(wrapRing);
        
        warehouseGroup.add(wrapGroup);

        // --- 7. NEW: Security Gate ---
        const gateGroup = new THREE.Group();
        gateGroup.position.set(72, 0, 85);
        
        const gatePost = new THREE.Mesh(new THREE.BoxGeometry(1.5, 8, 1.5), safetyMat);
        gatePost.position.set(12, 4, 0);
        gateGroup.add(gatePost);
        
        // Pivot group for arm
        gateArm = new THREE.Group();
        gateArm.position.set(12, 6, 0);
        const armMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 0.8), safetyMat);
        armMesh.position.set(-8, 0, 0);
        gateArm.add(armMesh);
        gateGroup.add(gateArm);
        
        // Beacon
        gateBeacon = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
        gateBeacon.position.set(12, 9, 0);
        gateGroup.add(gateBeacon);
        
        // Weighbridge
        const weigh = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 30), steelMat);
        weigh.position.set(0, 0.25, 0);
        gateGroup.add(weigh);
        
        warehouseGroup.add(gateGroup);

        // --- 8. NEW: Dock Door ---
        const dockGroup = new THREE.Group();
        dockGroup.position.set(72, 0, 55);
        
        const frameGeo = new THREE.BoxGeometry(1, 30, 2);
        const dFrameL = new THREE.Mesh(frameGeo, steelMat);
        dFrameL.position.set(-10, 15, 0);
        dockGroup.add(dFrameL);
        
        const dFrameR = new THREE.Mesh(frameGeo, steelMat);
        dFrameR.position.set(10, 15, 0);
        dockGroup.add(dFrameR);
        
        const dTop = new THREE.Mesh(new THREE.BoxGeometry(21, 2, 2), steelMat);
        dTop.position.set(0, 31, 0);
        dockGroup.add(dTop);
        
        // Door panel
        dockDoor = new THREE.Mesh(new THREE.BoxGeometry(19, 30, 0.5), rollerMat);
        dockDoor.position.set(0, 15, 0); // Open Y is 28, closed is 15 (if center is 15 for a 30 height door)
        dockGroup.add(dockDoor);
        
        warehouseGroup.add(dockGroup);

        // --- 9. NEW: Warehouse Ceiling (optional, high up) ---
        const ceilGeo = new THREE.PlaneGeometry(800, 800);
        const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, 190, -100);
        warehouseGroup.add(ceiling);
        
        // Pendant lights
        const plMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
        for(let px = -100; px <= 100; px+= 100) {
            for(let pz = -200; pz <= 0; pz+= 100) {
                const pend = new THREE.Mesh(new THREE.CylinderGeometry(2, 4, 6), plMat);
                pend.position.set(px, 180, pz);
                const pl = new THREE.PointLight(0xfff5e6, 0.5, 300);
                pl.position.set(0, -3, 0);
                pend.add(pl);
                warehouseGroup.add(pend);
            }
        }

        // --- 10. NEW: Road Lane Markings ---
        const roadGroup = new THREE.Group();
        roadGroup.position.set(72, 0.3, 150); // Along Z axis outside dock
        
        const rMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        // Dashed center
        for(let i=0; i<10; i++) {
            const dash = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 4), rMat);
            dash.position.set(0, 0, i * 10 - 45);
            roadGroup.add(dash);
        }
        
        // Solid edges
        const edgeG = new THREE.BoxGeometry(0.5, 0.2, 100);
        const eL = new THREE.Mesh(edgeG, rMat);
        eL.position.set(-12, 0, 0);
        roadGroup.add(eL);
        const eR = new THREE.Mesh(edgeG, rMat);
        eR.position.set(12, 0, 0);
        roadGroup.add(eR);
        
        warehouseGroup.add(roadGroup);

        // --- 11. Enhanced Customer Building ---
        const custGroup = new THREE.Group();
        custGroup.position.set(-80, 0, 100);
        
        const cBGeo = new THREE.BoxGeometry(60, 40, 40);
        const cBMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 });
        const cBuild = new THREE.Mesh(cBGeo, cBMat);
        cBuild.position.y = 20;
        custGroup.add(cBuild);
        
        const cDoor = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 1), steelMat);
        cDoor.position.set(0, 8, -20);
        custGroup.add(cDoor);
        
        const cSign = createRackLabel('CUSTOMER DELIVERY POINT', 'RECEIVING');
        cSign.scale.set(0.8, 0.8, 0.8);
        cSign.position.set(0, 32, -20.5);
        custGroup.add(cSign);
        
        const padGeo = new THREE.BoxGeometry(40, 1, 30);
        const cPad = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ color: 0x64748b }));
        cPad.position.set(0, 0.5, -35);
        custGroup.add(cPad);
        
        warehouseGroup.add(custGroup);

        // Export object references for animations
        TF.warehouse.warehouseGroup = warehouseGroup;
        TF.warehouse.qcBeam = qcBeam;
        TF.warehouse.qcLight = qcLight;
        TF.warehouse.labelArm = labelArm;
        TF.warehouse.wrapRing = wrapRing;
        TF.warehouse.gateArm = gateArm;
        TF.warehouse.gateBeacon = gateBeacon;
        TF.warehouse.dockDoor = dockDoor;
        
        scene.add(warehouseGroup);
        return warehouseGroup;
    }

    // --- Crane Animation (called each frame from main.js) ---
    function approach(cur, target, step) {
        if (Math.abs(target - cur) <= step) return target;
        return cur + Math.sign(target - cur) * step;
    }

    function updateCranes(dt) {
        for (const c of cranes) {
            if (c.moving) {
                c.bridge.position.z = approach(c.bridge.position.z, c.tz, c.speedZ * dt);
                c.carriage.position.y = approach(c.carriage.position.y, c.ty, c.speedY * dt);
                if (c.bridge.position.z === c.tz && c.carriage.position.y === c.ty) {
                    c.moving = false;
                    c.dwell = 0.8 + Math.random() * 2.2;
                    c.statusMat.color.setHex(0x22c55e); // arrived = green
                }
            } else {
                c.dwell -= dt;
                if (c.dwell <= 0) {
                    c.tz = c.zMin + Math.random() * (c.zMax - c.zMin);
                    c.ty = c.yMin + Math.random() * (c.yMax - c.yMin);
                    c.moving = true;
                    c.statusMat.color.setHex(0xf59e0b); // travelling = amber
                }
            }
        }
    }

    TF.warehouse = {
        STAGE,
        cranes,
        warehouseGroup,
        qcBeam,
        qcLight,
        labelArm,
        wrapRing,
        gateArm,
        gateBeacon,
        dockDoor,
        dockDoorOpenY,
        buildWarehouse,
        updateCranes
    };
})();
