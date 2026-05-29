// 录音 + 静音检测(VAD) + WAV(16kHz 单声道) 编码。
// 用法：const rec = new Recorder({ onUtterance, getLetter });
//      await rec.start(); ... rec.stop();
// "说完一句"（语音后静音约 800ms）会触发 onUtterance(wavBase64)。
class Recorder {
  constructor({ onUtterance, getLetter, silenceMs = 800, minSpeechMs = 250, threshold = 0.012 }) {
    this.onUtterance = onUtterance;
    this.getLetter = getLetter || (() => null);
    this.silenceMs = silenceMs;
    this.minSpeechMs = minSpeechMs;
    this.threshold = threshold;
    this.sampleRate = 16000;
    this.frames = [];        // 当前句累计的 Float32 块
    this.speaking = false;
    this.lastVoiceTs = 0;
    this.speechStartTs = 0;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
    this.proc.onaudioprocess = (e) => this._onAudio(e.inputBuffer.getChannelData(0));
    this.source.connect(this.proc);
    this.proc.connect(this.ctx.destination);
  }

  stop() {
    if (this.proc) this.proc.disconnect();
    if (this.source) this.source.disconnect();
    if (this.ctx) this.ctx.close();
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.frames = [];
    this.speaking = false;
  }

  _rms(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  _onAudio(buf) {
    const now = performance.now();
    const loud = this._rms(buf) > this.threshold;
    if (loud) {
      if (!this.speaking) { this.speaking = true; this.speechStartTs = now; this.frames = []; }
      this.lastVoiceTs = now;
      this.frames.push(new Float32Array(buf));
    } else if (this.speaking) {
      this.frames.push(new Float32Array(buf)); // 收尾静音也留一点
      if (now - this.lastVoiceTs > this.silenceMs) this._flush(now);
    }
  }

  _flush(now) {
    const duration = this.lastVoiceTs - this.speechStartTs;
    const frames = this.frames;
    this.speaking = false;
    this.frames = [];
    if (duration < this.minSpeechMs || frames.length === 0) return;
    const wavB64 = this._encodeWav(frames);
    this.onUtterance(wavB64, this.getLetter());
  }

  _encodeWav(frames) {
    let total = 0;
    frames.forEach((f) => (total += f.length));
    const pcm = new Float32Array(total);
    let off = 0;
    frames.forEach((f) => { pcm.set(f, off); off += f.length; });

    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    const sr = this.sampleRate;
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);   // PCM
    view.setUint16(22, 1, true);   // mono
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, pcm.length * 2, true);
    let p = 44;
    for (let i = 0; i < pcm.length; i++) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      p += 2;
    }
    // ArrayBuffer -> base64
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
}
