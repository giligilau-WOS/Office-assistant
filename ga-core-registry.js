/**
 * ============================================================================
 * 總務行政戰情助理 — 核心插槽註冊器、雲端擴充倉儲與公文級工具底座 (ga-core-registry.js)
 * 遵循規範：UI_DESIGN_RULES.md §0–§7
 * 功能：
 * 1. GA_CORE 插槽註冊中心（registerModule / getModules / projectToolbarActions）
 * 2. 免重部署 GAS 之雲端無縫擴充倉儲（extStore：讀寫 Project_Responsibilities.__SYS_EXT__）
 * 3. 公文級民國年日期顯示與彈性輸入解析（formatRocDate / parseFlexibleRocDate）
 * 4. 動態智慧去校名前綴與年度膠囊提取（formatSmartTitle — 零硬編碼校名）
 * 5. 全站跨模組真實急迫度四級排序引擎（computeUnifiedUrgency — 杜絕遠期黃燈搶版面）
 * 6. 全站 8 秒復原機制（pushUndoAction）與 Ctrl+K 全域指令搜尋面板（openCommandPalette）
 * ============================================================================
 */

(function initGaCoreRegistry() {
  if (window.GA_CORE && window.GA_CORE.__initialized) return;

  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  const modulesMap = new Map();
  let lastUndo = null;
  let undoTimer = null;

  function safeEsc(s) {
    return typeof esc === 'function'
      ? esc(s)
      : String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function ensureRespTable() {
    if (typeof appData === 'undefined') return [];
    if (!appData.tables) appData.tables = {};
    if (!Array.isArray(appData.tables.Project_Responsibilities)) {
      appData.tables.Project_Responsibilities = [];
    }
    return appData.tables.Project_Responsibilities;
  }

  function makeExtPk(moduleKey, id) {
    return `EXT-${moduleKey}-${id}-REC`;
  }

  // --------------------------------------------------------------------------
  // 1. 免改 GAS 之雲端擴充資料表引擎 (extStore)
  // --------------------------------------------------------------------------
  const extStore = {
    list(moduleKey) {
      const rows = ensureRespTable();
      const out = [];
      for (const r of rows) {
        if (!r || r.is_deleted === true || String(r.is_deleted).toUpperCase() === 'TRUE') continue;
        if (r.project_id !== '__SYS_EXT__' || r.phase_name !== moduleKey) continue;
        const parsed = parseJSON(r.roles_matrix_json, null);
        if (parsed && typeof parsed === 'object') {
          out.push({ ...parsed, _resp_id: r.resp_id, _updated_at: r.updated_at || '' });
        }
      }
      return out;
    },

    get(moduleKey, id) {
      const pk = makeExtPk(moduleKey, id);
      const row = ensureRespTable().find(r => r && r.resp_id === pk && r.is_deleted !== true && String(r.is_deleted).toUpperCase() !== 'TRUE');
      if (!row) return null;
      return parseJSON(row.roles_matrix_json, null);
    },

    nextSeqId(moduleKey, prefix, pad = 4) {
      let max = 0;
      const list = this.list(moduleKey);
      list.forEach(item => {
        const rawId = String(item.id || item.sp_id || item.booking_id || item.space_id || item.cert_id || item.asset_id || '');
        const m = rawId.match(/(\d+)$/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
    },

    buildRow(moduleKey, id, obj, summaryText = '', subType = '') {
      const now = typeof nowStr === 'function' ? nowStr() : new Date().toISOString().slice(0, 19).replace('T', ' ');
      const payload = { ...obj, id: obj.id || id, updated_at: now };
      return {
        resp_id: makeExtPk(moduleKey, id),
        project_id: '__SYS_EXT__',
        phase_name: moduleKey,
        item_no: subType || String(id),
        item_name: String(summaryText || obj.title || obj.name || id).slice(0, 160),
        contract_basis: '',
        roles_matrix_json: JSON.stringify(payload),
        linked_module: moduleKey,
        is_exempt: false,
        has_penalty: false,
        sla_days_json: '{}',
        relay_dates_json: '{}',
        current_holder: '',
        doc_ref: String(obj.voucher_no || obj.doc_no || obj.cert_no || ''),
        note: String(obj.note || ''),
        updated_at: now,
        is_deleted: false
      };
    },

    async upsert(moduleKey, id, obj, summaryText = '', subType = '') {
      const row = this.buildRow(moduleKey, id, obj, summaryText, subType);
      upsertLocal('Project_Responsibilities', row, 'resp_id');
      if (typeof persistCache === 'function') persistCache();
      if (typeof renderCurrentView === 'function') renderCurrentView();
      if (typeof pushToCloud === 'function') {
        await pushToCloud({ action: 'upsert', table: 'Project_Responsibilities', record: row });
      }
      return parseJSON(row.roles_matrix_json, obj);
    },

    async batchUpsert(moduleKey, entries) {
      if (!Array.isArray(entries) || !entries.length) return [];
      const rows = entries.map(e => {
        const row = this.buildRow(moduleKey, e.id, e.record, e.summary || '', e.subType || '');
        upsertLocal('Project_Responsibilities', row, 'resp_id');
        return row;
      });
      if (typeof persistCache === 'function') persistCache();
      if (typeof renderCurrentView === 'function') renderCurrentView();
      if (typeof pushToCloud === 'function') {
        await pushToCloud({ action: 'batchUpsert', items: [{ table: 'Project_Responsibilities', records: rows }] });
      }
      return rows;
    },

    async remove(moduleKey, id, labelForUndo = '紀錄') {
      const pk = makeExtPk(moduleKey, id);
      const arr = ensureRespTable();
      const existing = arr.find(r => r && r.resp_id === pk);
      if (!existing) return;
      const backup = JSON.parse(JSON.stringify(existing));
      appData.tables.Project_Responsibilities = arr.filter(r => r.resp_id !== pk);
      if (typeof persistCache === 'function') persistCache();
      if (typeof renderCurrentView === 'function') renderCurrentView();
      if (typeof pushToCloud === 'function') {
        await pushToCloud({ action: 'softDelete', table: 'Project_Responsibilities', id: pk, cascade: false });
      }
      pushUndoAction(`已刪除「${labelForUndo}」`, async () => {
        backup.is_deleted = false;
        backup.updated_at = typeof nowStr === 'function' ? nowStr() : backup.updated_at;
        upsertLocal('Project_Responsibilities', backup, 'resp_id');
        if (typeof persistCache === 'function') persistCache();
        if (typeof renderCurrentView === 'function') renderCurrentView();
        if (typeof pushToCloud === 'function') {
          await pushToCloud({ action: 'upsert', table: 'Project_Responsibilities', record: backup });
        }
      });
    }
  };

  function getCloudPresets(kind) {
    return extStore.list('CLOUD_PRESET')
      .filter(p => !kind || p.kind === kind)
      .map(pr => {
        const hydrated = { ...pr };
        if (pr.matchStart && pr.matchKwp) {
          const fn = c => String(c?.contract_start || '').slice(0, 10) === pr.matchStart
            && Math.abs((Number(c?.capacity_kwp) || 0) - Number(pr.matchKwp)) < 0.005;
          hydrated.match = fn;
          hydrated.contractMatch = fn;
        } else if (pr.matchRegex) {
          try {
            const re = new RegExp(pr.matchRegex);
            hydrated.match = p => re.test(String(p?.project_name || ''));
          } catch {
            hydrated.match = () => false;
          }
        }
        return hydrated;
      });
  }

  // --------------------------------------------------------------------------
  // 2. 公文級民國年日期與智慧標題工具
  // --------------------------------------------------------------------------
  function formatRocDate(ymd, opts = {}) {
    if (!ymd) return '-';
    const s = String(ymd).trim().slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    const gy = parseInt(m[1], 10);
    const ry = gy - 1911;
    const mm = opts.pad === false ? String(parseInt(m[2], 10)) : m[2];
    const dd = opts.pad === false ? String(parseInt(m[3], 10)) : m[3];
    let base = opts.noYear ? `${mm}/${dd}` : `${ry}/${mm}/${dd}`;
    if (opts.withWeekday) {
      const dt = new Date(`${s}T00:00:00`);
      if (!isNaN(dt.getTime())) base += ` (${WEEKDAYS[dt.getDay()]})`;
    }
    return base;
  }

  function parseFlexibleRocDate(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // 支援 1151209 (7碼民國) 或 20261209 (8碼西元)
    const digits = s.replace(/\D/g, '');
    if (s === digits && digits.length === 7) {
      const ry = parseInt(digits.slice(0, 3), 10);
      const mm = digits.slice(3, 5);
      const dd = digits.slice(5, 7);
      return `${ry + 1911}-${mm}-${dd}`;
    }
    if (s === digits && digits.length === 8) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }
    // 支援 115/12/9 或 115-12-9 或 115.12.9
    const parts = s.split(/[\/\-\.年月日]+/).filter(Boolean);
    if (parts.length >= 3) {
      let y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (y > 0 && y < 1900) y += 1911;
      if (y >= 1911 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return '';
  }

  function deriveSchoolPrefixes() {
    const prefixes = new Set(['高雄市政府暨所屬機關學校', '教育部國民及學前教育署']);
    const full = String((typeof appData !== 'undefined' && appData?.schoolName) || (typeof appConfig !== 'undefined' && appConfig?.schoolName) || '').trim();
    if (full && full !== '國民中小學總務處') {
      prefixes.add(full);
      // 動態推導簡稱（例：「○○市立△△國民中學」→「△△國民中學」、「△△國中」）
      const strippedCity = full.replace(/^.{2,3}[市縣](立)?/, '');
      if (strippedCity.length >= 3) {
        prefixes.add(strippedCity);
        prefixes.add(strippedCity.replace('國民中學', '國中').replace('國民小學', '國小'));
      }
    }
    return [...prefixes].sort((a, b) => b.length - a.length);
  }

  function formatSmartTitle(rawTitle) {
    const fullTitle = String(rawTitle ?? '').trim();
    if (!fullTitle) return { yearBadge: '', cleanTitle: '-', fullTitle: '' };
    let rest = fullTitle;
    let yearBadge = '';

    const ym = rest.match(/^(\d{3})\s*年度?\s*/);
    if (ym) {
      yearBadge = ym[1];
      rest = rest.slice(ym[0].length);
    }
    for (const pre of deriveSchoolPrefixes()) {
      if (pre && rest.startsWith(pre)) {
        rest = rest.slice(pre.length).replace(/^[之・\s]+/, '');
        break;
      }
    }
    if (!yearBadge) {
      const ym2 = rest.match(/^(\d{3})\s*年度?\s*/);
      if (ym2) {
        yearBadge = ym2[1];
        rest = rest.slice(ym2[0].length);
      }
    }
    // 將過長「工程委託設計監造勞務採購」簡化為高辨識度括號尾綴
    rest = rest
      .replace(/工程委託設計監造勞務採購$/, '（委託設計監造）')
      .replace(/委託設計監造技術服務勞務採購$/, '（委託設計監造）');

    return {
      yearBadge,
      cleanTitle: rest || fullTitle,
      fullTitle
    };
  }

  // --------------------------------------------------------------------------
  // 3. 跨模組真實急迫度四級排序引擎 (Unified Urgency Score)
  // --------------------------------------------------------------------------
  function extractAlertDate(a) {
    if (a.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate)) return a.dueDate;
    const det = String(a.detail || '');
    // 優先抓「期限 YYYY-MM-DD」或第一個 ISO 日期
    const m = det.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }

  function inferActionHint(a, mod) {
    if (a.actionHint) return a.actionHint;
    const b = String(a.badge || '');
    const det = String(a.detail || '');
    if (b.includes('意外險') || b.includes('產險') || b.includes('保險')) {
      return '請催廠商補送新年度續保保單影本並登錄備查';
    }
    if (b.includes('催繳') || b.includes('對帳') || b.includes('租金')) {
      return det || '請確認參考年租金明細表並開立繳款通知單催繳';
    }
    if (b.includes('法定死線') || b.includes('上級死線') || b.includes('補助')) {
      return det || '屬上級／法定硬死線，請優先完成本階段檢核項';
    }
    if (mod === 'routine') {
      return det ? det.replace(/應辦日\s*\d{4}-\d{2}-\d{2}\s*[｜|]?\s*/, '') || '開啟標準步驟完成本期申報並打卡' : '開啟標準步驟完成本期申報並打卡';
    }
    if (mod === 'util') {
      return det || '檢視本期水電度數異常原因與契約容量需量';
    }
    return det || '進入雙欄工作台檢視並推進當前進度';
  }

  function classifyAlertModule(a) {
    if (a.module) return a.module;
    const b = String(a.badge || '');
    if (b === '例行業務') return 'routine';
    if (b.startsWith('太陽能') || b.startsWith('光電')) return 'solar';
    if (['水電異常', '水費異常', '電費異常', '水電預算', '節費建議'].includes(b)) return 'util';
    if (b.includes('綠採') || b.includes('優採') || b.includes('小額')) return 'statutory-proc';
    if (b.includes('安檢')) return 'safety-wall';
    if (b.includes('場地')) return 'venue-board';
    const openMemos = ((typeof appData !== 'undefined' && appData?.tables?.Quick_Memos) || []).filter(m => !m.is_done);
    if (openMemos.some(m => m.content === a.title)) return 'memo';
    return 'project';
  }

  function computeUnifiedUrgency(rawAlerts = null, today = null) {
    const tdy = today || (typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10));
    const baseList = Array.isArray(rawAlerts)
      ? rawAlerts.slice()
      : (typeof buildAllAlerts === 'function' ? buildAllAlerts() : []);

    // 收集新註冊模組之警報
    if (!rawAlerts) {
      modulesMap.forEach(mod => {
        if (typeof mod.getAlerts === 'function') {
          try {
            const extra = mod.getAlerts(appData, tdy) || [];
            extra.forEach(x => baseList.push({ ...x, module: mod.id }));
          } catch {}
        }
      });
    }

    // 補入 8～30 日內即將到期但尚未達原模組 lead_days 黃燈之例行事務，確保 30 日預告不漏接！
    const existingTitles = new Set(baseList.map(a => String(a.title || '').trim()));
    if (!rawAlerts && typeof computeRoutineSchedule === 'function' && appData?.tables?.Annual_Routines) {
      (appData.tables.Annual_Routines || []).filter(r => r.is_active !== false).forEach(r => {
        if (existingTitles.has(String(r.title || '').trim())) return;
        const sch = computeRoutineSchedule(r);
        if (sch && typeof sch.diffDays === 'number' && sch.diffDays >= 0 && sch.diffDays <= 30) {
          baseList.push({
            level: sch.diffDays <= 7 ? 'amber' : 'blue',
            badge: '例行業務',
            title: r.title,
            dueDate: sch.dueDate,
            detail: `應辦日 ${sch.dueDate}｜${r.note || r.category || '定期例行事項'}`,
            module: 'routine',
            routineId: r.routine_id,
            action: () => {
              if (typeof openRoutineDetailModal === 'function') openRoutineDetailModal(r.routine_id);
              else if (typeof switchTab === 'function') switchTab('routines');
            }
          });
        }
      });
    }

    const enriched = baseList.map((a, idx) => {
      const mod = classifyAlertModule(a);
      const dueYmd = extractAlertDate(a);
      const daysLeft = (dueYmd && typeof diffDays === 'function') ? diffDays(tdy, dueYmd) : null;
      const isStatutorySla = /法定死線|上級死線|補助/.test(String(a.badge || '') + String(a.title || ''));

      let tier = 2;
      let effectiveLevel = a.level || 'blue';
      if (daysLeft !== null) {
        if (daysLeft < 0) { tier = 0; effectiveLevel = 'red'; }
        else if (daysLeft <= 7) { tier = 1; effectiveLevel = daysLeft <= 2 ? 'red' : 'amber'; }
        else if (daysLeft <= 30) { tier = 2; effectiveLevel = effectiveLevel === 'red' ? 'amber' : 'amber'; }
        else { tier = 3; effectiveLevel = 'blue'; }
      } else {
        tier = a.level === 'red' ? 0 : a.level === 'amber' ? 1 : 2;
      }

      const smart = formatSmartTitle(a.title || '');
      const rocDue = dueYmd ? formatRocDate(dueYmd) : '';
      const relLabel = daysLeft === null
        ? (a.level === 'red' ? '需立即處理' : '待處理')
        : daysLeft < 0
        ? `逾期 ${Math.abs(daysLeft)} 天`
        : daysLeft === 0
        ? '今日截止'
        : `剩 ${daysLeft} 天`;

      return {
        ...a,
        _idx: idx,
        module: mod,
        dueDate: dueYmd,
        rocDue,
        daysLeft,
        relLabel,
        tier,
        effectiveLevel,
        isStatutorySla,
        yearBadge: smart.yearBadge,
        cleanTitle: smart.cleanTitle,
        fullTitle: smart.fullTitle,
        actionHint: inferActionHint(a, mod)
      };
    });

    enriched.sort((x, y) => {
      if (x.tier !== y.tier) return x.tier - y.tier;
      if (x.isStatutorySla !== y.isStatutorySla) return x.isStatutorySla ? -1 : 1;
      const dx = x.daysLeft ?? (x.effectiveLevel === 'red' ? -1 : 15);
      const dy = y.daysLeft ?? (y.effectiveLevel === 'red' ? -1 : 15);
      if (dx !== dy) return dx - dy;
      return x._idx - y._idx;
    });

    return enriched;
  }

  // --------------------------------------------------------------------------
  // 4. 全站 8 秒復原 (Undo Toast)
  // --------------------------------------------------------------------------
  function pushUndoAction(message, undoFn) {
    lastUndo = typeof undoFn === 'function' ? undoFn : null;
    const el = document.getElementById('toast');
    if (!el || !lastUndo) {
      if (typeof toast === 'function') toast(message);
      return;
    }
    el.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:12px">
        <span>✅ ${safeEsc(message)}</span>
        <button type="button" onclick="window.GA_CORE.triggerUndo()" style="background:#F59E0B;color:#1C1917;border:none;padding:4px 10px;border-radius:6px;font-weight:800;font-size:13px;cursor:pointer">↩ 復原 (8秒)</button>
      </span>
    `;
    el.style.pointerEvents = 'auto';
    el.classList.add('show');
    clearTimeout(window._toastTimer);
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      lastUndo = null;
      el.classList.remove('show');
      el.style.pointerEvents = 'none';
    }, 8000);
  }

  async function triggerUndo() {
    if (!lastUndo) return;
    const fn = lastUndo;
    lastUndo = null;
    clearTimeout(undoTimer);
    const el = document.getElementById('toast');
    if (el) { el.classList.remove('show'); el.style.pointerEvents = 'none'; }
    await fn();
    if (typeof toast === 'function') toast('↩ 已復原剛才的操作');
  }

  // 包裝 markRoutineDone 與 toggleMemoDone 補上 8 秒復原保護
  if (typeof window.markRoutineDone === 'function' && !window.markRoutineDone.__gaUndoWrapped) {
    const _origMarkRtn = window.markRoutineDone;
    const wrapped = async function(routineId, cycle) {
      const r = (appData?.tables?.Annual_Routines || []).find(x => x.routine_id === routineId);
      const prevCycle = r ? r.last_done_cycle : '';
      const prevDate = r ? r.last_done_date : '';
      await _origMarkRtn(routineId, cycle);
      if (r) {
        pushUndoAction(`已完成「${r.title}」（${cycle}）`, async () => {
          r.last_done_cycle = prevCycle;
          r.last_done_date = prevDate;
          r.updated_at = nowStr();
          if (typeof persistCache === 'function') persistCache();
          if (typeof renderCurrentView === 'function') renderCurrentView();
          if (typeof pushToCloud === 'function') await pushToCloud({ action: 'upsert', table: 'Annual_Routines', record: r });
        });
      }
    };
    wrapped.__gaUndoWrapped = true;
    window.markRoutineDone = wrapped;
  }

  if (typeof window.toggleMemoDone === 'function' && !window.toggleMemoDone.__gaUndoWrapped) {
    const _origToggleMemo = window.toggleMemoDone;
    const wrappedMemo = async function(memoId, checked) {
      const m = (appData?.tables?.Quick_Memos || []).find(x => x.memo_id === memoId);
      const prevDone = m ? m.is_done : false;
      const prevDate = m ? m.done_date : '';
      await _origToggleMemo(memoId, checked);
      if (m && checked) {
        pushUndoAction(`已完成交辦「${String(m.content || '').slice(0, 18)}」`, async () => {
          m.is_done = prevDone;
          m.done_date = prevDate;
          m.updated_at = nowStr();
          if (typeof persistCache === 'function') persistCache();
          if (typeof renderCurrentView === 'function') renderCurrentView();
          if (typeof pushToCloud === 'function') await pushToCloud({ action: 'upsert', table: 'Quick_Memos', record: m });
        });
      }
    };
    wrappedMemo.__gaUndoWrapped = true;
    window.toggleMemoDone = wrappedMemo;
  }

  // --------------------------------------------------------------------------
  // 5. 學校雙曆制「總務節氣膠囊」計算器
  // --------------------------------------------------------------------------
  function getSchoolSeasonHint(today = null) {
    const tdy = today || (typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10));
    const [y, m, d] = tdy.split('-').map(Number);
    const md = m * 100 + d;
    const routines = (appData?.tables?.Annual_Routines || []).filter(r => r.is_active !== false);

    if (md >= 1115 && md <= 1228) {
      const decRenewals = routines.filter(r => /^12-/.test(String(r.due_rule || '')) && /續約|續租|招標|委外/.test(r.title || ''));
      const closeDate = `${y}-12-15`;
      const left = typeof diffDays === 'function' ? diffDays(tdy, closeDate) : 0;
      const countTxt = decRenewals.length ? `・${decRenewals.length} 件下年度續約待辦` : '';
      return {
        icon: '🏦',
        text: left >= 0 ? `會計關帳倒數 ${left} 天${countTxt}` : `年底會計結報收尾期${countTxt}`,
        actionTab: 'routines'
      };
    }
    if ((md >= 120 && md <= 218) || (md >= 805 && md <= 831)) {
      return { icon: '🏫', text: '開學前校園安檢與水塔／環境整備期', actionTab: 'safety-wall' };
    }
    if (md >= 625 && md <= 825) {
      return { icon: '🏗️', text: '暑假校舍修繕與大型工程施工黃金期', actionTab: 'projects' };
    }
    if (md >= 501 && md <= 531) {
      return { icon: '🧯', text: '5月防汛整備與消防安全設備申報期', actionTab: 'safety-wall' };
    }
    return { icon: '🌿', text: '學期常態維運・小額綠採與優採即時控管中', actionTab: 'statutory-proc' };
  }

  // --------------------------------------------------------------------------
  // 6. Ctrl+K / Cmd+K 全域指令與快速跳轉面板
  // --------------------------------------------------------------------------
  function openCommandPalette() {
    if (typeof openModal !== 'function') return;
    openModal('🔍 全域快速搜尋與指令跳轉 (Ctrl+K)', `
      <div class="field" style="margin-bottom:12px">
        <input id="ga-cmd-input" type="text" placeholder="輸入標案名稱、例行業務、教室編號（如 101、風雨球場）、小額採購或功能名稱..."
          style="font-size:16px;padding:10px 14px;border:2px solid #7C4A21;border-radius:10px"
          oninput="window.GA_CORE.renderCommandResults(this.value)">
      </div>
      <div id="ga-cmd-results" style="max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:6px"></div>
    `, `<button class="btn-primary" onclick="closeModal()">關閉 (Esc)</button>`);
    window.GA_CORE.renderCommandResults('');
    setTimeout(() => document.getElementById('ga-cmd-input')?.focus(), 40);
  }

  function renderCommandResults(qRaw) {
    const box = document.getElementById('ga-cmd-results');
    if (!box) return;
    const q = String(qRaw || '').trim().toLowerCase();
    const items = [
      { tag: '導覽', title: '📊 戰情總覽（07暖沙雙層黃金艙）', act: "closeModal();switchTab('dashboard')" },
      { tag: '導覽', title: '🧾 小額與法定採購（§14防拆單／綠採95%／優採5%）', act: "closeModal();switchTab('statutory-proc')" },
      { tag: '導覽', title: '🏟️ 場地與教室借用看板（卡片式空間時段）', act: "closeModal();switchTab('venue-board')" },
      { tag: '導覽', title: '🛡️ 校園法定安檢合規證照牆', act: "closeModal();switchTab('safety-wall')" },
      { tag: '導覽', title: '📦 設備履歷與耗材安全庫存', act: "closeModal();switchTab('asset-inv')" },
      { tag: '助手', title: '📝 開啟公文簽呈／驗收紀錄／催辦草稿助手', act: "closeModal();if(window.openDocCopilotModal)openDocCopilotModal()" },
      { tag: '精靈', title: '⚡ 開啟年末維護／委外契約批次續約精靈', act: "closeModal();if(window.openBatchRenewalModal)openBatchRenewalModal()" }
    ];

    (appData?.tables?.Projects || []).forEach(p => {
      items.push({ tag: `標案 ${p.fiscal_year || ''}`, title: `${p.project_name}（${p.project_id}）`, act: `closeModal();openProjectDetail('${safeEsc(p.project_id)}')` });
    });
    (appData?.tables?.Annual_Routines || []).filter(r => r.is_active !== false).forEach(r => {
      items.push({ tag: '例行', title: r.title, act: `closeModal();switchTab('routines');if(window.selectSplitRoutine)window.selectSplitRoutine('${safeEsc(r.routine_id)}')` });
    });
    (appData?.tables?.Solar_Contracts || []).forEach(c => {
      items.push({ tag: '太陽能', title: `${c.building_name}（${c.phase_label || c.solar_id}）`, act: `closeModal();switchTab('solar');if(typeof openSolarV2Detail==='function')openSolarV2Detail('${safeEsc(c.solar_id)}')` });
    });

    const filtered = items.filter(it => !q || `${it.tag} ${it.title}`.toLowerCase().includes(q)).slice(0, 18);
    box.innerHTML = filtered.length
      ? filtered.map(it => `
          <button type="button" onclick="${it.act}"
            style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid #E7DFD3;background:#FBF8F3;font-size:15px;font-weight:700;cursor:pointer">
            <span class="tag tag-amber" style="flex-shrink:0">${safeEsc(it.tag)}</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safeEsc(it.title)}</span>
          </button>
        `).join('')
      : '<div class="empty-state">找不到相符項目</div>';
  }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  });

  // --------------------------------------------------------------------------
  // 7. 插槽註冊 API
  // --------------------------------------------------------------------------
  function registerModule(manifest) {
    if (!manifest || !manifest.id) return;
    modulesMap.set(manifest.id, manifest);
    if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
      window.GA_REGISTRY.registerModule(manifest.id, manifest.version || 'v2.0', manifest.title || manifest.id);
    }
  }

  window.GA_CORE = {
    __initialized: true,
    extStore,
    getCloudPresets,
    formatRocDate,
    parseFlexibleRocDate,
    formatSmartTitle,
    computeUnifiedUrgency,
    pushUndoAction,
    triggerUndo,
    getSchoolSeasonHint,
    openCommandPalette,
    renderCommandResults,
    registerModule,
    getModule: id => modulesMap.get(id),
    getModules: () => [...modulesMap.values()]
  };

  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('ga-core-registry.js', 'v2.0', '核心插槽註冊器、雲端擴充倉儲與公文級工具底座');
  }
})();
