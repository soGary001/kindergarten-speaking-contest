// 语音识别引擎：录音(带静音检测 VAD) → 后端 /api/transcribe（阿里云 qwen3-asr-flash）→ 文字。
// “说完一句出一句”：停顿约 0.7 秒即把该段音频上传识别，国内可用、约 0.5 秒出字、对幼儿单词也准。
// 用法：const e = new SpeechEngine({ onText, getLetter }); await e.start();
//   onText(text, letter, isFinal=true) —— 识别结果落地
class SpeechEngine {
  constructor({ onText, getLetter }) {
    this.onText = onText;
    this.getLetter = getLetter || (() => null);
    this.recorder = null;
  }

  async start() {
    // 手动模式：点击开始录音、再次点击结束并识别整段（避免停顿截断）。
    this.recorder = new Recorder({ manual: true, getLetter: this.getLetter });
    await this.recorder.start(); // 麦克风被拒会在此 throw，由页面捕获提示
  }

  beginRecording() {
    if (this.recorder) this.recorder.beginRecording();
  }

  // 结束录音并识别整段；有结果则回调 onText。
  async stopAndTranscribe() {
    if (!this.recorder) return;
    const b64 = this.recorder.endRecording();
    if (b64) await this._transcribe(b64, this.getLetter());
  }

  async _transcribe(b64, letter) {
    try {
      const text = await transcribeAudio(b64, letter); // asr.js：Android 直连阿里云 / 桌面走后端
      if (text) this.onText(text, letter, true);
    } catch (_) { /* 静默跳过，不阻塞倒计时 */ }
  }

  stop() {
    if (this.recorder) { this.recorder.stop(); this.recorder = null; }
  }
}
