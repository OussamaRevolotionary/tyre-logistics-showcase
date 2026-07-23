# TyreFlow — Smart Tire Warehouse & Supply Chain Showcase

🛞 **A real-time 3D simulation of an end-to-end tire supply chain** — from automated high-bay ASRS storage through quality control, labeling, palletizing, and GPS-tracked delivery to the customer's door.

![Three.js](https://img.shields.io/badge/Three.js-r128-blue) ![Status](https://img.shields.io/badge/Status-Live-brightgreen)

## ✨ Features

### 🏭 Automated Warehouse (ASRS)
- **6 rack rows** across 5 aisles with 5-level high-bay storage
- **~18,000 storage positions** for 6 PCR tire categories (R13 to R18)
- **5 animated S/R cranes** with autonomous pick-and-place operations
- Real-time crane status indicators (green = picking, amber = travelling)

### 🔍 9-Step Supply Chain with Full Traceability
| Step | Station | Description |
|------|---------|-------------|
| 1 | **ASRS Retrieval** | Crane picks tire from high-bay slot |
| 2 | **QC Inspection** | Laser scanner arch verifies dimensions |
| 3 | **Conveyor Transport** | L-shaped roller conveyor moves tire downstream |
| 4 | **Barcode Labeling** | Applicator arm applies serial barcode |
| 5 | **Robotic Palletizing** | 6-axis robot arm stacks 4 tires per pallet |
| 6 | **Stretch Wrapping** | Rotating ring wraps pallet for transit |
| 7 | **Truck Loading** | Pallet loaded via dock with roll-up door |
| 8 | **Security / Weighbridge** | Barrier gate + weight verification |
| 9 | **Customer Delivery** | GPS-tracked transit to receiving dock |

### 🛞 Parametric Tyre Generator
- Real-time parametric 3D tire with **Aures tread pattern**
- Adjustable: radius, width, rim size, tread depth, density
- **CAD export** to .OBJ (compatible with SolidWorks, Fusion360, Blender)

### 🎬 Guided Camera Tour
- **9-stop cinematic flythrough** of the entire facility
- Info cards with metrics at each station
- Smooth eased camera transitions with gentle bob at stops

### 📊 Live Dashboard
- **Pipeline progress tracker** — real-time 9-step visual pipeline
- **KPI counters** — tires processed, pallets loaded, trucks dispatched
- **Serial number tracking** — full chain-of-custody display

### 🎨 Premium Visuals
- Dark industrial color palette with accent lighting
- Glassmorphism UI with smooth animations
- Floating ambient dust particles
- Scanner beam, safety beacons, and station glow effects
- Safety floor markings and road lane lines

## 🚀 Getting Started

### Option 1: Open directly
Simply open `index.html` in any modern browser. No build step required.

### Option 2: Local server
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

Then visit `http://localhost:8000`

## 📁 Project Structure

```
├── index.html          # Main HTML shell
├── css/
│   └── styles.css      # Premium UI styling
├── js/
│   ├── tyre.js         # Parametric tyre geometry engine
│   ├── warehouse.js    # ASRS warehouse scene builder
│   ├── logistics.js    # 9-checkpoint supply chain flow
│   ├── tour.js         # Guided camera tour system
│   ├── ui.js           # Landing overlay, HUD, dashboard
│   └── main.js         # Scene init, animate loop, orchestrator
└── README.md
```

## 🛠️ Technology

- **[Three.js](https://threejs.org/)** r128 — 3D rendering
- **Vanilla JavaScript** — no frameworks, no build tools
- **CSS3** — glassmorphism, animations, responsive design
- **Google Fonts** — Inter + JetBrains Mono

## 📄 License

MIT License — feel free to use and modify.
