/**
 * app.js – Vua Tiếng Việt
 * Logic phía Client: WebSocket, DOM rendering, đếm ngược, âm thanh.
 */

// ============================================================
// STATE
// ============================================================
const state = {
  ws: null,
  roomId: '',
  clientId: '',
  playerName: '',
  gameState: 'LOBBY',

  // Vòng 1
  r1Questions: [],
  r1CurrentIndex: 0,
  r1Score: 0,
  r1Timer: null,
  r1TimeLeft: 90,
  r1TimerObj: null,

  // Vòng 2
  r2Timer: null,
  r2TimeLeft: 30,
  r2CurrentIndex: 0,
  r2TotalQuestions: 9,
  isBuzzLocked: false,
  isMyBuzz: false,
  r2TimerObj: null,

  // Vòng Đặc biệt
  r3Timer: null,
  r3TimeLeft: 15,
  r3Phase: 1,
  isSpectator: false,
  r3TimerObj: null,

  reconnectAttempts: 0,
  maxReconnect: 5,

  // Hệ thống hỗ trợ và phá hoại
  mySabotageCards: [],
  isFrozen: false,
  isDusted: false,
  usedLifelines: [],
  playersList: [],
};

// ============================================================
// AUDIO ENGINE (Web Audio API)
// ============================================================
const AudioEngine = (() => {
  let ctx = null;
  const get = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };
  const play = (freq, type, duration, gain = 0.3) => {
    try {
      const c = get();
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.connect(g);
      g.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      g.gain.setValueAtTime(gain, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration);
    } catch (_) {}
  };
  return {
    ding: () => { play(880, 'sine', 0.18); setTimeout(() => play(1100, 'sine', 0.18), 100); },
    wrong: () => { play(220, 'sawtooth', 0.4, 0.2); },
    buzz: () => { play(660, 'square', 0.15); },
    tick: () => { play(440, 'sine', 0.07, 0.1); },
    cheer: () => {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => play(f, 'sine', 0.3), i * 80));
    },
    reveal: () => { play(740, 'triangle', 0.25); },
    freeze: () => { play(150, 'sawtooth', 0.8, 0.25); play(300, 'sine', 0.5, 0.2); },
    dust: () => { play(180, 'sawtooth', 0.6, 0.25); }
  };
})();

// ============================================================
// DOM HELPERS
// ============================================================
const $ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  const el = $(id);
  if (el) {
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('active'));
  }
  
  // Quản lý hiển thị Emote Panel nổi
  const emotePanel = $('emote-panel');
  if (emotePanel) {
    if (['screen-round1', 'screen-round2', 'screen-special'].includes(id)) {
      emotePanel.classList.remove('hidden');
      updateEmoteDropdown();
    } else {
      emotePanel.classList.add('hidden');
    }
  }
}

function showToast(msg, type = 'info', duration = 3000) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => { t.classList.remove('show'); }, duration);
}

function showTransition(icon, text, ms = 2500) {
  const overlay = $('transition-overlay');
  $('transition-icon').textContent = icon;
  $('transition-text').textContent = text;
  overlay.classList.remove('hidden');
  return new Promise(r => setTimeout(() => {
    overlay.classList.add('hidden');
    r();
  }, ms));
}

function spawnConfetti(count = 50) {
  const container = $('confetti-container');
  const colors = ['#4a90e2', '#6bcb77', '#ffd93d', '#ff6b6b', '#a78bfa', '#ff9f43'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = '-20px';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.width = (Math.random() * 8 + 6) + 'px';
    el.style.height = (Math.random() * 8 + 6) + 'px';
    el.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
    el.style.animationDelay = Math.random() * 0.8 + 's';
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

function shakeElement(el) {
  el.classList.remove('shake');
  void el.offsetWidth; // reflow
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

// ============================================================
// TIMER UTILITIES
// ============================================================
function startTimer(timerEl, fillEl, timerObj, onTick, onEnd) {
  const updateUI = () => {
    timerEl.textContent = timerObj.left;
    const pct = (timerObj.left / timerObj.total) * 100;
    fillEl.style.width = pct + '%';
    if (pct <= 20) {
      fillEl.style.background = 'linear-gradient(90deg, #ff6b6b, #e04a4a)';
      timerEl.className = 'timer danger';
    } else if (pct <= 50) {
      fillEl.style.background = 'linear-gradient(90deg, #ffd93d, #f5c400)';
      timerEl.className = 'timer warning';
    } else {
      fillEl.style.background = 'linear-gradient(90deg, #6bcb77, #4a90e2)';
      timerEl.className = 'timer';
    }
    if (pct <= 30) AudioEngine.tick();
  };
  updateUI();
  const intervalId = setInterval(() => {
    timerObj.left--;
    if (onTick) onTick(timerObj.left);
    updateUI();
    if (timerObj.left <= 0) {
      clearInterval(intervalId);
      onEnd();
    }
  }, 1000);
  return intervalId;
}

// ============================================================
// LEADERBOARD RENDERERS
// ============================================================
function renderMiniLeaderboard(containerId, leaderboard) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = leaderboard.map(p => {
    const cls = p.is_eliminated ? 'eliminated' : p === leaderboard[0] ? 'leading' : '';
    return `<div class="mini-player ${cls}">
      ${p.is_eliminated ? '❌' : '⭐'} ${escHtml(p.name)}: ${p.score}
    </div>`;
  }).join('');
}

function renderFinalLeaderboard(leaderboard) {
  const medals = ['🥇', '🥈', '🥉'];
  const el = $('final-leaderboard');
  // Server already sorts by score desc – just render top-to-bottom as-is
  el.innerHTML = leaderboard.map((p, i) => {
    const rankClass = i < 3 ? `rank-${i + 1}` : '';
    const elimClass = p.is_eliminated ? 'eliminated' : '';
    return `<div class="lb-item ${rankClass} ${elimClass}">
      <span class="lb-rank">${medals[i] || (i + 1)}</span>
      <span class="lb-name">${escHtml(p.name)} ${p.is_eliminated ? '<small>(Đã loại)</small>' : ''}</span>
      <span class="lb-score">${p.score} điểm</span>
    </div>`;
  }).join('');
}

function renderHighScores(containerId, highScores) {
  const el = $(containerId);
  if (!el) return;
  if (!highScores || highScores.length === 0) {
    el.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem;">Chưa có kỷ lục nào được ghi nhận.</p>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  el.innerHTML = highScores.map((h, i) => `
    <div class="hs-item">
      <div class="hs-rank">${medals[i] || `#${i + 1}`}</div>
      <div class="hs-info">
        <span class="hs-name">${escHtml(h.name)}</span>
        <span class="hs-meta">${escHtml(h.title || 'Cao thủ')} • ${h.date}</span>
      </div>
      <div class="hs-score">${h.score} điểm</div>
    </div>
  `).join('');
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// WEBSOCKET
// ============================================================
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${protocol}://${location.host}/ws/${state.roomId}/${state.clientId}?name=${encodeURIComponent(state.playerName)}`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    state.reconnectAttempts = 0;
    showToast(`Đã kết nối vào phòng ${state.roomId}! 🎉`, 'success');
  };

  ws.onmessage = evt => {
    try {
      const msg = JSON.parse(evt.data);
      handleServerMessage(msg);
    } catch (e) {
      console.error('WebSocket parse error:', e);
    }
  };

  ws.onclose = () => {
    if (state.reconnectAttempts < state.maxReconnect) {
      state.reconnectAttempts++;
      showToast(`Mất kết nối. Đang kết nối lại... (${state.reconnectAttempts}/${state.maxReconnect})`, 'error');
      setTimeout(connectWebSocket, 2000);
    } else {
      showToast('Không thể kết nối lại. Vui lòng tải lại trang.', 'error', 8000);
    }
  };

  ws.onerror = () => ws.close();
  state.ws = ws;
}

function send(data) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(data));
  }
}

