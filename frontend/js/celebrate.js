// 撒花 + 背景漂浮装饰，给孩子更多“多巴胺”视觉反馈。
const CELEBRATE_COLORS = ["#ff8fab", "#ffd23f", "#06d6a0", "#118ab2", "#ef476f", "#c9b8f0"];

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
