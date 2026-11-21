/**
 * ============================================================================
 * 學校總務行政助理 — 資料可靠性、無障礙與使用體驗升級模組 (reliability-ux.js)
 * 對應《使用體驗改善建議》P1 (A1–A5)、P2 (B1–B8)、P3 (C1, C4, C5) 全項修正
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// C1. 正式模組與擴充點登記表（供健康檢查與未來新模組掛載）
// ----------------------------------------------------------------------------
window.GA_REGISTRY = window.GA_REGISTRY || {
  modules: {},
  alertProviders: [],
  registerModule(name, version, desc) {
    this.modules[name] = { name, version, desc, loadedAt: new Date().toISOString() };
  },
  registerAlertProvider(id, fn) {
    this.alertProviders = this.alertProviders.filter(p => p.id !== id);
    this.alertProviders.push({ id, fn });
  }
};

// ----------------------------------------------------------------------------
// 0. 注入 P1/P2/P3 樣式（B1 按鈕高度、B2 字體下限、B3 手機導覽、B4 提示、B8 焦點）
// ----------------------------------------------------------------------------
(function injectReliabilityStyles() {
  const st = document.createElement('style');
  st.id = 'reliability-ux-style';
  st.textContent = `
    /* B2: 最小字體 12px，輔助說明文字 13px */
    body { font-size: 14px; }
    .item-meta, .roc-hint, .kpi-label, .eng-stat .lbl { font-size: 13px !important; }
    .tag, .badge-soon, .doc-chip, .role-badge, .portal-chip, .sync-pill, small {
      font-size: 12px !important;
    }

    /* B1: 桌面按鈕至少 36px，危險按鈕與相鄰安全按鈕拉開間距 */
    button, a.btn-xs, a.btn-sm, .pill-btn {
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 13px;
    }
    .btn-sm { padding: 6px 11px; min-height: 36px; font-size: 13px; }
    .btn-xs { padding: 5px 10px; min-height: 36px; font-size: 12px; }
    button + .btn-danger, a + .btn-danger { margin-left: 10px; }

    /* B8: 明顯鍵盤焦點外框與語意按鈕樣式 */
    :focus-visible {
      outline: 3px solid #2563eb !important;
      outline-offset: 2px !important;
      border-radius: 4px;
    }
    .card-link-btn {
      background: transparent !important; border: none !important; padding: 0 !important;
      min-height: 30px !important; color: var(--primary); font-weight: 800; font-size: 15.5px;
      text-align: left; justify-content: flex-start; cursor: pointer;
    }
    .card-link-btn:hover { text-decoration: underline; background: transparent !important; }

    /* A1: 待同步佇列紅色徽章 */
    .queue-badge {
      background: #dc2626 !important; color: #fff !important; border-color: #b91c1c !important;
      animation: qpulse 1.8s infinite;
    }
    @keyframes qpulse { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.45)} 50%{box-shadow:0 0 0 6px rgba(220,38,38,0)} }

    /* A3 & C4: 頂部模組健康／資料異常／測試範例警示橫幅 */
    .sys-banner {
      padding: 8px 16px; font-size: 13px; font-weight: 600;
      display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
      border-bottom: 1px solid;
    }
    .sys-banner.warn { background: #fef3c7; color: #92400e; border-color: #f59e0b; }
    .sys-banner.info { background: #e0f2fe; color: #075985; border-color: #38bdf8; }
    .sys-banner.err { background: #fee2e2; color: #991b1b; border-color: #ef4444; }

    /* A4: 欄位正下方行內錯誤與紅框 */
    .field-invalid {
      border-color: #dc2626 !important;
      box-shadow: 0 0 0 2px rgba(220, 38, 38, .18) !important;
      background: #fffafa !important;
    }
    .field-err-msg { color: #dc2626; font-size: 12.5px; font-weight: 700; margin-top: 3px; }

    /* B6: 折疊區塊必填進度徽章 */
    .acc-prog {
      font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
      background: #e2e8f0; color: #334155;
    }
    .acc-prog.done { background: #d1fae5; color: #065f46; }
    .acc-prog.miss { background: #fef3c7; color: #92400e; }

    /* B4: 升級版 Toast（不遮擋操作區、支援復原與手動關閉錯誤） */
    #toast {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      max-width: min(520px, calc(100vw - 24px));
      pointer-events: auto;
    }
    #toast:not(.show) { pointer-events: none; }
    #toast.toast-err { background: #991b1b; border: 1px solid #fecaca; }
    .toast-action-btn {
      background: #fff !important; color: #0f172a !important; border: none !important;
      min-height: 32px !important; padding: 3px 10px !important; font-size: 12.5px !important;
    }
    .toast-close-btn {
      background: rgba(255,255,255,.2) !important; color: #fff !important; border: none !important;
      min-height: 30px !important; padding: 2px 8px !important; font-size: 12px !important;
    }

    /* B3: 導覽頁籤捲動提示漸層與黏性置頂 */
    .nav-tabs-wrap {
      position: sticky; top: 0; z-index: 60; background: var(--surface);
      border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .nav-tabs-wrap::after {
      content: ""; position: absolute; right: 0; top: 0; bottom: 0; width: 32px;
      pointer-events: none;
      background: linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,.96));
    }
    .nav-tabs { border-bottom: none; padding-right: 36px; scroll-behavior: smooth; }
    .nav-tab { min-height: 40px; font-size: 13.5px; }

    /* B3: 手機版專屬優化（<= 768px） */
    .portal-mobile-toggle { display: none; }
    @media (max-width: 768px) {
      button, .btn-sm, .btn-xs, .pill-btn, .nav-tab { min-height: 44px !important; }
      #btn-fit-mode { display: none !important; }
      .topbar { padding: 8px 12px; gap: 8px; }
      #global-search { width: 100% !important; order: 10; min-height: 40px; }
      .portal-bar { flex-wrap: wrap; padding: 6px 12px; }
      .portal-bar.mobile-collapsed > a,
      .portal-bar.mobile-collapsed > span,
      .portal-bar.mobile-collapsed > button:not(.portal-mobile-toggle) { display: none !important; }
      .portal-mobile-toggle {
        display: inline-flex !important; width: 100%; justify-content: space-between;
        background: #334155 !important; color: #f8fafc !important; border-color: #475569 !important;
        min-height: 40px !important;
      }
      #toast {
        left: 50% !important; right: auto !important; bottom: 14px !important;
        transform: translateX(-50%); width: calc(100vw - 24px); justify-content: space-between;
      }
    }

    /* 一屏適配下維持 B2 最小字體 12px 與按鈕易點 */
    @media (min-width: 960px) {
      body.dash-lock .alert-item,
      body.dash-lock .routine-item,
      body.dash-lock .memo-item { font-size: 13px !important; }
      body.dash-lock .item-meta { font-size: 12px !important; }
      body.dash-lock .btn-xs { min-height: 36px; padding: 4px 9px; }
    }
  `;
  document.head.appendChild(st);
})();

// ----------------------------------------------------------------------------
// C4. 回饋率正規化（相容 15% / 15％ / 15 / 0.15 / "0.15" / 1% / 1）＋ 資料異常檢查
// ----------------------------------------------------------------------------
normFeedbackRate = function(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return 0;
    if (s.endsWith('%') || s.endsWith('％')) {
      const num = Number(s.slice(0, -1).trim());
      return (isNaN(num) || num < 0) ? 0 : Number((num / 100).toFixed(8));
    }
    const num = Number(s);
    if (isNaN(num) || num < 0) return 0;
    return num >= 1 ? Number((num / 100).toFixed(8)) : num;
  }
  const n = Number(raw);
  if (isNaN(n) || n < 0) return 0;
  return n >= 1 ? Number((n / 100).toFixed(8)) : n;
};

function scanCloudDataAnomalies() {
  const issues = [];
  const isBadDate = v => v && !/^\d{4}-\d{2}-\d{2}$/.test(String(v).slice(0, 10));

  (appData.tables?.Solar_Contracts || []).forEach(c => {
    const rawR = c.feedback_rate;
    if (rawR !== '' && rawR !== undefined && rawR !== null) {
      const r = normFeedbackRate(rawR);
      if (r <= 0 || r > 1) issues.push(`太陽能契約 ${c.solar_id}「${c.building_name}」回饋率異常（${rawR}）`);
    }
    if (isBadDate(c.contract_start) || isBadDate(c.contract_end)) {
      issues.push(`太陽能契約 ${c.solar_id} 起迄日期格式異常`);
    }
  });
  (appData.tables?.Projects || []).forEach(p => {
    if (Number(p.budget_amount) < 0) issues.push(`採購案 ${p.project_id} 預算金額為負數`);
    if (isBadDate(p.start_date) || isBadDate(p.orig_end_date)) issues.push(`採購案 ${p.project_id} 日期格式異常`);
  });
  (appData.tables?.Utilities_Bills || []).forEach(b => {
    if (Number(b.bill_amount) < 0 || Number(b.usage_units) < 0) issues.push(`水電帳單 ${b.bill_id} 金額或度數為負數`);
  });
  return issues;
}

// ----------------------------------------------------------------------------
// B4. 升級 Toast（aria-live、錯誤停留至關閉、支援復原／重送按鈕）
// ----------------------------------------------------------------------------
function initToastA11y() {
  const el = document.getElementById('toast');
  if (!el) return;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
}

function dismissToast() {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(window._toastTimer);
  el.classList.remove('show', 'toast-err');
}

toast = function(msg, opts = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  initToastA11y();
  clearTimeout(window._toastTimer);

  const sMsg = String(msg || '');
  const isError = opts.type === 'error' || /^[⚠️❌🚨]/.test(sMsg);
  const persistent = opts.persistent !== undefined ? opts.persistent : isError;
  const duration = opts.duration || (opts.actionLabel ? 10000 : 3200);

  el.setAttribute('role', isError ? 'alert' : 'status');
  el.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  el.classList.toggle('toast-err', isError);

  el.innerHTML = `<span style="flex:1">${esc(sMsg)}</span>`
    + (opts.actionLabel ? `<button type="button" class="toast-action-btn" id="toast-act-btn">${esc(opts.actionLabel)}</button>` : '')
    + `<button type="button" class="toast-close-btn" aria-label="關閉提示" onclick="dismissToast()">✕</button>`;

  if (opts.actionLabel && typeof opts.onAction === 'function') {
    const actBtn = document.getElementById('toast-act-btn');
    if (actBtn) actBtn.onclick = () => { dismissToast(); opts.onAction(); };
  }

  el.classList.add('show');
  if (!persistent) {
    window._toastTimer = setTimeout(() => dismissToast(), duration);
  }
};

// ----------------------------------------------------------------------------
// A1. 雲端寫入「待同步佇列」＋ 失敗紅徽章 ＋ 連網自動重試
// ----------------------------------------------------------------------------
const SYNC_QUEUE_KEY = 'ga_sync_queue_v1';
let syncQueue = loadSyncQueue();
let isFlushingQueue = false;

function loadSyncQueue() {
  try {
    const arr = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveSyncQueue() {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
  renderSyncQueueBadge();
}

function renderSyncQueueBadge() {
  const actions = document.querySelector('.top-actions');
  if (!actions) return;
  let btn = document.getElementById('btn-sync-queue');
  if (syncQueue.length === 0) {
    if (btn) btn.remove();
    return;
  }
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btn-sync-queue';
    btn.className = 'queue-badge';
    btn.onclick = openSyncQueueModal;
    actions.insertBefore(btn, actions.firstChild);
  }
  btn.textContent = `🔴 ${syncQueue.length} 筆未同步`;
  btn.title = '有變更尚未寫入 Google Sheets，點擊檢視或一鍵重送';
}

function isPayloadTouchingLocalTestSeed(payload) {
  if (!hasLocalTestSeedData()) return false;
  const s = JSON.stringify(payload || {});
  return s.includes('SOL-D4P1') || s.includes('SR-D4P1') || s.includes('BND-D4P1') || s.includes('CMP-D4P1');
}

const _rawPushToCloud = pushToCloud;
pushToCloud = async function(payload) {
  persistCache();
  // A2 保護：本機測試範例資料與其修改絕不寫入雲端 Google Sheets
  if (isPayloadTouchingLocalTestSeed(payload)) {
    toast('🧪 測試範例資料僅保留於本機，不會上傳至雲端 Google Sheets');
    return { ok: true, localOnly: true };
  }
  if (!appConfig.gasUrl || !appConfig.token) {
    toast('💾 已暫存於瀏覽器本機（設定 GAS 後可雲端同步）');
    return { ok: true, localOnly: true };
  }

  const res = await _rawPushToCloud(payload);
  if (res && res.ok) return res;

  syncQueue.push({
    qid: 'Q-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    createdAt: nowStr(),
    action: payload.action || 'upsert',
    table: payload.table || (payload.items ? payload.items.map(i => i.table).join(',') : ''),
    error: (res && res.error) || '網路連線異常',
    payload
  });
  saveSyncQueue();
  setSyncUI('err', `${syncQueue.length} 筆待重送`);
  toast(`⚠️ 雲端寫入失敗，已暫存待同步佇列（目前 ${syncQueue.length} 筆，連網後將自動重試）`, {
    type: 'error',
    persistent: true,
    actionLabel: '🔄 立即重送',
    onAction: () => retrySyncQueue(true)
  });
  return { ok: false, queued: true, error: res?.error };
};

async function retrySyncQueue(showFeedback = false) {
  if (isFlushingQueue || !syncQueue.length) return true;
  if (!appConfig.gasUrl || !appConfig.token) return false;
  if (navigator.onLine === false) {
    if (showFeedback) toast('⚠️ 目前處於離線狀態，待網路恢復後將自動重送', { type: 'error' });
    return false;
  }
  isFlushingQueue = true;
  setSyncUI('syncing', `重送中 (剩 ${syncQueue.length} 筆)...`);
  let sentCount = 0;

  try {
    while (syncQueue.length > 0) {
      const head = syncQueue[0];
      const res = await _rawPushToCloud(head.payload);
      if (res && res.ok) {
        syncQueue.shift();
        sentCount++;
        saveSyncQueue();
      } else {
        head.error = (res && res.error) || '重送失敗';
        saveSyncQueue();
        setSyncUI('err', `重送受阻 (剩 ${syncQueue.length} 筆)`);
        if (showFeedback) {
          toast(`⚠️ 已補送 ${sentCount} 筆，仍有 ${syncQueue.length} 筆失敗：${head.error}`, { type: 'error', persistent: true });
        }
        return false;
      }
    }
    setSyncUI('ok', '已全部補送同步');
    if (showFeedback || sentCount > 0) toast(`✅ 待同步佇列已全部寫入 Google Sheets（共 ${sentCount} 筆）`);
    return true;
  } finally {
    isFlushingQueue = false;
  }
}

function openSyncQueueModal() {
  openModal(`🔴 待同步佇列（共 ${syncQueue.length} 筆尚未寫入雲端）`, `
    <div class="gate-banner amber" style="margin-bottom:10px">
      以下變更已安全保存在本機瀏覽器，尚未成功寫入 Google Sheets。網路恢復時會自動重試，您也可以點擊下方按鈕立即全部重送。
    </div>
    ${syncQueue.length ? `<table>
      <thead><tr><th>時間</th><th>指令／資料表</th><th>失敗原因</th><th>操作</th></tr></thead>
      <tbody>
        ${syncQueue.map((q, idx) => `<tr>
          <td style="white-space:nowrap">${esc(q.createdAt)}</td>
          <td><code>${esc(q.action)}</code><div class="item-meta">${esc(q.table)}</div></td>
          <td style="color:var(--red)">${esc(q.error)}</td>
          <td><button type="button" class="btn-xs btn-danger" style="margin-left:0" onclick="discardQueueItem(${idx})">捨棄</button></td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<div class="empty-state">🎉 佇列已清空，本機與雲端完全一致！</div>'}
  `, `
    <button type="button" onclick="closeModal()">關閉</button>
    ${syncQueue.length ? `<button type="button" class="btn-primary" onclick="closeModal();retrySyncQueue(true)">🔄 立即全部重送</button>` : ''}
  `);
}

function discardQueueItem(idx) {
  syncQueue.splice(idx, 1);
  saveSyncQueue();
  openSyncQueueModal();
}

// 同步拉取雲端前先清掉待同步佇列，防止雲端舊資料蓋掉本機尚未上傳的新修改
const _rawSyncFromCloud = syncFromCloud;
syncFromCloud = async function(showMsg = false) {
  if (syncQueue.length > 0) {
    const flushed = await retrySyncQueue(false);
    if (!flushed) {
      if (showMsg) toast(`⚠️ 尚有 ${syncQueue.length} 筆本機異動未上傳，已暫停覆蓋拉取以避免遺失修改`, { type: 'error', persistent: true });
      return;
    }
  }
  await _rawSyncFromCloud(showMsg);
  renderSystemHealthBanners();
};

window.addEventListener('online', () => {
  if (syncQueue.length > 0) retrySyncQueue(true);
});

// ----------------------------------------------------------------------------
// A3. 外掛模組載入健康檢查 & 頂部系統橫幅（缺模組／測試範例／資料格式異常）
// ----------------------------------------------------------------------------
function probeExpectedModules() {
  const specs = [
    { file: 'eng-module.js', label: '工程品管與權責分工', version: 'v1.0', ok: typeof calcEngineeringSummary === 'function' && typeof printResponsibilitiesPDF === 'function' },
    { file: 'ops-module.js', label: '水電費與外部電費同步', version: 'v1.2', ok: typeof renderUtilitiesViewHTML === 'function' && typeof calcUtilitiesBudgetProjection === 'function' },
    { file: 'ux-upgrade.js', label: '例行視覺化／保養分期／一屏適配', version: 'v2.2', ok: typeof describeDueRuleHuman === 'function' && typeof runClaudeVerificationSuite === 'function' },
    { file: 'solar-v2.js', label: '太陽能四表重構與 5% 級距', version: 'v2.2', ok: typeof calcSolarBillV2 === 'function' && typeof openSharedMeterBatchModal === 'function' },
    { file: 'reliability-ux.js', label: '待同步佇列／復原刪除／無障礙', version: 'v1.0', ok: true }
  ];
  specs.forEach(s => { if (s.ok) window.GA_REGISTRY.registerModule(s.file, s.version, s.label); });
  return specs;
}

function hasLocalTestSeedData() {
  return (appData.tables?.Solar_Contracts || []).some(c => c.solar_id === 'SOL-D4P1' && String(c.building_name || '').includes('【測試範例】'));
}

function renderSystemHealthBanners() {
  const shell = document.getElementById('app-shell');
  if (!shell) return;
  let host = document.getElementById('sys-banners-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'sys-banners-host';
    const navWrap = document.querySelector('.nav-tabs-wrap') || document.getElementById('nav-tabs');
    shell.insertBefore(host, navWrap);
  }

  const banners = [];
  const missing = probeExpectedModules().filter(m => !m.ok);
  if (missing.length) {
    banners.push(`<div class="sys-banner warn" role="alert">
      <span>⚠️ <strong>部分功能未載入：</strong>${esc(missing.map(m => `${m.file}（${m.label}）`).join('、'))}。請檢查檔案是否完整或按 Cmd+Shift+R 重整。</span>
    </div>`);
  }
  if (hasLocalTestSeedData()) {
    banners.push(`<div class="sys-banner info" role="status">
      <span>🧪 <strong>本機測試範例模式：</strong>已載入「D4 一期」測試範例，僅存於本機瀏覽器，<strong>不會上傳至您的 Google Sheets</strong>。</span>
      <button type="button" class="btn-xs" onclick="clearLocalTestSeedData()">🧹 清除測試範例</button>
    </div>`);
  }
  const anomalies = scanCloudDataAnomalies();
  if (anomalies.length && !window._dismissedAnomalies) {
    banners.push(`<div class="sys-banner err" role="alert">
      <span>🚨 <strong>試算表資料格式異常（${anomalies.length} 筆）：</strong>${esc(anomalies.slice(0, 2).join('；'))}${anomalies.length > 2 ? '…' : ''}</span>
      <button type="button" class="btn-xs" onclick="window._dismissedAnomalies=true;renderSystemHealthBanners()">暫時隱藏</button>
    </div>`);
  }
  host.innerHTML = banners.join('');
}

// ----------------------------------------------------------------------------
// A2. 測試功能移入「⚙️ 連線與備份 → 開發者工具」＋ 範例資料純本機不推雲端
// ----------------------------------------------------------------------------
const _origRenderSolarView_rel = renderSolarViewHTML;
renderSolarViewHTML = function() {
  let html = _origRenderSolarView_rel();
  html = html
    .replace('<button class="btn-sm" onclick="runSolarV2UnitTests()">🧪 驗算測試</button>', '')
    .replace('<button class="btn-sm" onclick="seedD4Phase1Data()">🌱 匯入D4一期測試案</button>', '')
    .replace('onclick="seedD4Phase1Data()">🌱 一鍵載入「D4教室暨D4風雨球場屋頂（一期）」完整真實案例</button>', 'onclick="openSolarContractModal()">＋ 新增第一份太陽能租賃契約</button>');
  // B8: 契約卡片標題由 <div> 改為語意 <button>
  html = html.replace(
    /<div style="font-size:15\.5px;font-weight:800;margin-top:4px;cursor:pointer;color:var\(--primary\)" onclick="openSolarContractDetail\('([^']+)'\)">([^<]+)<\/div>/g,
    '<button type="button" class="card-link-btn" onclick="openSolarContractDetail(\'$1\')">$2</button>'
  );
  // B5: 契約卡片「續租截止」補上民國年主顯示
  html = html.replace(/續租截止：(\d{4}-\d{2}-\d{2})/g, (_, d) => `續租截止：${toRocDate(d)} (${d})`);
  return html;
};

const _origSeedD4 = typeof seedD4Phase1Data === 'function' ? seedD4Phase1Data : null;
seedD4Phase1Data = async function() {
  if (!_origSeedD4) return;
  const origPushRef = pushToCloud;
  pushToCloud = async () => ({ ok: true, localOnly: true });
  try {
    await _origSeedD4();
    const c = (appData.tables.Solar_Contracts || []).find(x => x.solar_id === 'SOL-D4P1');
    if (c && !String(c.building_name || '').startsWith('【測試範例】')) {
      c.building_name = '【測試範例】' + c.building_name;
    }
    persistCache();
    renderSystemHealthBanners();
    renderCurrentView();
    toast('🧪 已於本機載入「D4 一期」測試範例（未上傳至雲端，可隨時於頂端橫幅清除）');
  } finally {
    pushToCloud = origPushRef;
  }
};

function clearLocalTestSeedData() {
  appData.tables.Solar_Contracts = (appData.tables.Solar_Contracts || []).filter(c => c.solar_id !== 'SOL-D4P1');
  appData.tables.Solar_Records = (appData.tables.Solar_Records || []).filter(r => r.solar_id !== 'SOL-D4P1');
  appData.tables.Solar_Bond_Ledger = (appData.tables.Solar_Bond_Ledger || []).filter(t => t.solar_id !== 'SOL-D4P1');
  appData.tables.Solar_Compliance_Logs = (appData.tables.Solar_Compliance_Logs || []).filter(l => l.solar_id !== 'SOL-D4P1');
  if (solarV2SelectedId === 'SOL-D4P1') solarV2SelectedId = null;
  persistCache();
  renderSystemHealthBanners();
  renderCurrentView();
  toast('🧹 已清除本機測試範例資料');
}

// ----------------------------------------------------------------------------
// A2 ＋ A3 ＋ C5：升級「⚙️ 連線與備份」（公用電腦登出 ＋ 模組狀態 ＋ 開發者工具）
// ----------------------------------------------------------------------------
const _prevOpenSettings_rel = openSettingsModal;
openSettingsModal = function() {
  _prevOpenSettings_rel();
  const bd = document.getElementById('modal-body');
  if (!bd) return;

  const oldBtn = document.getElementById('btn-claude-verify');
  if (oldBtn && oldBtn.parentElement) oldBtn.parentElement.remove();

  const mods = probeExpectedModules();
  const extra = document.createElement('div');
  extra.style.marginTop = '12px';
  extra.innerHTML = `
    <div class="gate-banner amber" style="margin-bottom:10px">
      <strong>🔒 公用電腦資安提醒：</strong>GAS 通行金鑰與業務快取儲存在本機瀏覽器。若於共用電腦使用，離開前請點擊下方「登出並清除本機資料」。
      <div style="margin-top:8px">
        <button type="button" class="btn-sm btn-danger" style="margin-left:0" onclick="logoutAndClearLocalData()">🚪 登出並清除本機資料</button>
      </div>
    </div>

    <details class="sol-acc">
      <summary><span>🧩 系統模組載入狀態（${mods.filter(m=>m.ok).length} / ${mods.length} 正常）</span></summary>
      <div class="sol-acc-bd" style="padding:8px;overflow-x:auto">
        <table>
          <thead><tr><th>模組檔案</th><th>功能說明</th><th>版本</th><th>狀態</th></tr></thead>
          <tbody>
            ${mods.map(m => `<tr>
              <td><code>${esc(m.file)}</code></td><td>${esc(m.label)}</td><td>${esc(m.version)}</td>
              <td><span class="tag ${m.ok?'tag-green':'tag-red'}">${m.ok ? '✅ 正常' : '❌ 未載入'}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </details>

    <details class="sol-acc">
      <summary><span>🛠️ 開發者與測試工具（沙盒隔離，不寫入雲端正式資料）</span></summary>
      <div class="sol-acc-bd" style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn-sm btn-primary" onclick="runClaudeVerificationSuite()">🧪 執行 Claude 全站實證驗證</button>
        ${typeof runSolarV2UnitTests === 'function' ? `<button type="button" class="btn-sm" onclick="runSolarV2UnitTests()">🧪 太陽能 V2 財務驗算測試</button>` : ''}
        <button type="button" class="btn-sm" onclick="closeModal();switchTab('solar');seedD4Phase1Data()">🌱 載入 D4 一期本機測試範例（不上傳）</button>
        ${hasLocalTestSeedData() ? `<button type="button" class="btn-sm btn-danger" style="margin-left:0" onclick="closeModal();clearLocalTestSeedData()">🧹 清除測試範例</button>` : ''}
      </div>
    </details>
  `;
  bd.appendChild(extra);
};

function logoutAndClearLocalData() {
  openConfirmModal({
    title: '🚪 確認登出並清除本機資料',
    message: '此動作會從本機瀏覽器清除 GAS 通行金鑰、網址、快取與待同步佇列（雲端 Google Sheets 資料不受影響）。確定要繼續嗎？',
    confirmLabel: '確認登出並清除',
    danger: true,
    onConfirm: () => {
      localStorage.removeItem(STORAGE_CFG);
      localStorage.removeItem(STORAGE_DATA);
      localStorage.removeItem(SYNC_QUEUE_KEY);
      localStorage.removeItem('ga_dash_autofit_v1');
      location.reload();
    }
  });
}

// ----------------------------------------------------------------------------
// A4 & B6. 欄位正下方行內紅框驗證 ＋ 太陽能 4 折疊區必填進度與自動展開
// ----------------------------------------------------------------------------
function clearFormErrors(rootEl) {
  const host = rootEl || document.getElementById('modal-body');
  if (!host) return;
  host.querySelectorAll('.field-invalid').forEach(el => el.classList.remove('field-invalid'));
  host.querySelectorAll('.field-err-msg').forEach(el => el.remove());
}

function showInlineErrors(errors) {
  const bd = document.getElementById('modal-body');
  clearFormErrors(bd);
  if (!errors.length) return true;

  errors.forEach(({ id, msg }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('field-invalid');
    const errDiv = document.createElement('div');
    errDiv.className = 'field-err-msg';
    errDiv.setAttribute('role', 'alert');
    errDiv.textContent = '⚠️ ' + msg;
    el.parentElement.appendChild(errDiv);
  });

  const firstEl = document.getElementById(errors[0].id);
  if (firstEl) {
    const parentAcc = firstEl.closest('details');
    if (parentAcc) parentAcc.open = true;
    firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstEl.focus();
  }
  return false;
}

const _origOpenProjectWizard_rel = openProjectWizard;
openProjectWizard = function(presetTemplateId = '', presetName = '', sourceMemoId = '') {
  _origOpenProjectWizard_rel(presetTemplateId, presetName, sourceMemoId);
  const bEl = document.getElementById('wiz-budget');
  if (bEl && bEl.previousElementSibling) {
    bEl.previousElementSibling.textContent = '預算金額（元，自動連動級距與決標原則）*';
  }
};

const _origSubmitNewProject_rel = submitNewProject;
submitNewProject = async function() {
  const errs = [];
  if (!(document.getElementById('wiz-name')?.value || '').trim()) {
    errs.push({ id: 'wiz-name', msg: '請填寫採購案件名稱' });
  }
  const bRaw = document.getElementById('wiz-budget')?.value;
  if (bRaw === '' || isNaN(Number(bRaw)) || Number(bRaw) <= 0) {
    errs.push({ id: 'wiz-budget', msg: '請填寫大於 0 的預算金額（系統依此自動判定級距與合規決標原則）' });
  }
  if (!showInlineErrors(errs)) return;
  await _origSubmitNewProject_rel();
};

const _origSaveRoutine_rel = saveRoutine;
saveRoutine = async function(routineId) {
  const title = (document.getElementById('rt-title')?.value || '').trim();
  if (!showInlineErrors(title ? [] : [{ id: 'rt-title', msg: '請填寫固定辦理事項名稱' }])) return;
  await _origSaveRoutine_rel(routineId);
};

// B6: 太陽能契約表單 — 新增時只展開第 1 區 ＋ 各區顯示必填進度 ＋ 缺漏自動展開
const _origOpenSolarModal_rel = openSolarContractModal;
openSolarContractModal = function(solarId = '') {
  _origOpenSolarModal_rel(solarId);
  const accs = Array.from(document.querySelectorAll('#modal-body details.sol-acc'));
  if (!solarId) accs.forEach((d, idx) => { d.open = (idx === 0); });

  const reqMap = [['sv2-name'], ['sv2-vname'], ['sv2-kwp', 'sv2-rate'], []];
  const updateProgress = () => {
    accs.forEach((d, idx) => {
      const sum = d.querySelector('summary');
      if (!sum) return;
      let badge = sum.querySelector('.acc-prog');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'acc-prog';
        sum.appendChild(badge);
      }
      const reqIds = reqMap[idx] || [];
      if (reqIds.length) {
        const filled = reqIds.filter(id => {
          const el = document.getElementById(id);
          const v = (el?.value || '').trim();
          return v !== '' && (el?.type !== 'number' || Number(v) > 0);
        }).length;
        badge.textContent = `必填 ${filled}/${reqIds.length}`;
        badge.className = 'acc-prog ' + (filled === reqIds.length ? 'done' : 'miss');
      } else {
        const opt = ['sv2-s1', 'sv2-s2', 'sv2-bondinit'].filter(id => (document.getElementById(id)?.value || '').trim() !== '').length;
        badge.textContent = `效期與保金 ${opt}/3`;
        badge.className = 'acc-prog';
      }
    });
  };
  const bd = document.getElementById('modal-body');
  if (bd) {
    bd.addEventListener('input', updateProgress);
    bd.addEventListener('change', updateProgress);
  }
  updateProgress();
};

const _origSaveSolarV2_rel = saveSolarContractV2;
saveSolarContractV2 = async function(solarId) {
  const errs = [];
  if (!(document.getElementById('sv2-name')?.value || '').trim()) errs.push({ id: 'sv2-name', msg: '請填寫案場／屋頂名稱' });
  if (!(document.getElementById('sv2-vname')?.value || '').trim()) errs.push({ id: 'sv2-vname', msg: '請填寫承租廠商名稱' });
  if (!(Number(document.getElementById('sv2-kwp')?.value) > 0)) errs.push({ id: 'sv2-kwp', msg: '請填寫大於 0 的本約標租容量 (kWp)' });
  if (!(Number(document.getElementById('sv2-rate')?.value) > 0)) errs.push({ id: 'sv2-rate', msg: '請填寫大於 0 的回饋金比例 (%)' });
  if (!showInlineErrors(errs)) return;
  await _origSaveSolarV2_rel(solarId);
};

// ----------------------------------------------------------------------------
// B7. 視窗操作一致性：Esc 關閉（有修改先問）、關閉清錯誤、自建多行輸入與確認視窗
// ----------------------------------------------------------------------------
let modalDirty = false;

const _origOpenModal_rel = openModal;
openModal = function(title, bodyHtml, footerHtml) {
  modalDirty = false;
  const dirtyBar = document.getElementById('modal-dirty-bar');
  if (dirtyBar) dirtyBar.remove();
  _origOpenModal_rel(title, bodyHtml, footerHtml);

  const bd = document.getElementById('modal-body');
  if (bd) {
    enhanceAllDateInputsWithRoc(bd);
    bd.addEventListener('input', e => { if (e.isTrusted) modalDirty = true; });
    bd.addEventListener('change', e => { if (e.isTrusted) modalDirty = true; });
  }
  document.querySelectorAll('#modal-footer button').forEach(btn => {
    const txt = btn.textContent.trim();
    if (txt === '取消' && btn.getAttribute('onclick') === 'closeModal()') {
      btn.setAttribute('onclick', 'requestCloseModal()');
    }
  });
};

const _origCloseModal_rel = closeModal;
closeModal = function() {
  modalDirty = false;
  clearFormErrors();
  const dirtyBar = document.getElementById('modal-dirty-bar');
  if (dirtyBar) dirtyBar.remove();
  _origCloseModal_rel();
};

function requestCloseModal() {
  const backdrop = document.getElementById('modal-backdrop');
  if (!backdrop || !backdrop.classList.contains('open')) return;
  if (modalDirty) {
    if (!document.getElementById('modal-dirty-bar')) {
      const bar = document.createElement('div');
      bar.id = 'modal-dirty-bar';
      bar.className = 'gate-banner amber';
      bar.style.cssText = 'margin:0 18px 10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap';
      bar.innerHTML = `<span>⚠️ 表單已有修改尚未儲存，確定要關閉嗎？</span>
        <span style="display:flex;gap:8px">
          <button type="button" class="btn-xs" onclick="this.closest('#modal-dirty-bar').remove()">繼續編輯</button>
          <button type="button" class="btn-xs btn-danger" style="margin-left:0" onclick="closeModal()">放棄並關閉</button>
        </span>`;
      const ft = document.getElementById('modal-footer');
      if (ft && ft.parentElement) ft.parentElement.insertBefore(bar, ft);
    }
    return;
  }
  dismissToast();
  closeModal();
}

(function wireModalEscapeAndBackdrop() {
  const bd = document.getElementById('modal-backdrop');
  if (bd) bd.setAttribute('onclick', 'if(event.target===this) requestCloseModal()');
  const hdClose = document.querySelector('#modal-backdrop .modal-hd button');
  if (hdClose) hdClose.setAttribute('onclick', 'requestCloseModal()');
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const backdrop = document.getElementById('modal-backdrop');
      if (backdrop && backdrop.classList.contains('open')) {
        e.preventDefault();
        requestCloseModal();
      }
    }
  });
})();

function openConfirmModal({ title, message, confirmLabel = '確認刪除', danger = true, onConfirm }) {
  window._pendingConfirmAction = onConfirm;
  openModal(title, `<p style="margin:4px 0 8px;font-size:14px;line-height:1.6">${esc(message)}</p>`, `
    <button type="button" onclick="closeModal()">取消</button>
    <button type="button" class="${danger ? 'btn-danger' : 'btn-primary'}" onclick="const fn=window._pendingConfirmAction;window._pendingConfirmAction=null;closeModal();if(fn)fn();">${esc(confirmLabel)}</button>
  `);
}

function openCustomPromptModal({ title, label, placeholder = '', multiline = false, onConfirm }) {
  window._pendingPromptAction = onConfirm;
  openModal(title, `
    <div class="field full">
      <label>${esc(label)} *</label>
      ${multiline
        ? `<textarea id="custom-prompt-val" style="min-height:115px" placeholder="${esc(placeholder)}"></textarea>`
        : `<input id="custom-prompt-val" type="text" placeholder="${esc(placeholder)}">`}
    </div>
  `, `
    <button type="button" onclick="closeModal()">取消</button>
    <button type="button" class="btn-primary" onclick="submitCustomPrompt()">確定</button>
  `);
  setTimeout(() => document.getElementById('custom-prompt-val')?.focus(), 50);
}

function submitCustomPrompt() {
  const val = (document.getElementById('custom-prompt-val')?.value || '').trim();
  if (!showInlineErrors(val ? [] : [{ id: 'custom-prompt-val', msg: '此欄位為必填，請輸入內容' }])) return;
  const fn = window._pendingPromptAction;
  window._pendingPromptAction = null;
  closeModal();
  if (fn) fn(val);
}

if (typeof rejectMaterial === 'function') {
  rejectMaterial = function(id, actor) {
    const m = (appData.tables.Project_Materials || []).find(x => x.material_id === id);
    if (!m) return;
    openCustomPromptModal({
      title: `↩️ 登記【${actor}】退回修正原因`,
      label: `材料「${m.item_name}」退件意見（永久留存作為工期歸責佐證，支援多行條列）`,
      placeholder: '例：\n1. 所附 CNS 防滑試驗報告逾有效期限。\n2. 缺少綠建材標章證明文件。',
      multiline: true,
      onConfirm: async reason => {
        const hist = parseJSON(m.review_history_json, []);
        hist.push({ rev: Number(m.revision_no) || 0, date: todayStr(), actor, note: '退件：' + reason });
        m.status = '退回修正';
        m.review_history_json = JSON.stringify(hist);
        m.updated_at = nowStr();
        renderCurrentView();
        await pushToCloud({ action: 'upsert', table: 'Project_Materials', record: m });
        toast('↩️ 已登記退回修正並留存佐證軌跡');
      }
    });
  };
}

addChecklistItem = function(taskId) {
  const t = (appData.tables.Project_Tasks || []).find(x => x.task_id === taskId);
  if (!t) return;
  openCustomPromptModal({
    title: `＋ 新增檢核項目（${t.stage_name}）`,
    label: '檢核項目內容',
    placeholder: '例：確認檢附教育局專案補助專用檢核表',
    multiline: false,
    onConfirm: async text => {
      const items = parseJSON(t.checklist_json, []);
      items.push({ id: 'chk_' + Date.now(), text, required: false, done: false, doc_no: '', done_date: '' });
      t.checklist_json = JSON.stringify(items);
      renderCurrentView();
      await pushToCloud({ action: 'upsert', table: 'Project_Tasks', record: t });
      toast('✅ 已新增檢核項目');
    }
  });
};

// ----------------------------------------------------------------------------
// B5. 全站所有日期欄位自動掛載「民國年即時對照提示」
// ----------------------------------------------------------------------------
function enhanceAllDateInputsWithRoc(root) {
  if (!root || typeof toRocDate !== 'function') return;
  root.querySelectorAll('input[type="date"]').forEach(inp => {
    const next = inp.nextElementSibling;
    if (next && next.classList.contains('roc-hint')) return;
    if (inp.closest('.memo-quick') || inp.closest('.chk-row')) return;
    const hint = document.createElement('div');
    hint.className = 'roc-hint';
    const sync = () => { hint.textContent = inp.value ? toRocDate(inp.value) : ''; };
    inp.insertAdjacentElement('afterend', hint);
    inp.addEventListener('input', sync);
    inp.addEventListener('change', sync);
    sync();
  });
}

// ----------------------------------------------------------------------------
// A5. 全站具名確認刪除 ＋ 10 秒「已刪除【復原】」復原機制
// ----------------------------------------------------------------------------
function performUndoableDelete({ table, pkKey, id, label, cascadeTables = [] }) {
  const mainArr = appData.tables[table] || [];
  const target = mainArr.find(r => r[pkKey] === id);
  if (!target) return;

  openConfirmModal({
    title: '🗑️ 確認刪除資料',
    message: `確定要刪除「${label}」嗎？（刪除後 10 秒內仍可點選提示列的【復原】按鈕救回）`,
    confirmLabel: '確認刪除',
    danger: true,
    onConfirm: async () => {
      const backupItems = [{ table, pkKey, records: [JSON.parse(JSON.stringify(target))] }];
      appData.tables[table] = mainArr.filter(r => r[pkKey] !== id);

      cascadeTables.forEach(([ct, cPk]) => {
        const children = (appData.tables[ct] || []).filter(r => r.project_id === id);
        if (children.length) {
          backupItems.push({ table: ct, pkKey: cPk, records: JSON.parse(JSON.stringify(children)) });
          appData.tables[ct] = (appData.tables[ct] || []).filter(r => r.project_id !== id);
        }
      });

      if (table === 'Projects' && selectedProjectId === id) selectedProjectId = null;
      if (table === 'Solar_Contracts' && solarV2SelectedId === id) solarV2SelectedId = null;
      persistCache();
      renderCurrentView();

      await pushToCloud({ action: 'softDelete', table, id, cascade: cascadeTables.length > 0 });

      toast(`🗑️ 已刪除「${label}」`, {
        duration: 10000,
        actionLabel: '↩️ 復原',
        onAction: async () => {
          const batchPayload = [];
          backupItems.forEach(item => {
            const restored = item.records.map(r => ({ ...r, is_deleted: false, updated_at: nowStr() }));
            restored.forEach(r => upsertLocal(item.table, r, item.pkKey));
            batchPayload.push({ table: item.table, records: restored });
          });
          persistCache();
          renderCurrentView();
          await pushToCloud({ action: 'batchUpsert', items: batchPayload });
          toast(`✅ 已復原「${label}」`);
        }
      });
    }
  });
}

deleteProject = function(id) {
  const p = (appData.tables.Projects || []).find(x => x.project_id === id);
  performUndoableDelete({
    table: 'Projects', pkKey: 'project_id', id,
    label: `採購案：${p?.project_name || id}`,
    cascadeTables: [
      ['Project_Tasks', 'task_id'], ['Project_Materials', 'material_id'],
      ['Project_ChangeOrders', 'change_id'], ['Project_Billings', 'billing_id'],
      ['Project_Responsibilities', 'resp_id']
    ]
  });
};
deleteTemplate = function(id) {
  const t = (appData.tables.Templates || []).find(x => x.template_id === id);
  performUndoableDelete({ table: 'Templates', pkKey: 'template_id', id, label: `標案模板：${t?.template_name || id}` });
};
deleteRoutine = function(id) {
  const r = (appData.tables.Annual_Routines || []).find(x => x.routine_id === id);
  performUndoableDelete({ table: 'Annual_Routines', pkKey: 'routine_id', id, label: `例行業務：${r?.title || id}` });
};
deleteMemo = function(id) {
  const m = (appData.tables.Quick_Memos || []).find(x => x.memo_id === id);
  performUndoableDelete({ table: 'Quick_Memos', pkKey: 'memo_id', id, label: `臨時交辦：${(m?.content || id).slice(0, 22)}` });
};
if (typeof deleteMaterial === 'function') {
  deleteMaterial = function(id) {
    const m = (appData.tables.Project_Materials || []).find(x => x.material_id === id);
    performUndoableDelete({ table: 'Project_Materials', pkKey: 'material_id', id, label: `送審材料：${m?.item_name || id}` });
  };
}
if (typeof deleteChangeOrder === 'function') {
  deleteChangeOrder = function(id) {
    const c = (appData.tables.Project_ChangeOrders || []).find(x => x.change_id === id);
    performUndoableDelete({ table: 'Project_ChangeOrders', pkKey: 'change_id', id, label: `變更設計：${c?.reason || id}` });
  };
}
if (typeof deleteBilling === 'function') {
  deleteBilling = function(id) {
    const b = (appData.tables.Project_Billings || []).find(x => x.billing_id === id);
    performUndoableDelete({ table: 'Project_Billings', pkKey: 'billing_id', id, label: `計價單：${b?.billing_seq || id}` });
  };
}
if (typeof deleteSolarContractV2 === 'function') {
  deleteSolarContractV2 = function(id) {
    const c = (appData.tables.Solar_Contracts || []).find(x => x.solar_id === id);
    performUndoableDelete({ table: 'Solar_Contracts', pkKey: 'solar_id', id, label: `太陽能契約：${c?.building_name || id}` });
  };
}
if (typeof deleteSolarRecordV2 === 'function') {
  deleteSolarRecordV2 = function(id) {
    const r = (appData.tables.Solar_Records || []).find(x => x.record_id === id);
    performUndoableDelete({ table: 'Solar_Records', pkKey: 'record_id', id, label: `太陽能對帳：${r?.period_label || id}` });
  };
}
if (typeof deleteBondTx === 'function') {
  deleteBondTx = function(id) {
    const t = (appData.tables.Solar_Bond_Ledger || []).find(x => x.tx_id === id);
    performUndoableDelete({ table: 'Solar_Bond_Ledger', pkKey: 'tx_id', id, label: `保證金異動：${t?.reason || id}` });
  };
}
if (typeof deleteComplianceLog === 'function') {
  deleteComplianceLog = function(id) {
    const l = (appData.tables.Solar_Compliance_Logs || []).find(x => x.log_id === id);
    performUndoableDelete({ table: 'Solar_Compliance_Logs', pkKey: 'log_id', id, label: `保險／變更紀錄：${l?.doc_or_policy_no || id}` });
  };
}
if (typeof deleteUtilityMeter === 'function') {
  deleteUtilityMeter = function(id) {
    const m = (appData.tables.Utilities_Meters || []).find(x => x.meter_id === id);
    closeModal();
    performUndoableDelete({ table: 'Utilities_Meters', pkKey: 'meter_id', id, label: `水電錶：${m?.meter_label || id}` });
  };
}
if (typeof deleteUtilityBill === 'function') {
  deleteUtilityBill = function(id) {
    const b = (appData.tables.Utilities_Bills || []).find(x => x.bill_id === id);
    performUndoableDelete({ table: 'Utilities_Bills', pkKey: 'bill_id', id, label: `水電帳單：${b?.billing_ym || id}` });
  };
}

// ----------------------------------------------------------------------------
// B3 & B8. 手機版傳送門收合、黏性頁籤漸層、main 地標與鍵盤無障礙
// ----------------------------------------------------------------------------
function setupAccessibilityAndMobileChrome() {
  const main = document.getElementById('main-view');
  if (main) {
    main.setAttribute('role', 'main');
    main.setAttribute('aria-label', '主要工作區');
  }
  const nav = document.getElementById('nav-tabs');
  if (nav) {
    nav.setAttribute('role', 'tablist');
    if (!nav.parentElement.classList.contains('nav-tabs-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'nav-tabs-wrap';
      nav.parentElement.insertBefore(wrap, nav);
      wrap.appendChild(nav);
    }
    syncNavTabAria();
  }
  const portalBar = document.getElementById('portal-bar');
  if (portalBar && !portalBar.querySelector('.portal-mobile-toggle')) {
    portalBar.classList.add('mobile-collapsed');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'portal-mobile-toggle';
    toggle.innerHTML = '<span>🔗 常用公務傳送門</span><span id="portal-arrow">▾ 展開</span>';
    toggle.onclick = () => {
      const collapsed = portalBar.classList.toggle('mobile-collapsed');
      const arr = document.getElementById('portal-arrow');
      if (arr) arr.textContent = collapsed ? '▾ 展開' : '▴ 收合';
    };
    portalBar.insertBefore(toggle, portalBar.firstChild);
  }
}

function syncNavTabAria() {
  document.querySelectorAll('#nav-tabs .nav-tab').forEach(btn => {
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
  });
}

function makeClickableCardsKeyboardAccessible() {
  document.querySelectorAll('.kpi-card[onclick], .ops-mini-card[onclick], .alert-item[onclick]').forEach(el => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
  });
}

document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute('role') === 'button' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    e.target.click();
  }
});

