window.TF = window.TF || {};

(function() {
    const STAGE = { x: 0, z: 40 };
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

    function createRackLabel(text, sub) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 200;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#f97316';
        ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 78px "Segoe UI", Arial, sans-serif';
        ctx.fillText(text, canvas.width / 2, sub ? 78 : 100);
        if (sub) {
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 44px "Segoe UI", Arial, sans-serif';
            ctx.fillText(sub, canvas.width / 2, 148);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 8;
        const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
        const geo = new THREE.PlaneGeometry(30, 5.86);
        return new THREE.Mesh(geo, mat);
    }

    function buildCrane(aisleX, zNear, zFar, height, mastMat) {
        const crane = new THREE.Group();
        const midZ = (zNear + zFar) / 2;
        const railLen = Math.abs(zNear - zFar);
        const statusMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });

        const railGeo = new THREE.BoxGeometry(1.2, 0.4, railLen);
        const railBot = new THREE.Mesh(railGeo, statusMat);
        railBot.position.set(aisleX, 0.3, midZ);
        crane.add(railBot);
        const railTop = new THREE.Mesh(railGeo, mastMat);
        railTop.position.set(aisleX, height + 2, midZ);
        crane.add(railTop);

        const bridge = new THREE.Group();
        const mastGeo = new THREE.BoxGeometry(1.4, height, 1.4);
        [-2.2, 2.2].forEach(dx => {
            const m = new THREE.Mesh(mastGeo, mastMat);
            m.position.set(aisleX + dx, height / 2, 0);
            m.castShadow = false;
            bridge.add(m);
        });

        const carriage = new THREE.Group();
        const car = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.2, 8), mastMat);
        car.position.set(aisleX, 0, 0);
        car.castShadow = false;
        carriage.add(car);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.5, 8.1), statusMat);
        bar.position.set(aisleX, 1.3, 0);
        carriage.add(bar);
        const fork = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 12), mastMat);
        fork.position.set(aisleX, 0, 0);
        carriage.add(fork);

        bridge.add(carriage);
        crane.add(bridge);

        const zMin = Math.min(zNear, zFar) + 6;
        const zMax = Math.max(zNear, zFar) - 6;
        const yMin = 8, yMax = height - 12;

        bridge.position.z = midZ;
        carriage.position.y = (yMin + yMax) / 2;

        cranes.push({
            bridge, carriage, statusMat,
            zMin, zMax, yMin, yMax,
            tz: midZ, ty: (yMin + yMax) / 2,
            dwell: Math.random() * 2, moving: false,
            speedZ: 22 + Math.random() * 10, speedY: 14 + Math.random() * 8
        });
        return crane;
    }

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

    function buildWarehouse(scene) {
        warehouseGroup = new THREE.Group();

        // Floor
        const floorGeo = new THREE.PlaneGeometry(1400, 1400);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x2c3542, roughness: 0.96, metalness: 0.04 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        warehouseGroup.add(floor);

        const grid = new THREE.GridHelper(1400, 70, 0x3b4657, 0x323b48);
        grid.position.y = 0.02;
        grid.material.opacity = 0.5;
        grid.material.transparent = true;
        warehouseGroup.add(grid);

        // Staging pedestal
        const padGeo = new THREE.CylinderGeometry(24, 26, 1.0, 72);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.3, roughness: 0.5 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(STAGE.x, 0.5, STAGE.z);
        pad.receiveShadow = true; pad.castShadow = true;
        warehouseGroup.add(pad);

        const pedestalGeo = new THREE.CylinderGeometry(15, 17, 1.6, 64);
        const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.25, roughness: 0.25 });
        const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
        pedestal.position.set(STAGE.x, 1.3, STAGE.z);
        pedestal.receiveShadow = true; pedestal.castShadow = true;
        warehouseGroup.add(pedestal);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(15.5, 0.3, 16, 90),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        ring.position.set(STAGE.x, 2.1, STAGE.z);
        ring.rotation.x = Math.PI / 2;
        warehouseGroup.add(ring);

        // ASRS Racks
        const uprightMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, metalness: 0.4, roughness: 0.55 });
        const beamMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.3, roughness: 0.5 });
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.5, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
        const mastMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.4 });

        const zFront = -20, zBack = -300, rowLen = 280;
        const rowDepthX = 30, numLevels = 5, levelH = 34;
        const rackHeight = 170, beamThk = 1.8;
        const rowX = [-140, -84, -28, 28, 84, 140];
        const aisleX = [-112, -56, 0, 56, 112];
        const upW = 2.2;

        const pcrSizes = TF.tyre.pcrSizes || [{ name: 'PCR 225/45 R18', r: 10.5, w: 7.0, rim: 6.0 }];
        const rubberMaterial = TF.tyre.rubberMaterial || new THREE.MeshStandardMaterial({ color: 0x111111 });
        const pillarGeo = new THREE.BoxGeometry(upW, rackHeight, upW);
        const upPos = [];

        rowX.forEach((rx, rowIdx) => {
            const spec = pcrSizes[rowIdx % pcrSizes.length];
            const dia = spec.r * 2;
            const thk = spec.w;
            const row = new THREE.Group();
            row.position.set(rx, 0, 0);
            
            const gap = 2.0;
            const cellZ = dia + gap + 2;
            const numBays = Math.max(3, Math.floor(rowLen / cellZ));
            const usedZ = numBays * cellZ;
            const z0 = zFront - (rowLen - usedZ) / 2 - cellZ / 2;
            
            for (let b = 0; b <= numBays; b++) {
                const z = (zFront - (rowLen - usedZ) / 2) - b * cellZ;
                upPos.push([rx - rowDepthX/2, z]);
                upPos.push([rx + rowDepthX/2, z]);
            }
            
            const beamGeo = new THREE.BoxGeometry(2.0, beamThk, usedZ + upW);
            const deckGeo = new THREE.PlaneGeometry(rowDepthX, usedZ);
            for (let L = 0; L < numLevels; L++) {
                const beamY = L * levelH + 2;
                [-rowDepthX/2, rowDepthX/2].forEach(dx => {
                    const bm = new THREE.Mesh(beamGeo, beamMat);
                    bm.position.set(dx, beamY, (zFront - (rowLen - usedZ)/2) - usedZ/2);
                    row.add(bm);
                });
                const deckY = beamY + beamThk / 2;
                const deck = new THREE.Mesh(deckGeo, deckMat);
                deck.rotation.x = -Math.PI / 2;
                deck.position.set(0, deckY, (zFront - (rowLen - usedZ)/2) - usedZ/2);
                row.add(deck);
            }
            
            const tyresHigh = Math.max(2, Math.floor((levelH - beamThk - 4) / thk));
            const geo = TF.tyre.makeStorageTyreGeo ? TF.tyre.makeStorageTyreGeo(spec.r, spec.w, spec.rim) : new THREE.CylinderGeometry(spec.r, spec.r, spec.w, 16);
            const totalInst = numBays * numLevels * tyresHigh;
            const instances = new THREE.InstancedMesh(geo, rubberMaterial, totalInst);
            instances.castShadow = false;
            instances.receiveShadow = false;
            
            const dummy = new THREE.Object3D();
            let idx = 0;
            for (let L = 0; L < numLevels; L++) {
                const deckY = L * levelH + 2 + beamThk / 2;
                const firstY = deckY + thk / 2 + 0.15;
                for (let b = 0; b < numBays; b++) {
                    const cz = z0 - b * cellZ;
                    for (let k = 0; k < tyresHigh; k++) {
                        dummy.position.set(0, firstY + k * thk, cz);
                        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                        dummy.updateMatrix();
                        instances.setMatrixAt(idx++, dummy.matrix);
                    }
                }
            }
            instances.instanceMatrix.needsUpdate = true;
            row.add(instances);
            
            const label = createRackLabel(spec.name ? spec.name.replace('PCR ', '') : 'TYRE', 'ASRS · FINISHED');
            label.position.set(0, rackHeight + 5, zFront + 1);
            row.add(label);
            
            warehouseGroup.add(row);
        });

        const uprights = new THREE.InstancedMesh(pillarGeo, uprightMat, upPos.length);
        const upDummy = new THREE.Object3D();
        upPos.forEach((p, i) => {
            upDummy.position.set(p[0], rackHeight / 2, p[1]);
            upDummy.updateMatrix();
            uprights.setMatrixAt(i, upDummy.matrix);
        });
        uprights.instanceMatrix.needsUpdate = true;
        uprights.castShadow = false;
        uprights.receiveShadow = false;
        warehouseGroup.add(uprights);

        aisleX.forEach(ax => {
            warehouseGroup.add(buildCrane(ax, zFront - 4, zBack + 4, rackHeight, mastMat));
        });

        // 4. NEW: QC Inspection Station
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
        
        const beamGeoL = new THREE.BoxGeometry(14, 0.15, 0.15);
        const beamMatL = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.6 });
        qcBeam = new THREE.Mesh(beamGeoL, beamMatL);
        qcBeam.position.set(0, 15, 0);
        qcGroup.add(qcBeam);
        
        const lightGeo = new THREE.SphereGeometry(1, 16, 16);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        qcLight = new THREE.Mesh(lightGeo, lightMat);
        qcLight.position.set(6, 23, 0);
        qcGroup.add(qcLight);
        
        warehouseGroup.add(qcGroup);

        // 5. NEW: Labeling Station
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.55 });
        const labelGroup = new THREE.Group();
        labelGroup.position.set(72, 0, 5);
        
        const post = new THREE.Mesh(new THREE.BoxGeometry(2, 12, 2), steelMat);
        post.position.set(8, 6, 0);
        labelGroup.add(post);
        
        labelArm = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 1.5), steelMat);
        labelArm.position.set(5, 11, 0);
        labelGroup.add(labelArm);
        
        warehouseGroup.add(labelGroup);

        // 6. NEW: Stretch Wrap Station
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

        // 7. NEW: Security Gate
        const gateGroup = new THREE.Group();
        gateGroup.position.set(72, 0, 130);
        const safetyMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.1, roughness: 0.8 });
        
        const gatePost = new THREE.Mesh(new THREE.BoxGeometry(1.5, 8, 1.5), safetyMat);
        gatePost.position.set(12, 4, 0);
        gateGroup.add(gatePost);
        
        gateArm = new THREE.Group();
        gateArm.position.set(12, 6, 0);
        const armMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 0.8), safetyMat);
        armMesh.position.set(-8, 0, 0);
        gateArm.add(armMesh);
        gateGroup.add(gateArm);
        
        gateBeacon = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
        gateBeacon.position.set(12, 9, 0);
        gateGroup.add(gateBeacon);
        
        const weigh = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 30), steelMat);
        weigh.position.set(0, 0.25, 0);
        gateGroup.add(weigh);
        
        warehouseGroup.add(gateGroup);

        // 8. NEW: Dock Door
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
        
        const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
        dockDoor = new THREE.Mesh(new THREE.BoxGeometry(19, 30, 0.5), rollerMat);
        dockDoor.position.set(0, 15, 0);
        dockGroup.add(dockDoor);
        
        warehouseGroup.add(dockGroup);

        // Enhanced Customer Building
        const custGroup = new THREE.Group();
        custGroup.position.set(-215, 0, 190);
        custGroup.rotation.y = Math.PI / 2;
        
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

        TF.warehouse.warehouseGroup = warehouseGroup;
        TF.warehouse.qcBeam = qcBeam;
        TF.warehouse.qcLight = qcLight;
        TF.warehouse.labelArm = labelArm;
        TF.warehouse.wrapRing = wrapRing;
        TF.warehouse.gateArm = gateArm;
        TF.warehouse.gateBeacon = gateBeacon;
        TF.warehouse.dockDoor = dockDoor;
        
        if (scene) scene.add(warehouseGroup);
        return warehouseGroup;
    }

    TF.warehouse = {
        STAGE, cranes, warehouseGroup,
        qcBeam, qcLight, labelArm, wrapRing,
        gateArm, gateBeacon, dockDoor, dockDoorOpenY,
        buildWarehouse, updateCranes
    };
})();
