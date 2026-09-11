/* ============================================================
 * model-hub / app.js
 * 交互层：查询 / 详情 / 实验室工单
 * 数据持久化：localStorage（纯静态站无后端，工单存在本浏览器）
 * ============================================================ */

const LS_TICKETS = 'modelhub.tickets.v1';
const LS_OWNER = 'modelhub.owner.v1';

let state = {
  tab: 'rank',
  tier: null,
  need: null,
  q: '',
  filterKind: 'all',
  filterTier: 'all',
  rankFilter: 'all',
  tag: 'all',
  tickets: [],
  owner: false
};

/* ---------- 工具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('on'), 2200);
}

function copy(text, btn) {
  const done = () => {
    if (btn) { const o = btn.textContent; btn.textContent = '已复制'; setTimeout(() => btn.textContent = o, 1400); }
    toast('已复制到剪贴板');
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallback(text, done));
  } else fallback(text, done);
}
function fallback(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选中'); }
  document.body.removeChild(ta);
}

const statusTag = (k) => ({ verified: '已实测', community: '社区反馈', untested: '待实测' }[k] || k);
const tierTag = (k) => ({ free: '免费', paid: '付费', freemium: '免费+付费' }[k] || k);
const getModel = (id) => MODELS.find(m => m.id === id);

/* ---------- 渲染：硬件查询 ---------- */
function renderHW() {
  const picked = state.tier ? TIERS.find(t => t.id === state.tier) : null;
  let h = '<div class="tier-grid">';
  TIERS.forEach(t => {
    h += `<div class="card tier-card click ${state.tier === t.id ? 'star' : ''}" data-tier="${t.id}">
      <div class="top"><span class="ic">${t.icon}</span><span class="nm">${esc(t.label)}</span></div>
      <div class="hint">${esc(t.hint)}</div></div>`;
  });
  h += '</div>';

  if (picked) {
    h += `<div class="pick-box">
      <div class="sec-title" style="margin-top:0">${esc(picked.label)} · 推荐</div>
      <div class="rule">${esc(picked.rule)}</div>
      <div class="note">${esc(picked.note)}</div>
      <div class="pick-list">`;
    picked.picks.forEach(id => { const m = getModel(id); if (m) h += modelCard(m, true); });
    h += `</div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm ghost" data-goto="basics">不会装？看 6 步新手教程 →</button>
        <button class="btn sm ghost" data-goto="lab">这个档位推荐得不准？去实验室留言</button>
      </div>
    </div>`;
  } else {
    h += `<div class="empty"><div class="ic">🖥️</div><p>先点上面一个档位，我告诉你该装哪 1-2 个模型</p></div>`;
  }
  return h;
}

/* ---------- 渲染：需求查询 ---------- */
function renderNeed() {
  let h = '<div class="tier-grid">';
  NEEDS.forEach(n => {
    h += `<div class="card tier-card click" data-need="${n.id}" style="${state.need === n.id ? 'border-color:var(--amber-dim);background:linear-gradient(180deg,#1a1712,var(--bg-1))' : ''}">
      <div class="top"><span class="ic">${n.icon}</span><span class="nm">${esc(n.label)}</span></div></div>`;
  });
  h += '</div>';

  if (state.need) {
    const n = NEEDS.find(x => x.id === state.need);
    h += `<div class="pick-box">
      <div class="sec-title" style="margin-top:0">${esc(n.label)}</div>
      <div class="note">${esc(n.why)}</div>`;
    const row = (title, ids) => {
      if (!ids || !ids.length) return '';
      let s = `<div class="sec-title">${title}</div><div class="pick-list">`;
      ids.forEach(id => { const m = getModel(id); if (m) s += modelCard(m, true); });
      return s + '</div>';
    };
    h += row('免费方案', n.free);
    h += row('付费最强', n.paid);
    h += `<div style="margin-top:14px"><button class="btn sm ghost" data-goto="lab">有更好的推荐？去实验室告诉我</button></div></div>`;
  } else {
    h += `<div class="empty"><div class="ic">🎯</div><p>选一个你要做的事，我给你「免费能用的」和「付费最强的」两套方案</p></div>`;
  }
  return h;
}

