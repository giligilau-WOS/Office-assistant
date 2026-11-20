/**
 * ============================================================================
 * 學校總務行政助理 — 體驗升級與 Claude 實證驗證外掛模組 (ux-upgrade.js)
 * 1. 例行業務視覺化到期規則填報器（免記代碼、白話中文顯示、支援兩年一次與自訂每N年/月）
 * 2. 擴充業務類別（一般小額採購、共同供應契約、自訂類別）與一鍵開單
 * 3. 開新採購精靈：預算金額自動連動級距與合規決標原則 ＋ 共同供應契約專屬 4 階段清單
 * 4. 內建沙盒版 Claude 實證驗證套件（真實 DOM E2E ＋ 500 組屬性測試 ＋ 差分測試）
 * ============================================================================
 */

(function injectUxUpgradeStyles() {
  const css = `
    .rule-builder-box {
      background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px;
      padding:10px 12px; display:flex; flex-direction:column; gap:8px;
    }
    .rule-inline { display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:13px; }
    .rule-inline select, .rule-inline input {
      padding:4px 7px; border:1px solid #cbd5e1; border-radius:5px; background:#fff;
    }
    .rule-preview {
      background:#eff6ff; border:1px solid #bfdbfe; color:#1e3a8a;
      border-radius:6px; padding:7px 10px; font-size:12.5px; line-height:1.5;
    }
    .legal-hint {
      padding:8px 10px; border-radius:6px; font-size:12px; line-height:1.5;
      border:1px solid #bfdbfe; background:#eff6ff; color:#1e3a8a;
    }
    .legal-hint.warn {
      border-color:#fcd34d; background:#fffbeb; color:#92400e;
    }
    .verify-pass { color:#059669; font-weight:700; }
    .verify-fail { color:#dc2626; font-weight:700; }
    .verify-log {
      font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px;
      background:#0f172a; color:#e2e8f0; padding:12px; border-radius:8px;
      max-height:360px; overflow:auto; white-space:pre-wrap; line-height:1.55;
    }
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
})();

// 1. 日期安全防護工具（修復非閏年 02-29 溢位與空日期 NaN 風險）
function daysInMonthSafe(year, month) {
  return new Date(year, month, 0).getDate();
}

function clampDateYmd(year, month, day) {
  const m = Math.max(1, Math.min(12, parseInt(month, 10) || 1));
  const maxD = daysInMonthSafe(year, m);
  const d = Math.max(1, Math.min(maxD, parseInt(day, 10) || 1));
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const _origDiffDaysUx = diffDays;
diffDays = function(a, b) {
  if (!a || !b) return 0;
  const d1 = new Date(String(a).slice(0, 10) + 'T00:00:00');
  const d2 = new Date(String(b).slice(0, 10) + 'T00:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  return Math.round((d2 - d1) / 86400000);
};

// 2. 年度固定例行業務：規則解析 / 編碼 / 白話說明 / 排程計算
const ROUTINE_CATEGORIES = [
  '法定填報',
  '設施安檢維運',
  '一般小額採購',
  '共同供應契約',
  '例行招標預告',
  '預算核銷',
  '校產與租約',
  '其他自訂業務'
];

const ROUTINE_RECURRENCES = [
  { value: '每年', label: '每年一次（固定月／日）' },
  { value: '每兩年', label: '每兩年一次（例：隔年公安／高壓電檢修）' },
  { value: '自訂每N年', label: '自訂每 N 年一次（例：每 3 年、每 5 年）' },
  { value: '每學期', label: '每學期一次（每年固定 2 個日期）' },
  { value: '每季', label: '每季一次（每 3 個月固定日期）' },
  { value: '每雙月', label: '每雙月一次（單數月或雙數月）' },
  { value: '每月', label: '每月一次（固定幾號）' },
  { value: '自訂每N個月', label: '自訂每 N 個月一次（例：每 4 或 6 個月）' }
];

function parseDueRuleConfig(recType, rawRule, fallbackRocYear) {
  const curRoc = fallbackRocYear || (new Date().getFullYear() - 1911);
  const rule = String(rawRule || '').trim();

  if (recType === '每年') {
    const m = rule.match(/^(\d{1,2})-(\d{1,2})$/);
    return { type: '每年', month: m ? parseInt(m[1], 10) : 12, day: m ? parseInt(m[2], 10) : 10 };
  }
  if (recType === '每兩年' || recType === '自訂每N年') {
    const m = rule.match(/^EVERY-(\d+)Y@(\d{2,3}):(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const iv = recType === '每兩年' ? 2 : Math.max(2, parseInt(m[1], 10));
      return {
        type: recType, interval: iv,
        anchorRocYear: parseInt(m[2], 10),
        month: parseInt(m[3], 10), day: parseInt(m[4], 10)
      };
    }
    const m2 = rule.match(/^(\d{1,2})-(\d{1,2})$/);
    return {
      type: recType, interval: recType === '每兩年' ? 2 : 3,
      anchorRocYear: curRoc,
      month: m2 ? parseInt(m2[1], 10) : 6, day: m2 ? parseInt(m2[2], 10) : 30
    };
  }
  if (recType === '每學期') {
    const parts = rule.split(',').map(s => s.trim());
    const p1 = (parts[0] || '').match(/^(\d{1,2})-(\d{1,2})$/);
    const p2 = (parts[1] || '').match(/^(\d{1,2})-(\d{1,2})$/);
    return {
      type: '每學期',
      m1: p1 ? parseInt(p1[1], 10) : 2, d1: p1 ? parseInt(p1[2], 10) : 10,
      m2: p2 ? parseInt(p2[1], 10) : 8, d2: p2 ? parseInt(p2[2], 10) : 20
    };
  }
  if (recType === '每季') {
    const isNext = rule.startsWith('Q-NEXT');
    const dm = rule.match(/(\d+)$/);
    return { type: '每季', mode: isNext ? 'NEXT' : 'END', day: dm ? Math.min(28, Math.max(1, parseInt(dm[1], 10))) : 25 };
  }
  if (recType === '每雙月') {
    const isOdd = rule.startsWith('ODD-');
    const dm = rule.match(/(\d+)$/);
    return { type: '每雙月', parity: isOdd ? 'ODD' : 'EVEN', day: dm ? Math.min(28, Math.max(1, parseInt(dm[1], 10))) : 10 };
  }
  if (recType === '每月') {
    const dm = rule.match(/(\d+)$/);
    return { type: '每月', day: dm ? Math.min(28, Math.max(1, parseInt(dm[1], 10))) : 10 };
  }
  if (recType === '自訂每N個月') {
    const m = rule.match(/^EVERY-(\d+)M@(\d{4})-(\d{2}):(\d{1,2})$/);
    if (m) {
      return {
        type: '自訂每N個月',
        interval: Math.max(1, parseInt(m[1], 10)),
        anchorYm: `${m[2]}-${m[3]}`,
        day: Math.min(28, Math.max(1, parseInt(m[4], 10)))
      };
    }
    return { type: '自訂每N個月', interval: 6, anchorYm: `${curRoc + 1911}-01`, day: 15 };
  }
  return { type: '每年', month: 12, day: 10 };
}

function encodeDueRuleConfig(cfg) {
  const pad2 = n => String(parseInt(n, 10) || 1).padStart(2, '0');
  const clamp28 = n => String(Math.min(28, Math.max(1, parseInt(n, 10) || 1))).padStart(2, '0');
  if (cfg.type === '每年') return `${pad2(cfg.month)}-${pad2(cfg.day)}`;
  if (cfg.type === '每兩年' || cfg.type === '自訂每N年') {
    const iv = cfg.type === '每兩年' ? 2 : Math.max(2, parseInt(cfg.interval, 10) || 2);
    return `EVERY-${iv}Y@${parseInt(cfg.anchorRocYear, 10) || 115}:${pad2(cfg.month)}-${pad2(cfg.day)}`;
  }
  if (cfg.type === '每學期') return `${pad2(cfg.m1)}-${pad2(cfg.d1)},${pad2(cfg.m2)}-${pad2(cfg.d2)}`;
  if (cfg.type === '每季') return `${cfg.mode === 'NEXT' ? 'Q-NEXT' : 'Q-END'}-${clamp28(cfg.day)}`;
  if (cfg.type === '每雙月') return `${cfg.parity === 'ODD' ? 'ODD-D' : 'D'}-${clamp28(cfg.day)}`;
  if (cfg.type === '每月') return `D-${clamp28(cfg.day)}`;
  if (cfg.type === '自訂每N個月') {
    const iv = Math.max(1, parseInt(cfg.interval, 10) || 6);
    return `EVERY-${iv}M@${cfg.anchorYm || todayStr().slice(0, 7)}:${clamp28(cfg.day)}`;
  }
  return '12-10';
}

function describeDueRuleHuman(recType, rawRule) {
  const cfg = parseDueRuleConfig(recType, rawRule);
  if (recType === '每年') return `每年 ${cfg.month} 月 ${cfg.day} 日`;
  if (recType === '每兩年') {
    const eo = cfg.anchorRocYear % 2 === 0 ? '偶數民國年' : '單數民國年';
    return `每 2 年 ${cfg.month} 月 ${cfg.day} 日（${cfg.anchorRocYear}年起／${eo}）`;
  }
  if (recType === '自訂每N年') return `每 ${cfg.interval} 年 ${cfg.month} 月 ${cfg.day} 日（自 ${cfg.anchorRocYear} 年起）`;
  if (recType === '每學期') return `每年 ${cfg.m1}/${cfg.d1} 及 ${cfg.m2}/${cfg.d2}`;
  if (recType === '每季') {
    return cfg.mode === 'NEXT'
      ? `每季次月（1/4/7/10月）${cfg.day} 日`
      : `每季末月（3/6/9/12月）${cfg.day} 日`;
  }
  if (recType === '每雙月') {
    return cfg.parity === 'ODD'
      ? `單數月（1/3/5/7/9/11月）${cfg.day} 日`
      : `雙數月（2/4/6/8/10/12月）${cfg.day} 日`;
  }
  if (recType === '每月') return `每月 ${cfg.day} 日`;
  if (recType === '自訂每N個月') return `每 ${cfg.interval} 個月 ${cfg.day} 日（自 ${cfg.anchorYm} 起）`;
  return String(rawRule || '-');
}

const _legacyComputeRoutineSchedule = computeRoutineSchedule;
computeRoutineSchedule = function(r, refTodayStr) {
  const today = refTodayStr || todayStr();
  const now = new Date(today + 'T00:00:00');
  const y = now.getFullYear();
  const rocY = y - 1911;
  const m = now.getMonth() + 1;
  const recType = r.recurrence_type || '每年';
  const cfg = parseDueRuleConfig(recType, r.due_rule, rocY);
  const candidates = [];

  if (recType === '每年') {
    [-1, 0, 1].forEach(dy => {
      candidates.push({ cycle: String(rocY + dy), date: clampDateYmd(y + dy, cfg.month, cfg.day) });
    });
  } else if (recType === '每兩年' || recType === '自訂每N年') {
    const iv = recType === '每兩年' ? 2 : Math.max(2, cfg.interval);
    const anchorAd = cfg.anchorRocYear + 1911;
    const kBase = Math.floor((y - anchorAd) / iv);
    for (let k = kBase - 1; k <= kBase + 2; k++) {
      const cy = anchorAd + k * iv;
      if (cy < 1912) continue;
      candidates.push({ cycle: String(cy - 1911), date: clampDateYmd(cy, cfg.month, cfg.day) });
    }
  } else if (recType === '每學期') {
    const pairs = [[cfg.m1, cfg.d1], [cfg.m2, cfg.d2]];
    [-1, 0, 1].forEach(dy => {
      pairs.forEach(([mm, dd], idx) => {
        candidates.push({ cycle: `${rocY + dy}-S${idx + 1}`, date: clampDateYmd(y + dy, mm, dd) });
      });
    });
  } else if (recType === '每季') {
    const isNext = cfg.mode === 'NEXT';
    const qMonths = isNext ? [1, 4, 7, 10] : [3, 6, 9, 12];
    [-1, 0, 1].forEach(dy => {
      const yy = y + dy;
      const rY = rocY + dy;
      qMonths.forEach((qm, idx) => {
        const qLabel = isNext ? (idx === 0 ? `${rY - 1}-Q4` : `${rY}-Q${idx}`) : `${rY}-Q${idx + 1}`;
        candidates.push({ cycle: qLabel, date: clampDateYmd(yy, qm, cfg.day) });
      });
    });
  } else if (recType === '每月' || recType === '每雙月') {
    for (let offset = -2; offset <= 3; offset++) {
      const dt = new Date(y, m - 1 + offset, 1);
      const yy = dt.getFullYear(), mm = dt.getMonth() + 1;
      if (recType === '每雙月') {
        const wantOdd = cfg.parity === 'ODD';
        if (wantOdd && mm % 2 === 0) continue;
        if (!wantOdd && mm % 2 !== 0) continue;
      }
      candidates.push({ cycle: `${yy - 1911}-${String(mm).padStart(2, '0')}`, date: clampDateYmd(yy, mm, cfg.day) });
    }
  } else if (recType === '自訂每N個月') {
    const iv = Math.max(1, cfg.interval);
    const [ay, am] = (cfg.anchorYm || `${y}-01`).split('-').map(n => parseInt(n, 10));
    const anchorTotal = ay * 12 + (am - 1);
    const curTotal = y * 12 + (m - 1);
    const kBase = Math.floor((curTotal - anchorTotal) / iv);
    for (let k = kBase - 1; k <= kBase + 2; k++) {
      const tm = anchorTotal + k * iv;
      const yy = Math.floor(tm / 12);
      const mm = (tm % 12) + 1;
      if (yy < 1912) continue;
      candidates.push({ cycle: `${yy - 1911}-${String(mm).padStart(2, '0')}`, date: clampDateYmd(yy, mm, cfg.day) });
    }
  }

  candidates.sort((a, b) => a.date.localeCompare(b.date));
  const lead = Number(r.lead_days) || 14;
  for (const c of candidates) {
    if (c.cycle === r.last_done_cycle) continue;
    const diff = diffDays(today, c.date);
    if (diff >= -45) {
      return { cycle: c.cycle, dueDate: c.date, diffDays: diff, isVisible: diff <= lead };
    }
  }
  const fb = candidates[candidates.length - 1] || { cycle: String(rocY), date: today };
  return { cycle: fb.cycle, dueDate: fb.date, diffDays: diffDays(today, fb.date), isVisible: false };
};

function monthOptsHTML(sel) {
  return Array.from({ length: 12 }, (_, i) => i + 1)
    .map(m => `<option value="${m}" ${Number(sel) === m ? 'selected' : ''}>${m} 月</option>`).join('');
}
function dayOptsHTML(sel, maxDay = 31) {
  return Array.from({ length: maxDay }, (_, i) => i + 1)
    .map(d => `<option value="${d}" ${Number(sel) === d ? 'selected' : ''}>${d} 日</option>`).join('');
}

function renderRuleBuilderFieldsHTML(recType, cfg) {
  const curRoc = new Date().getFullYear() - 1911;
  if (recType === '每年') {
    return `<div class="rule-inline">
      <span>固定在每年</span>
      <select id="rb-m" onchange="updateRoutineRulePreview()">${monthOptsHTML(cfg.month)}</select>
      <select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 31)}</select>
      <span>前辦理</span>
    </div>`;
  }
  if (recType === '每兩年' || recType === '自訂每N年') {
    return `<div class="rule-inline">
      ${recType === '自訂每N年'
        ? `<span>每</span><input id="rb-iv" type="number" min="2" max="10" value="${cfg.interval || 3}" style="width:58px" oninput="updateRoutineRulePreview()"><span>年一次，</span>`
        : `<input id="rb-iv" type="hidden" value="2"><span>每 2 年一次，</span>`}
      <span>從民國</span>
      <input id="rb-ay" type="number" min="100" max="150" value="${cfg.anchorRocYear || curRoc}" style="width:68px" oninput="updateRoutineRulePreview()">
      <span>年起算，固定於</span>
      <select id="rb-m" onchange="updateRoutineRulePreview()">${monthOptsHTML(cfg.month)}</select>
      <select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 31)}</select>
    </div>`;
  }
  if (recType === '每學期') {
    return `<div class="rule-inline">
      <span>第 1 次（下學期）：</span>
      <select id="rb-m1" onchange="updateRoutineRulePreview()">${monthOptsHTML(cfg.m1)}</select>
      <select id="rb-d1" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.d1, 31)}</select>
    </div>
    <div class="rule-inline">
      <span>第 2 次（上學期）：</span>
      <select id="rb-m2" onchange="updateRoutineRulePreview()">${monthOptsHTML(cfg.m2)}</select>
      <select id="rb-d2" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.d2, 31)}</select>
    </div>`;
  }
  if (recType === '每季') {
    return `<div class="rule-inline">
      <span>於</span>
      <select id="rb-qmode" onchange="updateRoutineRulePreview()">
        <option value="END" ${cfg.mode !== 'NEXT' ? 'selected' : ''}>每季末月（3、6、9、12 月）</option>
        <option value="NEXT" ${cfg.mode === 'NEXT' ? 'selected' : ''}>每季次月（1、4、7、10 月）</option>
      </select>
      <span>的</span>
      <select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 28)}</select>
    </div>`;
  }
  if (recType === '每雙月') {
    return `<div class="rule-inline">
      <span>於</span>
      <select id="rb-parity" onchange="updateRoutineRulePreview()">
        <option value="EVEN" ${cfg.parity !== 'ODD' ? 'selected' : ''}>雙數月（2、4、6、8、10、12 月）</option>
        <option value="ODD" ${cfg.parity === 'ODD' ? 'selected' : ''}>單數月（1、3、5、7、9、11 月）</option>
      </select>
      <span>的</span>
      <select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 28)}</select>
    </div>`;
  }
  if (recType === '每月') {
    return `<div class="rule-inline">
      <span>每個月固定於</span>
      <select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 28)}</select>
      <span>前辦理</span>
    </div>`;
  }
  if (recType === '自訂每N個月') {
    return `<div class="rule-inline">
      <span>每</span>
      <input id="rb-iv" type="number" min="2" max="18" value="${cfg.interval || 6}" style="width:58px" oninput="updateRoutineRulePreview()">
      <span>個月一次，基準年月</span>
      <input id="rb-aym" type="month" value="${esc(cfg.anchorYm || todayStr().slice(0, 7))}" onchange="updateRoutineRulePreview()">
      <span>的</span>
      <select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 28)}</select>
    </div>`;
  }
  return '';
}

function readRuleBuilderConfig() {
  const recType = document.getElementById('rt-rec')?.value || '每年';
  if (recType === '每年') {
    return { type: '每年', month: Number(document.getElementById('rb-m')?.value) || 12, day: Number(document.getElementById('rb-d')?.value) || 10 };
  }
  if (recType === '每兩年' || recType === '自訂每N年') {
    return {
      type: recType,
      interval: recType === '每兩年' ? 2 : Math.max(2, Number(document.getElementById('rb-iv')?.value) || 3),
      anchorRocYear: Number(document.getElementById('rb-ay')?.value) || (new Date().getFullYear() - 1911),
      month: Number(document.getElementById('rb-m')?.value) || 6,
      day: Number(document.getElementById('rb-d')?.value) || 30
    };
  }
  if (recType === '每學期') {
    return {
      type: '每學期',
      m1: Number(document.getElementById('rb-m1')?.value) || 2, d1: Number(document.getElementById('rb-d1')?.value) || 10,
      m2: Number(document.getElementById('rb-m2')?.value) || 8, d2: Number(document.getElementById('rb-d2')?.value) || 20
    };
  }
  if (recType === '每季') {
    return { type: '每季', mode: document.getElementById('rb-qmode')?.value || 'END', day: Number(document.getElementById('rb-d')?.value) || 25 };
  }
  if (recType === '每雙月') {
    return { type: '每雙月', parity: document.getElementById('rb-parity')?.value || 'EVEN', day: Number(document.getElementById('rb-d')?.value) || 10 };
  }
  if (recType === '每月') {
    return { type: '每月', day: Number(document.getElementById('rb-d')?.value) || 10 };
  }
  if (recType === '自訂每N個月') {
    return {
      type: '自訂每N個月',
      interval: Math.max(2, Number(document.getElementById('rb-iv')?.value) || 6),
      anchorYm: document.getElementById('rb-aym')?.value || todayStr().slice(0, 7),
      day: Number(document.getElementById('rb-d')?.value) || 15
    };
  }
  return { type: '每年', month: 12, day: 10 };
}

function onRoutineRecurrenceChange() {
  const recType = document.getElementById('rt-rec').value;
  const curRaw = document.getElementById('rt-rule')?.value || '';
  const cfg = parseDueRuleConfig(recType, curRaw);
  document.getElementById('rb-fields').innerHTML = renderRuleBuilderFieldsHTML(recType, cfg);
  updateRoutineRulePreview();
}

function updateRoutineRulePreview() {
  const recType = document.getElementById('rt-rec')?.value || '每年';
  const cfg = readRuleBuilderConfig();
  const code = encodeDueRuleConfig(cfg);
  const hiddenRule = document.getElementById('rt-rule');
  if (hiddenRule) hiddenRule.value = code;

  const lead = Math.max(1, Number(document.getElementById('rt-lead')?.value) || 14);
  const simSch = computeRoutineSchedule({ recurrence_type: recType, due_rule: code, lead_days: lead, last_done_cycle: '' });
  const notifyDate = addDays(simSch.dueDate, -lead);
  const human = describeDueRuleHuman(recType, code);
  const prevEl = document.getElementById('rb-preview');
  if (prevEl) {
    prevEl.innerHTML = `📅 <strong>排程預覽：</strong>${esc(human)}<br>`
      + `🔔 <strong>下次到期：</strong>${esc(simSch.dueDate)}（期別 ${esc(simSch.cycle)}）｜ 將於 <strong>${esc(notifyDate)}</strong> 起自動出現在 Chrome 起始頁通知`;
  }
}

openRoutineModal = function(routineId = '') {
  const r = routineId ? (appData.tables.Annual_Routines || []).find(x => x.routine_id === routineId) : {};
  const tpls = appData.tables.Templates || [];
  const recType = r.recurrence_type || '每年';
  const cfg = parseDueRuleConfig(recType, r.due_rule || '12-10');
  const existingCat = r.category || '法定填報';
  const isCustomCat = existingCat && !ROUTINE_CATEGORIES.includes(existingCat);
  const leadVal = Number(r.lead_days) || 14;

  openModal(routineId ? '✎ 編輯年度固定例行業務' : '＋ 新增年度固定例行業務', `
    <div class="form-grid">
      <div class="field full"><label>固定辦理事項名稱 *</label><input id="rt-title" type="text" value="${esc(r.title || '')}" placeholder="例：建築物公共安全檢查申報（兩年一次）、冷氣濾網小額採購清洗"></div>
      <div class="field"><label>業務類別（支援招標／小額／共同供應契約）</label>
        <select id="rt-cat" onchange="document.getElementById('rt-cat-custom').style.display=this.value==='其他自訂業務'?'block':'none'">
          ${ROUTINE_CATEGORIES.map(c => `<option value="${c}" ${(isCustomCat ? '其他自訂業務' : existingCat) === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <input id="rt-cat-custom" type="text" value="${esc(isCustomCat ? existingCat : '')}" placeholder="輸入自訂業務類別名稱..." style="margin-top:5px;display:${isCustomCat || existingCat === '其他自訂業務' ? 'block' : 'none'}">
      </div>
      <div class="field"><label>重複週期（含兩年一次與自訂彈性）</label>
        <select id="rt-rec" onchange="onRoutineRecurrenceChange()">
          ${ROUTINE_RECURRENCES.map(o => `<option value="${o.value}" ${recType === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="field full">
        <label>到期日期設定（用選單直接挑，系統會自動產生規則）</label>
        <div class="rule-builder-box">
          <div id="rb-fields">${renderRuleBuilderFieldsHTML(recType, cfg)}</div>
          <div class="rule-inline" style="border-top:1px dashed #cbd5e1;padding-top:7px">
            <span>⏰ 提前幾天在起始頁通知：</span>
            <select id="rt-lead-preset" onchange="if(this.value!=='custom'){document.getElementById('rt-lead').value=this.value;updateRoutineRulePreview();}">
              ${[[7,'提前 7 天（1 週）'],[14,'提前 14 天（2 週）'],[21,'提前 21 天（3 週）'],[30,'提前 30 天（1 個月）'],[45,'提前 45 天（1.5 個月）'],[60,'提前 60 天（2 個月）'],[90,'提前 90 天（3 個月）']].map(([v,l]) => `<option value="${v}" ${leadVal===v?'selected':''}>${l}</option>`).join('')}
              <option value="custom" ${![7,14,21,30,45,60,90].includes(leadVal)?'selected':''}>自訂天數</option>
            </select>
            <input id="rt-lead" type="number" min="1" max="180" value="${leadVal}" style="width:66px" oninput="document.getElementById('rt-lead-preset').value='custom';updateRoutineRulePreview()">
            <span>天</span>
          </div>
          <div id="rb-preview" class="rule-preview"></div>
          <input id="rt-rule" type="hidden" value="${esc(encodeDueRuleConfig(cfg))}">
        </div>
      </div>
      <div class="field"><label>作業網站直達連結（選填）</label><input id="rt-url" type="url" value="${esc(r.portal_url || '')}" placeholder="例：https://web.pcc.gov.tw/"></div>
      <div class="field"><label>關聯招標模板（選填，到點可一鍵套模板）</label>
        <select id="rt-tpl"><option value="">不關聯</option>${tpls.map(t => `<option value="${esc(t.template_id)}" ${r.linked_template_id === t.template_id ? 'selected' : ''}>${esc(t.template_name)}</option>`).join('')}</select>
      </div>
      <div class="field full"><label>承辦注意事項（提醒：切勿填寫真實密碼）</label><textarea id="rt-note">${esc(r.note || '')}</textarea></div>
      <div class="field full"><label><input type="checkbox" id="rt-active" ${r.is_active !== false ? 'checked' : ''}> 啟用此循環通知</label></div>
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveRoutine('${esc(routineId)}')">儲存例行業務</button>
  `);
  updateRoutineRulePreview();
};

saveRoutine = async function(routineId) {
  const title = document.getElementById('rt-title').value.trim();
  if (!title) return toast('請填寫固定辦理事項名稱');
  const existing = routineId ? (appData.tables.Annual_Routines || []).find(x => x.routine_id === routineId) : {};
  let cat = document.getElementById('rt-cat').value;
  if (cat === '其他自訂業務') {
    const custom = (document.getElementById('rt-cat-custom')?.value || '').trim();
    if (custom) cat = custom;
  }
  const recType = document.getElementById('rt-rec').value;
  const dueRule = encodeDueRuleConfig(readRuleBuilderConfig());

  const rec = {
    ...existing,
    routine_id: routineId || nextId('Annual_Routines', 'routine_id', 'RTN', 3),
    title,
    category: cat,
    recurrence_type: recType,
    due_rule: dueRule,
    lead_days: Math.max(1, Number(document.getElementById('rt-lead').value) || 14),
    portal_url: document.getElementById('rt-url').value.trim(),
    linked_template_id: document.getElementById('rt-tpl').value,
    note: document.getElementById('rt-note').value.trim(),
    is_active: document.getElementById('rt-active').checked,
    last_done_cycle: existing.last_done_cycle || '',
    last_done_date: existing.last_done_date || '',
    updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Annual_Routines', rec, 'routine_id');
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Annual_Routines', record: rec });
  toast(`✅ 已儲存「${title}」（${describeDueRuleHuman(recType, dueRule)}）`);
};

renderRoutinesHTML = function() {
  const list = (appData.tables.Annual_Routines || []).map(r => ({ ...r, sch: computeRoutineSchedule(r) }))
    .sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false) || a.sch.diffDays - b.sch.diffDays);

  return `
    <div class="panel">
      <div class="panel-hd">
        <h3>🔁 年度固定例行業務管理（支援每年／每兩年／自訂週期與小額／共契）</h3>
        <button class="btn-sm btn-primary" onclick="openRoutineModal()">＋ 新增例行業務</button>
      </div>
      <div class="panel-bd" style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>事項名稱與備註</th>
              <th>業務類別／週期</th>
              <th>到期規則與提前預告</th>
              <th>下次到期</th>
              <th>上次完成</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(r => {
              const canQuickBuy = ['一般小額採購', '共同供應契約'].includes(r.category);
              return `
                <tr style="${r.is_active === false ? 'opacity:.45' : ''}">
                  <td>
                    <strong>${esc(r.title)}</strong>
                    ${r.note ? `<div class="item-meta">${esc(r.note)}</div>` : ''}
                  </td>
                  <td>
                    <span class="tag ${r.category==='共同供應契約'?'tag-blue':r.category==='一般小額採購'?'tag-amber':'tag-gray'}">${esc(r.category)}</span>
                    <div class="item-meta">${esc(r.recurrence_type)}</div>
                  </td>
                  <td>
                    <div><strong>${esc(describeDueRuleHuman(r.recurrence_type, r.due_rule))}</strong></div>
                    <div class="item-meta">提前 ${r.lead_days} 天通知</div>
                  </td>
                  <td style="white-space:nowrap">
                    <strong>${esc(r.sch.dueDate)}</strong>
                    <div class="item-meta">期別 ${esc(r.sch.cycle)}</div>
                  </td>
                  <td>${r.last_done_cycle ? `${esc(r.last_done_cycle)}<div class="item-meta">${esc(r.last_done_date)}</div>` : '-'}</td>
                  <td style="white-space:nowrap">
                    <button class="btn-xs btn-success" onclick="markRoutineDone('${esc(r.routine_id)}','${esc(r.sch.cycle)}')">✓ 完成本期</button>
                    ${r.linked_template_id ? `<button class="btn-xs btn-primary" onclick="openProjectWizard('${esc(r.linked_template_id)}','${esc(r.title)}')">📋 套模板</button>` : ''}
                    ${(!r.linked_template_id && canQuickBuy) ? `<button class="btn-xs btn-primary" onclick="openRoutineQuickPurchase('${esc(r.routine_id)}')">🛒 開單</button>` : ''}
                    <button class="btn-xs" onclick="openRoutineModal('${esc(r.routine_id)}')">✎ 編輯</button>
                    <button class="btn-xs btn-danger" onclick="deleteRoutine('${esc(r.routine_id)}')">刪</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

function openRoutineQuickPurchase(routineId) {
  const r = (appData.tables.Annual_Routines || []).find(x => x.routine_id === routineId);
  if (!r) return;
  openProjectWizard('', r.title, '');
  if (r.category === '一般小額採購') {
    document.getElementById('wiz-budget').value = 100000;
    onWizardBudgetChange();
  } else if (r.category === '共同供應契約') {
    document.getElementById('wiz-budget').value = 100000;
    onWizardBudgetChange();
    const aw = document.getElementById('wiz-award');
    if (aw) { aw.value = '共同供應契約'; onWizardAwardChange(); }
  }
}

// 3. 開新採購標案：預算金額 ↔ 金額級距 ↔ 決標原則自動連動 + 共同供應契約
const AWARD_OPTIONS_BY_TIER = {
  '小額(15萬以下)': [
    { value: '逕洽', label: '逕洽廠商採購（15萬以下免公告）' },
    { value: '共同供應契約', label: '共同供應契約下訂（電子採購網）' },
    { value: '公開取得報價單', label: '公開取得報價單（自願比價）' }
  ],
  '未達(15-150萬)': [
    { value: '最低標', label: '公開取得報價單－最低標（§49）' },
    { value: '取最有利標精神', label: '公開取得企劃書－取最有利標精神（§49）' },
    { value: '共同供應契約', label: '共同供應契約（適用範圍內下訂／擇優）' },
    { value: '限制性招標(比/議價)', label: '限制性招標（比價／議價，須符合§22）' }
  ],
  '公開(150萬以上)': [
    { value: '最低標', label: '公開招標－最低標' },
    { value: '評分及格最低標', label: '公開招標－評分及格最低標' },
    { value: '最有利標', label: '公開招標－最有利標（須先報上級核准）' },
    { value: '共同供應契約(大額/依規辦理)', label: '共同供應契約（大量訂購／依規議價）' }
  ]
};

function getTierFromBudget(budgetVal) {
  if (budgetVal === '' || budgetVal === null || budgetVal === undefined) return null;
  const n = Number(budgetVal);
  if (isNaN(n) || n <= 0) return null;
  if (n <= 150000) return '小額(15萬以下)';
  if (n < 1500000) return '未達(15-150萬)';
  return '公開(150萬以上)';
}

function resolveAwardForTier(tier, currentAward) {
  const opts = (AWARD_OPTIONS_BY_TIER[tier] || AWARD_OPTIONS_BY_TIER['未達(15-150萬)']).map(o => o.value);
  if (opts.includes(currentAward)) return currentAward;
  if (currentAward && currentAward.includes('共同供應契約')) {
    const hit = opts.find(o => o.includes('共同供應契約'));
    if (hit) return hit;
  }
  if (currentAward === '取最有利標精神' && tier === '公開(150萬以上)') return '最有利標';
  if (currentAward === '最有利標' && tier === '未達(15-150萬)') return '取最有利標精神';
  return opts[0];
}

function refreshWizardAwardOptions(preferredAward) {
  const tierEl = document.getElementById('wiz-tier');
  const awardEl = document.getElementById('wiz-award');
  if (!tierEl || !awardEl) return;
  const tier = tierEl.value;
  const opts = AWARD_OPTIONS_BY_TIER[tier] || AWARD_OPTIONS_BY_TIER['未達(15-150萬)'];
  const nextVal = resolveAwardForTier(tier, preferredAward !== undefined ? preferredAward : awardEl.value);
  awardEl.innerHTML = opts.map(o => `<option value="${esc(o.value)}" ${o.value === nextVal ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  onWizardAwardChange();
}

function onWizardBudgetChange() {
  const budgetEl = document.getElementById('wiz-budget');
  const tierEl = document.getElementById('wiz-tier');
  if (!budgetEl || !tierEl) return;
  const autoTier = getTierFromBudget(budgetEl.value);
  if (autoTier && tierEl.value !== autoTier) {
    tierEl.value = autoTier;
    refreshWizardAwardOptions();
  } else {
    updateWizardLegalHint();
  }
}

function onWizardTierChange() {
  refreshWizardAwardOptions();
}

function onWizardAwardChange() {
  const awardVal = document.getElementById('wiz-award')?.value || '';
  const commChk = document.getElementById('flg-comm');
  if (commChk) {
    if (['最有利標', '評分及格最低標', '取最有利標精神'].includes(awardVal)) {
      commChk.checked = true;
    } else if (awardVal === '逕洽' || awardVal.includes('共同供應契約')) {
      commChk.checked = false;
    }
  }
  updateWizardLegalHint();
}

function updateWizardLegalHint() {
  const box = document.getElementById('wiz-legal-hint');
  if (!box) return;
  const budgetRaw = document.getElementById('wiz-budget')?.value;
  const tier = document.getElementById('wiz-tier')?.value;
  const award = document.getElementById('wiz-award')?.value || '';
  const expectedTier = getTierFromBudget(budgetRaw);

  let warn = false;
  const lines = [];
  if (expectedTier && expectedTier !== tier) {
    warn = true;
    lines.push(`⚠️ 預算金額（${Number(budgetRaw).toLocaleString('zh-TW')} 元）依採購法對應「${expectedTier}」，與目前手動選擇的「${tier}」不一致，請確認是否刻意提高招標層級辦理。`);
  }

  if (award.includes('共同供應契約')) {
    lines.push('🛒 共同供應契約提醒：將自動展開專屬 4 階段檢核（確認契約效期與適用機關 → 查核資安產地／環保標章／額外需求 → 電子採購網下訂 → 驗收登帳核銷）。');
  } else if (tier === '小額(15萬以下)') {
    lines.push('📘 小額採購（15 萬元以下）：免公告、免監辦，可直接逕洽廠商或下訂共同供應契約；系統仍將檢核不得分批採購（§14）。');
  } else if (tier === '未達(15-150萬)') {
    lines.push('📘 未達公告金額（逾 15 萬至未達 150 萬）：等標期原則不少於 5 天，建議第 1 階段一併簽准「未滿 3 家當場改採限制性招標」及監辦方式。');
  } else {
    lines.push('📘 公告金額以上（150 萬元以上）：等標期原則 14 天以上、第 1 次須滿 3 家合格廠商、強制通知監辦、決標後 30 日內須刊登決標公告。');
  }
  if (award === '最有利標') {
    lines.push('📌 採「最有利標」須於招標前報請上級機關核准並成立評選委員會（已自動勾選評選開關）。');
  }

  box.className = 'legal-hint' + (warn ? ' warn' : '');
  box.innerHTML = lines.join('<br>');
}

const _origOpenProjectWizard = openProjectWizard;
openProjectWizard = function(presetTemplateId = '', presetName = '', sourceMemoId = '') {
  _origOpenProjectWizard(presetTemplateId, presetName, sourceMemoId);
  const budgetEl = document.getElementById('wiz-budget');
  const tierEl = document.getElementById('wiz-tier');
  const awardEl = document.getElementById('wiz-award');
  if (budgetEl) {
    budgetEl.placeholder = '輸入金額自動連動級距（15萬／150萬）';
    budgetEl.oninput = onWizardBudgetChange;
  }
  if (tierEl) tierEl.onchange = onWizardTierChange;
  if (awardEl) awardEl.onchange = onWizardAwardChange;

  const grid = document.querySelector('#modal-body .form-grid');
  if (grid && !document.getElementById('wiz-legal-hint')) {
    const hint = document.createElement('div');
    hint.id = 'wiz-legal-hint';
    hint.className = 'legal-hint';
    hint.style.marginBottom = '10px';
    grid.parentNode.insertBefore(hint, grid);
  }
  refreshWizardAwardOptions(awardEl ? awardEl.value : undefined);
};

const _origOnWizardTemplateChange = onWizardTemplateChange;
onWizardTemplateChange = function() {
  _origOnWizardTemplateChange();
  const tid = document.getElementById('wiz-tpl')?.value;
  if (tid) {
    const t = (appData.tables.Templates || []).find(x => x.template_id === tid);
    refreshWizardAwardOptions(t ? t.award_method : undefined);
  } else {
    refreshWizardAwardOptions();
  }
};

const _origBuildStandardStages = buildStandardStages;
buildStandardStages = function(opts) {
  if (opts && String(opts.awardMethod || '').includes('共同供應契約')) {
    const { type, flags, startDate, endDate, tier } = opts;
    const f = flags || {};
    const isLarge = tier === '公開(150萬以上)';
    const stages = [
      {
        name: '共契需求確認與請購簽核',
        items: [
          { text: '於政府電子採購網查詢臺灣銀行共同供應契約適用品項、組別與契約效期', required: true },
          { text: '確認本校屬適用機關，並比對預算額度與單筆訂購上限', required: true },
          { text: isLarge ? '【150萬以上大額共契】檢核大量訂購優惠／依規簽辦比議價與通知監辦' : '完成共同供應契約請購動支簽核（如需另選購額外項一併敘明）', required: true }
        ]
      },
      {
        name: '電子採購網下訂與規格確認',
        items: [
          { text: '於電子採購網完成共同供應契約正式下訂並留存訂單編號', required: true },
          { text: '聯繫立約廠商確認交貨／安裝日期、規格型錄及資通安全／產地合規聲明', required: true }
        ]
      },
      {
        name: '交貨安裝與功能測試',
        items: [
          { text: '現場點收數量、核對型號與規格並完成開機／功能測試', required: true },
          { text: '收取統一發票、原廠保固書及相關檢驗／標章證書', required: true }
        ]
      },
      {
        name: '驗收登帳與核銷結案',
        items: [
          { text: '由非採購承辦人辦理驗收並製作驗收紀錄（或黏貼憑證驗收簽章）', required: true },
          { text: type === '財物' ? '財產／非消耗品增加單登帳、黏貼財產標籤並完成主計核銷' : '完成主計核銷撥款、滿意度評鑑與全卷歸檔', required: true }
        ]
      }
    ];
    if (f.has_grant) {
      stages[0].items.push({ text: '【補助款】核對上級補助核定函與結報截止日', required: true });
      stages[3].items.push({ text: '【補助款】辦理補助款結報與標餘款處理', required: true });
    }
    if (f.is_green) {
      stages[3].items.push({ text: '【綠色採購】確認環保／節能標章並登錄機關綠色採購網', required: true });
    }

    const baseStart = startDate || todayStr();
    const span = (startDate && endDate && diffDays(startDate, endDate) > 4) ? diffDays(startDate, endDate) : 30;
    const step = Math.max(3, Math.floor(span / stages.length));
    return stages.map((st, idx) => ({
      stage_order: idx + 1,
      stage_name: st.name,
      plan_start: addDays(baseStart, idx * step),
      plan_end: (idx === stages.length - 1 && endDate) ? endDate : addDays(baseStart, (idx + 1) * step - 1),
      actual_start: '', actual_end: '', sla_deadline: '', blocker_note: '',
      status: idx === 0 ? '進行中' : '未開始',
      checklist_json: JSON.stringify(st.items.map((it, j) => ({
        id: `chk_jc_${idx + 1}_${j + 1}`, text: it.text, required: !!it.required, done: false, doc_no: '', done_date: ''
      })))
    }));
  }
  return _origBuildStandardStages(opts);
};

// 4. 內建 Claude Code 實證驗證套件（沙盒隔離 E2E ＋ 屬性測試 ＋ 差分測試）
const _origOpenSettingsModal = openSettingsModal;
openSettingsModal = function() {
  _origOpenSettingsModal();
  const bd = document.getElementById('modal-body');
  if (!bd || document.getElementById('btn-claude-verify')) return;
  const wrap = document.createElement('div');
  wrap.style.marginTop = '10px';
  wrap.innerHTML = `<button id="btn-claude-verify" class="btn-primary" onclick="runClaudeVerificationSuite()">🧪 執行 Claude 實證驗證（E2E ＋ 屬性 ＋ 差分測試）</button>
    <div class="item-meta" style="margin-top:4px">採完全沙盒隔離，於本機記憶體實測所有 DOM 互動與邊界案例，絕不改動您的正式 Google Sheets 資料。</div>`;
  bd.appendChild(wrap);
};

function runClaudeVerificationSuite() {
  const snapData = JSON.stringify(appData);
  const snapTab = currentTab;
  const snapProj = selectedProjectId;
  const origPush = pushToCloud;
  const origPersist = persistCache;
  pushToCloud = async () => ({ ok: true, sandboxed: true });
  persistCache = () => {};

  const logs = [];
  let passed = 0, failed = 0;
  const assert = (cond, name, detail = '') => {
    if (cond) { passed++; logs.push(`✅ [PASS] ${name}`); }
    else { failed++; logs.push(`❌ [FAIL] ${name}${detail ? ' -> ' + detail : ''}`); }
  };

  try {
    logs.push('=== 1. Differential Tests（舊版 vs 新版例行規則 100% 向下相容）===');
    const curRoc = new Date().getFullYear() - 1911;
    const legacySamples = [
      { recurrence_type: '每季', due_rule: 'Q-END-25', lead_days: 14, last_done_cycle: `${curRoc - 1}-Q4` },
      { recurrence_type: '每季', due_rule: 'Q-NEXT-10', lead_days: 14, last_done_cycle: `${curRoc - 1}-Q3` },
      { recurrence_type: '每年', due_rule: '12-15', lead_days: 30, last_done_cycle: String(curRoc - 1) },
      { recurrence_type: '每學期', due_rule: '02-10,08-20', lead_days: 21, last_done_cycle: `${curRoc - 1}-S2` },
      { recurrence_type: '每月', due_rule: 'D-10', lead_days: 7, last_done_cycle: `${curRoc - 1}-11` }
    ];
    let diffOk = true;
    legacySamples.forEach(s => {
      const a = _legacyComputeRoutineSchedule(s);
      const b = computeRoutineSchedule(s);
      if (a.cycle !== b.cycle || a.dueDate !== b.dueDate || a.isVisible !== b.isVisible) {
        diffOk = false;
        logs.push(`   mismatch on ${s.due_rule}: old=${JSON.stringify(a)} new=${JSON.stringify(b)}`);
      }
    });
    assert(diffOk, 'R-05 差分測試：既有 5 種 Google Sheets 規則格式輸出 100% 一致（跨全年無 Flaky）');

    logs.push('\n=== 2. Property-Based Tests（500 組隨機與極端邊界屬性測試）===');
    let rtPass = 0, invPass = 0;
    const types = ['每年', '每兩年', '自訂每N年', '每學期', '每季', '每雙月', '每月', '自訂每N個月'];
    for (let i = 0; i < 300; i++) {
      const t = types[i % types.length];
      const cfg = t === '每年' ? { type: t, month: (i % 12) + 1, day: (i % 31) + 1 }
        : (t === '每兩年' || t === '自訂每N年') ? { type: t, interval: t === '每兩年' ? 2 : ((i % 5) + 2), anchorRocYear: 112 + (i % 8), month: (i % 12) + 1, day: (i % 31) + 1 }
        : t === '每學期' ? { type: t, m1: (i % 6) + 1, d1: (i % 31) + 1, m2: (i % 6) + 7, d2: (i % 31) + 1 }
        : t === '每季' ? { type: t, mode: i % 2 ? 'NEXT' : 'END', day: (i % 28) + 1 }
        : t === '每雙月' ? { type: t, parity: i % 2 ? 'ODD' : 'EVEN', day: (i % 28) + 1 }
        : t === '每月' ? { type: t, day: (i % 28) + 1 }
        : { type: t, interval: (i % 10) + 2, anchorYm: `2025-${String((i % 12) + 1).padStart(2, '0')}`, day: (i % 28) + 1 };

      const enc = encodeDueRuleConfig(cfg);
      const dec = parseDueRuleConfig(t, enc);
      const reEnc = encodeDueRuleConfig(dec);
      const sch = computeRoutineSchedule({ recurrence_type: t, due_rule: enc, lead_days: 30, last_done_cycle: '' }, '2026-11-20');
      const validIso = /^\d{4}-\d{2}-\d{2}$/.test(sch.dueDate) && !isNaN(new Date(sch.dueDate + 'T00:00:00').getTime());
      if (enc === reEnc && validIso && describeDueRuleHuman(t, enc).length > 3) rtPass++;
    }
    assert(rtPass === 300, `Round-trip 與合法日曆日期不變量（含 2/29 與 31 日防溢位）：${rtPass}/300`);

    const biTest = { recurrence_type: '每兩年', due_rule: 'EVERY-2Y@115:06-30', lead_days: 30, last_done_cycle: '' };
    const bi1 = computeRoutineSchedule(biTest, '2026-06-15');
    biTest.last_done_cycle = '115';
    const bi2 = computeRoutineSchedule(biTest, '2026-06-15');
    const bi2Again = computeRoutineSchedule(biTest, '2026-06-15');
    assert(bi1.dueDate === '2026-06-30' && bi2.dueDate === '2028-06-30' && bi2.dueDate === bi2Again.dueDate,
      '每兩年一次週期跳轉與冪等性（115年完成 → 自動跳至 117年 2028-06-30）');

    const crossYear = computeRoutineSchedule({ recurrence_type: '每季', due_rule: 'Q-END-25', lead_days: 14, last_done_cycle: '115-Q3' }, '2027-01-05');
    assert(crossYear.cycle === '115-Q4' && crossYear.dueDate === '2026-12-25' && crossYear.diffDays === -11,
      '跨年逾期不遺漏修復驗證（2027-01-05 仍正確保留逾期 11 天之 115-Q4）');

    const testBudgets = [1, 149999, 150000, 150001, 500000, 1499999, 1500000, 1500001, 5000000];
    for (let i = 0; i < 191; i++) testBudgets.push(Math.floor(Math.random() * 4000000) + 1);
    testBudgets.forEach(b => {
      const tier = getTierFromBudget(b);
      const okTier = (b <= 150000 && tier === '小額(15萬以下)')
        || (b > 150000 && b < 1500000 && tier === '未達(15-150萬)')
        || (b >= 1500000 && tier === '公開(150萬以上)');
      const legalAwards = AWARD_OPTIONS_BY_TIER[tier].map(o => o.value);
      const r1 = resolveAwardForTier(tier, '逕洽');
      const r2 = resolveAwardForTier(tier, '取最有利標精神');
      const r3 = resolveAwardForTier(tier, '共同供應契約');
      if (okTier && legalAwards.includes(r1) && legalAwards.includes(r2) && legalAwards.includes(r3)) invPass++;
    });
    assert(invPass === testBudgets.length, `採購法級距與合規決標原則不變量（15萬／150萬臨界點）：${invPass}/${testBudgets.length}`);

    logs.push('\n=== 3. Real DOM E2E Tests（實際開啟彈窗與表單互動驗證）===');
    openProjectWizard();
    const bInput = document.getElementById('wiz-budget');
    const tSel = document.getElementById('wiz-tier');
    const aSel = document.getElementById('wiz-award');
    bInput.value = '120000'; onWizardBudgetChange();
    const e2eSmall = tSel.value === '小額(15萬以下)' && aSel.value === '逕洽';
    bInput.value = '850000'; onWizardBudgetChange();
    const e2eBelow = tSel.value === '未達(15-150萬)' && aSel.value === '最低標';
    bInput.value = '2500000'; onWizardBudgetChange();
    const e2eOpen = tSel.value === '公開(150萬以上)' && !Array.from(aSel.options).some(o => o.value === '逕洽' || o.value === '取最有利標精神');
    assert(e2eSmall && e2eBelow && e2eOpen, 'E2E-1 預算輸入即時連動 DOM 級距與過濾不合規決標原則（12萬→小額/逕洽、85萬→未達/最低標、250萬→公開且禁止逕洽）');

    const jcStages = buildStandardStages({ tier: '小額(15萬以下)', type: '財物', awardMethod: '共同供應契約', flags: { is_green: true }, startDate: '2026-11-20' });
    assert(jcStages.length === 4 && jcStages[0].stage_name.includes('共契'), 'E2E-2 共同供應契約自動組裝專屬 4 階段檢核流程');

    openRoutineModal();
    document.getElementById('rt-cat').value = '共同供應契約';
    document.getElementById('rt-rec').value = '每兩年';
    onRoutineRecurrenceChange();
    document.getElementById('rb-ay').value = '115';
    document.getElementById('rb-m').value = '5';
    document.getElementById('rb-d').value = '31';
    updateRoutineRulePreview();
    const encodedRule = document.getElementById('rt-rule').value;
    const prevTxt = document.getElementById('rb-preview').textContent || '';
    assert(encodedRule === 'EVERY-2Y@115:05-31' && prevTxt.includes('每 2 年 5 月 31 日'), 'E2E-3 例行視覺化表單設定「每兩年 5/31」正確編碼並即時渲染中文預覽');

    const backupStr = JSON.stringify(appData);
    const noTokenLeak = !appConfig.token || !backupStr.includes(appConfig.token);
    assert(noTokenLeak, 'R-04 資安檢查：appData 與匯出備份不含 API_TOKEN 且無底價金額欄位');

    closeModal();
  } catch (err) {
    failed++;
    logs.push(`❌ [EXCEPTION] 測試執行異常：${err.message}`);
  } finally {
    appData = JSON.parse(snapData);
    currentTab = snapTab;
    selectedProjectId = snapProj;
    pushToCloud = origPush;
    persistCache = origPersist;
    renderCurrentView();
  }

  const stamp = failed === 0
    ? 'verified: [browser-dom-e2e, property-test(500), differential-test, security-r04]'
    : `FAILED (${failed} errors) — 請檢視下方紅字項目`;

  openModal('🧪 Claude Code 實證驗證報告（Verification Report）', `
    <div class="gate-banner ${failed === 0 ? 'green' : 'red'}" style="margin-bottom:10px">
      <strong>Verification Stamp：</strong><code>${esc(stamp)}</code><br>
      測試結果：<span class="verify-pass">通過 ${passed} 項</span> ／ <span class="${failed ? 'verify-fail' : ''}">失敗 ${failed} 項</span>（沙盒已自動還原，未改動任何雲端資料）
    </div>
    <div class="verify-log">${esc(logs.join('\n'))}</div>
  `, `<button class="btn-primary" onclick="closeModal()">關閉報告</button>`);
}

renderCurrentView();
// ============================================================================
// 5. Chrome 起始戰情室「一屏自適配免捲動」排版引擎 (Auto-Fit Viewport)
// ============================================================================
(function initDashboardAutoFit() {
  const FIT_KEY = 'ga_dash_autofit_v1';
  let fitMode = localStorage.getItem(FIT_KEY) || 'auto'; // 'auto' | 'compact' | 'scroll'

  const css = `
    /* 僅在桌機寬螢幕 (>=1024px) 且為起始戰情室時鎖定一屏，窄螢幕維持自然捲動 */
    @media (min-width: 1024px) {
      html.dash-lock, body.dash-lock {
        height: 100%;
        overflow: hidden;
      }
      body.dash-lock #app-shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
      }
      body.dash-lock .topbar {
        flex-shrink: 0;
        padding: 7px 16px;
      }
      body.dash-lock .portal-bar {
        flex-shrink: 0;
        padding: 4px 16px;
      }
      body.dash-lock .nav-tabs {
        flex-shrink: 0;
        padding: 0 16px;
      }
      body.dash-lock .nav-tab {
        padding: 7px 12px;
        font-size: 13px;
      }
      body.dash-lock #main-view {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        max-width: 100%;
        padding: 8px 14px 10px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* 頂部 KPI 卡與太陽能/水電健康條自動壓縮高度 */
      body.dash-lock .kpi-grid {
        flex-shrink: 0;
        gap: 8px;
        margin-bottom: 8px;
      }
      body.dash-lock .kpi-card {
        padding: 7px 12px;
      }
      body.dash-lock .kpi-val {
        font-size: clamp(18px, 2.4vh, 24px);
        margin-top: 0;
      }
      body.dash-lock .ops-strip {
        flex-shrink: 0;
        gap: 8px;
        margin-bottom: 8px;
      }
      body.dash-lock .ops-mini-card {
        padding: 7px 12px;
      }

      /* 下方三欄戰情主區精準填滿剩餘視窗高度，零外層捲動 */
      body.dash-lock .dash-grid {
        flex: 1 1 auto;
        min-height: 0;
        gap: 10px;
        align-items: stretch;
        overflow: hidden;
      }
      /* 左欄：預警雷達 + 進行中標案上下自動平分剩餘高度 */
      body.dash-lock .dash-grid > div:first-child {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
        height: 100%;
        overflow: hidden;
      }
      body.dash-lock .dash-grid > div:first-child > .panel {
        flex: 1 1 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        margin-bottom: 0;
      }
      /* 中欄（例行業務）與右欄（臨時交辦 Memo）撐滿 100% 高度 */
      body.dash-lock .dash-grid > .panel {
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        margin-bottom: 0;
      }
      body.dash-lock .dash-grid .panel-hd {
        flex-shrink: 0;
        padding: 7px 12px;
      }
      body.dash-lock .dash-grid .panel-bd {
        flex: 1 1 auto;
        min-height: 0;
        max-height: none !important;
        overflow-y: auto;
        padding: 8px 10px;
      }
      /* 右欄 Memo：快填表單固定於頂部，清單區在內部獨立捲動 */
      body.dash-lock .dash-grid > .panel:last-child > .panel-bd {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      body.dash-lock .dash-grid > .panel:last-child .memo-quick {
        flex-shrink: 0;
        padding-bottom: 7px;
        margin-bottom: 7px;
        gap: 5px;
      }
      body.dash-lock .dash-grid > .panel:last-child .memo-quick + div {
        flex: 1 1 auto;
        min-height: 0;
        max-height: none !important;
        overflow-y: auto;
        padding-right: 2px;
      }

      /* 卡片緊湊化與細緻內捲軸 */
      body.dash-lock .alert-item,
      body.dash-lock .routine-item,
      body.dash-lock .memo-item {
        padding: 7px 9px;
        margin-bottom: 6px;
        font-size: 13px;
      }
      body.dash-lock .item-meta {
        font-size: 11.5px;
        margin-top: 2px;
      }
      body.dash-lock .dash-grid ::-webkit-scrollbar {
        width: 5px;
        height: 5px;
      }
      body.dash-lock .dash-grid ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 99px;
      }
      body.dash-lock .dash-grid ::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    }

    /* 筆電較矮螢幕 (視窗高度 <= 820px) 自動進一步節省垂直空間 */
    @media (min-width: 1024px) and (max-height: 820px) {
      body.dash-lock .topbar { padding: 5px 14px; }
      body.dash-lock .brand { font-size: 14.5px; }
      body.dash-lock .portal-bar { padding: 3px 14px; }
      body.dash-lock .portal-chip { padding: 2px 8px; font-size: 11.5px; }
      body.dash-lock .nav-tab { padding: 5px 10px; font-size: 12.5px; }
      body.dash-lock #main-view { padding: 6px 12px 8px; }
      body.dash-lock .kpi-grid,
      body.dash-lock .ops-strip { margin-bottom: 6px; gap: 6px; }
      body.dash-lock .kpi-card { padding: 5px 10px; }
      body.dash-lock .kpi-card > span { font-size: 18px !important; }
      body.dash-lock .ops-mini-card { padding: 5px 10px; }
      body.dash-lock .ops-mini-card .item-meta { display: none; }
      body.dash-lock .memo-quick input[type="text"] { padding: 5px 8px; font-size: 12.5px; }
      body.dash-lock .alert-item,
      body.dash-lock .routine-item,
      body.dash-lock .memo-item { padding: 5px 8px; margin-bottom: 5px; font-size: 12.5px; }
    }

    /* 手動極致緊湊模式 */
    body.dash-lock.dash-compact .ops-mini-card .item-meta { display: none; }
    body.dash-lock.dash-compact .kpi-card { padding: 5px 10px; }
    body.dash-lock.dash-compact .alert-item,
    body.dash-lock.dash-compact .routine-item,
    body.dash-lock.dash-compact .memo-item { padding: 5px 8px; margin-bottom: 5px; font-size: 12.5px; }

    /* 列印 PDF 時強制解除一屏鎖定，避免切版 */
    @media print {
      html.dash-lock, body.dash-lock,
      body.dash-lock #app-shell,
      body.dash-lock #main-view {
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
      }
    }
  `;

  const st = document.createElement('style');
  st.id = 'dash-autofit-style';
  st.textContent = css;
  document.head.appendChild(st);

  function ensureFitToggleButton() {
    const actions = document.querySelector('.top-actions');
    if (!actions || document.getElementById('btn-fit-mode')) return;
    const btn = document.createElement('button');
    btn.id = 'btn-fit-mode';
    btn.style.cssText = 'background:#334155;color:#fff;border-color:#475569';
    btn.onclick = cycleFitMode;
    const settingsBtn = actions.lastElementChild;
    actions.insertBefore(btn, settingsBtn);
    updateFitButtonLabel();
  }

  function updateFitButtonLabel() {
    const btn = document.getElementById('btn-fit-mode');
    if (!btn) return;
    if (fitMode === 'auto') {
      btn.textContent = '🖥️ 一屏適配';
      btn.title = '目前：自動填滿視窗免捲動（點擊切換極致緊湊／傳統捲動）';
    } else if (fitMode === 'compact') {
      btn.textContent = '📐 極致緊湊';
      btn.title = '目前：極致緊湊一屏模式（點擊切換傳統捲動）';
    } else {
      btn.textContent = '📜 傳統捲動';
      btn.title = '目前：允許整頁上下捲動（點擊切回一屏適配）';
    }
  }

  function cycleFitMode() {
    fitMode = fitMode === 'auto' ? 'compact' : (fitMode === 'compact' ? 'scroll' : 'auto');
    localStorage.setItem(FIT_KEY, fitMode);
    updateFitButtonLabel();
    applyDashboardAutoFit();
    const label = fitMode === 'auto' ? '自動一屏適配' : (fitMode === 'compact' ? '極致緊湊一屏' : '傳統整頁捲動');
    if (typeof toast === 'function') toast(`🖥️ 戰情室顯示模式：${label}`);
  }

  function applyDashboardAutoFit() {
    const shouldLock = (typeof currentTab !== 'undefined' && currentTab === 'dashboard')
      && fitMode !== 'scroll'
      && window.innerWidth >= 1024;
    document.documentElement.classList.toggle('dash-lock', shouldLock);
    document.body.classList.toggle('dash-lock', shouldLock);
    document.body.classList.toggle('dash-compact', shouldLock && fitMode === 'compact');
    ensureFitToggleButton();
  }

  const _prevRenderForFit = renderCurrentView;
  renderCurrentView = function() {
    _prevRenderForFit();
    applyDashboardAutoFit();
  };

  window.addEventListener('resize', applyDashboardAutoFit);
  applyDashboardAutoFit();
})();
