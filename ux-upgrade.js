/**
 * ============================================================================
 * 學校總務行政助理 — 完整整合升級外掛模組 (ux-upgrade.js v2)
 * 1. Chrome 起始戰情室「一屏自適配免捲動」引擎（支援筆電 960px 以上＋三模式切換）
 * 2. 正名「採購與履約管理」＋ 15 萬以下小額採購「年度保養／分期履約與分期付款」控管
 * 3. 年度固定例行業務：免背代碼視覺化選單、兩年一次／自訂週期、小額／共契類別與開單
 * 4. 開新採購精靈：預算自動連動金額級距與合規決標原則 ＋ 共同供應契約專屬 4 階段
 * 5. 內建沙盒版 Claude 實證驗證套件（DOM E2E ＋ 屬性測試 ＋ 差分測試）
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
    .legal-hint.warn { border-color:#fcd34d; background:#fffbeb; color:#92400e; }
    .maint-box {
      background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;
      padding:8px 10px; margin-top:4px; display:flex; flex-direction:column; gap:6px;
    }
    .verify-pass { color:#059669; font-weight:700; }
    .verify-fail { color:#dc2626; font-weight:700; }
    .verify-log {
      font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px;
      background:#0f172a; color:#e2e8f0; padding:12px; border-radius:8px;
      max-height:360px; overflow:auto; white-space:pre-wrap; line-height:1.55;
    }

    /* 一屏自適配免捲動（寬度 >= 960px 桌機與筆電自動填滿視窗） */
    @media (min-width: 960px) {
      html.dash-lock, body.dash-lock { height: 100%; overflow: hidden; }
      body.dash-lock #app-shell {
        display: flex; flex-direction: column;
        height: 100vh; height: 100dvh; overflow: hidden;
      }
      body.dash-lock .topbar { flex-shrink: 0; padding: 6px 14px; }
      body.dash-lock .portal-bar { flex-shrink: 0; padding: 3px 14px; }
      body.dash-lock .nav-tabs { flex-shrink: 0; padding: 0 14px; }
      body.dash-lock .nav-tab { padding: 6px 11px; font-size: 13px; }
      body.dash-lock #main-view {
        flex: 1 1 auto; min-height: 0; width: 100%; max-width: 100%;
        padding: 7px 12px 9px; display: flex; flex-direction: column; overflow: hidden;
      }
      body.dash-lock .kpi-grid { flex-shrink: 0; gap: 8px; margin-bottom: 7px; }
      body.dash-lock .kpi-card { padding: 6px 11px; }
      body.dash-lock .kpi-val { font-size: clamp(18px, 2.3vh, 23px); margin-top: 0; }
      body.dash-lock .ops-strip { flex-shrink: 0; gap: 8px; margin-bottom: 7px; }
      body.dash-lock .ops-mini-card { padding: 6px 11px; }
      body.dash-lock .dash-grid {
        flex: 1 1 auto; min-height: 0; gap: 10px;
        align-items: stretch; overflow: hidden;
        grid-template-columns: 1.35fr 1.05fr 0.95fr !important;
      }
      body.dash-lock .dash-grid > div:first-child {
        display: flex; flex-direction: column; gap: 8px;
        min-height: 0; height: 100%; overflow: hidden;
      }
      body.dash-lock .dash-grid > div:first-child > .panel {
        flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; margin-bottom: 0;
      }
      body.dash-lock .dash-grid > .panel {
        height: 100%; min-height: 0; display: flex; flex-direction: column; margin-bottom: 0;
      }
      body.dash-lock .dash-grid .panel-hd { flex-shrink: 0; padding: 6px 11px; }
      body.dash-lock .dash-grid .panel-bd {
        flex: 1 1 auto; min-height: 0; max-height: none !important;
        overflow-y: auto; padding: 7px 9px;
      }
      body.dash-lock .dash-grid > .panel:last-child > .panel-bd {
        display: flex; flex-direction: column; overflow: hidden;
      }
      body.dash-lock .dash-grid > .panel:last-child .memo-quick {
        flex-shrink: 0; padding-bottom: 6px; margin-bottom: 6px; gap: 4px;
      }
      body.dash-lock .dash-grid > .panel:last-child .memo-quick + div {
        flex: 1 1 auto; min-height: 0; max-height: none !important;
        overflow-y: auto; padding-right: 2px;
      }
      body.dash-lock .alert-item,
      body.dash-lock .routine-item,
      body.dash-lock .memo-item { padding: 6px 8px; margin-bottom: 5px; font-size: 12.5px; }
      body.dash-lock .item-meta { font-size: 11px; margin-top: 2px; }
      body.dash-lock .dash-grid ::-webkit-scrollbar { width: 5px; height: 5px; }
      body.dash-lock .dash-grid ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
    }

    @media (min-width: 960px) and (max-height: 820px) {
      body.dash-lock .topbar { padding: 4px 12px; }
      body.dash-lock .brand { font-size: 14px; }
      body.dash-lock .portal-bar { padding: 2px 12px; }
      body.dash-lock .portal-chip { padding: 2px 7px; font-size: 11px; }
      body.dash-lock .nav-tab { padding: 5px 10px; font-size: 12px; }
      body.dash-lock #main-view { padding: 5px 10px 7px; }
      body.dash-lock .kpi-grid, body.dash-lock .ops-strip { margin-bottom: 5px; gap: 6px; }
      body.dash-lock .kpi-card { padding: 4px 9px; }
      body.dash-lock .kpi-card > span { font-size: 17px !important; }
      body.dash-lock .ops-mini-card { padding: 4px 9px; }
      body.dash-lock .ops-mini-card .item-meta { display: none; }
      body.dash-lock .memo-quick input[type="text"] { padding: 4px 8px; font-size: 12px; }
    }

    body.dash-lock.dash-compact .ops-mini-card .item-meta { display: none; }
    body.dash-lock.dash-compact .kpi-card { padding: 4px 9px; }
    body.dash-lock.dash-compact .alert-item,
    body.dash-lock.dash-compact .routine-item,
    body.dash-lock.dash-compact .memo-item { padding: 5px 7px; margin-bottom: 4px; font-size: 12px; }

    @media print {
      html.dash-lock, body.dash-lock, body.dash-lock #app-shell, body.dash-lock #main-view {
        height: auto !important; max-height: none !important; overflow: visible !important;
      }
    }
  `;
  const st = document.createElement('style');
  st.id = 'ux-upgrade-v2-style';
  st.textContent = css;
  document.head.appendChild(st);
})();

// ----------------------------------------------------------------------------
// 0. 正名：「招標與工程控管」→「採購與履約管理」
// ----------------------------------------------------------------------------
(function renameProcurementTab() {
  const tabBtn = document.querySelector('#nav-tabs [data-tab="projects"]');
  if (tabBtn) tabBtn.textContent = '📋 採購與履約管理';
})();

const _origRenderProjectsListHTML_ux = renderProjectsListHTML;
renderProjectsListHTML = function() {
  return _origRenderProjectsListHTML_ux()
    .replace('學校招標與工程案件清單', '採購與履約管理清單')
    .replace('＋ 開新標案', '＋ 開新採購案');
};

// ----------------------------------------------------------------------------
// 1. 日期安全防護工具（修復非閏年 02-29 溢位與空日期 NaN 風險）
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 2. 年度固定例行業務：免記代碼視覺化選單＋兩年一次／自訂週期＋小額／共契
// ----------------------------------------------------------------------------
const ROUTINE_CATEGORIES = [
  '法定填報', '設施安檢維運', '一般小額採購', '共同供應契約',
  '例行招標預告', '預算核銷', '校產與租約', '其他自訂業務'
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
      return {
        type: recType,
        interval: recType === '每兩年' ? 2 : Math.max(2, parseInt(m[1], 10)),
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
  if (recType === '每季') return cfg.mode === 'NEXT' ? `每季次月（1/4/7/10月）${cfg.day} 日` : `每季末月（3/6/9/12月）${cfg.day} 日`;
  if (recType === '每雙月') return cfg.parity === 'ODD' ? `單數月（1/3/5/7/9/11月）${cfg.day} 日` : `雙數月（2/4/6/8/10/12月）${cfg.day} 日`;
  if (recType === '每月') return `每月 ${cfg.day} 日`;
  if (recType === '自訂每N個月') return `每 ${cfg.interval} 個月 ${cfg.day} 日（自 ${cfg.anchorYm} 起）`;
  return String(rawRule || '-');
}

const _legacyComputeRoutineSchedule = computeRoutineSchedule;
computeRoutineSchedule = function(r, refTodayStr) {
  const today = refTodayStr || todayStr();
  const now = new Date(today + 'T00:00:00');
  const y = now.getFullYear(), rocY = y - 1911, m = now.getMonth() + 1;
  const recType = r.recurrence_type || '每年';
  const cfg = parseDueRuleConfig(recType, r.due_rule, rocY);
  const candidates = [];

  if (recType === '每年') {
    [-1, 0, 1].forEach(dy => candidates.push({ cycle: String(rocY + dy), date: clampDateYmd(y + dy, cfg.month, cfg.day) }));
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
    [-1, 0, 1].forEach(dy => pairs.forEach(([mm, dd], idx) => {
      candidates.push({ cycle: `${rocY + dy}-S${idx + 1}`, date: clampDateYmd(y + dy, mm, dd) });
    }));
  } else if (recType === '每季') {
    const isNext = cfg.mode === 'NEXT';
    const qMonths = isNext ? [1, 4, 7, 10] : [3, 6, 9, 12];
    [-1, 0, 1].forEach(dy => {
      const yy = y + dy, rY = rocY + dy;
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
    const anchorTotal = ay * 12 + (am - 1), curTotal = y * 12 + (m - 1);
    const kBase = Math.floor((curTotal - anchorTotal) / iv);
    for (let k = kBase - 1; k <= kBase + 2; k++) {
      const tm = anchorTotal + k * iv;
      const yy = Math.floor(tm / 12), mm = (tm % 12) + 1;
      if (yy < 1912) continue;
      candidates.push({ cycle: `${yy - 1911}-${String(mm).padStart(2, '0')}`, date: clampDateYmd(yy, mm, cfg.day) });
    }
  }

  candidates.sort((a, b) => a.date.localeCompare(b.date));
  const lead = Number(r.lead_days) || 14;
  for (const c of candidates) {
    if (c.cycle === r.last_done_cycle) continue;
    const diff = diffDays(today, c.date);
    if (diff >= -45) return { cycle: c.cycle, dueDate: c.date, diffDays: diff, isVisible: diff <= lead };
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
    return `<div class="rule-inline"><span>固定在每年</span><select id="rb-m" onchange="updateRoutineRulePreview()">${monthOptsHTML(cfg.month)}</select><select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 31)}</select><span>前辦理</span></div>`;
  }
  if (recType === '每兩年' || recType === '自訂每N年') {
    return `<div class="rule-inline">
      ${recType === '自訂每N年' ? `<span>每</span><input id="rb-iv" type="number" min="2" max="10" value="${cfg.interval || 3}" style="width:58px" oninput="updateRoutineRulePreview()"><span>年一次，</span>` : `<input id="rb-iv" type="hidden" value="2"><span>每 2 年一次，</span>`}
      <span>從民國</span><input id="rb-ay" type="number" min="100" max="150" value="${cfg.anchorRocYear || curRoc}" style="width:68px" oninput="updateRoutineRulePreview()">
      <span>年起算，固定於</span><select id="rb-m" onchange="updateRoutineRulePreview()">${monthOptsHTML(cfg.month)}</select><select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 31)}</select>
    </div>`;
  }
  if (recType === '每學期') {
    return `<div class="rule-inline"><span>第 1 次（下學期）：</span><select id="rb-m1" onchange="updateRoutineRulePreview()">${monthOptsHTML(cfg.m1)}</select><select id="rb-d1" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.d1, 31)}</select></div>
      <div class="rule-inline"><span>第 2 次（上學期）：</span><select id="rb-m2" onchange="updateRoutineRulePreview()">${monthOptsHTML(cfg.m2)}</select><select id="rb-d2" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.d2, 31)}</select></div>`;
  }
  if (recType === '每季') {
    return `<div class="rule-inline"><span>於</span><select id="rb-qmode" onchange="updateRoutineRulePreview()"><option value="END" ${cfg.mode !== 'NEXT' ? 'selected' : ''}>每季末月（3、6、9、12 月）</option><option value="NEXT" ${cfg.mode === 'NEXT' ? 'selected' : ''}>每季次月（1、4、7、10 月）</option></select><span>的</span><select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 28)}</select></div>`;
  }
  if (recType === '每雙月') {
    return `<div class="rule-inline"><span>於</span><select id="rb-parity" onchange="updateRoutineRulePreview()"><option value="EVEN" ${cfg.parity !== 'ODD' ? 'selected' : ''}>雙數月（2、4、6、8、10、12 月）</option><option value="ODD" ${cfg.parity === 'ODD' ? 'selected' : ''}>單數月（1、3、5、7、9、11 月）</option></select><span>的</span><select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 28)}</select></div>`;
  }
  if (recType === '每月') {
    return `<div class="rule-inline"><span>每個月固定於</span><select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 28)}</select><span>前辦理</span></div>`;
  }
  if (recType === '自訂每N個月') {
    return `<div class="rule-inline"><span>每</span><input id="rb-iv" type="number" min="2" max="18" value="${cfg.interval || 6}" style="width:58px" oninput="updateRoutineRulePreview()"><span>個月一次，基準年月</span><input id="rb-aym" type="month" value="${esc(cfg.anchorYm || todayStr().slice(0, 7))}" onchange="updateRoutineRulePreview()"><span>的</span><select id="rb-d" onchange="updateRoutineRulePreview()">${dayOptsHTML(cfg.day, 28)}</select></div>`;
  }
  return '';
}

function readRuleBuilderConfig() {
  const recType = document.getElementById('rt-rec')?.value || '每年';
  if (recType === '每年') return { type: '每年', month: Number(document.getElementById('rb-m')?.value) || 12, day: Number(document.getElementById('rb-d')?.value) || 10 };
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
  if (recType === '每季') return { type: '每季', mode: document.getElementById('rb-qmode')?.value || 'END', day: Number(document.getElementById('rb-d')?.value) || 25 };
  if (recType === '每雙月') return { type: '每雙月', parity: document.getElementById('rb-parity')?.value || 'EVEN', day: Number(document.getElementById('rb-d')?.value) || 10 };
  if (recType === '每月') return { type: '每月', day: Number(document.getElementById('rb-d')?.value) || 10 };
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
  const prevEl = document.getElementById('rb-preview');
  if (prevEl) {
    prevEl.innerHTML = `📅 <strong>排程預覽：</strong>${esc(describeDueRuleHuman(recType, code))}<br>`
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
      <div class="field full"><label>固定辦理事項名稱 *</label><input id="rt-title" type="text" value="${esc(r.title || '')}" placeholder="例：建築物公安檢查（兩年一次）、冷氣濾網小額採購清洗"></div>
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
      <div class="field"><label>關聯採購模板（選填，到點可一鍵套模板）</label>
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
    title, category: cat, recurrence_type: recType, due_rule: dueRule,
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
          <thead><tr><th>事項名稱與備註</th><th>業務類別／週期</th><th>到期規則與提前預告</th><th>下次到期</th><th>上次完成</th><th>操作</th></tr></thead>
          <tbody>
            ${list.map(r => {
              const canQuickBuy = ['一般小額採購', '共同供應契約'].includes(r.category);
              return `
                <tr style="${r.is_active === false ? 'opacity:.45' : ''}">
                  <td><strong>${esc(r.title)}</strong>${r.note ? `<div class="item-meta">${esc(r.note)}</div>` : ''}</td>
                  <td><span class="tag ${r.category==='共同供應契約'?'tag-blue':r.category==='一般小額採購'?'tag-amber':'tag-gray'}">${esc(r.category)}</span><div class="item-meta">${esc(r.recurrence_type)}</div></td>
                  <td><div><strong>${esc(describeDueRuleHuman(r.recurrence_type, r.due_rule))}</strong></div><div class="item-meta">提前 ${r.lead_days} 天通知</div></td>
                  <td style="white-space:nowrap"><strong>${esc(r.sch.dueDate)}</strong><div class="item-meta">期別 ${esc(r.sch.cycle)}</div></td>
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
  document.getElementById('wiz-budget').value = 100000;
  onWizardBudgetChange();
  if (r.category === '共同供應契約') {
    const aw = document.getElementById('wiz-award');
    if (aw) { aw.value = '共同供應契約'; onWizardAwardChange(); }
  }
}