// ============================================================
// SERVER MESSAGE HANDLER
// ============================================================
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'LOBBY_UPDATE': onLobbyUpdate(msg); break;
    case 'GAME_START': onGameStart(msg); break;
    case 'SCORE_UPDATE': onScoreUpdate(msg); break;
    case 'ROUND_END': onRoundEnd(msg); break;
    case 'ROUND2_QUESTION': onRound2Question(msg); break;
    case 'BUZZ_LOCKED': onBuzzLocked(msg); break;
    case 'ROUND2_RESULT': onRound2Result(msg); break;
    case 'ROUND2_TIMEOUT': onRound2Timeout(msg); break;
    case 'SPECIAL_QUESTION': onSpecialQuestion(msg); break;
    case 'SPECIAL_PHASE2': onSpecialPhase2(msg); break;
    case 'SPECIAL_RESULT': onSpecialResult(msg); break;
    case 'SPECIAL_TIMEOUT': onSpecialTimeout(msg); break;
    case 'GAME_OVER': onGameOver(msg); break;
    case 'PLAYER_SURRENDERED': onPlayerSurrendered(msg); break;
    case 'SABOTAGE_CARD_RECEIVED': onSabotageCardReceived(msg); break;
    case 'SABOTAGE_TRIGGERED': onSabotageTriggered(msg); break;
    case 'SABOTAGE_EFFECT': onSabotageEffect(msg); break;
    case 'LIFELINE_RESULT': onLifelineResult(msg); break;
    case 'EMOTE_RECEIVED': onEmoteReceived(msg); break;
    case 'EMOTE_LOG': onEmoteLog(msg); break;
    default: console.log('Unknown msg:', msg);
  }
}

function onPlayerSurrendered(msg) {
  showToast(msg.message, 'warning', 4000);
  if (msg.player_id === state.clientId) {
    state.isSpectator = true;
    disableAllInputs(true);
  }
  if (msg.leaderboard) {
    if (state.gameState === 'ROUND_1') updateMiniLb('mini-lb-1', msg.leaderboard);
    else if (state.gameState === 'ROUND_2') updateMiniLb('mini-lb-2', msg.leaderboard);
  }
}

function confirmSurrender() {
  if (confirm("Bạn có chắc chắn muốn ĐẦU HÀNG ván đấu này không?")) {
    send({ action: "SURRENDER" });
    showToast("🏳️ Bạn đã xin đầu hàng!", "warning", 3000);
  }
}
window.confirmSurrender = confirmSurrender;

function confirmLeaveRoom() {
  if (confirm("Bạn có chắc chắn muốn THOÁT PHÒNG không?")) {
    if (state.ws) {
      send({ action: "LEAVE_ROOM" });
      try { state.ws.close(); } catch(e) {}
      state.ws = null;
    }
    showScreen('screen-lobby');
    $('join-form').classList.remove('hidden');
    $('lobby-waiting').classList.add('hidden');
    state.gameState = 'LOBBY';
    showToast("🚪 Đã rời khỏi phòng chơi.", "info", 2500);
  }
}
window.confirmLeaveRoom = confirmLeaveRoom;

async function loadLobbyHighScores() {
  try {
    const res = await fetch('/api/high-scores');
    if (res.ok) {
      const data = await res.json();
      renderHighScores('lobby-high-scores', data);
    }
  } catch (e) {
    console.error("Lỗi tải Bảng Vàng:", e);
  }
}

// ============================================================
// LOBBY HANDLERS
// ============================================================
function onLobbyUpdate(msg) {
  state.gameState = 'LOBBY';
  state.playersList = msg.players || [];
  const list = $('players-list');
  list.innerHTML = msg.players.map(p =>
    `<li>👤 ${escHtml(p.name)} ${p.id === state.clientId ? '<strong>(Bạn)</strong>' : ''}</li>`
  ).join('');
  if (msg.high_scores) renderHighScores('lobby-high-scores', msg.high_scores);
  if (msg.message) showToast(msg.message, 'info');
}

// ============================================================
// ROUND 1 HANDLERS
// ============================================================
function onGameStart(msg) {
  state.gameState = 'ROUND_1';
  state.r1Questions = msg.questions || [];
  state.r1CurrentIndex = 0;
  state.r1Score = 0;
  state.r1TimeLeft = msg.duration || 90;
  state.mySabotageCards = [];
  state.usedLifelines = [];

  // Reset các nút trợ giúp
  updateLifelineButtons();
  $('r1-scramble-hint').classList.add('hidden');
  $('r1-scramble-hint').textContent = '';
  renderSabotageDeck();

  showTransition('🔥', 'Vòng 1: Phản xạ!', 2000).then(() => {
    showScreen('screen-round1');
    $('r1-finished-msg').classList.add('hidden');
    $('r1-question-card').classList.remove('hidden');
    loadR1Question();

    // Bắt đầu đếm ngược Vòng 1
    state.r1TimerObj = { left: state.r1TimeLeft, total: state.r1TimeLeft };
    state.r1Timer = startTimer(
      $('timer1'), $('timer1-fill'),
      state.r1TimerObj,
      null,
      () => finishRound1()
    );
  });
}

