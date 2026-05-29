const LETTERS = ["S", "D", "T", "F", "B", "G"];
const COLORS = ["var(--pink)", "var(--yellow)", "var(--green)", "var(--blue)", "var(--rose)", "var(--purple)"];
const DURATION = 60;

const pickEl = document.getElementById("pick");
const gridEl = document.getElementById("grid");
const playEl = document.getElementById("play");
const letterEl = document.getElementById("letter");
const promptEl = document.getElementById("prompt");
const timerEl = document.getElementById("timer");
const wordEl = document.getElementById("word");
const sentenceEl = document.getElementById("sentence");

let currentLetter = null;
let remaining = DURATION;
let recorder = null;
let timerId = null;
let wordShown = false;

// 渲染选字母网格
LETTERS.forEach((l, i) => {
  const b = document.createElement("button");
  b.className = "letter-bubble";
  b.textContent = l;
  b.style.background = COLORS[i % COLORS.length];
  b.style.animationDelay = `${i * 0.15}s`;
  b.onclick = () => startPlay(l);
  gridEl.appendChild(b);
});

function showWord(clean) {
  const ok = clean[0].toUpperCase() === currentLetter.toUpperCase();
  wordEl.innerHTML = "";
  const div = document.createElement("div");
  div.className = ok ? "bub ok" : "bub";
  div.style.fontSize = "48px";
  div.innerHTML = ok ? `${clean}<span class="star">✓</span>` : clean;
  wordEl.appendChild(div);
}

function showSentence(text, clean) {
  const re = new RegExp(`\\b(${clean})\\b`, "i");
  sentenceEl.innerHTML = text.replace(re, "<b>$1</b>");
}

function handleText(text) {
  if (!text) return;
  const words = text.split(/\s+/).map((w) => w.replace(/[^a-zA-Z]/g, "")).filter(Boolean);
  if (words.length === 0) return;
  if (!wordShown) {
    showWord(words[0]);
    wordShown = true;
    if (words.length > 1) showSentence(text, words[0]); // 同一句里既有单词又有句子
  } else {
    showSentence(text, wordEl.textContent.replace("✓", "").trim());
  }
}

async function sendUtterance(wavB64, letter) {
  try {
    const resp = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: wavB64, letter }),
    });
    const data = await resp.json();
    handleText(data.text);
  } catch (e) { /* 静默跳过 */ }
}

function tick() {
  remaining -= 1;
  timerEl.textContent = remaining;
  if (remaining <= 5) timerEl.classList.add("warn");
  if (remaining <= 0) finish();
}

function finish() {
  clearInterval(timerId);
  if (recorder) recorder.stop();
  location.href = "/index.html";
}

async function startPlay(letter) {
  currentLetter = letter;
  pickEl.classList.add("hidden");
  playEl.classList.remove("hidden");
  letterEl.textContent = letter;
  promptEl.textContent = `说一个 ${letter} 开头的单词，再用它说一句话 🎤`;
  timerEl.textContent = remaining;

  recorder = new Recorder({ onUtterance: sendUtterance, getLetter: () => currentLetter });
  try {
    await recorder.start();
  } catch (e) {
    promptEl.textContent = "请允许使用麦克风后刷新页面 🎤";
    return;
  }
  timerId = setInterval(tick, 1000);
}
