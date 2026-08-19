/**
 * k123幸運拉霸 (Vegas Slot Machine)
 * 橫向由左而右輪轉，確實順序輪流顯示 a1.png ~ a6.png
 * product.txt 讀取寫入、Web Audio 音效合成與慶祝粒子特效
 */

(function () {
  'use strict';

  // ==========================================
  // 1. 基礎資料與 6 張圖片獎項設定 (嚴格對應 a1.png ~ a6.png)
  // ==========================================
  const DEFAULT_PRIZES = [
    { id: 1, file: 'pic/a1.png', name: '特等獎', desc: '頂級尊榮 終極大獎！', tag: 'JACKPOT' },
    { id: 2, file: 'pic/a2.png', name: '頭獎', desc: '豪華科技 旗艦好禮！', tag: '1ST PRIZE' },
    { id: 3, file: 'pic/a3.png', name: '二獎', desc: '精緻生活 超值獎品！', tag: '2ND PRIZE' },
    { id: 4, file: 'pic/a4.png', name: '三獎', desc: '幸運隨行 購物禮券！', tag: '3RD PRIZE' },
    { id: 5, file: 'pic/a5.png', name: '四獎', desc: '歡樂驚喜 澎湃福袋！', tag: '4TH PRIZE' },
    { id: 6, file: 'pic/a6.png', name: '普獎', desc: '感謝支持 幸運永隨！', tag: 'LUCKY' }
  ];

  let prizes = JSON.parse(localStorage.getItem('slot_prizes')) || DEFAULT_PRIZES;
  let spinHistory = JSON.parse(localStorage.getItem('slot_history')) || [];
  let isSoundEnabled = localStorage.getItem('slot_sound') !== 'false';

  // 尺寸常數 (需與 CSS --item-w 對齊)
  let itemWidth = 150; // 每個格子的寬度 (px)
  const TOTAL_ITEMS = 6;
  let cycleWidth = TOTAL_ITEMS * itemWidth; // 一個完整循環寬度 (6 * 150 = 900px)
  const BUFFER_CYCLES = 6; // 前後緩衝組數以保證無縫位移

  // 遊戲狀態變數
  let isSpinning = false;
  let currentX = 0; // 滾輪目前的 X 軸像素位置 (由左而右增加)
  let animationFrameId = null;
  let spinDuration = 3.0; // 高速旋轉秒數 (由滑桿控制)
  let decelDuration = 2.5; // 漸慢減速秒數 (由滑桿控制)

  function updateDimensions() {
    const firstItem = document.querySelector('.reel-item');
    if (firstItem) {
      itemWidth = firstItem.offsetWidth || 150;
      cycleWidth = TOTAL_ITEMS * itemWidth;
    }
  }

  // ==========================================
  // 2. Web Audio API 音效合成引擎
  // ==========================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playLever() {
      if (!isSoundEnabled) return;
      this.init();
      const now = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    playTick(pitchRatio = 1) {
      if (!isSoundEnabled) return;
      this.init();
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      
      const baseFreq = 380 * Math.max(0.6, Math.min(2.0, pitchRatio));
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.035);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    }

    playLock() {
      if (!isSoundEnabled) return;
      this.init();
      const now = this.ctx.currentTime;

      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(220, now);
      osc1.frequency.exponentialRampToValueAtTime(60, now + 0.2);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.linearRampToValueAtTime(0.01, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.exponentialRampToValueAtTime(440, now + 0.1);
      gain2.gain.setValueAtTime(0.2, now);
      gain2.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.1);
    }

    playJackpot() {
      if (!isSoundEnabled) return;
      this.init();
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0.25, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.65);
      });

      for (let j = 0; j < 8; j++) {
        setTimeout(() => this.playCoin(), 300 + j * 120);
      }
    }

    playCoin() {
      if (!isSoundEnabled) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      const freqs = [1760, 2093, 2349, 2637];
      const f = freqs[Math.floor(Math.random() * freqs.length)];
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  }

  const sound = new SoundEngine();

  // ==========================================
  // 3. 粒子特效系統 (Confetti & Gold Coins)
  // ==========================================
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let particleAnimationId = null;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    updateDimensions();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Particle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 9 + 5;
      this.speedX = (Math.random() - 0.5) * 14;
      this.speedY = Math.random() * -12 - 4;
      this.gravity = 0.35;
      this.rotation = Math.random() * 360;
      this.rotationSpeed = (Math.random() - 0.5) * 12;
      this.opacity = 1;
      this.decay = Math.random() * 0.008 + 0.006;
      
      this.isCoin = Math.random() > 0.4;
      const colors = ['#ffd700', '#ff5252', '#00e676', '#40c4ff', '#ff4081', '#ffffff'];
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      this.speedY += this.gravity;
      this.x += this.speedX;
      this.y += this.speedY;
      this.rotation += this.rotationSpeed;
      this.opacity -= this.decay;
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.opacity);
      ctx.translate(this.x, this.y);
      ctx.rotate((this.rotation * Math.PI) / 180);

      if (this.isCoin) {
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.fill();
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
      }
      ctx.restore();
    }
  }

  function triggerCelebrationParticles() {
    particles = [];
    const count = 120;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight * 0.45;

    for (let i = 0; i < count; i++) {
      particles.push(new Particle(centerX, centerY));
    }

    if (!particleAnimationId) {
      loopParticles();
    }
  }

  function loopParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw();
      if (p.opacity <= 0 || p.y > canvas.height + 50) {
        particles.splice(i, 1);
      }
    }

    if (particles.length > 0) {
      particleAnimationId = requestAnimationFrame(loopParticles);
    } else {
      particleAnimationId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ==========================================
  // 4. product.txt 讀取與寫入引擎
  // ==========================================
  function parseProductText(content) {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length === 0) return null;

    const parsedList = [];
    lines.forEach((line, idx) => {
      if (idx >= TOTAL_ITEMS) return;
      const parts = line.split(',').map(p => p.trim());
      
      let file = `pic/a${idx + 1}.png`;
      let name = `獎項 A${idx + 1}`;
      let desc = '恭喜獲得幸運大獎！';
      let tag = `PRIZE ${idx + 1}`;

      if (parts.length >= 4) {
        file = parts[0].startsWith('pic/') ? parts[0] : `pic/${parts[0]}`;
        name = parts[1] || name;
        desc = parts[2] || desc;
        tag = parts[3] || tag;
      } else if (parts.length === 3) {
        name = parts[0];
        desc = parts[1];
        tag = parts[2];
      } else if (parts.length === 2) {
        name = parts[0];
        desc = parts[1];
      } else if (parts.length === 1) {
        name = parts[0];
      }

      parsedList.push({
        id: idx + 1,
        file: file,
        name: name,
        desc: desc,
        tag: tag
      });
    });

    while (parsedList.length < TOTAL_ITEMS) {
      const idx = parsedList.length;
      parsedList.push({
        id: idx + 1,
        file: `pic/a${idx + 1}.png`,
        name: `獎項 A${idx + 1}`,
        desc: '恭喜獲得幸運大獎！',
        tag: `PRIZE ${idx + 1}`
      });
    }

    return parsedList;
  }

  function generateProductText() {
    let output = "# k123幸運拉霸 獎項設定檔\n# 格式說明：圖片檔名,獎項名稱,獎項說明,獎項標籤 (以逗號分隔，每行一個)\n";
    prizes.forEach(p => {
      const fileName = p.file.replace('pic/', '');
      output += `${fileName},${p.name},${p.desc},${p.tag}\n`;
    });
    return output;
  }

  async function loadProductFileFromDirectory() {
    const fileStatusBadge = document.getElementById('file-status-badge');
    try {
      const response = await fetch('product.txt?t=' + Date.now());
      if (!response.ok) throw new Error('HTTP status ' + response.status);
      const text = await response.text();
      const parsed = parseProductText(text);
      if (parsed && parsed.length > 0) {
        prizes = parsed;
        localStorage.setItem('slot_prizes', JSON.stringify(prizes));
        if (fileStatusBadge) fileStatusBadge.textContent = '📄 已成功連結同目錄 product.txt';
        renderReelStrip();
        return true;
      }
    } catch (err) {
      console.warn('無法自動讀取 product.txt (處於本地 file:// 或尚未啟動伺服器):', err);
      if (fileStatusBadge) fileStatusBadge.textContent = '💾 本機模式 (可手動讀取/寫出)';
    }
    return false;
  }

  // ==========================================
  // 5. DOM 元素與膠捲生成 (嚴格正序 a1 -> a2 -> a3 -> a4 -> a5 -> a6)
  // ==========================================
  const reelStrip = document.getElementById('reel-strip');
  const btnSpin = document.getElementById('btn-spin');
  const leverArm = document.getElementById('lever-arm');
  const leverAssembly = document.getElementById('lever-assembly');
  const statusText = document.getElementById('status-text');
  const statusDisplay = document.querySelector('.status-dot');
  
  const topLights = document.getElementById('top-lights');
  const bottomLights = document.getElementById('bottom-lights');
  const leftLights = document.getElementById('left-lights');
  const rightLights = document.getElementById('right-lights');

  const spinDurationSlider = document.getElementById('spin-duration-slider');
  const decelDurationSlider = document.getElementById('decel-duration-slider');
  const durationVal = document.getElementById('duration-val');
  const decelVal = document.getElementById('decel-val');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  const btnHistoryToggle = document.getElementById('btn-history-toggle');
  const historyCounter = document.getElementById('history-counter');
  const btnPrizesToggle = document.getElementById('btn-prizes-toggle');

  const winModal = document.getElementById('win-modal');
  const winnerImg = document.getElementById('winner-img');
  const winnerTag = document.getElementById('winner-tag');
  const winnerTitle = document.getElementById('winner-title');
  const winnerDesc = document.getElementById('winner-desc');
  const btnModalClose = document.getElementById('btn-modal-close');

  const historyDrawer = document.getElementById('history-drawer');
  const historyList = document.getElementById('history-list');
  const btnHistoryClose = document.getElementById('btn-history-close');
  const btnClearHistory = document.getElementById('btn-clear-history');

  const prizesModal = document.getElementById('prizes-modal');
  const prizesEditorList = document.getElementById('prizes-editor-list');
  const btnPrizesClose = document.getElementById('btn-prizes-close');
  const btnSavePrizes = document.getElementById('btn-save-prizes');
  const btnExportFile = document.getElementById('btn-export-file');
  const btnReloadFile = document.getElementById('btn-reload-file');
  const btnOpenFile = document.getElementById('btn-open-file');
  const filePickerInput = document.getElementById('file-picker-input');

  function buildLedBulbs() {
    function createBulbs(container, count) {
      container.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const b = document.createElement('div');
        b.className = 'led-bulb';
        container.appendChild(b);
      }
    }
    createBulbs(topLights, 10);
    createBulbs(bottomLights, 10);
    createBulbs(leftLights, 5);
    createBulbs(rightLights, 5);
  }

  let ledTimer = null;
  let ledStep = 0;
  function startLedAnimation(speed = 200, mode = 'chase') {
    clearInterval(ledTimer);
    const allBulbs = document.querySelectorAll('.led-bulb');
    
    ledTimer = setInterval(() => {
      ledStep++;
      allBulbs.forEach((bulb, idx) => {
        bulb.className = 'led-bulb';
        if (mode === 'fast') {
          if ((idx + ledStep) % 3 === 0) bulb.classList.add('lit-gold');
          else if ((idx + ledStep) % 3 === 1) bulb.classList.add('lit-red');
          else bulb.classList.add('lit-green');
        } else if (mode === 'win') {
          if (ledStep % 2 === 0) bulb.classList.add('lit-gold');
          else bulb.classList.add('lit-red');
        } else {
          if ((idx + ledStep) % 4 === 0) bulb.classList.add('lit-gold');
        }
      });
    }, speed);
  }

  /**
   * 渲染橫向膠捲
   * 關鍵物理設計：由左而右移動時，要讓中間視窗依序出現 a1 -> a2 -> a3 -> a4 -> a5 -> a6
   * 因此在膠捲左側排列順序為 [..., a3, a2, a1, a6, a5, a4, a3, a2, a1, a6, a5, a4, a3, a2, a1, ...]
   * 當膠捲往右移動 (X 增加)，a2 就會從左側進入中間，緊接著 a3, a4, a5, a6, a1...
   */
  function renderReelStrip() {
    reelStrip.innerHTML = '';
    updateDimensions();

    // 建立 6 組重複項目以供無縫滾動
    // 膠捲的基準偏移量 (baseOffset)，確保座標全為正值
    const totalSets = BUFFER_CYCLES;
    
    for (let c = 0; c < totalSets; c++) {
      // 每個週期內，以 (1 - k) 的空間關係排列獎項
      // 順序由左至右：a3, a2, a1, a6, a5, a4 (確保往右移動時，依序為 a1 -> a2 -> a3 -> a4 -> a5 -> a6)
      for (let step = 0; step < TOTAL_ITEMS; step++) {
        // 在一個週期內，使得在 X = k * itemWidth 時，第 k 個獎項剛好在中間 (X = itemWidth)
        // 也就是 leftPos = (1 - k) * itemWidth
        // 從左到右 step = 0..5 對應 k = (1 - step + 6) % 6
        const prizeIdx = ((1 - step) % TOTAL_ITEMS + TOTAL_ITEMS) % TOTAL_ITEMS;
        const prize = prizes[prizeIdx];

        const itemEl = document.createElement('div');
        itemEl.className = 'reel-item';
        itemEl.dataset.prizeIndex = prizeIdx;
        itemEl.innerHTML = `
          <div class="item-img-wrap">
            <img class="item-img" src="${prize.file}" alt="${prize.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'80\\' height=\\'80\\' viewBox=\\'0 0 80 80\\'><rect fill=\\'%23d4af37\\' width=\\'80\\' height=\\'80\\' rx=\\'12\\'/><text fill=\\'%23000\\' x=\\'50%\\' y=\\'55%\\' font-size=\\'28\\' font-weight=\\'bold\\' text-anchor=\\'middle\\' dominant-baseline=\\'middle\\'>A${prize.id}</text></svg>'">
          </div>
          <div class="item-title">${prize.name}</div>
        `;
        reelStrip.appendChild(itemEl);
      }
    }

    // 初始位置：設定在第 2 組週期的起點 (X = 0)，此時中間格剛好是 a1.png (特等獎)
    // 左邊格剛好是 a2.png，右邊格剛好是 a6.png
    currentX = 0;
    applyReelPosition(currentX);
  }

  // 套用膠捲位置 (保證無限循環且正向無縫)
  function applyReelPosition(x) {
    // 基準偏移量：放在第 2 個週期起點，避免負座標
    const baseOffset = -2 * cycleWidth;
    const visualX = baseOffset + (x % cycleWidth);
    reelStrip.style.transform = `translateX(${visualX}px)`;
  }

  // ==========================================
  // 6. 核心橫向物理旋轉引擎 (由左而右輪轉，正序 a1..a6 確實輪流)
  // ==========================================
  function startSpin() {
    if (isSpinning) return;
    isSpinning = true;
    updateDimensions();

    sound.playLever();
    btnSpin.disabled = true;
    statusDisplay.className = 'status-dot spinning';
    statusText.textContent = '🚀 由左而右高速輪轉中 (a1 ~ a6)... 祝您中大獎！';
    
    leverArm.classList.add('pulled');
    setTimeout(() => {
      leverArm.classList.remove('pulled');
    }, 280);

    startLedAnimation(70, 'fast');

    // 隨機選定中獎獎項 index (0=a1, 1=a2, 2=a3, 3=a4, 4=a5, 5=a6)
    const winningIndex = Math.floor(Math.random() * TOTAL_ITEMS);

    const maxSpeed = 1900; // 像素/秒 (由左往右平滑推進)
    const accelTime = 0.4;
    const constSpinTime = spinDuration;
    const decelTime = decelDuration;

    let startTime = null;
    let phase = 'accel';
    let phaseStartTime = null;

    let startDecelX = 0;
    let targetFinalX = 0;
    let decelDistance = 0;

    let lastTickX = currentX;

    function step(timestamp) {
      if (!startTime) {
        startTime = timestamp;
        phaseStartTime = timestamp;
      }

      const totalElapsed = (timestamp - startTime) / 1000;
      const phaseElapsed = (timestamp - phaseStartTime) / 1000;

      // 檢查齒輪咔噠聲 (每當一張圖片輪流通過中獎框時發聲)
      if (Math.abs(currentX - lastTickX) >= itemWidth * 0.85) {
        const currentSpeedRatio = phase === 'decel' ? Math.max(0.4, (targetFinalX - currentX) / decelDistance) : 1.2;
        sound.playTick(currentSpeedRatio);
        lastTickX = currentX;
      }

      if (phase === 'accel') {
        const progress = Math.min(1, phaseElapsed / accelTime);
        const easeIn = progress * progress;
        currentX += easeIn * maxSpeed * 0.016;

        if (progress >= 1) {
          phase = 'fast';
          phaseStartTime = timestamp;
        }
      } else if (phase === 'fast') {
        currentX += maxSpeed * 0.016;

        if (phaseElapsed >= constSpinTime) {
          phase = 'decel';
          phaseStartTime = timestamp;
          startDecelX = currentX;

          // 計算由左而右煞停落點：
          // 當 currentX % cycleWidth === winningIndex * itemWidth 時，第 winningIndex 張圖片恰好鎖定在中間中獎框！
          const targetModulo = winningIndex * itemWidth;
          
          const estimatedDistance = (maxSpeed * decelTime) / 2;
          const minTargetX = startDecelX + estimatedDistance;

          const currentCycleCount = Math.floor(minTargetX / cycleWidth);
          targetFinalX = (currentCycleCount + 1) * cycleWidth + targetModulo;
          decelDistance = targetFinalX - startDecelX;
        }
      } else if (phase === 'decel') {
        const progress = Math.min(1, phaseElapsed / decelTime);
        // Cubic Ease-Out 平滑自然煞車曲線
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentX = startDecelX + decelDistance * easeOut;

        if (progress >= 1) {
          currentX = targetFinalX;
          phase = 'bounce';
          phaseStartTime = timestamp;
          sound.playLock();
        }
      } else if (phase === 'bounce') {
        // 機械卡榫微幅阻尼回彈 (Elastic Snap-back)
        const bounceDuration = 0.35;
        const progress = Math.min(1, phaseElapsed / bounceDuration);
        
        const bounceOffset = Math.sin(progress * Math.PI * 2) * (8 * (1 - progress));
        applyReelPosition(targetFinalX + bounceOffset);

        if (progress >= 1) {
          phase = 'done';
        }
      }

      if (phase !== 'bounce') {
        applyReelPosition(currentX);
      }

      if (phase !== 'done') {
        animationFrameId = requestAnimationFrame(step);
      } else {
        onSpinComplete(winningIndex);
      }
    }

    animationFrameId = requestAnimationFrame(step);
  }

  function onSpinComplete(winningIndex) {
    isSpinning = false;
    btnSpin.disabled = false;
    statusDisplay.className = 'status-dot';

    const winner = prizes[winningIndex];
    statusText.textContent = `🎉 恭喜抽中：【${winner.name}】（${winner.file}）！`;

    sound.playJackpot();
    triggerCelebrationParticles();
    startLedAnimation(120, 'win');

    recordHistory(winner);

    setTimeout(() => {
      showWinModal(winner);
    }, 600);
  }

  // ==========================================
  // 7. 中獎彈窗與歷史紀錄處理
  // ==========================================
  function showWinModal(winner) {
    winnerImg.src = winner.file;
    winnerTag.textContent = winner.tag || 'WINNER';
    winnerTitle.textContent = winner.name;
    winnerDesc.textContent = winner.desc || '恭喜獲得幸運好禮！';
    winModal.classList.add('open');
  }

  btnModalClose.addEventListener('click', () => {
    winModal.classList.remove('open');
    startLedAnimation(350, 'chase');
  });

  function recordHistory(winner) {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    const record = {
      name: winner.name,
      file: winner.file,
      time: timeStr,
      id: Date.now()
    };

    spinHistory.unshift(record);
    if (spinHistory.length > 30) spinHistory.pop();
    localStorage.setItem('slot_history', JSON.stringify(spinHistory));
    updateHistoryUI();
  }

  function updateHistoryUI() {
    historyCounter.textContent = spinHistory.length;
    if (spinHistory.length === 0) {
      historyList.innerHTML = '<div class="empty-history">尚無抽獎紀錄，拉動拉桿開始試試手氣吧！</div>';
      return;
    }

    historyList.innerHTML = spinHistory.map(item => `
      <div class="history-item">
        <img src="${item.file}" alt="${item.name}">
        <div class="history-item-info">
          <div class="history-item-title">${item.name}</div>
          <div class="history-item-time">${item.time}</div>
        </div>
      </div>
    `).join('');
  }

  btnClearHistory.addEventListener('click', () => {
    if (confirm('確定要清空所有抽獎歷史紀錄嗎？')) {
      spinHistory = [];
      localStorage.removeItem('slot_history');
      updateHistoryUI();
    }
  });

  // ==========================================
  // 8. 控制與自訂設定事件綁定
  // ==========================================
  spinDurationSlider.addEventListener('input', (e) => {
    spinDuration = parseFloat(e.target.value);
    durationVal.textContent = `${spinDuration.toFixed(1)} 秒`;
  });

  decelDurationSlider.addEventListener('input', (e) => {
    decelDuration = parseFloat(e.target.value);
    decelVal.textContent = `${decelDuration.toFixed(1)} 秒`;
  });

  btnSoundToggle.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('slot_sound', isSoundEnabled);
    if (isSoundEnabled) {
      btnSoundToggle.classList.add('active');
      soundIcon.textContent = '🔊';
      sound.playTick();
    } else {
      btnSoundToggle.classList.remove('active');
      soundIcon.textContent = '🔇';
    }
  });

  btnSpin.addEventListener('click', startSpin);

  let isDraggingLever = false;
  let leverStartY = 0;

  leverAssembly.addEventListener('mousedown', (e) => {
    if (isSpinning) return;
    isDraggingLever = true;
    leverStartY = e.clientY;
    sound.init();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingLever || isSpinning) return;
    const deltaY = e.clientY - leverStartY;
    if (deltaY > 25) {
      leverArm.classList.add('pulled');
    }
    if (deltaY > 60) {
      isDraggingLever = false;
      startSpin();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingLever) {
      isDraggingLever = false;
      if (!isSpinning) {
        startSpin();
      }
    }
  });

  leverAssembly.addEventListener('touchstart', (e) => {
    if (isSpinning) return;
    isDraggingLever = true;
    leverStartY = e.touches[0].clientY;
    sound.init();
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isDraggingLever || isSpinning) return;
    const deltaY = e.touches[0].clientY - leverStartY;
    if (deltaY > 20) {
      leverArm.classList.add('pulled');
    }
    if (deltaY > 50) {
      isDraggingLever = false;
      startSpin();
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (isDraggingLever) {
      isDraggingLever = false;
      if (!isSpinning) {
        startSpin();
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isSpinning && !prizesModal.classList.contains('open')) {
      e.preventDefault();
      startSpin();
    }
  });

  btnHistoryToggle.addEventListener('click', () => {
    historyDrawer.classList.toggle('open');
  });
  btnHistoryClose.addEventListener('click', () => {
    historyDrawer.classList.remove('open');
  });

  function renderPrizesEditor() {
    prizesEditorList.innerHTML = prizes.map((prize, idx) => `
      <div class="prize-edit-row">
        <img src="${prize.file}" alt="${prize.name}">
        <div class="prize-inputs">
          <div class="prize-inputs-top">
            <input type="text" data-index="${idx}" class="input-prize-name" value="${prize.name}" placeholder="獎項名稱" style="flex: 2;">
            <input type="text" data-index="${idx}" class="input-prize-tag" value="${prize.tag || ''}" placeholder="標籤 (例: 1ST)" style="flex: 1;">
          </div>
          <input type="text" data-index="${idx}" class="input-prize-desc" value="${prize.desc}" placeholder="獎項詳細說明">
        </div>
      </div>
    `).join('');
  }

  btnPrizesToggle.addEventListener('click', () => {
    renderPrizesEditor();
    prizesModal.classList.add('open');
  });

  btnPrizesClose.addEventListener('click', () => {
    prizesModal.classList.remove('open');
  });

  function collectEditedPrizes() {
    const nameInputs = prizesEditorList.querySelectorAll('.input-prize-name');
    const tagInputs = prizesEditorList.querySelectorAll('.input-prize-tag');
    const descInputs = prizesEditorList.querySelectorAll('.input-prize-desc');

    nameInputs.forEach((inp, idx) => {
      prizes[idx].name = inp.value.trim() || `獎項 A${idx + 1}`;
      prizes[idx].tag = tagInputs[idx].value.trim() || `PRIZE ${idx + 1}`;
      prizes[idx].desc = descInputs[idx].value.trim() || '幸運大獎！';
    });

    localStorage.setItem('slot_prizes', JSON.stringify(prizes));
    renderReelStrip();
  }

  btnSavePrizes.addEventListener('click', () => {
    collectEditedPrizes();
    prizesModal.classList.remove('open');
    alert('✅ 獎項設定已成功更新並套用！');
  });

  btnExportFile.addEventListener('click', async () => {
    collectEditedPrizes();
    const textData = generateProductText();

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'product.txt',
          types: [{
            description: 'Text Files',
            accept: { 'text/plain': ['.txt'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(textData);
        await writable.close();
        alert('🎉 product.txt 檔案已成功寫入儲存！');
        prizesModal.classList.remove('open');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('📥 已為您下載 product.txt！請將其放入與 index.html 相同的資料夾中即可。');
    prizesModal.classList.remove('open');
  });

  btnReloadFile.addEventListener('click', async () => {
    const success = await loadProductFileFromDirectory();
    if (success) {
      renderPrizesEditor();
      alert('🔄 已成功重新讀取同目錄下的 product.txt！');
    } else {
      alert('⚠️ 無法直接讀取 product.txt。若是以直接點擊檔案開啟 (file://)，請使用右側【📂 讀取本機檔案】按鈕手動選取。');
    }
  });

  btnOpenFile.addEventListener('click', () => {
    filePickerInput.click();
  });

  filePickerInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const parsed = parseProductText(content);
      if (parsed && parsed.length > 0) {
        prizes = parsed;
        localStorage.setItem('slot_prizes', JSON.stringify(prizes));
        renderReelStrip();
        renderPrizesEditor();
        const fileStatusBadge = document.getElementById('file-status-badge');
        if (fileStatusBadge) fileStatusBadge.textContent = `📄 已載入本機檔案：${file.name}`;
        alert(`✅ 已成功載入 ${file.name} 的獎項內容！`);
      } else {
        alert('⚠️ 檔案格式解析失敗，請確認檔案內容格式。');
      }
    };
    reader.readAsText(file, 'utf-8');
    filePickerInput.value = '';
  });

  // ==========================================
  // 9. 系統初始化執行
  // ==========================================
  buildLedBulbs();
  renderReelStrip();
  startLedAnimation(350, 'chase');
  updateHistoryUI();
  loadProductFileFromDirectory();

  if (!isSoundEnabled) {
    btnSoundToggle.classList.remove('active');
    soundIcon.textContent = '🔇';
  }
})();