// ----------------------------------------------------------------------------
// 3. 採購開案連動 ＋ 小額年度保養／分期履約契約（分期付款＋各階段期程）
// ----------------------------------------------------------------------------
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
  if (typeof refreshWizardProjectId === 'function') refreshWizardProjectId();
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

function onWizardTierChange() { refreshWizardAwardOptions(); }

function onWizardAwardChange() {
  const awardVal = document.getElementById('wiz-award')?.value || '';
  const commChk = document.getElementById('flg-comm');
  if (commChk) {
    if (['最有利標', '評分及格最低標', '取最有利標精神'].includes(awardVal)) commChk.checked = true;
    else if (awardVal === '逕洽' || awardVal.includes('共同供應契約')) commChk.checked = false;
  }
  updateWizardLegalHint();
}

function toggleMaintOptionsUI() {
  const chk = document.getElementById('flg-maint');
  const box = document.getElementById('maint-config-row');
  if (box) box.style.display = (chk && chk.checked) ? 'flex' : 'none';
  updateWizardLegalHint();
}

function getMaintPeriodCount() {
  const freq = document.getElementById('maint-freq')?.value || '4';
  if (freq === 'custom') return Math.max(2, Math.min(24, Number(document.getElementById('maint-custom-n')?.value) || 4));
  return Number(freq) || 4;
}

