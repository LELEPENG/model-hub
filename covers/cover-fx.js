/* ============================================================
   cover-fx.js · 封面专用离子场（确定性 / 无动画 / 可复现）
   ------------------------------------------------------------
   和站点首页 ions.js 同一套视觉语言：模型 = 带电离子，
   接入 = 放电连线。区别：这里是"拍照片"，seed 固定则纹理固定，
   每天只随 COVER.seed 变一次，保证日更封面同一天完全一致。
   ============================================================ */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hex2rgb(h) {
    h = String(h || '#6b8afd').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* 预渲染一张 64px 光点精灵，避免每个粒子都画一遍径向渐变 */
  function makeSprite(rgb) {
    var S = 64, c = document.createElement('canvas');
    c.width = c.height = S;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0.00, 'rgba(255,255,255,1)');
    grd.addColorStop(0.16, 'rgba(255,255,255,.92)');
    grd.addColorStop(0.34, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.72)');
    grd.addColorStop(0.66, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.20)');
    grd.addColorStop(1.00, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    return c;
  }

  function IonField(canvas, opt) {
    opt = opt || {};
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = opt.w; this.H = opt.h;
    this.dpr = Math.min(opt.dpr || 2, 2);
    this.accent = opt.accent || '#6b8afd';
    this.linkDist = opt.linkDist || 132;
    this.linkAlpha = opt.linkAlpha == null ? .30 : opt.linkAlpha;
    this.speed = opt.speed || 1;
    this.seed = opt.seed || 1;
    this.tint = 0;                 // 0 = 用模型主色，1 = 完全用主色
    this.sprite = makeSprite(hex2rgb(this.accent));
    canvas.width = this.W * this.dpr;
    canvas.height = this.H * this.dpr;
    canvas.style.width = this.W + 'px';
    canvas.style.height = this.H + 'px';
    this.ctx.scale(this.dpr, this.dpr);
    this._init();
  }

  IonField.prototype._init = function () {
    var rnd = mulberry32(this.seed);
    var area = this.W * this.H;
    var n = Math.max(64, Math.min(200, Math.round(area / 8600)));
    this.n = n;
    var ps = new Array(n), i;
    for (i = 0; i < n; i++) {
      var big = rnd() < 0.14;                       // 少量"重离子"制造层次
      ps[i] = {
        x: rnd() * this.W,
        y: rnd() * this.H,
        vx: (rnd() - .5) * .34 * this.speed,
        vy: (rnd() - .5) * .34 * this.speed,
        r: big ? 3.6 + rnd() * 2.2 : 1.1 + rnd() * 1.7,
        a: big ? .78 + rnd() * .22 : .34 + rnd() * .40,
        ph: rnd() * Math.PI * 2
      };
    }
    this.ps = ps;
    this.t = 0;
  };

  /* 推进 n 帧（同步，不依赖 rAF）——导出时直接调到想要的形态 */
  IonField.prototype.step = function (n) {
    var W = this.W, H = this.H, ps = this.ps, i;
    for (var k = 0; k < n; k++) {
      for (i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
        p.ph += .012;
      }
      this.t += 1;
    }
  };

  /* 空间分桶：把 O(n²) 的连线判定降到近似 O(n) */
  IonField.prototype._buckets = function () {
    var cell = this.linkDist, W = this.W, H = this.H;
    var cx = Math.ceil(W / cell) + 1, cy = Math.ceil(H / cell) + 1;
    var map = new Map(), ps = this.ps, i;
    for (i = 0; i < ps.length; i++) {
      var p = ps[i];
      var gx = (p.x / cell) | 0, gy = (p.y / cell) | 0;
      var key = gy * cx + gx;
      var arr = map.get(key);
      if (!arr) { arr = []; map.set(key, arr); }
      arr.push(p);
    }
    this._map = map; this._cx = cx; this._cell = cell;
  };

  IonField.prototype.render = function () {
    var c = this.ctx, W = this.W, H = this.H, ps = this.ps, i, j;
    c.clearRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';

    /* ---- 连线 ---- */
    this._buckets();
    var map = this._map, cx = this._cx, cell = this._cell;
    var rgb = hex2rgb(this.accent);
    var LD = this.linkDist, LD2 = LD * LD;
    /* 按透明度分 5 档批量描边，减少 stroke 次数 */
    var buckets = [[], [], [], [], []];
    for (i = 0; i < ps.length; i++) {
      var a = ps[i], gx = (a.x / cell) | 0, gy = (a.y / cell) | 0;
      for (var ox = 0; ox <= 1; ox++) {
        for (var oy = (ox === 0 ? 0 : -1); oy <= 1; oy++) {
          var arr = map.get((gy + oy) * cx + (gx + ox));
          if (!arr) continue;
          for (j = 0; j < arr.length; j++) {
            var b = arr[j];
            if (b === a) continue;
            if (ox === 0 && oy === 0 && arr.indexOf(a) > j) continue;
            var dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
            if (d2 > LD2) continue;
            var t = 1 - Math.sqrt(d2) / LD;
            var al = t * t * this.linkAlpha;
            if (al < .012) continue;
            buckets[Math.min(4, (al / .075) | 0)].push([a.x, a.y, b.x, b.y]);
          }
        }
      }
    }
    c.lineWidth = 1;
    for (var bi = 0; bi < 5; bi++) {
      var seg = buckets[bi];
      if (!seg.length) continue;
      c.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (.028 + bi * .062).toFixed(3) + ')';
      c.beginPath();
      for (j = 0; j < seg.length; j++) {
        c.moveTo(seg[j][0], seg[j][1]); c.lineTo(seg[j][2], seg[j][3]);
      }
      c.stroke();
    }

    /* ---- 光点 ---- */
    var sp = this.sprite;
    for (i = 0; i < ps.length; i++) {
      var p = ps[i];
      var puls = .82 + .18 * Math.sin(p.ph);
      var d = p.r * 7.2 * puls;
      c.globalAlpha = Math.min(1, p.a * puls);
      c.drawImage(sp, p.x - d / 2, p.y - d / 2, d, d);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  };

  window.IonField = IonField;
})();
