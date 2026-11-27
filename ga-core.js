/**
 * ============================================================================
 * 總務行政戰情助理 — 核心底座 (ga-core.js)
 * 依 UI_DESIGN_RULES.md §2、§4 實作：
 *   - 單一來源 Design Tokens（07 暖沙 × 05 特大字），以變數重定義套用至既有主題
 *   - 共用領域工具：民國日期 formatRocDate、智慧簡稱 formatSmartTitle、一鍵複製
 *   - 跨模組真實急迫度引擎 collectUrgentItems（§0-7、§2.3）
 *   - 插槽註冊器：onBeforeRender／onAfterRender／registerView／registerModule
 *     ── 全站唯一一次 renderCurrentView 包裝，於所有腳本載入後安裝；
 *        新模組一律向此註冊，不得再自行覆寫 renderCurrentView（§0-3）
 *   - 自適應側欄（矮視窗月曆收為本週日期膠囊）與總務節氣膠囊（§1.2、§3.2）
 * 本檔需在所有業務模組之前載入。
 * ============================================================================
 */

(function initGaCore() {
  const GA = window.GA_CORE = window.GA_CORE || {};
  GA.version = '1.0';
  const beforeHooks = [], afterHooks = [], views = {}, modules = [];

  // --------------------------------------------------------------------------
  // 1. Design Tokens（§2.1）
  // --------------------------------------------------------------------------
  if (!document.getElementById('ga-core-tokens')) {
    const st = document.createElement('style');
    st.id = 'ga-core-tokens';
    st.textContent = `
      @layer tokens, base, layout, components, modules, themes;
      @layer tokens {
        :root {
          --bg-canvas: #FBF8F3; --bg-topbar: #F5EFE6; --bg-surface: #FFFFFF; --bg-subtle: #FAF6F0;
          --border-subtle: #E7DFD3; --border-strong: #D6CBB9;
          --text-primary: #1C1917; --text-secondary: #44403C; --text-muted: #57534E;
          --brand-primary: #7C4A21; --brand-accent: #0D9488; --brand-soft: #F5EDE3;
          --status-danger: #DC2626; --status-danger-bg: #FEF2F2;
          --status-warn: #B45309; --status-warn-bg: #FFFBEB;
          --status-ok: #047857; --status-ok-bg: #ECFDF5;
          --status-info: #1D4ED8; --status-info-bg: #EFF6FF;
          --fs-xs: 12.5px; --fs-sm: 14px; --fs-base: 16px; --fs-lg: 18px; --fs-kpi: 28px;
          --gap-canvas: 16px; --pad-panel: 16px 18px;
        }
        @media (max-width: 1439px) {
          :root { --fs-sm: 13.5px; --fs-base: 15px; --fs-lg: 17px; --fs-kpi: 26px; }
        }
      }
      /* 07 暖沙：重定義既有主題變數（僅在預設主題時套用，其他配色主題不受影響） */
      body[data-ga-skin="sand"] {
        --bg: var(--bg-canvas); --surface: var(--bg-surface); --surface-alt: var(--bg-subtle);
        --border: var(--border-subtle); --border-strong: var(--border-strong);
        --text: var(--text-primary); --muted: var(--text-muted);
        --primary: var(--brand-primary); --primary-hover: #5F3818; --primary-soft: var(--brand-soft);
        --red: var(--status-danger); --red-soft: var(--status-danger-bg);
        --amber: var(--status-warn); --amber-soft: var(--status-warn-bg);
        --green: var(--status-ok); --green-soft: var(--status-ok-bg);
        --cal-sand: #F7F1E6; --cal-sand-border: var(--border-subtle);
      }
      @layer components {
        .ga-roc { font-variant-numeric: tabular-nums; }
        .ga-yr { display: inline-block; font-size: var(--fs-xs); font-weight: 700; color: var(--text-secondary);
          background: var(--bg-subtle); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0 6px; margin-right: 6px;
          font-variant-numeric: tabular-nums; vertical-align: 1px; }
        .ga-season { display: inline-flex; align-items: center; gap: 4px; margin-left: 10px; padding: 2px 10px;
          border-radius: 999px; font-size: var(--fs-xs); font-weight: 700; color: var(--brand-primary);
          background: var(--brand-soft); border: 1px solid var(--border-subtle); cursor: pointer; white-space: nowrap; }
        .ga-season:hover { border-color: var(--brand-primary); }
        /* 自適應側欄：矮視窗月曆收為本週膠囊 */
        .ga-week { display: none; gap: 3px; padding: 6px; margin: 6px 0; border-radius: 10px; cursor: pointer;
          background: var(--cal-sand, #F7F1E6); border: 1px solid var(--border-subtle); }
        .ga-week span { flex: 1; text-align: center; font-size: var(--fs-xs); font-weight: 700; color: var(--text-secondary);
          border-radius: 6px; padding: 3px 0; position: relative; font-variant-numeric: tabular-nums; }
        .ga-week span.today { background: var(--brand-primary); color: #fff; }
        .ga-week span.ga-due::after { content: ''; position: absolute; left: 50%; bottom: -1px; width: 5px; height: 5px; margin-left: -2.5px;
          border-radius: 50%; background: var(--status-warn); }
        body.ga-short .ga-week { display: flex; }
        body.ga-short #nordic-side-calendar { display: none; }
        body.ga-short.ga-cal-pop #nordic-side-calendar { display: block; position: fixed; z-index: 60; width: 236px;
          left: calc(var(--sidebar-w, 246px) + 6px); top: 120px; box-shadow: 0 12px 32px rgba(28, 25, 23, 0.18); }
      }
    `;
    document.head.appendChild(st);
  }

  // --------------------------------------------------------------------------
  // 2. 共用領域工具（§2.2、§2.4）
  // --------------------------------------------------------------------------
  const WK = ['日', '一', '二', '三', '四', '五', '六'];
  GA.formatRocDate = function(ymd, opts = {}) {
    const s = String(ymd || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '-';
    const [y, m, d] = s.split('-').map(Number);
    const base = `${y - 1911}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    if (!opts.withWeekday) return base;
    return `${base} (${WK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
  };
  GA.daysLeft = ymd => (ymd ? diffDays(todayStr(), String(ymd).slice(0, 10)) : null);
  GA.relText = d => d === null || d === undefined ? '' : d < 0 ? `逾期 ${Math.abs(d)} 天` : d === 0 ? '今天' : `剩 ${d} 天`;
  GA.rocWithRel = ymd => { const d = GA.daysLeft(ymd); return `${GA.formatRocDate(ymd)}（${GA.relText(d)}）`; };

  function schoolNameVariants() {
    const full = String((typeof appData !== 'undefined' && appData.schoolName) || (typeof appConfig !== 'undefined' && appConfig.schoolName) || '');
    const out = new Set();
    if (full) {
      out.add(full);
      const noCity = full.replace(/^.*?(市立|縣立|國立|私立)/, '');
      out.add(noCity);
      out.add(noCity.replace('國民中學', '國中').replace('國民小學', '國小').replace('高級中學', '高中'));
    }
    return [...out].filter(Boolean).sort((a, b) => b.length - a.length);
  }

  // 「115年○○國中跑道及周邊設施整建工程委託設計監造勞務採購」→ { year:'115', title:'跑道及周邊設施整建（委託設計監造）' }
  GA.formatSmartTitle = function(raw) {
    const full = String(raw || '').trim();
    let t = full;
    let year = '';
    const ym = t.match(/^(\d{3})\s*年度?/);
    if (ym) { year = ym[1]; t = t.slice(ym[0].length); }
    schoolNameVariants().forEach(v => { t = t.split(v).join(''); });
    t = t.replace(/^[\s　、，]+/, '');
    const ds = t.match(/^(.*?)(?:工程)?委託(規劃)?設計(及)?監造(勞務)?(採購)?$/);
    if (ds && ds[1]) t = `${ds[1]}（委託設計監造）`;
    t = t.replace(/勞務採購$/, '（勞務）');
    if (!year) { const y2 = t.match(/^(\d{3})\s*年度?/); if (y2) { year = y2[1]; t = t.slice(y2[0].length); } }
    return { year, title: t || full, full };
  };
  GA.smartTitleHTML = function(raw) {
    const s = GA.formatSmartTitle(raw);
    return `${s.year ? `<span class="ga-yr">${esc(s.year)}</span>` : ''}${esc(s.title)}`;
  };

  GA.copyText = async function(text, okMsg = '📋 已複製，可直接貼上') {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      toast(okMsg);
    } catch { toast('⚠️ 無法自動複製，請手動選取'); }
  };

  // --------------------------------------------------------------------------
  // 3. 跨模組真實急迫度引擎（§0-7、§2.3）
  //    回傳標準物件 { id, module, level, dueDate, daysLeft, tier, isStatutorySla,
  //                   badge, title, smart, actionHint, actionLabel, onAction, copyText }
  // --------------------------------------------------------------------------
  const isDone = v => v === true || String(v).toUpperCase() === 'TRUE';
  const SOLAR_HINT = {
    '太陽能意外險': '請催廠商補送續保單影本備查',
    '太陽能產險': '請催廠商補送產物保險續保單備查',
    '太陽能續租': '確認廠商是否已書面申請優先續租',
    '太陽能保證函': '通知廠商換發履約保證函',
    '光電逾期': '催繳年租金並核算逾期違約金',
    '光電得終止': '已達得終止門檻，請簽辦催告或終止',
    '光電短收': '通知廠商補繳差額'
  };
  const PROJECT_HINT = {
    '補助死線': '確認補助核銷文件並送主計',
    '保固到期': '安排保固期滿會勘',
    '材料逾期': '催辦材料送審',
    '催辦監造': '催請監造單位審查',
    '待機關核備': '辦理機關核備',
    '變更紅線': '辦理契約變更程序',
    '變更額度': '檢視變更額度並簽辦'
  };
  const ROUTINE_HINT = {
    '法定填報': '至填報網站登錄本期資料',
    '設施安檢維運': '安排廠商檢修並辦理申報',
    '預算核銷': '辦理預算保留／核銷',
    '校產與租約': '核對回饋金入帳與契約',
    '一般小額採購': '開辦下年度小額採購',
    '共同供應契約': '辦理下年度共同供應契約訂購',
    '例行招標預告': '啟動下年度招標作業'
  };

  function tierOf(d) { return d < 0 ? 0 : d <= 7 ? 1 : d <= 30 ? 2 : 3; }

  GA.collectUrgentItems = function() {
    const items = [];
    const T = (typeof appData !== 'undefined' && appData.tables) || {};
    const memos = (T.Quick_Memos || []).filter(m => !isDone(m.is_done));
    const memoTitles = new Set(memos.map(m => m.content));
    const schoolName = (typeof appData !== 'undefined' && appData.schoolName) || '本校';

    const push = it => {
      it.daysLeft = it.dueDate ? GA.daysLeft(it.dueDate) : 0;
      it.tier = tierOf(it.daysLeft);
      const s = GA.formatSmartTitle(it.title);
      it.smart = s;
      it.copyText = `您好，這裡是${schoolName}總務處。關於「${s.full}」：${it.actionHint}，期限為民國 ${GA.formatRocDate(it.dueDate)}（${GA.relText(it.daysLeft)}），敬請協助於期限前辦理，謝謝。`;
      items.push(it);
    };

    // (a) 例行事務：全部啟用中項目，依實際期限
    (T.Annual_Routines || []).filter(r => r.is_active !== false && String(r.is_active).toUpperCase() !== 'FALSE' && !isDone(r.is_deleted)).forEach(r => {
      if (typeof computeRoutineSchedule !== 'function') return;
      const sch = computeRoutineSchedule(r);
      if (!sch || !sch.dueDate) return;
      push({
        id: `rt:${r.routine_id}`, module: 'routine', badge: r.category || '例行事務', title: r.title,
        dueDate: sch.dueDate, isStatutorySla: r.category === '法定填報',
        actionHint: `${ROUTINE_HINT[r.category] || '辦理本期作業'}（期別 ${sch.cycle}）`, actionLabel: '檢視步驟',
        onAction: () => (typeof openRoutineDetailModal === 'function' ? openRoutineDetailModal(r.routine_id) : switchTab('routines'))
      });
    });

    // (b) 標案階段：法定死線與目前進行中階段預定完成日
    const prjMap = {};
    (T.Projects || []).forEach(p => { prjMap[p.project_id] = p; });
    (T.Project_Tasks || []).forEach(t => {
      const p = prjMap[t.project_id];
      if (!p || ['已結案', '廢標撤案'].includes(p.status) || t.status === '已完成' || isDone(t.is_deleted)) return;
      if (t.sla_deadline) {
        push({
          id: `sla:${t.task_id}`, module: 'project', badge: '法定死線', title: p.project_name, dueDate: t.sla_deadline, isStatutorySla: true,
          actionHint: `完成「${t.stage_name}」`, actionLabel: '更新進度', onAction: () => openProjectDetail(p.project_id)
        });
      } else if (t.status === '進行中' && t.plan_end) {
        push({
          id: `stg:${t.task_id}`, module: 'project', badge: '階段期限', title: p.project_name, dueDate: t.plan_end, isStatutorySla: false,
          actionHint: `推進「${t.stage_name}」`, actionLabel: '更新進度', onAction: () => openProjectDetail(p.project_id)
        });
      }
    });

    // (c) 交辦 Memo
    memos.forEach(m => {
      const due = m.due_date || m.remind_date;
      if (!due) return;
      push({
        id: `memo:${m.memo_id}`, module: 'memo', badge: m.source_tag || '交辦', title: m.content, dueDate: due, isStatutorySla: false,
        actionHint: m.due_date ? '交辦事項期限' : '指定提醒日', actionLabel: '開啟交辦',
        onAction: () => { const el = document.querySelector(`[data-memo-id="${CSS.escape(m.memo_id)}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('ga-flash'); setTimeout(() => el.classList.remove('ga-flash'), 1600); } }
      });
    });

    // (d) 其他模組警示（太陽能、水電、工程控管、補助／保固）— 排除已由上方統一產生者
    const alerts = typeof buildAllAlerts === 'function' ? buildAllAlerts() : [];
    alerts.forEach((a, i) => {
      const b = String(a.badge || '');
      if (b === '例行業務' || b === '法定死線' || b === '進度落後' || memoTitles.has(a.title) || b === 'Memo提醒' || b === '交辦到期') return;
      const m = /(\d{4}-\d{2}-\d{2})/.exec(String(a.detail || ''));
      const isSolar = b.startsWith('太陽能') || b.startsWith('光電');
      const isUtil = /水電|水費|電費|節費/.test(b);
      let hint = SOLAR_HINT[b] || PROJECT_HINT[b] || '';
      if (b === '太陽能催繳') hint = /明細表送達期限.*已過/.test(a.detail) ? '催廠商送參考年租金明細表並開立繳款通知單'
        : /逾期/.test(a.detail) ? '開立逾期違約金繳款單' : '提醒廠商於期限前送參考年租金明細表';
      if (isUtil && !hint) hint = '查明用電／用水異常原因';
      push({
        id: `al:${i}:${b}`, module: isSolar ? 'solar' : isUtil ? 'util' : 'project', badge: b, title: a.title,
        dueDate: m ? m[1] : (a.level === 'red' ? todayStr() : ''), isStatutorySla: /死線|終止/.test(b),
        actionHint: hint || String(a.detail || '').slice(0, 40), actionLabel: isSolar ? '檢視契約' : isUtil ? '檢視帳單' : '更新進度',
        onAction: typeof a.action === 'function' ? a.action : () => switchTab(isSolar ? 'solar' : isUtil ? 'utilities' : 'projects')
      });
    });

    // 統一排序：Tier0 逾期（久→近）→ Tier1 7日內（法定死線置頂）→ Tier2 30日內 → Tier3 遠期
    items.sort((x, y) => (x.tier - y.tier)
      || (x.tier === 1 ? (y.isStatutorySla - x.isStatutorySla) : 0)
      || (x.daysLeft - y.daysLeft)
      || String(x.title).localeCompare(String(y.title)));
    return items;
  };

  // --------------------------------------------------------------------------
  // 4. 插槽註冊器（§4）
  // --------------------------------------------------------------------------
  GA.onBeforeRender = fn => { if (typeof fn === 'function') beforeHooks.push(fn); };
  GA.onAfterRender = fn => { if (typeof fn === 'function') afterHooks.push(fn); };
  GA.registerView = (tab, def) => { views[tab] = def; };
  GA.getView = tab => views[tab];
  GA.registerModule = manifest => { if (manifest && manifest.id) modules.push(manifest); };
  GA.modules = () => modules.slice();
  const currentTabSafe = () => (typeof currentTab !== 'undefined' ? currentTab : 'dashboard');

  let installed = false;
  GA.install = function() {
    if (installed || typeof renderCurrentView !== 'function') return;
    installed = true;
    // 已註冊之視圖：以單一函式取代該分頁的 HTML 產生器（避免殭屍 DOM）
    if (views.dashboard && typeof views.dashboard.render === 'function') renderDashboardHTML = () => views.dashboard.render();
    // 其他分頁：def.generator 指定該分頁的 HTML 產生器名稱，render(prev, ...args) 取得原產生器以便組合
    Object.entries(views).forEach(([tab, def]) => {
      if (tab === 'dashboard' || !def || !def.generator || typeof def.render !== 'function') return;
      const prev = window[def.generator];
      if (typeof prev !== 'function') return;
      window[def.generator] = function(...args) { return def.render(prev, ...args); };
    });
    const prevRender = renderCurrentView;
    renderCurrentView = function() {
      const tab = currentTabSafe();
      beforeHooks.forEach(fn => { try { fn(tab); } catch (e) { console.error('[GA_CORE before]', e); } });
      prevRender();
      const t2 = currentTabSafe();
      document.body.dataset.gaTab = t2;
      if (views[t2] && typeof views[t2].afterRender === 'function') { try { views[t2].afterRender(); } catch (e) { console.error('[GA_CORE view]', e); } }
      afterHooks.forEach(fn => { try { fn(t2); } catch (e) { console.error('[GA_CORE after]', e); } });
    };
    renderCurrentView();
  };

  // --------------------------------------------------------------------------
  // 5. 暖沙主題、 自適應側欄與總務節氣膠囊
  // --------------------------------------------------------------------------
  function syncSkin() {
    const theme = document.body.getAttribute('data-nordic-theme');
    if (!theme || theme === 'nordic') document.body.setAttribute('data-ga-skin', 'sand');
    else document.body.removeAttribute('data-ga-skin');
  }

  function syncShortViewport() {
    document.body.classList.toggle('ga-short', window.innerWidth >= 1024 && window.innerHeight < 760);
    if (!document.body.classList.contains('ga-short')) document.body.classList.remove('ga-cal-pop');
  }

  function renderWeekStrip() {
    const cal = document.getElementById('nordic-side-calendar');
    if (!cal) return;
    let strip = document.getElementById('ga-week-strip');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'ga-week-strip';
      strip.className = 'ga-week';
      strip.title = '點擊顯示完整月曆';
      strip.onclick = e => { e.stopPropagation(); document.body.classList.toggle('ga-cal-pop'); };
      cal.insertAdjacentElement('beforebegin', strip);
      document.addEventListener('click', ev => {
        if (!ev.target.closest('#nordic-side-calendar') && !ev.target.closest('#ga-week-strip')) document.body.classList.remove('ga-cal-pop');
      });
    }
    const today = todayStr();
    const dow = new Date(today + 'T00:00:00').getDay();
    const start = addDays(today, -dow);
    const dueSet = new Set(GA.collectUrgentItems().map(i => i.dueDate));
    strip.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return `<span class="${d === today ? 'today' : ''} ${dueSet.has(d) ? 'ga-due' : ''}" title="${GA.formatRocDate(d, { withWeekday: true })}">${WK[i]}<br>${Number(d.slice(8, 10))}</span>`;
    }).join('');
  }

  // 總務節氣膠囊（§3.2）
  function seasonInfo(today) {
    const md = today.slice(5);
    const y = Number(today.slice(0, 4));
    const items = GA.collectUrgentItems();
    if (md >= '11-15' && md <= '12-25') {
      const n = items.filter(i => i.module === 'routine' && i.dueDate <= `${y}-12-31` && i.daysLeft <= 45).length;
      return { icon: '🏦', text: `會計關帳與下年度續約期（尚有 ${n} 件待辦）`, tab: 'routines' };
    }
    if ((md >= '01-20' && md <= '02-15') || (md >= '08-05' && md <= '08-30')) return { icon: '🏫', text: '開學前校園安檢與水塔／環境整備期', tab: 'routines' };
    if (md >= '06-25' && md <= '08-25') return { icon: '🏗️', text: '暑假校舍修繕施工黃金期', tab: 'projects' };
    return null;
  }

  function renderSeasonCapsule() {
    const sub = document.querySelector('.topbar .nt-greet-sub');
    if (!sub || sub.querySelector('.ga-season')) return;
    const s = seasonInfo(todayStr());
    if (!s) return;
    const el = document.createElement('span');
    el.className = 'ga-season';
    el.textContent = `${s.icon} ${s.text}`;
    el.title = '點擊前往相關事項';
    el.onclick = () => switchTab(s.tab);
    sub.appendChild(el);
  }

  GA.onAfterRender(() => { syncSkin(); syncShortViewport(); renderWeekStrip(); renderSeasonCapsule(); });
  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { syncShortViewport(); }, 120); });

  // 所有腳本載入完成後安裝唯一渲染包裝
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => GA.install());
  else setTimeout(() => GA.install(), 0);
})();
