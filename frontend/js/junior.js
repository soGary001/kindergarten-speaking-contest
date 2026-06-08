const LETTERS = ["A", "C", "E", "F", "K", "S"];
const DURATION = 30;

const letterEl = document.getElementById("letter");
const promptEl = document.getElementById("prompt");
const timerEl = document.getElementById("timer");
const bubblesEl = document.getElementById("bubbles");

let currentLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
let remaining = DURATION;
let engine = null;
let timerId = null;
const allWords = [];
const okWords = [];

function render() {
  letterEl.textContent = currentLetter;
  promptEl.innerHTML = bi(`说出 ${currentLetter} 开头的单词 🎤`, `Say words starting with ${currentLetter}`);
  timerEl.textContent = remaining;
}

function makeBubble(clean, ok) {
  const div = document.createElement("div");
  div.className = ok ? "bub ok" : "bub";
  if (!ok) div.style.setProperty("--r", `${(Math.random() * 10 - 5).toFixed(1)}deg`);
  div.innerHTML = ok ? `${clean}<span class="star">✓</span>` : clean;
  return div;
}

function addWords(text, letter) {
  if (!text) return;
  text.split(/\s+/).filter(Boolean).forEach((w) => {
    const clean = w.replace(/[^a-zA-Z]/g, "");
    if (!clean) return;
    const ok = clean[0].toUpperCase() === letter.toUpperCase();
    allWords.push(clean);
    if (ok) okWords.push(clean);
    bubblesEl.appendChild(makeBubble(clean, ok));
  });
}


function tick() {
  remaining -= 1;
  timerEl.textContent = remaining;
  if (remaining <= 5) timerEl.classList.add("warn");
  if (remaining <= 0) finish();
}

function finish() {
  clearInterval(timerId);
  if (engine) engine.stop();
  showSummary();
}

function showSummary() {
  document.getElementById("play").classList.add("hidden");
  const body = document.getElementById("summary-body");
  const score = allWords.length * 0.1; // 小班：单词数量 × 0.1
  body.innerHTML =
    scoreBadge(score) +
    `你一共说了 <span class="summary-stat">${allWords.length}</span> 个单词，` +
    `其中 ⭐ <span class="summary-stat">${okWords.length}</span> 个是 “${currentLetter}” 开头！` +
    `<span class="en">You said ${allWords.length} words — ${okWords.length} start with “${currentLetter}”!</span>`;
  if (okWords.length) {
    const row = document.createElement("div");
    row.className = "summary-words";
    okWords.forEach((w) => row.appendChild(makeBubble(w, true)));
    body.appendChild(row);
  }
  const enc = playEncouragement(); // 随机播一句英文鼓励 + 显示
  const encEl = document.createElement("div");
  encEl.className = "encourage";
  encEl.textContent = "🌟 " + enc.text;
  body.appendChild(encEl);
  document.getElementById("summary").classList.remove("hidden");
  launchConfetti(110);
  // 兜底：40 秒无人操作自动回首页。
  setTimeout(() => { location.href = "/index.html"; }, 40000);
}

async function main() {
  render();
  engine = new SpeechEngine({
    onText: addWords,
    getLetter: () => currentLetter,
  });
  try {
    await engine.start();
  } catch (e) {
    promptEl.innerHTML = bi("请允许使用麦克风后刷新页面 🎤", "Please allow the microphone, then refresh");
    return;
  }
  playCheer(); // 字母已就绪，来点庆祝音效
  timerId = setInterval(tick, 1000);
}

main();
