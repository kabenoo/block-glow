(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("highScore");
  const levelEl = document.getElementById("level");
  const livesEl = document.getElementById("lives");
  const startScreen = document.getElementById("startScreen");
  const messageScreen = document.getElementById("messageScreen");
  const messageKicker = document.getElementById("messageKicker");
  const messageTitle = document.getElementById("messageTitle");
  const messageText = document.getElementById("messageText");
  const startButton = document.getElementById("startButton");
  const messageButton = document.getElementById("messageButton");
  const pauseButton = document.getElementById("pauseButton");
  const soundButton = document.getElementById("soundButton");

  const DIFFICULTIES = {
    beginner: { start: 210, max: 390, accel: 1.010, paddle: 0.26 },
    normal:   { start: 250, max: 470, accel: 1.014, paddle: 0.23 },
    advanced: { start: 290, max: 560, accel: 1.018, paddle: 0.20 }
  };

  const palettes = [
    ["#fb7185", "#f97316", "#facc15", "#34d399", "#38bdf8"],
    ["#c084fc", "#818cf8", "#38bdf8", "#2dd4bf", "#a3e635"],
    ["#f472b6", "#fb7185", "#f59e0b", "#22c55e", "#06b6d4"],
    ["#60a5fa", "#818cf8", "#a78bfa", "#e879f9", "#fb7185"]
  ];

  let cssW = 0, cssH = 0, dpr = 1;
  let selectedDifficulty = "normal";
  let running = false;
  let paused = false;
  let launched = false;
  let lastTime = 0;
  let score = 0;
  let level = 1;
  let lives = 3;
  let highScore = 0;
  let soundOn = true;
  let bricks = [];
  let particles = [];

  const paddle = { x: 0, y: 0, w: 0, h: 0, targetX: 0 };
  const ball = { x: 0, y: 0, r: 0, vx: 0, vy: 0, speed: 0 };

  function storageKey() {
    return `blockGlowHighScore_${selectedDifficulty}`;
  }

  function loadHighScore() {
    highScore = Number(localStorage.getItem(storageKey()) || 0);
    highScoreEl.textContent = highScore;
  }

  function saveHighScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(storageKey(), String(highScore));
      highScoreEl.textContent = highScore;
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, rect.width);
    cssH = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    paddle.w = cssW * DIFFICULTIES[selectedDifficulty].paddle;
    paddle.h = Math.max(11, cssH * 0.018);
    paddle.y = cssH - Math.max(30, cssH * 0.045);
    paddle.x = Math.min(paddle.x || (cssW - paddle.w) / 2, cssW - paddle.w);
    paddle.targetX = paddle.x;
    ball.r = Math.max(6, cssW * 0.018);

    if (!launched) attachBall();
    createBricks();
  }

  function createBricks() {
    const cols = 8;
    const rows = 5;
    const side = Math.max(12, cssW * 0.032);
    const gap = Math.max(4, cssW * 0.012);
    const preferredTop = Math.max(28, Math.min(58, cssH * 0.075));
    const bw = (cssW - side * 2 - gap * (cols - 1)) / cols;

    // 最下段ブロックとバーの間に、最低でも「ブロック5個分」の
    // 空間を確保する。画面が低い場合はブロックの高さを自動調整する。
    const availableHeight =
      paddle.y - preferredTop - gap * (rows - 1);
    const bh = Math.max(9, Math.min(28, availableHeight / (rows + 5)));
    const brickGroupHeight = rows * bh + gap * (rows - 1);
    const requiredPlaySpace = bh * 5;
    const top = Math.max(
      14,
      Math.min(preferredTop, paddle.y - brickGroupHeight - requiredPlaySpace)
    );

    const patterns = [
      () => true,
      (r, c) => !(r === 2 && (c === 3 || c === 4)),
      (r, c) => c >= r - 1 && c <= cols - r,
      (r, c) => !((r + c) % 5 === 0),
      (r, c) => !(r === 1 && (c === 1 || c === 6))
    ];
    const pattern = patterns[(level - 1) % patterns.length];

    bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!pattern(r, c)) continue;
        bricks.push({
          x: side + c * (bw + gap),
          y: top + r * (bh + gap),
          w: bw,
          h: bh,
          row: r,
          value: 5 - r,
          alive: true
        });
      }
    }
  }

  function attachBall() {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 3;
    ball.vx = 0;
    ball.vy = 0;
  }

  function resetBall() {
    launched = false;
    paddle.x = (cssW - paddle.w) / 2;
    paddle.targetX = paddle.x;
    attachBall();
  }

  function launchBall() {
    if (!running || paused || launched) return;
    launched = true;
    const cfg = DIFFICULTIES[selectedDifficulty];
    ball.speed = cfg.start;
    const angle = (-65 + Math.random() * 40) * Math.PI / 180;
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
    beep(520, 0.05);
  }

  function startGame() {
    score = 0;
    level = 1;
    lives = 3;
    running = true;
    paused = false;
    launched = false;
    startScreen.classList.remove("visible");
    messageScreen.classList.remove("visible");
    updateHud();
    loadHighScore();
    createBricks();
    resetBall();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function nextLevel() {
    saveHighScore();
    level += 1;
    updateHud();
    createBricks();
    resetBall();
    showMessage("STAGE CLEAR", `第${level - 1}面クリア`, `次は第${level}面です。`, "次の面へ", () => {
      messageScreen.classList.remove("visible");
    });
  }

  function gameOver() {
    running = false;
    saveHighScore();
    showMessage(
      score >= highScore ? "NEW RECORD" : "GAME OVER",
      `得点 ${score}`,
      `第${level}面まで進みました。`,
      "もう一度",
      () => {
        messageScreen.classList.remove("visible");
        startScreen.classList.add("visible");
      }
    );
  }

  function showMessage(kicker, title, text, buttonText, callback) {
    messageKicker.textContent = kicker;
    messageTitle.textContent = title;
    messageText.textContent = text;
    messageButton.textContent = buttonText;
    messageButton.onclick = callback;
    messageScreen.classList.add("visible");
  }

  function updateHud() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    livesEl.textContent = lives;
  }

  function handlePointer(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    paddle.targetX = Math.max(0, Math.min(cssW - paddle.w, x - paddle.w / 2));
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handlePointer(e.clientX);
    if (!launched) launchBall();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (e.buttons === 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    handlePointer(e.clientX);
  });

  document.querySelectorAll(".difficulty-button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".difficulty-button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedDifficulty = btn.dataset.difficulty;
      loadHighScore();
      resize();
    });
  });

  startButton.addEventListener("click", startGame);

  pauseButton.addEventListener("click", () => {
    if (!running) return;
    paused = !paused;
    pauseButton.textContent = paused ? "▶" : "Ⅱ";
    if (!paused) {
      lastTime = performance.now();
      requestAnimationFrame(loop);
    } else {
      showMessage("PAUSE", "一時停止中", "再開するとゲームが続きます。", "再開", () => {
        paused = false;
        pauseButton.textContent = "Ⅱ";
        messageScreen.classList.remove("visible");
        lastTime = performance.now();
        requestAnimationFrame(loop);
      });
    }
  });

  soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? "🔊" : "🔇";
  });

  let audioCtx;
  function beep(freq, duration) {
    if (!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.035, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function addParticles(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 190;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.42 + Math.random() * 0.34,
        size: 1.8 + Math.random() * 3.2,
        color
      });
    }
  }

  function update(dt) {
    paddle.x += (paddle.targetX - paddle.x) * Math.min(1, dt * 18);
    if (!launched) {
      attachBall();
      updateParticles(dt);
      return;
    }

    const cfg = DIFFICULTIES[selectedDifficulty];
    ball.speed = Math.min(cfg.max, ball.speed * Math.pow(cfg.accel, dt * 60));
    const current = Math.hypot(ball.vx, ball.vy) || 1;
    ball.vx = ball.vx / current * ball.speed;
    ball.vy = ball.vy / current * ball.speed;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r <= 0 && ball.vx < 0) {
      ball.x = ball.r;
      ball.vx *= -1;
      beep(350, 0.03);
    }
    if (ball.x + ball.r >= cssW && ball.vx > 0) {
      ball.x = cssW - ball.r;
      ball.vx *= -1;
      beep(350, 0.03);
    }
    if (ball.y - ball.r <= 0 && ball.vy < 0) {
      ball.y = ball.r;
      ball.vy *= -1;
      beep(350, 0.03);
    }

    if (
      ball.vy > 0 &&
      ball.y + ball.r >= paddle.y &&
      ball.y - ball.r <= paddle.y + paddle.h &&
      ball.x >= paddle.x - ball.r &&
      ball.x <= paddle.x + paddle.w + ball.r
    ) {
      ball.y = paddle.y - ball.r;
      const hit = ((ball.x - paddle.x) / paddle.w) * 2 - 1;
      const angle = (-90 + hit * 62) * Math.PI / 180;
      ball.vx = Math.cos(angle) * ball.speed;
      ball.vy = Math.sin(angle) * ball.speed;
      beep(620, 0.04);
    }

    for (const brick of bricks) {
      if (!brick.alive) continue;
      if (
        ball.x + ball.r > brick.x &&
        ball.x - ball.r < brick.x + brick.w &&
        ball.y + ball.r > brick.y &&
        ball.y - ball.r < brick.y + brick.h
      ) {
        brick.alive = false;
        score += brick.value;
        updateHud();
        saveHighScore();
        const palette = palettes[(level - 1) % palettes.length];
        addParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, palette[brick.row]);

        const overlapL = ball.x + ball.r - brick.x;
        const overlapR = brick.x + brick.w - (ball.x - ball.r);
        const overlapT = ball.y + ball.r - brick.y;
        const overlapB = brick.y + brick.h - (ball.y - ball.r);
        const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);
        if (minOverlap === overlapL || minOverlap === overlapR) ball.vx *= -1;
        else ball.vy *= -1;

        beep(780 + brick.value * 45, 0.035);
        break;
      }
    }

    if (bricks.every(b => !b.alive)) {
      nextLevel();
    }

    if (ball.y - ball.r > cssH) {
      lives -= 1;
      updateHud();
      beep(180, 0.12);
      if (lives <= 0) {
        gameOver();
      } else {
        resetBall();
        showMessage("MISS", `残り ${lives} 球`, "タップで再開します。", "続ける", () => {
          messageScreen.classList.remove("visible");
        });
      }
    }

    updateParticles(dt);
  }

  function updateParticles(dt) {
    particles = particles.filter(p => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      return p.life > 0;
    });
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function draw() {
    ctx.clearRect(0, 0, cssW, cssH);

    const themeIndex = Math.min(5, Math.floor((level - 1) / 2));
    const themes = [
      ["#0b1630", "#030814", "#7dd3fc"],
      ["#17112f", "#070612", "#c084fc"],
      ["#23160d", "#080706", "#fbbf24"],
      ["#10241f", "#040a08", "#34d399"],
      ["#26101f", "#090409", "#fb7185"],
      ["#1a1d26", "#030406", "#e5e7eb"]
    ];
    const [topColor, bottomColor, accentColor] = themes[themeIndex];

    const bg = ctx.createLinearGradient(0, 0, 0, cssH);
    bg.addColorStop(0, topColor);
    bg.addColorStop(0.55, bottomColor);
    bg.addColorStop(1, "#010205");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    const glow = ctx.createRadialGradient(
      cssW * 0.5, cssH * 0.18, 0,
      cssW * 0.5, cssH * 0.18, cssW * 0.8
    );
    glow.addColorStop(0, accentColor + "35");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.globalAlpha = 0.12 + themeIndex * 0.015;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    for (let y = 52; y < cssH; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    }

    if (themeIndex >= 1) {
      ctx.globalAlpha = 0.08 + themeIndex * 0.012;
      for (let x = -cssH; x < cssW + cssH; x += 54) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + cssH, cssH);
        ctx.stroke();
      }
    }

    if (themeIndex >= 2) {
      ctx.globalAlpha = 0.14;
      for (let i = 0; i < 18 + themeIndex * 4; i++) {
        const sx = (i * 83 + level * 29) % cssW;
        const sy = (i * 137 + level * 41) % cssH;
        ctx.fillStyle = i % 3 === 0 ? "#ffffff" : accentColor;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.7 + (i % 3) * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    const palette = palettes[(level - 1) % palettes.length];
    for (const brick of bricks) {
      if (!brick.alive) continue;
      const color = palette[brick.row];
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      const g = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(255,255,255,0.18)");
      ctx.fillStyle = g;
      roundRect(brick.x, brick.y, brick.w, brick.h, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(brick.x + 3, brick.y + 3, brick.w - 6, Math.max(2, brick.h * 0.18), 4);
      ctx.fill();
    }

    ctx.shadowColor = "#7dd3fc";
    ctx.shadowBlur = 18;
    const pg = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.w, paddle.y);
    pg.addColorStop(0, "#7dd3fc");
    pg.addColorStop(1, "#c084fc");
    ctx.fillStyle = pg;
    roundRect(paddle.x, paddle.y, paddle.w, paddle.h, paddle.h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 18;
    const bgBall = ctx.createRadialGradient(
      ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, ball.r * 0.15,
      ball.x, ball.y, ball.r
    );
    bgBall.addColorStop(0, "#ffffff");
    bgBall.addColorStop(0.4, "#dbeafe");
    bgBall.addColorStop(1, "#7dd3fc");
    ctx.fillStyle = bgBall;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2.2);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function loop(time) {
    if (!running || paused) return;
    const dt = Math.min(0.025, (time - lastTime) / 1000 || 0);
    lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 150));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running && !paused) {
      paused = true;
      pauseButton.textContent = "▶";
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  loadHighScore();
  resize();
  draw();
})();
