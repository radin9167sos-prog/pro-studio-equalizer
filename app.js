/*
 * ===================================================================
 * AI VOCAL SEPARATOR — CLIENT-SIDE DSP & WEB AUDIO SEPARATION ENGINE
 * 100% Offline Audio Stem Demuxing, Waveform Visualization & WAV Export
 * ===================================================================
 */

class VocalSeparatorApp {
    constructor() {
        this.audioCtx = null;
        this.rawAudioBuffer = null;
        this.vocalBuffer = null;
        this.musicBuffer = null;

        this.vocalSource = null;
        this.musicSource = null;
        this.vocalGain = null;
        this.musicGain = null;
        this.analyser = null;

        this.isPlaying = false;
        this.startTime = 0;
        this.pauseOffset = 0;
        this.audioDuration = 0;
        this.fileName = 'Track';

        this.mode = 'MIX'; // MIX, VOCALS, MUSIC

        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        this.dropZone = document.getElementById('dropZone');
        this.audioInput = document.getElementById('audioInput');
        this.btnSelectFile = document.getElementById('btnSelectFile');
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

        this.sliderVocalVol = document.getElementById('sliderVocalVol');
        this.sliderMusicVol = document.getElementById('sliderMusicVol');
        this.valVocalVol = document.getElementById('valVocalVol');
        this.valMusicVol = document.getElementById('valMusicVol');

        this.sliderFormantFilter = document.getElementById('sliderFormantFilter');
        this.sliderBassBoost = document.getElementById('sliderBassBoost');
        this.valFormantFilter = document.getElementById('valFormantFilter');
        this.valBassBoost = document.getElementById('valBassBoost');

        this.btnExportVocals = document.getElementById('btnExportVocals');
        this.btnExportMusic = document.getElementById('btnExportMusic');
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

        // Player Buttons
        this.btnPlayPause.addEventListener('click', () => this.togglePlayPause());
        this.btnStop.addEventListener('click', () => this.stopPlayback());

        this.timelineSlider.addEventListener('input', (e) => {
            const seekPct = parseFloat(e.target.value) / 100;
            this.seekTo(seekPct * this.audioDuration);
        });

        // Mode Presets
        const presetBtns = document.querySelectorAll('.preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.getAttribute('data-mode');
                presetBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.setPresetMode(mode);
            });
        });

        // Volume Sliders
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

        // DSP Sliders
        this.sliderFormantFilter.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.valFormantFilter.innerText = val + ' Hz';
            this.reprocessStems();
        });

        this.sliderBassBoost.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.valBassBoost.innerText = '+' + val + ' dB';
            this.reprocessStems();
        });

        // Export Buttons
        this.btnExportVocals.addEventListener('click', () => this.exportAudio('VOCALS'));
        this.btnExportMusic.addEventListener('click', () => this.exportAudio('MUSIC'));
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

    // Read and Decode File
    async handleFile(file) {
        if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) {
            alert('لطفاً یک فایل صوتی معتبر (MP3, WAV, OGG, FLAC) انتخاب کنید.');
            return;
        }

        this.initAudioContext();
        this.stopPlayback();

        this.fileName = file.name.replace(/\.[^/.]+$/, "");
        this.trackName.innerText = file.name;
        this.trackDetails.innerText = 'در حال خواندن و تحلیل فرکانسی فایل صوتی...';

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

            // Perform Audio Separation
            this.reprocessStems();
            this.drawVisualizerStatic();

        } catch (err) {
            alert('خطا در بارگذاری و دکود فایل صوتی: ' + err.message);
            this.dropZone.classList.remove('hidden');
            this.audioInfoCard.classList.add('hidden');
        }
    }

    // DSP Stem Separation Engine (Mid/Side Phase Subtraction & Formant Filtering)
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

        const formantFreq = parseInt(this.sliderFormantFilter.value) || 1800;
        const bassGain = (parseInt(this.sliderBassBoost.value) || 4) / 10;

        // Simple IIR High-Pass & Low-Pass Coefficients for Human Vocal Formants (300Hz - 3400Hz)
        const alphaHP = 0.85; 
        const alphaLP = 0.35; 

        let lastOutHP_L = 0, lastInL = 0;
        let lastOutHP_R = 0, lastInR = 0;
        let lastOutLP_L = 0, lastOutLP_R = 0;

        for (let i = 0; i < length; i++) {
            const l = leftRaw[i];
            const r = rightRaw[i];

            // Mid/Side Decomposition
            // Mid = (Left + Right) / 2 -> Contains center vocals and main leads
            // Side = (Left - Right) / 2 -> Contains panned instruments, stereo reverb, bass & guitars
            const mid = (l + r) * 0.5;
            const side = (l - r) * 0.5;

            // Formant Bandpass Filtering on Mid Channel for Vocals
            lastOutHP_L = alphaHP * (lastOutHP_L + mid - lastInL);
            lastInL = mid;
            lastOutLP_L = lastOutLP_L + alphaLP * (lastOutHP_L - lastOutLP_L);
            const vocalSample = lastOutLP_L * 1.6;

            // Vocal Buffer Assignment
            vLeft[i] = vocalSample;
            vRight[i] = vocalSample;

            // Music Buffer Assignment: Side Channel + Sub-Bass Preservation
            const bassPreservation = (mid - vocalSample) * (1.0 + bassGain);
            const musicSampleL = side + bassPreservation;
            const musicSampleR = -side + bassPreservation;

            mLeft[i] = Math.max(-1.0, Math.min(1.0, musicSampleL));
            mRight[i] = Math.max(-1.0, Math.min(1.0, musicSampleR));
        }

        if (this.isPlaying) {
            const currentPos = this.getCurrentPlaybackTime();
            this.seekTo(currentPos);
        }
    }

    // Preset Modes
    setPresetMode(mode) {
        this.mode = mode;
        if (mode === 'MIX') {
            this.sliderVocalVol.value = 100;
            this.sliderMusicVol.value = 100;
        } else if (mode === 'VOCALS') {
            this.sliderVocalVol.value = 120;
            this.sliderMusicVol.value = 0;
        } else if (mode === 'MUSIC') {
            this.sliderVocalVol.value = 0;
            this.sliderMusicVol.value = 110;
        }

        this.valVocalVol.innerText = this.sliderVocalVol.value + '%';
        this.valMusicVol.innerText = this.sliderMusicVol.value + '%';

        if (this.vocalGain) this.vocalGain.gain.value = this.sliderVocalVol.value / 100;
        if (this.musicGain) this.musicGain.gain.value = this.sliderMusicVol.value / 100;
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

        this.vocalSource = this.audioCtx.createBufferSource();
        this.musicSource = this.audioCtx.createBufferSource();

        this.vocalSource.buffer = this.vocalBuffer;
        this.musicSource.buffer = this.musicBuffer;

        this.vocalGain = this.audioCtx.createGain();
        this.musicGain = this.audioCtx.createGain();

        this.vocalGain.gain.value = parseInt(this.sliderVocalVol.value) / 100;
        this.musicGain.gain.value = parseInt(this.sliderMusicVol.value) / 100;

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 128;

        this.vocalSource.connect(this.vocalGain);
        this.musicSource.connect(this.musicGain);

        this.vocalGain.connect(this.analyser);
        this.musicGain.connect(this.analyser);

        this.analyser.connect(this.audioCtx.destination);

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
        this.btnPlayPause.innerText = '▶️ پخش';
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

    // Dynamic Spectrum & Waveform Visualizer
    renderVisualizer() {
        if (!this.isPlaying) return;

        const currentPos = this.getCurrentPlaybackTime();
        this.timeCurrent.innerText = this.formatTime(currentPos);
        this.timelineSlider.value = (currentPos / this.audioDuration) * 100;

        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        // Draw Spectrum Bars
        if (this.analyser) {
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);

            const barWidth = (w / bufferLength) * 2.2;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * (h - 20);

                const grad = this.ctx.createLinearGradient(0, h, 0, 0);
                grad.addColorStop(0, '#9d4edd');
                grad.addColorStop(1, '#00f0ff');

                this.ctx.fillStyle = grad;
                this.ctx.fillRect(x, h - barHeight, barWidth - 2, barHeight);

                x += barWidth;
            }
        }

        requestAnimationFrame(() => this.renderVisualizer());
    }

    drawVisualizerStatic() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.fillStyle = '#00f0ff';
        this.ctx.font = '14px Vazirmatn, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('آماده پخش و تجزیه فرکانسی', w / 2, h / 2);
    }

    // Format Seconds to MM:SS
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Client-Side WAV Audio Exporter (Generates downloadable .WAV audio blob)
    exportAudio(type) {
        const buffer = (type === 'VOCALS') ? this.vocalBuffer : this.musicBuffer;
        if (!buffer) {
            alert('هیچ دیتای صوتی پردازش‌شده‌ای برای خروجی وجود ندارد.');
            return;
        }

        const wavBytes = this.audioBufferToWav(buffer);
        const blob = new Blob([wavBytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${this.fileName}_${type}.wav`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // Fast PCM WAV Encoder
    audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
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
        const headerByteCount = 44;
        const totalByteCount = headerByteCount + dataByteCount;

        const arrayBuffer = new ArrayBuffer(totalByteCount);
        const dataView = new DataView(arrayBuffer);

        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        /* RIFF identifier */
        writeString(dataView, 0, 'RIFF');
        /* RIFF chunk length */
        dataView.setUint32(4, 36 + dataByteCount, true);
        /* RIFF type */
        writeString(dataView, 8, 'WAVE');
        /* format chunk identifier */
        writeString(dataView, 12, 'fmt ');
        /* format chunk length */
        dataView.setUint32(16, 16, true);
        /* sample format (raw) */
        dataView.setUint16(20, 1, true);
        /* channel count */
        dataView.setUint16(22, numChannels, true);
        /* sample rate */
        dataView.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        dataView.setUint32(28, sampleRate * blockAlign, true);
        /* block align */
        dataView.setUint16(32, blockAlign, true);
        /* bits per sample */
        dataView.setUint16(34, bitDepth, true);
        /* data chunk identifier */
        writeString(dataView, 36, 'data');
        /* data chunk length */
        dataView.setUint32(40, dataByteCount, true);

        // Write Float PCM samples converted to 16-bit Int
        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            dataView.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return arrayBuffer;
    }
}

// Initialize Application on Load
window.addEventListener('DOMContentLoaded', () => {
    window.app = new VocalSeparatorApp();
});
