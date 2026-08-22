/*
 * ===================================================================
 * PRO STUDIO EQUALIZER 31-BAND — WEB AUDIO DSP ENGINE & PROCESSOR
 * 31 ISO Frequencies, Pitch Shift, Tempo Speed, Sub-Bass Exciter & Live Mic
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

        this.preAmpNode = null;
        this.subBassFilterNode = null;
        this.subBassGainNode = null;
        this.eqNodes = [];
        this.vocalGain = null;
        this.musicGain = null;
        this.analyser = null;

        this.isPlaying = false;
        this.isMicActive = false;
        this.startTime = 0;
        this.pauseOffset = 0;
        this.audioDuration = 0;
        this.fileName = 'Track';

        // 31 Standard ISO 1/3 Octave Equalizer Frequencies (Hz)
        this.EQ_FREQUENCIES = [
            20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
            630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
            10000, 12500, 16000, 20000
        ];
        this.eqGains = new Array(31).fill(0); // Default flat gains (dB)
        this.preAmpGainDb = 0;
        this.tempoSpeed = 1.0;
        this.pitchSemitones = 0;
        this.subBassLevel = 100;

        // Equalizer 31-Band Presets
        this.EQ_PRESETS = {
            FLAT:        new Array(31).fill(0),
            BASS_BOOST:  [12, 11, 10, 9, 8, 7, 6, 4, 3, 2, 1, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8],
            VOCAL_BOOST: [-4, -4, -3, -3, -2, -2, -1, 0, 1, 2, 3, 4, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            POP_DANCE:   [6, 6, 7, 7, 5, 4, 3, 1, 0, -1, -1, 0, 1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 7, 7, 6, 6, 5, 5],
            ROCK:        [8, 8, 7, 6, 5, 4, 2, 1, 0, -1, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 7, 8, 8, 9, 9, 9, 8, 8, 7, 7, 6],
            HIFI:        [4, 4, 3, 3, 2, 2, 1, 0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11, 12, 12, 11, 10, 9, 8, 7]
        };

        this.visMode = 'SPECTRUM'; // SPECTRUM, WAVEFORM, CIRCLE

        this.initDOM();
        this.render31Faders();
        this.bindEvents();
    }

    initDOM() {
        this.dropZone = document.getElementById('dropZone');
        this.audioInput = document.getElementById('audioInput');
        this.btnSelectFile = document.getElementById('btnSelectFile');
        this.btnLiveMicStart = document.getElementById('btnLiveMicStart');
        this.audioInfoCard = document.getElementById('audioInfoCard');

        this.trackName = document.getElementById('trackName');
        this.trackDetails = document.getElementById('trackDetails');
        this.btnChangeFile = document.getElementById('btnChangeFile');

        this.canvas = document.getElementById('spectrumCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.timeCurrent = document.getElementById('timeCurrent');
        this.timeTotal = document.getElementById('timeTotal');
        this.timelineSlider = document.getElementById('timelineSlider');

        this.btnPlayPause = document.getElementById('btnPlayPause');
        this.btnStop = document.getElementById('btnStop');
        this.btnToggleMic = document.getElementById('btnToggleMic');
        this.btnResetEQ = document.getElementById('btnResetEQ');

        this.sliderTempoSpeed = document.getElementById('sliderTempoSpeed');
        this.valTempoSpeed = document.getElementById('valTempoSpeed');
        this.sliderPitchShift = document.getElementById('sliderPitchShift');
        this.valPitchShift = document.getElementById('valPitchShift');
        this.sliderSubBass = document.getElementById('sliderSubBass');
        this.valSubBass = document.getElementById('valSubBass');

        this.sliderPreAmp = document.getElementById('sliderPreAmp');
        this.valPreAmp = document.getElementById('valPreAmp');
        this.sliderVocalVol = document.getElementById('sliderVocalVol');
        this.sliderMusicVol = document.getElementById('sliderMusicVol');
        this.valVocalVol = document.getElementById('valVocalVol');
        this.valMusicVol = document.getElementById('valMusicVol');

        this.btnExportEQ = document.getElementById('btnExportEQ');
        this.btnExportVocals = document.getElementById('btnExportVocals');
        this.btnExportMusic = document.getElementById('btnExportMusic');
    }

    // Render 31 Faders Consoles Dynamically
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
        // Drag and Drop
        this.dropZone.addEventListener('click', () => this.audioInput.click());
        this.btnSelectFile.addEventListener('click', (e) => {
            e.stopPropagation();
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

        // Live Mic Buttons
        this.btnLiveMicStart.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startLiveMic();
        });
        this.btnToggleMic.addEventListener('click', () => this.toggleLiveMic());

        // Player Controls
        this.btnPlayPause.addEventListener('click', () => this.togglePlayPause());
        this.btnStop.addEventListener('click', () => this.stopPlayback());

        this.timelineSlider.addEventListener('input', (e) => {
            const seekPct = parseFloat(e.target.value) / 100;
            this.seekTo(seekPct * this.audioDuration);
        });

        // 31 Faders Input Event Binding
        for (let i = 0; i < 31; i++) {
            const fader = document.getElementById(`eq-band-${i}`);
            if (fader) {
                fader.addEventListener('input', (e) => {
                    const gainDb = parseFloat(e.target.value);
                    this.setEQBandGain(i, gainDb);
                });
            }
        }

        // Reset EQ Button
        this.btnResetEQ.addEventListener('click', () => this.applyEQPreset('FLAT'));

        // EQ Preset Buttons
        const presetBtns = document.querySelectorAll('.eq-preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const presetKey = e.currentTarget.getAttribute('data-eq-preset');
                presetBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.applyEQPreset(presetKey);
            });
        });

        // Visualizer Mode Selector Buttons
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

        // Tempo Speed & Pitch Shift Sliders
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

        // Sub-Bass Exciter
        this.sliderSubBass.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.subBassLevel = val;
            this.valSubBass.innerText = val + '%';
            if (this.subBassGainNode) {
                this.subBassGainNode.gain.value = (val / 100) * 1.5;
            }
        });

        // Pre-Amp & Mix Sliders
        this.sliderPreAmp.addEventListener('input', (e) => {
            const valDb = parseFloat(e.target.value);
            this.preAmpGainDb = valDb;
            this.valPreAmp.innerText = (valDb > 0 ? '+' : '') + valDb + ' dB';
            if (this.preAmpNode) {
                this.preAmpNode.gain.value = Math.pow(10, valDb / 20);
            }
        });

        this.sliderVocalVol.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.valVocalVol.innerText = val + '%';
            if (this.vocalGain) this.vocalGain.gain.value = val / 100;
        });

        this.sliderMusicVol.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.valMusicVol.innerText = val + '%';
            if (this.musicGain) this.musicGain.gain.value = val / 100;
        });

        // Export Buttons
        this.btnExportEQ.addEventListener('click', () => this.exportEqualizedAudio());
        this.btnExportVocals.addEventListener('click', () => this.exportAudioStem('VOCALS'));
        this.btnExportMusic.addEventListener('click', () => this.exportAudioStem('MUSIC'));
    }

    // Initialize Web Audio Context
    initAudioContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // Live Microphone Input Processing
    async startLiveMic() {
        this.initAudioContext();
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

            this.setupAudioGraph();
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

    // Read and Decode Audio File
    async handleFile(file) {
        this.initAudioContext();
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
            alert('خطا در دکود موزیک: ' + err.message);
            this.dropZone.classList.remove('hidden');
            this.audioInfoCard.classList.add('hidden');
        }
    }

    // DSP Stem Separation (Mid/Side Extraction)
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

    // Set Gain for Specific EQ Band
    setEQBandGain(bandIndex, gainDb) {
        this.eqGains[bandIndex] = gainDb;
        const valEl = document.getElementById(`eq-val-${bandIndex}`);
        if (valEl) {
            valEl.innerText = (gainDb > 0 ? '+' : '') + gainDb + ' dB';
        }

        if (this.eqNodes[bandIndex]) {
            this.eqNodes[bandIndex].gain.value = gainDb;
        }
    }

    // Apply Preset EQ Array
    applyEQPreset(presetKey) {
        const gains = this.EQ_PRESETS[presetKey] || this.EQ_PRESETS.FLAT;
        for (let i = 0; i < 31; i++) {
            const gainDb = gains[i];
            this.eqGains[i] = gainDb;

            const fader = document.getElementById(`eq-band-${i}`);
            if (fader) fader.value = gainDb;

            const valEl = document.getElementById(`eq-val-${i}`);
            if (valEl) valEl.innerText = (gainDb > 0 ? '+' : '') + gainDb + ' dB';

            if (this.eqNodes[i]) {
                this.eqNodes[i].gain.value = gainDb;
            }
        }
    }

    // Update Playback Rates for Pitch & Tempo Speed
    updatePlaybackRates() {
        const pitchFactor = Math.pow(2, this.pitchSemitones / 12);
        const combinedRate = this.tempoSpeed * pitchFactor;

        if (this.vocalSource) this.vocalSource.playbackRate.value = combinedRate;
        if (this.musicSource) this.musicSource.playbackRate.value = combinedRate;
    }

    // Setup Master Audio Graph
    setupAudioGraph() {
        // Pre-Amp Node
        this.preAmpNode = this.audioCtx.createGain();
        this.preAmpNode.gain.value = Math.pow(10, this.preAmpGainDb / 20);

        // Sub-Bass Exciter Node
        this.subBassFilterNode = this.audioCtx.createBiquadFilter();
        this.subBassFilterNode.type = 'lowpass';
        this.subBassFilterNode.frequency.value = 60;

        this.subBassGainNode = this.audioCtx.createGain();
        this.subBassGainNode.gain.value = (this.subBassLevel / 100) * 1.5;

        this.preAmpNode.connect(this.subBassFilterNode);
        this.subBassFilterNode.connect(this.subBassGainNode);

        // Build 31-Band BiquadFilter Chain
        this.eqNodes = [];
        for (let i = 0; i < 31; i++) {
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = this.EQ_FREQUENCIES[i];
            filter.Q.value = 4.3; // 1/3 Octave bandwidth
            filter.gain.value = this.eqGains[i];
            this.eqNodes.push(filter);
        }

        // Chain 31 Filters: PreAmp -> EQ[0] -> ... -> EQ[30]
        this.preAmpNode.connect(this.eqNodes[0]);
        for (let i = 0; i < 30; i++) {
            this.eqNodes[i].connect(this.eqNodes[i + 1]);
        }

        // Connect SubBass in parallel
        this.subBassGainNode.connect(this.eqNodes[0]);

        // Analyser Node
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 512;

        const lastEqNode = this.eqNodes[30];
        lastEqNode.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
    }

    // Playback Engine
    togglePlayPause() {
        if (!this.rawAudioBuffer) return;
        if (this.isPlaying) {
            this.pausePlayback();
        } else {
            this.startPlayback(this.pauseOffset);
        }
    }

    startPlayback(offset = 0) {
        this.initAudioContext();
        if (this.isPlaying) this.stopPlaybackNodes();

        this.setupAudioGraph();

        this.vocalSource = this.audioCtx.createBufferSource();
        this.musicSource = this.audioCtx.createBufferSource();

        this.vocalSource.buffer = this.vocalBuffer;
        this.musicSource.buffer = this.musicBuffer;

        this.updatePlaybackRates();

        this.vocalGain = this.audioCtx.createGain();
        this.musicGain = this.audioCtx.createGain();

        this.vocalGain.gain.value = parseInt(this.sliderVocalVol.value) / 100;
        this.musicGain.gain.value = parseInt(this.sliderMusicVol.value) / 100;

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
        this.isPlaying = false;
        this.btnPlayPause.innerText = '▶️ ادامه پخش';
    }

    stopPlayback() {
        this.stopPlaybackNodes();
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

    // Dynamic Spectrum Visualizer
    renderVisualizer() {
        if (!this.isPlaying) return;

        const currentPos = this.getCurrentPlaybackTime();
        this.timeCurrent.innerText = this.formatTime(currentPos);
        this.timelineSlider.value = (currentPos / this.audioDuration) * 100;

        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (this.analyser) {
            if (this.visMode === 'SPECTRUM') {
                this.drawSpectrum(w, h);
            } else if (this.visMode === 'WAVEFORM') {
                this.drawWaveform(w, h);
            } else if (this.visMode === 'CIRCLE') {
                this.drawCircleVisualizer(w, h);
            }
        }

        requestAnimationFrame(() => this.renderVisualizer());
    }

    // 31-Band High-Resolution Spectrum
    drawSpectrum(w, h) {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        const barWidth = (w / bufferLength) * 2.1;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * (h - 20);

            const grad = this.ctx.createLinearGradient(0, h, 0, 0);
            grad.addColorStop(0, '#9d4edd');
            grad.addColorStop(0.5, '#00f0ff');
            grad.addColorStop(1, '#ffea00');

            this.ctx.fillStyle = grad;
            this.ctx.fillRect(x, h - barHeight, barWidth - 1, barHeight);

            x += barWidth;
        }
    }

    drawWaveform(w, h) {
        const bufferLength = this.analyser.fftSize;
        const timeData = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(timeData);

        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#00f0ff';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#00f0ff';

        this.ctx.beginPath();
        const sliceWidth = w / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = timeData[i] / 128.0;
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
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        const centerX = w / 2;
        const centerY = h / 2;
        const radius = 45;

        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#9d4edd';
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        for (let i = 0; i < bufferLength; i += 2) {
            const amplitude = (dataArray[i] / 255) * 50;
            const angle = (i / bufferLength) * Math.PI * 2;

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
        this.ctx.fillText('🎛️ اکولایزر ۳۱ بانده استودیویی آماده پردازش فرکانسی', w / 2, h / 2);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Offline Audio Rendering for 31-Band Equalized WAV Export
    async exportEqualizedAudio() {
        if (!this.rawAudioBuffer) return;

        alert('در حال پردازش و اعمال اکولایزر ۳۱ بانده استودیویی رو فایل موزیک...');

        const sampleRate = this.rawAudioBuffer.sampleRate;
        const length = this.rawAudioBuffer.length;
        const numChannels = this.rawAudioBuffer.numberOfChannels;

        const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = this.rawAudioBuffer;

        const pitchFactor = Math.pow(2, this.pitchSemitones / 12);
        source.playbackRate.value = this.tempoSpeed * pitchFactor;

        const preAmp = offlineCtx.createGain();
        preAmp.gain.value = Math.pow(10, this.preAmpGainDb / 20);

        const offlineEqNodes = [];
        for (let i = 0; i < 31; i++) {
            const filter = offlineCtx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = this.EQ_FREQUENCIES[i];
            filter.Q.value = 4.3;
            filter.gain.value = this.eqGains[i];
            offlineEqNodes.push(filter);
        }

        source.connect(preAmp);
        preAmp.connect(offlineEqNodes[0]);
        for (let i = 0; i < 30; i++) {
            offlineEqNodes[i].connect(offlineEqNodes[i + 1]);
        }
        offlineEqNodes[30].connect(offlineCtx.destination);

        source.start(0);
        const renderedBuffer = await offlineCtx.startRendering();

        this.triggerWavDownload(renderedBuffer, `${this.fileName}_Equalized31Band.wav`);
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