function loadR1Question() {
  if (state.r1CurrentIndex >= state.r1Questions.length) {
    finishRound1();
    return;
  }
  const q = state.r1Questions[state.r1CurrentIndex];
  $('r1-q-num').textContent = state.r1CurrentIndex + 1;
  $('r1-question-text').textContent = q.question;
  $('r1-answer').value = '';
  $('r1-answer').focus();

  // Animation mượt khi chuyển câu
  const card = $('r1-question-card');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'slide-up 0.3s ease-out';
}

function submitR1Answer(skip = false, customAnswer = null) {
  if (state.gameState !== 'ROUND_1') return;
  const q = state.r1Questions[state.r1CurrentIndex];
  let is_correct = false;
  if (!skip) {
    const ans = customAnswer !== null ? customAnswer.trim().toLowerCase() : $('r1-answer').value.trim().toLowerCase();
    const correct = q.answer.trim().toLowerCase();
    if (ans === correct || (correct.includes('/') && correct.split('/').some(a => a.trim() === ans))) {
      state.r1Score++;
      is_correct = true;
      spawnConfetti(20);
      AudioEngine.ding();
    } else {
      shakeElement($('r1-question-card'));
      AudioEngine.wrong();
    }
  }
  // Gửi điểm và is_correct về server
  send({ action: 'ROUND1_SCORE', score: state.r1Score, is_correct: is_correct && !skip });
  state.r1CurrentIndex++;
  
  // Khôi phục giao diện nhập liệu nếu vừa chọn 50/50
  $('r1-choices-area').classList.add('hidden');
  $('r1-choices-area').innerHTML = '';
  $('r1-answer').classList.remove('hidden');
  $('btn-r1-submit').classList.remove('hidden');
  
  // Ẩn scramble hint khi qua câu khác
  $('r1-scramble-hint').classList.add('hidden');
  $('r1-scramble-hint').textContent = '';

  loadR1Question();
}

function finishRound1() {
  if (state.gameState !== 'ROUND_1') return;
  clearInterval(state.r1Timer);
  $('r1-question-card').classList.add('hidden');
  $('r1-finished-msg').classList.remove('hidden');
  $('r1-score-display').textContent = `🏅 Điểm của bạn: ${state.r1Score}`;
  send({ action: 'ROUND1_FINISH', score: state.r1Score });
}

function onScoreUpdate(msg) {
  if (msg.leaderboard) renderMiniLeaderboard('mini-lb-1', msg.leaderboard);
}

// ============================================================
// ROUND END HANDLER
// ============================================================
async function onRoundEnd(msg) {
  clearInterval(state.r1Timer);
  clearInterval(state.r2Timer);
  const elimMsg = msg.eliminated ? `❌ ${msg.eliminated} bị loại!` : '✅ Tất cả tiếp tục!';
  showToast(elimMsg, msg.eliminated ? 'error' : 'success', 3500);

  if (msg.leaderboard) {
    renderMiniLeaderboard('mini-lb-1', msg.leaderboard);
    renderMiniLeaderboard('mini-lb-2', msg.leaderboard);
  }
}

// ============================================================
// ROUND 2 HANDLERS
// ============================================================
function onRound2Question(msg) {
  if (state.gameState !== 'ROUND_2') {
    state.gameState = 'ROUND_2';
    showTransition('🔗', 'Vòng 2: Xâu chuỗi!', 2000).then(() => {
      showScreen('screen-round2');
      renderRound2Question(msg);
    });
  } else {
    renderRound2Question(msg);
  }
}

function renderRound2Question(msg) {
  clearInterval(state.r2Timer);
  state.r2TimeLeft = msg.duration || 30;
  state.isBuzzLocked = false;
  state.isMyBuzz = false;
  state.r2ShuffledWords = msg.shuffled_words || [];
  state.r2CorrectWords = msg.correct_words || [];  // server must send correct words order
  state.r2SelectedIndices = [];  // indices into r2ShuffledWords that have been placed

  if (msg.index === 1) {
    state.mySabotageCards = [];
    state.usedLifelines = [];
    updateLifelineButtons();
  }
  renderSabotageDeck();

  $('r2-q-num').textContent = msg.index;
  $('r2-answer-area').classList.add('hidden');
  $('r2-buzz-area').classList.remove('hidden');
  $('buzz-status').textContent = '';

  const buzzBtn = $('btn-buzz');
  buzzBtn.disabled = false;
  buzzBtn.style.animation = '';

  // Render scrambled word chips (pool)
  renderR2Pool();

  $('r2-result').classList.add('hidden');
  // Clear selected chips area
  $('r2-selected-chips').innerHTML = '';
  $('btn-r2-submit').disabled = true;

  // Timer Vòng 2
  state.r2TimerObj = { left: state.r2TimeLeft, total: 30 };
  state.r2Timer = startTimer(
    $('timer2'), $('timer2-fill'),
    state.r2TimerObj,
    null,
    () => send({ action: 'ROUND2_TIMEOUT' })
  );
}

function renderR2Pool() {
  const chips = $('r2-word-chips');
  chips.innerHTML = state.r2ShuffledWords.map((w, i) => {
    const isUsed = state.r2SelectedIndices.includes(i);
    return `<div class="word-chip ${isUsed ? 'used' : ''}" data-idx="${i}" onclick="r2PoolChipClick(${i})">${escHtml(w)}</div>`;
  }).join('');
}

function renderR2Selected() {
  const container = $('r2-selected-chips');
  container.innerHTML = state.r2SelectedIndices.map((poolIdx, pos) => {
    const word = state.r2ShuffledWords[poolIdx];
    return `<div class="word-chip-selected" data-pos="${pos}" onclick="r2SelectedChipClick(${pos})">${escHtml(word)} <small>✕</small></div>`;
  }).join('');
  // Enable submit only when all words placed
  $('btn-r2-submit').disabled = state.r2SelectedIndices.length !== state.r2ShuffledWords.length;
}

