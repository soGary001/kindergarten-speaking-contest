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
const talkBtn = document.getElementById("talk");
let recording = false;

function setTalkState(s) {
  talkBtn.classList.remove("recording", "busy");
  if (s === "recording") talkBtn.innerHTML = bi("🛑 说完啦，点我", "Tap when done"), talkBtn.classList.add("recording");
  else if (s === "busy") talkBtn.innerHTML = bi("✨ 识别中…", "Listening…"), talkBtn.classList.add("busy");
  else talkBtn.innerHTML = bi("🎤 点我说话", "Tap to talk");
}

async function onTalk() {
  if (!engine) return;
  if (!recording) {
    recording = true;
    engine.beginRecording();
    setTalkState("recording");
  } else {
    recording = false;
    setTalkState("busy");
    talkBtn.disabled = true;
    await engine.stopAndTranscribe();
    talkBtn.disabled = false;
    setTalkState("idle");
  }
}

let currentLetter = null;
let remaining = DURATION;
let engine = null;
let timerId = null;
const entries = [];   // [{ word, ok, sentenceRaw, sentence, el, sentenceEl }]
let current = null;    // 正在补句子的那个单词

// 进页面后倒数 5 秒，老虎机式滚动字母，到点随机定一个并自动开始。
function startDraw() {
  let n = DRAW_SECONDS;
  drawCountEl.innerHTML = bi(`${n} 秒后开始`, `Starts in ${n}`);
  const cycle = setInterval(() => {
    drawLetterEl.textContent = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }, 90);
  const tick = setInterval(() => {
    n -= 1;
    if (n > 0) {
      drawCountEl.innerHTML = bi(`${n} 秒后开始`, `Starts in ${n}`);
    } else {
      clearInterval(tick);
      clearInterval(cycle);
      const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      drawLetterEl.textContent = letter;
      drawCountEl.innerHTML = bi("就是它！", "Here we go!");
      setTimeout(() => startPlay(letter), 800); // 让抽中的字母停留一下
    }
  }, 1000);
}

function tokenize(text) {
  return text.split(/\s+/).map((w) => w.replace(/[^a-zA-Z]/g, "")).filter(Boolean);
}

// 常见不规则变化（幼儿高频动词）。每组首词为原形，其余为变体。
const IRREGULAR_GROUPS = [
  ["run", "ran", "running", "runs"],
  ["eat", "ate", "eaten", "eating", "eats"],
  ["go", "went", "gone", "going", "goes"],
  ["swim", "swam", "swimming", "swims"],
  ["sit", "sat", "sitting", "sits"],
  ["get", "got", "getting", "gets"],
  ["make", "made", "making", "makes"],
  ["take", "took", "taken", "taking", "takes"],
  ["see", "saw", "seen", "seeing", "sees"],
  ["come", "came", "coming", "comes"],
  ["give", "gave", "given", "giving", "gives"],
  ["have", "had", "having", "has"],
  ["do", "did", "done", "doing", "does"],
  ["fly", "flew", "flown", "flying", "flies"],
  ["draw", "drew", "drawn", "drawing", "draws"],
  ["sing", "sang", "sung", "singing", "sings"],
  ["ride", "rode", "ridden", "riding", "rides"],
  ["write", "wrote", "written", "writing", "writes"],
  ["sleep", "slept", "sleeping", "sleeps"],
  ["drink", "drank", "drunk", "drinking", "drinks"],
  ["stand", "stood", "standing", "stands"],
  ["jump", "jumped", "jumping", "jumps"],
];
const IRREGULAR = {};
IRREGULAR_GROUPS.forEach((g) => g.forEach((f) => { IRREGULAR[f] = g[0]; }));

// 把一个词还原成大致词干，覆盖 -s/-es/-ies/-ed/-ied/-ing + 辅音重复。
function stem(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return "";
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (/ies$/.test(w)) return w.slice(0, -3) + "y";
  if (/ied$/.test(w)) return w.slice(0, -3) + "y";
  let s = w;
  if (/ing$/.test(s)) s = s.slice(0, -3);
  else if (/ed$/.test(s)) s = s.slice(0, -2);
  else if (/es$/.test(s)) s = s.slice(0, -2);
  else if (/s$/.test(s) && !/ss$/.test(s)) s = s.slice(0, -1);
  s = s.replace(/([bcdfghjklmnpqrstvwxyz])\1$/, "$1"); // running→runn→run
  return s;
}

