// 识别策略层：
//  - Android(APK)：window.ALIYUN_ASR_KEY 存在 → 直连阿里云（CapacitorHttp 走原生、绕过 CORS）。
//  - 桌面/网页：走后端 /api/transcribe 代理（Key 藏在后端）。
async function transcribeAudio(b64, letter) {
  let text;
  if (window.ALIYUN_ASR_KEY) {
    text = await aliyunDirect(b64);
  } else {
    const resp = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: b64, letter }),
    });
    const data = await resp.json();
    text = data.text || "";
  }
  return maybeSegment(text); // 黏连长串 → 用 LLM 切分成单词
}

// 若识别结果里出现“无空格长串”(疑似多个单词黏在一起)，调切分服务拆开；正常带空格的结果不触发。
async function maybeSegment(text) {
  if (!text) return text;
  const glued = text.split(/\s+/).some((t) => t.replace(/[^a-zA-Z]/g, "").length >= 12);
  if (!glued) return text;
  try {
    const split = await segmentWords(text);
    return split || text;
  } catch (_) {
    return text;
  }
}

async function segmentWords(text) {
  if (window.ALIYUN_ASR_KEY) return aliyunSegment(text);
  const resp = await fetch("/api/segment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await resp.json();
  return data.text || "";
}

async function aliyunSegment(text) {
  const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + window.ALIYUN_ASR_KEY,
    },
    body: JSON.stringify({
      model: "qwen-flash",
      messages: [
        { role: "system", content: "You split run-together English into separate words. Output ONLY the words in lowercase separated by single spaces, nothing else." },
        { role: "user", content: text },
      ],
      temperature: 0,
    }),
  });
  const data = await resp.json();
  let c = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  return String(c).trim().toLowerCase();
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
