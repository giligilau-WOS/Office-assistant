/**
 * ============================================================================
 * 學校總務行政助理 — 全校甘特圖連續時間軸 (gantt-timeline.js)
 *
 * 取代原「單一年度」甘特圖（只列會計年度＝該年之標案、且階段截在 1/1～12/31），
 * 改為跨年度連續時間軸、左右滑移：
 *   - 標案名稱欄固定於左側，時間軸可一路捲動（115→116→117…），開啟時自動捲到今天
 *   - 每案一列總覽（各階段依狀態上色），可展開逐階段檢視
 *   - 狀態色：完成＝綠、進行中＝藍、逾期未完成＝紅、未開始＝灰；上級／法定死線＝紅色菱形
 *   - 月份負荷列：各月預計「開標／驗收」件數（≥3 件標橘）
 * 年度 PDF 仍保留，並改為列出「當年有任何工作」的標案。
 * ============================================================================
 */

(function initGanttTimeline() {
  if (typeof renderAnnualGanttHTML !== 'function') return;

  const ZOOMS = [1.6, 2.6, 4.2, 7];   // 每日像素
  const NAME_W = 280;
  const st = { zoom: 1, showClosed: false, expanded: new Set(), scrollLeft: null, scrollTop: 0, lastKey: '' };
  try {
    const saved = JSON.parse(localStorage.getItem('ga_gantt_timeline_v1') || '{}');
    if (Number.isInteger(saved.zoom) && saved.zoom >= 0 && saved.zoom < ZOOMS.length) st.zoom = saved.zoom;
    st.showClosed = !!saved.showClosed;
    (saved.expanded || []).forEach(id => st.expanded.add(id));
  } catch {}
  const savePrefs = () => {
    try { localStorage.setItem('ga_gantt_timeline_v1', JSON.stringify({ zoom: st.zoom, showClosed: st.showClosed, expanded: [...st.expanded] })); } catch {}
  };

  // --------------------------------------------------------------------------
  // 樣式
  // --------------------------------------------------------------------------
  if (!document.getElementById('gantt-timeline-style')) {
    const s = document.createElement('style');
    s.id = 'gantt-timeline-style';
    s.textContent = `
      .gt-toolbar { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
      .gt-toolbar .gt-sep { width:1px; height:24px; background:var(--border,#E2E8F0); margin:0 4px; }
      .gt-legend { display:flex; gap:14px; flex-wrap:wrap; align-items:center; font-size:12.5px; color:var(--muted,#475569); margin:0 0 8px; }
      .gt-legend i { display:inline-block; width:14px; height:10px; border-radius:3px; margin-right:5px; vertical-align:-1px; }
      .gt-legend .gt-dia { width:9px; height:9px; transform:rotate(45deg); border-radius:1px; background:#DC2626; }
      .gt-scroll { position:relative; overflow:auto; max-height:calc(100vh - 250px); min-height:260px; border:1px solid var(--border,#E2E8F0); border-radius:8px; background:#fff; overscroll-behavior-x:contain; }
      .gt-canvas { position:relative; }
      .gt-row { display:flex; min-height:38px; }
      .gt-row > .gt-name, .gt-row > .gt-track { border-bottom:1px solid #EEF2F6; }
      .gt-row.gt-stage { min-height:30px; background:#FCFDFE; }
      .gt-name { position:sticky; left:0; z-index:6; width:${NAME_W}px; min-width:${NAME_W}px; background:#fff; border-right:1px solid var(--border,#E2E8F0); padding:6px 10px; display:flex; align-items:center; gap:6px; box-sizing:border-box; }
      .gt-row.gt-stage .gt-name { background:#FCFDFE; padding-left:34px; font-size:12.5px; color:#334155; }
      .gt-name .gt-tog { border:none !important; background:transparent !important; box-shadow:none !important; padding:2px 4px !important; min-height:0 !important; cursor:pointer; color:#475569; font-size:12px; flex-shrink:0; }
      .gt-name .gt-pname { font-weight:700; font-size:13.5px; color:#1D4ED8; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .gt-name .gt-meta { font-size:12px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .gt-name .gt-sname { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .gt-track { position:relative; flex-shrink:0; }
      .gt-head { position:sticky; top:0; z-index:8; background:#F8FAFC; }
      .gt-head .gt-name { background:#F1F5F9; z-index:9; font-weight:700; font-size:13px; color:#334155; }
      .gt-head .gt-row { min-height:26px; }
      .gt-head .gt-row > .gt-name, .gt-head .gt-row > .gt-track { border-bottom:1px solid var(--border,#E2E8F0); }
      .gt-today-tag { position:absolute; top:3px; transform:translateX(-50%); background:#DC2626; color:#fff; font-size:12px; font-weight:700; padding:1px 6px; border-radius:4px; white-space:nowrap; z-index:3; pointer-events:none; }
      .gt-cell { position:absolute; top:0; bottom:0; border-left:1px solid #E2E8F0; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#334155; overflow:hidden; white-space:nowrap; }
      .gt-cell.gt-year { justify-content:flex-start; padding-left:0; font-size:13px; color:#1E3A5F; border-left:2px solid #94A3B8; overflow:visible; }
      .gt-cell.gt-year span { position:sticky; left:${NAME_W + 8}px; padding:0 8px; }
      .gt-cell.gt-load { font-weight:600; color:#64748B; font-size:12px; }
      .gt-cell.gt-load.hot { background:#FEF3C7; color:#B45309; font-weight:800; }
      .gt-grid { position:absolute; top:0; bottom:0; width:1px; background:#F1F5F9; pointer-events:none; }
      .gt-grid.yr { background:#CBD5E1; }
      .gt-bar { position:absolute; top:50%; height:14px; margin-top:-7px; border-radius:4px; min-width:4px; cursor:pointer; opacity:.92; }
      .gt-row.gt-stage .gt-bar { height:12px; margin-top:-6px; }
      .gt-bar:hover { opacity:1; outline:2px solid rgba(15,23,42,.25); }
      .gt-bar.s-done { background:#059669; }
      .gt-bar.s-doing { background:#2563EB; }
      .gt-bar.s-late { background:#DC2626; }
      .gt-bar.s-todo { background:#94A3B8; }
      .gt-span { position:absolute; top:50%; height:22px; margin-top:-11px; border-radius:6px; background:rgba(148,163,184,.14); border:1px dashed #CBD5E1; pointer-events:none; }
      .gt-dia { position:absolute; top:50%; width:10px; height:10px; margin:-5px 0 0 -5px; background:#DC2626; transform:rotate(45deg); border:1px solid #fff; box-shadow:0 0 0 1px #DC2626; z-index:2; cursor:help; }
      .gt-today { position:absolute; top:0; bottom:0; width:2px; background:#DC2626; z-index:4; pointer-events:none; }
      .gt-empty { padding:30px; text-align:center; color:#64748B; }
      @media (max-width: 760px) { .gt-name { width:170px; min-width:170px; } .gt-row.gt-stage .gt-name { padding-left:22px; } }
      body[data-nordic-theme="obsidian"] .gt-scroll, body[data-nordic-theme="obsidian"] .gt-name { background:#1C1F26; color:#E5E7EB; }
      body[data-nordic-theme="obsidian"] .gt-head, body[data-nordic-theme="obsidian"] .gt-head .gt-name { background:#14161A; }
    `;
    document.head.appendChild(s);
  }

  // --------------------------------------------------------------------------
  // 資料
  // --------------------------------------------------------------------------
  const DAY = 86400000;
  const toTime = ymd => Date.parse(String(ymd).slice(0, 10) + 'T00:00:00Z');
  const fromTime = t => new Date(t).toISOString().slice(0, 10);
  const roc = ymd => { const [y, m, d] = String(ymd).split('-').map(Number); return `${y - 1911}/${m}/${d}`; };
  const monthStart = ymd => `${String(ymd).slice(0, 7)}-01`;
  const addMonthsYmd = (ymd, n) => {
    const [y, m] = String(ymd).split('-').map(Number);
    const t = y * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
  };

  function taskStatus(t, today) {
    if (t.status === '已完成') return 'done';
    if (t.plan_end && t.plan_end < today) return 'late';
    if (t.status === '進行中') return 'doing';
    return 'todo';
  }
  const STATUS_LABEL = { done: '已完成', doing: '進行中', late: '逾期未完成', todo: '未開始' };

  function collectProjects() {
    const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
    return (appData.tables.Projects || [])
      .filter(p => p.status !== '廢標撤案' && (st.showClosed || p.status !== '已結案'))
      .filter(p => !q || `${p.project_id} ${p.project_name}`.toLowerCase().includes(q))
      .map(p => {
        const tasks = getProjectTasks(p.project_id).filter(t => t.plan_start && t.plan_end);
        const start = tasks.length ? tasks.reduce((m, t) => t.plan_start < m ? t.plan_start : m, tasks[0].plan_start) : '';
        const end = tasks.length ? tasks.reduce((m, t) => t.plan_end > m ? t.plan_end : m, tasks[0].plan_end) : '';
        return { p, tasks, start, end };
      })
      .sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999') || String(a.p.project_id).localeCompare(String(b.p.project_id)));
  }

  // --------------------------------------------------------------------------
  // 繪製
  // --------------------------------------------------------------------------
  function buildTimelineHTML() {
    const today = todayStr();
    const rows = collectProjects();
    const dated = rows.filter(r => r.start);
    let minD = dated.reduce((m, r) => r.start < m ? r.start : m, today);
    let maxD = dated.reduce((m, r) => r.end > m ? r.end : m, today);
    const rangeStart = addMonthsYmd(monthStart(addDays(minD, -31)), 0);
    const rangeEndEx = addMonthsYmd(monthStart(maxD), 3); // 結尾多留 2～3 個月
    const pxd = ZOOMS[st.zoom];
    const t0 = toTime(rangeStart);
    const W = Math.round((toTime(rangeEndEx) - t0) / DAY * pxd);
    const x = ymd => Math.round((toTime(ymd) - t0) / DAY * pxd);

    // 月份格
    const months = [];
    for (let m = rangeStart; m < rangeEndEx; m = addMonthsYmd(m, 1)) months.push(m);
    const load = {};
    rows.forEach(r => r.tasks.forEach(t => {
      const sn = String(t.stage_name || '');
      if (sn.includes('開標') || sn.includes('驗收')) { const k = String(t.plan_end).slice(0, 7); load[k] = (load[k] || 0) + 1; }
    }));
    const years = [];
    months.forEach(m => { const y = m.slice(0, 4); if (!years.length || years[years.length - 1].y !== y) years.push({ y, from: m }); });

    const yearCells = years.map((yy, i) => {
      const x1 = x(yy.from), x2 = i + 1 < years.length ? x(years[i + 1].from) : W;
      return `<div class="gt-cell gt-year" style="left:${x1}px;width:${x2 - x1}px"><span>民國 ${Number(yy.y) - 1911} 年</span></div>`;
    }).join('');
    const monthCells = months.map(m => {
      const x1 = x(m), x2 = x(addMonthsYmd(m, 1));
      return `<div class="gt-cell" style="left:${x1}px;width:${x2 - x1}px">${Number(m.slice(5, 7))}月</div>`;
    }).join('');
    const loadCells = months.map(m => {
      const x1 = x(m), x2 = x(addMonthsYmd(m, 1)), n = load[m.slice(0, 7)] || 0;
      return `<div class="gt-cell gt-load ${n >= 3 ? 'hot' : ''}" style="left:${x1}px;width:${x2 - x1}px" title="${Number(m.slice(0, 4)) - 1911}年${Number(m.slice(5, 7))}月 預計開標／驗收 ${n} 件">${n ? n + '件' : ''}</div>`;
    }).join('');
    const gridLines = months.map(m => `<div class="gt-grid ${m.slice(5, 7) === '01' ? 'yr' : ''}" style="left:${x(m)}px"></div>`).join('');

    const bar = (t, cls) => {
      const s = taskStatus(t, today);
      const x1 = x(t.plan_start), x2 = x(addDays(t.plan_end, 1));
      return `<div class="gt-bar s-${s} ${cls || ''}" style="left:${x1}px;width:${Math.max(4, x2 - x1)}px"
        title="${esc(t.stage_name)}｜${roc(t.plan_start)}～${roc(t.plan_end)}｜${STATUS_LABEL[s]}"
        onclick="openProjectDetail('${esc(t.project_id)}')"></div>`;
    };
    const dia = t => t.sla_deadline
      ? `<div class="gt-dia" style="left:${x(t.sla_deadline) + Math.round(pxd / 2)}px" title="死線 ${roc(t.sla_deadline)}｜${esc(t.stage_name)}"></div>` : '';

    const body = rows.map(r => {
      const { p, tasks } = r;
      const open = st.expanded.has(p.project_id);
      const prog = calcProjectProgress(p.project_id);
      const caseNo = typeof formatProjectCaseNo === 'function' ? formatProjectCaseNo(p) : p.project_id;
      const sm = (window.GA_CORE && typeof window.GA_CORE.formatSmartTitle === 'function')
        ? window.GA_CORE.formatSmartTitle(p.project_name)
        : { yearBadge: '', cleanTitle: p.project_name };
      const dispName = `${sm.yearBadge ? `[${sm.yearBadge}] ` : ''}${sm.cleanTitle}`;
      const summary = `
        <div class="gt-row">
          <div class="gt-name">
            ${tasks.length ? `<button class="gt-tog" onclick="toggleGanttProject('${esc(p.project_id)}')" title="${open ? '收合' : '展開'}階段">${open ? '▾' : '▸'}</button>` : '<span style="width:18px"></span>'}
            <div style="min-width:0">
              <div class="gt-pname" onclick="openProjectDetail('${esc(p.project_id)}')" title="${esc(p.project_name)}">${esc(dispName)}</div>
              <div class="gt-meta">${esc(caseNo)}｜${esc(prog.currentStage)}${prog.totalChecks ? `（${prog.pct}%）` : ''}</div>
            </div>
          </div>
          <div class="gt-track" style="width:${W}px">
            ${r.start ? `<div class="gt-span" style="left:${x(r.start) - 3}px;width:${x(addDays(r.end, 1)) - x(r.start) + 6}px"></div>` : ''}
            ${tasks.map(t => bar(t)).join('')}${tasks.map(dia).join('')}
          </div>
        </div>`;
      const stages = open ? tasks.map(t => `
        <div class="gt-row gt-stage">
          <div class="gt-name"><span class="gt-sname" title="${esc(t.stage_name)}｜${roc(t.plan_start)}～${roc(t.plan_end)}">${esc(t.stage_name)}</span></div>
          <div class="gt-track" style="width:${W}px">${bar(t)}${dia(t)}</div>
        </div>`).join('') : '';
      return summary + stages;
    }).join('');

    const todayX = NAME_W + x(today);
    return {
      today, rangeStart, W, todayX,
      html: `
        <div class="gt-canvas" style="width:${NAME_W + W}px">
          <div class="gt-head">
            <div class="gt-row"><div class="gt-name">標案（${rows.length} 案）</div><div class="gt-track" style="width:${W}px">${yearCells}<div class="gt-today-tag" style="left:${x(today)}px">今天 ${roc(today)}</div></div></div>
            <div class="gt-row"><div class="gt-name" style="font-weight:600;font-size:12px;color:#64748B">月份</div><div class="gt-track" style="width:${W}px">${monthCells}</div></div>
            <div class="gt-row"><div class="gt-name" style="font-weight:600;font-size:12px;color:#64748B">開標／驗收負荷</div><div class="gt-track" style="width:${W}px">${loadCells}</div></div>
          </div>
          <div style="position:relative">
            <div style="position:absolute;left:${NAME_W}px;top:0;bottom:0;width:${W}px;pointer-events:none">${gridLines}</div>
            ${rows.length ? body : `<div class="gt-empty">目前沒有${st.showClosed ? '' : '進行中的'}標案${(document.getElementById('global-search')?.value || '').trim() ? '符合搜尋條件' : ''}。</div>`}
          </div>
          <div class="gt-today" style="left:${todayX}px"></div>
        </div>`
    };
  }

  // 取代原年度甘特圖
  renderAnnualGanttHTML = function() {
    const built = buildTimelineHTML();
    window._ganttTimelineMeta = built;
    const curY = Number(annualGanttYear);
    const yearOpts = [];
    for (let y = curY - 3; y <= curY + 3; y++) yearOpts.push(y);
    return `
      <div class="panel">
        <div class="panel-hd" style="flex-wrap:wrap;gap:8px">
          <h3>📅 全校採購標案時間軸（跨年度連續，可左右滑移）</h3>
          <div class="gt-toolbar">
            <button class="btn-xs" onclick="scrollGantt(-90)" title="往前約 3 個月">◀ 前移</button>
            <button class="btn-xs" onclick="scrollGanttToday()">今天</button>
            <button class="btn-xs" onclick="scrollGantt(90)" title="往後約 3 個月">後移 ▶</button>
            <span class="gt-sep"></span>
            <button class="btn-xs" onclick="zoomGantt(-1)" ${st.zoom === 0 ? 'disabled' : ''} title="縮小（看更長時間）">－</button>
            <button class="btn-xs" onclick="zoomGantt(1)" ${st.zoom === ZOOMS.length - 1 ? 'disabled' : ''} title="放大（看更細）">＋</button>
            <span class="gt-sep"></span>
            <button class="btn-xs" onclick="toggleGanttAll()">${st.expanded.size ? '全部收合' : '全部展開'}</button>
            <label style="display:flex;align-items:center;gap:4px;font-size:12.5px;cursor:pointer"><input type="checkbox" ${st.showClosed ? 'checked' : ''} onchange="toggleGanttClosed(this.checked)"> 含已結案</label>
            <span class="gt-sep"></span>
            <select onchange="annualGanttYear=Number(this.value);scrollGanttToYear(Number(this.value))" title="跳至年度（亦為年度 PDF 範圍）" style="padding:3px 6px;border-radius:6px">
              ${yearOpts.map(y => `<option value="${y}" ${y === curY ? 'selected' : ''}>${y} 年</option>`).join('')}
            </select>
            <button class="btn-sm btn-primary" onclick="printAnnualGanttPDF()">🖨️ ${curY} 年度 PDF</button>
          </div>
        </div>
        <div class="panel-bd">
          <div class="gt-legend">
            <span><i style="background:#059669"></i>已完成</span>
            <span><i style="background:#2563EB"></i>進行中</span>
            <span><i style="background:#DC2626"></i>逾期未完成</span>
            <span><i style="background:#94A3B8"></i>未開始</span>
            <span><i class="gt-dia" style="position:static;margin:0 6px 0 2px;display:inline-block"></i>上級／法定死線</span>
            <span>點標案名稱或色條可進入控管；▸ 展開各階段</span>
          </div>
          <div class="gt-scroll" id="gt-scroll">${built.html}</div>
        </div>
      </div>`;
  };

  // --------------------------------------------------------------------------
  // 捲動與互動
  // --------------------------------------------------------------------------
  const scroller = () => document.getElementById('gt-scroll');
  function centerOn(px) {
    const el = scroller(); if (!el) return;
    el.scrollLeft = Math.max(0, px - NAME_W - (el.clientWidth - NAME_W) / 3);
  }
  window.scrollGanttToday = () => { const m = window._ganttTimelineMeta; if (m) centerOn(m.todayX); };
  window.scrollGanttToYear = y => {
    const m = window._ganttTimelineMeta, el = scroller(); if (!m || !el) return;
    const t = toTime(`${Number(y) + 1911}-01-01`) - toTime(m.rangeStart);
    el.scrollLeft = Math.max(0, Math.round(t / DAY * ZOOMS[st.zoom]));
    renderCurrentView();
  };
  window.scrollGantt = days => { const el = scroller(); if (el) el.scrollBy({ left: Math.round(days * ZOOMS[st.zoom]), behavior: 'smooth' }); };
  window.zoomGantt = d => {
    const el = scroller(), m = window._ganttTimelineMeta;
    // 縮放時維持畫面中央的日期不變
    let centerDay = null;
    if (el && m) centerDay = (el.scrollLeft + (el.clientWidth - NAME_W) / 2) / ZOOMS[st.zoom];
    st.zoom = Math.min(ZOOMS.length - 1, Math.max(0, st.zoom + d));
    savePrefs();
    st.scrollLeft = centerDay !== null ? Math.max(0, centerDay * ZOOMS[st.zoom] - (el.clientWidth - NAME_W) / 2) : null;
    renderCurrentView();
  };
  window.toggleGanttProject = id => { st.expanded.has(id) ? st.expanded.delete(id) : st.expanded.add(id); savePrefs(); renderCurrentView(); };
  window.toggleGanttAll = () => {
    if (st.expanded.size) st.expanded.clear();
    else collectProjects().forEach(r => r.tasks.length && st.expanded.add(r.p.project_id));
    savePrefs(); renderCurrentView();
  };
  window.toggleGanttClosed = v => { st.showClosed = !!v; savePrefs(); renderCurrentView(); };

  // 重繪前記住捲動位置；重繪後還原（第一次進入則捲到今天）
  // 透過 GA_CORE 插槽：重繪前記住捲動位置，重繪後還原（不覆寫 renderCurrentView）
  window.GA_CORE.onBeforeRender(() => {
    const el = scroller();
    if (el && st.scrollLeft === null) { st.scrollLeft = el.scrollLeft; st.scrollTop = el.scrollTop; }
  });
  window.GA_CORE.onAfterRender(tab => {
    if (tab !== 'annual-gantt') { st.scrollLeft = null; st.lastKey = ''; return; }
    const nel = scroller(); if (!nel) return;
    if (st.lastKey !== 'shown') { st.lastKey = 'shown'; window.scrollGanttToday(); }
    else if (st.scrollLeft !== null) { nel.scrollLeft = st.scrollLeft; nel.scrollTop = st.scrollTop; }
    st.scrollLeft = null;
  });

  // 年度 PDF：改列「當年有任何工作」的標案（不再只看會計年度）
  window.projectsActiveInRocYear = function(rocYear) {
    const y = String(Number(rocYear) + 1911);
    return (appData.tables.Projects || []).filter(p => p.status !== '廢標撤案' && (
      Number(p.fiscal_year) === Number(rocYear) ||
      getProjectTasks(p.project_id).some(t => t.plan_start && t.plan_end && t.plan_start <= `${y}-12-31` && t.plan_end >= `${y}-01-01`)
    ));
  };

  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('gantt-timeline.js', 'v1.0', '全校甘特圖跨年度連續時間軸（左右滑移）');
  }
})();
