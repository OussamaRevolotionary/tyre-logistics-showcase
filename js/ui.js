/* ============================================================
   TYREFLOW — UI MANAGER
   Landing hook, cinematic tour HUD, live ops dashboard, wiring
   Cyan = live telemetry · Gold = executive CTAs / hero / headline KPI
   ============================================================ */
window.TF = window.TF || {};

(function() {
    'use strict';

    // Published n8n webhooks (see _BUILD_CONTRACT.md for the workflows behind these).
    const DEMO_INTAKE_URL = 'https://oussama19.app.n8n.cloud/webhook/tyreflow-demo-intake';
    const CHATBOT_URL     = 'https://oussama19.app.n8n.cloud/webhook/tyreflow-chatbot';
    const CHAT_SESSION_KEY = 'tyreflowChatSessionId';

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
            kpiTrucks:      document.getElementById('kpi-trucks'),

            demoModal:        document.getElementById('demo-modal'),
            demoForm:         document.getElementById('demo-form'),
            demoFormStatus:   document.getElementById('demo-form-status'),
            demoFormSubmit:   document.getElementById('demo-form-submit'),
            demoNameInput:    document.getElementById('demo-name'),

            chatWidget:     document.getElementById('chat-widget'),
            chatFab:        document.getElementById('chat-fab'),
            chatPanel:      document.getElementById('chat-panel'),
            chatPanelClose: document.getElementById('chat-panel-close'),
            chatMessages:   document.getElementById('chat-messages'),
            chatForm:       document.getElementById('chat-form'),
            chatInput:      document.getElementById('chat-input'),
            chatSend:       document.getElementById('chat-send')
        };

        buildPipeline();
        buildTimeline();
        wireEvents();
        wireTourCallbacks();
        wireDemoModal();
        wireChatWidget();
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

    function wireEvents() {
        // Book a Demo (landing, top bar, tour CTA) -> open the demo modal
        [els.btnBookDemo, els.btnBookDemoTop, els.tourCta].forEach(btn => {
            if (btn) btn.addEventListener('click', () => openDemoModal(btn));
        });

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
        if (els.chatWidget)   els.chatWidget.classList.remove('hidden');
    }
    function hideExplorationUI() {
        if (els.topBar)       els.topBar.classList.add('hidden');
        if (els.controlPanel) els.controlPanel.classList.add('hidden');
        if (els.flowHud)      els.flowHud.classList.add('hidden');
        if (els.chatWidget)   els.chatWidget.classList.add('hidden');
        closeChatPanel();
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

    /* ---------- Book-a-Demo modal ---------- */
    let demoLastFocused = null;

    function wireDemoModal() {
        if (!els.demoModal) return;

        els.demoModal.querySelectorAll('[data-demo-close]').forEach(el => {
            el.addEventListener('click', () => closeDemoModal());
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && els.demoModal.classList.contains('open')) closeDemoModal();
        });
        if (els.demoForm) els.demoForm.addEventListener('submit', handleDemoFormSubmit);
    }

    function openDemoModal(triggerEl) {
        if (!els.demoModal) return;
        demoLastFocused = triggerEl || document.activeElement;
        els.demoModal.classList.add('open');
        setDemoStatus('', null);
        window.setTimeout(() => { if (els.demoNameInput) els.demoNameInput.focus(); }, 50);
    }

    function closeDemoModal() {
        if (!els.demoModal) return;
        els.demoModal.classList.remove('open');
        if (demoLastFocused && demoLastFocused.focus) demoLastFocused.focus();
    }

    function setDemoStatus(text, kind) {
        if (!els.demoFormStatus) return;
        els.demoFormStatus.textContent = text || '';
        els.demoFormStatus.classList.toggle('success', kind === 'success');
        els.demoFormStatus.classList.toggle('error', kind === 'error');
    }

    async function handleDemoFormSubmit(e) {
        e.preventDefault();
        if (!els.demoForm) return;

        const fd = new FormData(els.demoForm);
        const payload = {
            name: (fd.get('name') || '').toString().trim(),
            email: (fd.get('email') || '').toString().trim(),
            company: (fd.get('company') || '').toString().trim(),
            jobTitle: (fd.get('jobTitle') || '').toString().trim(),
            phone: (fd.get('phone') || '').toString().trim(),
            message: (fd.get('message') || '').toString().trim(),
            source: 'tyreflow-web-form',
            sessionId: getChatSessionId()
        };

        if (!payload.name || !payload.email) {
            setDemoStatus('Please fill in your name and business email.', 'error');
            return;
        }

        if (els.demoFormSubmit) { els.demoFormSubmit.disabled = true; els.demoFormSubmit.classList.add('pending'); }
        setDemoStatus('Sending…', null);

        try {
            const res = await fetch(DEMO_INTAKE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok && data.success !== false) {
                setDemoStatus(data.message || 'Thanks — our team will be in touch shortly.', 'success');
                els.demoForm.reset();
                window.setTimeout(closeDemoModal, 2200);
            } else {
                setDemoStatus(data.error || 'Something went wrong — please try again.', 'error');
            }
        } catch (err) {
            setDemoStatus('Network error — please try again or email oussama.g@oussamalabs.com.', 'error');
        } finally {
            if (els.demoFormSubmit) { els.demoFormSubmit.disabled = false; els.demoFormSubmit.classList.remove('pending'); }
        }
    }

    /* ---------- Chat widget (TyreFlow Assistant) ---------- */
    let chatSessionId = null;
    let chatGreeted = false;

    function getChatSessionId() {
        if (chatSessionId) return chatSessionId;
        try {
            chatSessionId = window.sessionStorage.getItem(CHAT_SESSION_KEY);
        } catch (err) { chatSessionId = null; }
        if (!chatSessionId) {
            chatSessionId = (window.crypto && window.crypto.randomUUID)
                ? window.crypto.randomUUID()
                : 'sess-' + Date.now() + '-' + Math.random().toString(16).slice(2);
            try { window.sessionStorage.setItem(CHAT_SESSION_KEY, chatSessionId); } catch (err) { /* storage unavailable */ }
        }
        return chatSessionId;
    }

    function wireChatWidget() {
        if (!els.chatFab) return;
        els.chatFab.addEventListener('click', toggleChatPanel);
        if (els.chatPanelClose) els.chatPanelClose.addEventListener('click', closeChatPanel);
        if (els.chatForm) els.chatForm.addEventListener('submit', handleChatSubmit);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && els.chatPanel && els.chatPanel.classList.contains('open')) closeChatPanel();
        });
    }

    function toggleChatPanel() {
        if (!els.chatPanel) return;
        if (els.chatPanel.classList.contains('open')) closeChatPanel();
        else openChatPanel();
    }

    function openChatPanel() {
        if (!els.chatPanel) return;
        els.chatPanel.classList.add('open');
        if (els.chatFab) els.chatFab.setAttribute('aria-expanded', 'true');
        if (!chatGreeted) {
            chatGreeted = true;
            appendChatMessage('assistant',
                'Hi — I’m the TyreFlow Assistant, built by OussamaLabs. Ask me what this platform can do, ' +
                'or what OussamaLabs can build for your operation.');
        }
        window.setTimeout(() => { if (els.chatInput) els.chatInput.focus(); }, 50);
    }

    function closeChatPanel() {
        if (!els.chatPanel) return;
        els.chatPanel.classList.remove('open');
        if (els.chatFab) els.chatFab.setAttribute('aria-expanded', 'false');
    }

    function appendChatMessage(role, text) {
        if (!els.chatMessages) return null;
        const bubble = document.createElement('div');
        bubble.className = 'chat-msg chat-msg--' + role;
        bubble.textContent = text;
        els.chatMessages.appendChild(bubble);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
        return bubble;
    }

    function showTyping() {
        if (!els.chatMessages) return null;
        const typing = document.createElement('div');
        typing.className = 'chat-msg chat-msg--typing';
        typing.innerHTML = '<span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span>';
        els.chatMessages.appendChild(typing);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
        return typing;
    }

    async function handleChatSubmit(e) {
        e.preventDefault();
        if (!els.chatInput) return;
        const text = els.chatInput.value.trim();
        if (!text) return;

        appendChatMessage('user', text);
        els.chatInput.value = '';
        els.chatInput.disabled = true;
        if (els.chatSend) els.chatSend.disabled = true;
        const typingEl = showTyping();

        try {
            const res = await fetch(CHATBOT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: getChatSessionId(), chatInput: text })
            });
            const data = await res.json().catch(() => ({}));
            if (typingEl) typingEl.remove();
            appendChatMessage('assistant', (data && data.output) || 'Sorry, I didn’t catch that — could you rephrase?');
        } catch (err) {
            if (typingEl) typingEl.remove();
            appendChatMessage('error', 'Connection hiccup — please try again, or email oussama.g@oussamalabs.com.');
        } finally {
            els.chatInput.disabled = false;
            if (els.chatSend) els.chatSend.disabled = false;
            els.chatInput.focus();
        }
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