const _origRenderPortals_rel = renderHeaderAndPortals;
renderHeaderAndPortals = function() {
  _origRenderPortals_rel();
  setupAccessibilityAndMobileChrome();
};

const _origSwitchTab_rel = switchTab;
switchTab = function(tab) {
  _origSwitchTab_rel(tab);
  syncNavTabAria();
};

const _origRenderCurrentView_rel = renderCurrentView;
renderCurrentView = function() {
  _origRenderCurrentView_rel();
  syncNavTabAria();
  makeClickableCardsKeyboardAccessible();
  renderSyncQueueBadge();
  renderSystemHealthBanners();
};

// ----------------------------------------------------------------------------
// 啟動初始化
// ----------------------------------------------------------------------------
initToastA11y();
setupAccessibilityAndMobileChrome();
renderSyncQueueBadge();
renderSystemHealthBanners();
renderCurrentView();
if (syncQueue.length > 0 && navigator.onLine !== false) {
  setTimeout(() => retrySyncQueue(false), 1500);
}
// ----------------------------------------------------------------------------
// 修復中文輸入法（IME）組字確認按 Enter 誤觸送出 Memo
// ----------------------------------------------------------------------------
function bindSafeMemoEnter() {
  const inp = document.getElementById('memo-input');
  if (!inp || inp.dataset.imeSafe === '1') return;
  inp.dataset.imeSafe = '1';
  inp.removeAttribute('onkeydown');
  inp.onkeydown = null;

  let isComposing = false;
  let lastCompEnd = 0;

  inp.addEventListener('compositionstart', () => {
    isComposing = true;
  });
  inp.addEventListener('compositionend', () => {
    isComposing = false;
    lastCompEnd = Date.now();
  });
  inp.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    // 中文輸入法組字／選字確認期間（含 macOS Chrome keyCode 229 與結束組字瞬間）一律不送出
    if (e.isComposing || e.keyCode === 229 || isComposing || (Date.now() - lastCompEnd < 100)) {
      return;
    }
    e.preventDefault();
    quickAddMemo();
  });
}

const _prevRenderForIme = renderCurrentView;
renderCurrentView = function() {
  _prevRenderForIme();
  bindSafeMemoEnter();
};
bindSafeMemoEnter();