window.r2PoolChipClick = (poolIdx) => {
  if (!state.isMyBuzz || state.isFrozen) return;
  if (state.r2SelectedIndices.includes(poolIdx)) return; // already used
  state.r2SelectedIndices.push(poolIdx);
  renderR2Pool();
  renderR2Selected();
};

window.r2SelectedChipClick = (pos) => {
  if (!state.isMyBuzz || state.isFrozen) return;
  state.r2SelectedIndices.splice(pos, 1);
  renderR2Pool();
  renderR2Selected();
};

function onBuzzLocked(msg) {
  AudioEngine.buzz();
  state.isBuzzLocked = true;
  const buzzBtn = $('btn-buzz');
  buzzBtn.disabled = true;

  if (msg.by_id === state.clientId) {
    // Mình bấm được chuông
    state.isMyBuzz = true;
    $('buzz-status').textContent = `🔔 Bạn giành được quyền trả lời!`;
    $('r2-buzz-area').classList.add('hidden');
    $('r2-answer-area').classList.remove('hidden');
    // Reset chip selection on each new buzz
    state.r2SelectedIndices = [];
    renderR2Pool();
    renderR2Selected();
  } else {
    $('buzz-status').textContent = `🔔 ${escHtml(msg.by_name)} đang trả lời...`;
  }
}

function onRound2Result(msg) {
  const result = $('r2-result');
  result.classList.remove('hidden', 'correct', 'wrong');

  if (msg.correct) {
    result.textContent = `✅ ${escHtml(msg.by_name)} trả lời ĐÚNG! Đáp án: "${msg.correct_answer}"`;
    result.classList.add('correct');
    spawnConfetti(30);
    AudioEngine.cheer();
    if (msg.leaderboard) renderMiniLeaderboard('mini-lb-2', msg.leaderboard);
  } else {
    result.textContent = `❌ ${escHtml(msg.by_name)} trả lời SAI! Người khác có thể bấm chuông.`;
    result.classList.add('wrong');
    AudioEngine.wrong();
    // Reset this player's chip selection
    state.r2SelectedIndices = [];
    state.isMyBuzz = false;
    $('r2-answer-area').classList.add('hidden');
    $('r2-buzz-area').classList.remove('hidden');
    if (msg.by_id !== state.clientId) {
      const buzzBtn = $('btn-buzz');
      buzzBtn.disabled = false;
      state.isBuzzLocked = false;
      $('buzz-status').textContent = 'Bấm chuông để trả lời!';
    }
  }
}

function onRound2Timeout(msg) {
  clearInterval(state.r2Timer);
  const result = $('r2-result');
  result.classList.remove('hidden', 'correct', 'wrong');
  result.textContent = `⏰ Hết giờ! Đáp án: "${msg.correct_answer}"`;
  result.classList.add('wrong');
}

// ============================================================
// SPECIAL ROUND HANDLERS
// ============================================================
function onSpecialQuestion(msg) {
  clearInterval(state.r3Timer);

  const isActive = !msg.active_players || msg.active_players.includes(state.clientId);
  state.isSpectator = !isActive;

  if (state.gameState !== 'SPECIAL_ROUND') {
    state.gameState = 'SPECIAL_ROUND';
    showTransition('⭐', 'Vòng Đặc biệt: Soán Ngôi!', 2000).then(() => {
      showScreen('screen-special');
      renderSpecialQuestion(msg);
    });
  } else {
    renderSpecialQuestion(msg);
  }
}

function renderSpecialQuestion(msg) {
  state.r3Phase = 1;
  state.r3TimeLeft = msg.duration || 15;

  if (msg.index === 1) {
    state.mySabotageCards = [];
    state.usedLifelines = [];
    updateLifelineButtons();
  }

  $('special-clue').textContent = msg.clue;
  $('special-phase-badge').textContent = 'Giai đoạn 1 – Đúng nhận 100%';
  $('special-answer').value = '';

  // Reset 50/50 area & restore standard inputs
  $('special-choices-area').classList.add('hidden');
  $('special-choices-area').innerHTML = '';
  $('special-answer').classList.remove('hidden');
  $('btn-special-submit').classList.remove('hidden');

  // Ẩn/hiện khu vực trả lời
  if (state.isSpectator) {
    $('special-answer-area').classList.add('hidden');
    $('special-spectator-msg').classList.remove('hidden');
  } else {
    $('special-answer-area').classList.remove('hidden');
    $('special-spectator-msg').classList.add('hidden');
    $('special-answer').focus();
  }

  // Render crossword (ô chữ trống)
  const grid = $('special-crossword');
  grid.innerHTML = '';
  for (let i = 0; i < msg.length; i++) {
    const cell = document.createElement('div');
    cell.className = 'crossword-cell hidden-cell';
    cell.id = `cell-${i}`;
    cell.textContent = '_';
    grid.appendChild(cell);
  }

  // Đếm ngược
  state.r3TimerObj = { left: state.r3TimeLeft, total: 15 };
  state.r3Timer = startTimer(
    $('timer3'), $('timer3-fill'),
    state.r3TimerObj,
    null,
    () => {
      if (state.r3Phase === 1) {
        send({ action: 'SPECIAL_PHASE2' });
      } else {
        send({ action: 'SPECIAL_TIMEOUT' });
      }
    }
  );
}

function onSpecialPhase2(msg) {
  clearInterval(state.r3Timer);
  state.r3Phase = 2;
  state.r3TimeLeft = 15;

  $('special-clue').textContent = msg.clue;
  $('special-phase-badge').textContent = 'Giai đoạn 2 – Đúng nhận 50%';

  // Tiết lộ ô chữ
  const cell = $(`cell-${msg.reveal_index}`);
  if (cell) {
    cell.textContent = msg.reveal_char;
    cell.className = 'crossword-cell revealed';
    AudioEngine.reveal();
  }

  if (!state.isSpectator) $('special-answer').focus();

  state.r3TimerObj = { left: 15, total: 15 };
  state.r3Timer = startTimer(
    $('timer3'), $('timer3-fill'),
    state.r3TimerObj,
    null,
    () => send({ action: 'SPECIAL_TIMEOUT' })
  );
}

