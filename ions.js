/* ============================================================
 * model-hub / ions.js
 * 离子场 Ion Field —— Canvas 2D 等离子体背景
 *
 * 视觉概念：把「模型」当作带电离子，把「接入」当作离子间的放电连线。
 * 冷等离子（蓝/青/紫）为主，偶尔一颗高能琥珀离子；光标是一个电离核，
 * 靠近的离子被点亮并被轻微吸引；每隔几秒有一圈电离脉冲环扩散。
 *
 * 性能做法（参考社区最佳实践）：
 *   1. 光斑用离屏 Canvas 预渲染成精灵，每帧只 drawImage，不重建渐变
 *   2. 邻近查询用空间网格分桶，把 O(n²) 降到近似 O(n)
 *   3. 连线按透明度分桶，一桶一次 stroke，减少状态切换
 *   4. DPR 上限 2；页面隐藏 / 引导打开时暂停；reduce 下只画一帧静态
 * ============================================================ */
(function () {
  'use strict';

  var RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  var TAU = Math.PI * 2;
  var SPRITE = 64;                    /* 光斑精灵基准边长（CSS px 的 2 倍，缩放绘制） */
  var BUCKETS = 5;                    /* 连线透明度分桶数 */

  /* 冷等离子为主，琥珀是稀有「高能离子」——60/30/10 里的那 10% */
  var PALETTE = [
    { hex: '#6b8afd', w: 0.44 },      /* 蓝 */
    { hex: '#34d3c4', w: 0.28 },      /* 青 */
    { hex: '#a78bfa', w: 0.20 },      /* 紫 */
    { hex: '#f5a524', w: 0.08 }       /* 琥珀 */
  ];

  function hex2rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)];
  }

  /* 预渲染光斑：白热核心 + 彩色晕圈，叠加混合下读作「电离辉光」 */
  function makeSprite(rgb) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = SPRITE;
    var g = cv.getContext('2d');
    var r = SPRITE / 2;
    var gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0.00, 'rgba(255,255,255,.98)');
    gr.addColorStop(0.09, rgba(rgb, .90));
    gr.addColorStop(0.26, rgba(rgb, .32));
    gr.addColorStop(0.58, rgba(rgb, .06));
    gr.addColorStop(1.00, rgba(rgb, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, SPRITE, SPRITE);
    return cv;
  }

  function pickColor() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < PALETTE.length; i++) {
      acc += PALETTE[i].w;
      if (r <= acc) return i;
    }
    return 0;
  }

  /* ------------------------------------------------------------
   * IonField：一个画布一个场
   * ------------------------------------------------------------ */
  function IonField(canvas, opt) {
    opt = opt || {};
    var ctx = canvas.getContext('2d');
    var cfg = {
      density: opt.density || 1,          /* 密度倍率 */
      linkDist: opt.linkDist || 148,      /* 连线阈值 */
      linkAlpha: opt.linkAlpha || 0.20,   /* 连线最亮透明度 */
      cursorR: opt.cursorR || 190,        /* 光标影响半径 */
      parallax: opt.parallax == null ? 0.055 : opt.parallax,
      speed: opt.speed || 1,
      maxCount: opt.maxCount || 150
    };

    var sprites = PALETTE.map(function (p) { return makeSprite(hex2rgb(p.hex)); });
    var rgbas = PALETTE.map(function (p) { return hex2rgb(p.hex); });

    var W = 0, H = 0, DPR = 1;
    var P = [], pulses = [];
    var cell = cfg.linkDist, cols = 0, rows = 0, buckets = [];
    var raf = 0, last = 0, running = false, alive = true;
    var mx = -9999, my = -9999, mOn = false;
    var scrollY = 0;
    var tint = rgbas[0].slice(), tintTo = rgbas[0].slice(), tintAmt = 0, tintWant = 0;
    var segs = [];
    var pulseEvery = opt.pulseEvery || 2600, pulseAcc = 0;
    var i, b;

    for (i = 0; i < BUCKETS; i++) segs.push([]);

    /* ---------- 尺寸 ---------- */
    function resize() {
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = w; H = h;
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cell = cfg.linkDist;
      cols = Math.ceil(W / cell) + 1;
      rows = Math.ceil(H / cell) + 1;
      build();
    }

    /* ---------- 建场 ---------- */
    function build() {
      var area = W * H;
      var base = Math.round(area / 11000);
      var n = Math.round(Math.min(cfg.maxCount, Math.max(44, base)) * cfg.density);
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) n = Math.round(n * 0.55);
      P.length = 0;
      for (var k = 0; k < n; k++) P.push(spawn());
    }

    function spawn() {
      var ci = pickColor();
      var z = 0.34 + Math.random() * 0.66;           /* 景深：0=远 1=近 */
      var a = (Math.random() - 0.5) * TAU;
      var sp = (0.10 + Math.random() * 0.30) * z * cfg.speed;
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        z: z,
        ci: ci,
        r: (1.1 + Math.random() * 2.4) * (0.55 + z * 0.75),   /* 视觉半径 */
        tw: Math.random() * TAU,                              /* 闪烁相位 */
        tws: 0.008 + Math.random() * 0.022                    /* 闪烁速度 */
      };
    }

    /* ---------- 更新 ---------- */
    function step(dt) {
      var i, p, dx, dy, d2;

      /* 色调缓动（引导页切换卡片时 tint 会变） */
      tintAmt += (tintWant - tintAmt) * Math.min(1, 0.06 * dt);
      tint = mix(tint, tintTo, Math.min(1, 0.09 * dt));

      /* 光标影响 + 位移 */
      var py = scrollY * cfg.parallax;
      for (i = 0; i < P.length; i++) {
        p = P[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.tw += p.tws * dt;

        if (mOn) {
          dx = mx - p.x; dy = my - p.y;
          d2 = dx * dx + dy * dy;
          var R = cfg.cursorR;
          if (d2 < R * R && d2 > 1) {
            var d = Math.sqrt(d2);
            var f = (1 - d / R);
            p.x += (dx / d) * f * 0.55 * dt;      /* 轻微被吸附 */
            p.y += (dy / d) * f * 0.55 * dt;
            p.boost = f;
          } else if (p.boost) {
            p.boost *= Math.pow(0.94, dt);
            if (p.boost < 0.01) p.boost = 0;
          }
        } else if (p.boost) {
          p.boost *= Math.pow(0.94, dt);
          if (p.boost < 0.01) p.boost = 0;
        }

        /* 环绕（含视差偏移后的可视区） */
        var vy_ = p.y - py * p.z;
        if (p.x < -40) p.x = W + 40; else if (p.x > W + 40) p.x = -40;
        if (vy_ < -40) p.y = H + 40 + py * p.z; else if (vy_ > H + 40) p.y = -40 + py * p.z;
      }

      /* 电离脉冲 */
      pulseAcc += dt * 16.667;
      if (pulseAcc > pulseEvery) {
        pulseAcc = 0;
        if (pulses.length < 4) {
          var q = P[(Math.random() * P.length) | 0];
          if (q) addPulse(q.x, q.y - py * q.z, 90 + Math.random() * 90, q.ci);
        }
      }
      for (i = pulses.length - 1; i >= 0; i--) {
        var pl = pulses[i];
        pl.r += (1.6 + pl.max * 0.010) * dt;
        pl.a = Math.max(0, 1 - pl.r / pl.max);
        if (pl.a <= 0) pulses.splice(i, 1);
      }
    }

    function addPulse(x, y, max, ci, color) {
      pulses.push({
        x: x, y: y, r: 4, max: max, a: 1,
        c: color || rgbas[ci == null ? 0 : ci]
      });
    }

    /* ---------- 绘制 ---------- */
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var py = scrollY * cfg.parallax;
      var i, j, p, q;

      /* 1) 连线：空间网格分桶 + 透明度分桶 */
      var grid = {};
      for (i = 0; i < P.length; i++) {
        p = P[i];
        var px = p.x, pyy = p.y - py * p.z;
        var cx = (px / cell) | 0, cy = (pyy / cell) | 0;
        if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
        if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
        var key = cy * cols + cx;
        (grid[key] || (grid[key] = [])).push(i);
      }
      for (b = 0; b < BUCKETS; b++) segs[b].length = 0;

      var D = cfg.linkDist, D2 = D * D;
      /* 只与右 / 下 / 左下 / 右下 四个邻格比较，避免重复配对 */
      var NB = [[1, 0], [-1, 1], [0, 1], [1, 1]];
      for (var key2 in grid) {
        var kk = key2 | 0;
        var gx = kk % cols, gy = (kk / cols) | 0;
        var list = grid[kk];
        for (i = 0; i < list.length; i++) {
          for (j = i + 1; j < list.length; j++) pushSeg(P[list[i]], P[list[j]], py, D, D2);
          for (var n = 0; n < 4; n++) {
            var nx = gx + NB[n][0], ny = gy + NB[n][1];
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            var other = grid[ny * cols + nx];
            if (!other) continue;
            for (j = 0; j < other.length; j++) pushSeg(P[list[i]], P[other[j]], py, D, D2);
          }
        }
      }
      var linkC = mix(rgbas[0], tint, tintAmt * 0.75);
      for (b = 0; b < BUCKETS; b++) {
        var arr = segs[b];
        if (!arr.length) continue;
        ctx.strokeStyle = rgba(linkC, cfg.linkAlpha * ((b + 1) / BUCKETS));
        ctx.lineWidth = 0.6 + (b / BUCKETS) * 0.5;
        ctx.beginPath();
        for (i = 0; i < arr.length; i += 4) {
          ctx.moveTo(arr[i], arr[i + 1]);
          ctx.lineTo(arr[i + 2], arr[i + 3]);
        }
        ctx.stroke();
      }

      /* 2) 光标 → 近处离子的放电丝 */
      if (mOn) {
        ctx.strokeStyle = rgba(mix(rgbas[1], tint, tintAmt), 0.16);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        var R2 = cfg.cursorR * cfg.cursorR;
        for (i = 0; i < P.length; i++) {
          p = P[i];
          var yy = p.y - py * p.z;
          var ddx = p.x - mx, ddy = yy - my;
          var dd = ddx * ddx + ddy * ddy;
          if (dd < R2 * 0.62) { ctx.moveTo(mx, my); ctx.lineTo(p.x, yy); }
        }
        ctx.stroke();
      }

      /* 3) 离子本体 */
      for (i = 0; i < P.length; i++) {
        p = P[i];
        var y2 = p.y - py * p.z;
        var tw = 0.62 + Math.sin(p.tw) * 0.30;           /* 呼吸感闪烁 */
        var a = (0.16 + p.z * 0.52) * tw;
        if (p.boost) a += p.boost * 0.55;
        a = Math.min(a, 0.95);
        var size = p.r * (p.boost ? 7.5 + p.boost * 3.2 : 7.0);
        ctx.globalAlpha = a;
        ctx.drawImage(sprites[p.ci], p.x - size / 2, y2 - size / 2, size, size);
      }
      ctx.globalAlpha = 1;

      /* 4) 电离脉冲环 */
      for (i = 0; i < pulses.length; i++) {
        var pl = pulses[i];
        ctx.strokeStyle = rgba(pl.c, pl.a * pl.a * 0.34);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, pl.r, 0, TAU);
        ctx.stroke();
      }

      /* 5) 光标电离核 */
      if (mOn) {
        var gs = 150;
        ctx.globalAlpha = 0.30;
        ctx.drawImage(sprites[0], mx - gs / 2, my - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
      }

      ctx.globalCompositeOperation = 'source-over';
    }

    function pushSeg(p, q, py, D, D2) {
      var dx = p.x - q.x;
      var dyabs = (p.y - py * p.z) - (q.y - py * q.z);
      var d2 = dx * dx + dyabs * dyabs;
      if (d2 > D2) return;
      var t = 1 - Math.sqrt(d2) / D;
      var bi = Math.min(BUCKETS - 1, (t * BUCKETS) | 0);
      var arr = segs[bi];
      arr.push(p.x, p.y - py * p.z, q.x, q.y - py * q.z);
    }

    /* ---------- 主循环 ---------- */
    function loop(t) {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      var dt = last ? Math.min((t - last) / 16.667, 2.4) : 1;
      last = t;
      step(dt);
      draw();
    }

    function start() {
      if (running || !alive) return;
      running = true;
      last = 0;
      if (RM.matches) { draw(); return; }   /* reduce：只画一帧静态场 */
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    /* ---------- 事件 ---------- */
    var onMove = function (e) {
      var r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
      mOn = mx >= -60 && my >= -60 && mx <= r.width + 60 && my <= r.height + 60;
    };
    var onLeave = function () { mOn = false; };
    var onDown = function (e) {
      var r = canvas.getBoundingClientRect();
      addPulse(e.clientX - r.left, e.clientY - r.top, 200, null, mix(rgbas[1], tint, tintAmt));
      if (pulses.length > 6) pulses.shift();
    };
    var onScroll = function () { scrollY = window.pageYOffset || document.documentElement.scrollTop || 0; };
    var onVis = function () { if (document.hidden) stop(); else start(); };
    var rt = 0;
    var onResize = function () { clearTimeout(rt); rt = setTimeout(resize, 160); };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseout', onLeave, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVis);

    resize();
    onScroll();

    return {
      start: start,
      stop: stop,
      resize: resize,
      /* 在指定位置炸一圈电离脉冲（引导页切卡时调用） */
      pulse: function (x, y, max, color) { addPulse(x, y, max || 220, null, color ? hex2rgb(color) : null); },
      /* 把整场的连线色往某个强调色上带（引导页按卡片换色） */
      setTint: function (hex, amt) {
        tintTo = hex2rgb(hex || '#6b8afd');
        tintWant = amt == null ? 0.85 : amt;
      },
      clearTint: function () { tintWant = 0; },
      destroy: function () {
        alive = false; stop();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseout', onLeave);
        window.removeEventListener('pointerdown', onDown);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }

  /* ------------------------------------------------------------
   * 自动装配
   *   #ionBg    —— 全站背景场
   *   #ionIntro —— 引导页专用场（更密、更快，只在引导打开时运行）
   * ------------------------------------------------------------ */
  window.IonField = IonField;

  document.addEventListener('DOMContentLoaded', function () {
    var bg = document.getElementById('ionBg');
    if (bg) {
      window.ionsBg = IonField(bg, { density: 1, maxCount: 150 });
      window.ionsBg.start();
      requestAnimationFrame(function () { bg.classList.add('ready'); });   /* 画完第一帧再淡入 */
    }

    var it = document.getElementById('ionIntro');
    if (it) {
      window.ionsIntro = IonField(it, {
        density: 1.6, maxCount: 130, linkDist: 134,
        linkAlpha: 0.30, cursorR: 220, speed: 1.3, pulseEvery: 1500
      });
    }
  });

  /* 引导打开时：背景场让位给引导场，避免两个场同时跑
     引导页的画布是 intro.js 动态插入的，所以这里惰性创建 */
  window.ionsSwap = function (toIntro) {
    var a = window.ionsBg, b = window.ionsIntro;
    if (toIntro) {
      if (!b) {
        var cv = document.getElementById('ionIntro');
        if (cv) {
          b = window.ionsIntro = IonField(cv, {
            density: 1.6, maxCount: 130, linkDist: 134,
            linkAlpha: 0.30, cursorR: 220, speed: 1.3, pulseEvery: 1500
          });
        }
      }
      if (a) a.stop();
      if (b) b.start();
    } else {
      if (b) b.stop();
      if (a) a.start();
    }
  };
})();
