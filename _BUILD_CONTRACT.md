# TyreFlow — Executive Overhaul BUILD CONTRACT (v1)

> **This file is the single source of truth for the parallel rebuild.**
> Three agents edit **disjoint files**. Do NOT edit files outside your ownership.
> The three contracts below (Coordinates, DOM, Module API) are **FROZEN** — if you
> believe one must change, STOP and leave a `<!-- CONTRACT-CHANGE-REQUEST: ... -->`
> note in your file instead of changing it, so the others don't break.

App = single-page Three.js (r128) showcase of an end-to-end tyre supply chain,
loaded by `index.html` in this order:
`js/tyre.js → js/warehouse.js → js/logistics.js → js/tour.js → js/ui.js → js/main.js`
Everything hangs off the global `window.TF` namespace. `window.onload = TF.main.init`.

---

## FILE OWNERSHIP (no overlap)

| Agent | Owns (edit only these) | Must NOT touch |
|-------|------------------------|----------------|
| **A — 3D Scene** | `js/warehouse.js`, `js/logistics.js`, `js/tyre.js` | tour.js, main.js, index.html, css, ui.js |
| **B — Tour & Orchestrator** | `js/tour.js`, `js/main.js` | warehouse/logistics/tyre.js, index.html, css, ui.js |
| **C — UI / Visual / Copy** | `index.html`, `css/styles.css`, `js/ui.js` | any js/*.js except ui.js |

Do **not** start a dev server / run `check_errors.js` (port 3000 collides across agents).
The lead agent runs the integrated browser verification after all three finish.

---

## DESIGN SYSTEM (authoritative — all agents)

**Audience:** enterprise decision-makers (COO / Head of Supply Chain / plant directors).
**Pattern:** "Enterprise Gateway / Trust & Authority" — value-prop first, metrics, CTA.
**Voice:** confident, outcome-oriented, quantified. No hype, no emoji as UI icons.

**Palette (CSS variables live in `:root` in styles.css — Agent C owns them):**
```
--bg-void:      #070c16   /* deepest background            */
--bg-dark:      #0b1220   /* base                          */
--bg-card:      rgba(12,19,33,0.72)
--ink:          #f8fafc   /* primary text                  */
--ink-muted:    #94a3b8
--ink-faint:    #64748b
/* TECH accent (telemetry, live data, pipeline)            */
--cyan:         #38bdf8
--cyan-2:       #22d3ee
/* EXECUTIVE accent (CTAs, hero flourish, headline KPIs)   */
--gold:         #d8a24a   /* refined amber-gold            */
--gold-2:       #f2c879
--gold-deep:    #a9761f
/* status                                                  */
--green:        #22c55e   --amber: #f59e0b   --red: #ef4444
```
Rule of thumb: **cyan = "the system is alive"** (data, scanning, pipeline, crane status);
**gold = "this is for you, the buyer"** (primary CTAs, hero underline, the single hero KPI,
tour "Book a demo" button). Never rainbow; max 2 accents visible in one card.

**Type:** headings `Inter` 700–800 tight tracking; data/mono `JetBrains Mono`.
Body line-height 1.5–1.6, max line length ~68ch. Min 16px body on mobile.

**Motion:** ease-out for enter, ease-in for exit, 150–300ms micro-interactions.
Animate ≤2 elements per view. **Respect `prefers-reduced-motion: reduce`** everywhere
(Agent B: skip camera auto-glide→instant cut + longer dwell; Agent C: disable pulses).

**Z-index scale (do not invent others):** canvas 0 · top-bar 25 · panels/HUD 30 ·
tour card 50 · landing 100 · loading 200 · cinematic letterbox 60.

**Accessibility:** 4.5:1 text contrast, visible focus rings, `aria-label` on icon buttons,
44px min touch targets, real `<button>`s.

---

## CONTRACT 1 — FROZEN WORLD COORDINATES (Three.js units, Y-up)

These are the physical anchors. **Agent A must keep every station centered on its anchor**
(you may redesign the *geometry* at that spot, add detail, fix bugs — but do not relocate
the anchor). **Agent B frames every camera against these numbers.**

| Station / node            | World anchor (x, y, z) | Notes |
|---------------------------|------------------------|-------|
| Hero tyre pedestal (STAGE)| (0, 12, 40)            | parametric tyre sits here; y≈radius+2 |
| ASRS racks envelope       | x ∈ [-155,155], z ∈ [-20,-300], top y=170 | 6 rows, 5 aisles, central aisle x=0 |
| ASRS central-aisle mouth  | (0, 55, -60)           | good look-at to peer into high-bay |
| ASRS output (OUT)         | (0, 9.5, -18)          | tyre exits onto conveyor here |
| QC Inspection arch        | (20, 12, -18)          | arch top y≈21, scan beam y≈15 |
| Conveyor elbow (CORNER)   | (72, 9.5, -18)         | L-conveyor turns +Z here |
| Labeling station          | (72, 11, 5)            | applicator arm |
| Robotic palletizer        | (66, 13, 22)           | robot base (60,3,22); pallet at (72,·,22) |
| Stretch-wrap station      | (72, 12, 35)           | rotating ring y≈12 |
| Dock door                 | (72, 15, 55)           | roll-up door; pad (72,2,50) |
| Truck loading point (TRUCK)| (72, 0, 66)           | flatbed loads here |
| Security gate + weighbridge| (72, 6, 130)          | boom arm pivot (84,6,130); weighbridge slab |
| Delivery route            | 66→90→130(gate)→170→(-30,180)→(-170,188) | monotonic, no backtrack |
| Customer delivery building | (-215, 20, 190)       | **exactly ONE** building here (see Bug list) |

### Camera framing — RECOMMENDED eye/look per tour stop (Agent B refines)
Order follows the physical journey. `dwell` = ms parked at stop; `glide` = ms to fly in.
Keep camera y ≥ 8 (never under floor) and avoid straight-line paths that clip racks
(bias the path outward in +x before diving to -z).

| # | id         | eye (x,y,z)        | look (x,y,z)      | dwell | note |
|---|------------|--------------------|-------------------|-------|------|
| 0 | overview   | (165,125,180)      | (25,28,-30)       | 6500  | establish whole plant, slow push-in |
| 1 | hero-tyre  | (34,20,78)         | (0,13,40)         | 5500  | engineering hero, tyre rotates |
| 2 | asrs       | (92,74,58)         | (5,52,-120)       | 6500  | 3/4 view down the high-bay, crane working |
| 3 | qc         | (48,22,16)         | (20,12,-18)       | 5000  | arch + green scan sweep |
| 4 | conveyor   | (30,26,52)         | (64,10,-6)        | 5000  | L-conveyor + labeling applicator |
| 5 | palletizer | (40,24,58)         | (68,12,22)        | 5000  | robot arm cycling, pallet stacking |
| 6 | wrap-dock  | (40,30,100)        | (72,14,50)        | 5000  | wrap ring spin + dock + truck |
| 7 | transit    | (114,30,106)       | (74,10,130)       | 5000  | boom gate lifts, truck rolls through |
| 8 | delivery   | (-140,42,150)      | (-215,16,190)     | 6000  | arrival at customer, CoC closed |

> These are **starting values**; the lead will pixel-tune after integration. Get the
> *relative* geometry right (framing the correct object, no clipping, no floor).

---

## CONTRACT 2 — DOM IDS (Agent C builds the markup+CSS; Agents B & C both read these)

Agent C owns `index.html` structure & `css/styles.css`; Agent B's `tour.js` and Agent C's
`ui.js` drive these elements. **These IDs/classes are frozen** — build to them exactly.

**Landing / hero (Agent C):** `#landing-overlay`, `.landing-badge`, `.landing-title`,
`.landing-subtitle`, `.landing-stats` (+`.landing-stat`,`.landing-stat-value`,`.landing-stat-label`),
`#btn-start-tour` (primary, gold), `#btn-explore` (secondary), plus a new
`#btn-book-demo` (gold CTA) and a `#value-props` block (3 outcome cards).

