// 撒花 + 背景漂浮装饰，给孩子更多“多巴胺”视觉反馈。
const CELEBRATE_COLORS = ["#ff8fab", "#ffd23f", "#06d6a0", "#118ab2", "#ef476f", "#c9b8f0"];

// 中英双语：中文为主，英文小一号在下方。
function bi(cn, en) {
  return cn + '<span class="en">' + en + "</span>";
}

// 可爱的金色奖牌分数徽章（保留一位小数）。
function scoreBadge(value) {
  const v = (Math.round(value * 10) / 10).toFixed(1);
  return '<div class="score-badge"><div class="score-trophy">🏆</div>' +
    '<div class="score-num">' + v + '</div>' +
    '<div class="score-label">得分 Score</div></div>';
}

// 共享 AudioContext；浏览器自动播放限制下，首次手势/麦克风授权后解锁。
let _actx = null;
function unlockAudio() {
  try {
    if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
    if (_actx.state === "suspended") _actx.resume();
  } catch (_) { /* 忽略 */ }
  return _actx;
}
["pointerdown", "keydown", "touchstart"].forEach((ev) =>
  document.addEventListener(ev, unlockAudio, { once: true, passive: true }));

// 选中/抽中字母时的欢快音效（合成上行琶音 + 收尾，无需音频文件，四端离线可用）。
function playCheer() {
  const ctx = unlockAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { // C5 E5 G5 C6
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    const t = t0 + i * 0.09;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.3);
  });
}

// 预生成的英文鼓励语（qwen-tts 配音 + 文字），总结时随机播一句。
const ENCOURAGEMENTS = [
  { audio: "/audio/enc1.m4a", text: "Great job! Keep going!" },
  { audio: "/audio/enc2.m4a", text: "Amazing! You are a speaking star!" },
  { audio: "/audio/enc3.m4a", text: "Well done! Even better next time!" },
  { audio: "/audio/enc4.m4a", text: "Awesome! A big thumbs up for you!" },
  { audio: "/audio/enc5.m4a", text: "Excellent! We are so proud of you!" },
  { audio: "/audio/enc6.m4a", text: "Fantastic! Your English is getting better!" },
];
function playEncouragement() {
  const e = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
  try { new Audio(e.audio).play().catch(() => {}); } catch (_) { /* 忽略 */ }
  return e;
}

// 满屏撒花。n = 纸屑数量。
function launchConfetti(n = 90) {
  for (let i = 0; i < n; i++) {
    const c = document.createElement("div");
    c.className = "confetti-bit";
    c.style.left = (Math.random() * 100) + "vw";
    c.style.background = CELEBRATE_COLORS[i % CELEBRATE_COLORS.length];
    c.style.width = (8 + Math.random() * 12) + "px";
    c.style.height = (12 + Math.random() * 16) + "px";
    if (Math.random() < 0.4) c.style.borderRadius = "50%";
    c.style.animationDelay = (Math.random() * 0.9) + "s";
    c.style.animationDuration = (1.8 + Math.random() * 1.8) + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}

// 在背景撒一层缓慢漂浮的几何装饰。
function scatterShapes(n = 10) {
  const layer = document.createElement("div");
  layer.className = "decor-layer";
  for (let i = 0; i < n; i++) {
    const s = document.createElement("div");
    const color = CELEBRATE_COLORS[i % CELEBRATE_COLORS.length];
    const size = 28 + Math.random() * 78;
    const kind = Math.random();
    if (kind < 0.55) {
      s.className = "decor decor-circle";
      s.style.background = color;
    } else {
      s.className = "decor decor-ring";
      s.style.borderColor = color;
    }
    s.style.width = size + "px";
    s.style.height = size + "px";
    s.style.left = (Math.random() * 94) + "vw";
    s.style.top = (Math.random() * 90) + "vh";
    s.style.animationDelay = (-Math.random() * 6) + "s";
    s.style.animationDuration = (5 + Math.random() * 5) + "s";
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
}

// 页面加载即铺背景装饰。
scatterShapes();
