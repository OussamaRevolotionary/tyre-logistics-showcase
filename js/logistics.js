window.TF = window.TF || {};

(function() {
    const kpis = { tyres: 0, pallets: 0, trucks: 0 };
    
    // Shared materials (copy exactly):
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.55 });
    const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, metalness: 0.0, roughness: 0.9 });
    const truckCabMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.4, roughness: 0.4 });
    const truckBoxMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.2, roughness: 0.6 });
    const tyreDarkMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.12, roughness: 0.82 });
    const releasedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

    const FLOW_SPEC = { r: 10.5, w: 7.0, rim: 6.0, depth: 0.32 };
    
    // Retrieve geometry later
    let FLOW_TYRE_GEO;

    function getTyreGeo() {
        if (!FLOW_TYRE_GEO) {
            FLOW_TYRE_GEO = (window.TF.tyre && window.TF.tyre.FLOW_TYRE_GEO) || new THREE.TorusGeometry(3.5, 1.5, 16, 32);
        }
        return FLOW_TYRE_GEO;
    }

    const logi = {
        phase: 'retrieve', t: 0, count: 0, loaded: 0,
        TRUCK_CAP: 3, routeIdx: 0, serial: 100427,
        OUT: null, QC: null, CORNER: null, LABEL: null,
        PALLET: null, palletBase: null, WRAP: null,
        TRUCK: null, GATE: null, route: null, CUSTOMER: null,
        tyre: null, tyreTag: null, truck: null,
        activePallet: null, robot: null, group: null,
        driveTargets: null, gateIdx: 1
    };

    function makePallet() {
        const g = new THREE.Group();
        const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 26), woodMat);
        deck.position.y = 2.2; deck.castShadow = true; deck.receiveShadow = true;
        g.add(deck);
        [-9, 0, 9].forEach(px => [-9, 9].forEach(pz => {
            const foot = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 2.5), woodMat);
            foot.position.set(px, 1.1, pz);
            g.add(foot);
        }));
        g.userData.tyres = [];
        for (let k = 0; k < 4; k++) {
            const t = new THREE.Mesh(getTyreGeo(), tyreDarkMat);
            t.position.set(0, 3 + FLOW_SPEC.w / 2 + k * FLOW_SPEC.w, 0);
            t.rotation.y = Math.random() * Math.PI;
            t.castShadow = false; t.visible = false;
            g.add(t);
            g.userData.tyres.push(t);
        }
        return g;
    }

    function makeTruck() {
        const g = new THREE.Group();
        const bed = new THREE.Mesh(new THREE.BoxGeometry(34, 3, 96), steelMat);
        bed.position.set(0, 7, -6); bed.castShadow = true; bed.receiveShadow = true;
        g.add(bed);
        const head = new THREE.Mesh(new THREE.BoxGeometry(34, 20, 2), truckBoxMat);
        head.position.set(0, 18, 40); g.add(head);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(34.4, 4, 2.4),
                      new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.3, roughness: 0.5 }));
        stripe.position.set(0, 22, 40); g.add(stripe);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(32, 18, 20), truckCabMat);
        cab.position.set(0, 12, 52); cab.castShadow = true; g.add(cab);
        const wind = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 1.5),
                     new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.2 }));
        wind.position.set(0, 16, 62.2); g.add(wind);
        const wheelGeo = new THREE.CylinderGeometry(5, 5, 4, 18);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.9 });
        [[-16, -40], [16, -40], [-16, -24], [16, -24], [-16, 44], [16, 44]].forEach(([x, z]) => {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            w.rotation.z = Math.PI / 2; w.position.set(x, 5, z);
            w.castShadow = true; g.add(w);
        });
        g.userData.pallets = [];
        return g;
    }

    function makeSign(line1, line2) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, 1024, 256);
        ctx.lineWidth = 16; ctx.strokeStyle = '#22c55e'; ctx.strokeRect(8, 8, 1008, 240);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 90px "Inter", Arial, sans-serif';
        ctx.fillText(line1, 512, 100);
        ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 54px "Inter", Arial, sans-serif';
        ctx.fillText(line2, 512, 180);
        const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 8;
        return new THREE.Mesh(new THREE.PlaneGeometry(48, 12),
                      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    }

    function approach(cur, target, step) {
        if (Math.abs(target - cur) <= step) return target;
        return cur + Math.sign(target - cur) * step;
    }
    
    function moveTo(pos, target, speed, dt) {
        const d = target.clone().sub(pos);
        const dist = d.length();
        const step = speed * dt;
        if (dist <= step || dist < 0.001) { pos.copy(target); return true; }
        pos.addScaledVector(d.normalize(), step);
        return false;
    }
    
    function faceDir(obj, from, to, dt) {
        const targetA = Math.atan2(to.x - from.x, to.z - from.z);
        let da = targetA - obj.rotation.y;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        obj.rotation.y += approach(0, da, 3.0 * dt);
    }

    function buildLogistics(scene) {
        const asrsFrontZ = -20;
        const bedTopY = 6;
        const tyreY = bedTopY + FLOW_SPEC.w / 2 + 0.2;

        logi.OUT = new THREE.Vector3(0, tyreY, asrsFrontZ + 2);
        logi.QC = new THREE.Vector3(20, tyreY, asrsFrontZ + 2);
        logi.CORNER = new THREE.Vector3(72, tyreY, asrsFrontZ + 2);
        logi.LABEL = new THREE.Vector3(72, tyreY, 5);
        logi.PALLET = new THREE.Vector3(72, tyreY, 22);
        logi.palletBase = new THREE.Vector3(72, 0, 22);
        logi.WRAP = new THREE.Vector3(72, 0, 35);
        logi.TRUCK = new THREE.Vector3(72, 0, 66);
        logi.GATE = new THREE.Vector3(72, 0, 130);
        logi.route = [
            new THREE.Vector3(72, 0, 90),
            new THREE.Vector3(72, 0, 170),
            new THREE.Vector3(-30, 0, 180),
            new THREE.Vector3(-170, 0, 188)
        ];
        logi.CUSTOMER = new THREE.Vector3(-215, 0, 190);
        
        const g = new THREE.Group();
        
        // L-shaped roller conveyor
        const bedH = 4;
        const legA = new THREE.Mesh(new THREE.BoxGeometry(logi.CORNER.x + 10, bedH, 10), steelMat);
        legA.position.set(logi.CORNER.x / 2, bedTopY - bedH / 2, logi.OUT.z);
        legA.castShadow = true; legA.receiveShadow = true; g.add(legA);
        const legBlen = logi.PALLET.z - logi.OUT.z;
        const legB = new THREE.Mesh(new THREE.BoxGeometry(10, bedH, legBlen + 10), steelMat);
        legB.position.set(logi.CORNER.x, bedTopY - bedH / 2, (logi.OUT.z + logi.PALLET.z) / 2);
        legB.castShadow = true; legB.receiveShadow = true; g.add(legB);
        for (let x = 6; x < logi.CORNER.x; x += 7) {
            const r = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 10, 10), rollerMat);
            r.rotation.x = Math.PI / 2; r.position.set(x, bedTopY + 0.1, logi.OUT.z); g.add(r);
        }
        for (let z = logi.OUT.z + 6; z < logi.PALLET.z; z += 7) {
            const r = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 10, 10), rollerMat);
            r.rotation.z = Math.PI / 2; r.position.set(logi.CORNER.x, bedTopY + 0.1, z); g.add(r);
        }
        
        // Robotic palletizer — articulated arm: base + shoulder + forearm + gripper.
        // Anchor: base (60,3,22), arm reaches over the pallet at (72,·,22).
        // Keeps the swing hooks logistics drives in 'place': robot.shoulder.rotation.y
        // and robot.elbow.rotation.x.
        const jointMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.5, roughness: 0.4 });
        const rBase = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 5, 24), steelMat);
        rBase.position.set(60, 2.5, 22); rBase.castShadow = true; g.add(rBase);
        const rColumn = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 8, 20), jointMat);
        rColumn.position.set(60, 7, 22); rColumn.castShadow = true; g.add(rColumn);

        const shoulder = new THREE.Group();
        shoulder.position.set(60, 11, 22);                       // swings about Y
        const shoulderHub = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.6, 5), steelMat);
        shoulder.add(shoulderHub);
        const upperArm = new THREE.Mesh(new THREE.BoxGeometry(14, 3.4, 3.4), jointMat);
        upperArm.position.set(7, 0.5, 0); upperArm.castShadow = true; shoulder.add(upperArm);

        const elbow = new THREE.Group();
        elbow.position.set(13, 0.5, 0);                          // pitches about X
        const elbowHub = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.8, 3.8), steelMat);
        elbow.add(elbowHub);
        const forearm = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 3), jointMat);
        forearm.position.set(0, -3.5, 0); forearm.castShadow = true; elbow.add(forearm);
        const wrist = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.6, 3.8), steelMat);
        wrist.position.set(0, -7.4, 0); elbow.add(wrist);
        [-1.4, 1.4].forEach(gx => {                             // two-finger gripper
            const finger = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, 3), steelMat);
            finger.position.set(gx, -9.2, 0); elbow.add(finger);
        });
        const toolLight = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 10), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
        toolLight.position.set(0, -8.2, 0); elbow.add(toolLight);
        shoulder.add(elbow);
        g.add(shoulder);
        logi.robot = { shoulder, elbow };
        
        const dock = new THREE.Mesh(new THREE.BoxGeometry(40, 4, 40), steelMat);
        dock.position.set(72, 2, 50); dock.receiveShadow = true; g.add(dock);
        
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e2530, roughness: 0.95, metalness: 0.02 });
        const pts = [logi.TRUCK, ...logi.route, logi.CUSTOMER];
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const len = a.distanceTo(b);
            const seg = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, len), roadMat);
            seg.position.set((a.x + b.x) / 2, 0.15, (a.z + b.z) / 2);
            seg.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
            seg.receiveShadow = true; g.add(seg);
        }
        
        // ===== Single canonical CUSTOMER delivery building (BUILD CONTRACT bug #1) =====
        // Anchored at the delivery point (-215,20,190). Body sits just west so its
        // receiving face + apron are centered on the anchor where the truck parks;
        // the roll-up door + sign face east toward the incoming delivery road.
        const cust = new THREE.Group();
        cust.position.copy(logi.CUSTOMER);                       // (-215,0,190)
        const bMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.2, roughness: 0.75 });
        const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3, roughness: 0.6 });

        const building = new THREE.Mesh(new THREE.BoxGeometry(55, 40, 60), bMat);
        building.position.set(-32, 20, 0); building.receiveShadow = true; cust.add(building);
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(59, 3, 64), trimMat);
        parapet.position.set(-32, 41.5, 0); cust.add(parapet);
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 60), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
        band.position.set(-4.4, 30, 0); cust.add(band);

        // receiving-dock canopy over the door (faces the incoming road, +x)
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 30), trimMat);
        canopy.position.set(2, 24, 0); cust.add(canopy);

        // roll-up receiving door on the east face
        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 26, 30), steelMat);
        doorFrame.position.set(-4.6, 13, 0); cust.add(doorFrame);
        const rcDoor = new THREE.Group(); rcDoor.position.set(-4, 12, 0);
        const dSlatA = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.35 });
        const dSlatB = new THREE.MeshStandardMaterial({ color: 0x7c8a9c, metalness: 0.7, roughness: 0.4 });
        for (let i = 0; i < 8; i++) {
            const slat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.6, 26), i % 2 ? dSlatB : dSlatA);
            slat.position.set(0, -10 + i * 3, 0); rcDoor.add(slat);
        }
        cust.add(rcDoor);

        // receiving apron/pad the truck parks on, centered on the delivery anchor
        const apron = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 44),
                     new THREE.MeshStandardMaterial({ color: 0x3a4451, metalness: 0.2, roughness: 0.85 }));
        apron.position.set(19, 0.3, 0); apron.receiveShadow = true; cust.add(apron);
        [-15, 15].forEach(dz => {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 1), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
            stripe.position.set(20, 0.6, dz); cust.add(stripe);
        });
        [-13, 13].forEach(dz => {
            const bump = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 3), new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.9 }));
            bump.position.set(-3.5, 2, dz); cust.add(bump);
        });

        // "CUSTOMER — DELIVERY POINT" sign above the door, facing the incoming road (+x)
        const sign = makeSign('CUSTOMER', 'DELIVERY POINT');
        sign.rotation.y = Math.PI / 2;
        sign.position.set(-3, 33, 0); cust.add(sign);
        g.add(cust);
        
        logi.tyre = new THREE.Mesh(getTyreGeo(), tyreDarkMat);
        logi.tyre.castShadow = true; logi.tyre.visible = false;
        g.add(logi.tyre);
        logi.tyreTag = new THREE.Mesh(new THREE.TorusGeometry(FLOW_SPEC.r + 0.4, 0.35, 10, 40), releasedMat);
        logi.tyreTag.rotation.x = Math.PI / 2; logi.tyreTag.visible = false; g.add(logi.tyreTag);
        
        logi.truck = makeTruck();
        logi.truck.position.copy(logi.TRUCK);
        logi.truck.rotation.y = 0;
        g.add(logi.truck);
        
        logi.activePallet = makePallet();
        logi.activePallet.position.copy(logi.palletBase);
        g.add(logi.activePallet);
        
        scene.add(g);
        logi.group = g;
        
        logi.phase = 'retrieve';
        logi.t = 0;
        logi.count = 0;
        logi.loaded = 0;
        logi.TRUCK_CAP = 3;
        logi.routeIdx = 0;
        logi.serial = 100427;
    }

    const PIPELINE_INDEX = {
        'retrieve': 0, 'qc_scan': 1,
        'conveyA': 2, 'conveyB': 2,
        'label': 3, 'conveyC': 4, 'place': 4,
        'wrap': 5, 'loadpallet': 6,
        'gate': 7, 'depart': 7,
        'delivered': 8
    };

    function updateLogistics(dt) {
        if (!logi.group) return;
        logi.t += dt;
        const w = FLOW_SPEC.w;

        // Ambient palletizer idle sway so the robot always shows life when a tour
        // camera is parked here — the 'place' phase overrides this with the real cycle.
        if (logi.robot && logi.phase !== 'place') {
            logi.robot.shoulder.rotation.y = Math.sin(logi.t * 0.8) * 0.15;
            logi.robot.elbow.rotation.x = Math.sin(logi.t * 0.8 + 0.5) * 0.1;
        }

        switch (logi.phase) {
            case 'retrieve': {
                if (logi.t > 1.1) {
                    logi.tyre.position.copy(logi.OUT);
                    logi.tyre.visible = true; logi.tyreTag.visible = false; 
                    logi.phase = 'qc_scan'; logi.t = 0;
                }
                break;
            }
            case 'qc_scan': {
                const done = moveTo(logi.tyre.position, logi.QC, 50, dt);
                // QC laser sweep + indicator are driven continuously by
                // TF.warehouse.updateStations (ambient), so nothing to drive here.
                if (done) {
                    if (window.TF.warehouse && window.TF.warehouse.qcLight) {
                         window.TF.warehouse.qcLight.material.color.setHex(0x22c55e); // pass
                    }
                    logi.tyreTag.position.copy(logi.tyre.position);
                    logi.tyreTag.visible = true;
                    logi.phase = 'conveyA';
                    logi.t = 0;
                }
                break;
            }
            case 'conveyA': {
                logi.tyre.rotation.y += dt * 3;
                const done = moveTo(logi.tyre.position, logi.CORNER, 60, dt);
                logi.tyreTag.position.copy(logi.tyre.position);
                if (done) logi.phase = 'conveyB';
                break;
            }
            case 'conveyB': {
                logi.tyre.rotation.y += dt * 3;
                const done = moveTo(logi.tyre.position, logi.LABEL, 60, dt);
                logi.tyreTag.position.copy(logi.tyre.position);
                if (done) {
                    logi.phase = 'label'; logi.t = 0;
                }
                break;
            }
            case 'label': {
                // Press the applicator down onto the tyre (rest Y = 15), then release.
                if (window.TF.warehouse && window.TF.warehouse.labelArm) {
                    window.TF.warehouse.labelArm.position.y = 15 - Math.max(0, Math.sin(logi.t * 12)) * 1.8;
                }
                if (logi.t > 0.8) {
                    logi.phase = 'conveyC'; logi.t = 0;
                }
                break;
            }
            case 'conveyC': {
                logi.tyre.rotation.y += dt * 3;
                const done = moveTo(logi.tyre.position, logi.PALLET, 60, dt);
                logi.tyreTag.position.copy(logi.tyre.position);
                if (done) { logi.phase = 'place'; logi.t = 0; }
                break;
            }
            case 'place': {
                logi.robot.shoulder.rotation.y = Math.sin(logi.t * 4) * 0.5;
                logi.robot.elbow.rotation.x = Math.sin(logi.t * 4 + 1) * 0.3;
                const stackY = 3 + w / 2 + logi.count * w;
                const target = new THREE.Vector3(logi.palletBase.x, stackY, logi.palletBase.z);
                const done = moveTo(logi.tyre.position, target, 42, dt);
                logi.tyreTag.position.copy(logi.tyre.position);
                if (done) {
                    kpis.tyres++;
                    logi.activePallet.userData.tyres[logi.count].visible = true;
                    logi.tyre.visible = false; logi.tyreTag.visible = false;
                    logi.count++; logi.serial++;
                    logi.robot.shoulder.rotation.y = 0; logi.robot.elbow.rotation.x = 0;
                    if (logi.count >= 4) {
                        logi.phase = 'wrap'; logi.t = 0;
                    } else {
                        logi.phase = 'retrieve'; logi.t = 0;
                    }
                }
                break;
            }
            case 'wrap': {
                if (window.TF.warehouse && window.TF.warehouse.wrapRing) {
                    window.TF.warehouse.wrapRing.rotation.y += dt * 10;
                }
                const done = moveTo(logi.activePallet.position, logi.WRAP, 30, dt);
                if (done && logi.t > 2.0) {
                    logi.phase = 'loadpallet'; logi.t = 0;
                }
                break;
            }
            case 'loadpallet': {
                const slotZlocal = -28 + logi.loaded * 28;
                const slotWorld = new THREE.Vector3(logi.TRUCK.x, 8.5, logi.TRUCK.z - slotZlocal);
                const done = moveTo(logi.activePallet.position, slotWorld, 40, dt);
                if (done) {
                    logi.truck.updateMatrixWorld(true);
                    const local = logi.truck.worldToLocal(logi.activePallet.position.clone());
                    logi.group.remove(logi.activePallet);
                    logi.activePallet.position.copy(local);
                    logi.truck.add(logi.activePallet);
                    logi.truck.userData.pallets.push(logi.activePallet);
                    logi.loaded++;
                    kpis.pallets++;
                    
                    if (logi.loaded < logi.TRUCK_CAP) {
                        logi.activePallet = makePallet();
                        logi.activePallet.position.copy(logi.palletBase);
                        logi.group.add(logi.activePallet);
                        logi.count = 0;
                        logi.phase = 'retrieve';
                    } else {
                        // Strictly monotonic route (no backtracking):
                        // 66 -> 90 -> 130(gate) -> 170 -> (-30,180) -> (-170,188) -> customer(-215,190)
                        logi.driveTargets = [
                            new THREE.Vector3(72, 0, 90),
                            logi.GATE,                       // (72,0,130)
                            new THREE.Vector3(72, 0, 170),
                            new THREE.Vector3(-30, 0, 180),
                            new THREE.Vector3(-170, 0, 188),
                            logi.CUSTOMER                    // (-215,0,190)
                        ];
                        logi.gateIdx = 1;
                        logi.routeIdx = 0;
                        logi.phase = 'gate';
                    }
                    logi.t = 0;
                }
                break;
            }
            case 'gate': {
                // Drive up to the weighbridge; boom lifts UP (toward -PI/2) as the
                // truck nears z~130, then pauses on the weighbridge before departing.
                const tgt = logi.driveTargets[logi.routeIdx];
                faceDir(logi.truck, logi.truck.position, tgt, dt);
                const done = moveTo(logi.truck.position, tgt, 55, dt);
                const gArm = window.TF.warehouse && window.TF.warehouse.gateArm;
                if (gArm && logi.truck.position.z > 108) {
                    gArm.rotation.z = Math.max(-Math.PI / 2, gArm.rotation.z - dt * 1.8);
                }
                if (done) {
                    if (logi.routeIdx < logi.gateIdx) {
                        logi.routeIdx++; logi.t = 0;             // reached z90, roll to the gate
                    } else if (logi.t > 1.8) {
                        logi.routeIdx++; logi.t = 0;             // weighbridge cleared
                        logi.phase = 'depart';
                    }
                }
                break;
            }
            case 'depart': {
                const tgt = logi.driveTargets[logi.routeIdx];
                faceDir(logi.truck, logi.truck.position, tgt, dt);
                const done = moveTo(logi.truck.position, tgt, 55, dt);
                if (done) {
                    logi.routeIdx++; logi.t = 0;
                    if (logi.routeIdx >= logi.driveTargets.length) {
                        logi.phase = 'delivered'; logi.t = 0;
                    }
                }
                break;
            }
            case 'delivered': {
                if (logi.t > 2.6) {
                    kpis.trucks++;
                    logi.truck.userData.pallets.forEach(p => logi.truck.remove(p));
                    logi.truck.userData.pallets = [];
                    logi.truck.position.copy(logi.TRUCK);
                    logi.truck.rotation.y = 0;                    // loading orientation (faces +z, matches build)
                    if (window.TF.warehouse && window.TF.warehouse.gateArm) {
                        window.TF.warehouse.gateArm.rotation.z = 0; // lower the boom for the next cycle
                    }
                    logi.loaded = 0; logi.count = 0;
                    logi.activePallet = makePallet();
                    logi.activePallet.position.copy(logi.palletBase);
                    logi.group.add(logi.activePallet);
                    logi.phase = 'retrieve'; logi.t = 0;
                }
                break;
            }
        }
    }

    TF.logistics = {
        logi,
        buildLogistics,
        updateLogistics,
        getPhaseText: () => {
            const sn = 'SN-' + logi.serial;
            const routeStatus = (logi.phase === 'delivered') ? 'DELIVERED' : (logi.phase === 'depart' || logi.phase === 'gate') ? 'IN TRANSIT' : 'PROCESSING';
            return `TRACKING ID: ${sn}\n` +
                   `PHASE: ${logi.phase.toUpperCase()}\n` +
                   `STATUS: ${routeStatus}`;
        },
        getPipelineIndex: () => PIPELINE_INDEX[logi.phase] || 0,
        getKPIs: () => ({ tyres: kpis.tyres, pallets: kpis.pallets, trucks: kpis.trucks }),
        getSerial: () => 'SN-' + logi.serial
    };
})();