**Top bar (Agent C):** `#top-bar`, `.brand`, `#btn-tour-restart`, `#btn-book-demo-top`.

**Cinematic tour card (Agent C builds DOM+CSS, Agent B populates via ui.js callbacks):**
```
#tour-hud                      (wrapper, class .visible when shown)
  #tour-step-badge             text "01"
  #tour-step-counter           text "01 / 09"
  #tour-card-title
  #tour-card-desc
  #tour-card-metrics           (spans .tour-card-metric injected)
  #tour-timeline               (the clickable milestone rail)
    .tour-tick[data-index]     (one per stop; .active/.done)
  #tour-progress-bar           (inner fill element = #tour-progress-fill; width 0→100% over dwell)
  #tour-controls
    #tour-btn-prev   (aria-label "Previous stop")
    #tour-btn-playpause (aria-label "Pause"/"Play"; toggles data-state="playing|paused")
    #tour-btn-next   (aria-label "Next stop")
    #tour-btn-skip   (text "Exit tour")
  #tour-cta          (gold "Book a demo" — visible on last stop)
```
Letterbox bars for cinematic mode: `#cinema-bars` (two bars, class `.active` toggles).

**HUD / live pipeline (Agent C):** `#flow-hud`, `#flow-phase`, `#pipeline` (steps injected),
`#kpi-tyres`,`#kpi-pallets`,`#kpi-trucks`, `.hud-live-badge`.