/* ---------- 模型卡 ---------- */
function modelCard(m, compact) {
  const kv = [];
  if (m.kind === 'local') {
    if (m.vram) kv.push(`<b>显存</b> ${esc(m.vram)}`);
    if (m.ctx) kv.push(`<b>上下文</b> ${esc(m.ctx)}`);
    if (m.license) kv.push(`<b>许可</b> ${esc(m.license)}`);
  } else {
    if (m.ctx) kv.push(`<b>上下文</b> ${esc(m.ctx)}`);
    kv.push(`<b>价格</b> ${esc(m.price)}`);
  }
  return `<div class="card m-card click" data-model="${m.id}">
    <div class="hd">
      <div><div class="nm">${esc(m.name)}</div><div class="vd">${esc(m.vendor)}</div></div>
    </div>
    <div class="one">${esc(m.oneLiner)}</div>
    <div class="kv">${kv.join(' ')}</div>
    <div class="tags">
      <span class="tag ${m.tier}">${tierTag(m.tier)}</span>
      <span class="tag ${m.status}">${statusTag(m.status)}</span>
      <span class="tag">${m.kind === 'local' ? '本地' : 'API'}</span>
    </div>
  </div>`;
}

/* ---------- 渲染：模型库 ---------- */
function renderLib() {
  const list = MODELS.filter(m => {
    if (state.filterKind !== 'all' && m.kind !== state.filterKind) return false;
    if (state.filterTier !== 'all' && m.tier !== state.filterTier) return false;
    if (state.tag !== 'all' && !m.tags.includes(state.tag)) return false;
    if (state.q) {
      const q = state.q.toLowerCase();
      const hay = (m.name + m.vendor + m.oneLiner + m.bestFor + m.tags.join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const allTags = [...new Set(MODELS.flatMap(m => m.tags))];
  let h = `<div class="filters">
    <input type="text" id="q" placeholder="搜模型名 / 厂商 / 用途…" value="${esc(state.q)}">
    <button class="chip ${state.filterKind === 'all' ? 'on' : ''}" data-fk="all">全部</button>
    <button class="chip ${state.filterKind === 'local' ? 'on' : ''}" data-fk="local">本地部署</button>
    <button class="chip ${state.filterKind === 'api' ? 'on' : ''}" data-fk="api">云端 API</button>
    <button class="chip ${state.filterTier === 'free' ? 'on' : ''}" data-ft="free">免费</button>
    <button class="chip ${state.filterTier === 'paid' ? 'on' : ''}" data-ft="paid">付费</button>
  </div>
  <div class="filters">${allTags.map(t =>
    `<button class="chip ${state.tag === t ? 'on' : ''}" data-tag="${t}">${esc(t)}</button>`).join('')}
  </div>
  <div class="sec-title">共 ${list.length} 个模型</div>`;

  if (!list.length) {
    h += `<div class="empty"><div class="ic">🔍</div><p>没找到匹配的模型。<br>想要的我还没收录？<button class="btn sm" data-goto="lab" style="margin-top:10px">去实验室点名</button></p></div>`;
  } else {
    h += '<div class="pick-list">' + list.map(m => modelCard(m)).join('') + '</div>';
  }
  return h;
}

/* ---------- 渲染：全球 Top 50 排行榜 ---------- */
const OPEN_TAG = (o) => o
  ? '<span class="tag free">开源权重</span>'
  : '<span class="tag paid">闭源</span>';

function renderRank() {
  let h = `<div class="lab-intro">
    <b>排序方法：</b>以 airankings（7 家独立榜单「奖牌榜」聚合，2026-09-09）为基准，
    交叉校验 llm-stats 综合指数与 BenchLM BenchAlign v5.2，归一化成本站综合分（满分 100）。
    <b>点任意一行</b>看它的优势、最适合干什么、以及别拿它干什么。
  </div>`;

  h += `<div class="rank-tools">
    <button class="chip ${state.rankFilter === 'all' ? 'on' : ''}" data-rf="all">全部 50</button>
    <button class="chip ${state.rankFilter === 'open' ? 'on' : ''}" data-rf="open">仅开源权重</button>
    <button class="chip ${state.rankFilter === 'free' ? 'on' : ''}" data-rf="free">有免费档</button>
    <button class="chip ${state.rankFilter === 'cn' ? 'on' : ''}" data-rf="cn">国产模型</button>
  </div>`;

  const CN = ['Moonshot AI（月之暗面）', 'Z.ai（智谱）', 'DeepSeek', '阿里巴巴', '腾讯混元', 'MiniMax（稀宇）'];
  const list = TOP50.filter(m => {
    if (state.rankFilter === 'open' && !m.open) return false;
    if (state.rankFilter === 'free' && !/免费/.test(m.price)) return false;
    if (state.rankFilter === 'cn' && CN.indexOf(m.vendor) < 0) return false;
    return true;
  });

  h += `<div class="rank-list">`;
  list.forEach(m => {
    const medal = m.rank <= 3 ? ' top' + m.rank : '';
    h += `<div class="rank-row${medal} click" data-rank="${m.rank}" style="--ac:${m.accent}">
      <div class="rk">${m.rank}</div>
      <div class="rbody">
        <div class="rhd">
          <span class="rnm">${esc(m.name)}</span>
          <span class="rvd">${esc(m.vendor)}</span>
        </div>
        <div class="rone">${esc(m.pros[0])}</div>
        <div class="rtags">${OPEN_TAG(m.open)}<span class="tag">${esc(m.modality)}</span><span class="tag">${esc(m.ctx)}</span><span class="tag">${esc(m.price)}</span></div>
      </div>
      <div class="rscore">
        <div class="sn">${m.score.toFixed(1)}</div>
        <div class="sbar"><i style="width:${m.score}%;background:${m.accent}"></i></div>
        <div class="sl">综合分</div>
      </div>
      <div class="rgo">›</div>
    </div>`;
  });
  h += `</div>`;

  h += `<div class="callout" style="margin-top:20px">
    <b>怎么读这个榜：</b>综合分只做横向对比，不代表任何官方分数。
    真要落地，先看 <b>适不适合你的场景</b>，再看价格——第 8 名的 Kimi K3 用 30% 的价格保留了 96% 的顶配能力，
    对大多数人比第 1 名更实用。
  </div>`;
  return h;
}

/* ---------- Top50 详情 ---------- */
function openTop(rank) {
  const m = TOP50.find(x => x.rank === Number(rank));
  if (!m) return;
  let h = `<div class="panel-hd">
    <button class="close" id="pClose">✕</button>
    <div class="rk-big" style="color:${m.accent}">#${m.rank}</div>
    <div class="nm">${esc(m.name)}</div>
    <div class="vd">${esc(m.vendor)}</div>
    <div class="tags" style="margin-top:8px">
      ${OPEN_TAG(m.open)}
      <span class="tag">${esc(m.modality)}</span>
      <span class="tag">${esc(m.ctx)}</span>
      <span class="tag">${esc(m.price)}</span>
    </div>
  </div><div class="panel-bd">`;

  h += `<div class="blk"><h3>综合分 <b style="color:${m.accent}">${m.score.toFixed(1)}</b> / 100</h3>
    <p style="color:var(--txt-3);font-size:12px;font-family:var(--mono)">${esc(m.scoreNote)}</p>
    <div class="sbar big" style="margin-top:10px"><i style="width:${m.score}%;background:${m.accent}"></i></div>
  </div>`;

  h += `<div class="blk"><h3>优势（为什么排这么高）</h3><ul class="pros">${
    m.pros.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`;

  h += `<div class="blk"><h3>最适合干什么</h3><p>${esc(m.best)}</p></div>`;

  h += `<div class="blk avoid"><h3>别拿它干什么</h3><p>${esc(m.avoid)}</p></div>`;

  h += `<div class="blk"><h3>参数</h3><table class="kv-t">
    <tr><td>上下文</td><td>${esc(m.ctx)}</td></tr>
    <tr><td>模态</td><td>${esc(m.modality)}</td></tr>
    <tr><td>价格</td><td>${esc(m.price)}</td></tr>
    <tr><td>权重</td><td>${m.open ? '开源（可自部署）' : '闭源（仅 API）'}</td></tr>
  </table></div>`;

  if (m.linkTo && getModel(m.linkTo)) {
    h += `<div style="margin-top:14px"><button class="btn" data-openmodel="${m.linkTo}">查看接入教程 / 部署命令 →</button></div>`;
  } else {
    h += `<div class="blk"><p style="color:var(--txt-3);font-size:12px">
      这个模型本站还没收录详细接入教程。想看？
      <a href="#" data-goto="lab" style="color:var(--amber)">去实验室点名</a>，我测完补上。
    </p></div>`;
  }

  h += `</div>`;
  const p = $('#panel');
  p.innerHTML = h;
  p.classList.add('on');
  $('#overlay').classList.add('on');
  $('#pClose').onclick = closePanel;
  const om = $('#panel [data-openmodel]');
  if (om) om.onclick = () => openModel(om.dataset.openmodel);
  $$('#panel [data-goto]').forEach(el => el.onclick = (e) => {
    e.preventDefault(); closePanel(); state.tab = el.dataset.goto; render(); window.scrollTo(0, 0);
  });
}

/* ---------- 渲染：新手教程 ---------- */
function renderBasics() {
  let h = `<div class="lab-intro">
    完全没装过？按顺序走完这 6 步，从零到「所有软件都能调用你的本地模型」。
    <b>第 2 步和第 6 步是最多人踩坑的地方</b>，别跳过。
  </div>`;
  BASICS.forEach((b, i) => {
    h += `<div class="step">
      <div class="n">${i + 1}</div>
      <div><div class="t">${esc(b.title)}</div><div class="b">${esc(b.body)}</div>
      ${b.cmd ? `<pre><button class="cp">复制</button><code>${esc(b.cmd)}</code></pre>` : ''}</div>
    </div>`;
  });
  h += `<div style="margin-top:20px"><button class="btn ghost" data-goto="hw">← 回去选我的硬件档位</button></div>`;
  return h;
}

/* ---------- 渲染：实验室 ---------- */
function renderLab() {
  let h = `<div class="lab-intro">
    <b>实验室 = 这个站的补全机制。</b>
    模型世界一个月一变，我不可能全测完。标着「待实测」的条目都是我自己还没跑过的。
    <br><br>
    <b>你可以：</b>提交你踩过的坑、想看的模型、发现的错误 → 我会实机测试 → 把结论回帖在这里。
    <br>
    <b>关于数据存储：</b>这是纯静态网站（没有服务器），你提交的留言只保存在你自己的浏览器里。
    想让我看到，请点「导出 JSON」把文件发给我（微信/邮件都行），我导入后会在这里更新状态和测试结论。
  </div>`;

  if (state.owner) {
    h += `<div class="card" style="margin-bottom:20px;border-color:var(--green)">
      <div class="sec-title" style="margin-top:0">站长模式（已开启）</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm" id="importBtn">导入 JSON 工单</button>
        <button class="btn sm ghost" id="exportBtn">导出全部工单</button>
        <button class="btn sm ghost" id="exitOwner">退出站长模式</button>
        <input type="file" id="importFile" accept=".json" style="display:none">
      </div>
      <p style="font-size:12px;color:var(--txt-3);margin-top:8px">
        在这里给工单回帖测试结论，状态会变成「已验证」，页面上就能看到。
      </p>
    </div>`;
  }

  /* 提交表单 */
  h += `<div class="card" style="margin-bottom:24px">
    <div class="sec-title" style="margin-top:0">提交一条</div>
    <div class="form-row">
      <label>类型</label>
      <select id="tType">
        <option value="missing">想看的模型没收录</option>
        <option value="error">教程里有错 / 跑不通</option>
        <option value="exp">我的实测数据（想分享）</option>
        <option value="other">其他建议</option>
      </select>
    </div>
    <div class="form-row">
      <label>标题（一句话说清）</label>
      <input type="text" id="tTitle" placeholder="例：RTX 4070 12G 跑 qwen3:14b 实测只有 8 tok/s">
    </div>
    <div class="form-row">
      <label>详情</label>
      <textarea id="tBody" placeholder="你的硬件配置、具体报错、期望结果…写得越细我越容易复现"></textarea>
    </div>
    <div class="form-row">
      <label>联系方式（选填，我测完想回复你时用到）</label>
      <input type="text" id="tContact" placeholder="微信号 / 邮箱 / 留空也行">
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn" id="submitTicket">提交</button>
      <button class="btn ghost" id="exportMine">导出我的留言 JSON</button>
    </div>
  </div>`;

  /* 工单列表 */
  const ts = state.tickets;
  h += `<div class="sec-title">工单列表（${ts.length}）</div>`;
  if (!ts.length) {
    h += `<div class="empty"><div class="ic">🧪</div><p>还没有工单。你是第一个来补这个站的人吗？</p></div>`;
  } else {
    const order = { open: 0, testing: 1, resolved: 2, ignored: 3 };
    ts.slice().sort((a, b) => (order[a.status] - order[b.status]) || (b.createdAt - a.createdAt))
      .forEach(t => h += ticketHTML(t));
  }
  return h;
}

function ticketHTML(t) {
  const st = TICKET_STATUS[t.status] || TICKET_STATUS.open;
  let h = `<div class="ticket" data-tk="${t.id}" style="border-left-color:${st.color}">
    <div class="t-hd">
      <div style="flex:1">
        <div class="t-t">${esc(t.title)}</div>
        <div class="t-m">${esc(t.typeLabel)} · ${new Date(t.createdAt).toLocaleString('zh-CN')}${t.contact ? ' · ' + esc(t.contact) : ''}</div>
      </div>
      <span class="badge" style="background:${st.color}22;color:${st.color}">${st.label}</span>
    </div>`;
  if (t.body) h += `<div class="t-b">${esc(t.body)}</div>`;
  (t.replies || []).forEach(r => {
    h += `<div class="reply"><div class="rh">站长实测回帖 · ${new Date(r.at).toLocaleString('zh-CN')} · 状态改为「${(TICKET_STATUS[r.status] || {}).label || r.status}」</div>${esc(r.text)}</div>`;
  });
  if (state.owner) {
    h += `<div class="acts">
      <button class="btn sm ghost" data-reply="${t.id}">回帖 / 改状态</button>
      <button class="btn sm ghost" data-st="${t.id}" data-v="testing">标记测试中</button>
      <button class="btn sm ghost" data-st="${t.id}" data-v="resolved">标记已验证</button>
      <button class="btn sm ghost" data-st="${t.id}" data-v="ignored">不采纳</button>
      <button class="btn sm ghost" data-del="${t.id}">删除</button>
    </div>`;
  }
  return h + '</div>';
}

/* ---------- 详情面板 ---------- */
function openModel(id) {
  const m = getModel(id);
  if (!m) return;
  let h = `<div class="panel-hd">
    <button class="close" id="pClose">✕</button>
    <div class="nm">${esc(m.name)}</div>
    <div class="vd">${esc(m.vendor)}</div>
    <div class="tags" style="margin-top:8px">
      <span class="tag ${m.tier}">${tierTag(m.tier)}</span>
      <span class="tag ${m.status}">${statusTag(m.status)}</span>
      <span class="tag">${m.kind === 'local' ? '本地部署' : '云端 API'}</span>
    </div>
  </div><div class="panel-bd">`;

  h += `<div class="blk"><h3>一句话定位</h3><p>${esc(m.oneLiner)}</p><p><b style="color:var(--txt)">适合谁：</b>${esc(m.bestFor)}</p></div>`;

  h += `<div class="blk"><h3>参数</h3><table class="kv-t">
    <tr><td>价格</td><td>${esc(m.price)}</td></tr>
    <tr><td>上下文</td><td>${esc(m.ctx || '—')}</td></tr>
    ${m.kind === 'local' ? `<tr><td>显存占用</td><td>${esc(m.vram || '—')}</td></tr>
    <tr><td>许可</td><td>${esc(m.license || '—')}</td></tr>` : ''}
    <tr><td>能力标签</td><td>${m.tags.map(t => `<span class="tag">${esc(t)}</span>`).join(' ')}</td></tr>
    <tr><td>更新日期</td><td>${esc(m.updated)}</td></tr>
  </table></div>`;

  if (m.install) {
    h += `<div class="blk"><h3>本地部署</h3>
      <pre><button class="cp">复制</button><code>${esc(m.install.cmd)}</code></pre>
      <p><b style="color:var(--txt)">怎么算跑通：</b>${esc(m.install.verify)}</p>
      ${m.install.tune ? `<p><b style="color:var(--txt)">调优：</b>${esc(m.install.tune)}</p>` : ''}
    </div>`;
  }

  if (m.api) {
    h += `<div class="blk"><h3>API 接入</h3>
      <p><b style="color:var(--txt)">1. 注册：</b>${esc(m.api.signup)}</p>
      <p><b style="color:var(--txt)">2. 拿 Key：</b>${esc(m.api.key)}</p>
      <p><b style="color:var(--txt)">3. 填参数：</b></p>
      <table class="kv-t">
        <tr><td>Base URL</td><td><code>${esc(m.api.baseUrl)}</code></td></tr>
        <tr><td>模型 ID</td><td><code>${esc(m.api.modelId)}</code></td></tr>
        <tr><td>兼容性</td><td>${esc(m.api.compat)}</td></tr>
      </table>
      <p style="margin-top:10px"><b style="color:var(--txt)">4. 测试是否通：</b></p>
      <pre><button class="cp">复制</button><code>${esc(m.api.curl)}</code></pre>
    </div>`;
  }

  if (m.pitfalls && m.pitfalls.length) {
    h += `<div class="blk"><h3>坑</h3><ul class="pit">${m.pitfalls.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
  }

  h += `<div class="blk"><p style="color:var(--txt-3);font-size:12px">
    数据核实于 ${esc(m.updated)}。模型世界里一个月就是一代，信息过期或有错？
    <a href="#" data-goto="lab" style="color:var(--amber)">去实验室告诉我</a>。
  </p></div>`;

  h += '</div>';
  const p = $('#panel');
  p.innerHTML = h;
  p.classList.add('on');
  $('#overlay').classList.add('on');
  $('#pClose').onclick = closePanel;
  /* 面板是 #view 之外的独立节点，必须单独绑定，否则复制按钮和跳转链接失效 */
  $$('#panel pre .cp').forEach(b => b.onclick = () => copy(b.nextElementSibling.textContent, b));
  $$('#panel [data-goto]').forEach(el => el.onclick = (e) => {
    e.preventDefault();
    closePanel();
    state.tab = el.dataset.goto;
    render();
    window.scrollTo(0, 0);
  });
}

function closePanel() {
  $('#panel').classList.remove('on');
  $('#overlay').classList.remove('on');
}

/* ---------- 主渲染 ---------- */
function render() {
  $$('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  const main = $('#view');
  if (state.tab === 'hw') main.innerHTML = renderHW();
  else if (state.tab === 'need') main.innerHTML = renderNeed();
  else if (state.tab === 'rank') main.innerHTML = renderRank();
  else if (state.tab === 'lib') main.innerHTML = renderLib();
  else if (state.tab === 'basics') main.innerHTML = renderBasics();
  else if (state.tab === 'lab') main.innerHTML = renderLab();
  bindView();
}

function bindView() {
  $$('#view [data-tier]').forEach(el => el.onclick = () => { state.tier = el.dataset.tier; render(); });
  $$('#view [data-need]').forEach(el => el.onclick = () => { state.need = el.dataset.need; render(); });
  $$('#view [data-model]').forEach(el => el.onclick = () => openModel(el.dataset.model));
  $$('#view [data-goto]').forEach(el => el.onclick = (e) => {
    e.preventDefault(); state.tab = el.dataset.goto; render(); window.scrollTo(0, 0);
  });
  $$('#view pre .cp').forEach(b => b.onclick = () => copy(b.nextElementSibling.textContent, b));

  $$('#view [data-rank]').forEach(el => el.onclick = () => openTop(el.dataset.rank));
  $$('#view [data-rf]').forEach(b => b.onclick = () => { state.rankFilter = b.dataset.rf; render(); });

  $$('#view [data-fk]').forEach(b => b.onclick = () => { state.filterKind = b.dataset.fk; render(); });
  $$('#view [data-ft]').forEach(b => b.onclick = () => {
    state.filterTier = state.filterTier === b.dataset.ft ? 'all' : b.dataset.ft; render();
  });
  $$('#view [data-tag]').forEach(b => b.onclick = () => {
    state.tag = state.tag === b.dataset.tag ? 'all' : b.dataset.tag; render();
  });

  const q = $('#q');
  if (q) {
    q.oninput = () => {
      state.q = q.value;
      const pos = q.selectionStart;
      render();
      const nq = $('#q'); nq.focus(); nq.setSelectionRange(pos, pos);
    };
  }

  /* 实验室 */
  const sb = $('#submitTicket');
  if (sb) sb.onclick = submitTicket;
  const em = $('#exportMine');
  if (em) em.onclick = () => exportTickets('我的留言');
  const ib = $('#importBtn');
  if (ib) ib.onclick = () => $('#importFile').click();
  const ifile = $('#importFile');
  if (ifile) ifile.onchange = importTickets;
  const eb = $('#exportBtn');
  if (eb) eb.onclick = () => exportTickets('全部工单');
  const eo = $('#exitOwner');
  if (eo) eo.onclick = () => { state.owner = false; localStorage.removeItem(LS_OWNER); render(); toast('已退出站长模式'); };

  $$('#view [data-st]').forEach(b => b.onclick = () => setStatus(b.dataset.st, b.dataset.v));
  $$('#view [data-del]').forEach(b => b.onclick = () => delTicket(b.dataset.del));
  $$('#view [data-reply]').forEach(b => b.onclick = () => replyTicket(b.dataset.reply));
}

/* ---------- 工单逻辑 ---------- */
function loadTickets() {
  try { state.tickets = JSON.parse(localStorage.getItem(LS_TICKETS) || '[]'); }
  catch (e) { state.tickets = []; }
  state.owner = localStorage.getItem(LS_OWNER) === '1';
}
function saveTickets() {
  localStorage.setItem(LS_TICKETS, JSON.stringify(state.tickets));
}

const TYPE_LABEL = {
  missing: '想看的没收录', error: '教程有错', exp: '实测数据', other: '其他建议'
};

function submitTicket() {
  const title = $('#tTitle').value.trim();
  const body = $('#tBody').value.trim();
  const type = $('#tType').value;
  const contact = $('#tContact').value.trim();
  if (!title) { toast('标题写一句，不然我不知道你要测什么'); $('#tTitle').focus(); return; }
  state.tickets.push({
    id: 'tk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title, body, type, typeLabel: TYPE_LABEL[type], contact,
    status: 'open', createdAt: Date.now(), replies: []
  });
  saveTickets();
  render();
  toast('已提交，可在下方列表看到（记得导出 JSON 发给我）');
}

function setStatus(id, v) {
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;
  t.status = v;
  saveTickets(); render();
  toast('状态已改为「' + TICKET_STATUS[v].label + '」');
}

function delTicket(id) {
  if (!confirm('删除这条工单？不可恢复。')) return;
  state.tickets = state.tickets.filter(x => x.id !== id);
  saveTickets(); render(); toast('已删除');
}

function replyTicket(id) {
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;
  const text = prompt('你的实测结论（会公开显示在工单下）：\n\n工单：' + t.title);
  if (text == null || !text.trim()) return;
  const st = prompt('把状态改成？\n输入：resolved（已验证）/ testing（测试中）/ ignored（不采纳）', 'resolved');
  const status = ['resolved', 'testing', 'ignored'].includes(st) ? st : 'resolved';
  t.replies = t.replies || [];
  t.replies.push({ at: Date.now(), text: text.trim(), status });
  t.status = status;
  saveTickets(); render(); toast('已回帖并更新状态');
}

function exportTickets(label) {
  if (!state.tickets.length) { toast('还没有工单可导出'); return; }
  const data = { app: 'model-hub', version: DATA_VERSION, exportedAt: new Date().toISOString(), tickets: state.tickets };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `modelhub-${label}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('已导出，把文件发给我即可');
}

function importTickets(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      const incoming = d.tickets || [];
      let added = 0;
      incoming.forEach(t => {
        if (!state.tickets.some(x => x.id === t.id)) { state.tickets.push(t); added++; }
      });
      saveTickets(); render();
      toast(`导入完成，新增 ${added} 条（共 ${state.tickets.length} 条）`);
    } catch (err) { toast('文件解析失败，不是有效的 JSON'); }
  };
  r.readAsText(f);
  e.target.value = '';
}

/* ---------- 启动 ---------- */
function init() {
  loadTickets();
  $$('nav.tabs button').forEach(b => b.onclick = () => { state.tab = b.dataset.tab; render(); });
  $('#overlay').onclick = closePanel;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePanel();
    /* 连续按两次 O 进站长模式 */
    if (e.key.toLowerCase() === 'o') {
      window._oo = window._oo || 0; window._oo++;
      setTimeout(() => window._oo = 0, 600);
      if (window._oo === 2 && state.tab === 'lab') {
        state.owner = true; localStorage.setItem(LS_OWNER, '1');
        render(); toast('站长模式已开启');
      }
    }
  });
  $('#ver').textContent = DATA_VERSION;
  render();
}
document.addEventListener('DOMContentLoaded', init);
