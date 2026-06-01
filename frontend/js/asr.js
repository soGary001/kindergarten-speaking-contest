// 识别策略层：
//  - Android(APK)：window.ALIYUN_ASR_KEY 存在 → 直连阿里云（CapacitorHttp 走原生、绕过 CORS）。
//  - 桌面/网页：走后端 /api/transcribe 代理（Key 藏在后端）。
async function transcribeAudio(b64, letter) {
  if (window.ALIYUN_ASR_KEY) {
    return aliyunDirect(b64);
  }
  const resp = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio: b64, letter }),
  });
  const data = await resp.json();
  return data.text || "";
}

async function aliyunDirect(b64) {
  const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + window.ALIYUN_ASR_KEY,
    },
    body: JSON.stringify({
      model: "qwen3-asr-flash",
      messages: [{
        role: "user",
        content: [{ type: "input_audio", input_audio: { data: "data:audio/wav;base64," + b64 } }],
      }],
    }),
  });
  const data = await resp.json();
  let c = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  if (Array.isArray(c)) c = c.map((p) => (p && p.text) || "").join(" ");
  return String(c).trim().toLowerCase();
}
