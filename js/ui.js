/* ============================================================
   TYREFLOW — UI MANAGER
   Landing hook, cinematic tour HUD, live ops dashboard, wiring
   Cyan = live telemetry · Gold = executive CTAs / hero / headline KPI
   ============================================================ */
window.TF = window.TF || {};

(function() {
    'use strict';

    // TODO: swap to a Calendly / booking link when live.
    const DEMO_LINK = 'mailto:oussamabdi19@gmail.com?subject=TyreFlow%20Demo';

    // Pipeline labels map to logistics pipeline index 0-8
    const PIPELINE_LABELS = ['ASRS', 'QC', 'Conv', 'Label', 'Stack', 'Wrap', 'Load', 'Ship', 'Done'];

    let els = {};

    function pad2(n) { return String(n + 1).padStart(2, '0'); }
    function totalStops() { return (TF.tour && TF.tour.getTotalStops) ? TF.tour.getTotalStops() : 9; }

    /* ---------- init ---------- */
    function init() {
        els = {
            landing:        document.getElementById('landing-overlay'),
            btnStartTour:   document.getElementById('btn-start-tour'),
            btnExplore:     document.getElementById('btn-explore'),
            btnBookDemo:    document.getElementById('btn-book-demo'),

            loadingOverlay: document.getElementById('loading-overlay'),
            loadingText:    document.getElementById('loading-text'),

            topBar:         document.getElementById('top-bar'),
            btnTourRestart: document.getElementById('btn-tour-restart'),
            btnBookDemoTop: document.getElementById('btn-book-demo-top'),

            cinemaBars:     document.getElementById('cinema-bars'),

            tourHud:        document.getElementById('tour-hud'),
            tourStepBadge:  document.getElementById('tour-step-badge'),
            tourCounter:    document.getElementById('tour-step-counter'),
            tourTitle:      document.getElementById('tour-card-title'),
            tourDesc:       document.getElementById('tour-card-desc'),
            tourMetrics:    document.getElementById('tour-card-metrics'),
            tourTimeline:   document.getElementById('tour-timeline'),
            tourProgress:   document.getElementById('tour-progress-fill'),
            tourBtnPrev:    document.getElementById('tour-btn-prev'),
            tourBtnPlay:    document.getElementById('tour-btn-playpause'),
            tourBtnNext:    document.getElementById('tour-btn-next'),
            tourBtnSkip:    document.getElementById('tour-btn-skip'),
            tourCta:        document.getElementById('tour-cta'),

            controlPanel:   document.getElementById('control-panel'),
            flowHud:        document.getElementById('flow-hud'),
            flowPhase:      document.getElementById('flow-phase'),
            pipeline:       document.getElementById('pipeline'),
            kpiTyres:       document.getElementById('kpi-tyres'),
            kpiPallets:     document.getElementById('kpi-pallets'),
            kpiTrucks:      document.getElementById('kpi-trucks')
        };

        buildPipeline();
        buildTimeline();
        wireDemoLinks();
        wireEvents();
        wireTourCallbacks();
    }

    function buildPipeline() {
        if (!els.pipeline) return;
        els.pipeline.innerHTML = '';
        PIPELINE_LABELS.forEach((label, i) => {
            const step = document.createElement('div');
            step.className = 'pipeline-step';
            step.dataset.index = i;
            step.innerHTML = `<div class="pipeline-dot"></div><div class="pipeline-label">${label}</div>`;
            els.pipeline.appendChild(step);
        });
    }

    function buildTimeline() {
        if (!els.tourTimeline) return;
        const total = totalStops();
        els.tourTimeline.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const tick = document.createElement('button');
            tick.className = 'tour-tick';
            tick.dataset.index = i;
            tick.type = 'button';
            const data = (TF.tour && TF.tour.getStopData) ? TF.tour.getStopData(i) : null;
            tick.setAttribute('aria-label', `Go to stop ${i + 1}${data && data.title ? ': ' + data.title : ''}`);
            tick.addEventListener('click', () => {
                if (TF.tour && TF.tour.skipToStop) TF.tour.skipToStop(i);
            });
            els.tourTimeline.appendChild(tick);
        }
    }

    function wireDemoLinks() {
        [els.btnBookDemo, els.btnBookDemoTop, els.tourCta].forEach(a => {
            if (a) a.setAttribute('href', DEMO_LINK);
        });
    }

    function wireEvents() {
        // Landing: Start Executive Tour -> cinematic auto-play
        if (els.btnStartTour) {
            els.btnStartTour.addEventListener('click', () => {
                hideLanding();
                enterTourMode();
                if (TF.tour && TF.tour.startTour) TF.tour.startTour();
                if (TF.tour && TF.tour.play) TF.tour.play();
            });
        }
        // Landing: Explore the Facility
        if (els.btnExplore) {
            els.btnExplore.addEventListener('click', () => {
                hideLanding();
                showExplorationUI();
            });
        }

        // Top bar: Replay Tour
        if (els.btnTourRestart) {
            els.btnTourRestart.addEventListener('click', () => {
                enterTourMode();
                if (TF.tour && TF.tour.startTour) TF.tour.startTour();
                if (TF.tour && TF.tour.play) TF.tour.play();
            });
        }

        // Tour controls
        if (els.tourBtnPrev) els.tourBtnPrev.addEventListener('click', () => { if (TF.tour && TF.tour.prevStop) TF.tour.prevStop(); });
        if (els.tourBtnNext) els.tourBtnNext.addEventListener('click', () => { if (TF.tour && TF.tour.nextStop) TF.tour.nextStop(); });
        if (els.tourBtnPlay) {
            els.tourBtnPlay.addEventListener('click', () => {
                if (TF.tour && TF.tour.togglePlay) TF.tour.togglePlay();
                // Reflect immediately in case onPlayStateChange isn't fired.
                if (TF.tour && TF.tour.isPaused) setTourPlayState(TF.tour.isPaused());
            });
        }
        if (els.tourBtnSkip) {
            els.tourBtnSkip.addEventListener('click', () => {
                if (TF.tour && TF.tour.endTour) TF.tour.endTour();
                exitTourMode();
            });
        }

        // Tyre parameter sliders (Explore mode)
        let previewTimeoutId;
        document.querySelectorAll('#control-panel input[type=range]').forEach(slider => {
            slider.addEventListener('input', () => {
                updateSliderLabels();
                clearTimeout(previewTimeoutId);
                previewTimeoutId = setTimeout(() => { if (TF.main) TF.main.updateMainTyre(true); }, 10);
            });
            slider.addEventListener('change', () => {
                clearTimeout(previewTimeoutId);
                showLoading('Molding high-res geometry…');
                setTimeout(() => { if (TF.main) TF.main.updateMainTyre(false); }, 50);
            });
        });

        // Export
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => { if (TF.main) TF.main.exportToOBJ(); });
    }

    function wireTourCallbacks() {
        if (!TF.tour) return;
        TF.tour.onStopArrive = showTourStop;
        TF.tour.onTourEnd = onTourFinished;
        TF.tour.onProgress = setTourProgress;             // NEW (auto-play dwell)
        TF.tour.onPlayStateChange = setTourPlayState;     // NEW (play/pause)
    }

    /* ---------- Landing ---------- */
    function hideLanding() { if (els.landing) els.landing.classList.add('hidden'); }

    /* ---------- Explore vs Tour modes ---------- */
    function showExplorationUI() {
        if (els.topBar)       els.topBar.classList.remove('hidden');
        if (els.controlPanel) els.controlPanel.classList.remove('hidden');
        if (els.flowHud)      els.flowHud.classList.remove('hidden');
    }
    function hideExplorationUI() {
        if (els.topBar)       els.topBar.classList.add('hidden');
        if (els.controlPanel) els.controlPanel.classList.add('hidden');
        if (els.flowHud)      els.flowHud.classList.add('hidden');
    }

    function enterTourMode() {
        // Hide Explore chrome; show cinematic letterbox + tour HUD.
        hideExplorationUI();
        if (els.cinemaBars) els.cinemaBars.classList.add('active');
        setTourProgress(0);
        setTourPlayState(false); // playing
        // Pre-fill first stop so the card isn't empty during the opening glide.
        if (TF.tour && TF.tour.getStopData) {
            showTourStop(0, TF.tour.getStopData(0));
        } else if (els.tourHud) {
            els.tourHud.classList.add('visible');
        }
    }
    function exitTourMode() {
        hideTourCard();
        if (els.cinemaBars) els.cinemaBars.classList.remove('active');
        showExplorationUI();
    }

    /* ---------- Tour HUD ---------- */
    function showTourStop(index, data) {
        if (!els.tourHud || !data) return;
        const total = totalStops();
        const isLast = index === total - 1;

        els.tourStepBadge.textContent = pad2(index);
        els.tourCounter.textContent = `${pad2(index)} / ${pad2(total - 1)}`;
        els.tourTitle.textContent = data.title || '';
        els.tourDesc.textContent = data.desc || '';

        // Metric chips
        els.tourMetrics.innerHTML = '';
        (data.metrics || []).forEach(m => {
            const span = document.createElement('span');
            span.className = 'tour-card-metric';
            span.textContent = m;
            els.tourMetrics.appendChild(span);
        });

        // Timeline ticks: active / done
        if (els.tourTimeline) {
            els.tourTimeline.querySelectorAll('.tour-tick').forEach((t, i) => {
                t.classList.toggle('active', i === index);
                t.classList.toggle('done', i < index);
                if (i === index) t.setAttribute('aria-current', 'true');
                else t.removeAttribute('aria-current');
            });
        }

        // Reset dwell progress each stop, reveal CTA on last stop
        setTourProgress(0);
        if (els.tourCta) els.tourCta.classList.toggle('show', isLast);

        els.tourHud.classList.add('visible');
    }

    function hideTourCard() {
        if (els.tourHud) els.tourHud.classList.remove('visible');
        if (els.tourCta) els.tourCta.classList.remove('show');
    }

    function onTourFinished() { exitTourMode(); }

    function setTourProgress(frac) {
        if (!els.tourProgress) return;
        const pct = Math.max(0, Math.min(1, frac || 0)) * 100;
        els.tourProgress.style.width = pct + '%';
    }

    function setTourPlayState(isPaused) {
        if (!els.tourBtnPlay) return;
        els.tourBtnPlay.dataset.state = isPaused ? 'paused' : 'playing';
        els.tourBtnPlay.setAttribute('aria-label', isPaused ? 'Play' : 'Pause');
    }

    /* ---------- Loading ---------- */
    function showLoading(text) {
        if (els.loadingText) els.loadingText.textContent = text || 'Loading…';
        if (els.loadingOverlay) els.loadingOverlay.style.display = 'flex';
    }
    function hideLoading() {
        if (els.loadingOverlay) els.loadingOverlay.style.display = 'none';
    }

    /* ---------- Live HUD (per frame) ---------- */
    function updateHUD() {
        if (!TF.logistics) return;

        const phaseText = TF.logistics.getPhaseText && TF.logistics.getPhaseText();
        if (els.flowPhase && phaseText) els.flowPhase.textContent = phaseText;

        const activeIdx = TF.logistics.getPipelineIndex ? TF.logistics.getPipelineIndex() : -1;
        if (els.pipeline) {
            els.pipeline.querySelectorAll('.pipeline-step').forEach((step, i) => {
                step.classList.toggle('active', i === activeIdx);
                step.classList.toggle('completed', i < activeIdx);
            });
        }

        const kpis = TF.logistics.getKPIs ? TF.logistics.getKPIs() : null;
        if (kpis) {
            if (els.kpiTyres)   els.kpiTyres.textContent = kpis.tyres;
            if (els.kpiPallets) els.kpiPallets.textContent = kpis.pallets;
            if (els.kpiTrucks)  els.kpiTrucks.textContent = kpis.trucks;
        }
    }

    /* ---------- Slider labels ---------- */
    function updateSliderLabels() {
        const map = [
            { slider: 'param-radius', label: 'val-radius', decimals: 1 },
            { slider: 'param-width',  label: 'val-width',  decimals: 1 },
            { slider: 'param-rim',    label: 'val-rim',    decimals: 1 },
            { slider: 'param-tread',  label: 'val-tread',  decimals: 2 },
            { slider: 'param-count',  label: 'val-count',  decimals: 0 }
        ];
        map.forEach(({ slider, label, decimals }) => {
            const s = document.getElementById(slider);
            const l = document.getElementById(label);
            if (s && l) l.textContent = parseFloat(s.value).toFixed(decimals);
        });
    }

    /* ---------- Expose API (contract-frozen) ---------- */
    TF.ui = {
        init,
        showTourStop,
        hideTourCard,
        setTourProgress,
        setTourPlayState,
        showLoading,
        hideLoading,
        updateHUD,
        updateSliderLabels,
        showExplorationUI,
        hideExplorationUI,
        enterTourMode,
        exitTourMode,
        // convenience (not in contract, harmless)
        hideLanding,
        PIPELINE_LABELS
    };
})();