function onSpecialResult(msg) {
  if (msg.correct) {
    showToast(`🎉 ${escHtml(msg.by_name)} đúng rồi! +${msg.reward} điểm`, 'success', 3000);
    spawnConfetti(60);
    AudioEngine.cheer();
    if (msg.leaderboard) renderFinalLeaderboard(msg.leaderboard);
  } else {
    showToast('❌ Sai rồi! Hãy thử lại...', 'error');
    if (!state.isSpectator) {
      shakeElement($('special-answer'));
      AudioEngine.wrong();
    }
  }
}

function onSpecialTimeout(msg) {
  clearInterval(state.r3Timer);
  showToast(`⏰ Hết giờ! Từ khóa là: ${msg.keyword}`, 'error', 3000);
}

// ============================================================
// GAME OVER
// ============================================================
function onGameOver(msg) {
  clearInterval(state.r1Timer);
  clearInterval(state.r2Timer);
  clearInterval(state.r3Timer);
  state.gameState = 'GAME_OVER';

  showTransition('🏆', 'Kết thúc!', 1800).then(() => {
    showScreen('screen-gameover');
    renderFinalLeaderboard(msg.leaderboard || []);
    if (msg.high_scores) renderHighScores('gameover-high-scores', msg.high_scores);
    
    const badge = $('new-record-badge');
    if (badge) {
      if (msg.new_record) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }

    spawnConfetti(80);
    AudioEngine.cheer();
    if (msg.message) {
      showToast(msg.message, 'success', 5000);
    }
  });
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// ============================================================
// LIFELINES & SABOTAGE ACTIONS
// ============================================================
function onSabotageCardReceived(msg) {
  state.mySabotageCards = state.mySabotageCards || [];
  state.mySabotageCards.push(msg.card);
  showToast(msg.message, 'success', 4000);
  renderSabotageDeck();
}

function onSabotageTriggered(msg) {
  if (msg.card === "ADD_TIME") {
    showToast(`⏰ ${msg.from_name} sử dụng Thẻ Cộng 5 giây!`, 'info', 3000);
    if (msg.target_id === state.clientId) {
      adjustTimer(5);
    }
  } else {
    showToast(`🎒 ${msg.from_name} sử dụng [${msg.card}] phá hoại ${msg.target_name}!`, 'error', 4000);
  }
}

function onSabotageEffect(msg) {
  if (msg.card === "FREEZE") {
    state.isFrozen = true;
    AudioEngine.freeze();
    const overlay = $('freeze-overlay');
    overlay.classList.remove('hidden');
    disableAllInputs(true);
    
    setTimeout(() => {
      state.isFrozen = false;
      overlay.classList.add('hidden');
      disableAllInputs(false);
    }, msg.duration * 1000);
  } else if (msg.card === "TIME_THIEF") {
    adjustTimer(msg.change);
    showToast(`⏰ Bạn bị hút mất 10 giây!`, 'error', 3500);
  } else if (msg.card === "TIME_THIEF_BENEFIT") {
    adjustTimer(msg.change);
    showToast(`⏰ Bạn được cộng 5 giây thời gian!`, 'success', 3500);
  } else if (msg.card === "CHALK_DUST") {
    state.isDusted = true;
    AudioEngine.dust();
    setupChalkDustOverlay(msg.duration);
  }
}

const LIFELINE_LIMITS = {
  "50_50": 7,
  "PEEK": 3,
  "SCRAMBLE": 3,
  "FIRST_WORD": 3,
  "LAST_WORD": 3,
  "REVEAL_PAIR": 3,
  "VERIFY_PROGRESS": 3,
  "SKIP_QUESTION": 3,
  "PEEK_SPECIAL": 3,
  "50_50_SPECIAL": 3
};

function getLifelineCount(type) {
  return state.usedLifelines ? state.usedLifelines.filter(t => t === type).length : 0;
}

function updateLifelineButtons() {
  const checkAndUpdate = (btnId, type, label, icon) => {
    const btn = $(btnId);
    if (!btn) return;
    const maxUses = LIFELINE_LIMITS[type] || 3;
    const count = getLifelineCount(type);
    const remaining = Math.max(0, maxUses - count);
    btn.innerHTML = `${icon} ${label} <span style="font-size:0.75em; opacity:0.85; margin-left:2px;">(${remaining}/${maxUses})</span>`;
    btn.disabled = remaining <= 0;
  };

  checkAndUpdate("btn-r1-peek", "PEEK", "Hé lộ chữ", "🔍");
  checkAndUpdate("btn-r1-scramble", "SCRAMBLE", "Đảo chữ", "🧩");
  checkAndUpdate("btn-r1-5050", "50_50", "Chọn 1 trong 2", "⚖️");

  checkAndUpdate("btn-r2-firstword", "FIRST_WORD", "Từ đầu", "💡");
  checkAndUpdate("btn-r2-lastword", "LAST_WORD", "Từ cuối", "💡");
  checkAndUpdate("btn-r2-pair", "REVEAL_PAIR", "Cặp từ", "🔗");
  checkAndUpdate("btn-r2-verify", "VERIFY_PROGRESS", "Kiểm tra", "✅");
  checkAndUpdate("btn-r2-skip", "SKIP_QUESTION", "Đổi câu", "🔄");

  checkAndUpdate("btn-special-peek", "PEEK_SPECIAL", "Hé lộ 1 chữ", "🔍");
  checkAndUpdate("btn-special-5050", "50_50_SPECIAL", "Chọn 1 trong 2", "⚖️");
}

function onLifelineResult(msg) {
  if (msg.lifeline === "PEEK") {
    $('r1-question-text').innerHTML = `${state.r1Questions[msg.question_index].question}<br><span style="color:var(--primary); font-family:monospace; font-size:1.3rem; letter-spacing:0.1em; display:block; margin-top:8px;">Gợi ý: ${msg.data}</span>`;
    state.usedLifelines.push("PEEK");
    updateLifelineButtons();
    AudioEngine.reveal();
  } else if (msg.lifeline === "SCRAMBLE") {
    const scrambleHint = $('r1-scramble-hint');
    scrambleHint.classList.remove('hidden');
    scrambleHint.innerHTML = `🔠 Ký tự đảo lộn: ` + msg.data.map(l => `<span style="display:inline-block; background:var(--primary-light); border:1.5px solid var(--primary); padding:2px 8px; border-radius:4px; margin:0 3px; font-weight:800; font-family:monospace;">${l}</span>`).join('');
    state.usedLifelines.push("SCRAMBLE");
    updateLifelineButtons();
    AudioEngine.reveal();
  } else if (msg.lifeline === "50_50") {
    const area = $('r1-choices-area');
    area.classList.remove('hidden');
    area.innerHTML = msg.data.map(opt => {
      const escapedOpt = opt.replace(/'/g, "\\'");
      return `<button class="choice-btn" type="button" onclick="submitR1Answer(false, '${escHtml(escapedOpt)}')">${escHtml(opt)}</button>`;
    }).join('');
    
    $('r1-answer').classList.add('hidden');
    $('btn-r1-submit').classList.add('hidden');
    
    state.usedLifelines.push("50_50");
    updateLifelineButtons();
    AudioEngine.reveal();
  } else if (msg.lifeline === "FIRST_WORD") {
    const firstWord = msg.data;
    const poolIdx = state.r2ShuffledWords.indexOf(firstWord);
    if (poolIdx !== -1 && !state.r2SelectedIndices.includes(poolIdx)) {
      state.r2SelectedIndices.unshift(poolIdx);
      renderR2Pool();
      renderR2Selected();
      const chipEls = $('r2-selected-chips').querySelectorAll('.word-chip-selected');
      if (chipEls[0]) chipEls[0].classList.add('locked');
    }
    state.usedLifelines.push("FIRST_WORD");
    updateLifelineButtons();
    showToast(`💡 Từ đầu tiên: "${firstWord}"`, 'info', 2500);
    AudioEngine.reveal();
  } else if (msg.lifeline === "LAST_WORD") {
    const lastWord = msg.data;
    const lastIdx = state.r2ShuffledWords.lastIndexOf(lastWord);
    if (lastIdx !== -1 && !state.r2SelectedIndices.includes(lastIdx)) {
      state.r2SelectedIndices.push(lastIdx);
      renderR2Pool();
      renderR2Selected();
    }
    state.usedLifelines.push("LAST_WORD");
    updateLifelineButtons();
    showToast(`💡 Từ cuối cùng: "${lastWord}"`, 'info', 2500);
    AudioEngine.reveal();
  } else if (msg.lifeline === "REVEAL_PAIR") {
    showToast(`🔗 Gợi ý cặp từ liền kề: "${msg.data[0]}" → "${msg.data[1]}"`, 'info', 5000);
    state.usedLifelines.push("REVEAL_PAIR");
    updateLifelineButtons();
    AudioEngine.reveal();
  } else if (msg.lifeline === "VERIFY_PROGRESS") {
    const chips = $('r2-selected-chips').querySelectorAll('.word-chip-selected');
    msg.data.forEach((isCorrect, i) => {
      if (chips[i]) {
        chips[i].classList.remove('correct-pos', 'wrong-pos');
        chips[i].classList.add(isCorrect ? 'correct-pos' : 'wrong-pos');
      }
    });
    state.usedLifelines.push("VERIFY_PROGRESS");
    updateLifelineButtons();
    AudioEngine.reveal();
  } else if (msg.lifeline === "SKIP_QUESTION") {
    state.usedLifelines.push("SKIP_QUESTION");
    updateLifelineButtons();
    showToast('🔄 Đã đổi sang câu hỏi mới!', 'success', 2000);
    AudioEngine.reveal();
  } else if (msg.lifeline === "PEEK_SPECIAL") {
    const cell = $(`cell-${msg.reveal_index}`);
    if (cell) {
      cell.textContent = msg.reveal_char;
      cell.className = 'crossword-cell revealed';
    }
    state.usedLifelines.push("PEEK_SPECIAL");
    updateLifelineButtons();
    AudioEngine.reveal();
  } else if (msg.lifeline === "50_50_SPECIAL") {
    const area = $('special-choices-area');
    area.classList.remove('hidden');
    area.innerHTML = msg.data.map(opt => {
      const escapedOpt = opt.replace(/'/g, "\\'");
      return `<button class="choice-btn" type="button" onclick="submitSpecialChoice('${escHtml(escapedOpt)}')">${escHtml(opt)}</button>`;
    }).join('');
    
    $('special-answer').classList.add('hidden');
    $('btn-special-submit').classList.add('hidden');
    
    state.usedLifelines.push("50_50_SPECIAL");
    updateLifelineButtons();
    AudioEngine.reveal();
  }
}

function disableAllInputs(disabled) {
  $('r1-answer').disabled = disabled;
  $('r2-answer').disabled = disabled;
  $('special-answer').disabled = disabled;
  $('btn-r1-submit').disabled = disabled;
  $('btn-r2-submit').disabled = disabled;
  $('btn-special-submit').disabled = disabled;
  $('btn-r1-skip').disabled = disabled;
}

function disableLifelineButton(id) {
  const el = $(id);
  if (el) el.disabled = true;
}

function enableLifelineButton(id) {
  const el = $(id);
  if (el) el.disabled = false;
}
  $('r2-answer').disabled = disabled;
  $('special-answer').disabled = disabled;
  $('btn-r1-submit').disabled = disabled;
  $('btn-r2-submit').disabled = disabled;
  $('btn-special-submit').disabled = disabled;
  $('btn-r1-skip').disabled = disabled;
}

function disableLifelineButton(id) {
  const el = $(id);
  if (el) el.disabled = true;
}

function enableLifelineButton(id) {
  const el = $(id);
  if (el) el.disabled = false;
}

function adjustTimer(change) {
  if (state.gameState === 'ROUND_1' && state.r1TimerObj) {
    state.r1TimerObj.left = Math.max(1, state.r1TimerObj.left + change);
  } else if (state.gameState === 'ROUND_2' && state.r2TimerObj) {
    state.r2TimerObj.left = Math.max(1, state.r2TimerObj.left + change);
  }
}

function setupChalkDustOverlay(duration) {
  const overlay = $('chalk-dust-overlay');
  const canvas = $('chalk-canvas');
  overlay.classList.remove('hidden');

  const ctx = canvas.getContext('2d');
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    ctx.fillStyle = 'rgba(230, 230, 230, 0.96)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 80 + 40, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  let clearedAmount = 0;
  const brushRadius = 55;

  const erase = (x, y) => {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
    ctx.fill();
    
    clearedAmount++;
    if (clearedAmount > 120) {
      clearOverlay();
    }
  };

  const clearOverlay = () => {
    state.isDusted = false;
    overlay.classList.add('hidden');
    window.removeEventListener('resize', resizeCanvas);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('touchmove', onTouchMove);
  };

  const onMouseMove = e => {
    erase(e.clientX, e.clientY);
  };
  
  const onTouchMove = e => {
    if (e.touches[0]) {
      erase(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });

  setTimeout(() => {
    if (state.isDusted) clearOverlay();
  }, duration * 1000);
}

function renderSabotageDeck() {
  const containerId = state.gameState === 'ROUND_1' ? 'r1-cards-list' : 'r2-cards-list';
  const container = $(containerId);
  if (!container) return;

  const cards = state.mySabotageCards || [];
  if (cards.length === 0) {
    container.innerHTML = `<p style="color:var(--text-light); font-style:italic; font-size:0.9rem;">Chưa có thẻ nào. Đạt chuỗi trả lời đúng để nhận!</p>`;
    return;
  }

  const otherPlayers = (state.playersList || []).filter(p => p.id !== state.clientId);

  container.innerHTML = cards.map((card, cardIndex) => {
    let title = '';
    let cls = '';
    let actionsHtml = '';

    if (card === "FREEZE") {
      title = "❄️ Đóng Băng (5s)";
      cls = "card-freeze";
      actionsHtml = otherPlayers.map(p => 
        `<button class="btn-target" onclick="useSabotage(${cardIndex}, '${p.id}')">Phá ${escHtml(p.name)}</button>`
      ).join('');
    } else if (card === "TIME_THIEF") {
      title = "⏰ Trộm Giây (-10s)";
      cls = "card-time";
      actionsHtml = otherPlayers.map(p => 
        `<button class="btn-target" onclick="useSabotage(${cardIndex}, '${p.id}')">Hút ${escHtml(p.name)}</button>`
      ).join('');
    } else if (card === "CHALK_DUST") {
      title = "💨 Tung Phấn (7s)";
      cls = "card-dust";
      actionsHtml = otherPlayers.map(p => 
        `<button class="btn-target" onclick="useSabotage(${cardIndex}, '${p.id}')">Tung ${escHtml(p.name)}</button>`
      ).join('');
    } else if (card === "ADD_TIME") {
      title = "⏰ Cộng 5 Giây";
      cls = "card-time";
      actionsHtml = `<button class="btn-target" onclick="useSabotage(${cardIndex}, '${state.clientId}')">⚡ Kích hoạt</button>`;
    }

    if (otherPlayers.length === 0 && card !== "ADD_TIME") {
      actionsHtml = `<span style="font-size:0.75rem; color:var(--text-light);">Cần đối thủ để dùng</span>`;
    }

    return `
      <div class="sabotage-card ${cls}">
        <div class="card-title">${title}</div>
        <div class="card-targets">${actionsHtml}</div>
      </div>
    `;
  }).join('');
}

window.useSabotage = (cardIndex, targetId) => {
  const card = state.mySabotageCards[cardIndex];
  if (!card) return;

  send({
    action: "USE_SABOTAGE",
    card: card,
    target_id: targetId
  });

  state.mySabotageCards.splice(cardIndex, 1);
  renderSabotageDeck();
};

// ============================================================
// EVENT LISTENERS
// ============================================================

// --- Join form ---
$('join-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('input-name').value.trim();
  const room = $('input-room').value.trim().toUpperCase();
  if (!name || !room) return;

  state.playerName = name;
  state.roomId = room;
  state.clientId = 'user_' + Math.random().toString(36).substring(2, 9);

  $('join-form').classList.add('hidden');
  $('lobby-waiting').classList.remove('hidden');
  $('room-label').textContent = room;

  connectWebSocket();
});

// --- Start game ---
$('btn-start').addEventListener('click', () => {
  send({ action: 'START_GAME' });
});

// --- Round 1 Submit ---
$('btn-r1-submit').addEventListener('click', () => submitR1Answer(false));
$('r1-answer').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitR1Answer(false);
});

