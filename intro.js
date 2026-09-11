/* ============================================================
 * model-hub / intro.js
 * 首屏引导：模块化 3D 叠卡
 * ★ 纯增强层，不改动 app.js 业务逻辑
 * ★ 首次访问自动弹出；之后可通过右下角「引导」按钮唤起
 * ============================================================ */
(function () {
  'use strict';

  var LS = 'modelhub.intro.v1';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var root, deck, cards = [], dots = [];
  var cur = 0, timer = null, paused = false, open = false;
  var AUTO = 3800;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 构建 DOM ---------- */
  function build() {
    if (typeof INTRO_MODULES === 'undefined' || !INTRO_MODULES.length) return false;

    var n = INTRO_MODULES.length;
    var cardHTML = INTRO_MODULES.map(function (m, i) {
      return '<div class="icard" data-idx="' + i + '" style="--ac:' + m.accent + '">' +
        '<div class="ic-glow"></div>' +
        '<div class="ic-top">' +
          '<span class="ic-ic">' + m.icon + '</span>' +
          '<span class="ic-tag">' + esc(m.tag) + '</span>' +
        '</div>' +
        '<div class="ic-title">' + esc(m.title) + '</div>' +
        '<div class="ic-desc">' + esc(m.desc) + '</div>' +
        '<div class="ic-foot">' +
          '<span class="ic-cta">' + esc(m.cta) + ' <i>→</i></span>' +
          '<span class="ic-num">' + ('0' + (i + 1)) + ' / ' + ('0' + n) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    var dotHTML = INTRO_MODULES.map(function (m, i) {
      return '<button class="dot" data-dot="' + i + '" aria-label="' + esc(m.title) + '"></button>';
    }).join('');

    root = document.createElement('div');
    root.className = 'intro';
    root.id = 'intro';
    root.innerHTML =
      '<div class="intro-veil"></div>' +
      '<canvas class="ion-intro" id="ionIntro" aria-hidden="true"></canvas>' +
      '<div class="intro-inner">' +
        '<div class="intro-head">' +
          '<div class="brand"><span class="mark">◆</span> 大模型接入指南</div>' +
          '<h2>先选一个入口</h2>' +
          '<p>六个模块，点正面那张卡直接进。不想看就跳过。</p>' +
        '</div>' +
        '<div class="deck" id="deck">' + cardHTML + '</div>' +
        '<div class="intro-ctl">' +
          '<button class="inav" id="iPrev" aria-label="上一张">‹</button>' +
          '<div class="dots" id="iDots">' + dotHTML + '</div>' +
          '<button class="inav" id="iNext" aria-label="下一张">›</button>' +
        '</div>' +
        '<button class="iskip" id="iSkip">跳过，直接进主页 →</button>' +
      '</div>';

    document.body.appendChild(root);
    deck = $('#deck', root);
    cards = $$('.icard', root);
    dots = $$('.dot', root);

    cards.forEach(function (el) {
      el.addEventListener('click', function () {
        var i = Number(el.dataset.idx);
        if (i === cur) go(INTRO_MODULES[i].tab);
        else setCur(i);
      });
    });
    dots.forEach(function (d) {
      d.addEventListener('click', function () { setCur(Number(d.dataset.dot)); });
    });
    $('#iPrev', root).addEventListener('click', function () { setCur(cur - 1); });
    $('#iNext', root).addEventListener('click', function () { setCur(cur + 1); });
    $('#iSkip', root).addEventListener('click', function () { close(); });

    /* 悬停暂停自动轮播 */
    deck.addEventListener('mouseenter', function () { paused = true; });
    deck.addEventListener('mouseleave', function () { paused = false; });

    /* 鼠标视差：整叠卡跟随指针做 3D 倾斜 */
    if (!reduce) {
      deck.addEventListener('mousemove', function (e) {
        var r = deck.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        deck.style.setProperty('--rx', (-py * 10).toFixed(2) + 'deg');
        deck.style.setProperty('--ry', (px * 14).toFixed(2) + 'deg');
      });
      deck.addEventListener('mouseleave', function () {
        deck.style.setProperty('--rx', '0deg');
        deck.style.setProperty('--ry', '0deg');
      });
    }
    return true;
  }

  /* ---------- 叠卡布局 ---------- */
  function layout() {
    var n = cards.length;
    cards.forEach(function (el, i) {
      var o = (i - cur + n) % n;
      if (o > Math.floor(n / 2)) o = o - n;   /* 远端折到另一侧，形成环形堆叠 */
      var a = Math.abs(o);
      var x = o * 58;
      var y = -a * 32;
      var z = -a * 130;
      var ry = -o * 12;
      var rz = o * 3.2;
      var sc = 1 - a * 0.055;
      var op = a === 0 ? 1 : Math.max(1 - a * 0.24, 0.22);
      el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,' + z + 'px) rotateY(' + ry +
        'deg) rotateZ(' + rz + 'deg) scale(' + sc + ')';
      el.style.zIndex = String(60 - a * 5);
      el.style.opacity = String(op);
      el.style.pointerEvents = a === 0 ? 'auto' : (a === 1 ? 'auto' : 'none');
      el.classList.toggle('front', a === 0);
      el.setAttribute('aria-hidden', a === 0 ? 'false' : 'true');
    });
    dots.forEach(function (d, i) { d.classList.toggle('on', i === cur); });
  }

  function setCur(i) {
    var n = cards.length;
    cur = ((i % n) + n) % n;
    layout();
    restart();
    /* 离子场跟着卡片换色，并在卡片位置炸一圈电离脉冲 */
    var m = INTRO_MODULES[cur];
    if (m) {
      if (window.ionsIntro) {
        window.ionsIntro.setTint(m.accent);
        var r = deck ? deck.getBoundingClientRect() : null;
        if (r) window.ionsIntro.pulse(r.left + r.width / 2, r.top + r.height / 2, 260, m.accent);
      }
      deck && deck.style.setProperty('--ac', m.accent);
    }
  }

  function restart() {
    if (timer) clearInterval(timer);
    if (reduce) return;
    timer = setInterval(function () { if (!paused && open) setCur(cur + 1); }, AUTO);
  }

  /* ---------- 打开 / 关闭 ---------- */
  function show() {
    if (!root && !build()) return;
    open = true;
    cur = 0;
    layout();
    root.classList.add('on');
    document.documentElement.classList.add('intro-lock');
    restart();
    /* 背景离子场让位给引导页的离子场（两个不同时跑） */
    if (window.ionsSwap) window.ionsSwap(true);
    if (window.ionsIntro && INTRO_MODULES[cur]) window.ionsIntro.setTint(INTRO_MODULES[cur].accent);
    var f = cards[cur]; if (f) f.focus && f.focus();
  }

  function close() {
    open = false;
    if (timer) clearInterval(timer);
    if (window.ionsSwap) window.ionsSwap(false);
    if (window.ionsIntro) window.ionsIntro.clearTint();
    if (!root) return;
    root.classList.remove('on');
    setTimeout(function () { root.style.display = 'none'; }, reduce ? 0 : 520);
    document.documentElement.classList.remove('intro-lock');
    try { localStorage.setItem(LS, '1'); } catch (e) { }
  }

  /* 点卡片 → 关引导 + 跳到对应模块 */
  function go(tab) {
    close();
    try { state.tab = tab; render(); } catch (e) { }
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ---------- 键盘 ---------- */
  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight') setCur(cur + 1);
    else if (e.key === 'ArrowLeft') setCur(cur - 1);
    else if (e.key === 'Enter') go(INTRO_MODULES[cur].tab);
  });

  /* ---------- 启动 ---------- */
  window.openIntro = function () {
    if (root) root.style.display = '';
    show();
  };

  document.addEventListener('DOMContentLoaded', function () {
    /* 面板打开时不弹引导 */
    var seen = false;
    try { seen = localStorage.getItem(LS) === '1'; } catch (e) { }
    if (!seen) setTimeout(show, 260);
  });
})();
