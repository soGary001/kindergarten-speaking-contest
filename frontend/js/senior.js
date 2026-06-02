const LETTERS = ["S", "D", "T", "F", "B", "G"];
const DURATION = 60;
const DRAW_SECONDS = 5;

const pickEl = document.getElementById("pick");
const drawLetterEl = document.getElementById("draw-letter");
const drawCountEl = document.getElementById("draw-count");
const playEl = document.getElementById("play");
const letterEl = document.getElementById("letter");
const promptEl = document.getElementById("prompt");
const timerEl = document.getElementById("timer");
const entriesEl = document.getElementById("entries");

let currentLetter = null;
let remaining = DURATION;
let engine = null;
let timerId = null;
const entries = [];   // [{ word, ok, sentenceRaw, sentence, el, sentenceEl }]
let current = null;    // 正在补句子的那个单词

// 进页面后倒数 5 秒，老虎机式滚动字母，到点随机定一个并自动开始。
function startDraw() {
  let n = DRAW_SECONDS;
  drawCountEl.textContent = `${n} 秒后开始`;
  const cycle = setInterval(() => {
    drawLetterEl.textContent = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }, 90);
  const tick = setInterval(() => {
    n -= 1;
    if (n > 0) {
      drawCountEl.textContent = `${n} 秒后开始`;
    } else {
      clearInterval(tick);
      clearInterval(cycle);
      const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      drawLetterEl.textContent = letter;
      drawCountEl.textContent = "就是它！";
      setTimeout(() => startPlay(letter), 800); // 让抽中的字母停留一下
    }
  }, 1000);
}

function tokenize(text) {
  return text.split(/\s+/).map((w) => w.replace(/[^a-zA-Z]/g, "")).filter(Boolean);
}

// 新增一个“单词”条目：单词气泡 + 等待中的句子行。
function addWordEntry(word) {
  const ok = word[0].toUpperCase() === currentLetter.toUpperCase();
  const el = document.createElement("div");
  el.className = "entry";
  const bub = document.createElement("div");
  bub.className = ok ? "bub ok" : "bub";
  if (!ok) bub.style.setProperty("--r", `${(Math.random() * 10 - 5).toFixed(1)}deg`);
  bub.innerHTML = ok ? `${word}<span class="star">✓</span>` : word;
  const sen = document.createElement("div");
  sen.className = "entry-sentence";
  el.appendChild(bub);
  el.appendChild(sen);
  entriesEl.appendChild(el);
  entriesEl.scrollTop = entriesEl.scrollHeight;
  const entry = { word, ok, sentenceRaw: "", sentence: "", sentenceValid: false, el, sentenceEl: sen };
  entries.push(entry);
  return entry;
}

// 给某个单词补/累积句子；句子里含该单词才高亮，并记为“有效句子”。
function appendSentence(entry, text) {
  entry.sentenceRaw = (entry.sentenceRaw ? entry.sentenceRaw + " " + text : text).trim();
  const re = new RegExp(`\\b(${entry.word})\\b`, "i");
  const replaced = entry.sentenceRaw.replace(re, "<b>$1</b>");
  entry.sentenceValid = replaced !== entry.sentenceRaw; // 句子里确实含该单词
  entry.sentence = replaced;
  entry.sentenceEl.innerHTML = entry.sentence;
  entriesEl.scrollTop = entriesEl.scrollHeight;
}

function handleText(text) {
  const words = tokenize(text);
  if (words.length === 0) return;
  if (words.length === 1) {
    // 单个词 → 一个新的“单词”，先单独显示。
    current = addWordEntry(words[0]);
    promptEl.textContent = `👏 再用「${current.word}」说一句话 🗣️`;
  } else {
    // 多个词 → 当前单词的句子（若还没单词，用首词补一个）。
    if (!current) current = addWordEntry(words[0]);
    appendSentence(current, text);
    promptEl.textContent = `太棒了！还可以再说一个 ${currentLetter} 开头的单词 ✨`;
  }
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
  playEl.classList.add("hidden");
  pickEl.classList.add("hidden");
  const body = document.getElementById("summary-body");
  if (entries.length) {
    // 只统计“对的”：单词首字母匹配；句子需“单词对 且 句子里含该单词”才算。
    const wordCount = entries.filter((e) => e.ok).length;
    const sentenceCount = entries.filter((e) => e.ok && e.sentenceValid).length;
    let html = `字母 <span class="summary-stat">${currentLetter}</span>　` +
      `单词 <span class="summary-stat">${wordCount}</span> 个 · ` +
      `句子 <span class="summary-stat">${sentenceCount}</span> 句<div class="summary-list">`;
    entries.forEach((e) => {
      const star = e.ok ? " ✓" : "";
      html += `<div class="summary-entry"><div class="${e.ok ? "bub ok" : "bub"}">${e.word}${star}</div>`;
      if (e.sentence) html += `<div class="summary-sentence">${e.sentence}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
    body.innerHTML = html;
  } else {
    body.innerHTML = `你选了字母 <span class="summary-stat">${currentLetter}</span>，下次大声说出来吧！`;
  }
  document.getElementById("summary").classList.remove("hidden");
  launchConfetti(110);
  setTimeout(() => { location.href = "/index.html"; }, 40000);
}

async function startPlay(letter) {
  currentLetter = letter;
  entries.length = 0;
  current = null;
  entriesEl.innerHTML = "";
  pickEl.classList.add("hidden");
  playEl.classList.remove("hidden");
  letterEl.textContent = letter;
  promptEl.textContent = `先说一个 ${letter} 开头的单词 🎤`;
  timerEl.textContent = remaining;

  engine = new SpeechEngine({
    onText: (text) => handleText(text),
    getLetter: () => currentLetter,
  });
  try {
    await engine.start();
  } catch (e) {
    promptEl.textContent = "请允许使用麦克风后刷新页面 🎤";
    return;
  }
  timerId = setInterval(tick, 1000);
}

startDraw();