// --- Round 1 Skip ---
$('btn-r1-skip').addEventListener('click', () => submitR1Answer(true));


// --- Round 1 Lifelines ---
$('btn-r1-peek').addEventListener('click', () => {
  if (getLifelineCount("PEEK") < (LIFELINE_LIMITS["PEEK"] || 3)) {
    send({
      action: "USE_LIFELINE",
      type: "PEEK",
      extra: { question_index: state.r1CurrentIndex }
    });
  }
});
$('btn-r1-scramble').addEventListener('click', () => {
  if (getLifelineCount("SCRAMBLE") < (LIFELINE_LIMITS["SCRAMBLE"] || 3)) {
    send({
      action: "USE_LIFELINE",
      type: "SCRAMBLE",
      extra: { question_index: state.r1CurrentIndex }
    });
  }
});
$('btn-r1-5050').addEventListener('click', () => {
  if (getLifelineCount("50_50") < (LIFELINE_LIMITS["50_50"] || 7)) {
    send({
      action: "USE_LIFELINE",
      type: "50_50",
      extra: { question_index: state.r1CurrentIndex }
    });
  }
});

// --- Round 2 Buzz ---
$('btn-buzz').addEventListener('click', () => {
  if (!state.isBuzzLocked && !state.isFrozen) send({ action: 'BUZZ' });
});

