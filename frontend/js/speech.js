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
    this.recorder = new Recorder({
      onUtterance: (b64, letter) => this._transcribe(b64, letter),
      getLetter: this.getLetter,
    });
    await this.recorder.start(); // 麦克风被拒会在此 throw，由页面捕获提示
  }

  async _transcribe(b64, letter) {
    try {
      const resp = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64, letter }),
      });
      const data = await resp.json();
      if (data.text) this.onText(data.text, letter, true);
    } catch (_) { /* 静默跳过，不阻塞倒计时 */ }
  }

  stop() {
    if (this.recorder) { this.recorder.stop(); this.recorder = null; }
  }
}