// 两个词是否为同一个词（含时态/单复数等变形）。
function sameWord(a, b) {
  a = a.toLowerCase().replace(/[^a-z]/g, "");
  b = b.toLowerCase().replace(/[^a-z]/g, "");
  if (!a || !b) return false;
  if (a === b) return true;
  const sa = stem(a);
  const sb = stem(b);
  if (sa === sb) return true;
  if (sa + "e" === sb || sb + "e" === sa) return true; // make/making、ride/riding 的不发音 e
  return false;
}

// 在句子里找与 word 同词（含时态变形）的 token，高亮第一处；返回 {html, hit}。
function highlightWord(sentence, word) {
  const parts = sentence.split(/(\s+)/); // 保留空白分隔
  let hit = false;
  const out = parts.map((p) => {
    if (hit) return p;
    const core = p.replace(/[^a-zA-Z]/g, "");
    if (core && sameWord(core, word)) {
      hit = true;
      return p.replace(core, `<b>${core}</b>`);
    }
    return p;
  });
  return { html: out.join(""), hit };
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

// 给某个单词补/累积句子；句子里含该单词（含时态/词形变化）才高亮，并记为“有效句子”。
function appendSentence(entry, text) {
  entry.sentenceRaw = (entry.sentenceRaw ? entry.sentenceRaw + " " + text : text).trim();
  const { html, hit } = highlightWord(entry.sentenceRaw, entry.word);
  entry.sentenceValid = hit;
  entry.sentence = html;
  entry.sentenceEl.innerHTML = entry.sentence;
  entriesEl.scrollTop = entriesEl.scrollHeight;
}

function handleText(text) {
  const words = tokenize(text);
  if (words.length === 0) return;
  if (words.length === 1) {
    // 单个词 → 一个新的“单词”，先单独显示。
    current = addWordEntry(words[0]);
    promptEl.innerHTML = bi(`👏 再用「${current.word}」说一句话 🗣️`, `Now make a sentence with “${current.word}”`);
  } else {
    // 多个词 → 当前单词的句子（若还没单词，用首词补一个）。
    if (!current) current = addWordEntry(words[0]);
    appendSentence(current, text);
    promptEl.innerHTML = bi(`太棒了！还可以再说一个 ${currentLetter} 开头的单词 ✨`, `Great! Try another word starting with ${currentLetter}`);
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
  // 大班：正确句子>2 → (正确句子-2)×0.5；正确句子≤2 → 0 分。
  // 正确句子 = 单词首字母对 且 句子里含该单词（含时态/词形变化）。
  const validSentences = entries.filter((e) => e.ok && e.sentenceValid).length;
  const score = validSentences > 2 ? (validSentences - 2) * 0.5 : 0;
  if (entries.length) {
    // 只统计“对的”：单词首字母匹配；句子需“单词对 且 句子里含该单词”才算。
    // 中班一轮可达 7 词 + 7 句，明细在比赛过程中已实时展示；总结页只留统计，
    // 避免内容溢出把按钮挤出屏幕。
    const wordCount = entries.filter((e) => e.ok).length;
    const sentenceCount = entries.filter((e) => e.ok && e.sentenceValid).length;
    body.innerHTML =
      scoreBadge(score) +
      `字母 <span class="summary-stat">${currentLetter}</span>　` +
      `单词 <span class="summary-stat">${wordCount}</span> 个 · ` +
      `句子 <span class="summary-stat">${sentenceCount}</span> 句` +
      `<span class="en">Letter ${currentLetter} · ${wordCount} words · ${sentenceCount} sentences</span>`;
  } else {
    body.innerHTML = scoreBadge(0) +
      `你选了字母 <span class="summary-stat">${currentLetter}</span>，下次大声说出来吧！` +
      `<span class="en">You got letter ${currentLetter} — speak up next time!</span>`;
  }
  const enc = playEncouragement(); // 随机播一句英文鼓励 + 显示
  const encEl = document.createElement("div");
  encEl.className = "encourage";
  encEl.textContent = "🌟 " + enc.text;
  body.appendChild(encEl);
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
  promptEl.innerHTML = bi(`先说一个 ${letter} 开头的单词 🎤`, `First, say a word starting with ${letter}`);
  timerEl.textContent = remaining;

  engine = new SpeechEngine({
    onText: (text) => handleText(text),
    getLetter: () => currentLetter,
  });
  try {
    await engine.start();
  } catch (e) {
    promptEl.innerHTML = bi("请允许使用麦克风后刷新页面 🎤", "Please allow the microphone, then refresh");
    return;
  }
  playCheer(); // 抽中的字母就绪，来点庆祝音效
  setTalkState("idle");
  talkBtn.onclick = onTalk;
  timerId = setInterval(tick, 1000);
}

startDraw();