function updateWizardLegalHint() {
  const box = document.getElementById('wiz-legal-hint');
  if (!box) return;
  const budgetRaw = document.getElementById('wiz-budget')?.value;
  const tier = document.getElementById('wiz-tier')?.value;
  const award = document.getElementById('wiz-award')?.value || '';
  const isMaint = !!document.getElementById('flg-maint')?.checked;
  const expectedTier = getTierFromBudget(budgetRaw);

  let warn = false;
  const lines = [];
  if (expectedTier && expectedTier !== tier) {
    warn = true;
    lines.push(`⚠️ 預算金額（${Number(budgetRaw).toLocaleString('zh-TW')} 元）依採購法對應「${expectedTier}」，與目前手動選擇的「${tier}」不一致，請確認是否刻意提高招標層級辦理。`);
  }
  if (isMaint) {
    const pCnt = getMaintPeriodCount();
    lines.push(`🔧 年度保養／分期履約模式：將自動展開「簽辦訂約 ＋ 共 ${pCnt} 期履約保養檢核」，並解鎖「💰 分期付款與核銷」頁籤（保留款預設 0%）。`);
  } else if (award.includes('共同供應契約')) {
    lines.push('🛒 共同供應契約提醒：將自動展開專屬 4 階段檢核（確認契約效期 → 電子採購網下訂 → 交貨測試 → 驗收登帳核銷）。');
  } else if (tier === '小額(15萬以下)') {
    lines.push('📘 小額採購（15 萬元以下）：免編標案案號、免公告、免監辦；若屬電梯／飲水機／冷氣／消防等年度保養契約，建議勾選下方「年度保養／分期履約契約」。');
  } else if (tier === '未達(15-150萬)') {
    lines.push('📘 未達公告金額（逾 15 萬至未達 150 萬）：等標期原則不少於 5 天，第 1 階段請一併簽准未滿 3 家改採限制性招標及監辦方式。');
  } else {
    lines.push('📘 公告金額以上（150 萬元以上）：等標期 14 天以上、第 1 次須滿 3 家、強制通知監辦、決標後 30 日內須刊登決標公告。');
  }
  box.className = 'legal-hint' + (warn ? ' warn' : '');
  box.innerHTML = lines.join('<br>');
}