// --- Round 2 Submit (chips) ---
$('btn-r2-submit').addEventListener('click', () => {
  if (!state.isMyBuzz || state.isFrozen) return;
  const answer = state.r2SelectedIndices.map(i => state.r2ShuffledWords[i]).join(' ');
  if (answer.trim()) send({ action: 'ROUND2_ANSWER', answer: answer });
});

// --- Round 2 Reset chips ---
$('btn-r2-reset').addEventListener('click', () => {
  state.r2SelectedIndices = [];
  renderR2Pool();
  renderR2Selected();
});

// --- Round 2 Lifelines (5 new) ---
$('btn-r2-firstword').addEventListener('click', () => {
  if (state.isMyBuzz && getLifelineCount("FIRST_WORD") < (LIFELINE_LIMITS["FIRST_WORD"] || 3)) {
    send({ action: "USE_LIFELINE", type: "FIRST_WORD" });
  }
});
$('btn-r2-lastword').addEventListener('click', () => {
  if (state.isMyBuzz && getLifelineCount("LAST_WORD") < (LIFELINE_LIMITS["LAST_WORD"] || 3)) {
    send({ action: "USE_LIFELINE", type: "LAST_WORD" });
  }
});
$('btn-r2-pair').addEventListener('click', () => {
  if (state.isMyBuzz && getLifelineCount("REVEAL_PAIR") < (LIFELINE_LIMITS["REVEAL_PAIR"] || 3)) {
    send({ action: "USE_LIFELINE", type: "REVEAL_PAIR" });
  }
});
$('btn-r2-verify').addEventListener('click', () => {
  if (state.isMyBuzz && getLifelineCount("VERIFY_PROGRESS") < (LIFELINE_LIMITS["VERIFY_PROGRESS"] || 3)) {
    const current = state.r2SelectedIndices.map(i => state.r2ShuffledWords[i]);
    send({ action: "USE_LIFELINE", type: "VERIFY_PROGRESS", extra: { current_words: current } });
  }
});
$('btn-r2-skip').addEventListener('click', () => {
  if (state.isMyBuzz && getLifelineCount("SKIP_QUESTION") < (LIFELINE_LIMITS["SKIP_QUESTION"] || 3)) {
    send({ action: "USE_LIFELINE", type: "SKIP_QUESTION" });
  }
});

