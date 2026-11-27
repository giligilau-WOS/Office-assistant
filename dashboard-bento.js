/**
 * ============================================================================
 * 總務行政戰情助理 — 戰情總覽「07 暖沙雙層黃金艙 × 05 特大字」(dashboard-bento.js)
 * 依 UI_DESIGN_RULES.md §1.2 定案版面：
 *   上層 Zone Top：6 大業務健康指標橫列（頂部 4px 語意色條、28px 數字、單行摘要，點擊直達）
 *   下層 5 : 4 : 3：Zone A 近期必辦佇列（時間桶分頁籤 7日內／30日／全覽 ＋ 頁碼）
 *                   Zone B 執行中標案與里程碑（進度條、下一死線）
 *                   Zone C 抬頭交辦便利貼（清單 ＋ 快速輸入 ＋ 年末續約捷徑）
 * 桌機 ≥1024×600 鎖定 100dvh 零外層捲動；每區每頁筆數依容器實際高度自動計算（不靠摺疊藏資料）。
 * 透過 GA_CORE.registerView('dashboard') 掛載，不覆寫 renderCurrentView、不產生隱形舊 DOM。
 * ============================================================================
 */

(function initDashboardBento() {
  const GA = window.GA_CORE;
  if (!GA) return;

  const st = {
    bucket: 'd7',
    page: { A: 0, B: 0, C: 0 },
    size: { A: 5, B: 4, C: 5 },
    adjusting: 0,
    memoOpts: false
  };
  try { const b = localStorage.getItem('ga_dash_bucket'); if (['d7', 'd30', 'all'].includes(b)) st.bucket = b; } catch {}

  // --------------------------------------------------------------------------
  // 樣式（tokens 來自 ga-core.js）
  // --------------------------------------------------------------------------
  if (!document.getElementById('ga-dash-style')) {
    const s = document.createElement('style');
    s.id = 'ga-dash-style';
    s.textContent = `
      @layer modules {
        #ga-dash { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: var(--gap-canvas); flex: 1 1 auto; min-height: 0; height: 100%;
          color: var(--text-primary); font-size: var(--fs-base); }
        .ga-tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
        .ga-tile { position: relative; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px;
          padding: 14px 14px 10px; cursor: pointer; min-width: 0; overflow: hidden; text-align: left; display: flex; flex-direction: column; gap: 2px; }
        .ga-tile::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 4px; background: var(--border-strong); }
        .ga-tile.lv-red::before { background: var(--status-danger); }
        .ga-tile.lv-amber::before { background: var(--status-warn); }
        .ga-tile.lv-ok::before { background: var(--status-ok); }
        .ga-tile:hover, .ga-tile:focus-visible { border-color: var(--brand-primary); outline: none; }
        .ga-tile-hd { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: var(--fs-sm); font-weight: 700; color: var(--text-secondary); }
        .ga-tile-badge { font-size: var(--fs-xs); font-weight: 800; border-radius: 999px; padding: 0 8px; }
        .ga-tile-badge.red { background: var(--status-danger-bg); color: var(--status-danger); }
        .ga-tile-badge.amber { background: var(--status-warn-bg); color: var(--status-warn); }
        .ga-tile-num { font-size: var(--fs-kpi); font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; color: var(--text-primary); }
        .ga-tile-num small { font-size: var(--fs-sm); font-weight: 600; color: var(--text-muted); margin-left: 4px; }
        .ga-tile-hint { font-size: var(--fs-sm); color: var(--text-secondary); line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.7em; }

        .ga-zones { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) minmax(0, 3fr); gap: var(--gap-canvas); min-height: 0; }
        .ga-panel { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; display: flex; flex-direction: column; min-height: 0; min-width: 0; }
        .ga-panel-hd { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 16px 8px; }
        .ga-panel-hd h3 { margin: 0; font-size: var(--fs-lg); font-weight: 800; color: var(--text-primary); }
        .ga-tabs { display: inline-flex; gap: 4px; margin-left: auto; }
        .ga-tab { font-size: var(--fs-sm) !important; font-weight: 700; padding: 4px 10px !important; min-height: 32px; border-radius: 999px !important;
          border: 1px solid var(--border-subtle) !important; background: var(--bg-subtle) !important; color: var(--text-secondary) !important; box-shadow: none !important; }
        .ga-tab.on { background: var(--brand-primary) !important; color: #fff !important; border-color: var(--brand-primary) !important; }
        .ga-list { flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 8px; padding: 0 12px; }
        .ga-pager { display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 8px 12px; font-size: var(--fs-sm); color: var(--text-muted);
          font-variant-numeric: tabular-nums; }
        .ga-pager button { min-height: 30px; padding: 2px 10px !important; font-size: var(--fs-sm) !important; }
        .ga-empty { padding: 16px 6px; color: var(--text-muted); font-size: var(--fs-sm); }

        .ga-q { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--border-subtle); border-left: 4px solid var(--border-strong);
          border-radius: 10px; flex-shrink: 0; }
        .ga-q.t0 { border-left-color: var(--status-danger); }
        .ga-q.t1 { border-left-color: var(--status-warn); }
        .ga-q.t2 { border-left-color: var(--status-info); }
        .ga-q-main { flex: 1 1 auto; min-width: 0; }
        .ga-q-title { font-size: var(--fs-base); font-weight: 700; line-height: 1.35; color: var(--text-primary);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ga-chip { display: inline-block; font-size: var(--fs-xs); font-weight: 700; padding: 0 7px; border-radius: 6px; margin-right: 6px; vertical-align: 1px;
          background: var(--bg-subtle); color: var(--text-secondary); border: 1px solid var(--border-subtle); }
        .ga-q-hint { font-size: var(--fs-sm); color: var(--text-secondary); margin-top: 2px; line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .ga-q-side { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .ga-due { font-size: var(--fs-sm); font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--text-secondary); }
        .ga-due.t0 { color: var(--status-danger); }
        .ga-due.t1 { color: var(--status-warn); }
        .ga-q-btns { display: flex; gap: 6px; }
        .ga-q-btns button { min-height: 30px; padding: 2px 10px !important; font-size: var(--fs-sm) !important; white-space: nowrap; }

        .ga-p { padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: 10px; cursor: pointer; flex-shrink: 0; }
        .ga-p:hover, .ga-p:focus-visible { border-color: var(--brand-primary); outline: none; }
        .ga-p-title { font-size: var(--fs-base); font-weight: 700; line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ga-p-meta { display: flex; justify-content: space-between; gap: 8px; font-size: var(--fs-sm); color: var(--text-secondary); margin-top: 4px; }
        .ga-p-meta span:first-child { min-width: 0; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .ga-bar { height: 6px; border-radius: 999px; background: var(--bg-subtle); margin-top: 6px; overflow: hidden; }
        .ga-bar i { display: block; height: 100%; background: var(--brand-accent); border-radius: 999px; }

        .ga-m { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: 10px;
          background: #FFFDF6; flex-shrink: 0; }
        .ga-m input[type=checkbox] { width: 18px; height: 18px; margin-top: 3px; flex-shrink: 0; accent-color: var(--brand-primary); }
        .ga-m-txt { flex: 1 1 auto; min-width: 0; font-size: var(--fs-base); line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ga-m-meta { font-size: var(--fs-xs); color: var(--text-muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
        .ga-m.urgent { border-left: 4px solid var(--status-danger); }
        .ga-flash { box-shadow: 0 0 0 3px var(--status-warn); transition: box-shadow .3s; }
        .ga-memo-add { padding: 8px 12px 12px; border-top: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 6px; }
        .ga-memo-row { display: flex; gap: 6px; }
        .ga-memo-row input[type=text] { flex: 1 1 auto; min-width: 0; font-size: var(--fs-base); padding: 6px 10px; border: 1px solid var(--border-strong); border-radius: 8px; }
        .ga-memo-row button { white-space: nowrap; font-size: var(--fs-sm) !important; }
        .ga-memo-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: var(--fs-xs); color: var(--text-muted); }
        .ga-memo-opts[hidden] { display: none; }
        .ga-memo-opts select, .ga-memo-opts input { width: 100%; font-size: var(--fs-sm); padding: 4px 6px; border: 1px solid var(--border-strong); border-radius: 6px; }
        .ga-link { background: transparent !important; border: none !important; box-shadow: none !important; color: var(--brand-primary) !important;
          font-weight: 700; font-size: var(--fs-sm) !important; padding: 2px 0 !important; text-align: left; cursor: pointer; }
      }
      @media (max-width: 1279px) and (min-width: 1024px) {
        .ga-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .ga-tile-hint { -webkit-line-clamp: 1; min-height: 1.35em; }
      }
      @media (max-width: 1023px) {
        #ga-dash { height: auto; grid-template-rows: auto auto; }
        .ga-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .ga-zones { grid-template-columns: minmax(0, 1fr); }
        .ga-list { overflow: visible; }
      }
      @media (min-width: 768px) and (max-width: 1023px) {
        .ga-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .ga-zones { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .ga-zones > .ga-panel:first-child { grid-column: 1 / -1; }
      }
    `;
    document.head.appendChild(s);
  }

  // --------------------------------------------------------------------------
  // 資料
  // --------------------------------------------------------------------------
  const isDone = v => v === true || String(v).toUpperCase() === 'TRUE';
  const T = () => (typeof appData !== 'undefined' && appData.tables) || {};
  const q = () => (document.getElementById('global-search')?.value || '').trim().toLowerCase();
  const matchQ = (text) => { const k = q(); return !k || String(text).toLowerCase().includes(k); };
  const tierCls = t => `t${t}`;

  function levelOf(list) {
    if (list.some(i => i.tier === 0)) return 'red';
    if (list.some(i => i.tier === 1)) return 'amber';
    return 'ok';
  }

  function tilesData(items) {
    const t = T();
    const activeProjects = (t.Projects || []).filter(p => !['已結案', '廢標撤案'].includes(p.status) && !isDone(p.is_deleted));
    const routines = (t.Annual_Routines || []).filter(r => r.is_active !== false && String(r.is_active).toUpperCase() !== 'FALSE' && !isDone(r.is_deleted));
    const solar = (t.Solar_Contracts || []).filter(c => !['已屆滿', '已期滿', '已解約'].includes(c.status) && !isDone(c.is_deleted));
    const smallPrj = activeProjects.filter(p => /小額/.test(p.threshold_tier || ''));
    const safetyCats = ['設施安檢維運', '法定填報'];
    const safetyIds = new Set(routines.filter(r => safetyCats.includes(r.category)).map(r => `rt:${r.routine_id}`));
    const greenIds = new Set(routines.filter(r => /綠色採購|優先採購|一般小額採購|共同供應契約/.test(`${r.title}${r.category}`)).map(r => `rt:${r.routine_id}`));

    const near = list => list.filter(i => i.tier <= 2);
    const top = list => list[0] ? `${list[0].smart.title}・${GA.relText(list[0].daysLeft)}` : '✓ 30 日內無待辦';
    const mk = (key, icon, name, num, unit, list, extraHint, onClick) => ({
      key, icon, name, num, unit, level: list.length ? levelOf(list) : 'ok',
      red: list.filter(i => i.tier === 0).length, amber: list.filter(i => i.tier === 1).length,
      hint: extraHint || top(list), onClick
    });

    const prjItems = near(items.filter(i => i.module === 'project'));
    const rtItems = near(items.filter(i => i.module === 'routine' && !safetyIds.has(i.id)));
    const energyItems = near(items.filter(i => i.module === 'solar' || i.module === 'util'));
    const greenItems = near(items.filter(i => greenIds.has(i.id)));
    const safetyItems = near(items.filter(i => safetyIds.has(i.id)));

    return [
      mk('project', '🏗️', '採購工程', activeProjects.length, '案執行中', prjItems, '', "switchTab('projects')"),
      mk('routine', '🔁', '例行與續約', routines.length, '項列管', rtItems, '', "switchTab('routines')"),
      mk('energy', '☀️', '光電與水電', solar.length, '份光電契約', energyItems, '', "switchTab('solar')"),
      mk('small', '🧾', '小額・綠採・優採', smallPrj.length, '案小額', greenItems, greenItems.length ? '' : '三軌台帳建置中・30 日內無申報', "switchTab('routines')"),
      mk('safety', '🛡️', '法定安檢牆', safetyIds.size, '項法定作業', safetyItems, '', "switchTab('routines')"),
      { key: 'venue', icon: '🏟️', name: '場地借用圖', num: '3D', unit: '校舍', level: 'none', red: 0, amber: 0,
        hint: '3D 校舍可檢視・平面時段看板建置中', onClick: "window.open('./campus-3d.html','_blank','noopener')" }
    ];
  }

  function bucketItems(items) {
    const f = items.filter(i => matchQ(`${i.title} ${i.badge} ${i.actionHint}`));
    return {
      d7: f.filter(i => i.tier <= 1),
      d30: f.filter(i => i.tier === 2),
      all: f
    };
  }

  function projectRows() {
    const t = T();
    const today = todayStr();
    return (t.Projects || [])
      .filter(p => !['已結案', '廢標撤案'].includes(p.status) && !isDone(p.is_deleted) && matchQ(`${p.project_id} ${p.project_name}`))
      .map(p => {
        const tasks = (typeof getProjectTasks === 'function' ? getProjectTasks(p.project_id) : []).filter(x => !isDone(x.is_deleted));
        const prog = typeof calcProjectProgress === 'function' ? calcProjectProgress(p.project_id) : { pct: 0, currentStage: '-' };
        const dls = tasks.filter(x => x.status !== '已完成').map(x => x.sla_deadline).filter(Boolean);
        if (p.grant_deadline) dls.push(p.grant_deadline);
        const next = dls.filter(d => d >= today).sort()[0] || dls.sort()[0] || '';
        const flags = parseJSON(p.flags_json, {});
        return { p, prog, next, linked: flags.linked_project_id || '' };
      })
      .sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999'));
  }

  function memoRows() {
    const prio = { '緊急': 0, '重要': 1 };
    return (T().Quick_Memos || [])
      .filter(m => !isDone(m.is_done) && !isDone(m.is_deleted) && matchQ(m.content))
      .sort((a, b) => ((prio[a.priority] ?? 2) - (prio[b.priority] ?? 2))
        || String(a.due_date || a.remind_date || '9999').localeCompare(String(b.due_date || b.remind_date || '9999')));
  }

  function renewCount(items) {
    return items.filter(i => i.module === 'routine' && i.daysLeft >= 0 && i.daysLeft <= 45 && /小額採購|共同供應|招標預告|續約/.test(`${i.badge}${i.title}`)).length;
  }

  // --------------------------------------------------------------------------
  // 繪製
  // --------------------------------------------------------------------------
  const pageOf = (list, key) => {
    const size = Math.max(1, st.size[key]);
    const pages = Math.max(1, Math.ceil(list.length / size));
    if (st.page[key] >= pages) st.page[key] = pages - 1;
    return { rows: list.slice(st.page[key] * size, st.page[key] * size + size), pages };
  };
  const pager = (key, pages, total) => pages > 1
    ? `<div class="ga-pager"><span>共 ${total} 筆</span><button type="button" onclick="gaDashPage('${key}',-1)" ${st.page[key] === 0 ? 'disabled' : ''} aria-label="上一頁">◀</button>
        <span>第 ${st.page[key] + 1} / ${pages} 頁</span><button type="button" onclick="gaDashPage('${key}',1)" ${st.page[key] >= pages - 1 ? 'disabled' : ''} aria-label="下一頁">▶</button></div>`
    : `<div class="ga-pager"><span>共 ${total} 筆</span></div>`;

  function render() {
    const items = GA.collectUrgentItems();
    window._gaDashItems = [];
    const tiles = tilesData(items);
    const buckets = bucketItems(items);
    const listA = buckets[st.bucket];
    const A = pageOf(listA, 'A');
    const prj = projectRows();
    const B = pageOf(prj, 'B');
    const memos = memoRows();
    const C = pageOf(memos, 'C');
    const renew = renewCount(items);

    const tileHTML = tiles.map(t => `
      <button type="button" class="ga-tile lv-${t.level}" onclick="${t.onClick}" title="${esc(t.name)}：${esc(t.hint)}">
        <div class="ga-tile-hd"><span>${t.icon} ${esc(t.name)}</span>
          ${t.red ? `<span class="ga-tile-badge red">逾期 ${t.red}</span>` : t.amber ? `<span class="ga-tile-badge amber">7日內 ${t.amber}</span>` : ''}</div>
        <div class="ga-tile-num">${esc(String(t.num))}<small>${esc(t.unit)}</small></div>
        <div class="ga-tile-hint">${esc(t.hint)}</div>
      </button>`).join('');

    const rowA = A.rows.map(it => {
      const i = window._gaDashItems.push(it) - 1;
      return `
        <div class="ga-q ${tierCls(it.tier)}">
          <div class="ga-q-main">
            <div class="ga-q-title" title="${esc(it.smart.full)}"><span class="ga-chip">${esc(it.badge)}</span>${it.smart.year ? `<span class="ga-yr">${esc(it.smart.year)}</span>` : ''}${esc(it.smart.title)}</div>
            <div class="ga-q-hint">— ${esc(it.actionHint)}</div>
          </div>
          <div class="ga-q-side">
            <div class="ga-due ${tierCls(it.tier)}">${esc(GA.formatRocDate(it.dueDate))}（${esc(GA.relText(it.daysLeft))}）</div>
            <div class="ga-q-btns">
              <button type="button" onclick="gaDashCopy(${i})" title="複製催辦詞／提醒文字">📋 複製催辦詞</button>
              <button type="button" class="btn-primary" onclick="gaDashAct(${i})">${esc(it.actionLabel)}</button>
            </div>
          </div>
        </div>`;
    }).join('');

    const rowB = B.rows.map(r => {
      const d = r.next ? GA.daysLeft(r.next) : null;
      return `
        <div class="ga-p" role="button" tabindex="0" onclick="openProjectDetail('${esc(r.p.project_id)}')" onkeydown="if(event.key==='Enter'){openProjectDetail('${esc(r.p.project_id)}')}" title="${esc(r.p.project_name)}">
          <div class="ga-p-title">${GA.smartTitleHTML(r.p.project_name)}</div>
          <div class="ga-bar"><i style="width:${Math.max(0, Math.min(100, r.prog.pct))}%"></i></div>
          <div class="ga-p-meta"><span>${esc(r.prog.currentStage)}・${r.prog.pct}%${r.linked ? `・🔗 ${esc(r.linked)}` : ''}</span>
            <span class="ga-due ${d !== null && d < 0 ? 't0' : d !== null && d <= 7 ? 't1' : ''}">${r.next ? `${esc(GA.formatRocDate(r.next))}（${esc(GA.relText(d))}）` : '無死線'}</span></div>
        </div>`;
    }).join('');

    const today = todayStr();
    const rowC = C.rows.map(m => {
      const due = m.due_date || m.remind_date;
      const d = due ? GA.daysLeft(due) : null;
      return `
        <label class="ga-m ${m.priority === '緊急' ? 'urgent' : ''}" data-memo-id="${esc(m.memo_id)}">
          <input type="checkbox" onchange="toggleMemoDone('${esc(m.memo_id)}', this.checked)" aria-label="完成">
          <span style="min-width:0;flex:1">
            <span class="ga-m-txt">${m.priority && m.priority !== '一般' ? `<span class="ga-chip">${esc(m.priority)}</span>` : ''}${esc(m.content)}</span>
            ${due ? `<span class="ga-m-meta" style="display:block">${m.due_date ? '期限' : '提醒'} ${esc(GA.formatRocDate(due))}（${esc(GA.relText(d))}）</span>` : ''}
          </span>
        </label>`;
    }).join('');
    void today;

    return `
      <div id="ga-dash">
        <div class="ga-tiles">${tileHTML}</div>
        <div class="ga-zones">
          <section class="ga-panel" aria-label="近期必辦佇列">
            <div class="ga-panel-hd">
              <h3>🚨 近期必辦佇列</h3>
              <div class="ga-tabs" role="tablist">
                <button type="button" class="ga-tab ${st.bucket === 'd7' ? 'on' : ''}" onclick="gaDashBucket('d7')">🔴 7日內 ${buckets.d7.length}</button>
                <button type="button" class="ga-tab ${st.bucket === 'd30' ? 'on' : ''}" onclick="gaDashBucket('d30')">🟡 30日 ${buckets.d30.length}</button>
                <button type="button" class="ga-tab ${st.bucket === 'all' ? 'on' : ''}" onclick="gaDashBucket('all')">🔵 全覽 ${buckets.all.length}</button>
              </div>
            </div>
            <div class="ga-list" id="ga-list-A">${rowA || `<div class="ga-empty">${q() ? '沒有符合搜尋的項目' : st.bucket === 'd7' ? '✓ 7 日內沒有到期或逾期事項' : '✓ 此區間沒有待辦'}</div>`}</div>
            ${pager('A', A.pages, listA.length)}
          </section>
          <section class="ga-panel" aria-label="執行中標案">
            <div class="ga-panel-hd"><h3>🏗️ 執行中標案</h3><button type="button" class="ga-link" style="margin-left:auto" onclick="switchTab('annual-gantt')">📅 全校時間軸 →</button></div>
            <div class="ga-list" id="ga-list-B">${rowB || '<div class="ga-empty">目前沒有執行中標案</div>'}</div>
            ${pager('B', B.pages, prj.length)}
          </section>
          <section class="ga-panel" aria-label="交辦便利貼">
            <div class="ga-panel-hd"><h3>📌 交辦便利貼</h3>
              ${renew ? `<button type="button" class="ga-link" style="margin-left:auto" onclick="switchTab('routines')">⚡ ${renew} 件續約 →</button>` : ''}</div>
            <div class="ga-list" id="ga-list-C">${rowC || '<div class="ga-empty">✓ 沒有待辦交辦</div>'}</div>
            ${pager('C', C.pages, memos.length)}
            <div class="ga-memo-add">
              <div class="ga-memo-row">
                <input id="memo-input" type="text" placeholder="記一筆交辦，按 Enter 存檔" onkeydown="if(event.key==='Enter') quickAddMemo()">
                <button type="button" class="btn-primary" onclick="quickAddMemo()">＋ 記錄</button>
              </div>
              <button type="button" class="ga-link" onclick="gaDashMemoOpts()">${st.memoOpts ? '收合選項' : '＋ 期限／分類'}</button>
              <div class="ga-memo-opts" ${st.memoOpts ? '' : 'hidden'}>
                <label>分類<select id="memo-tag">${['校長交辦', '處室需求', '廠商追蹤', '現場會勘', '自訂備忘'].map(x => `<option value="${x}">${x}</option>`).join('')}</select></label>
                <label>緊急度<select id="memo-prio"><option value="一般">一般</option><option value="重要">重要</option><option value="緊急">緊急</option></select></label>
                <label>提醒日<input id="memo-remind" type="date"></label>
                <label>期限<input id="memo-due" type="date"></label>
              </div>
            </div>
          </section>
        </div>
      </div>`;
  }

  // 依容器實際高度計算每頁筆數（不溢出、不靠摺疊）
  function fitPageSizes() {
    if (window.innerWidth < 1024 || window.innerHeight < 600) {
      const changed = st.size.A !== 8 || st.size.B !== 6 || st.size.C !== 8;
      st.size = { A: 8, B: 6, C: 8 };
      return changed;
    }
    let changed = false;
    ['A', 'B', 'C'].forEach(k => {
      const list = document.getElementById(`ga-list-${k}`);
      if (!list) return;
      const rows = [...list.children].filter(el => !el.classList.contains('ga-empty'));
      if (!rows.length) return;
      const gap = 8;
      const rowH = Math.max(...rows.map(r => r.getBoundingClientRect().height));
      const fit = Math.max(1, Math.floor((list.clientHeight + gap) / (rowH + gap)));
      const overflow = list.scrollHeight > list.clientHeight + 1;
      let target = st.size[k];
      if (overflow) target = Math.max(1, Math.min(st.size[k] - 1, fit));
      else if (fit > st.size[k]) target = fit;
      if (target !== st.size[k]) { st.size[k] = target; changed = true; }
    });
    return changed;
  }

  function afterRender() {
    if (st.adjusting > 4) { st.adjusting = 0; return; }
    if (fitPageSizes()) { st.adjusting++; renderCurrentView(); return; }
    st.adjusting = 0;
  }

  window.gaDashBucket = b => { st.bucket = b; st.page.A = 0; try { localStorage.setItem('ga_dash_bucket', b); } catch {} renderCurrentView(); };
  window.gaDashPage = (k, d) => { st.page[k] = Math.max(0, st.page[k] + d); renderCurrentView(); };
  window.gaDashCopy = i => { const it = (window._gaDashItems || [])[i]; if (it) GA.copyText(it.copyText, '📋 已複製催辦詞，可直接貼到 LINE 或公文'); };
  window.gaDashAct = i => { const it = (window._gaDashItems || [])[i]; if (it && typeof it.onAction === 'function') it.onAction(); };
  window.gaDashMemoOpts = () => { st.memoOpts = !st.memoOpts; renderCurrentView(); setTimeout(() => document.getElementById('memo-input')?.focus(), 0); };

  let rz = null;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { if (typeof currentTab !== 'undefined' && currentTab === 'dashboard') { st.size = { A: 5, B: 4, C: 5 }; renderCurrentView(); } }, 180);
  });

  GA.registerView('dashboard', { render, afterRender });
  GA.registerModule({ id: 'dashboard-bento', title: '戰情總覽', navGroup: 'overview', icon: '📊' });
})();