**Control panel / parametric generator (Agent C):** keep existing `#control-panel`,
sliders `#param-radius|width|rim|tread|count`, labels `#val-*`, `#export-btn`.
**IMPORTANT UX:** control panel + HUD are shown in **Explore** mode only. During the
**tour**, show only the tour card/letterbox (hide `#control-panel`; HUD optional/dimmed).

---

## CONTRACT 3 — MODULE API (frozen function names on `window.TF`)

`main.js` (Agent B) calls into the other modules; keep these signatures.

**TF.tyre** (Agent A) — unchanged public shape:
`rubberMaterial, pcrSizes, FLOW_SPEC, FLOW_TYRE_GEO, makeStorageTyreGeo, generateTyreGeometry, getAuresDisplacement, smoothstep`

**TF.warehouse** (Agent A):
- `buildWarehouse(scene)` — builds racks, cranes, QC/label/wrap/gate/dock geometry.
- `updateCranes(dt)` — existing crane motion.
- **NEW** `updateStations(dt)` — per-frame ambient animation for EVERY station
  (QC beam sweep, label tap, wrap-ring spin, gate beacon pulse, dock-door idle) so a
  tour stop ALWAYS shows motion, independent of the single flow-tyre state machine.
- Keep exposing station refs used by logistics: `qcBeam, qcLight, labelArm, wrapRing, gateArm, gateBeacon, dockDoor, STAGE, cranes`.

**TF.logistics** (Agent A):
`buildLogistics(scene), updateLogistics(dt), getPhaseText(), getPipelineIndex(), getKPIs(), getSerial()`
(pipeline index 0..8 maps to HUD steps ASRS·QC·Conv·Label·Stack·Wrap·Load·Ship·Done.)