// --- Special Round Answer ---
$('btn-special-submit').addEventListener('click', () => {
  const ans = $('special-answer').value.trim();
  if (ans && !state.isSpectator && !state.isFrozen) send({ action: 'SPECIAL_ANSWER', answer: ans });
});
$('special-answer').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const ans = $('special-answer').value.trim();
    if (ans && !state.isSpectator && !state.isFrozen) send({ action: 'SPECIAL_ANSWER', answer: ans });
  }
});

// --- Special Round Lifeline ---
$('btn-special-peek').addEventListener('click', () => {
  if (!state.isSpectator && getLifelineCount("PEEK_SPECIAL") < (LIFELINE_LIMITS["PEEK_SPECIAL"] || 3)) {
    send({
      action: "USE_LIFELINE",
      type: "PEEK_SPECIAL"
    });
  }
});
$('btn-special-5050').addEventListener('click', () => {
  if (!state.isSpectator && getLifelineCount("50_50_SPECIAL") < (LIFELINE_LIMITS["50_50_SPECIAL"] || 3)) {
    send({
      action: "USE_LIFELINE",
      type: "50_50_SPECIAL"
    });
  }
});

// --- Restart ---
$('btn-restart').addEventListener('click', () => {
  send({ action: 'RESTART' });
  showScreen('screen-lobby');
  $('join-form').classList.remove('hidden');
  $('lobby-waiting').classList.add('hidden');
  state.gameState = 'LOBBY';
});

// ============================================================
// EMOTES & INTERACTIVE HELPERS
// ============================================================
state.emoteAmmo = 20;
state.emoteCooldown = false;

window.triggerSendEmote = (emote) => {
  if (state.emoteCooldown) return;
  const dropdown = $('emote-target-dropdown');
  const targetId = dropdown.value;
  if (!targetId) {
    showToast('⚠️ Vui lòng chọn đối thủ để trêu!', 'warning');
    return;
  }

  const selectedOpt = dropdown.options[dropdown.selectedIndex];
  const targetName = selectedOpt ? selectedOpt.text.replace(/^👤\s*/, '') : 'đối thủ';

  state.emoteAmmo--;
  $('emote-ammo').textContent = `${state.emoteAmmo}/20`;

  send({
    action: "SEND_EMOTE",
    emote: emote,
    target_id: targetId
  });

  // Hiển thị thông báo xác nhận gửi thành công cho đối phương
  showToast(`🎉 Đã gửi biểu cảm ${emote} tới ${targetName}!`, 'success', 2200);

  if (state.emoteAmmo <= 0) {
    startEmoteCooldown();
  }
};

function startEmoteCooldown() {
  state.emoteCooldown = true;
  const overlay = $('emote-cooldown-overlay');
  overlay.classList.remove('hidden');
  
  let left = 30;
  overlay.querySelector('span').textContent = `⏳ Hồi chiêu: ${left}s`;
  
  const interval = setInterval(() => {
    left--;
    overlay.querySelector('span').textContent = `⏳ Hồi chiêu: ${left}s`;
    if (left <= 0) {
      clearInterval(interval);
      state.emoteAmmo = 20;
      $('emote-ammo').textContent = `20/20`;
      state.emoteCooldown = false;
      overlay.classList.add('hidden');
    }
  }, 1000);
}

function onEmoteReceived(msg) {
  spawnFloatingEmote(msg.emote, msg.from_name);
}

function onEmoteLog(msg) {
  console.log(`${msg.from_name} ném ${msg.emote} vào ${msg.to_name}`);
}

function spawnFloatingEmote(emote, fromName) {
  // Create a full-screen centered overlay popup
  const overlay = document.createElement('div');
  overlay.className = 'emote-center-popup';
  overlay.innerHTML = `
    <div class="emote-popup-inner">
      <div class="emote-popup-icon">${emote}</div>
      <div class="emote-popup-label">${escHtml(fromName)} đã ném vào bạn!</div>
    </div>`;
  document.body.appendChild(overlay);

  // Phát tiếng popping
  AudioEngine.ding();

  // Tự xóa sau 2 giây
  setTimeout(() => overlay.remove(), 2200);
}

function updateEmoteDropdown() {
  const dropdown = $('emote-target-dropdown');
  if (!dropdown) return;
  
  const currentVal = dropdown.value;
  const otherPlayers = (state.playersList || []).filter(p => p.id !== state.clientId);
  
  dropdown.innerHTML = '<option value="">-- Chọn đối thủ --</option>' + 
    otherPlayers.map(p => `<option value="${p.id}">👤 ${escHtml(p.name)}</option>`).join('');
    
  if (otherPlayers.some(p => p.id === currentVal)) {
    dropdown.value = currentVal;
  }
}

window.submitSpecialChoice = (choice) => {
  send({ action: 'SPECIAL_ANSWER', answer: choice });
  $('special-choices-area').classList.add('hidden');
  $('special-choices-area').innerHTML = '';
  $('special-answer').classList.remove('hidden');
  $('btn-special-submit').classList.remove('hidden');
};

// ============================================================
// INIT
// ============================================================
showScreen('screen-lobby');
loadLobbyHighScores();
