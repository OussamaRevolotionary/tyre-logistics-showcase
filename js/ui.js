/* ============================================================
   TYREFLOW — UI MANAGER
   Landing overlay, HUD dashboard, tour cards, event wiring
   ============================================================ */
window.TF = window.TF || {};

(function() {
    'use strict';

    // ---------- DOM references (set on init) ----------
    let els = {};

    // ---------- Pipeline step labels (maps to logistics pipeline index 0-8) ----------
    const PIPELINE_LABELS = [
        'ASRS',
        'QC',
        'Conv',
        'Label',
        'Stack',
        'Wrap',
        'Load',
        'Ship',
        'Done'
    ];

    function init() {
        // Cache DOM elements
        els = {
            landing:      document.getElementById('landing-overlay'),
            btnTour:      document.getElementById('btn-start-tour'),
            btnExplore:   document.getElementById('btn-explore'),
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingText:  document.getElementById('loading-text'),
            controlPanel: document.getElementById('control-panel'),
            flowHud:      document.getElementById('flow-hud'),
            flowPhase:    document.getElementById('flow-phase'),
            pipeline:     document.getElementById('pipeline'),
            kpiTyres:     document.getElementById('kpi-tyres'),
            kpiPallets:   document.getElementById('kpi-pallets'),
            kpiTrucks:    document.getElementById('kpi-trucks'),
            topBar:       document.getElementById('top-bar'),
            btnTourRestart: document.getElementById('btn-tour-restart'),
            tourCard:     document.getElementById('tour-card'),
            tourTitle:    document.getElementById('tour-card-title'),
            tourDesc:     document.getElementById('tour-card-desc'),
            tourMetrics:  document.getElementById('tour-card-metrics'),
            tourStepBadge:document.getElementById('tour-step-badge'),
            tourCounter:  document.getElementById('tour-step-counter'),
            tourBtnSkip:  document.getElementById('tour-btn-skip'),
            tourBtnNext:  document.getElementById('tour-btn-next'),
            tourProgress: document.getElementById('tour-progress')
        };

        // Build pipeline dots
        buildPipeline();

        // Build tour progress dots
        buildTourProgress();

        // Wire events
        wireEvents();
    }

    function buildPipeline() {
        if (!els.pipeline) return;
        els.pipeline.innerHTML = '';
        PIPELINE_LABELS.forEach((label, i) => {
            const step = document.createElement('div');
            step.className = 'pipeline-step';
            step.dataset.index = i;
            step.innerHTML = `
                <div class="pipeline-dot"></div>
                <div class="pipeline-label">${label}</div>
            `;
            els.pipeline.appendChild(step);
        });
    }

    function buildTourProgress() {
        if (!els.tourProgress) return;
        const total = TF.tour ? TF.tour.getTotalStops() : 9;
        els.tourProgress.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const dot = document.createElement('div');
            dot.className = 'tour-progress-dot';
            dot.dataset.index = i;
            els.tourProgress.appendChild(dot);
        }
    }

    function wireEvents() {
        // Landing buttons
        if (els.btnTour) {
            els.btnTour.addEventListener('click', () => {
                hideLanding();
                setTimeout(() => {
                    showExplorationUI();
                    if (TF.tour) TF.tour.startTour();
                }, 800);
            });
        }
        if (els.btnExplore) {
            els.btnExplore.addEventListener('click', () => {
                hideLanding();
                setTimeout(() => showExplorationUI(), 800);
            });
        }

        // Tour restart
        if (els.btnTourRestart) {
            els.btnTourRestart.addEventListener('click', () => {
                if (TF.tour) TF.tour.startTour();
            });
        }

        // Tour card controls
        if (els.tourBtnSkip) {
            els.tourBtnSkip.addEventListener('click', () => {
                hideTourCard();
                if (TF.tour) TF.tour.endTour();
            });
        }
        if (els.tourBtnNext) {
            els.tourBtnNext.addEventListener('click', () => {
                hideTourCard();
                if (TF.tour) TF.tour.nextStop();
            });
        }

        // Wire tour callbacks
        if (TF.tour) {
            TF.tour.onStopArrive = showTourStop;
            TF.tour.onTourEnd = onTourFinished;
        }

        // Tyre parameter sliders
        let previewTimeoutId;
        document.querySelectorAll('input[type=range]').forEach(slider => {
            slider.addEventListener('input', () => {
                clearTimeout(previewTimeoutId);
                previewTimeoutId = setTimeout(() => {
                    if (TF.main) TF.main.updateMainTyre(true);
                }, 10);
            });
            slider.addEventListener('change', () => {
                clearTimeout(previewTimeoutId);
                showLoading('Molding High-Res Geometry...');
                setTimeout(() => {
                    if (TF.main) TF.main.updateMainTyre(false);
                }, 50);
            });
        });

        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (TF.main) TF.main.exportToOBJ();
            });
        }
    }

    // ---------- Landing ----------
    function hideLanding() {
        if (els.landing) els.landing.classList.add('hidden');
    }

    // ---------- Exploration UI ----------
    function showExplorationUI() {
        if (els.topBar) els.topBar.classList.remove('hidden');
        if (els.controlPanel) els.controlPanel.classList.remove('hidden');
        if (els.flowHud) els.flowHud.classList.remove('hidden');
    }
    function hideExplorationUI() {
        if (els.topBar) els.topBar.classList.add('hidden');
        if (els.controlPanel) els.controlPanel.classList.add('hidden');
        if (els.flowHud) els.flowHud.classList.add('hidden');
    }

    // ---------- Tour Card ----------
    function showTourStop(index, data) {
        if (!els.tourCard) return;

        els.tourStepBadge.textContent = `STOP ${index + 1}`;
        els.tourCounter.textContent = `${index + 1} / ${TF.tour.getTotalStops()}`;
        els.tourTitle.textContent = data.title;
        els.tourDesc.textContent = data.desc;

        // Metrics
        els.tourMetrics.innerHTML = '';
        (data.metrics || []).forEach(m => {
            const span = document.createElement('span');
            span.className = 'tour-card-metric';
            span.textContent = m;
            els.tourMetrics.appendChild(span);
        });

        // Update next button text
        const isLast = index === TF.tour.getTotalStops() - 1;
        els.tourBtnNext.textContent = isLast ? 'Finish Tour' : 'Next →';

        // Update progress dots
        els.tourProgress.querySelectorAll('.tour-progress-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
            dot.classList.toggle('done', i < index);
        });

        els.tourCard.classList.add('visible');
    }

    function hideTourCard() {
        if (els.tourCard) els.tourCard.classList.remove('visible');
    }

    function onTourFinished() {
        hideTourCard();
        showExplorationUI();
    }

    // ---------- Loading ----------
    function showLoading(text) {
        if (els.loadingText) els.loadingText.textContent = text || 'Loading...';
        if (els.loadingOverlay) els.loadingOverlay.style.display = 'flex';
    }
    function hideLoading() {
        if (els.loadingOverlay) els.loadingOverlay.style.display = 'none';
    }

    // ---------- HUD Updates (called each frame from main) ----------
    function updateHUD() {
        if (!TF.logistics) return;

        const phaseText = TF.logistics.getPhaseText();
        if (els.flowPhase && phaseText) {
            els.flowPhase.textContent = phaseText;
        }

        // Update pipeline
        const activeIdx = TF.logistics.getPipelineIndex();
        if (els.pipeline) {
            els.pipeline.querySelectorAll('.pipeline-step').forEach((step, i) => {
                step.classList.toggle('active', i === activeIdx);
                step.classList.toggle('completed', i < activeIdx);
            });
        }

        // Update KPIs
        const kpis = TF.logistics.getKPIs();
        if (kpis) {
            if (els.kpiTyres) els.kpiTyres.textContent = kpis.tyres;
            if (els.kpiPallets) els.kpiPallets.textContent = kpis.pallets;
            if (els.kpiTrucks) els.kpiTrucks.textContent = kpis.trucks;
        }
    }

    // ---------- Slider label updater ----------
    function updateSliderLabels() {
        const ids = [
            { slider: 'param-radius', label: 'val-radius', decimals: 1 },
            { slider: 'param-width',  label: 'val-width',  decimals: 1 },
            { slider: 'param-rim',    label: 'val-rim',    decimals: 1 },
            { slider: 'param-tread',  label: 'val-tread',  decimals: 2 },
            { slider: 'param-count',  label: 'val-count',  decimals: 0 }
        ];
        ids.forEach(({ slider, label, decimals }) => {
            const s = document.getElementById(slider);
            const l = document.getElementById(label);
            if (s && l) l.textContent = parseFloat(s.value).toFixed(decimals);
        });
    }

    // ---------- Expose API ----------
    TF.ui = {
        init,
        hideLanding,
        showExplorationUI,
        hideExplorationUI,
        showTourStop,
        hideTourCard,
        showLoading,
        hideLoading,
        updateHUD,
        updateSliderLabels,
        PIPELINE_LABELS
    };
})();
