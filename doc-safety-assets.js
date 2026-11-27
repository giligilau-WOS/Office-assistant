/**
 * ============================================================================
 * 總務行政戰情助理 — 【模組 F6 + F3 + F4】公文催辦助手、法定安檢證照牆、設備耗材庫存
 * 檔案：doc-safety-assets.js
 * 遵循規範：UI_DESIGN_RULES.md §0–§5.2 (F3, F4, F6)
 * ============================================================================
 */

(function initDocSafetyAssetsModules() {
  if (!window.GA_CORE) return;

  const h = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const roc = (ymd, opts) => window.GA_CORE.formatRocDate(ymd, opts);

  // ==========================================================================
  // 【模組 F6】純前端零外洩「公文簽呈／驗收紀錄／廠商催辦詞」草稿助手
  // ==========================================================================
  const DOC_TEMPLATES = [
    { id: 'VENDOR_NUDGE', label: '📲 廠商禮貌催辦詞（保單／租金明細／履約送件）' },
    { id: 'REQ_SIGN', label: '📝 請購動支與招標方式簽呈（依金額自動判別法條）' },
    { id: 'LIMIT_TENDER', label: '⚖️ 公開取得未達 3 家當場改採限制性招標簽呈段落' },
    { id: 'ACCEPT_NOTE', label: '✅ 小額／分期維護驗收紀錄「驗收經過與結果」標準詞' },
    { id: 'BUDGET_RESERVE', label: '🏦 跨年度工程／補助案歲出保留申請說明草稿' }
  ];

  function buildDocDraftText(tplId, ctx) {
    const school = (typeof appData !== 'undefined' && appData?.schoolName) || (typeof appConfig !== 'undefined' && appConfig?.schoolName) || '本校';
    const title = ctx.title || '○○採購／租賃案';
    const vendor = ctx.vendor || '貴公司';
    const amount = Number(ctx.amount) || 0;
    const amtStr = amount > 0 ? `新臺幣 ${amount.toLocaleString('zh-TW')} 元整` : '新臺幣 ○○萬○○元整';
    const dueRoc = ctx.dueDate ? roc(ctx.dueDate) : '115/○○/○○';
    const todayRoc = roc(typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10));

    if (tplId === 'VENDOR_NUDGE') {
      return `【${school}總務處公務聯繫】\n${vendor} 承辦夥伴您好：\n感謝貴公司持續協助本校「${title}」相關業務。\n溫馨提醒本案近期應辦事項：${ctx.hint || '請依契約規定提送本期相關文件／續保保單影本／參考年租金明細表'}（預定期限：${dueRoc}）。\n再請協助於期限前寄送或傳真／電子郵件提供本處憑辦，倘已寄出請忽略本訊息並惠予告知單號，感謝您的配合！\n\n${school} 總務處 敬上（${todayRoc}）`;
    }

    if (tplId === 'REQ_SIGN') {
      let lawBasis = '本案預估金額未達公告金額十分之一（新臺幣 15 萬元以下），擬依《政府採購法》第 23 條及《中央機關未達公告金額採購招標辦法》第 5 條規定，逕洽妥適廠商辦理採購。';
      if (amount > 150000 && amount < 1500000) {
        lawBasis = '本案預算金額逾公告金額十分之一未達公告金額，擬依《政府採購法》第 49 條及《中央機關未達公告金額採購招標辦法》第 2 條第 1 項第 3 款規定，公開取得 3 家以上廠商之書面報價或企劃書，擇最符合需要者辦理議價。';
      } else if (amount >= 1500000) {
        lawBasis = '本案預算金額達公告金額以上，擬依《政府採購法》第 18 條、第 19 條規定辦理公開招標。';
      }
      return `主旨：為辦理本校「${title}」採購案（預估經費 ${amtStr}），簽請核示。\n說明：\n一、依據本校教學及校務設施維運實際需求辦理。\n二、本案所需經費計 ${amtStr}，擬由本校年度相關預算（或上級核定補助款）項下支應。\n三、招標方式法令依據：${lawBasis}\n四、檢附本案經費概算表、需求規範（或估價單）各 1 份。\n擬辦：奉核後依規定辦理後續採購及履約驗收核銷事宜。`;
    }

    if (tplId === 'LIMIT_TENDER') {
      return `【併案簽請核准未達三家改採限制性招標段落】\n說明：\n為爭取時效、避免流標影響校務及補助執行期程，本案（「${title}」）倘第一次公告結果，未能取得 3 家以上廠商之書面報價或企劃書時，擬請准予依《中央機關未達公告金額採購招標辦法》第 3 條規定，於開標當場改採限制性招標，就已投標且合於招標文件規定之廠商辦理議價（或比價）。`;
    }

    if (tplId === 'ACCEPT_NOTE') {
      return `【驗收經過】：\n一、本案「${title}」（承攬廠商：${vendor}，本次驗收金額：${amtStr}），廠商已依約履行完畢並檢附相關履約佐證資料（維護保養紀錄表／照片／出廠證明）報請驗收。\n二、本日（${todayRoc}）由主驗人員會同相關單位依契約規範及數量辦理現場抽查與書面查驗。\n\n【驗收結果】：\n經查驗結果，規格、數量及功能運作均與契約規定相符，擬准予驗收合格，並依約辦理價金核付事宜。`;
    }

    return `【跨年度歲出保留申請原因說明草稿】\n案名：「${title}」（契約／核定金額：${amtStr}）\n保留原因說明：\n本案係跨年度執行之工程（或勞務）標案，目前正依核定期程積極辦理履約作業中（預定完工／核結期限：${dueRoc}），因契約履約期程跨越會計年度，致無法於本年度結束前完成驗收付款，爰依預算法及決算辦理注意事項規定申請專案保留，俾利下年度賡續辦理驗收結報。`;
  }

  let docModalCtx = {};

  window.openDocCopilotModal = function(opts = {}) {
    docModalCtx = {
      tplId: opts.tplId || 'VENDOR_NUDGE',
      title: opts.title || '',
      vendor: opts.vendor || '',
      amount: opts.amount || '',
      dueDate: opts.dueDate || '',
      hint: opts.hint || ''
    };
    const draft = buildDocDraftText(docModalCtx.tplId, docModalCtx);
    openModal('📝 公文簽呈・驗收紀錄・廠商催辦草稿助手（純本機產生・零外洩）', `
      <div class="form-grid" style="margin-bottom:10px">
        <div class="field full">
          <label>選擇公務文書／催辦範本</label>
          <select id="dc-tpl" onchange="dcRefreshDraft()">
            ${DOC_TEMPLATES.map(t => `<option value="${t.id}" ${t.id === docModalCtx.tplId ? 'selected' : ''}>${h(t.label)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>標案／業務名稱</label>
          <input id="dc-title" type="text" value="${h(docModalCtx.title)}" placeholder="例：116年度飲水機維護保養案" oninput="dcRefreshDraft()">
        </div>
        <div class="field">
          <label>廠商名稱（選填）</label>
          <input id="dc-vendor" type="text" value="${h(docModalCtx.vendor)}" placeholder="例：○○企業有限公司" oninput="dcRefreshDraft()">
        </div>
        <div class="field">
          <label>預算／決標或本期金額 (元)</label>
          <input id="dc-amount" type="number" value="${h(docModalCtx.amount)}" placeholder="例：145000" oninput="dcRefreshDraft()">
        </div>
        <div class="field">
          <label>應辦／履約期限</label>
          <input id="dc-due" type="date" value="${h(docModalCtx.dueDate)}" oninput="dcRefreshDraft()">
        </div>
      </div>
      <div class="field full">
        <label>即時產生草稿（可直接微調後一鍵複製貼入公文系統或 LINE）</label>
        <textarea id="dc-output" rows="9" style="font-size:15px;line-height:1.6;font-family:inherit">${h(draft)}</textarea>
      </div>
    `, `
      <button type="button" onclick="closeModal()">關閉</button>
      <button type="button" class="btn-primary" onclick="dcCopyOutput()">📋 一鍵複製草稿文字</button>
    `);
  };

  window.dcRefreshDraft = function() {
    const ctx = {
      title: document.getElementById('dc-title')?.value || '',
      vendor: document.getElementById('dc-vendor')?.value || '',
      amount: document.getElementById('dc-amount')?.value || '',
      dueDate: document.getElementById('dc-due')?.value || '',
      hint: docModalCtx.hint || ''
    };
    const tplId = document.getElementById('dc-tpl')?.value || 'VENDOR_NUDGE';
    const out = document.getElementById('dc-output');
    if (out) out.value = buildDocDraftText(tplId, ctx);
  };

  window.dcCopyOutput = async function() {
    const txt = document.getElementById('dc-output')?.value || '';
    try {
      await navigator.clipboard.writeText(txt);
      toast('📋 已複製公文／催辦草稿至剪貼簿！');
    } catch {
      const el = document.getElementById('dc-output');
      if (el) { el.select(); document.execCommand('copy'); }
      toast('📋 已選取並複製草稿！');
    }
  };

  window.copyAlertSnippet = async function(idx, ev) {
    if (ev) ev.stopPropagation();
    const list = window._gaUnifiedAlerts || [];
    const a = list[idx];
    if (!a) return window.openDocCopilotModal();
    let vendor = '';
    let amount = '';
    if (a.module === 'solar') {
      const sc = (appData?.tables?.Solar_Contracts || []).find(c => String(a.title || '').includes(c.building_name || '__'));
      if (sc) { vendor = sc.vendor_name || ''; amount = sc.base_annual_rent || ''; }
    } else if (a.module === 'project') {
      const p = (appData?.tables?.Projects || []).find(x => String(a.title || '').includes(x.project_name || '__'));
      if (p) { vendor = p.vendor_name || ''; amount = p.contract_amount || p.budget_amount || ''; }
    }
    const tplId = a.module === 'project' && !vendor ? 'REQ_SIGN' : 'VENDOR_NUDGE';
    const text = buildDocDraftText(tplId, {
      title: a.fullTitle || a.title,
      vendor,
      amount,
      dueDate: a.dueDate || '',
      hint: a.actionHint || a.detail || ''
    });
    try {
      await navigator.clipboard.writeText(text);
      toast('📋 已複製催辦／簽呈草稿（可點「公文助手」微調內容）');
    } catch {
      window.openDocCopilotModal({ tplId, title: a.fullTitle || a.title, vendor, amount, dueDate: a.dueDate || '', hint: a.actionHint || '' });
    }
  };

  // ==========================================================================
  // 【模組 F3】🛡️ 校園法定安檢合規證照牆 (safety-wall)
  // ==========================================================================
  const SAFETY_KEY = 'SAFETY_CERT';
  const SAFETY_META_KEY = 'SAFETY_META';
  const SAFETY_CUSTOM_KEY = 'SAFETY_CUSTOM';
  const STATUTORY_ITEMS = [
    { id: 'SAF-FIRE', icon: '🧯', name: '消防安全設備檢修申報', cycleLabel: '每年 1 次（5月底前）', law: '消防法第 9 條', matchRegex: /消防.*申報|消防.*檢修/ },
    { id: 'SAF-ELEC', icon: '⚡', name: '高低壓用電設備定期檢驗', cycleLabel: '每半年／每年定期檢驗', law: '電業法第 32 條', matchRegex: /高低壓.*檢|用電設備.*檢/ },
    { id: 'SAF-WATER', icon: '🚰', name: '飲用水設備水質檢測', cycleLabel: '每季抽驗 1/4 台數', law: '飲用水條例第 12 條', matchRegex: /水質檢驗|飲用水.*檢驗/ },
    { id: 'SAF-ELEV', icon: '🛗', name: '昇降設備（電梯）許可證', cycleLabel: '每年換證＋每月保養', law: '建築法第 77-4 條', matchRegex: /電梯.*許可|昇降.*許可|電梯.*安檢/ },
    { id: 'SAF-BLDG', icon: '🏢', name: '建築物公共安全檢查申報', cycleLabel: '每 2～4 年簽證申報', law: '建築法第 77 條', matchRegex: /建築物公共安全|公安申報/ },
    { id: 'SAF-PLAY', icon: '🏃', name: '兒童遊戲場與運動設施檢核', cycleLabel: '每學期開學前檢核', law: '遊戲場安全管理規範', matchRegex: /遊戲場.*檢|遊具.*檢|運動設施.*安檢/ },
    { id: 'SAF-TANK', icon: '💧', name: '蓄水池與水塔清洗消毒', cycleLabel: '每年寒暑假清洗消毒', law: '學校衛生法規範', matchRegex: /水塔.*清洗|蓄水池/ },
    { id: 'SAF-DRILL', icon: '🚨', name: '自衛消防編組演練計畫', cycleLabel: '每半年至少演練 1 次', law: '消防法第 13 條', matchRegex: /自衛消防|防災演練/ }
  ];

  const safetyState = { selectedId: 'SAF-FIRE' };

  function getHiddenSafetyIds() {
    const meta = window.GA_CORE.extStore.get(SAFETY_META_KEY, 'MAIN') || {};
    return new Set(Array.isArray(meta.hiddenIds) ? meta.hiddenIds : []);
  }

  function getAllSafetyItems(opts = {}) {
    const customList = window.GA_CORE.extStore.list(SAFETY_CUSTOM_KEY);
    const customById = Object.fromEntries(customList.map(c => [c.id, c]));
    const hidden = getHiddenSafetyIds();
    const mergedDefaults = STATUTORY_ITEMS.map(d => customById[d.id] ? { ...d, ...customById[d.id] } : d);
    const pureCustom = customList
      .filter(c => !STATUTORY_ITEMS.some(d => d.id === c.id))
      .map(c => ({ ...c, icon: c.icon || '🛡️', matchRegex: null }));
    const all = [...mergedDefaults, ...pureCustom];
    return opts.includeHidden ? all : all.filter(it => !hidden.has(it.id));
  }

  function buildSafetyCards(opts = {}) {
    const tdy = typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10);
    const savedMap = Object.fromEntries(window.GA_CORE.extStore.list(SAFETY_KEY).map(x => [x.id, x]));
    const routines = ((typeof appData !== 'undefined' && appData?.tables?.Annual_Routines) || []).filter(r => r.is_active !== false);

    return getAllSafetyItems(opts).map(item => {
      const saved = savedMap[item.id] || {};
      let linkedRtn = null;
      if (saved.linked_routine_id === '__NONE__') {
        linkedRtn = null;
      } else if (saved.linked_routine_id) {
        linkedRtn = routines.find(r => r.routine_id === saved.linked_routine_id) || null;
      } else if (item.matchRegex) {
        linkedRtn = routines.find(r => {
          const hay = `${r.title || ''} ${r.category || ''}`;
          if (/續約|續租|小額採購|進度填報|補助案/.test(hay)) return false;
          return item.matchRegex.test(hay);
        }) || null;
      }

      const sch = (linkedRtn && typeof computeRoutineSchedule === 'function') ? computeRoutineSchedule(linkedRtn) : null;
      const expiryYmd = saved.expiry_date || sch?.dueDate || '';
      const lastCheckYmd = saved.last_check_date || linkedRtn?.last_done_date || '';
      const dLeft = expiryYmd ? diffDays(tdy, expiryYmd) : null;

      let statusTone = 'teal';
      let statusLabel = '🟢 合規有效';
      let shortStatus = '🟢 有效';
      if (dLeft !== null) {
        if (dLeft < 0) {
          statusTone = 'red';
          statusLabel = `🔴 逾期 ${Math.abs(dLeft)} 天`;
          shortStatus = `🔴 逾${Math.abs(dLeft)}天`;
        } else if (dLeft <= 30) {
          statusTone = 'amber';
          statusLabel = `🟡 剩 ${dLeft} 天到期`;
          shortStatus = `🟡 剩${dLeft}天`;
        } else {
          statusTone = 'teal';
          statusLabel = `🟢 有效（剩 ${dLeft} 天）`;
          shortStatus = `🟢 ${dLeft}天`;
        }
      } else if (!saved.cert_no && !linkedRtn) {
        statusTone = 'gray';
        statusLabel = '⚪ 待設效期';
        shortStatus = '⚪ 待設定';
      }

      return {
        ...item,
        saved,
        linkedRtn,
        sch,
        expiryYmd,
        lastCheckYmd,
        dLeft,
        statusTone,
        statusLabel,
        shortStatus
      };
    });
  }

  window.safSelectCard = function(id) {
    safetyState.selectedId = id;
    renderCurrentView();
  };

  window.safHideCard = async function(id, ev) {
    if (ev) ev.stopPropagation();
    const item = getAllSafetyItems({ includeHidden: true }).find(x => x.id === id);
    const prevMeta = window.GA_CORE.extStore.get(SAFETY_META_KEY, 'MAIN') || { hiddenIds: [] };
    const prevHidden = Array.isArray(prevMeta.hiddenIds) ? prevMeta.hiddenIds : [];
    const nextHidden = [...new Set([...prevHidden, id])];
    await window.GA_CORE.extStore.upsert(SAFETY_META_KEY, 'MAIN', { id: 'MAIN', hiddenIds: nextHidden }, '安檢牆列管項目設定', 'META');
    window.GA_CORE.pushUndoAction(`已標記「${item?.name || id}」不適用並移出合規分母`, async () => {
      await window.GA_CORE.extStore.upsert(SAFETY_META_KEY, 'MAIN', { id: 'MAIN', hiddenIds: prevHidden }, '安檢牆列管項目設定', 'META');
    });
  };

  window.safOpenManageModal = function() {
    const all = getAllSafetyItems({ includeHidden: true });
    const hidden = getHiddenSafetyIds();
    openModal('⚙️ 管理本處室列管之法定安檢卡片', `
      <div class="gate-banner amber" style="margin-bottom:10px;font-size:14px">
        💡 非本校設施（如無電梯、無遊戲場）或屬他處室主政之項目，取消勾選即不會顯示在安檢牆，也不會計入首頁「有效合規」分母！
      </div>
      <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px;max-height:340px;overflow-y:auto">
        ${all.map(it => `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--border-subtle,#E7DFD3);border-radius:8px;background:#fff;cursor:pointer;font-size:14px;font-weight:700">
            <input type="checkbox" class="safm-chk" value="${h(it.id)}" ${hidden.has(it.id) ? '' : 'checked'} style="width:17px;height:17px;flex-shrink:0">
            <span style="min-width:0">${it.icon} ${h(it.name)}<div style="font-size:12px;color:#78716C;font-weight:500">${h(it.law || '自訂')}</div></span>
          </label>
        `).join('')}
      </div>
    `, `<button onclick="closeModal()">取消</button><button class="btn-primary" onclick="safSaveManagedCards()">💾 儲存列管清單</button>`);
  };

  window.safSaveManagedCards = async function() {
    const all = getAllSafetyItems({ includeHidden: true });
    const checked = new Set([...document.querySelectorAll('.safm-chk:checked')].map(c => c.value));
    const hiddenIds = all.map(x => x.id).filter(id => !checked.has(id));
    closeModal();
    await window.GA_CORE.extStore.upsert(SAFETY_META_KEY, 'MAIN', { id: 'MAIN', hiddenIds }, '安檢牆列管項目設定', 'META');
    toast(`✅ 已更新法定安檢牆（目前列管 ${checked.size} 項）`);
  };

  window.safOpenAddModal = function(editId = '') {
    const existing = editId ? getAllSafetyItems({ includeHidden: true }).find(x => x.id === editId) : null;
    openModal(existing ? `✎ 編輯安檢卡片設定：${existing.name}` : '＋ 新增自訂安檢或許可證卡片', `
      <div class="form-grid">
        <div class="field full">
          <label>安檢／證照名稱 *</label>
          <input id="safc-name" type="text" value="${h(existing?.name || '')}" placeholder="例：鍋爐安全檢查、樹木褐根病巡檢、室內空氣品質檢測">
        </div>
        <div class="field">
          <label>法規依據（精簡標籤）</label>
          <input id="safc-law" type="text" value="${h(existing?.law || '')}" placeholder="例：室內空品管理法">
        </div>
        <div class="field">
          <label>法定檢驗頻率說明</label>
          <input id="safc-cycle" type="text" value="${h(existing?.cycleLabel || '')}" placeholder="例：每年 1 次">
        </div>
      </div>
    `, `<button onclick="closeModal()">取消</button><button class="btn-primary" onclick="safSaveCustomCard('${h(editId)}')">💾 ${existing ? '儲存修改' : '新增卡片'}</button>`);
  };

  window.safSaveCustomCard = async function(editId = '') {
    const name = (document.getElementById('safc-name')?.value || '').trim();
    if (!name) return toast('請輸入安檢項目名稱');
    const existing = editId ? getAllSafetyItems({ includeHidden: true }).find(x => x.id === editId) : null;
    const id = editId || window.GA_CORE.extStore.nextSeqId(SAFETY_CUSTOM_KEY, 'SAFC', 3);
    const rec = {
      id,
      icon: existing?.icon || '🛡️',
      name,
      law: (document.getElementById('safc-law')?.value || '自訂列管').trim(),
      cycleLabel: (document.getElementById('safc-cycle')?.value || '定期檢驗').trim()
    };
    safetyState.selectedId = id;
    closeModal();
    await window.GA_CORE.extStore.upsert(SAFETY_CUSTOM_KEY, id, rec, `安檢卡設定｜${name}`, id);
    toast(editId ? `✅ 已更新「${name}」卡片設定` : `✅ 已新增「${name}」安檢卡`);
  };

  window.safSaveCert = async function() {
    const id = safetyState.selectedId;
    const item = getAllSafetyItems({ includeHidden: true }).find(x => x.id === id);
    if (!item) return;
    const rawExp = (document.getElementById('saf-f-exp')?.value || '').trim();
    const rawLast = (document.getElementById('saf-f-last')?.value || '').trim();
    const expYmd = window.GA_CORE.parseFlexibleRocDate(rawExp) || rawExp;
    const lastYmd = window.GA_CORE.parseFlexibleRocDate(rawLast) || rawLast;
    const rtnVal = document.getElementById('saf-f-rtn')?.value || '';
    const rec = {
      id,
      cert_no: (document.getElementById('saf-f-cert')?.value || '').trim(),
      inspector: (document.getElementById('saf-f-insp')?.value || '').trim(),
      last_check_date: lastYmd,
      expiry_date: expYmd,
      linked_routine_id: rtnVal,
      drive_url: (document.getElementById('saf-f-url')?.value || '').trim(),
      note: (document.getElementById('saf-f-note')?.value || '').trim()
    };
    await window.GA_CORE.extStore.upsert(SAFETY_KEY, id, rec, `法定安檢｜${item.name}｜效期 ${expYmd || '-'}`, id);
    toast(`✅ 已更新「${item.name}」合規證照資訊`);
  };

  function renderSafetyWallView(container) {
    const cards = buildSafetyCards();
    const hiddenCnt = getHiddenSafetyIds().size;
    const cur = cards.find(c => c.id === safetyState.selectedId) || cards[0] || null;
    if (cur) safetyState.selectedId = cur.id;
    const redCnt = cards.filter(c => c.statusTone === 'red').length;
    const ambCnt = cards.filter(c => c.statusTone === 'amber').length;
    const okCnt = cards.filter(c => c.statusTone === 'teal').length;
    const waitCnt = cards.filter(c => c.statusTone === 'gray').length;
    const routines = ((typeof appData !== 'undefined' && appData?.tables?.Annual_Routines) || []).filter(r => r.is_active !== false);

    container.innerHTML = `
      <div class="ga-split-shell" id="saf-module-root">
        <div class="vb-top-bar">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:18px;font-weight:800;color:var(--brand-primary,#7C4A21)">🛡️ 校園法定安檢與許可證合規牆</span>
            <span class="tag tag-green">🟢 合規有效 ${okCnt}/${cards.length}</span>
            ${ambCnt ? `<span class="tag tag-amber">🟡 30日內到期 ${ambCnt}</span>` : ''}
            ${redCnt ? `<span class="tag tag-red">🔴 已逾期 ${redCnt}</span>` : ''}
            ${waitCnt ? `<span class="tag tag-gray">⚪ 待設定效期 ${waitCnt}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn-sm" onclick="safOpenManageModal()">⚙️ 管理／隱藏不適用卡${hiddenCnt ? ` (已藏 ${hiddenCnt})` : ''}</button>
            <button type="button" class="btn-sm btn-primary" onclick="safOpenAddModal('')">＋ 新增安檢卡</button>
          </div>
        </div>

        <div class="ga-split-body" style="grid-template-columns: minmax(0, 1.85fr) minmax(320px, 0.95fr)">
          <!-- 左欄：2 欄對稱橫式證照卡網格（零直書擠壓、全卡四列對齊） -->
          <section class="panel ga-pane">
            <div class="saf-card-grid">
              ${cards.length ? cards.map(c => {
                const isSel = cur && c.id === cur.id;
                const tagCls = c.statusTone === 'red' ? 'tag-red' : c.statusTone === 'amber' ? 'tag-amber' : c.statusTone === 'teal' ? 'tag-green' : 'tag-gray';
                const dueColor = c.statusTone === 'red' ? '#DC2626' : c.statusTone === 'amber' ? '#B45309' : c.expiryYmd ? 'var(--text-primary,#1C1917)' : '#78716C';
                const infoLine = (c.saved.cert_no || c.saved.inspector)
                  ? `📄 ${c.saved.cert_no || '已登錄'}${c.saved.inspector ? '｜' + c.saved.inspector : ''}`
                  : c.linkedRtn
                  ? `🔗 例行：${c.linkedRtn.title}`
                  : '📝 點選於右側補登合格證號或效期';
                return `
                  <div class="saf-cert-card tone-${h(c.statusTone)} ${isSel ? 'is-selected' : ''}"
                       onclick="safSelectCard('${h(c.id)}')">
                    <div class="saf-card-r1">
                      <div class="saf-card-title" title="${h(c.name)}">${c.icon} ${h(c.name)}</div>
                      <div style="display:inline-flex;align-items:center;gap:5px;flex-shrink:0">
                        <span class="tag ${tagCls}">${h(c.shortStatus)}</span>
                        <button type="button" class="ga-card-dismiss" title="本校不適用或非本處室業務（點擊隱藏並移出合規分母）"
                                onclick="safHideCard('${h(c.id)}', event)">✕</button>
                      </div>
                    </div>

                    <div class="saf-card-r2">
                      <span class="saf-law-pill">${h(c.law)}</span>
                      <span class="saf-cycle-text" title="${h(c.cycleLabel)}">${h(c.cycleLabel)}</span>
                    </div>

                    <div class="saf-card-r3">
                      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${h(infoLine)}">${h(infoLine)}</span>
                      ${c.saved.drive_url
                        ? `<a href="${h(c.saved.drive_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="flex-shrink:0;color:var(--brand-primary,#7C4A21);font-weight:800;text-decoration:none">📂 證書↗</a>`
                        : c.linkedRtn
                        ? `<span style="flex-shrink:0;color:#0369A1;font-weight:700">自動勾稽</span>`
                        : ''}
                    </div>

                    <div class="saf-card-r4">
                      <span>下次期限：<strong class="num-mono" style="color:${dueColor}">${h(c.expiryYmd ? roc(c.expiryYmd) : '待設定')}</strong></span>
                      <span class="num-mono" style="color:var(--text-muted,#57534E)">最近檢測：${h(c.lastCheckYmd ? roc(c.lastCheckYmd) : '未填')}</span>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div class="empty-state" style="grid-column:1 / -1">
                  目前所有安檢卡片皆已設為隱藏。<br>
                  <button type="button" class="btn-sm" style="margin-top:8px" onclick="safOpenManageModal()">⚙️ 重新勾選要列管的安檢卡</button>
                </div>
              `}
            </div>
          </section>

          <!-- 右欄：選中安檢項目之合格證字號／例行綁定／雲端歸檔 -->
          <section class="panel ga-pane">
            ${cur ? `
              <div class="panel-hd" style="flex-wrap:wrap;gap:6px">
                <h3 style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cur.icon} ${h(cur.name)}</h3>
                <div style="display:inline-flex;gap:5px;flex-shrink:0">
                  <button type="button" class="btn-xs" onclick="safOpenAddModal('${h(cur.id)}')">✎ 改名／法規</button>
                  <button type="button" class="btn-xs" onclick="safHideCard('${h(cur.id)}')">✕ 不適用</button>
                </div>
              </div>
              <div class="ga-pane-scroll" style="padding:12px 14px">
                ${cur.linkedRtn ? `
                  <div style="padding:9px 12px;border-radius:10px;background:var(--brand-soft,#F5EDE3);border:1px solid var(--border-strong,#D6CBB9);margin-bottom:10px">
                    <div style="font-size:13.5px;font-weight:800;color:var(--brand-primary,#7C4A21)">🔗 已連動例行事務：${h(cur.linkedRtn.title)}</div>
                    <div class="item-meta num-mono" style="font-size:13px;margin-top:3px">本期應辦：${h(roc(cur.sch?.dueDate))} ｜ 上次完成：${h(cur.linkedRtn.last_done_cycle || '尚無')}</div>
                    <div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap">
                      <button type="button" class="btn-xs btn-primary" onclick="markRoutineDone('${h(cur.linkedRtn.routine_id)}','${h(cur.sch?.cycle || '')}')">✓ 完成本期申報打卡</button>
                      ${cur.linkedRtn.portal_url ? `<a class="btn-xs" style="text-decoration:none;border:1px solid #D6CBB9;padding:4px 8px;border-radius:6px;background:#fff;color:#1C1917;font-weight:700" href="${h(cur.linkedRtn.portal_url)}" target="_blank" rel="noopener">🌐 申報網站 ↗</a>` : ''}
                    </div>
                  </div>
                ` : ''}

                <div class="form-grid">
                  <div class="field full">
                    <label>🔗 綁定例行事務週期（選填，可自動帶入下次申報期限）</label>
                    <select id="saf-f-rtn">
                      <option value="" ${!cur.saved.linked_routine_id ? 'selected' : ''}>自動依關鍵字配對（${cur.linkedRtn && !cur.saved.linked_routine_id ? '已配對：' + h(cur.linkedRtn.title) : '無自動配對'}）</option>
                      <option value="__NONE__" ${cur.saved.linked_routine_id === '__NONE__' ? 'selected' : ''}>— 不綁定例行（純手動設定日期） —</option>
                      ${routines.map(r => `<option value="${h(r.routine_id)}" ${cur.saved.linked_routine_id === r.routine_id ? 'selected' : ''}>${h(r.title)}（${h(r.category || '例行')}）</option>`).join('')}
                    </select>
                  </div>
                  <div class="field full">
                    <label>合格證字號／申報受理文號</label>
                    <input id="saf-f-cert" type="text" value="${h(cur.saved.cert_no || '')}" placeholder="例：高市消安字第 11500XXXX 號">
                  </div>
                  <div class="field">
                    <label>最近檢測日（${h(cur.lastCheckYmd ? roc(cur.lastCheckYmd) : '未填')}）</label>
                    <input id="saf-f-last" type="date" value="${h(cur.saved.last_check_date || '')}">
                  </div>
                  <div class="field">
                    <label>下次應檢日（${h(cur.expiryYmd ? roc(cur.expiryYmd) : '待設定')}）</label>
                    <input id="saf-f-exp" type="date" value="${h(cur.saved.expiry_date || cur.expiryYmd || '')}">
                  </div>
                  <div class="field full">
                    <label>委外專業檢測機構／機電技師</label>
                    <input id="saf-f-insp" type="text" value="${h(cur.saved.inspector || '')}" placeholder="例：○○消防設備師事務所／○○機電顧問">
                  </div>
                  <div class="field full">
                    <label>合格證書／檢驗報告雲端連結 (Google Drive)</label>
                    <input id="saf-f-url" type="url" value="${h(cur.saved.drive_url || '')}" placeholder="https://drive.google.com/...">
                  </div>
                  <div class="field full">
                    <label>複查缺失改善或備註</label>
                    <textarea id="saf-f-note" rows="2" placeholder="記錄缺失改善期限或檢查重點...">${h(cur.saved.note || '')}</textarea>
                  </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
                  ${cur.saved.drive_url ? `<a href="${h(cur.saved.drive_url)}" target="_blank" rel="noopener" style="font-size:14px;font-weight:700;color:var(--brand-primary,#7C4A21)">📂 開啟證書掃描檔 ↗</a>` : '<span></span>'}
                  <button type="button" class="btn-primary" onclick="safSaveCert()">💾 儲存證照紀錄</button>
                </div>
              </div>
            ` : '<div class="empty-state">請選擇左側安檢項目</div>'}
          </section>
        </div>
      </div>
    `;
  }

  window.GA_CORE.registerModule({
    id: 'safety-wall',
    title: '法定安檢牆',
    navGroup: 'ops',
    icon: '🛡️',
    version: 'v2.2',
    getSummaryTile() {
      const cards = buildSafetyCards();
      const redCount = cards.filter(c => c.statusTone === 'red').length;
      const amberCount = cards.filter(c => c.statusTone === 'amber').length;
      const okCount = cards.filter(c => c.statusTone === 'teal').length;
      const nextDue = cards.filter(c => c.dLeft !== null).sort((a, b) => a.dLeft - b.dLeft)[0];
      return {
        id: 'safety-wall',
        icon: '🛡️',
        title: '法定安檢牆',
        kpi: `${okCount}/${cards.length}`,
        unit: '項有效合規',
        tone: redCount > 0 ? 'red' : amberCount > 0 ? 'amber' : 'teal',
        redCount,
        amberCount,
        subText: nextDue
          ? `最近：${nextDue.name.slice(0, 6)}（${nextDue.dLeft < 0 ? `逾期${Math.abs(nextDue.dLeft)}天` : `剩${nextDue.dLeft}天`}）`
          : '可自由隱藏不適用項目'
      };
    },
    renderView: renderSafetyWallView
  });

  // ==========================================================================
  // 【模組 F4】📦 設備履歷與耗材安全庫存 (asset-inv)
  // ==========================================================================
  const ASSET_KEY = 'ASSET_INV';
  const ASSET_META_KEY = 'ASSET_META';
  const DEFAULT_ASSETS = [
    { id: 'AST-0001', kind: '設備履歷', name: '全校冰溫熱飲水機', location: '各樓層走廊及辦公室', qty: 16, safety_qty: 16, unit: '台', note: '每季抽驗 1/4 台水質並更換濾心', is_sample: true },
    { id: 'AST-0002', kind: '設備履歷', name: '無障礙昇降機（電梯）', location: '主校舍東側 A 梯旁', qty: 1, safety_qty: 1, unit: '座', note: '每月定期保養並簽認紀錄表', is_sample: true },
    { id: 'AST-0003', kind: '庶務耗材', name: '公廁大捲筒衛生紙＆洗手乳', location: '總務處儲藏室', qty: 6, safety_qty: 5, unit: '箱', note: '建議優先採購環保標章／庇護工場品項', is_sample: true },
    { id: 'AST-0004', kind: '庶務耗材', name: '行政辦公室 A4 環保影印紙', location: '總務處器材室', qty: 8, safety_qty: 6, unit: '箱', note: '具環保標章（計入綠採分子）', is_sample: true }
  ];

  const assetState = { filter: 'ALL', editingId: '' };

  function getDeletedAssetIds() {
    const meta = window.GA_CORE.extStore.get(ASSET_META_KEY, 'MAIN') || {};
    return new Set(Array.isArray(meta.deletedIds) ? meta.deletedIds : []);
  }

  function getAssetsList() {
    const saved = window.GA_CORE.extStore.list(ASSET_KEY);
    const deleted = getDeletedAssetIds();
    const savedIds = new Set(saved.map(x => x.id));
    const defaultsLeft = DEFAULT_ASSETS.filter(d => !savedIds.has(d.id) && !deleted.has(d.id));
    return [...saved.filter(x => !deleted.has(x.id)), ...defaultsLeft];
  }

  window.astSelectEdit = function(id) {
    assetState.editingId = id || '';
    renderCurrentView();
  };

  window.astSetFilter = function(f) {
    assetState.filter = f;
    renderCurrentView();
  };

  window.astDeleteItem = async function(id, name) {
    if (assetState.editingId === id) assetState.editingId = '';
    const isDefault = DEFAULT_ASSETS.some(d => d.id === id);
    const existingSaved = window.GA_CORE.extStore.get(ASSET_KEY, id);
    if (isDefault) {
      const prevMeta = window.GA_CORE.extStore.get(ASSET_META_KEY, 'MAIN') || { deletedIds: [] };
      const prevDel = Array.isArray(prevMeta.deletedIds) ? prevMeta.deletedIds : [];
      const nextDel = [...new Set([...prevDel, id])];
      await window.GA_CORE.extStore.upsert(ASSET_META_KEY, 'MAIN', { id: 'MAIN', deletedIds: nextDel }, '設備耗材隱藏預設項', 'META');
      if (existingSaved) {
        await window.GA_CORE.extStore.remove(ASSET_KEY, id, name);
      } else {
        window.GA_CORE.pushUndoAction(`已移除預設項目「${name}」`, async () => {
          await window.GA_CORE.extStore.upsert(ASSET_META_KEY, 'MAIN', { id: 'MAIN', deletedIds: prevDel }, '設備耗材隱藏預設項', 'META');
        });
      }
    } else {
      await window.GA_CORE.extStore.remove(ASSET_KEY, id, name);
    }
  };

  window.astClearAllSamples = async function() {
    const prevMeta = window.GA_CORE.extStore.get(ASSET_META_KEY, 'MAIN') || { deletedIds: [] };
    const prevDel = Array.isArray(prevMeta.deletedIds) ? prevMeta.deletedIds : [];
    const nextDel = [...new Set([...prevDel, ...DEFAULT_ASSETS.map(d => d.id)])];
    await window.GA_CORE.extStore.upsert(ASSET_META_KEY, 'MAIN', { id: 'MAIN', deletedIds: nextDel }, '設備耗材隱藏預設項', 'META');
    window.GA_CORE.pushUndoAction('已清空 4 筆預設範例資料', async () => {
      await window.GA_CORE.extStore.upsert(ASSET_META_KEY, 'MAIN', { id: 'MAIN', deletedIds: prevDel }, '設備耗材隱藏預設項', 'META');
    });
  };

  window.astAdjustQty = async function(id, delta) {
    const list = getAssetsList();
    const cur = list.find(x => x.id === id);
    if (!cur) return;
    const nextQty = Math.max(0, (Number(cur.qty) || 0) + delta);
    const updated = { ...cur, qty: nextQty, is_sample: false };
    await window.GA_CORE.extStore.upsert(ASSET_KEY, id, updated, `${updated.kind}｜${updated.name} (${nextQty}${updated.unit})`, updated.kind);
    if (updated.kind === '設備履歷' && updated.linked_project_id) {
      toast(`⚠️ 設備數量已變更為 ${nextQty} ${updated.unit}！請確認關聯維護標案（${updated.linked_project_id}）各期保養金額是否需契約變更`);
    } else if (updated.kind === '庶務耗材' && nextQty <= Number(updated.safety_qty || 0)) {
      toast(`📦 「${updated.name}」庫存剩 ${nextQty}${updated.unit}，已達安全水位，建議列入小額綠採／優採請購`);
    }
  };

  window.astSaveForm = async function() {
    const name = (document.getElementById('ast-f-name')?.value || '').trim();
    if (!name) return toast('請輸入設備或耗材名稱');
    const id = assetState.editingId || window.GA_CORE.extStore.nextSeqId(ASSET_KEY, 'AST', 4);
    const prev = getAssetsList().find(x => x.id === id);
    const qty = Number(document.getElementById('ast-f-qty')?.value || 0);
    const rec = {
      id,
      kind: document.getElementById('ast-f-kind')?.value || '庶務耗材',
      name,
      location: (document.getElementById('ast-f-loc')?.value || '').trim(),
      qty,
      safety_qty: Number(document.getElementById('ast-f-safe')?.value || 0),
      unit: (document.getElementById('ast-f-unit')?.value || '件').trim(),
      linked_project_id: document.getElementById('ast-f-proj')?.value || '',
      note: (document.getElementById('ast-f-note')?.value || '').trim(),
      is_sample: false
    };
    assetState.editingId = '';
    // 若先前被標記刪除，解除刪除標記
    const delSet = getDeletedAssetIds();
    if (delSet.has(id)) {
      delSet.delete(id);
      await window.GA_CORE.extStore.upsert(ASSET_META_KEY, 'MAIN', { id: 'MAIN', deletedIds: [...delSet] }, '設備耗材隱藏預設項', 'META');
    }
    await window.GA_CORE.extStore.upsert(ASSET_KEY, id, rec, `${rec.kind}｜${rec.name} (${rec.qty}${rec.unit})`, rec.kind);
    if (prev && prev.qty !== qty && rec.linked_project_id) {
      toast(`💡 貼心提醒：「${rec.name}」數量由 ${prev.qty} 變更為 ${qty}，請同步檢視關聯維護契約單價！`);
    } else {
      toast(`✅ 已儲存「${rec.name}」`);
    }
  };

  function renderAssetInvView(container) {
    const all = getAssetsList();
    const hasSamples = all.some(a => a.is_sample);
    const lowStock = all.filter(a => a.kind === '庶務耗材' && Number(a.qty) <= Number(a.safety_qty || 0));
    let shown = all;
    if (assetState.filter === 'EQUIP') shown = all.filter(a => a.kind === '設備履歷');
    if (assetState.filter === 'SUPPLY') shown = all.filter(a => a.kind === '庶務耗材');
    if (assetState.filter === 'LOW') shown = lowStock;

    const editing = assetState.editingId ? all.find(x => x.id === assetState.editingId) : null;
    const projs = ((typeof appData !== 'undefined' && appData?.tables?.Projects) || []).filter(p => !['已結案', '廢標撤案'].includes(p.status));

    container.innerHTML = `
      <div class="ga-split-shell" id="ast-module-root">
        <div class="vb-top-bar">
          <div>
            <span style="font-size:18px;font-weight:800;color:var(--brand-primary,#7C4A21)">📦 重要設備履歷與庶務耗材安全庫存</span>
            <span style="font-size:14px;color:var(--text-muted,#57534E);margin-left:8px">用不到的預設範例可直接刪除，不會自動復活</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span class="tag tag-blue">列管 ${all.length} 項</span>
            ${lowStock.length ? `<span class="tag tag-amber">⚠️ 待補貨 ${lowStock.length} 項</span>` : '<span class="tag tag-green">庫存充足 ✓</span>'}
            ${hasSamples ? `<button type="button" class="btn-xs" onclick="astClearAllSamples()">🧹 一鍵清空預設範例</button>` : ''}
          </div>
        </div>

        <div class="ga-split-body" style="grid-template-columns: minmax(0, 1.5fr) minmax(340px, 1fr)">
          <section class="panel ga-pane">
            <div class="sp-filter-bar" style="border-top:none;border-bottom:1px solid var(--border-subtle,#E7DFD3)">
              <div class="sp-tabs">
                <button type="button" class="sp-tab ${assetState.filter === 'ALL' ? 'active' : ''}" onclick="astSetFilter('ALL')">全部 (${all.length})</button>
                <button type="button" class="sp-tab ${assetState.filter === 'EQUIP' ? 'active' : ''}" onclick="astSetFilter('EQUIP')">🔧 設備履歷</button>
                <button type="button" class="sp-tab ${assetState.filter === 'SUPPLY' ? 'active' : ''}" onclick="astSetFilter('SUPPLY')">🧻 庶務耗材</button>
                <button type="button" class="sp-tab ${assetState.filter === 'LOW' ? 'active' : ''}" onclick="astSetFilter('LOW')">⚠️ 待補貨 (${lowStock.length})</button>
              </div>
            </div>
            <div class="ga-pane-scroll">
              ${shown.length ? `
                <table class="sp-table">
                  <thead><tr><th>類別</th><th>設備／耗材名稱與放置地點</th><th>目前數量</th><th>連動維護契約</th><th style="text-align:right">盤點與刪除</th></tr></thead>
                  <tbody>
                    ${shown.map(a => {
                      const isLow = a.kind === '庶務耗材' && Number(a.qty) <= Number(a.safety_qty || 0);
                      return `
                        <tr>
                          <td><span class="tag ${a.kind === '設備履歷' ? 'tag-blue' : 'tag-amber'}">${h(a.kind)}</span></td>
                          <td>
                            <div style="font-size:16px;font-weight:700">${h(a.name)} ${a.is_sample ? '<span class="tag tag-gray">範例</span>' : ''}</div>
                            <div class="item-meta">📍 ${h(a.location || '-')}｜${h(a.note || '')}</div>
                          </td>
                          <td class="num-mono" style="white-space:nowrap;font-size:15px;font-weight:800">
                            <span style="color:${isLow ? '#DC2626' : '#1C1917'}">${a.qty} ${h(a.unit)}</span>
                            ${a.kind === '庶務耗材' ? `<span class="item-meta">（安全量 ${a.safety_qty}）</span>` : ''}
                            ${isLow ? '<div><span class="tag tag-red">建議補貨</span></div>' : ''}
                          </td>
                          <td style="white-space:nowrap">
                            ${a.linked_project_id ? `<button type="button" class="btn-xs" onclick="openProjectDetail('${h(a.linked_project_id)}')">🔗 ${h(a.linked_project_id)}</button>` : '<span class="item-meta">未綁定</span>'}
                          </td>
                          <td style="text-align:right;white-space:nowrap">
                            <button type="button" class="btn-xs" onclick="astAdjustQty('${h(a.id)}', -1)">－1</button>
                            <button type="button" class="btn-xs" onclick="astAdjustQty('${h(a.id)}', 1)">＋1</button>
                            <button type="button" class="btn-xs" onclick="astSelectEdit('${h(a.id)}')">✎</button>
                            <button type="button" class="btn-xs" title="刪除此項目（可復原）" onclick="astDeleteItem('${h(a.id)}','${h(a.name)}')">🗑️</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              ` : '<div class="empty-state">尚無列管之設備或耗材，可由右側表單自由新增。</div>'}
            </div>
          </section>

          <section class="panel ga-pane">
            <div class="panel-hd">
              <h3>${editing ? `✎ 編輯：${h(editing.name)}` : '＋ 新增設備履歷或耗材'}</h3>
              ${editing ? `<button type="button" class="btn-xs" onclick="astSelectEdit('')">取消</button>` : ''}
            </div>
            <div class="ga-pane-scroll" style="padding:12px 14px">
              <div class="form-grid">
                <div class="field">
                  <label>項目類別</label>
                  <select id="ast-f-kind">
                    <option value="庶務耗材" ${editing?.kind === '庶務耗材' ? 'selected' : ''}>🧻 庶務耗材（庫存預警）</option>
                    <option value="設備履歷" ${editing?.kind === '設備履歷' ? 'selected' : ''}>🔧 設備履歷（維護契約）</option>
                  </select>
                </div>
                <div class="field">
                  <label>單位</label>
                  <input id="ast-f-unit" type="text" value="${h(editing?.unit || '箱')}" placeholder="台 / 箱 / 支">
                </div>
                <div class="field full">
                  <label>設備或耗材名稱 *</label>
                  <input id="ast-f-name" type="text" value="${h(editing?.name || '')}" placeholder="例：走廊冰溫熱飲水機、環保捲筒衛生紙">
                </div>
                <div class="field">
                  <label>目前盤點數量</label>
                  <input id="ast-f-qty" type="number" min="0" value="${h(editing?.qty ?? 1)}">
                </div>
                <div class="field">
                  <label>安全庫存水位（低於預警）</label>
                  <input id="ast-f-safe" type="number" min="0" value="${h(editing?.safety_qty ?? 2)}">
                </div>
                <div class="field full">
                  <label>放置地點／棟別樓層</label>
                  <input id="ast-f-loc" type="text" value="${h(editing?.location || '')}" placeholder="例：主棟 1F～3F、總務處儲藏室">
                </div>
                <div class="field full">
                  <label>關聯維護保養標案（設備台數增減時提醒契約變更）</label>
                  <select id="ast-f-proj">
                    <option value="">— 無關聯標案 —</option>
                    ${projs.map(p => `<option value="${h(p.project_id)}" ${editing?.linked_project_id === p.project_id ? 'selected' : ''}>${h(p.project_id)}｜${h(window.GA_CORE.formatSmartTitle(p.project_name).cleanTitle)}</option>`).join('')}
                  </select>
                </div>
                <div class="field full">
                  <label>規格型號／採購備註</label>
                  <textarea id="ast-f-note" rows="2">${h(editing?.note || '')}</textarea>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
                <button type="button" class="btn-sm" onclick="switchTab('statutory-proc')">🧾 前往小額綠優採請購 →</button>
                <button type="button" class="btn-primary" onclick="astSaveForm()">💾 儲存項目</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  window.GA_CORE.registerModule({
    id: 'asset-inv',
    title: '設備與耗材',
    navGroup: 'assets',
    icon: '📦',
    version: 'v2.1',
    renderView: renderAssetInvView
  });
})();
