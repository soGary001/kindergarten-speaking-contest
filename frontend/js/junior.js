const LETTERS = ["A", "C", "E", "F", "K", "S"];
const DURATION = 30;

const letterEl = document.getElementById("letter");
const promptEl = document.getElementById("prompt");
const timerEl = document.getElementById("timer");
const bubblesEl = document.getElementById("bubbles");

let currentLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
let remaining = DURATION;
let recorder = null;
let timerId = null;

function render() {
  letterEl.textContent = currentLetter;
  promptEl.textContent = `说出 ${currentLetter} 开头的单词 🎤`;
  timerEl.textContent = remaining;
}

function addWords(text, letter) {
  if (!text) return;
  text.split(/\s+/).filter(Boolean).forEach((w) => {
    const clean = w.replace(/[^a-zA-Z]/g, "");
    if (!clean) return;
    const ok = clean[0].toUpperCase() === letter.toUpperCase();
    const div = document.createElement("div");
    div.className = ok ? "bub ok" : "bub";
    div.innerHTML = ok ? `${clean}<span class="star">✓</span>` : clean;
    bubblesEl.appendChild(div);
  });
}

async function sendUtterance(wavB64, letter) {
  try {
    const resp = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: wavB64, letter }),
    });
    const data = await resp.json();
    addWords(data.text, letter);
  } catch (e) { /* 静默跳过，不阻塞倒计时 */ }
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

async function main() {
  render();
  recorder = new Recorder({
    onUtterance: sendUtterance,
    getLetter: () => currentLetter,
  });
  try {
    await recorder.start();
  } catch (e) {
    promptEl.textContent = "请允许使用麦克风后刷新页面 🎤";
    return;
  }
  timerId = setInterval(tick, 1000);
}

main();
