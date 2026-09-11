/* ============================================================
 * model-hub / fx.js
 * 动效层：滚动进度 / 入场序列 / 数字滚动 / 视图切换 / 跑马灯 / 回顶
 * ★ 不改动 app.js 任何业务逻辑，只做「增强」
 * ★ 内容由 app.js 动态渲染，用 MutationObserver 在每次重渲染后重新套用动画
 * ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 数字滚动（暴露给 index.html 用） ---------- */
  window.fxCount = function (el, target, dec) {
    if (!el) return;
    dec = dec || 0;
    if (reduce) { el.textContent = target.toFixed(dec); return; }
    var dur = 900, t0 = 0;
    function step(ts) {
      if (!t0) t0 = ts;
      var k = Math.min((ts - t0) / dur, 1);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = (target * e).toFixed(dec);
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  /* ---------- 滚动进度 + 回顶环 ---------- */
  var prog = $('#prog'), bt = $('#backTop'), ring = $('#backTop .ring');
  var CIRC = 138;
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var p = max > 0 ? h.scrollTop / max : 0;
    if (prog) prog.style.width = (p * 100) + '%';
    if (bt) bt.classList.toggle('show', h.scrollTop > 420);
    if (ring) ring.style.strokeDashoffset = (CIRC * (1 - p)).toFixed(1);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (bt) bt.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------- 跑马灯：滚动「最新 + 排名最靠前」的模型 ---------- */
  function buildTicker() {
    var track = $('#tick');
    if (!track) return;
    var items = [];
    try {
      if (typeof TOP50 !== 'undefined' && TOP50.length) {
        /* 榜单前 12 名 + 最新上榜的国产 / 开源亮点，按排名顺序滚动 */
        items = TOP50.slice(0, 12).map(function (m) {
          return '#' + m.rank + ' ' + m.name.toUpperCase() + ' · ' + m.vendor.toUpperCase();
        });
        TOP50.filter(function (m) { return m.rank > 12 && m.open; }).slice(0, 3).forEach(function (m) {
          items.push('#' + m.rank + ' ' + m.name.toUpperCase() + ' · 开源权重');
        });
      } else {
        items = (typeof MODELS !== 'undefined' ? MODELS : []).slice(0, 14)
          .map(function (m) { return (m.name + ' · ' + m.vendor).toUpperCase(); });
      }
    } catch (e) { items = []; }
    if (!items.length) {
      items = ['本地部署 · 按显存档位选', '云端 API · 免费与付费对照', '实测回帖 · 实验室工单',
        'OLLAMA 一键拉取', 'OPENAI 兼容端点', '数据核实 ' + (typeof DATA_VERSION !== 'undefined' ? DATA_VERSION : '')];
    }
    var html = items.map(function (t) { return '<span>' + t + '</span>'; }).join('');
    track.innerHTML = html + html; /* 复制一份，translateX(-50%) 无缝循环 */
    /* 轨道越宽，固定 40s 就越快 —— 按实际宽度换算成恒定线速度（约 68px/s） */
    requestAnimationFrame(function () {
      var half = track.scrollWidth / 2;
      if (half > 0) track.style.animationDuration = Math.max(24, Math.round(half / 68)) + 's';
    });
  }

  /* ---------- 入场动画 ---------- */
  var REVEAL_SEL = [
    '.sec-title', '.tier-grid', '.filters', '.pick-box', '.pick-list > *',
    '.step', '.ticket', '.lab-intro', '.empty', '.card',
    '.rank-tools', '.rank-row', '.callout', '.blk'
  ].join(',');

  /* 分数条：进入视口时从 0 长到目标宽度 */
  function growBars(el) {
    if (!el) return;
    var boxes = el.matches && el.matches('.sbar') ? [el] : $$('.sbar', el);
    boxes.forEach(function (box) {
      var fill = box.querySelector('i');
      if (!fill || fill.getAttribute('data-grown')) return;
      var w = fill.style.width || (fill.getAttribute('data-w') ? fill.getAttribute('data-w') + '%' : '');
      if (!w) return;
      fill.setAttribute('data-grown', '1');
      if (reduce) { fill.style.width = w; return; }
      fill.style.transition = 'none';
      fill.style.width = '0%';
      void fill.offsetWidth;
      fill.style.transition = '';
      requestAnimationFrame(function () { fill.style.width = w; });
    });
  }

  var io = null;
  if ('IntersectionObserver' in window && !reduce) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        growBars(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -6% 0px' });
  }

  /* 已渲染过的节点打标记，避免 MutationObserver 重复处理 */
  var FLAG = 'data-rv';

  function enhance(root, animate) {
    if (!root) return;
    var cands = $$(REVEAL_SEL, root);
    /* 排除嵌套：父级已经在动画集合里时，子元素不再单独动画 */
    var list = cands.filter(function (el) {
      var p = el.parentElement;
      while (p && p !== root) {
        if (p.matches(REVEAL_SEL)) return false;
        p = p.parentElement;
      }
      return true;
    });

    list.forEach(function (el, i) {
      if (el.getAttribute(FLAG)) return;
      el.setAttribute(FLAG, '1');
      if (reduce || !animate || !io) {
        el.classList.add('rv', 'in');   /* 直接就位，不做动画 */
        growBars(el);
        return;
      }
      el.classList.add('rv');
      el.style.transitionDelay = Math.min(i * 55, 330) + 'ms';
      io.observe(el);
    });
  }

  /* ---------- 视图切换 ---------- */
  var view = $('#view');
  var lastRender = 0;
  var lastTab = null;

  function currentTab() {
    try { return state.tab; } catch (e) { return null; }
  }

  function handleRender() {
    if (!view) return;
    var now = Date.now();
    var tab = currentTab();
    var tabChanged = (tab !== lastTab);
    /* 搜索框每敲一个字都会重渲染 —— 这种高频重渲染不做入场动画，避免闪烁 */
    var animate = (now - lastRender > 600) || tabChanged;
    lastRender = now;
    lastTab = tab;

    if (tabChanged) {
      /* 切 Tab：整个视图做一次淡入上移，内部元素不再各自动画，避免叠加抖动 */
      if (!reduce) {
        view.classList.remove('swap');
        void view.offsetWidth;        /* 强制重排以重启动画 */
        view.classList.add('swap');
      }
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      enhance(view, false);
      return;
    }
    /* 同 Tab 内的重渲染（选档位 / 筛选 / 搜索）：只做错峰入场，不滚动页面 */
    enhance(view, animate);
  }

  if (view && 'MutationObserver' in window) {
    var mo = new MutationObserver(function () {
      clearTimeout(mo._t);
      mo._t = setTimeout(handleRender, 0);
    });
    mo.observe(view, { childList: true });
  }

  /* ---------- 抽屉打开时也给内容套上动画 ---------- */
  var panel = $('#panel');
  if (panel && 'MutationObserver' in window) {
    var pm = new MutationObserver(function () {
      setTimeout(function () { enhance(panel, true); growBars(panel); }, 30);
    });
    pm.observe(panel, { childList: true });
  }

  /* ---------- 首屏：无 JS 渲染时也保证内容可见 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    buildTicker();
    enhance(view, true);
    /* 兜底：3 秒后把还没进入视口的残留元素强制显示，防止任何情况下白屏 */
    setTimeout(function () {
      $$('.rv:not(.in)', view).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.classList.add('in');
      });
    }, 2600);
  });
  window.addEventListener('load', function () { enhance(view, true); onScroll(); });
})();