**TF.tour** (Agent B):
- `init(camera, controls)`
- `startTour()`, `endTour()`
- `nextStop()`, `prevStop()`, `skipToStop(i)`
- `play()`, `pause()`, `togglePlay()`, `isPaused()`  ← NEW auto-play controls
- `update()` (called each frame from main.js animate loop)
- `isActive()`, `getCurrentStop()`, `getTotalStops()`, `getStopData(i)`
- setters: `onStopArrive = fn(index, data)`, `onTourEnd = fn()`,
  **NEW** `onProgress = fn(fraction0to1)` (drives #tour-progress-fill),
  **NEW** `onPlayStateChange = fn(isPaused)`.

**TF.ui** (Agent C):
`init(), showTourStop(index,data), hideTourCard(), setTourProgress(frac), setTourPlayState(isPaused), showLoading(t), hideLoading(), updateHUD(), updateSliderLabels(), showExplorationUI(), hideExplorationUI(), enterTourMode(), exitTourMode()`
(ui.js wires #tour-btn-* to TF.tour.* and TF.tour callbacks to the DOM.)

**TF.main** (Agent B): `init(), updateMainTyre(isPreview), exportToOBJ()`.
`main.js animate()` must call, each frame: `controls.update()`,
`TF.warehouse.updateCranes(dt)`, `TF.warehouse.updateStations(dt)`,
`TF.logistics.updateLogistics(dt)`, `TF.tour.update()`, `TF.ui.updateHUD()`, render.

---

## KNOWN BUGS TO FIX (Agent A unless noted)

1. **Duplicate customer building** — one is built in `warehouse.js` (custGroup at z≈190) and
   another in `logistics.js` (cust at CUSTOMER with a +50 z offset ≈ z240). Keep **one**
   canonical building at anchor (-215,20,190); delete the other. Road must meet its door.
2. **Truck route zig-zag** — `driveTargets` currently = [GATE(z130), route[0](z90), …] so the
   truck drives 66→130→90→170 (forward, back, forward). Reorder to strictly monotonic:
   66→90→130(gate boom lifts)→170→(-30,180)→(-170,188)→customer(-215,190).
3. **Truck facing** — it starts `rotation.y=0` but `delivered` resets to `Math.PI`; make
   facing consistent (use `faceDir` toward next waypoint; reset to the loading orientation).
4. **Descriptions vs geometry** — every tour stop's narration (Agent B copy) must match a
   real object at that anchor. Agent A must ensure QC arch, labeling arm, wrap ring, boom
   gate/weighbridge, dock door are all clearly present & legible at their anchors.
5. **Canvas-texture fonts** use "Segoe UI"; switch sign/label textures to a bundled sans
   ("Inter", Arial fallback) for brand consistency (Agent A, cosmetic).
6. During tour, **hero tyre auto-rotation** should keep running (it's the hero-tyre stop
   subject) — main.js already guards on tour; Agent B keep it rotating at the hero stop.

---

## COPY — tour narration (Agent B writes final; must be quantified & match geometry)
Keep milestone TITLES but sharpen to outcomes. Each stop: 1 title, 1–2 sentence desc,
3 metric chips. Example upgrades (Agent B may refine):
- overview → "One Platform, Full Chain of Custody" — throughput/traceability framing.
- asrs → "Automated High-Bay Storage" — density, retrieval time, uptime.
- qc → "In-Line Quality Assurance" — 100% inspection, pass/fail auto-gate, cycle time.
- conveyor → "Serialized Track & Trace" — barcode at line speed.
- palletizer → "Lights-Out Palletizing" — units/hr, zero manual handling.
- wrap-dock → "Wrap, Stage & Load" — load integrity, dock throughput.
- transit → "GPS Chain-of-Custody Transit" — live location, weighbridge compliance.
- delivery → "Proof of Delivery, Closed Loop" — OTIF, CoC closed.

## LANDING / HOOK copy (Agent C)
- Hero headline (outcome, not feature): e.g. "See every tyre, from rack to receiving dock."
- Sub: quantified value prop (traceability %, throughput, labor reduction — use realistic
  demo numbers, clearly a showcase).
- 3 value-prop cards (icon = inline SVG, NOT emoji): Traceability · Throughput · Uptime.
- Primary CTA `#btn-book-demo` gold → `mailto:oussamabdi19@gmail.com?subject=TyreFlow%20Demo`
  as placeholder (leave a `<!-- TODO: swap to Calendly/booking link -->`).
- Keep the two existing stats but reframe as outcomes. Remove 🛞/🎬/▶ emoji → inline SVG.

---

## DEFINITION OF DONE (per agent)
- No `console` errors from your files; no references to undefined `TF.*` you don't own.
- You honored all three contracts (grep your file for the frozen IDs/coords/signatures).
- Left a short `## DONE — Agent X` summary block at the bottom of THIS file describing what
  you changed and any `CONTRACT-CHANGE-REQUEST` you raised.

---

## DONE — Agent A (3D Scene)

Files touched: `js/warehouse.js`, `js/logistics.js`. (`js/tyre.js` reviewed — no change
needed; its public API is unchanged.)

### js/warehouse.js
- **Removed the duplicate customer building** (`custGroup`) entirely. The single canonical
  building now lives in logistics.js (co-located with the road). Left a NOTE comment where it was.
- **QC arch (20,12,-18)** rebuilt as an unmistakable scanning gantry: 2 footed uprights +
  top beam + cyan status strip, a faint static green **scan field** (`qcField`), a bright
  green **laser bar** (`qcBeam`) that sweeps vertically y7→19 through the opening, a
  pass/fail indicator stack (green `qcLight` + dim red fail lamp), and a "QC SCAN" sign.
- **Labeling (72,11,5)** rebuilt: steel post + **printer/dispenser** block with barcode
  strip + label roll, and an **applicator arm** group (`labelArm`, rest Y=15) with an
  arm + head + green tip that reaches over the tyre at x≈72 and taps down. "LABELING" sign.
- **Stretch-wrap (72,12,35)** rebuilt: base track + frame, and a **rotating film-ring group**
  (`wrapRing` is now a `THREE.Group`) = cyan torus + carriage marker + translucent film
  cylinder, so the spin reads clearly.
- **Security gate + weighbridge (72,6,130)** rebuilt: raised **weighbridge slab** with cyan
  edge markings + readout post/screen, a **striped boom arm** (`gateArm`, pivot world 84,7,130)
  reaching across the road, and an amber emissive **beacon** (`gateBeacon`). Boom now lifts
  UP (rotation.z → −π/2) when driven by logistics.
- **Dock door (72,15,55)** rebuilt as a **roll-up slat curtain** (`dockDoor` is now a
  `THREE.Group` of 10 slats) with side rails, header, bumpers, "SHIPPING DOCK" sign, and a
  green ready-light (`dockLight`).
- **NEW `updateStations(dt)`** exported on `TF.warehouse` — continuous, allocation-free
  ambient motion for every station regardless of the flow-tyre position: QC laser sweep +
  field flicker + indicator pulse, labeling idle bob, wrap-ring slow spin, gate beacon
  pulse, dock ready-light pulse + subtle door breathing. Guards against double-driving parts
  logistics animates (skips labelArm during `label`, wrapRing during `wrap`).
- **Cranes:** the central-aisle crane (x=0) is flagged `busy` and barely pauses, so the ASRS
  tour stop always shows a crane working. `updateCranes` signature unchanged.
- **Fonts:** rack/sign canvas textures switched `"Segoe UI"` → `"Inter", Arial, sans-serif`;
  rack-label accent border switched orange→cyan for brand consistency.
- New station object anchors added on `TF.warehouse`: `qcField`, `dockLight` (plus existing
  `qcBeam, qcLight, labelArm, wrapRing, gateArm, gateBeacon, dockDoor`).

### js/logistics.js
- **Truck route zig-zag fixed (bug #2):** `driveTargets` is now strictly monotonic
  `66→90→130(gate)→170→(-30,180)→(-170,188)→(-215,190)`. Added `logi.gateIdx`. The boom
  gate lifts as the truck passes z≈108–130; a weighbridge dwell (~1.8s) happens at z130.
- **Truck facing fixed (bug #3):** `delivered` reset now restores `rotation.y = 0` (the same
  loading orientation used at build), so wheels/cab face the direction of travel every cycle;
  the boom is also lowered (`gateArm.rotation.z = 0`) on reset.
- **Single canonical customer building (bug #1)** built here at anchor (-215,20,190): body
  sits just west so the **roll-up receiving door + apron + "CUSTOMER — DELIVERY POINT" sign
  face east toward the incoming road**; the delivery road's last segment ends on the apron at
  the door. Truck parks on the apron centered on the anchor.
- **Palletizer (60,3,22 base)** rebuilt as an articulated robot: base + column + swing
  **shoulder** + upper arm + **elbow** + forearm + wrist + two-finger gripper. Kept the exact
  animation hooks logistics drives (`robot.shoulder.rotation.y`, `robot.elbow.rotation.x`).
  Added gentle **ambient idle sway** (when phase ≠ `place`) so the robot always shows life.
- **Fonts:** `makeSign` canvas font switched to `"Inter", Arial, sans-serif`.
- `label` tap retuned to the new applicator rest Y (15); `qc_scan` no longer spins the beam
  (updateStations owns QC motion now).

### Contract compliance
- All frozen anchors honored (grep-verified). Module API unchanged:
  `buildWarehouse/updateCranes/updateStations` and
  `buildLogistics/updateLogistics/getPhaseText/getPipelineIndex/getKPIs/getSerial`.
- No references to files/functions outside Agent A ownership were changed. `main.js` already
  calls `TF.warehouse.updateStations(dt)` (verified).

### Notes for other agents
- `wrapRing` and `dockDoor` are now `THREE.Group`s (were meshes). `rotation`/`position` still
  work as before, so existing logistics/tour references are unaffected.
- `qcLight`/`gateBeacon`/`dockLight` are now `MeshStandardMaterial` with `emissive`; ambient
  pulses use `emissiveIntensity`. If the tour dims stations, they will still read on dark bg.
- CONTRACT interpretation note (not a change request): the customer building is anchored so its
  **receiving face/apron** sits on (-215,20,190) with the body extending west, because the
  frozen truck endpoint equals the building anchor and the truck is long — centering the mass
  exactly on the anchor would spawn the truck inside the building. The delivery point/anchor
  itself is unchanged.

---

## DONE — Agent B (Tour & Orchestrator)

Owns `js/tour.js` + `js/main.js` only. No other files touched. No `CONTRACT-CHANGE-REQUEST`
raised — the recommended eye/look/dwell table was usable as-is.

### What the tour does now
- **Auto-play cinematic tour.** On `startTour()` it flies to stop 0 and then auto-advances:
  each stop = an eased **glide** (arc'd fly-in) → **dwell** (parked with a gentle drift) →
  next. After the last stop it calls `endTour()` automatically.
- **Arc'd fly-ins (anti-clipping).** Camera path is a quadratic bezier through a control
  point at the from→to midpoint, lifted in +Y and bowed outward in +X (scaled by travel
  distance, capped at +70 / +45). Straight lerps that could cut geometry now arch over/around.
  Pacing eased with `easeInOutCubic`. `controls.target` lerps straight.
- **Dwell drift.** Instead of a bare Y-bob: very slow orbital sway (~±2.9°) around the look
  target + subtle push-in (up to 4% closer over the dwell) + faint bob. Driven by
  `dwellElapsed`, so it **freezes on pause**.
- **Camera y clamped ≥ 8** everywhere (glide, drift, endTour). All shipped eye.y ≥ 20.
- **Reduced motion** (`prefers-reduced-motion: reduce`, re-evaluated at each `startTour`):
  instant cut instead of glide, **no drift**, dwell ×1.4. Callbacks still fire so UI updates.

### Control / callback API (all frozen names present on `TF.tour`)
`init, startTour, endTour, nextStop, prevStop, skipToStop, play, pause, togglePlay,
isPaused, update, isActive, getCurrentStop, getTotalStops, getStopData` + setters
`onStopArrive(i,data)`, `onTourEnd()`, `onProgress(frac0..1)`, `onPlayStateChange(isPaused)`.
- `next/prev/skipToStop` all re-trigger a fresh glide during auto-play (real-time, so they
  animate **even while paused**). `pause()` freezes dwell countdown + drift + auto-advance.
- `onProgress` fires every frame: `0` during a glide, `elapsed/dwell` during a dwell → drives
  `#tour-progress-fill`. `onPlayStateChange` fires on every play/pause toggle.
- `endTour()` re-enables OrbitControls, keeps the camera where it is, sets `controls.target`
  to the last look (no snap), leaving a clean free-explore hand-off.

### Final per-stop cam / look / dwell / glide (shipped, = contract table)
| # | id | cam (x,y,z) | look (x,y,z) | dwell | glide |
|---|----|-------------|--------------|-------|-------|
| 0 | overview   | (165,125,180) | (25,28,-30)   | 6500 | 2600 |
| 1 | hero-tyre  | (34,20,78)    | (0,13,40)     | 5500 | 2200 |
| 2 | asrs       | (92,74,58)    | (5,52,-120)   | 6500 | 2400 |
| 3 | qc         | (48,22,16)    | (20,12,-18)   | 5000 | 2000 |
| 4 | conveyor   | (30,26,52)    | (64,10,-6)    | 5000 | 2000 |
| 5 | palletizer | (40,24,58)    | (68,12,22)    | 5000 | 2000 |
| 6 | wrap-dock  | (40,30,100)   | (72,14,50)    | 5000 | 2200 |
| 7 | transit    | (114,30,106)  | (74,10,130)   | 5000 | 2200 |
| 8 | delivery   | (-140,42,150) | (-215,16,190) | 6000 | 2600 |

Narration rewritten per stop: sharpened outcome titles + 1–2 sentence desc + exactly 3
metric chips each, matched to real geometry (QC arch, labeling arm, wrap ring, dock door,
weighbridge/boom gate, customer building). `stop.duration` kept as an alias of `stop.dwell`.

### main.js changes
- `animate()` per-frame order is now: `controls.update()` → hero-tyre spin →
  `updateCranes(dt)` → **`updateStations(dt)`** (NEW, guarded `if (TF.warehouse.updateStations)`)
  → `updateLogistics(dt)` → `TF.tour.update()` → `updateParticles(dt)` → `updateHUD()` → render.
- Hero-tyre auto-rotation guard changed to `if (tyreMesh && !userInteracting)` so it keeps
  spinning during the tour (subject of the hero-tyre stop). During the tour OrbitControls are
  disabled, so `userInteracting` stays false and it rotates throughout.
- `TF.main.init / updateMainTyre / exportToOBJ` unchanged; still boots on `window.onload`.

### For Agent C (UI wiring)
- Wire `#tour-btn-prev/next` → `prevStop()/nextStop()`, `#tour-btn-playpause` → `togglePlay()`
  (reflect `onPlayStateChange(isPaused)` into `data-state` + aria-label), `#tour-btn-skip` →
  `endTour()`, timeline `.tour-tick[data-index]` → `skipToStop(i)`.
- `onProgress(frac)` → set `#tour-progress-fill` width `frac*100%`.
- Cinematic bars: toggle `#cinema-bars.active` ON when ui.js calls `TF.tour.startTour()`,
  OFF in the `onTourEnd` handler. No extra "tour started" signal is emitted by tour.js (ui.js
  initiates startTour itself, so it already knows). Also call `enterTourMode()` on start /
  `exitTourMode()` on `onTourEnd` to hide the control panel during the tour.

Not verified in-browser per instructions (shared port 3000); verified by static review.

---

## DONE — Agent C (UI / Visual System / Copy)

Owns `index.html`, `css/styles.css`, `js/ui.js` only. No `console`-worthy issues from my
files. No `CONTRACT-CHANGE-REQUEST` — the DOM/API/palette were all buildable as specified.

### Palette / visual system (`styles.css`, full rewrite)
- `:root` now defines the exact contract tokens: `--bg-void #070c16`, `--bg-dark`, `--bg-card`,
  `--ink/--ink-muted/--ink-faint`, `--cyan/--cyan-2`, `--gold #d8a24a / --gold-2 #f2c879 /
  --gold-deep #a9761f`, `--green/--amber/--red`, plus line/glow/radius/motion tokens.
- **Discipline enforced:** cyan = live telemetry (pipeline dots, KPIs, progress fill, crane
  legend, sliders, HUD); gold = executive only (hero underline flourish, primary CTAs, the
  single gold headline KPI = the Throughput "240/hr" value-card). Never >2 accents per card.
- Shared `.btn` system: `.btn-gold` (filled, dark text for AA contrast), `.btn-gold-outline`,
  `.btn-ghost`, `.btn-bar`. 44px min touch targets, `:focus-visible` gold rings globally.

### Landing / hook (`index.html`)
- Outcome headline "See every tyre, from rack to **receiving dock**." with an animated gold
  underline flourish on the accent phrase.
- Quantified subtitle (100% traceability / 18,000+ positions / 240 tyres-hr / 90% less manual).
- `#value-props` = 3 outcome cards (Traceability 100% · Throughput 240/hr [gold] · Uptime
  99.6%), each with an **inline SVG** icon (shield-check / bar-throughput / activity-pulse).
- 4 reframed outcome stats (18K+ buffer positions · <2s QC cycle · 90% less manual · 24/7).
- Buttons: `#btn-start-tour` (gold, "Start Executive Tour"), `#btn-explore` (ghost),
  `#btn-book-demo` (gold-outline). All emoji removed (🛞/🎬/▶) → inline SVG; brand mark is an
  SVG tyre/route logo lockup "TyreFlow / Supply Chain Intelligence".

### Top bar
- `#btn-tour-restart` relabelled "Replay Tour" (SVG refresh) + persistent gold
  `#btn-book-demo-top` CTA. Floating bar, edge-spaced, non-overlapping.

### Cinematic tour HUD (new DOM, replaces old `#tour-card`)
- Built exactly to contract: `#tour-hud > .tour-hud-inner` with `#tour-step-badge` ("01"),
  `#tour-step-counter` ("01 / 09"), `#tour-card-title`, `#tour-card-desc`, `#tour-card-metrics`,
  clickable `#tour-timeline` (`.tour-tick[data-index]`, `.active` gold / `.done` cyan),
  `#tour-progress-bar > #tour-progress-fill` (cyan, width 0→100%), `#tour-controls` with
  `#tour-btn-prev`, `#tour-btn-playpause` (data-state playing|paused, icon swap + aria-label),
  `#tour-btn-next`, `#tour-btn-skip` ("Exit tour"), and gold `#tour-cta` (shown only on the
  last stop via `.show`). Letterbox `#cinema-bars` (top+bottom, `.active` expands to ~7vh, z60).

### ui.js wiring (rebuilt for auto-play tour)
- Caches all new refs; builds `#tour-timeline` ticks from `getTotalStops()`, tick click →
  `skipToStop(i)`. prev/next/togglePlay/endTour wired; CTAs' `href` set from a single
  `DEMO_LINK` const (`mailto:oussamabdi19@gmail.com?subject=TyreFlow%20Demo`, TODO→booking link).
- Sets `onStopArrive=showTourStop`, `onTourEnd=onTourFinished`, `onProgress=setTourProgress`,
  `onPlayStateChange=setTourPlayState`. New-API calls guarded so nothing throws pre-integration.
- **Mode switch:** `enterTourMode()` hides control panel + HUD + top bar, activates letterbox,
  pre-fills stop 0, shows the HUD. `exitTourMode()` (called from `onTourFinished` and Exit)
  reverses to Explore UI. `showTourStop` resets progress + toggles CTA on last stop.
- Kept slider/export/HUD wiring, `updateSliderLabels`, loading show/hide. All contract
  `TF.ui.*` names exported; only calls `TF.tour.*/TF.main.*/TF.logistics.*` that exist.

### a11y / motion / responsive
- 150–300ms ease-out micro-interactions; full `prefers-reduced-motion` block (kills pulses,
  loader slide, hover lifts; underline shown instantly). aria-labels on all icon-only buttons.
- Verified layout intent at 375 / 768 / 1024 / 1440: value-props 3→1 col, stats/buttons stack,
  HUD/tour card go edge-to-edge with no horizontal scroll. Z-index scale honored
  (canvas 0 · top-bar 25 · panels/HUD 30 · tour-hud 50 · letterbox 60 · landing 100 · loading 200).

### For Agents A/B
- CTA target is the mailto placeholder above (single `DEMO_LINK` const in ui.js + `href`s).
- Tour auto-ends after the last stop → `onTourEnd` → `exitTourMode()`; the last-stop gold CTA
  therefore shows during that final dwell, and the persistent top-bar CTA covers Explore mode.
- ui.js reads `data.title/desc/metrics` from `getStopData(i)`/`onStopArrive` — Agent B's shape
  matches. Not verified in-browser per shared-port instruction; verified by static review.
