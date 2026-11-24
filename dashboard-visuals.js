/**
 * ============================================================================
 * 學校總務行政助理 — 戰情卡片可視化進度背景 ＋ 例行業務檔案內容視窗
 * 檔案名稱：dashboard-visuals.js
 * 功能：
 * 1. 點擊「近期固定例行業務通知」卡片（或例行清單項目），開啟完整詳情視窗：
 *    可檢視／新增／開啟相關檔案與雲端連結、勾選本期工作進度步驟、即時編輯備忘。
 * 2. 全戰情室卡片（例行業務、進行中標案、紅黃燈預警、臨時交辦 Memo）背景自動加上
 *    可視化進度條，並依「時限逼近程度」或「工作完成進度」動態切換紅／橘／藍／綠四色。
 * 3. 100% 相容既有 Google Sheets `Annual_Routines` 資料表，免改後端 Code.gs。
 * ============================================================================
 */

(function injectDashboardVisualStyles() {
  const st = document.createElement('style');
  st.id = 'dashboard-visuals-style';
  st.textContent = `
    /* 卡片背景進度條共用基底（維持高文字對比度，絕不遮擋字跡） */
    .card-prog-bg {
      position: relative;
      overflow: hidden;
      background: #ffffff !important;
      isolation: isolate;
      transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
    }
    .card-prog-bg::before {
      content: "";
      position: absolute;
      inset: 0;
      width: var(--prog-pct, 0%);
      background: var(--prog-bg, rgba(37, 99, 235, 0.10));
      border-right: var(--prog-edge, none);
      z-index: -1;
      transition: width .35s ease, background-color .35s ease;
      pointer-events: none;
    }
    .card-prog-bg::after {
      content: "";
      position: absolute;
      left: 0;
      bottom: 0;
      height: 3px;
      width: var(--prog-pct, 0%);
      background: var(--prog-bar, #2563eb);
      z-index: 0;
      transition: width .35s ease, background-color .35s ease;
      pointer-events: none;
    }

    /* 四色語意色票（紅：逾期/緊急｜橘：逼近時限｜藍：正常推進｜綠：高進度/充裕/完成） */
    .tone-red {
      border-left: 4px solid #dc2626 !important;
      --prog-bg: rgba(239, 68, 68, 0.14);
      --prog-bar: #dc2626;
      --prog-edge: 1px solid rgba(220, 38, 38, 0.25);
    }
    .tone-amber {
      border-left: 4px solid #d97706 !important;
      --prog-bg: rgba(245, 158, 11, 0.16);
      --prog-bar: #d97706;
      --prog-edge: 1px solid rgba(217, 119, 6, 0.25);
    }
    .tone-blue {
      border-left: 4px solid #2563eb !important;
      --prog-bg: rgba(37, 99, 235, 0.11);
      --prog-bar: #2563eb;
      --prog-edge: 1px solid rgba(37, 99, 235, 0.22);
    }
    .tone-green {
      border-left: 4px solid #059669 !important;
      --prog-bg: rgba(16, 185, 129, 0.14);
      --prog-bar: #059669;
      --prog-edge: 1px solid rgba(5, 150, 105, 0.22);
    }
    .prog-edge-none { --prog-edge: none !important; }

    /* 可點擊例行業務卡片互動回饋 */
    .routine-card-clickable { cursor: pointer; }
    .routine-card-clickable:hover {
      border-color: #64748b;
      box-shadow: 0 3px 10px rgba(15, 23, 42, .08);
      transform: translateY(-1px);
    }
    .prog-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 7px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(15, 23, 42, 0.12);
      color: #0f172a;
      white-space: nowrap;
    }

    /* 例行業務詳情與檔案視窗樣式 */
    .rtn-sec {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 11px 13px;
      margin-bottom: 12px;
      background: #fff;
    }
    .rtn-sec-hd {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-weight: 700;
      font-size: 14px;
      color: #0f172a;
    }
    .rtn-file-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 9px;
    }
    .rtn-file-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      background: #f8fafc;
    }
    .rtn-file-link {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-weight: 700;
      color: var(--primary);
      word-break: break-all;
      flex: 1;
    }
    .rtn-step-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .rtn-step-row:last-child { border-bottom: none; }
    .rtn-step-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      flex: 1;
      font-size: 13.5px;
    }
    .rtn-step-label.done {
      color: var(--muted);
      text-decoration: line-through;
    }
    .rtn-add-bar {
      display: grid;
      grid-template-columns: 1fr 1.4fr auto;
      gap: 6px;
      align-items: center;
      margin-top: 6px;
    }
    .rtn-add-step-bar {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px;
      align-items: center;
      margin-top: 8px;
    }
    .rtn-add-bar input, .rtn-add-step-bar input {
      padding: 7px 9px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      width: 100%;
    }
    .rtn-hero-bar {
      height: 10px;
      background: #e2e8f0;
      border-radius: 99px;
      overflow: hidden;
      margin-top: 7px;
    }
    .rtn-hero-fill {
      height: 100%;
      border-radius: 99px;
      transition: width .3s ease;
    }
    @media (max-width: 720px) {
      .rtn-add-bar { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(st);
})();

// ----------------------------------------------------------------------------
// 1. 結構化解析／序列化例行業務備忘（檔案連結 ＋ 工作進度步驟，完全相容原試算表）
// ----------------------------------------------------------------------------
function parseRoutineNote(raw) {
  const lines = String(raw || '').split(/\r?\n/);
  const plain = [];
  const files = [];
  const steps = [];
  const seenUrls = new Set();

  lines.forEach(line => {
    const s = line.trim();
    const mChk = s.match(/^\[( |x|X)\]\s+(.+)$/);
    if (mChk) {
      steps.push({ done: mChk[1].toLowerCase() === 'x', text: mChk[2].trim() });
      return;
    }
    const mFile = s.match(new RegExp('^📎\\s*(.+?)\\s*\\|\\s*(https?:\\/\\/\\S+)$', 'i'));
    if (mFile) {
      const url = mFile[2].trim();
      files.push({ name: mFile[1].trim(), url, managed: true });
      seenUrls.add(url);
      return;
    }
    plain.push(line);
  });

  const detectedUrls = [];
  const urlRe = new RegExp('https?:\\/\\/[^\\s<>"\\x27()（）【】,，、。；;]+', 'gi');
  plain.forEach(ln => {
    const matches = ln.match(urlRe) || [];
    matches.forEach(u => {
      if (!seenUrls.has(u)) {
        seenUrls.add(u);
        detectedUrls.push(u);
      }
    });
  });

  return {
    plainNote: plain.join('\n').trim(),
    files,
    detectedUrls,
    steps
  };
}

function serializeRoutineNote(parsed) {
  const out = [];
  const plain = String(parsed.plainNote || '').trim();
  if (plain) out.push(plain);
  (parsed.files || []).forEach(f => {
    const name = String(f.name || '相關檔案').replace(/\|/g, '／').trim();
    const url = String(f.url || '').trim();
    if (url) out.push(`📎 ${name} | ${url}`);
  });
  (parsed.steps || []).forEach(st => {
    const txt = String(st.text || '').replace(/\r?\n/g, ' ').trim();
    if (txt) out.push(`[${st.done ? 'x' : ' '}] ${txt}`);
  });
  return out.join('\n');
}

function getLinkIconByUrl(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('docs.google.com/spreadsheets')) return '📊';
  if (u.includes('docs.google.com/document')) return '📝';
  if (u.includes('drive.google.com')) return '📁';
  if (u.endsWith('.pdf')) return '📄';
  return '🔗';
}

function normalizeHttpUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (new RegExp('^https?:\\/\\/', 'i').test(s)) return s;
  return 'https://' + s;
}

// ----------------------------------------------------------------------------
// 2. 各類戰情卡片進度百分比與動態顏色計算引擎
// ----------------------------------------------------------------------------
function calcRoutineCardVisual(r, sch) {
  const parsed = parseRoutineNote(r.note);
  const totalSteps = parsed.steps.length;
  const doneSteps = parsed.steps.filter(s => s.done).length;
  const diff = sch.diffDays;
  const lead = Math.max(1, Number(r.lead_days) || 14);

  let pct = 0, tone = 'blue', mode = 'time', label = '';
  if (totalSteps > 0) {
    pct = Math.round((doneSteps / totalSteps) * 100);
    if (pct >= 100) tone = 'green';
    else if (diff < 0) tone = 'red';
    else if (diff <= 7) tone = 'amber';
    else if (pct >= 70) tone = 'blue';
    else tone = 'blue';
    mode = 'work';
    label = `進度 ${doneSteps}/${totalSteps} (${pct}%)`;
  } else {
    if (diff <= 0) {
      pct = 100;
      tone = 'red';
    } else {
      pct = Math.max(8, Math.min(98, Math.round(((lead - diff) / lead) * 100)));
      tone = diff <= 7 ? 'amber' : 'blue';
    }
    mode = 'time';
    label = diff <= 0 ? '已達時限 100%' : `時限進度 ${pct}%`;
  }

  const fileCount = parsed.files.length + parsed.detectedUrls.length + (r.portal_url ? 1 : 0);
  return { parsed, totalSteps, doneSteps, fileCount, pct, tone, mode, label };
}

function calcProjectCardVisual(p, prog) {
  const today = todayStr();
  const pct = Math.max(0, Math.min(100, Number(prog.pct) || 0));
  const deadlines = [p.orig_end_date, p.grant_deadline].filter(Boolean).map(d => diffDays(today, d));
  const minDiff = deadlines.length ? Math.min(...deadlines) : null;

  let tone = 'blue';
  if (minDiff !== null && minDiff < 0 && pct < 100) tone = 'red';
  else if (minDiff !== null && minDiff <= 14 && pct < 80) tone = 'amber';
  else if (pct >= 100) tone = 'green';
  return { pct, tone };
}

function calcAlertCardVisual(alert) {
  const d = Number(alert.sortKey);
  const pct = isNaN(d) ? 75 : (d <= 0 ? 100 : d <= 3 ? 88 : d <= 7 ? 72 : d <= 14 ? 52 : d <= 30 ? 32 : 18);
  const tone = alert.level === 'red' ? 'red' : (alert.level === 'amber' ? 'amber' : 'blue');
  return { pct, tone };
}

function calcMemoCardVisual(m, today) {
  if (m.is_done) return { pct: 100, tone: 'green' };
  if (m.due_date) {
    const d = diffDays(today, m.due_date);
    const pct = d <= 0 ? 100 : d <= 3 ? 82 : d <= 7 ? 58 : d <= 14 ? 35 : 18;
    const tone = (d <= 0 || m.priority === '緊急') ? 'red' : (d <= 3 || m.priority === '重要') ? 'amber' : 'blue';
    return { pct, tone };
  }
  if (m.remind_date) {
    const d = diffDays(today, m.remind_date);
    const pct = d <= 0 ? 100 : d <= 3 ? 70 : 30;
    const tone = m.priority === '緊急' ? 'red' : (d <= 0 || m.priority === '重要') ? 'amber' : 'blue';
    return { pct, tone };
  }
  if (m.priority === '緊急') return { pct: 100, tone: 'red' };
  if (m.priority === '重要') return { pct: 50, tone: 'amber' };
  return { pct: 0, tone: 'blue' };
}

function applyProgStyleToEl(el, pct, tone) {
  if (!el) return;
  const clamped = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  el.classList.remove('tone-red', 'tone-amber', 'tone-blue', 'tone-green', 'prog-edge-none');
  el.classList.add('card-prog-bg', 'tone-' + tone);
  if (clamped <= 0 || clamped >= 100) el.classList.add('prog-edge-none');
  el.style.setProperty('--prog-pct', clamped + '%');
}

// ----------------------------------------------------------------------------
// 3. 強化「起始戰情室」卡片：例行卡片可點擊開啟檔案內容 ＋ 全區卡片背景進度條
// ----------------------------------------------------------------------------
function enhanceDashboardCardsVisual() {
  if (typeof currentTab === 'undefined' || currentTab !== 'dashboard') return;
  const dashGrid = document.querySelector('#main-view .dash-grid');
  if (!dashGrid) return;

  const today = todayStr();
  const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();

  // (A) 左上：跨模組紅黃燈預警雷達卡片套用背景進度條
  const leftPanels = dashGrid.querySelectorAll(':scope > div:first-child > .panel');
  if (leftPanels[0] && Array.isArray(window._dashAlerts)) {
    const alertEls = leftPanels[0].querySelectorAll('.alert-item');
    alertEls.forEach((el, idx) => {
      const a = window._dashAlerts[idx];
      if (!a) return;
      const v = calcAlertCardVisual(a);
      applyProgStyleToEl(el, v.pct, v.tone);
    });
  }

  // (B) 左下：進行中標案進度總覽卡片套用工作進度背景條
  if (leftPanels[1]) {
    const activeProjects = (appData.tables.Projects || [])
      .filter(p => !['已結案', '廢標撤案'].includes(p.status))
      .filter(p => !q || String(p.project_name + p.project_id + p.vendor_name).toLowerCase().includes(q));
    const prjEls = leftPanels[1].querySelectorAll('.alert-item');
    prjEls.forEach((el, idx) => {
      const p = activeProjects[idx];
      if (!p) return;
      const prog = calcProjectProgress(p.project_id);
      const v = calcProjectCardVisual(p, prog);
      applyProgStyleToEl(el, v.pct, v.tone);
    });
  }

  // (C) 中欄：近期固定例行業務通知 — 重繪為可點擊詳情卡片 ＋ 檔案/進度徽章 ＋ 背景進度條
  const midPanelBd = dashGrid.querySelector(':scope > .panel:nth-child(2) > .panel-bd');
  if (midPanelBd) {
    const routines = (appData.tables.Annual_Routines || [])
      .filter(r => r.is_active !== false)
      .map(r => ({ ...r, sch: computeRoutineSchedule(r) }))
      .filter(r => r.sch.isVisible)
      .filter(r => !q || String(r.title + r.category + r.note).toLowerCase().includes(q))
      .sort((a, b) => a.sch.diffDays - b.sch.diffDays);

    if (routines.length) {
      midPanelBd.innerHTML = routines.map(r => {
        const d = r.sch.diffDays;
        const dCls = d < 0 ? 'tag-red' : d <= 7 ? 'tag-amber' : 'tag-blue';
        const dTxt = d < 0 ? `逾期 ${Math.abs(d)} 天` : d === 0 ? '今天到期' : `剩 ${d} 天`;
        const vis = calcRoutineCardVisual(r, r.sch);
        const rocDue = typeof toRocDate === 'function' ? toRocDate(r.sch.dueDate) : r.sch.dueDate;
        const canQuickBuy = ['一般小額採購', '共同供應契約'].includes(r.category);
        const edgeCls = (vis.pct <= 0 || vis.pct >= 100) ? 'prog-edge-none' : '';

        return `
          <div class="routine-item card-prog-bg tone-${vis.tone} ${edgeCls} routine-card-clickable"
               style="--prog-pct:${vis.pct}%"
               role="button" tabindex="0"
               aria-label="開啟例行業務：${esc(r.title)}"
               onclick="openRoutineDetailModal('${esc(r.routine_id)}')">
            <div class="item-row">
              <div style="flex:1;min-width:0">
                <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
                  <span class="tag ${dCls}">${dTxt}</span>
                  <span class="tag tag-gray">${esc(r.category)}</span>
                  ${vis.fileCount > 0 ? `<span class="tag tag-blue">📎 ${vis.fileCount} 檔案</span>` : ''}
                </div>
                <div style="font-weight:800;margin-top:4px;font-size:14px;color:#0f172a">${esc(r.title)}</div>
              </div>
              <span class="prog-pill" title="${vis.mode === 'work' ? '依檢核步驟計算工作進度' : '依提前預告天數計算時限逼近進度'}">
                ${vis.mode === 'work' ? '☑️' : '⏳'} ${esc(vis.label)}
              </span>
            </div>
            <div class="item-meta">期別 ${esc(r.sch.cycle)} ｜ 期限 ${esc(rocDue)}（${esc(r.sch.dueDate)}）</div>
            ${vis.parsed.plainNote ? `<div class="item-meta">💡 ${esc(vis.parsed.plainNote.split('\n')[0])}</div>` : ''}
            <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center">
              <button type="button" class="btn-xs btn-success" onclick="event.stopPropagation();markRoutineDone('${esc(r.routine_id)}','${esc(r.sch.cycle)}')">✓ 本期完成</button>
              <button type="button" class="btn-xs" onclick="event.stopPropagation();openRoutineDetailModal('${esc(r.routine_id)}')">📂 檔案與步驟</button>
              ${r.portal_url ? `<a class="btn-xs" style="border:1px solid var(--border);border-radius:6px;background:rgba(255,255,255,.9)" href="${esc(r.portal_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🌐 去網站</a>` : ''}
              ${r.linked_template_id ? `<button type="button" class="btn-xs btn-primary" onclick="event.stopPropagation();openProjectWizard('${esc(r.linked_template_id)}','${esc(r.title)}')">📋 套模板開案</button>` : ''}
              ${(!r.linked_template_id && canQuickBuy && typeof openRoutineQuickPurchase === 'function') ? `<button type="button" class="btn-xs btn-primary" onclick="event.stopPropagation();openRoutineQuickPurchase('${esc(r.routine_id)}')">🛒 開單</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // (D) 右欄：臨時交辦 Memo 卡片套用背景進度條
  const rightPanel = dashGrid.querySelector(':scope > .panel:last-child');
  if (rightPanel) {
    const allMemos = (appData.tables.Quick_Memos || []).filter(m => !q || String(m.content + m.source_tag).toLowerCase().includes(q));
    const openMemos = allMemos.filter(m => !m.is_done).sort((a, b) => {
      const score = m => {
        if (m.due_date && diffDays(today, m.due_date) <= 0) return 0;
        if (m.remind_date && diffDays(today, m.remind_date) <= 0) return 1;
        if (m.priority === '緊急') return 2;
        if (m.priority === '重要') return 3;
        return 4;
      };
      return score(a) - score(b) || String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
    });
    const doneMemos = (typeof showDoneMemos !== 'undefined' && showDoneMemos) ? allMemos.filter(m => m.is_done).slice(0, 20) : [];
    const renderedMemos = openMemos.concat(doneMemos);
    const memoEls = rightPanel.querySelectorAll('.memo-item');
    memoEls.forEach((el, idx) => {
      const m = renderedMemos[idx];
      if (!m) return;
      const v = calcMemoCardVisual(m, today);
      applyProgStyleToEl(el, v.pct, v.tone);
    });
  }
}

// 同步升級「🔁 年度固定例行事務」管理分頁：加上「📂 檔案與步驟」按鈕
const _prevRenderRoutines_vis = renderRoutinesHTML;
renderRoutinesHTML = function() {
  let html = _prevRenderRoutines_vis();
  html = html.replace(
    new RegExp('<button class="btn-xs" onclick="openRoutineModal\\(\\x27([^\\x27]+)\\x27\\)">✎ 編輯</button>', 'g'),
    `<button type="button" class="btn-xs" onclick="openRoutineDetailModal('$1')">📂 檔案與步驟</button><button type="button" class="btn-xs" onclick="openRoutineModal('$1')">✎ 編輯</button>`
  );
  return html;
};

// ----------------------------------------------------------------------------
// 4. 點擊例行業務卡片：開啟「檔案相關內容 ＋ 工作進度步驟 ＋ 備忘」詳情視窗
// ----------------------------------------------------------------------------
function openRoutineDetailModal(routineId) {
  const r = (appData.tables.Annual_Routines || []).find(x => x.routine_id === routineId);
  if (!r) return;
  const sch = computeRoutineSchedule(r);
  const vis = calcRoutineCardVisual(r, sch);
  const parsed = vis.parsed;
  const d = sch.diffDays;
  const dTxt = d < 0 ? `已逾期 ${Math.abs(d)} 天` : d === 0 ? '今天到期' : `距離到期還有 ${d} 天`;
  const ruleHuman = typeof describeDueRuleHuman === 'function' ? describeDueRuleHuman(r.recurrence_type, r.due_rule) : r.due_rule;
  const rocDue = typeof fmtDateWithRoc === 'function' ? fmtDateWithRoc(sch.dueDate) : sch.dueDate;
  const tpl = r.linked_template_id ? (appData.tables.Templates || []).find(t => t.template_id === r.linked_template_id) : null;
  const barColor = vis.tone === 'red' ? '#dc2626' : vis.tone === 'amber' ? '#d97706' : vis.tone === 'green' ? '#059669' : '#2563eb';

  const fileCards = [];
  if (r.portal_url) {
    fileCards.push(`
      <div class="rtn-file-row" style="background:#eff6ff;border-color:#bfdbfe">
        <a class="rtn-file-link" href="${esc(r.portal_url)}" target="_blank" rel="noopener">
          <span>🌐</span>
          <span>作業網站／主要雲端連結<div class="item-meta" style="font-weight:400">${esc(r.portal_url)}</div></span>
        </a>
        <span class="tag tag-blue">主連結</span>
      </div>
    `);
  }
  parsed.files.forEach((f, idx) => {
    fileCards.push(`
      <div class="rtn-file-row">
        <a class="rtn-file-link" href="${esc(f.url)}" target="_blank" rel="noopener">
          <span>${getLinkIconByUrl(f.url)}</span>
          <span>${esc(f.name)}<div class="item-meta" style="font-weight:400">${esc(f.url)}</div></span>
        </a>
        <button type="button" class="btn-xs btn-danger" style="margin-left:0" onclick="removeRoutineAttachedFile('${esc(routineId)}', ${idx})">移除</button>
      </div>
    `);
  });
  parsed.detectedUrls.forEach(u => {
    fileCards.push(`
      <div class="rtn-file-row">
        <a class="rtn-file-link" href="${esc(u)}" target="_blank" rel="noopener">
          <span>${getLinkIconByUrl(u)}</span>
          <span>備忘內自動偵測連結<div class="item-meta" style="font-weight:400">${esc(u)}</div></span>
        </a>
        <span class="tag tag-gray">自動偵測</span>
      </div>
    `);
  });

  openModal(`📂 ${r.title}`, `
    <!-- 頂部期程與可視化進度總覽 -->
    <div class="rtn-sec" style="border-left:4px solid ${barColor};background:#f8fafc">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div>
          <span class="tag ${d < 0 ? 'tag-red' : d <= 7 ? 'tag-amber' : 'tag-blue'}">${esc(dTxt)}</span>
          <span class="tag tag-gray">${esc(r.category)}</span>
          <span class="tag tag-gray">${esc(ruleHuman)}</span>
        </div>
        <strong style="color:${barColor}">${esc(vis.label)}</strong>
      </div>
      <div class="item-meta" style="margin-top:6px">
        本期期別：<strong>${esc(sch.cycle)}</strong> ｜ 到期日：<strong>${esc(rocDue)}</strong> ｜ 上次完成：${r.last_done_cycle ? `${esc(r.last_done_cycle)}（${esc(r.last_done_date)}）` : '尚未紀錄'}
      </div>
      <div class="rtn-hero-bar"><div class="rtn-hero-fill" style="width:${vis.pct}%;background:${barColor}"></div></div>
    </div>

    <!-- 區塊 1：相關檔案與外部連結 -->
    <div class="rtn-sec">
      <div class="rtn-sec-hd">
        <span>📂 相關檔案、雲端資料夾與直達網站（共 ${vis.fileCount} 項）</span>
        ${tpl ? `<button type="button" class="btn-xs btn-primary" onclick="closeModal();openProjectWizard('${esc(tpl.template_id)}','${esc(r.title)}')">📋 套模板：${esc(tpl.template_name)}</button>` : ''}
      </div>
      <div class="rtn-file-list">
        ${fileCards.length ? fileCards.join('') : '<div class="item-meta" style="padding:4px 0">尚未附加任何檔案或 Google Drive 連結，可在下方直接新增。</div>'}
      </div>
      <div class="rtn-add-bar">
        <input id="rd-file-name" type="text" placeholder="檔案名稱（例：115年申報表範本）">
        <input id="rd-file-url" type="url" placeholder="貼上 Google Drive 或網站連結 https://...">
        <button type="button" class="btn-sm btn-primary" onclick="addRoutineAttachedFile('${esc(routineId)}')">＋ 加入檔案</button>
      </div>
    </div>

    <!-- 區塊 2：本期辦理步驟 Checklist（直接驅動戰情卡片背景工作進度條） -->
    <div class="rtn-sec">
      <div class="rtn-sec-hd">
        <span>☑️ 本期辦理步驟與工作進度（${vis.doneSteps} / ${vis.totalSteps}）</span>
        <span class="item-meta" style="font-weight:400">勾選即自動更新卡片背景進度條</span>
      </div>
      <div>
        ${parsed.steps.length ? parsed.steps.map((st, idx) => `
          <div class="rtn-step-row">
            <label class="rtn-step-label ${st.done ? 'done' : ''}">
              <input type="checkbox" ${st.done ? 'checked' : ''} onchange="toggleRoutineStep('${esc(routineId)}', ${idx}, this.checked)">
              <span>${esc(st.text)}</span>
            </label>
            <button type="button" class="btn-xs btn-danger" style="margin-left:0" onclick="removeRoutineStep('${esc(routineId)}', ${idx})">✕</button>
          </div>
        `).join('') : '<div class="item-meta" style="padding:4px 0">尚未建立辦理步驟（未建步驟時，卡片背景自動顯示「距離時限倒數進度」；新增步驟後改顯示「工作完成進度」）。</div>'}
      </div>
      <div class="rtn-add-step-bar">
        <input id="rd-step-text" type="text" placeholder="輸入辦理步驟後按 Enter（例：彙整本季發票清冊、上傳系統留存收執）...">
        <button type="button" class="btn-sm btn-primary" onclick="addRoutineStep('${esc(routineId)}')">＋ 新增步驟</button>
      </div>
    </div>

    <!-- 區塊 3：承辦注意事項與備忘 -->
    <div class="rtn-sec" style="margin-bottom:0">
      <div class="rtn-sec-hd">
        <span>📝 承辦注意事項與備忘（提醒：切勿輸入真實密碼）</span>
        <button type="button" class="btn-xs btn-primary" onclick="saveRoutinePlainNote('${esc(routineId)}')">💾 儲存備忘</button>
      </div>
      <textarea id="rd-plain-note" style="width:100%;min-height:76px;padding:8px;border:1px solid #cbd5e1;border-radius:6px">${esc(parsed.plainNote)}</textarea>
    </div>
  `, `
    <button type="button" onclick="closeModal();openRoutineModal('${esc(routineId)}')">✎ 編輯排程規則</button>
    <button type="button" class="btn-success" onclick="closeModal();markRoutineDone('${esc(routineId)}','${esc(sch.cycle)}')">✓ 標記本期完成</button>
    <button type="button" class="btn-primary" onclick="closeModal()">關閉</button>
  `);

  // 為「新增步驟」輸入框綁定中文輸入法（IME）安全 Enter 事件
  const stepInp = document.getElementById('rd-step-text');
  if (stepInp) {
    let comp = false, lastEnd = 0;
    stepInp.addEventListener('compositionstart', () => { comp = true; });
    stepInp.addEventListener('compositionend', () => { comp = false; lastEnd = Date.now(); });
    stepInp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      if (e.isComposing || e.keyCode === 229 || comp || (Date.now() - lastEnd < 100)) return;
      e.preventDefault();
      addRoutineStep(routineId);
    });
  }
}

async function persistRoutineParsedUpdate(routineId, mutatorFn, successMsg) {
  const r = (appData.tables.Annual_Routines || []).find(x => x.routine_id === routineId);
  if (!r) return;
  const parsed = parseRoutineNote(r.note);
  mutatorFn(parsed, r);
  r.note = serializeRoutineNote(parsed);
  r.updated_at = nowStr();
  if (typeof modalDirty !== 'undefined') modalDirty = false;
  renderCurrentView();
  openRoutineDetailModal(routineId);
  await pushToCloud({ action: 'upsert', table: 'Annual_Routines', record: r });
  if (successMsg) toast(successMsg);
}

async function addRoutineAttachedFile(routineId) {
  const name = (document.getElementById('rd-file-name')?.value || '').trim();
  const rawUrl = (document.getElementById('rd-file-url')?.value || '').trim();
  const errs = [];
  if (!name) errs.push({ id: 'rd-file-name', msg: '請填寫檔案或連結名稱' });
  if (!rawUrl) errs.push({ id: 'rd-file-url', msg: '請貼上檔案或 Google Drive 網址' });
  if (typeof showInlineErrors === 'function' ? !showInlineErrors(errs) : errs.length) {
    if (typeof showInlineErrors !== 'function') toast(errs[0].msg);
    return;
  }
  const url = normalizeHttpUrl(rawUrl);
  await persistRoutineParsedUpdate(routineId, parsed => {
    parsed.files.push({ name, url, managed: true });
  }, `📎 已加入檔案「${name}」`);
}

async function removeRoutineAttachedFile(routineId, idx) {
  await persistRoutineParsedUpdate(routineId, parsed => {
    parsed.files.splice(idx, 1);
  }, '🗑️ 已移除檔案連結');
}

async function addRoutineStep(routineId) {
  const text = (document.getElementById('rd-step-text')?.value || '').trim();
  if (!text) return toast('請先輸入辦理步驟內容');
  await persistRoutineParsedUpdate(routineId, parsed => {
    parsed.steps.push({ done: false, text });
  }, '☑️ 已新增辦理步驟');
}

async function toggleRoutineStep(routineId, idx, checked) {
  await persistRoutineParsedUpdate(routineId, parsed => {
    if (parsed.steps[idx]) parsed.steps[idx].done = checked;
  });
}

async function removeRoutineStep(routineId, idx) {
  await persistRoutineParsedUpdate(routineId, parsed => {
    parsed.steps.splice(idx, 1);
  });
}

async function saveRoutinePlainNote(routineId) {
  const plain = (document.getElementById('rd-plain-note')?.value || '').trim();
  await persistRoutineParsedUpdate(routineId, parsed => {
    parsed.plainNote = plain;
  }, '💾 已儲存承辦備忘');
}

// 完成本期時自動將工作步驟重置為未勾選，讓下一期循環自動復活時從 0% 起算
const _prevMarkRoutineDone_vis = markRoutineDone;
markRoutineDone = async function(routineId, cycle) {
  const r = (appData.tables.Annual_Routines || []).find(x => x.routine_id === routineId);
  if (r) {
    const parsed = parseRoutineNote(r.note);
    if (parsed.steps.some(s => s.done)) {
      parsed.steps.forEach(s => { s.done = false; });
      r.note = serializeRoutineNote(parsed);
    }
  }
  await _prevMarkRoutineDone_vis(routineId, cycle);
};

// ----------------------------------------------------------------------------
// 5. 掛載至主渲染流程與模組健康登記
// ----------------------------------------------------------------------------
if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
  window.GA_REGISTRY.registerModule('dashboard-visuals.js', 'v1.0', '卡片背景進度可視化與例行業務檔案視窗');
}

const _prevRenderForVisuals = renderCurrentView;
renderCurrentView = function() {
  _prevRenderForVisuals();
  enhanceDashboardCardsVisual();
};

enhanceDashboardCardsVisual();
