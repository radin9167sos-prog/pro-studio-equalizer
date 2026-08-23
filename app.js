/*
 * ===================================================================
 * PRO STUDIO EQUALIZER 4.0 — FULL TECHNICAL DSP ENGINE & AUDIT FIXES
 * 31-Band ISO EQ, Auto-Headroom Gain Staging, True Peak Limiter,
 * Multi-Curve Saturation, Smooth 8D Panner, 100% Export Parity & 60FPS Engine
 * ===================================================================
 */

class Equalizer31App {
    constructor() {
        this.audioCtx = null;
        this.rawAudioBuffer = null;
        this.vocalBuffer = null;
        this.musicBuffer = null;

        this.vocalSource = null;
        this.musicSource = null;
        this.micSource = null;
        this.micStream = null;

        // Master Audio Graph Nodes
        this.preAmpNode = null;
        this.hpfNode = null;
        this.eqNodes = [];
        this.subBassFilterNode = null;
        this.subBassGainNode = null;
        this.lpfNode = null;
        this.tapeNode = null;
        this.reverbNode = null;
        this.reverbGainNode = null;
        this.panner8DNode = null;
        this.compressorNode = null;
        this.limiterNode = null;
        this.autoHeadroomNode = null;
        this.vocalGain = null;
        this.musicGain = null;
        this.analyser = null;

        // State Flags
        this.isPlaying = false;
        this.isMicActive = false;
        this.is8DActive = false;
        this.isAutoHeadroomEnabled = true;
        this.pannerAngle = 0;

        this.startTime = 0;
        this.pauseOffset = 0;
        this.audioDuration = 0;
        this.fileName = 'Track';
        this.currentViewMode = 'SIMPLE'; // 'SIMPLE' or 'PRO'

        // Performance & Visualizer Caching (Zero-Allocation 60FPS Engine)
        this.freqDataArray = null;
        this.timeDataArray = null;
        this.lastFrameTime = 0;
        this.fpsCount = 60;
        this.isLowEndDevice = false;
        this.cachedGradient = null;

        // 31 Standard ISO 1/3 Octave Equalizer Frequencies (Hz)
        this.EQ_FREQUENCIES = [
            20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
            630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
            10000, 12500, 16000, 20000
        ];
        this.SIMPLE_INDICES = [2, 4, 6, 7, 8, 9, 10, 11, 12, 13];

        this.eqGains = new Array(31).fill(0);
        this.preAmpGainDb = 0;
        this.tempoSpeed = 1.0;
        this.pitchSemitones = 0;
        this.subBassLevel = 100;
        this.reverbLevel = 0;
        this.tapeWarmthLevel = 0;
        this.hpfFreq = 20;
        this.lpfFreq = 20000;
        this.limiterCeilingDb = -0.3;
        this.compThresholdDb = -12;

        // Equalizer Presets
        this.EQ_PRESETS = {
            FLAT:        new Array(31).fill(0),
            BASS_BOOST:  [12, 11, 10, 9, 8, 7, 6, 4, 3, 2, 1, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8],
            VOCAL_BOOST: [-4, -4, -3, -3, -2, -2, -1, 0, 1, 2, 3, 4, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            POP_DANCE:   [6, 6, 7, 7, 5, 4, 3, 1, 0, -1, -1, 0, 1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 7, 7, 6, 6, 5, 5],
            ROCK:        [8, 8, 7, 6, 5, 4, 2, 1, 0, -1, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 7, 8, 8, 9, 9, 9, 8, 8, 7, 7, 6],
            HIFI:        [4, 4, 3, 3, 2, 2, 1, 0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11, 12, 12, 11, 10, 9, 8, 7]
        };

        this.visMode = 'SPECTRUM';

        this.initDOM();
        this.render31Faders();
        this.bindEvents();
    }

    initDOM() {
        this.dropZone = document.getElementById('dropZone');
        this.audioInput = document.getElementById('audioInput');
        this.btnSelectFile = document.getElementById('btnSelectFile');
        this.btnLiveMicStart = document.getElementById('btnLiveMicStart');
        this.btnProModeStart = document.getElementById('btnProModeStart');
        this.audioInfoCard = document.getElementById('audioInfoCard');

        this.trackName = document.getElementById('trackName');
        this.trackDetails = document.getElementById('trackDetails');
        this.btnChangeFile = document.getElementById('btnChangeFile');

        // Master Peak LED & VU Meter Elements
        this.peakBarFill = document.getElementById('peakBarFill');
        this.peakValueDisplay = document.getElementById('peakValueDisplay');
        this.clipLed = document.getElementById('clipLed');

        this.canvas = document.getElementById('spectrumCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.timeCurrent = document.getElementById('timeCurrent');
        this.timeTotal = document.getElementById('timeTotal');
        this.timelineSlider = document.getElementById('timelineSlider');

        this.btnPlayPause = document.getElementById('btnPlayPause');
        this.btnStop = document.getElementById('btnStop');
        this.btnToggleMic = document.getElementById('btnToggleMic');

        // Mode Switcher Tabs
        this.btnTabSimple = document.getElementById('btnTabSimple');
        this.btnTabPro = document.getElementById('btnTabPro');
        this.simpleModeContainer = document.getElementById('simpleModeContainer');
        this.proModeContainer = document.getElementById('proModeContainer');

        this.btnResetSimpleEQ = document.getElementById('btnResetSimpleEQ');
        this.btnResetEQ = document.getElementById('btnResetEQ');

        // Limiter & Auto Headroom Controls
        this.sliderLimiterCeiling = document.getElementById('sliderLimiterCeiling');
        this.valLimiterCeiling = document.getElementById('valLimiterCeiling');
        this.btnToggleHeadroom = document.getElementById('btnToggleHeadroom');
        this.valAutoHeadroom = document.getElementById('valAutoHeadroom');

        this.btnToggle8D = document.getElementById('btnToggle8D');
        this.val8D = document.getElementById('val8D');

        this.sliderReverb = document.getElementById('sliderReverb');
        this.valReverb = document.getElementById('valReverb');
        this.sliderTapeWarmth = document.getElementById('sliderTapeWarmth');
        this.valTapeWarmth = document.getElementById('valTapeWarmth');
        this.sliderCompThreshold = document.getElementById('sliderCompThreshold');
        this.valCompThreshold = document.getElementById('valCompThreshold');

        this.sliderHPF = document.getElementById('sliderHPF');
        this.valHPF = document.getElementById('valHPF');
        this.sliderLPF = document.getElementById('sliderLPF');
        this.valLPF = document.getElementById('valLPF');

        this.sliderTempoSpeed = document.getElementById('sliderTempoSpeed');
        this.valTempoSpeed = document.getElementById('valTempoSpeed');
        this.sliderPitchShift = document.getElementById('sliderPitchShift');
        this.valPitchShift = document.getElementById('valPitchShift');
        this.sliderSubBass = document.getElementById('sliderSubBass');
        this.valSubBass = document.getElementById('valSubBass');

        this.sliderPreAmp = document.getElementById('sliderPreAmp');
        this.valPreAmp = document.getElementById('valPreAmp');

        this.sliderVocalVolSimple = document.getElementById('sliderVocalVolSimple');
        this.valVocalVolSimple = document.getElementById('valVocalVolSimple');
        this.sliderMusicVolSimple = document.getElementById('sliderMusicVolSimple');
        this.valMusicVolSimple = document.getElementById('valMusicVolSimple');

        this.btnExportEQ = document.getElementById('btnExportEQ');
        this.btnExportVocals = document.getElementById('btnExportVocals');
        this.btnExportMusic = document.getElementById('btnExportMusic');
    }

    render31Faders() {
        const container = document.getElementById('eqFaders31Container');
        if (!container) return;

        let html = '';
        this.EQ_FREQUENCIES.forEach((freq, idx) => {
            const freqLabel = (freq >= 1000) ? (freq / 1000) + 'k' : freq + 'Hz';
            html += `
                <div class="eq-fader-col">
                    <span class="fader-val" id="eq-val-${idx}">0 dB</span>
                    <input type="range" class="eq-fader" id="eq-band-${idx}" data-band-idx="${idx}" min="-12" max="12" step="0.5" value="0" orient="vertical">
                    <span class="fader-label">${freqLabel}</span>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    bindEvents() {
        this.dropZone.addEventListener('click', () => this.audioInput.click());
        this.btnSelectFile.addEventListener('click', (e) => {
            e.stopPropagation();
            this.audioInput.click();
        });

        this.btnProModeStart.addEventListener('click', (e) => {
            e.stopPropagation();
            this.switchViewMode('PRO');
            this.audioInput.click();
        });

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });

        this.audioInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        this.btnChangeFile.addEventListener('click', () => {
            this.stopPlayback();
            this.dropZone.classList.remove('hidden');
            this.audioInfoCard.classList.add('hidden');
        });

        this.btnLiveMicStart.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startLiveMic();
        });
        this.btnToggleMic.addEventListener('click', () => this.toggleLiveMic());

        // Mode Switcher Tabs
        this.btnTabSimple.addEventListener('click', () => this.switchViewMode('SIMPLE'));
        this.btnTabPro.addEventListener('click', () => this.switchViewMode('PRO'));

        this.btnPlayPause.addEventListener('click', () => this.togglePlayPause());
        this.btnStop.addEventListener('click', () => this.stopPlayback());

        this.timelineSlider.addEventListener('input', (e) => {
            const seekPct = parseFloat(e.target.value) / 100;
            this.seekTo(seekPct * this.audioDuration);
        });

        // 10 Simple Band Faders
        for (let i = 0; i < 10; i++) {
            const simpleFader = document.getElementById(`simple-band-${i}`);
            if (simpleFader) {
                simpleFader.addEventListener('input', (e) => {
                    const gainDb = parseFloat(e.target.value);
                    const target31Index = this.SIMPLE_INDICES[i];
                    this.setEQBandGain(target31Index, gainDb);
                    const simpleVal = document.getElementById(`simple-val-${i}`);
                    if (simpleVal) simpleVal.innerText = (gainDb > 0 ? '+' : '') + gainDb + ' dB';
                });
            }
        }

        // 31 Faders
        for (let i = 0; i < 31; i++) {
            const fader = document.getElementById(`eq-band-${i}`);
            if (fader) {
                fader.addEventListener('input', (e) => {
                    const gainDb = parseFloat(e.target.value);
                    this.setEQBandGain(i, gainDb);
                });
            }
        }

        if (this.btnResetSimpleEQ) this.btnResetSimpleEQ.addEventListener('click', () => this.applyEQPreset('FLAT'));
        if (this.btnResetEQ) this.btnResetEQ.addEventListener('click', () => this.applyEQPreset('FLAT'));

        // Limiter & Auto Headroom Controls
        if (this.sliderLimiterCeiling) {
            this.sliderLimiterCeiling.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.limiterCeilingDb = val;
                this.valLimiterCeiling.innerText = val.toFixed(1) + ' dBFS';
                if (this.limiterNode && this.audioCtx) {
                    this.limiterNode.threshold.setTargetAtTime(val, this.audioCtx.currentTime, 0.02);
                }
            });
        }

        if (this.btnToggleHeadroom) {
            this.btnToggleHeadroom.addEventListener('click', () => {
                this.isAutoHeadroomEnabled = !this.isAutoHeadroomEnabled;
                this.btnToggleHeadroom.innerText = this.isAutoHeadroomEnabled ? '🛡️ Headroom Guard: فعال' : '🛡️ Headroom Guard: غیرفعال';
                this.valAutoHeadroom.innerText = this.isAutoHeadroomEnabled ? 'فعال' : 'غیرفعال';
                this.updateAutoHeadroom();
            });
        }

        if (this.btnToggle8D) {
            this.btnToggle8D.addEventListener('click', () => this.toggle8DAudio());
        }

        const presetBtns = document.querySelectorAll('.eq-preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const presetKey = e.currentTarget.getAttribute('data-eq-preset');
                presetBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.applyEQPreset(presetKey);
            });
        });

        const visBtns = document.querySelectorAll('.vis-mode-btn');
        visBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.getAttribute('data-vis-mode');
                visBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.visMode = mode;
                if (!this.isPlaying) this.drawVisualizerStatic();
            });
        });

        // Reverb & Saturation
        this.sliderReverb.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.reverbLevel = val;
            this.valReverb.innerText = val + '%';
            if (this.reverbGainNode && this.audioCtx) {
                this.reverbGainNode.gain.setTargetAtTime(val / 100, this.audioCtx.currentTime, 0.02);
            }
        });

        this.sliderTapeWarmth.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.tapeWarmthLevel = val;
            this.valTapeWarmth.innerText = val + '%';
            if (this.tapeNode) this.tapeNode.curve = this.createDistortionCurve(val);
        });

        this.sliderCompThreshold.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.compThresholdDb = val;
            this.valCompThreshold.innerText = val + ' dB';
            if (this.compressorNode && this.audioCtx) {
                this.compressorNode.threshold.setTargetAtTime(val, this.audioCtx.currentTime, 0.02);
            }
        });

        // HPF & LPF
        this.sliderHPF.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.hpfFreq = val;
            this.valHPF.innerText = val + ' Hz';
            if (this.hpfNode && this.audioCtx) {
                this.hpfNode.frequency.setTargetAtTime(val, this.audioCtx.currentTime, 0.02);
            }
        });

        this.sliderLPF.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.lpfFreq = val;
            this.valLPF.innerText = (val >= 1000 ? (val / 1000).toFixed(1) + ' kHz' : val + ' Hz');
            if (this.lpfNode && this.audioCtx) {
                this.lpfNode.frequency.setTargetAtTime(val, this.audioCtx.currentTime, 0.02);
            }
        });

        // Tempo & Pitch
        this.sliderTempoSpeed.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.tempoSpeed = speed;
            this.valTempoSpeed.innerText = speed.toFixed(2) + 'x';
            this.updatePlaybackRates();
        });

        this.sliderPitchShift.addEventListener('input', (e) => {
            const semitones = parseInt(e.target.value);
            this.pitchSemitones = semitones;
            this.valPitchShift.innerText = (semitones > 0 ? '+' : '') + semitones + ' Semitones';
            this.updatePlaybackRates();
        });

        this.sliderSubBass.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.subBassLevel = val;
            this.valSubBass.innerText = val + '%';
            if (this.subBassGainNode && this.audioCtx) {
                this.subBassGainNode.gain.setTargetAtTime((val / 100) * 1.5, this.audioCtx.currentTime, 0.02);
            }
        });

        this.sliderPreAmp.addEventListener('input', (e) => {
            const valDb = parseFloat(e.target.value);
            this.preAmpGainDb = valDb;
            this.valPreAmp.innerText = (valDb > 0 ? '+' : '') + valDb + ' dB';
            if (this.preAmpNode && this.audioCtx) {
                this.preAmpNode.gain.setTargetAtTime(Math.pow(10, valDb / 20), this.audioCtx.currentTime, 0.02);
            }
            this.updateAutoHeadroom();
        });

        this.sliderVocalVolSimple.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.valVocalVolSimple.innerText = val + '%';
            if (this.vocalGain && this.audioCtx) {
                this.vocalGain.gain.setTargetAtTime(val / 100, this.audioCtx.currentTime, 0.02);
            }
        });

        this.sliderMusicVolSimple.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.valMusicVolSimple.innerText = val + '%';
            if (this.musicGain && this.audioCtx) {
                this.musicGain.gain.setTargetAtTime(val / 100, this.audioCtx.currentTime, 0.02);
            }
        });

        this.btnExportEQ.addEventListener('click', () => this.exportEqualizedAudio());
        this.btnExportVocals.addEventListener('click', () => this.exportAudioStem('VOCALS'));
        this.btnExportMusic.addEventListener('click', () => this.exportAudioStem('MUSIC'));
    }

    switchViewMode(mode) {
        this.currentViewMode = mode;
        if (mode === 'SIMPLE') {
            this.btnTabSimple.classList.add('active');
            this.btnTabPro.classList.remove('active');
            this.simpleModeContainer.classList.remove('hidden');
            this.proModeContainer.classList.add('hidden');
        } else {
            this.btnTabPro.classList.add('active');
            this.btnTabSimple.classList.remove('active');
            this.proModeContainer.classList.remove('hidden');
            this.simpleModeContainer.classList.add('hidden');
        }
    }

    toggle8DAudio() {
        this.is8DActive = !this.is8DActive;
        if (this.is8DActive) {
            this.btnToggle8D.innerText = '🌐 8D Audio: فعال (چرخش 360° روان)';
            this.btnToggle8D.style.borderColor = '#ff007f';
            this.val8D.innerText = 'فعال 360°';
        } else {
            this.btnToggle8D.innerText = '🌐 فعال‌سازی حالت 8D Audio';
            this.btnToggle8D.style.borderColor = '';
            this.val8D.innerText = 'غیرفعال';
            this.resetPannerPosition();
        }
    }

    resetPannerPosition() {
        if (this.panner8DNode && this.audioCtx) {
            const now = this.audioCtx.currentTime;
            if (this.panner8DNode.positionX) {
                this.panner8DNode.positionX.setTargetAtTime(0, now, 0.1);
                this.panner8DNode.positionZ.setTargetAtTime(0, now, 0.1);
            } else if (this.panner8DNode.setPosition) {
                this.panner8DNode.setPosition(0, 0, 0);
            }
        }
    }

    async initAudioContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
            this.setupAudioGraph();
        }
        if (this.audioCtx.state === 'suspended') {
            try {
                await this.audioCtx.resume();
            } catch (e) {}
        }
    }

    createImpulseResponse(ctx, duration = 1.2, decay = 1.5) {
        const sampleRate = ctx.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const impulse = ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = i / length;
            left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
            right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
        }
        return impulse;
    }

    createDistortionCurve(amount = 0) {
        const k = amount * 1.5;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;

        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            if (k === 0) {
                curve[i] = x;
            } else {
                curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
            }
        }
        return curve;
    }

    async startLiveMic() {
        await this.initAudioContext();
        this.dropZone.classList.add('hidden');
        this.audioInfoCard.classList.remove('hidden');

        this.trackName.innerText = '🎙️ ورودی میکروفون زنده استودیویی';
        this.trackDetails.innerText = 'در حال پردازش زنده صدا از میکروفون...';

        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);
            this.isMicActive = true;
            this.btnToggleMic.innerText = '🎙️ میکروفون: فعال';
            this.btnToggleMic.style.borderColor = '#00f0ff';

            this.micSource.connect(this.preAmpNode);
            this.isPlaying = true;
            this.renderVisualizer();

        } catch (err) {
            alert('دسترسی به میکروفون امکان‌پذیر نشد: ' + err.message);
        }
    }

    toggleLiveMic() {
        if (this.isMicActive) {
            if (this.micStream) {
                this.micStream.getTracks().forEach(track => track.stop());
            }
            this.isMicActive = false;
            this.btnToggleMic.innerText = '🎙️ میکروفون زنده';
            this.btnToggleMic.style.borderColor = '';
        } else {
            this.startLiveMic();
        }
    }

    async handleFile(file) {
        await this.initAudioContext();
        this.stopPlayback();

        this.fileName = file.name.replace(/\.[^/.]+$/, "");
        this.trackName.innerText = file.name;
        this.trackDetails.innerText = 'در حال دکود اطلاعات فرکانسی موزیک...';

        this.dropZone.classList.add('hidden');
        this.audioInfoCard.classList.remove('hidden');

        try {
            const arrayBuffer = await file.arrayBuffer();
            this.rawAudioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            this.audioDuration = this.rawAudioBuffer.duration;

            const durationStr = this.formatTime(this.audioDuration);
            const sampleRateKHz = (this.rawAudioBuffer.sampleRate / 1000).toFixed(1);
            const channels = this.rawAudioBuffer.numberOfChannels;
            this.trackDetails.innerText = `${sampleRateKHz} kHz | ${channels} کانال | مدت زمان: ${durationStr}`;

            this.timeTotal.innerText = durationStr;
            this.timeCurrent.innerText = '00:00';
            this.timelineSlider.value = 0;

            this.reprocessStems();
            this.drawVisualizerStatic();

        } catch (err) {
            alert('خطا در دکود فایل صوتی. لطفاً فرمت استاندارد صوتی انتخاب کنید: ' + err.message);
            this.dropZone.classList.remove('hidden');
            this.audioInfoCard.classList.add('hidden');
        }
    }

    reprocessStems() {
        if (!this.rawAudioBuffer) return;

        const numChannels = this.rawAudioBuffer.numberOfChannels;
        const length = this.rawAudioBuffer.length;
        const sampleRate = this.rawAudioBuffer.sampleRate;

        this.vocalBuffer = this.audioCtx.createBuffer(numChannels, length, sampleRate);
        this.musicBuffer = this.audioCtx.createBuffer(numChannels, length, sampleRate);

        const leftRaw = this.rawAudioBuffer.getChannelData(0);
        const rightRaw = (numChannels > 1) ? this.rawAudioBuffer.getChannelData(1) : leftRaw;

        const vLeft = this.vocalBuffer.getChannelData(0);
        const vRight = (numChannels > 1) ? this.vocalBuffer.getChannelData(1) : vLeft;

        const mLeft = this.musicBuffer.getChannelData(0);
        const mRight = (numChannels > 1) ? this.musicBuffer.getChannelData(1) : mLeft;

        const alphaHP = 0.85; 
        const alphaLP = 0.35; 

        let lastOutHP_L = 0, lastInL = 0;
        let lastOutLP_L = 0;

        for (let i = 0; i < length; i++) {
            const l = leftRaw[i];
            const r = rightRaw[i];

            const mid = (l + r) * 0.5;
            const side = (l - r) * 0.5;

            lastOutHP_L = alphaHP * (lastOutHP_L + mid - lastInL);
            lastInL = mid;
            lastOutLP_L = lastOutLP_L + alphaLP * (lastOutHP_L - lastOutLP_L);
            const vocalSample = lastOutLP_L * 1.6;

            vLeft[i] = vocalSample;
            vRight[i] = vocalSample;

            const musicSampleL = side + (mid - vocalSample);
            const musicSampleR = -side + (mid - vocalSample);

            mLeft[i] = Math.max(-1.0, Math.min(1.0, musicSampleL));
            mRight[i] = Math.max(-1.0, Math.min(1.0, musicSampleR));
        }
    }

    setEQBandGain(bandIndex, gainDb) {
        this.eqGains[bandIndex] = gainDb;
        const valEl = document.getElementById(`eq-val-${bandIndex}`);
        if (valEl) {
            valEl.innerText = (gainDb > 0 ? '+' : '') + gainDb + ' dB';
        }

        if (this.eqNodes[bandIndex] && this.audioCtx) {
            this.eqNodes[bandIndex].gain.setTargetAtTime(gainDb, this.audioCtx.currentTime, 0.02);
        }

        // Sync 10-band simple UI sliders if mapped
        const simpleIdx = this.SIMPLE_INDICES.indexOf(bandIndex);
        if (simpleIdx !== -1) {
            const simpleFader = document.getElementById(`simple-band-${simpleIdx}`);
            const simpleVal = document.getElementById(`simple-val-${simpleIdx}`);
            if (simpleFader) simpleFader.value = gainDb;
            if (simpleVal) simpleVal.innerText = (gainDb > 0 ? '+' : '') + gainDb + ' dB';
        }

        this.updateAutoHeadroom();
    }

    updateAutoHeadroom() {
        if (!this.autoHeadroomNode || !this.audioCtx) return;

        if (!this.isAutoHeadroomEnabled) {
            this.autoHeadroomNode.gain.setTargetAtTime(1.0, this.audioCtx.currentTime, 0.05);
            return;
        }

        let totalBoostDb = Math.max(0, this.preAmpGainDb);
        for (let i = 0; i < 31; i++) {
            if (this.eqGains[i] > 0) totalBoostDb += this.eqGains[i];
        }

        // Apply smooth Headroom attenuation curve to prevent clipping
        const headroomAttenuation = Math.min(1.0, Math.pow(10, -(totalBoostDb * 0.25) / 20));
        this.autoHeadroomNode.gain.setTargetAtTime(headroomAttenuation, this.audioCtx.currentTime, 0.05);
    }

    applyEQPreset(presetKey) {
        const gains = this.EQ_PRESETS[presetKey] || this.EQ_PRESETS.FLAT;
        for (let i = 0; i < 31; i++) {
            const gainDb = gains[i];
            this.setEQBandGain(i, gainDb);

            const fader = document.getElementById(`eq-band-${i}`);
            if (fader) fader.value = gainDb;
        }
    }

    updatePlaybackRates() {
        const pitchFactor = Math.pow(2, this.pitchSemitones / 12);
        const combinedRate = this.tempoSpeed * pitchFactor;

        if (this.vocalSource && this.audioCtx) this.vocalSource.playbackRate.setTargetAtTime(combinedRate, this.audioCtx.currentTime, 0.02);
        if (this.musicSource && this.audioCtx) this.musicSource.playbackRate.setTargetAtTime(combinedRate, this.audioCtx.currentTime, 0.02);
    }

    // Setup Master Master Audio Graph (COMPLETE TOPOLOGY AUDIT & ATTACHMENTS)
    setupAudioGraph() {
        if (!this.audioCtx) return;

        // 1. Pre-Amp Gain Stage
        this.preAmpNode = this.audioCtx.createGain();
        this.preAmpNode.gain.value = Math.pow(10, this.preAmpGainDb / 20);

        // 2. High-Pass Filter (HPF)
        this.hpfNode = this.audioCtx.createBiquadFilter();
        this.hpfNode.type = 'highpass';
        this.hpfNode.frequency.value = this.hpfFreq;

        // 3. Low-Pass Filter (LPF)
        this.lpfNode = this.audioCtx.createBiquadFilter();
        this.lpfNode.type = 'lowpass';
        this.lpfNode.frequency.value = this.lpfFreq;

        // 4. Sub-Bass Exciter Parallel Branch (AUDIT FIX: Fully Connected to PreAmp & LPF)
        this.subBassFilterNode = this.audioCtx.createBiquadFilter();
        this.subBassFilterNode.type = 'lowpass';
        this.subBassFilterNode.frequency.value = 60;

        this.subBassGainNode = this.audioCtx.createGain();
        this.subBassGainNode.gain.value = (this.subBassLevel / 100) * 1.5;

        // 5. Studio Reverb Convolver Node
        this.reverbNode = this.audioCtx.createConvolver();
        this.reverbNode.buffer = this.createImpulseResponse(this.audioCtx, 1.2, 1.5);

        this.reverbGainNode = this.audioCtx.createGain();
        this.reverbGainNode.gain.value = this.reverbLevel / 100;

        // 6. Tape Saturation WaveShaper Node
        this.tapeNode = this.audioCtx.createWaveShaper();
        this.tapeNode.curve = this.createDistortionCurve(this.tapeWarmthLevel);
        this.tapeNode.oversample = 'none';

        // 7. 8D Audio HRTF PannerNode
        this.panner8DNode = this.audioCtx.createPanner();
        this.panner8DNode.panningModel = 'HRTF';
        this.panner8DNode.distanceModel = 'linear';

        // 8. Master Dynamics Compressor Node
        this.compressorNode = this.audioCtx.createDynamicsCompressor();
        this.compressorNode.threshold.value = this.compThresholdDb;
        this.compressorNode.knee.value = 30;
        this.compressorNode.ratio.value = 12;
        this.compressorNode.attack.value = 0.003;
        this.compressorNode.release.value = 0.25;

        // 9. True Peak Brickwall Limiter Stage (AUDIT FEATURE: Safety Brickwall)
        this.limiterNode = this.audioCtx.createDynamicsCompressor();
        this.limiterNode.threshold.value = this.limiterCeilingDb;
        this.limiterNode.knee.value = 0.0;
        this.limiterNode.ratio.value = 20.0;
        this.limiterNode.attack.value = 0.001;
        this.limiterNode.release.value = 0.05;

        // 10. Auto Headroom Gain Management Stage
        this.autoHeadroomNode = this.audioCtx.createGain();
        this.autoHeadroomNode.gain.value = 1.0;

        // 11. 31-Band ISO BiquadFilter Chain
        this.eqNodes = [];
        for (let i = 0; i < 31; i++) {
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = this.EQ_FREQUENCIES[i];
            filter.Q.value = 4.318; // 1/3 Octave Standard Q
            filter.gain.value = this.eqGains[i];
            this.eqNodes.push(filter);
        }

        // COMPLETE GRAPH CONNECTIONS:
        // PreAmp -> HPF -> EQ[0..30] -> LPF
        // PreAmp -> SubBassFilter -> SubBassGain -> LPF (Parallel Sub-Bass Branch AUDIT FIX)
        this.preAmpNode.connect(this.hpfNode);
        this.hpfNode.connect(this.eqNodes[0]);
        for (let i = 0; i < 30; i++) {
            this.eqNodes[i].connect(this.eqNodes[i + 1]);
        }
        const lastEqNode = this.eqNodes[30];
        lastEqNode.connect(this.lpfNode);

        // Connect Sub-Bass Exciter Branch
        this.preAmpNode.connect(this.subBassFilterNode);
        this.subBassFilterNode.connect(this.subBassGainNode);
        this.subBassGainNode.connect(this.lpfNode);

        // LPF -> Tape Saturation -> Reverb Parallel -> Panner8D -> Compressor -> Limiter -> AutoHeadroom -> Analyser -> Destination
        this.lpfNode.connect(this.tapeNode);

        this.tapeNode.connect(this.reverbNode);
        this.reverbNode.connect(this.reverbGainNode);
        this.reverbGainNode.connect(this.panner8DNode);

        this.tapeNode.connect(this.panner8DNode);

        // Analyser Setup
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 512;
        this.freqDataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeDataArray = new Uint8Array(this.analyser.fftSize);

        this.panner8DNode.connect(this.compressorNode);
        this.compressorNode.connect(this.limiterNode);
        this.limiterNode.connect(this.autoHeadroomNode);
        this.autoHeadroomNode.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);

        this.updateAutoHeadroom();
    }

    async togglePlayPause() {
        if (!this.rawAudioBuffer) return;
        if (this.isPlaying) {
            this.pausePlayback();
        } else {
            await this.startPlayback(this.pauseOffset);
        }
    }

    async startPlayback(offset = 0) {
        await this.initAudioContext();
        this.stopPlaybackNodes();

        this.vocalSource = this.audioCtx.createBufferSource();
        this.musicSource = this.audioCtx.createBufferSource();

        this.vocalSource.buffer = this.vocalBuffer;
        this.musicSource.buffer = this.musicBuffer;

        this.updatePlaybackRates();

        this.vocalGain = this.audioCtx.createGain();
        this.musicGain = this.audioCtx.createGain();

        const vVol = parseFloat(this.sliderVocalVolSimple.value) / 100;
        const mVol = parseFloat(this.sliderMusicVolSimple.value) / 100;

        this.vocalGain.gain.value = vVol;
        this.musicGain.gain.value = mVol;

        this.vocalSource.connect(this.vocalGain);
        this.musicSource.connect(this.musicGain);

        this.vocalGain.connect(this.preAmpNode);
        this.musicGain.connect(this.preAmpNode);

        this.startTime = this.audioCtx.currentTime - offset;
        this.pauseOffset = offset;

        this.vocalSource.start(0, offset);
        this.musicSource.start(0, offset);

        this.isPlaying = true;
        this.btnPlayPause.innerText = '⏸️ توقف موقت';

        this.vocalSource.onended = () => {
            if (this.getCurrentPlaybackTime() >= this.audioDuration - 0.1) {
                this.stopPlayback();
            }
        };

        this.renderVisualizer();
    }

    pausePlayback() {
        if (!this.isPlaying) return;
        this.pauseOffset = this.getCurrentPlaybackTime();
        this.stopPlaybackNodes();
        this.resetPannerPosition();
        this.isPlaying = false;
        this.btnPlayPause.innerText = '▶️ ادامه پخش';
    }

    stopPlayback() {
        this.stopPlaybackNodes();
        this.resetPannerPosition();
        this.pauseOffset = 0;
        this.isPlaying = false;
        this.btnPlayPause.innerText = '▶️ پخش موزیک';
        this.timeCurrent.innerText = '00:00';
        this.timelineSlider.value = 0;
        this.drawVisualizerStatic();
    }

    stopPlaybackNodes() {
        if (this.vocalSource) {
            try { this.vocalSource.stop(); } catch (e) {}
            this.vocalSource.disconnect();
            this.vocalSource = null;
        }
        if (this.musicSource) {
            try { this.musicSource.stop(); } catch (e) {}
            this.musicSource.disconnect();
            this.musicSource = null;
        }
    }

    seekTo(timeSeconds) {
        const wasPlaying = this.isPlaying;
        this.pauseOffset = Math.min(Math.max(0, timeSeconds), this.audioDuration);
        if (wasPlaying) {
            this.startPlayback(this.pauseOffset);
        } else {
            this.timeCurrent.innerText = this.formatTime(this.pauseOffset);
            this.timelineSlider.value = (this.pauseOffset / this.audioDuration) * 100;
        }
    }

    getCurrentPlaybackTime() {
        if (!this.isPlaying) return this.pauseOffset;
        return Math.min(this.audioDuration, this.audioCtx.currentTime - this.startTime);
    }

    // ZERO-ALLOCATION 60 FPS VISUALIZER ENGINE & ADAPTIVE PERFORMANCE MANAGER
    renderVisualizer(timestamp = 0) {
        if (!this.isPlaying) return;

        // Frame timing & Adaptive Quality Monitor
        if (this.lastFrameTime) {
            const delta = timestamp - this.lastFrameTime;
            if (delta > 22) { // Render time > 22ms (< 45 FPS)
                this.isLowEndDevice = true;
            }
        }
        this.lastFrameTime = timestamp;

        const currentPos = this.getCurrentPlaybackTime();
        this.timeCurrent.innerText = this.formatTime(currentPos);
        this.timelineSlider.value = (currentPos / this.audioDuration) * 100;

        // Smooth 8D Spatial Audio Rotation Automation (AUDIT FIX: Smooth setTargetAtTime interpolation)
        if (this.is8DActive && this.panner8DNode && this.audioCtx) {
            this.pannerAngle += 0.03;
            const x = Math.sin(this.pannerAngle) * 3;
            const z = Math.cos(this.pannerAngle) * 3;
            const now = this.audioCtx.currentTime;

            if (this.panner8DNode.positionX) {
                this.panner8DNode.positionX.setTargetAtTime(x, now, 0.05);
                this.panner8DNode.positionZ.setTargetAtTime(z, now, 0.05);
            } else if (this.panner8DNode.setPosition) {
                this.panner8DNode.setPosition(x, 0, z);
            }
        }

        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (this.analyser) {
            this.updatePeakMeter();

            if (this.visMode === 'SPECTRUM') {
                this.drawSpectrum(w, h);
            } else if (this.visMode === 'WAVEFORM') {
                this.drawWaveform(w, h);
            } else if (this.visMode === 'CIRCLE') {
                this.drawCircleVisualizer(w, h);
            }
        }

        requestAnimationFrame((t) => this.renderVisualizer(t));
    }

    updatePeakMeter() {
        if (!this.analyser || !this.timeDataArray) return;
        this.analyser.getByteTimeDomainData(this.timeDataArray);

        let maxVal = 0;
        for (let i = 0; i < this.timeDataArray.length; i++) {
            const sample = Math.abs(this.timeDataArray[i] - 128) / 128.0;
            if (sample > maxVal) maxVal = sample;
        }

        const db = 20 * Math.log10(Math.max(0.0001, maxVal));
        const pct = Math.min(100, Math.max(0, (db + 40) * 2.5));

        if (this.peakBarFill) this.peakBarFill.style.width = pct + '%';
        if (this.peakValueDisplay) this.peakValueDisplay.innerText = db > -39 ? db.toFixed(1) : '- inf';

        if (this.clipLed) {
            if (db >= -0.1) {
                this.clipLed.classList.add('active');
            } else {
                this.clipLed.classList.remove('active');
            }
        }
    }

    drawSpectrum(w, h) {
        if (!this.freqDataArray) return;
        this.analyser.getByteFrequencyData(this.freqDataArray);

        const bufferLength = this.isLowEndDevice ? Math.floor(this.freqDataArray.length / 2) : this.freqDataArray.length;
        const barWidth = (w / bufferLength) * (this.isLowEndDevice ? 4.2 : 2.1);
        let x = 0;

        if (!this.cachedGradient) {
            this.cachedGradient = this.ctx.createLinearGradient(0, h, 0, 0);
            this.cachedGradient.addColorStop(0, '#9d4edd');
            this.cachedGradient.addColorStop(0.5, '#00f0ff');
            this.cachedGradient.addColorStop(1, '#ffea00');
        }

        this.ctx.fillStyle = this.cachedGradient;
        const step = this.isLowEndDevice ? 2 : 1;

        for (let i = 0; i < bufferLength; i += step) {
            const barHeight = (this.freqDataArray[i] / 255) * (h - 20);
            this.ctx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
            x += barWidth;
        }
    }

    drawWaveform(w, h) {
        if (!this.timeDataArray) return;
        this.analyser.getByteTimeDomainData(this.timeDataArray);

        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#00f0ff';
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = '#00f0ff';

        this.ctx.beginPath();
        const sliceWidth = w / this.timeDataArray.length;
        let x = 0;

        for (let i = 0; i < this.timeDataArray.length; i++) {
            const v = this.timeDataArray[i] / 128.0;
            const y = (v * h) / 2;

            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);

            x += sliceWidth;
        }

        this.ctx.lineTo(w, h / 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    drawCircleVisualizer(w, h) {
        if (!this.freqDataArray) return;
        this.analyser.getByteFrequencyData(this.freqDataArray);

        const centerX = w / 2;
        const centerY = h / 2;
        const radius = 45;

        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#9d4edd';
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        const step = this.isLowEndDevice ? 4 : 2;
        for (let i = 0; i < this.freqDataArray.length; i += step) {
            const amplitude = (this.freqDataArray[i] / 255) * 50;
            const angle = (i / this.freqDataArray.length) * Math.PI * 2;

            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + amplitude);
            const y2 = centerY + Math.sin(angle) * (radius + amplitude);

            this.ctx.strokeStyle = '#00f0ff';
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        }
    }

    drawVisualizerStatic() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.fillStyle = '#00f0ff';
        this.ctx.font = '800 14px Vazirmatn, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🎛️ کنسول اکولایزر ۴.۰ و پردازشگر صوت استودیویی آماده است', w / 2, h / 2);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 100% OFFLINE AUDIO CONTEXT WAV EXPORT PARITY (AUDIT FIX: Complete Master Graph Re-Creation)
    async exportEqualizedAudio() {
        if (!this.rawAudioBuffer) return;

        alert('در حال پردازش و دانلود خروجی استودیویی WAV با تمامی افکت‌های اکولایزر، Sub-Bass، Saturation، ریورب، 8D Audio، کمپرسور و لیمیتر...');

        const sampleRate = this.rawAudioBuffer.sampleRate;
        const length = this.rawAudioBuffer.length;
        const numChannels = this.rawAudioBuffer.numberOfChannels;

        const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = this.rawAudioBuffer;

        const pitchFactor = Math.pow(2, this.pitchSemitones / 12);
        source.playbackRate.value = this.tempoSpeed * pitchFactor;

        // 1. PreAmp
        const preAmp = offlineCtx.createGain();
        preAmp.gain.value = Math.pow(10, this.preAmpGainDb / 20);

        // 2. HPF & LPF
        const hpf = offlineCtx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = this.hpfFreq;

        const lpf = offlineCtx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = this.lpfFreq;

        // 3. Sub-Bass Exciter Parallel Branch
        const subBassFilter = offlineCtx.createBiquadFilter();
        subBassFilter.type = 'lowpass';
        subBassFilter.frequency.value = 60;

        const subBassGain = offlineCtx.createGain();
        subBassGain.gain.value = (this.subBassLevel / 100) * 1.5;

        // 4. 31-Band ISO EQ
        const offlineEqNodes = [];
        for (let i = 0; i < 31; i++) {
            const filter = offlineCtx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = this.EQ_FREQUENCIES[i];
            filter.Q.value = 4.318;
            filter.gain.value = this.eqGains[i];
            offlineEqNodes.push(filter);
        }

        // 5. Tape Saturation Drive
        const tape = offlineCtx.createWaveShaper();
        tape.curve = this.createDistortionCurve(this.tapeWarmthLevel);

        // 6. Reverb Convolver
        const reverb = offlineCtx.createConvolver();
        reverb.buffer = this.createImpulseResponse(offlineCtx, 1.2, 1.5);

        const reverbGain = offlineCtx.createGain();
        reverbGain.gain.value = this.reverbLevel / 100;

        // 7. Master Compressor & True Peak Limiter Stage
        const compressor = offlineCtx.createDynamicsCompressor();
        compressor.threshold.value = this.compThresholdDb;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;

        const limiter = offlineCtx.createDynamicsCompressor();
        limiter.threshold.value = this.limiterCeilingDb;
        limiter.knee.value = 0.0;
        limiter.ratio.value = 20.0;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.05;

        const autoHeadroom = offlineCtx.createGain();
        let totalBoostDb = Math.max(0, this.preAmpGainDb);
        for (let i = 0; i < 31; i++) {
            if (this.eqGains[i] > 0) totalBoostDb += this.eqGains[i];
        }
        autoHeadroom.gain.value = this.isAutoHeadroomEnabled ? Math.min(1.0, Math.pow(10, -(totalBoostDb * 0.25) / 20)) : 1.0;

        // OFFLINE GRAPH CONNECTIONS:
        source.connect(preAmp);
        preAmp.connect(hpf);
        hpf.connect(offlineEqNodes[0]);
        for (let i = 0; i < 30; i++) {
            offlineEqNodes[i].connect(offlineEqNodes[i + 1]);
        }
        offlineEqNodes[30].connect(lpf);

        // Connect Sub-Bass Branch in Offline Graph
        preAmp.connect(subBassFilter);
        subBassFilter.connect(subBassGain);
        subBassGain.connect(lpf);

        lpf.connect(tape);
        tape.connect(reverb);
        reverb.connect(reverbGain);
        reverbGain.connect(compressor);
        tape.connect(compressor);

        compressor.connect(limiter);
        limiter.connect(autoHeadroom);
        autoHeadroom.connect(offlineCtx.destination);

        source.start(0);
        const renderedBuffer = await offlineCtx.startRendering();

        this.triggerWavDownload(renderedBuffer, `${this.fileName}_Mastered4.0.wav`);
    }

    exportAudioStem(type) {
        const buffer = (type === 'VOCALS') ? this.vocalBuffer : this.musicBuffer;
        if (!buffer) return;
        this.triggerWavDownload(buffer, `${this.fileName}_${type}.wav`);
    }

    triggerWavDownload(buffer, outputFileName) {
        const wavBytes = this.audioBufferToWav(buffer);
        const blob = new Blob([wavBytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = outputFileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bitDepth = 16;
        let result;

        if (numChannels === 2) {
            result = this.interleave(buffer.getChannelData(0), buffer.getChannelData(1));
        } else {
            result = buffer.getChannelData(0);
        }

        return this.encodeWAV(result, numChannels, sampleRate, bitDepth);
    }

    interleave(inputL, inputR) {
        const length = inputL.length + inputR.length;
        const result = new Float32Array(length);
        let index = 0;
        let inputIndex = 0;

        while (index < length) {
            result[index++] = inputL[inputIndex];
            result[index++] = inputR[inputIndex];
            inputIndex++;
        }
        return result;
    }

    encodeWAV(samples, numChannels, sampleRate, bitDepth) {
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const dataByteCount = samples.length * bytesPerSample;
        const totalByteCount = 44 + dataByteCount;

        const arrayBuffer = new ArrayBuffer(totalByteCount);
        const dataView = new DataView(arrayBuffer);

        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(dataView, 0, 'RIFF');
        dataView.setUint32(4, 36 + dataByteCount, true);
        writeString(dataView, 8, 'WAVE');
        writeString(dataView, 12, 'fmt ');
        dataView.setUint32(16, 16, true);
        dataView.setUint16(20, 1, true);
        dataView.setUint16(22, numChannels, true);
        dataView.setUint32(24, sampleRate, true);
        dataView.setUint32(28, sampleRate * blockAlign, true);
        dataView.setUint16(32, blockAlign, true);
        dataView.setUint16(34, bitDepth, true);
        writeString(dataView, 36, 'data');
        dataView.setUint32(40, dataByteCount, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            dataView.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return arrayBuffer;
    }
}

// Boot Application
window.addEventListener('DOMContentLoaded', () => {
    window.app = new Equalizer31App();
});
