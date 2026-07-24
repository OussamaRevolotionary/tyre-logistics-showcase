window.TF = window.TF || {};

(function() {
    const STAGE = { x: 0, z: 40 };
    const cranes = [];
    let warehouseGroup = null;

    let qcBeam = null;
    let qcLight = null;
    let qcField = null;
    let labelArm = null;
    let wrapRing = null;
    let gateArm = null;
    let gateBeacon = null;
    let dockDoor = null;
    let dockLight = null;
    const dockDoorOpenY = 28;

    // Ambient animation state (updateStations) — no per-frame allocations
    let ambT = 0;
    const LABEL_BASE_Y = 15;   // rest Y of the labeling applicator assembly
    const DOCK_BASE_Y = 15;    // rest Y of the roll-up dock door

    function createRackLabel(text, sub) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 200;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#38bdf8';
        ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 78px "Inter", Arial, sans-serif';
        ctx.fillText(text, canvas.width / 2, sub ? 78 : 100);
        if (sub) {
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 44px "Inter", Arial, sans-serif';
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

        const busy = Math.abs(aisleX) < 0.001; // central aisle (x=0) — bias to keep working
        cranes.push({
            bridge, carriage, statusMat,
            zMin, zMax, yMin, yMax,
            tz: midZ, ty: (yMin + yMax) / 2,
            dwell: busy ? 0.1 : Math.random() * 2, moving: false, busy,
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
                    // central-aisle crane barely pauses so the ASRS stop always shows work
                    c.dwell = c.busy ? (0.15 + Math.random() * 0.35) : (0.8 + Math.random() * 2.2);
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

    // Continuous ambient motion for EVERY station, independent of the flow-tyre
    // state machine, so a tour camera parked at any stop always sees life.
    // Cheap: scalar math only, no per-frame allocations. Guards against
    // double-driving parts that logistics is actively animating.
    function updateStations(dt) {
        ambT += dt;
        const lp = (window.TF.logistics && window.TF.logistics.logi) ? window.TF.logistics.logi.phase : '';

        // QC — green laser bar sweeps vertically through the gantry + field flicker
        if (qcBeam) {
            const s = Math.sin(ambT * 2.2) * 0.5 + 0.5; // 0..1
            qcBeam.position.y = 7 + s * 12;             // sweep y 7..19 (scan-plane ~15)
            if (qcBeam.material) qcBeam.material.opacity = 0.55 + 0.35 * Math.abs(Math.sin(ambT * 9));
        }
        if (qcField && qcField.material) {
            qcField.material.opacity = 0.06 + 0.05 * (Math.sin(ambT * 2.2) * 0.5 + 0.5);
        }
        if (qcLight && qcLight.material) {
            qcLight.material.emissiveIntensity = 0.55 + 0.55 * (Math.sin(ambT * 3.0) * 0.5 + 0.5);
        }

        // Labeling — gentle idle bob (logistics owns it while actually tapping)
        if (labelArm && lp !== 'label') {
            labelArm.position.y = LABEL_BASE_Y + Math.sin(ambT * 1.6) * 0.35;
        }

        // Stretch-wrap — slow film-ring spin (logistics spins it during 'wrap')
        if (wrapRing && lp !== 'wrap') {
            wrapRing.rotation.y += dt * 1.6;
        }

        // Security gate — amber beacon pulse
        if (gateBeacon && gateBeacon.material) {
            const p = Math.sin(ambT * 4.0) * 0.5 + 0.5;
            gateBeacon.material.emissiveIntensity = 0.35 + 0.9 * (p * p);
        }

        // Dock — ready-light pulse + subtle door "breathing"
        if (dockLight && dockLight.material) {
            dockLight.material.emissiveIntensity = 0.4 + 0.6 * (Math.sin(ambT * 2.6) * 0.5 + 0.5);
        }
        if (dockDoor) {
            dockDoor.position.y = DOCK_BASE_Y + Math.sin(ambT * 1.1) * 0.25;
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

        const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.55 });

        // 4. QC INSPECTION — scanning gantry: 2 uprights + top beam, green
        //    laser scan-plane (sweeps in updateStations) + pass/fail indicator.
        const qcGroup = new THREE.Group();
        qcGroup.position.set(20, 0, -18);                       // anchor (20,12,-18)

        const gantryMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
        const qcAccentMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, metalness: 0.5, roughness: 0.5 });
        [-9, 9].forEach(dx => {
            const foot = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 5), gantryMat);
            foot.position.set(dx, 0.5, 0); qcGroup.add(foot);
            const upright = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 2), qcAccentMat);
            upright.position.set(dx, 11, 0); qcGroup.add(upright);
        });
        const qcTop = new THREE.Mesh(new THREE.BoxGeometry(20, 2.4, 2.4), qcAccentMat);
        qcTop.position.set(0, 21, 0); qcGroup.add(qcTop);
        const qcStrip = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 0.4), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
        qcStrip.position.set(0, 21, 1.3); qcGroup.add(qcStrip);

        // faint static scan field (opacity flickers in updateStations)
        qcField = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 13),
            new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
        );
        qcField.position.set(0, 13.5, 0); qcGroup.add(qcField);

        // bright green laser bar that sweeps vertically (updateStations)
        qcBeam = new THREE.Mesh(
            new THREE.BoxGeometry(16.5, 0.35, 0.5),
            new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.8 })
        );
        qcBeam.position.set(0, 15, 0); qcGroup.add(qcBeam);

        // pass / fail indicator stack on the beam
        const qcHousing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 2), gantryMat);
        qcHousing.position.set(7, 22.6, 0); qcGroup.add(qcHousing);
        qcLight = new THREE.Mesh(
            new THREE.SphereGeometry(1, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.8 })
        );
        qcLight.position.set(7, 24, 0); qcGroup.add(qcLight);
        const qcFail = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.12 })
        );
        qcFail.position.set(7, 21.8, 0); qcGroup.add(qcFail);

        const qcSign = createRackLabel('QC SCAN', 'IN-LINE INSPECTION');
        qcSign.scale.set(0.5, 0.5, 0.5);
        qcSign.position.set(0, 25.8, 0); qcGroup.add(qcSign);

        warehouseGroup.add(qcGroup);

        // 5. LABELING — post + printer/dispenser + applicator arm that taps
        //    down onto the passing tyre (logistics drives the tap in 'label').
        const labelGroup = new THREE.Group();
        labelGroup.position.set(72, 0, 5);                       // anchor (72,11,5)

        const lPost = new THREE.Mesh(new THREE.BoxGeometry(2.5, 15, 2.5), steelMat);
        lPost.position.set(11, 7.5, 0); labelGroup.add(lPost);

        const printer = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 5),
            new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.5 }));
        printer.position.set(11, 13, 0); labelGroup.add(printer);
        const barStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 4), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
        barStrip.position.set(7.9, 13, 0); labelGroup.add(barStrip);
        const labelRoll = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 16),
            new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 }));
        labelRoll.rotation.x = Math.PI / 2; labelRoll.position.set(11, 16.2, 0); labelGroup.add(labelRoll);

        // applicator assembly (moves down to tap the tyre; idle-bobs in updateStations)
        labelArm = new THREE.Group();
        labelArm.position.set(11, LABEL_BASE_Y, 0);
        const lArm = new THREE.Mesh(new THREE.BoxGeometry(11, 1.4, 1.4), steelMat);
        lArm.position.set(-5.5, 0, 0); labelArm.add(lArm);
        const lHead = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 3),
            new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.5, roughness: 0.4 }));
        lHead.position.set(-10.5, -1.5, 0); labelArm.add(lHead);
        const lTip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.6), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
        lTip.position.set(-10.5, -3.2, 0); labelArm.add(lTip);
        labelGroup.add(labelArm);

        const labelSign = createRackLabel('LABELING', 'BARCODE / SERIAL');
        labelSign.scale.set(0.45, 0.45, 0.45);
        labelSign.position.set(0, 18.5, 0); labelGroup.add(labelSign);

        warehouseGroup.add(labelGroup);

        // 6. STRETCH-WRAP — film ring on a frame that rotates around the pallet.
        const wrapGroup = new THREE.Group();
        wrapGroup.position.set(72, 0, 35);                       // anchor (72,12,35)

        const wFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
        const wBase = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 1.5, 32), wFrameMat);
        wBase.position.set(0, 0.75, 0); wrapGroup.add(wBase);
        [-15, 15].forEach(dx => {
            const wPost = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), wFrameMat);
            wPost.position.set(dx, 13, 0); wrapGroup.add(wPost);
        });
        const wTop = new THREE.Mesh(new THREE.BoxGeometry(32, 2, 2), wFrameMat);
        wTop.position.set(0, 26, 0); wrapGroup.add(wTop);

        // rotating film ring assembly (spun in 'wrap' by logistics + ambient idle)
        wrapRing = new THREE.Group();
        wrapRing.position.set(0, 12, 0);
        const ringTorus = new THREE.Mesh(
            new THREE.TorusGeometry(16, 0.7, 10, 40),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.4, roughness: 0.4, emissive: 0x0e4b63, emissiveIntensity: 0.4 })
        );
        ringTorus.rotation.x = Math.PI / 2; wrapRing.add(ringTorus);
        const wCarriage = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), wFrameMat);
        wCarriage.position.set(16, 0, 0); wrapRing.add(wCarriage);
        const wFilm = new THREE.Mesh(
            new THREE.CylinderGeometry(15.6, 15.6, 11, 24, 1, true),
            new THREE.MeshBasicMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
        );
        wrapRing.add(wFilm);
        wrapGroup.add(wrapRing);

        warehouseGroup.add(wrapGroup);

        // 7. SECURITY GATE + WEIGHBRIDGE — boom barrier (pivot 84,7,130,
        //    lifts to vertical in logistics transit) over a weighbridge slab.
        const gateGroup = new THREE.Group();
        gateGroup.position.set(72, 0, 130);                      // anchor (72,6,130)
        const safetyMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.2, roughness: 0.7 });

        const weigh = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 26),
            new THREE.MeshStandardMaterial({ color: 0x2b3441, metalness: 0.5, roughness: 0.6 }));
        weigh.position.set(0, 0.6, 0); weigh.receiveShadow = true; gateGroup.add(weigh);
        [-13, 13].forEach(dz => {
            const edge = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 1), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
            edge.position.set(0, 1.25, dz); gateGroup.add(edge);
        });

        const gatePost = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 2), safetyMat);
        gatePost.position.set(12, 5, 0); gateGroup.add(gatePost);

        // striped boom arm — pivot at local (12,7,0) = world (84,7,130), reaches -x across the road
        gateArm = new THREE.Group();
        gateArm.position.set(12, 7, 0);
        for (let i = 0; i < 8; i++) {
            const seg = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 0.9),
                new THREE.MeshStandardMaterial({ color: i % 2 ? 0xef4444 : 0xf8fafc, metalness: 0.1, roughness: 0.7 }));
            seg.position.set(-1 - i * 2, 0, 0); gateArm.add(seg);
        }
        gateGroup.add(gateArm);

        const beaconHousing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), steelMat);
        beaconHousing.position.set(12, 10.4, 0); gateGroup.add(beaconHousing);
        gateBeacon = new THREE.Mesh(
            new THREE.SphereGeometry(1, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6 })
        );
        gateBeacon.position.set(12, 11.5, 0); gateGroup.add(gateBeacon);

        // weighbridge readout post
        const roPost = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8, 1.2), steelMat);
        roPost.position.set(-14, 4, 10); gateGroup.add(roPost);
        const roScreen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 5), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
        roScreen.position.set(-13.7, 7, 10); gateGroup.add(roScreen);

        const gateSign = createRackLabel('SECURITY GATE', 'WEIGHBRIDGE');
        gateSign.scale.set(0.5, 0.5, 0.5);
        gateSign.position.set(0, 13.5, 0); gateGroup.add(gateSign);

        warehouseGroup.add(gateGroup);

        // 8. DOCK DOOR — roll-up slat door with side rails, header, ready light.
        const dockGroup = new THREE.Group();
        dockGroup.position.set(72, 0, 55);                       // anchor (72,15,55)

        [-10, 10].forEach(dx => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 30, 3), steelMat);
            rail.position.set(dx, 15, 0); dockGroup.add(rail);
        });
        const dTop = new THREE.Mesh(new THREE.BoxGeometry(23, 3, 3), steelMat);
        dTop.position.set(0, 31, 0); dockGroup.add(dTop);

        // roll-up curtain built from stacked slats (breathes in updateStations)
        dockDoor = new THREE.Group();
        dockDoor.position.set(0, DOCK_BASE_Y, 0);
        const slatMatA = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.35 });
        const slatMatB = new THREE.MeshStandardMaterial({ color: 0x7c8a9c, metalness: 0.7, roughness: 0.4 });
        for (let i = 0; i < 10; i++) {
            const slat = new THREE.Mesh(new THREE.BoxGeometry(19, 2.6, 0.6), i % 2 ? slatMatB : slatMatA);
            slat.position.set(0, -13.5 + i * 3, 0); dockDoor.add(slat);
        }
        dockGroup.add(dockDoor);

        const dockHousing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), steelMat);
        dockHousing.position.set(12, 28, 1.5); dockGroup.add(dockHousing);
        dockLight = new THREE.Mesh(
            new THREE.SphereGeometry(1, 14, 14),
            new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.6 })
        );
        dockLight.position.set(12, 28, 2.4); dockGroup.add(dockLight);
        [-8, 8].forEach(dx => {
            const bump = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.9 }));
            bump.position.set(dx, 1, 3); dockGroup.add(bump);
        });
        const dockSign = createRackLabel('SHIPPING DOCK', 'LOAD BAY 01');
        dockSign.scale.set(0.55, 0.55, 0.55);
        dockSign.position.set(0, 34, 0); dockGroup.add(dockSign);

        warehouseGroup.add(dockGroup);

        // NOTE: the single canonical CUSTOMER building (anchor -215,20,190) is built
        // in logistics.js (co-located with the delivery road). The duplicate that used
        // to live here has been removed per BUILD CONTRACT bug #1.

        TF.warehouse.warehouseGroup = warehouseGroup;
        TF.warehouse.qcBeam = qcBeam;
        TF.warehouse.qcLight = qcLight;
        TF.warehouse.qcField = qcField;
        TF.warehouse.labelArm = labelArm;
        TF.warehouse.wrapRing = wrapRing;
        TF.warehouse.gateArm = gateArm;
        TF.warehouse.gateBeacon = gateBeacon;
        TF.warehouse.dockDoor = dockDoor;
        TF.warehouse.dockLight = dockLight;
        
        if (scene) scene.add(warehouseGroup);
        return warehouseGroup;
    }

    TF.warehouse = {
        STAGE, cranes, warehouseGroup,
        qcBeam, qcLight, qcField, labelArm, wrapRing,
        gateArm, gateBeacon, dockDoor, dockLight, dockDoorOpenY,
        buildWarehouse, updateCranes, updateStations
    };
})();
