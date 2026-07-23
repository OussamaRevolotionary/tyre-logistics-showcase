/* ============================================================
   TYREFLOW — TYRE GEOMETRY ENGINE
   Parametric tyre generation with Aures tread pattern
   ============================================================ */
window.TF = window.TF || {};

(function() {
    'use strict';

    // ---------- Shared rubber material ----------
    const rubberMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2e,
        roughness: 0.82,
        metalness: 0.12,
        side: THREE.FrontSide
    });

    // Pre-defined PCR Tyre categories for the warehouse racks
    const pcrSizes = [
        { name: "PCR 175/70 R13", r: 7.5, w: 5.0, rim: 4.5, depth: 0.25 },
        { name: "PCR 185/60 R14", r: 8.5, w: 5.5, rim: 5.0, depth: 0.28 },
        { name: "PCR 195/65 R15", r: 9.5, w: 6.0, rim: 5.5, depth: 0.30 },
        { name: "PCR 205/55 R16", r: 10.5, w: 7.0, rim: 6.0, depth: 0.32 },
        { name: "PCR 225/45 R17", r: 11.5, w: 8.0, rim: 6.5, depth: 0.35 },
        { name: "PCR 245/40 R18", r: 12.5, w: 9.0, rim: 7.0, depth: 0.38 }
    ];

    // Flow spec — mid-size tyre used in the logistics animation
    const FLOW_SPEC = { r: 10.5, w: 7.0, rim: 6.0, depth: 0.32 };

    // ---------- Smoothstep helper ----------
    function smoothstep(min, max, value) {
        let x = Math.max(0, Math.min(1, (value - min) / (max - min)));
        return x * x * (3 - 2 * x);
    }

    // ---------- Aures Tread Displacement ----------
    function getAuresDisplacement(ny, theta, N) {
        let absNy = Math.abs(ny);
        if (absNy > 0.85) return 0.0;
        let edgeFade = 1.0 - smoothstep(0.70, 0.85, absNy);
        let depth = 0.0;
        let gw = 0.04;

        // Longitudinal grooves
        let l1 = 1.0 - smoothstep(gw*0.2, gw*1.5, Math.abs(absNy - 0.25));
        let l2 = 1.0 - smoothstep(gw*0.2, gw*1.5, Math.abs(absNy - 0.55));
        depth = Math.max(depth, l1, l2);

        // Center sipes
        if (absNy < 0.25) {
            let val = Math.sin(theta * N * 1.5 + ny * 15);
            let centerGroove = smoothstep(0.75, 0.95, val) * 0.4;
            let mask = 1.0 - smoothstep(0.18, 0.25, absNy);
            depth = Math.max(depth, centerGroove * mask);
        }
        // Intermediate ribs
        else if (absNy >= 0.25 && absNy < 0.55) {
            let dir = ny > 0 ? 1 : -1;
            let val = Math.sin(theta * N + ny * 18 * dir);
            let interGroove = smoothstep(0.65, 0.9, val);
            let mask = smoothstep(0.28, 0.32, absNy) * (1.0 - smoothstep(0.48, 0.55, absNy));
            depth = Math.max(depth, interGroove * mask);
        }
        // Shoulder blocks
        else if (absNy >= 0.55) {
            let val = Math.sin(theta * N);
            let shoulderGroove = smoothstep(0.3, 0.7, val);
            let mask = smoothstep(0.55, 0.6, absNy);
            depth = Math.max(depth, shoulderGroove * mask);
        }

        return Math.min(1.0, depth) * edgeFade;
    }

    // ---------- Low-poly storage tyre (no tread) ----------
    function makeStorageTyreGeo(R, w, rimRadius) {
        const profileRes = 10, radialSegments = 20;
        const pts = [];
        for (let i = 0; i <= profileRes; i++) {
            let ny = (i / profileRes) * 2 - 1;
            let y = ny * (w / 2);
            let absNy = Math.abs(ny), r;
            if (absNy <= 0.75) { r = R - absNy * absNy * 0.15; }
            else {
                let sw = (absNy - 0.75) / 0.25;
                r = rimRadius + (R - rimRadius) * (0.5 + 0.5 * Math.cos(sw * Math.PI));
                y += Math.sign(ny) * Math.sin(sw * Math.PI) * (w * 0.08);
            }
            pts.push(new THREE.Vector2(r, y));
        }
        pts.push(new THREE.Vector2(rimRadius, w / 2));
        pts.push(new THREE.Vector2(rimRadius - 0.5, w / 2));
        pts.push(new THREE.Vector2(rimRadius - 0.5, -w / 2));
        pts.push(new THREE.Vector2(pts[0].x, pts[0].y));
        const g = new THREE.LatheGeometry(pts, radialSegments);
        g.computeVertexNormals();
        return g;
    }

    // ---------- Full-detail hero tyre ----------
    function generateTyreGeometry(R, w, rimRadius, maxTreadDepth, N, isPreview) {
        const profileRes = isPreview ? 30 : 120;
        const radialSegments = isPreview ? 80 : 360;
        const profilePoints = [];

        for (let i = 0; i <= profileRes; i++) {
            let t = i / profileRes;
            let ny = (t * 2) - 1;
            let y = ny * (w / 2);
            let r;
            let absNy = Math.abs(ny);
            if (absNy <= 0.75) {
                r = R - Math.pow(absNy, 2) * 0.15;
            } else {
                let sw = (absNy - 0.75) / 0.25;
                r = rimRadius + (R - rimRadius) * (0.5 + 0.5 * Math.cos(sw * Math.PI));
                let bulge = Math.sin(sw * Math.PI) * (w * 0.08);
                y += Math.sign(ny) * bulge;
            }
            profilePoints.push(new THREE.Vector2(r, y));
        }

        // Close manifold for CAD export
        profilePoints.push(new THREE.Vector2(rimRadius, w/2));
        profilePoints.push(new THREE.Vector2(rimRadius - 0.5, w/2));
        profilePoints.push(new THREE.Vector2(rimRadius - 0.5, -w/2));
        profilePoints.push(new THREE.Vector2(profilePoints[0].x, profilePoints[0].y));

        const geometry = new THREE.LatheGeometry(profilePoints, radialSegments);
        const positions = geometry.attributes.position.array;

        // Apply tread displacement
        for (let i = 0; i < positions.length; i += 3) {
            let x = positions[i], y = positions[i+1], z = positions[i+2];
            let currentRadius = Math.sqrt(x*x + z*z);
            if (currentRadius > rimRadius + 1.0) {
                let ny = Math.max(-1.0, Math.min(1.0, y / (w / 2)));
                let theta = Math.atan2(z, x);
                let depth = getAuresDisplacement(ny, theta, N);
                if (depth > 0) {
                    let dirX = x / currentRadius;
                    let dirZ = z / currentRadius;
                    let actualDisplacement = depth * maxTreadDepth;
                    positions[i]   -= dirX * actualDisplacement;
                    positions[i+2] -= dirZ * actualDisplacement;
                }
            }
        }

        geometry.computeVertexNormals();
        return geometry;
    }

    // Shared low-poly tyre geometry for flow animations (built once)
    const FLOW_TYRE_GEO = makeStorageTyreGeo(FLOW_SPEC.r, FLOW_SPEC.w, FLOW_SPEC.rim);

    // ---------- Expose API ----------
    TF.tyre = {
        rubberMaterial,
        pcrSizes,
        FLOW_SPEC,
        FLOW_TYRE_GEO,
        smoothstep,
        makeStorageTyreGeo,
        generateTyreGeometry,
        getAuresDisplacement
    };
})();