const _origOpenProjectWizard = openProjectWizard;
openProjectWizard = function(presetTemplateId = '', presetName = '', sourceMemoId = '') {
  _origOpenProjectWizard(presetTemplateId, presetName, sourceMemoId);
  document.getElementById('modal-title').textContent = '＋ 開立新採購與履約案件';
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
  if (grid && !document.getElementById('flg-maint')) {
    const maintDiv = document.createElement('div');
    maintDiv.className = 'field full';
    maintDiv.innerHTML = `
      <div class="maint-box">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:700;color:#166534">
          <input type="checkbox" id="flg-maint" onchange="toggleMaintOptionsUI()">
          🔧 年度保養／分期履約契約（適用小額逕洽或勞務案：自動展開多期保養節點 ＋ 解鎖分期付款頁籤）
        </label>
        <div id="maint-config-row" class="rule-inline" style="display:none">
          <span>履約／請款期數：</span>
          <select id="maint-freq" onchange="document.getElementById('maint-custom-wrap').style.display=this.value==='custom'?'inline-flex':'none';updateWizardLegalHint()">
            <option value="4" selected>每季保養／請款（4 期）</option>
            <option value="12">每月保養／請款（12 期）</option>
            <option value="6">每雙月保養／請款（6 期）</option>
            <option value="2">每學期／半年（2 期）</option>
            <option value="custom">自訂期數</option>
          </select>
          <span id="maint-custom-wrap" style="display:none;align-items:center;gap:4px">
            <input id="maint-custom-n" type="number" min="2" max="24" value="3" style="width:58px" oninput="updateWizardLegalHint()"> 期
          </span>
        </div>
      </div>
    `;
    grid.appendChild(maintDiv);
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

const _origSubmitNewProject = submitNewProject;
submitNewProject = async function() {
  const isMaint = !!document.getElementById('flg-maint')?.checked;
  const maintPeriods = isMaint ? getMaintPeriodCount() : 0;
  window._pendingMaintMeta = { is_maintenance: isMaint, maint_periods: maintPeriods };
  await _origSubmitNewProject();
  if (isMaint && selectedProjectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === selectedProjectId);
    if (p) {
      const flg = parseJSON(p.flags_json, {});
      flg.is_maintenance = true;
      flg.maint_periods = maintPeriods;
      p.flags_json = JSON.stringify(flg);
      p.retention_rate = 0;
      if (!p.orig_end_date && p.start_date) p.orig_end_date = addDays(p.start_date, 364);
      persistCache();
      renderCurrentView();
      await pushToCloud({ action: 'upsert', table: 'Projects', record: p });
    }
  }
  window._pendingMaintMeta = null;
};

const _origBuildStandardStages = buildStandardStages;
buildStandardStages = function(opts) {
  const maintMeta = window._pendingMaintMeta || {};
  if (maintMeta.is_maintenance || (opts && opts.flags && opts.flags.is_maintenance)) {
    const periods = maintMeta.maint_periods || (opts.flags && opts.flags.maint_periods) || 4;
    const tier = opts.tier || '小額(15萬以下)';
    const baseStart = opts.startDate || todayStr();
    const baseEnd = (opts.endDate && diffDays(baseStart, opts.endDate) >= 14) ? opts.endDate : addDays(baseStart, 364);
    const totalDays = Math.max(periods * 7, diffDays(baseStart, baseEnd));
    const stepDays = Math.max(7, Math.floor(totalDays / periods));

    const stages = [{
      stage_order: 1,
      stage_name: tier === '小額(15萬以下)' ? '簽辦動支與逕洽訂約' : '招標決標與契約簽訂',
      plan_start: addDays(baseStart, -10), plan_end: addDays(baseStart, -1),
      actual_start: '', actual_end: '', sla_deadline: '', blocker_note: '', status: '進行中',
      checklist_json: JSON.stringify([
        { id: 'm_init_1', text: '確認全年度累計總價未規避採購法分批辦理（§14），完成請購／動支簽核', required: true, done: false, doc_no: '', done_date: '' },
        { id: 'm_init_2', text: '核對報價單／維護契約條款（含保養頻率、叫修時效、零件計價與分期請款條件）', required: true, done: false, doc_no: '', done_date: '' },
        { id: 'm_init_3', text: '完成契約簽署或下訂通知，確認首期進場保養時間', required: true, done: false, doc_no: '', done_date: '' }
      ])
    }];

    for (let i = 1; i <= periods; i++) {
      const pStart = addDays(baseStart, (i - 1) * stepDays);
      const pEnd = (i === periods) ? baseEnd : addDays(baseStart, i * stepDays - 1);
      stages.push({
        stage_order: i + 1,
        stage_name: `第 ${i} 期履約保養與分期核銷`,
        plan_start: pStart, plan_end: pEnd,
        actual_start: '', actual_end: '', sla_deadline: pEnd, blocker_note: '', status: '未開始',
        checklist_json: JSON.stringify([
          { id: `m_p${i}_1`, text: `廠商完成第 ${i} 期現場保養／維護作業並留存紀錄表與照片`, required: true, done: false, doc_no: '', done_date: '' },
          { id: `m_p${i}_2`, text: `確認設備運轉正常並核對第 ${i} 期發票／收據金額無誤`, required: true, done: false, doc_no: '', done_date: '' },
          { id: `m_p${i}_3`, text: `完成第 ${i} 期驗收簽章，並於「💰 分期付款」頁籤登錄主計核銷撥款`, required: true, done: false, doc_no: '', done_date: '' }
        ])
      });
    }
    return stages;
  }

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
    if (f.is_green) stages[3].items.push({ text: '【綠色採購】確認環保／節能標章並登錄機關綠色採購網', required: true });

    const baseStart = startDate || todayStr();
    const span = (startDate && endDate && diffDays(startDate, endDate) > 4) ? diffDays(startDate, endDate) : 30;
    const step = Math.max(3, Math.floor(span / stages.length));
    return stages.map((st, idx) => ({
      stage_order: idx + 1, stage_name: st.name,
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

// 非工程之「小額年度保養／勞務分期履約案」解鎖簡化版「💰 分期付款與核銷」頁籤
const _prevRenderProjectDetail_ux = renderProjectDetailHTML;
renderProjectDetailHTML = function(projectId) {
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
  if (!p) return _prevRenderProjectDetail_ux(projectId);
  const isEng = p.procurement_type === '工程' || p.engineering_category === '一般公共工程' || p.engineering_category === '公有建築物';
  if (isEng) return _prevRenderProjectDetail_ux(projectId);

  const flg = parseJSON(p.flags_json, {});
  const billings = (appData.tables.Project_Billings || []).filter(b => b.project_id === projectId);
  const isInstallment = !!flg.is_maintenance || p.procurement_type === '勞務' || billings.length > 0;
  if (!isInstallment) return _prevRenderProjectDetail_ux(projectId);

  const wantBilling = (selectedProjectSubtab === 'billings');
  if (wantBilling) selectedProjectSubtab = 'checklist';
  let html = _prevRenderProjectDetail_ux(projectId);
  if (wantBilling) selectedProjectSubtab = 'billings';

  const tabHtml = `<button class="${wantBilling ? 'btn-primary' : ''}" onclick="selectedProjectSubtab='billings';renderCurrentView()">💰 分期付款與核銷 (${billings.length})</button>`;
  html = html.replace('📊 單案甘特圖預覽</button>', `📊 單案甘特圖預覽</button>${tabHtml}`);
  if (wantBilling) {
    html = html.replace('class="btn-primary" onclick="selectedProjectSubtab=\'checklist\'', 'class="" onclick="selectedProjectSubtab=\'checklist\'');
    const closeTabs = html.indexOf('</div>', html.indexOf(tabHtml));
    if (closeTabs > 0) {
      html = html.slice(0, closeTabs + 6) + renderMaintenanceBillingsHTML(p, billings);
    }
  }
  return html;
};

function renderMaintenanceBillingsHTML(p, billings) {
  const contractAmt = Number(p.award_amount) || Number(p.budget_amount) || 0;
  const totalPaid = billings.reduce((s, b) => s + (Number(b.net_payable) || 0), 0);
  const disbursed = billings.filter(b => b.workflow_stage === '已撥款入帳').reduce((s, b) => s + (Number(b.net_payable) || 0), 0);
  const remain = contractAmt > 0 ? (contractAmt - totalPaid) : 0;
  const execPct = contractAmt > 0 ? Math.round((totalPaid / contractAmt) * 100) : 0;
  const stages = ['廠商請款', '總務驗收複核', '主計審核', '校長核章', '已撥款入帳'];

  return `
    <div class="eng-kpi-row" style="grid-template-columns:repeat(4,1fr)">
      <div class="eng-stat"><div class="lbl">契約／預算總金額</div><div class="val">${contractAmt ? fmtMoney(contractAmt) : '-'}</div></div>
      <div class="eng-stat"><div class="lbl">累計請款金額（執行 ${execPct}%）</div><div class="val" style="color:var(--primary)">${fmtMoney(totalPaid)}</div></div>
      <div class="eng-stat"><div class="lbl">已撥款入帳累計</div><div class="val" style="color:var(--green)">${fmtMoney(disbursed)}</div></div>
      <div class="eng-stat"><div class="lbl">剩餘契約餘額</div><div class="val" style="color:${remain<0?'var(--red)':'var(--text)'}">${fmtMoney(remain)}</div></div>
    </div>
    <div class="panel">
      <div class="panel-hd">
        <h3>💰 分期付款與核銷紀錄（年度保養／勞務簡化模式，免扣工程保留款）</h3>
        <button class="btn-sm btn-primary" onclick="openMaintBillingModal('${esc(p.project_id)}')">＋ 新增本期請款核銷</button>
      </div>
      <div class="panel-bd" style="overflow-x:auto">
        ${billings.length ? `
          <table>
            <thead><tr><th>期別</th><th>本期請款金額</th><th>扣款／減價</th><th>實付金額</th><th>校內核銷進度</th><th>發票／傳票與撥款日</th><th>操作</th></tr></thead>
            <tbody>
              ${billings.map(b => `
                <tr>
                  <td><strong>${esc(b.billing_seq)}</strong><div class="item-meta">${esc(b.material_gate_ack || '')}</div></td>
                  <td>${fmtMoney(b.period_amount)}</td>
                  <td>${Number(b.penalty_deduct || 0).toLocaleString('zh-TW')} 元</td>
                  <td><strong style="color:var(--primary)">${fmtMoney(b.net_payable)}</strong></td>
                  <td>
                    <select style="padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;font-size:12px" onchange="advanceBillingStage('${esc(b.billing_id)}',this.value)">
                      ${stages.map(s => `<option value="${s}" ${b.workflow_stage === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                  </td>
                  <td><div>${esc(b.voucher_no || '-')}</div><div class="item-meta">${b.paid_date ? '撥款 ' + esc(b.paid_date) : ''}</div></td>
                  <td style="white-space:nowrap">
                    <button class="btn-xs" onclick="openMaintBillingModal('${esc(p.project_id)}','${esc(b.billing_id)}')">✎</button>
                    <button class="btn-xs btn-danger" onclick="deleteBilling('${esc(b.billing_id)}')">刪</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div class="empty-state">尚無分期付款紀錄，點擊「＋ 新增本期請款核銷」追蹤每期保養請款與剩餘額度。</div>'}
      </div>
    </div>
  `;
}

function openMaintBillingModal(projectId, billingId = '') {
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId) || {};
  const billings = (appData.tables.Project_Billings || []).filter(b => b.project_id === projectId);
  const b = billingId ? billings.find(x => x.billing_id === billingId) : {};
  const flg = parseJSON(p.flags_json, {});
  const contractAmt = Number(p.award_amount) || Number(p.budget_amount) || 0;
  const defPer = b.period_amount ?? (flg.maint_periods && contractAmt ? Math.round(contractAmt / flg.maint_periods) : '');
  const stages = ['廠商請款', '總務驗收複核', '主計審核', '校長核章', '已撥款入帳'];

  openModal(billingId ? '✎ 編輯分期付款紀錄' : '＋ 新增分期付款與核銷紀錄', `
    <div class="form-grid">
      <div class="field"><label>期別名稱 *</label><input id="mb-seq" type="text" value="${esc(b.billing_seq || `第${billings.length + 1}期保養請款`)}"></div>
      <div class="field"><label>本期請款金額（元）*</label><input id="mb-per" type="number" value="${esc(defPer)}" oninput="document.getElementById('mb-net').value=(Number(this.value)||0)-(Number(document.getElementById('mb-pen').value)||0)"></div>
      <div class="field"><label>違約／未達標扣款（無填 0）</label><input id="mb-pen" type="number" value="${Number(b.penalty_deduct) || 0}" oninput="document.getElementById('mb-net').value=(Number(document.getElementById('mb-per').value)||0)-(Number(this.value)||0)"></div>
      <div class="field"><label>本次實付金額（元）</label><input id="mb-net" type="number" value="${esc(b.net_payable ?? defPer)}" style="font-weight:700;color:var(--primary)"></div>
      <div class="field"><label>校內核銷進度</label>
        <select id="mb-stage">${stages.map(s => `<option value="${s}" ${(b.workflow_stage || '廠商請款') === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label>發票號碼／傳票文號</label><input id="mb-vch" type="text" value="${esc(b.voucher_no || '')}"></div>
      <div class="field"><label>實際撥款日</label><input id="mb-paid" type="date" value="${esc(b.paid_date || '')}"></div>
      <div class="field"><label>保養內容／驗收備註</label><input id="mb-note" type="text" value="${esc(b.material_gate_ack || '')}" placeholder="例：Q1保養紀錄表與照片齊全"></div>
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveMaintBilling('${esc(projectId)}','${esc(billingId)}')">儲存請款紀錄</button>
  `);
}

async function saveMaintBilling(projectId, billingId) {
  const seq = document.getElementById('mb-seq').value.trim();
  if (!seq) return toast('請填寫期別名稱');
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId) || {};
  const existing = billingId ? (appData.tables.Project_Billings || []).find(x => x.billing_id === billingId) : {};
  const per = Number(document.getElementById('mb-per').value) || 0;
  const pen = Number(document.getElementById('mb-pen').value) || 0;
  const net = Number(document.getElementById('mb-net').value) || (per - pen);
  const stage = document.getElementById('mb-stage').value;
  let paidDate = document.getElementById('mb-paid').value;
  if (stage === '已撥款入帳' && !paidDate) paidDate = todayStr();

  const baseAmt = Number(p.award_amount) || Number(p.budget_amount) || 0;
  const otherSum = (appData.tables.Project_Billings || [])
    .filter(x => x.project_id === projectId && x.billing_id !== billingId)
    .reduce((s, x) => s + (Number(x.period_amount) || 0), 0);
  const cumAmt = otherSum + per;

  const rec = {
    billing_id: billingId || nextId('Project_Billings', 'billing_id', 'BIL', 4),
    project_id: projectId, billing_seq: seq, base_contract_amount: baseAmt,
    cum_progress_pct: baseAmt > 0 ? Number(((cumAmt / baseAmt) * 100).toFixed(1)) : 0,
    cum_billed_amount: cumAmt, period_amount: per,
    retention_deduct: 0, advance_recoup: 0, penalty_deduct: pen, net_payable: net,
    workflow_stage: stage,
    stage_dates_json: JSON.stringify({ ...parseJSON(existing.stage_dates_json, {}), [stage]: todayStr() }),
    voucher_no: document.getElementById('mb-vch').value.trim(),
    paid_date: paidDate, material_gate_ack: document.getElementById('mb-note').value.trim(),
    updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Project_Billings', rec, 'billing_id');
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_Billings', record: rec });
  toast('✅ 已儲存分期付款紀錄');
}

// ----------------------------------------------------------------------------
// 4. Chrome 起始戰情室「一屏自適配免捲動」控制引擎
// ----------------------------------------------------------------------------
(function initDashboardAutoFit() {
  const FIT_KEY = 'ga_dash_autofit_v1';
  let fitMode = localStorage.getItem(FIT_KEY) || 'auto'; // 'auto' | 'compact' | 'scroll'

  function ensureFitToggleButton() {
    const actions = document.querySelector('.top-actions');
    if (!actions || document.getElementById('btn-fit-mode')) return;
    const btn = document.createElement('button');
    btn.id = 'btn-fit-mode';
    btn.style.cssText = 'background:#334155;color:#fff;border-color:#475569';
    btn.onclick = cycleFitMode;
    actions.insertBefore(btn, actions.lastElementChild);
    updateFitButtonLabel();
  }

  function updateFitButtonLabel() {
    const btn = document.getElementById('btn-fit-mode');
    if (!btn) return;
    if (fitMode === 'auto') { btn.textContent = '🖥️ 一屏適配'; btn.title = '自動填滿視窗免捲動（點擊切換極致緊湊／傳統捲動）'; }
    else if (fitMode === 'compact') { btn.textContent = '📐 極致緊湊'; btn.title = '極致緊湊一屏模式（點擊切換傳統捲動）'; }
    else { btn.textContent = '📜 傳統捲動'; btn.title = '傳統整頁捲動（點擊切回一屏適配）'; }
  }

  function cycleFitMode() {
    fitMode = fitMode === 'auto' ? 'compact' : (fitMode === 'compact' ? 'scroll' : 'auto');
    localStorage.setItem(FIT_KEY, fitMode);
    updateFitButtonLabel();
    applyDashboardAutoFit();
    toast(`🖥️ 戰情室顯示模式：${fitMode === 'auto' ? '自動一屏適配' : fitMode === 'compact' ? '極致緊湊一屏' : '傳統整頁捲動'}`);
  }

  function applyDashboardAutoFit() {
    const shouldLock = (typeof currentTab !== 'undefined' && currentTab === 'dashboard')
      && fitMode !== 'scroll'
      && window.innerWidth >= 960;
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

// ----------------------------------------------------------------------------
// 5. 內建 Claude Code 實證驗證套件（沙盒隔離 E2E ＋ 屬性測試 ＋ 差分測試）
// ----------------------------------------------------------------------------
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

function makeSeededRand(seed) {
  let a = seed >>> 0;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
    // 1. Differential Test (R-05)
    const curRoc = new Date().getFullYear() - 1911;
    const legacySamples = [
      { recurrence_type: '每季', due_rule: 'Q-END-25', lead_days: 14, last_done_cycle: `${curRoc - 1}-Q4` },
      { recurrence_type: '每季', due_rule: 'Q-NEXT-10', lead_days: 14, last_done_cycle: `${curRoc - 1}-Q3` },
      { recurrence_type: '每年', due_rule: '12-15', lead_days: 30, last_done_cycle: String(curRoc - 1) },
      { recurrence_type: '每學期', due_rule: '02-10,08-20', lead_days: 21, last_done_cycle: `${curRoc - 1}-S2` },
      { recurrence_type: '每月', due_rule: 'D-10', lead_days: 7, last_done_cycle: `${curRoc - 1}-11` }
    ];
    assert(legacySamples.every(s => {
      const a = _legacyComputeRoutineSchedule(s), b = computeRoutineSchedule(s);
      return a.cycle === b.cycle && a.dueDate === b.dueDate && a.isVisible === b.isVisible;
    }), 'R-05 差分測試：既有 5 種例行規則輸出 100% 一致');

    // 2. 例行週期 Round-trip 與合法日曆日期不變量 (300 組)
    let rtPass = 0;
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
      const sch = computeRoutineSchedule({ recurrence_type: t, due_rule: enc, lead_days: 30, last_done_cycle: '' }, '2026-11-20');
      if (enc === encodeDueRuleConfig(parseDueRuleConfig(t, enc)) && /^\d{4}-\d{2}-\d{2}$/.test(sch.dueDate)) rtPass++;
    }
    assert(rtPass === 300, `屬性測試：例行週期 Round-trip 與合法日期不變量 (${rtPass}/300)`);

    // 3. 每兩年週期跳轉與冪等性
    const biTest = { recurrence_type: '每兩年', due_rule: 'EVERY-2Y@115:06-30', lead_days: 30, last_done_cycle: '' };
    const bi1 = computeRoutineSchedule(biTest, '2026-06-15');
    biTest.last_done_cycle = '115';
    const bi2 = computeRoutineSchedule(biTest, '2026-06-15');
    const bi2Again = computeRoutineSchedule(biTest, '2026-06-15');
    assert(bi1.dueDate === '2026-06-30' && bi2.dueDate === '2028-06-30' && bi2.dueDate === bi2Again.dueDate,
      '每兩年週期跳轉與冪等性（115年完成 → 2028-06-30）');

    // 4. 跨年逾期不遺漏
    const crossYear = computeRoutineSchedule({ recurrence_type: '每季', due_rule: 'Q-END-25', lead_days: 14, last_done_cycle: '115-Q3' }, '2027-01-05');
    assert(crossYear.cycle === '115-Q4' && crossYear.dueDate === '2026-12-25' && crossYear.diffDays === -11,
      '跨年逾期不遺漏（2027-01-05 仍保留逾期 11 天之 115-Q4）');

    // 5. 採購法級距與合規決標不變量（固定亂數種子 seed=20261121，可 100% 重現）
    const rng = makeSeededRand(20261121);
    const testBudgets = [1, 149999, 150000, 150001, 500000, 1499999, 1500000, 1500001, 5000000];
    for (let i = 0; i < 491; i++) testBudgets.push(Math.floor(rng() * 4000000) + 1);
    let invPass = 0;
    testBudgets.forEach(b => {
      const tier = getTierFromBudget(b);
      const okTier = (b <= 150000 && tier === '小額(15萬以下)')
        || (b > 150000 && b < 1500000 && tier === '未達(15-150萬)')
        || (b >= 1500000 && tier === '公開(150萬以上)');
      const legal = AWARD_OPTIONS_BY_TIER[tier].map(o => o.value);
      const okAwards = ['逕洽', '取最有利標精神', '共同供應契約', '最有利標'].every(a => legal.includes(resolveAwardForTier(tier, a)));
      if (okTier && okAwards) invPass++;
    });
    assert(invPass === testBudgets.length, `屬性測試：採購級距＋合規決標不變量 (固定種子 ${invPass}/${testBudgets.length})`);

    // 6. 年度保養分期 1–12 期不變量
    let maintPass = 0;
    for (let n = 1; n <= 12; n++) {
      const st = buildStandardStages({ tier: '小額(15萬以下)', type: '勞務', awardMethod: '逕洽', flags: { is_maintenance: true, maint_periods: n }, startDate: '2026-01-01', endDate: '2026-12-31' });
      const st2 = buildStandardStages({ tier: '小額(15萬以下)', type: '勞務', awardMethod: '逕洽', flags: { is_maintenance: true, maint_periods: n }, startDate: '2026-01-01', endDate: '2026-12-31' });
      const datesAsc = st.every((s, idx) => /^\d{4}-\d{2}-\d{2}$/.test(s.plan_start) && s.plan_start <= s.plan_end && (idx === 0 || s.plan_start >= st[idx - 1].plan_start));
      if (st.length === n + 1 && datesAsc && JSON.stringify(st) === JSON.stringify(st2)) maintPass++;
    }
    assert(maintPass === 12, `屬性測試：年度保養分期 1–12 期階段數、遞增日期與冪等性 (${maintPass}/12)`);

    // 7. 共同供應契約專屬 4 階段
    const jcStages = buildStandardStages({ tier: '小額(15萬以下)', type: '財物', awardMethod: '共同供應契約', flags: { is_green: true }, startDate: '2026-11-20' });
    assert(jcStages.length === 4 && jcStages[0].stage_name.includes('共契'), 'E2E：共同供應契約自動組裝專屬 4 階段檢核流程');

    // 8. 太陽能回饋率正規化等價性（涵蓋帶 %、全形 ％、整數 1 與小數）
    if (typeof normFeedbackRate === 'function') {
      const eq15 = ['15%', ' 15 % ', '15％', 15, '15', 0.15, '0.15'].every(v => normFeedbackRate(v) === 0.15);
      const eq1 = normFeedbackRate('1%') === 0.01 && normFeedbackRate(1) === 0.01 && normFeedbackRate('100%') === 1 && normFeedbackRate(-5) === 0;
      assert(eq15 && eq1, '屬性測試：回饋率正規化等價性（15% / 15 / 0.15 / "0.15" / 1% / 1）');
    }

    // 9. E2E：預算連動級距與過濾不合規決標原則
    openProjectWizard();
    const bIn = document.getElementById('wiz-budget'), tSel = document.getElementById('wiz-tier'), aSel = document.getElementById('wiz-award');
    bIn.value = '120000'; onWizardBudgetChange();
    const ok1 = tSel.value === '小額(15萬以下)' && aSel.value === '逕洽';
    bIn.value = '850000'; onWizardBudgetChange();
    const ok2 = tSel.value === '未達(15-150萬)' && aSel.value === '最低標';
    bIn.value = '2500000'; onWizardBudgetChange();
    const ok3 = tSel.value === '公開(150萬以上)' && !Array.from(aSel.options).some(o => o.value === '逕洽' || o.value === '取最有利標精神');
    assert(ok1 && ok2 && ok3, 'E2E：預算金額即時連動級距與合規決標原則（12萬／85萬／250萬）');

    // 10. E2E：例行視覺化表單「每兩年 5/31」編碼與中文預覽
    openRoutineModal();
    document.getElementById('rt-cat').value = '共同供應契約';
    document.getElementById('rt-rec').value = '每兩年';
    onRoutineRecurrenceChange();
    document.getElementById('rb-ay').value = '115';
    document.getElementById('rb-m').value = '5';
    document.getElementById('rb-d').value = '31';
    updateRoutineRulePreview();
    const encRule = document.getElementById('rt-rule').value;
    const prevTxt = document.getElementById('rb-preview').textContent || '';
    assert(encRule === 'EVERY-2Y@115:05-31' && prevTxt.includes('每 2 年 5 月 31 日'), 'E2E：例行表單「每兩年 5/31」正確編碼與即時中文預覽');

    // 11. E2E：一屏適配切換鈕與「採購與履約管理」正名
    const fitBtnExists = !!document.getElementById('btn-fit-mode');
    const renamedOk = (document.querySelector('#nav-tabs [data-tab="projects"]')?.textContent || '').includes('採購與履約管理');
    assert(fitBtnExists && renamedOk, 'E2E：一屏適配切換鈕與「採購與履約管理」正名就位');

    // 12. R-04 資安檢查：不含 API Token、資料表不含底價欄位
    const dumpStr = JSON.stringify(appData);
    const noToken = !appConfig.token || !dumpStr.includes(appConfig.token);
    const noFloorKey = Object.values(appData.tables || {}).every(rows =>
      (rows || []).every(r => !Object.keys(r || {}).some(k => /reserve|base_price|底價/i.test(k)))
    );
    assert(noToken && noFloorKey, 'R-04 資安檢查：appData 不含 API Token 且資料表無底價欄位');

    closeModal();
  } catch (err) {
    failed++;
    logs.push(`❌ [EXCEPTION] ${err.message}`);
  } finally {
    appData = JSON.parse(snapData);
    currentTab = snapTab;
    selectedProjectId = snapProj;
    pushToCloud = origPush;
    persistCache = origPersist;
    renderCurrentView();
  }

  const stamp = failed === 0
    ? 'verified: [browser-dom-e2e, property-test(seeded-812), differential-test, autofit-ui, security-r04]'
    : `FAILED (${failed})`;
  openModal('🧪 Claude Code 實證驗證報告', `
    <div class="gate-banner ${failed === 0 ? 'green' : 'red'}" style="margin-bottom:10px">
      <strong>Verification Stamp：</strong><code>${esc(stamp)}</code><br>
      通過 <span class="verify-pass">${passed}</span> 項 ／ 失敗 <span class="${failed ? 'verify-fail' : ''}">${failed}</span> 項
    </div>
    <div class="verify-log">${esc(logs.join('\n'))}</div>
  `, `<button class="btn-primary" onclick="closeModal()">關閉</button>`);
}
renderCurrentView();
