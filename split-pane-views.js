/**
 * ============================================================================
 * 總務行政戰情助理 — 全業務子分頁「100dvh 零捲動左右雙欄工作台」升級模組
 * 檔案：split-pane-views.js
 * 遵循規範：UI_DESIGN_RULES.md §1.3, §2.2, §3.1–§3.5
 *
 * 涵蓋子頁：
 * 1. 採購與工程（清單預覽雙欄 ＋ 標案詳情「左階段樹 × 右 16px 單一階段工作台」＋ 條件式工具列 ＋ 母子案勾稽）
 * 2. 例行與續約（左分組清單 × 右 SOP 作業台 ↔ 1～12 月負荷矩陣 ＋ ⚡ 年末批次續約開案精靈）
 * 3. 太陽能租賃（修正本年應收 KPI 整合繳納時程 ＋ 左契約卡 × 右時程對帳／雙保險／保證金同屏控管）
 * 4. 水電費監控（頂部單列篩選預算條 ＋ 左 55% 同期對照圖與需量警示 × 右 45% 帳單異常表）
 * 5. 全校甘特圖 & 標案模板（鎖定 100dvh 內部捲動容器，全站零外層捲軸）
 * ============================================================================
 */

(function initSplitPaneViews() {
  if (!window.GA_CORE) return;

  const h = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const roc = (ymd, opts) => window.GA_CORE.formatRocDate(ymd, opts);
  const smart = raw => window.GA_CORE.formatSmartTitle(raw);

  const spvState = {
    projFilter: 'TENDER', // TENDER | MICRO | 工程 | 勞務 | 財物 | ALL
    projPage: 1,
    previewProjId: '',
    stageByProject: {},
    rtnMode: 'SPLIT',     // SPLIT | MATRIX
    rtnBucket: 'SOON',    // SOON | DAYS30 | RENEWAL | ALL | INACTIVE
    rtnSelectedId: '',
    solarActiveId: '',
    ganttTrackFilter: 'TENDER' // TENDER | MICRO | ALL
  };

  window.spvDismissPreset = async function(presetId, label = '範本提示') {
    const prefs = window.GA_CORE.getUiPrefs();
    if (prefs.dismissedPresets.includes(presetId)) return;
    await window.GA_CORE.updateUiPrefs(
      { dismissedPresets: [...prefs.dismissedPresets, presetId] },
      `已隱藏「${label}」提示按鈕`
    );
  };

  window.toggleProjectTrack = async function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return;
    const prevFlagsJson = p.flags_json;
    const wasMicro = window.GA_CORE.isMicroPurchaseProject(p);
    const nextTrack = wasMicro ? 'TENDER' : 'MICRO';
    const flg = { ...parseJSON(p.flags_json, {}), proc_track: nextTrack };
    if (nextTrack === 'MICRO') delete flg.exclude_from_sp_ledger;
    p.flags_json = JSON.stringify(flg);
    p.updated_at = nowStr();
    persistCache();
    renderCurrentView();
    await pushToCloud({ action: 'upsert', table: 'Projects', record: p });
    const labelTxt = nextTrack === 'MICRO' ? '🔧 小額分期契約' : '🏛️ 上網招標案';
    window.GA_CORE.pushUndoAction(`已將「${smart(p.project_name).cleanTitle}」改列為 ${labelTxt}`, async () => {
      p.flags_json = prevFlagsJson;
      p.updated_at = nowStr();
      persistCache();
      renderCurrentView();
      await pushToCloud({ action: 'upsert', table: 'Projects', record: p });
    });
  };

  window.spvOpenTenderWizard = function() {
    if (typeof openProjectWizard !== 'function') return;
    openProjectWizard();
    setTimeout(() => {
      const tierEl = document.getElementById('wiz-tier');
      if (tierEl && tierEl.value === '小額(15萬以下)') {
        tierEl.value = '未達(15-150萬)';
        if (typeof refreshWizardAwardOptions === 'function') refreshWizardAwardOptions('最低標');
        if (typeof refreshWizardProjectId === 'function') refreshWizardProjectId();
      }
    }, 50);
  };

  // ==========================================================================
  // 1. 採購與工程：母子關聯標案設定彈窗 + 8 秒復原檢核刪除
  // ==========================================================================
  window.openLinkProjectModal = function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return;
    const flg = parseJSON(p.flags_json, {});
    const others = (appData.tables.Projects || []).filter(x => x.project_id !== projectId && x.status !== '廢標撤案');
    openModal('🔗 設定母子／前後階段關聯標案', `
      <div class="gate-banner amber" style="margin-bottom:12px;font-size:14px">
        💡 例如將<strong>「委託設計監造技術服務勞務案」</strong>與<strong>「主體整建工程案」</strong>互相綁定，即可在雙欄標案工作台頂部一鍵互跳，同步掌握設計審查與工程發包死線！
      </div>
      <div class="field full">
        <label>選擇關聯標案</label>
        <select id="lp-target-id" style="font-size:15px;padding:8px 10px">
          <option value="">— 取消關聯 —</option>
          ${others.map(o => `<option value="${h(o.project_id)}" ${flg.linked_project_id === o.project_id ? 'selected' : ''}>[${h(o.fiscal_year || '')}] ${h(o.project_name)}（${h(o.project_id)}）</option>`).join('')}
        </select>
      </div>
      <div class="field full" style="margin-top:10px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
          <input type="checkbox" id="lp-two-way" checked style="width:16px;height:16px">
          同步於對方標案建立雙向互跳連結
        </label>
      </div>
    `, `<button onclick="closeModal()">取消</button><button class="btn-primary" onclick="saveLinkedProject('${h(projectId)}')">💾 儲存關聯設定</button>`);
  };

  window.saveLinkedProject = async function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return;
    const targetId = document.getElementById('lp-target-id')?.value || '';
    const twoWay = !!document.getElementById('lp-two-way')?.checked;
    const flg = { ...parseJSON(p.flags_json, {}), linked_project_id: targetId };
    p.flags_json = JSON.stringify(flg);
    p.updated_at = nowStr();
    const toPush = [p];

    if (twoWay && targetId) {
      const other = (appData.tables.Projects || []).find(x => x.project_id === targetId);
      if (other) {
        const oflg = { ...parseJSON(other.flags_json, {}), linked_project_id: projectId };
        other.flags_json = JSON.stringify(oflg);
        other.updated_at = nowStr();
        toPush.push(other);
      }
    }
    persistCache();
    closeModal();
    renderCurrentView();
    await pushToCloud({ action: 'batchUpsert', items: [{ table: 'Projects', records: toPush }] });
    toast(targetId ? '🔗 已建立母子標案雙向關聯！' : '已解除關聯標案');
  };

  // 包裝 removeCheckItem 提供 8 秒復原，免彈原生 confirm 打斷節奏
  if (typeof window.removeCheckItem === 'function' && !window.removeCheckItem.__gaUndoWrapped) {
    const wrappedRemoveChk = async function(taskId, idx) {
      const t = (appData.tables.Project_Tasks || []).find(x => x.task_id === taskId);
      if (!t) return;
      const prevJson = t.checklist_json;
      const items = parseJSON(prevJson, []);
      const removed = items[idx];
      if (!removed) return;
      items.splice(idx, 1);
      t.checklist_json = JSON.stringify(items);
      t.updated_at = nowStr();
      persistCache();
      renderCurrentView();
      await pushToCloud({ action: 'upsert', table: 'Project_Tasks', record: t });
      window.GA_CORE.pushUndoAction(`已移除檢核項「${String(removed.text || '').slice(0, 18)}」`, async () => {
        t.checklist_json = prevJson;
        t.updated_at = nowStr();
        persistCache();
        renderCurrentView();
        await pushToCloud({ action: 'upsert', table: 'Project_Tasks', record: t });
      });
    };
    wrappedRemoveChk.__gaUndoWrapped = true;
    window.removeCheckItem = wrappedRemoveChk;
  }

  window.spvSetProjFilter = function(f) { spvState.projFilter = f; spvState.projPage = 1; renderCurrentView(); };
  window.spvSetProjPage = function(p) { spvState.projPage = Math.max(1, p); renderCurrentView(); };
  window.spvPreviewProj = function(pid) { spvState.previewProjId = pid; renderCurrentView(); };
  window.spvSelectStage = function(projectId, taskId) {
    spvState.stageByProject[projectId] = taskId;
    renderCurrentView();
  };

  function renderSplitProjectsListHTML() {
    const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
    const all = (appData.tables.Projects || [])
      .filter(p => !q || `${p.project_name} ${p.project_id} ${p.vendor_name || ''} ${p.procurement_type || ''}`.toLowerCase().includes(q))
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));

    const activeAll = all.filter(p => !['已結案', '廢標撤案'].includes(p.status));
    const tenderActive = activeAll.filter(p => window.GA_CORE.isFormalTenderProject(p));
    const microActive = activeAll.filter(p => window.GA_CORE.isMicroPurchaseProject(p));

    let filtered = tenderActive;
    if (spvState.projFilter === 'TENDER') filtered = tenderActive;
    else if (spvState.projFilter === 'MICRO') filtered = microActive;
    else if (spvState.projFilter === 'ALL') filtered = all;
    else if (['工程', '勞務', '財物'].includes(spvState.projFilter)) {
      filtered = tenderActive.filter(p => p.procurement_type === spvState.projFilter);
    }

    const pageSize = window.innerHeight < 710 ? 5 : 7;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (spvState.projPage > totalPages) spvState.projPage = totalPages;
    const pageRows = filtered.slice((spvState.projPage - 1) * pageSize, spvState.projPage * pageSize);

    if (!spvState.previewProjId || !filtered.some(p => p.project_id === spvState.previewProjId)) {
      spvState.previewProjId = pageRows[0]?.project_id || filtered[0]?.project_id || '';
    }
    const curP = all.find(p => p.project_id === spvState.previewProjId) || null;
    const curTasks = curP ? getProjectTasks(curP.project_id) : [];
    const curProg = curP ? calcProjectProgress(curP.project_id) : null;
    const curFlg = curP ? parseJSON(curP.flags_json, {}) : {};
    const curIsMicro = curP ? window.GA_CORE.isMicroPurchaseProject(curP) : false;
    const linkedP = curFlg.linked_project_id ? (appData.tables.Projects || []).find(x => x.project_id === curFlg.linked_project_id) : null;

    return `
      <div class="ga-split-shell">
        <div class="vb-top-bar">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:18px;font-weight:800;color:var(--brand-primary,#7C4A21)">🏛️ 上網招標與採購履約工作台</span>
            <div class="sp-tabs">
              ${[
                ['TENDER', `🏛️ 上網招標案 (${tenderActive.length})`],
                ['MICRO', `🔧 小額分期契約 (${microActive.length})`],
                ['工程', '🏗️ 工程'],
                ['勞務', '🤝 勞務'],
                ['財物', '📦 財物'],
                ['ALL', `📚 含結案全部 (${all.length})`]
              ].map(([k, lbl]) => `<button type="button" class="sp-tab ${spvState.projFilter === k ? 'active' : ''}" onclick="spvSetProjFilter('${k}')">${lbl}</button>`).join('')}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn-sm" onclick="switchTab('statutory-proc')">🧾 小額與綠優採台帳 →</button>
            <button type="button" class="btn-sm" onclick="switchTab('annual-gantt')">📅 全校甘特圖</button>
            ${spvState.projFilter === 'MICRO'
              ? `<button type="button" class="btn-sm btn-primary" onclick="if(window.spOpenMicroProjectWizard)spOpenMicroProjectWizard();else openProjectWizard()">＋ 開小額分期契約</button>`
              : `<button type="button" class="btn-sm btn-primary" onclick="spvOpenTenderWizard()">＋ 開新上網招標案</button>`}
          </div>
        </div>

        <div class="ga-split-body" style="grid-template-columns: minmax(0, 1.45fr) minmax(350px, 1fr)">
          <!-- 左欄：標案分頁清單 -->
          <section class="panel ga-pane">
            <div class="sp-filter-bar" style="border-top:none;border-bottom:1px solid var(--border-subtle,#E7DFD3)">
              <span style="font-size:13.5px;font-weight:700;color:var(--text-secondary,#44403C)">
                ${spvState.projFilter === 'MICRO'
                  ? '🔧 目前顯示 15 萬以下小額逕洽／分期維護契約（已與上網招標案分流，並自動連動小額綠優採台帳）'
                  : '🏛️ 預設僅顯示需上網公告之正式招標案（15 萬以上公開取得／公開招標），零星小額採購不混入干擾'}
              </span>
              <div class="sp-pager num-mono">
                <button type="button" class="btn-xs" ${spvState.projPage <= 1 ? 'disabled' : ''} onclick="spvSetProjPage(${spvState.projPage - 1})">◀</button>
                <span>${spvState.projPage} / ${totalPages}</span>
                <button type="button" class="btn-xs" ${spvState.projPage >= totalPages ? 'disabled' : ''} onclick="spvSetProjPage(${spvState.projPage + 1})">▶</button>
              </div>
            </div>
            <div class="ga-pane-scroll" style="padding:10px 12px;display:flex;flex-direction:column;gap:8px">
              ${pageRows.length ? pageRows.map(p => {
                const sm = smart(p.project_name);
                const prog = calcProjectProgress(p.project_id);
                const flg = parseJSON(p.flags_json, {});
                const isMicro = window.GA_CORE.isMicroPurchaseProject(p);
                const isSel = curP && curP.project_id === p.project_id;
                const caseNo = typeof formatProjectCaseNo === 'function' ? formatProjectCaseNo(p) : p.project_id;
                return `
                  <div class="spv-list-card ${isSel ? 'is-selected' : ''}"
                       onclick="spvPreviewProj('${h(p.project_id)}')"
                       ondblclick="openProjectDetail('${h(p.project_id)}')"
                       title="${h(sm.fullTitle)}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        <span class="tag ${isMicro ? 'tag-amber' : 'tag-blue'}">${isMicro ? '🔧 小額契約' : '🏛️ 上網招標'}</span>
                        <span class="tag tag-gray num-mono">${h(caseNo)}</span>
                        ${sm.yearBadge ? `<span class="tag tag-amber num-mono">${h(sm.yearBadge)}年</span>` : ''}
                        <span class="tag tag-gray">${h(p.procurement_type)}・${h(p.award_method || p.threshold_tier || '')}</span>
                        ${flg.linked_project_id ? '<span class="tag tag-green">🔗 母子連動</span>' : ''}
                      </div>
                      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                        <span class="num-mono" style="font-size:15px;font-weight:800;color:var(--brand-accent,#0D9488)">${prog.pct}%</span>
                        <button type="button" class="btn-xs btn-primary" onclick="event.stopPropagation();openProjectDetail('${h(p.project_id)}')">進入工作台 →</button>
                      </div>
                    </div>
                    <div style="font-size:16px;font-weight:800;color:var(--text-primary,#1C1917);margin-top:5px">${h(sm.cleanTitle)}</div>
                    <div class="item-meta" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13.5px">
                      <span>當前階段：<strong>${h(prog.currentStage)}</strong>（檢核 ${prog.doneChecks}/${prog.totalChecks}）</span>
                      <span class="num-mono">${p.award_amount ? `決標 ${fmtMoney(p.award_amount)}` : `預算 ${fmtMoney(p.budget_amount)}`}${p.grant_deadline ? `｜<strong style="color:#DC2626">死線 ${roc(p.grant_deadline)}</strong>` : ''}</span>
                    </div>
                  </div>
                `;
              }).join('') : `<div class="empty-state">目前「${spvState.projFilter === 'MICRO' ? '小額分期契約' : '上網招標案'}」分類下沒有符合條件的案件。</div>`}
            </div>
          </section>

          <!-- 右欄：選中標案摘要與階段快覽 -->
          <section class="panel ga-pane">
            ${curP ? `
              <div class="panel-hd">
                <h3>🔍 案件快覽：${h(smart(curP.project_name).cleanTitle)}</h3>
                <button type="button" class="btn-sm btn-primary" onclick="openProjectDetail('${h(curP.project_id)}')">開啟雙欄檢核台 →</button>
              </div>
              <div class="ga-pane-scroll" style="padding:12px 14px;display:flex;flex-direction:column;gap:10px">
                <div style="padding:10px 12px;border-radius:10px;background:var(--bg-subtle,#FAF6F0);border:1px solid var(--border-subtle,#E7DFD3)">
                  <div style="font-size:13.5px;color:var(--text-secondary,#44403C)">法定全銜：<strong>${h(curP.project_name)}</strong></div>
                  <div class="item-meta" style="font-size:13.5px;margin-top:4px">
                    屬性：<strong>${curIsMicro ? '🔧 小額採購／逕洽契約' : '🏛️ 上網招標標案'}</strong>（${h(curP.threshold_tier || '-')}・${h(curP.award_method || '-')}）
                  </div>
                  <div class="item-meta" style="font-size:13.5px;margin-top:3px">
                    預算 <strong>${fmtMoney(curP.budget_amount)}</strong> ｜ 決標 <strong>${curP.award_amount ? fmtMoney(curP.award_amount) : '尚未決標'}</strong> ｜ 廠商 <strong>${h(curP.vendor_name || '待決標')}</strong>
                  </div>
                  ${linkedP ? `<div style="margin-top:6px"><button type="button" class="btn-xs" onclick="openProjectDetail('${h(linkedP.project_id)}')">🔗 跳至關聯案：${h(smart(linkedP.project_name).cleanTitle)} →</button></div>` : ''}
                  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
                    <button type="button" class="btn-xs" onclick="openDocCopilotModal({tplId:'REQ_SIGN',title:'${h(curP.project_name)}',vendor:'${h(curP.vendor_name || '')}',amount:'${h(curP.award_amount || curP.budget_amount || '')}',dueDate:'${h(curP.orig_end_date || '')}'})">📝 產生簽呈／驗收稿</button>
                    <button type="button" class="btn-xs" onclick="openLinkProjectModal('${h(curP.project_id)}')">🔗 母子關聯</button>
                    <button type="button" class="btn-xs" onclick="toggleProjectTrack('${h(curP.project_id)}')" title="一鍵切換此案屬於「上網招標案」或「小額分期契約」">${curIsMicro ? '⇄ 改列上網招標案' : '⇄ 改列小額契約'}</button>
                    <button type="button" class="btn-xs" onclick="openEditProjectModal('${h(curP.project_id)}')">✎ 編輯主檔</button>
                    <button type="button" class="btn-xs" style="color:#B91C1C" onclick="deleteProject('${h(curP.project_id)}')">🗑️ 刪除案件</button>
                  </div>
                </div>

                <div style="font-size:14px;font-weight:800;color:var(--brand-primary,#7C4A21)">📌 階段進度軸（共 ${curTasks.length} 階段・完成 ${curProg.pct}%）</div>
                ${curTasks.map(t => {
                  const chks = parseJSON(t.checklist_json, []);
                  const done = chks.filter(c => c.done).length;
                  return `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:8px;border:1px solid var(--border-subtle,#E7DFD3);background:#fff;cursor:pointer"
                         onclick="spvState.stageByProject['${h(curP.project_id)}']='${h(t.task_id)}';openProjectDetail('${h(curP.project_id)}')">
                      <div style="min-width:0">
                        <div style="font-size:14.5px;font-weight:700">${t.stage_order}. ${h(t.stage_name)}</div>
                        <div class="item-meta num-mono">${t.plan_end ? `預定迄 ${roc(t.plan_end)}` : ''}${t.sla_deadline ? `｜🔴 死線 ${roc(t.sla_deadline)}` : ''}</div>
                      </div>
                      <span class="tag ${t.status === '已完成' ? 'tag-green' : t.status === '進行中' ? 'tag-blue' : t.status === '缺件卡關' ? 'tag-red' : 'tag-gray'}">${h(t.status)} ${done}/${chks.length}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : '<div class="empty-state">請點選左側標案預覽詳情</div>'}
          </section>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 2. 採購標案詳情頁：終結 4,210px 長捲動 → 左 285px 階段樹 × 右單一階段 16px 工作台
  // ==========================================================================
  const _legacyRenderProjectDetail = renderProjectDetailHTML;

  renderProjectDetailHTML = function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return renderSplitProjectsListHTML();

    const tasks = getProjectTasks(projectId);
    const prog = calcProjectProgress(projectId);
    const sm = smart(p.project_name);
    const flg = parseJSON(p.flags_json, {});
    const isEng = p.procurement_type === '工程' || p.engineering_category === '一般公共工程' || p.engineering_category === '公有建築物';
    const billings = (appData.tables.Project_Billings || []).filter(b => b.project_id === projectId);
    const isMaintOrService = !isEng && (!!flg.is_maintenance || p.procurement_type === '勞務' || billings.length > 0);
    const showMaintScheduleTools = !!flg.is_maintenance || p.procurement_type === '勞務';
    const eng = (isEng && typeof calcEngineeringSummary === 'function') ? calcEngineeringSummary(projectId) : null;
    const linkedP = flg.linked_project_id ? (appData.tables.Projects || []).find(x => x.project_id === flg.linked_project_id) : null;
    const isMicro = window.GA_CORE.isMicroPurchaseProject(p);
    const uiPrefs = window.GA_CORE.getUiPrefs();

    // 雲端核定期程範本檢查（支援使用者按 ✕ 隱藏提示）
    const cloudPresets = window.GA_CORE.getCloudPresets('PROJECT_TIMELINE');
    const matchedPreset = cloudPresets.find(pr => typeof pr.match === 'function' && pr.match(p));
    const presetDismissKey = matchedPreset ? `PRJ:${matchedPreset.key}:${p.project_id}` : '';
    let showPresetBtn = false;
    if (matchedPreset && Array.isArray(matchedPreset.stages) && !uiPrefs.dismissedPresets.includes(presetDismissKey)) {
      const existingNames = new Set(tasks.map(t => String(t.stage_name || '').replace(/\s+/g, '')));
      const missingCnt = matchedPreset.stages.filter(s => !existingNames.has(String(s.name || '').replace(/\s+/g, ''))).length;
      showPresetBtn = missingCnt > 0;
    }

    // 自動選中「進行中／缺件卡關／第一個未完成」階段
    let activeTaskId = spvState.stageByProject[projectId];
    if (!activeTaskId || !tasks.some(t => t.task_id === activeTaskId)) {
      const activeStage = tasks.find(t => t.status === '缺件卡關')
        || tasks.find(t => t.status === '進行中')
        || tasks.find(t => t.status !== '已完成')
        || tasks[0];
      activeTaskId = activeStage ? activeStage.task_id : '';
      spvState.stageByProject[projectId] = activeTaskId;
    }
    const curIdx = tasks.findIndex(t => t.task_id === activeTaskId);
    const curTask = curIdx >= 0 ? tasks[curIdx] : tasks[0];

    // 非 checklist 子頁籤（材料送審、附表二、變更設計、分期計價、單案甘特圖）委派原模組渲染並包進 100dvh 內部捲動框
    let nonChecklistBodyHTML = '';
    if (selectedProjectSubtab !== 'checklist') {
      const rawLegacy = _legacyRenderProjectDetail(projectId);
      const tmp = document.createElement('div');
      tmp.innerHTML = rawLegacy;
      const subtabEl = tmp.querySelector('.eng-subtabs') || Array.from(tmp.children).find(el => el.innerHTML && el.innerHTML.includes('selectedProjectSubtab'));
      if (subtabEl) {
        let next = subtabEl.nextElementSibling;
        const chunks = [];
        while (next) {
          chunks.push(next.outerHTML);
          next = next.nextElementSibling;
        }
        nonChecklistBodyHTML = chunks.join('');
      } else {
        nonChecklistBodyHTML = rawLegacy;
      }
    }

    const caseNo = typeof formatProjectCaseNo === 'function' ? formatProjectCaseNo(p) : p.project_id;

    return `
      <div class="ga-split-shell" id="spv-project-detail">
        <!-- 頂部精簡案頭橫幅 ＋ 條件式精準工具列 -->
        <div class="spv-proj-header">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap">
            <button type="button" class="btn-sm" onclick="selectedProjectId=null;renderCurrentView()">← 返回清單</button>
            <span class="tag ${isMicro ? 'tag-amber' : 'tag-blue'}" style="cursor:pointer" title="點此切換「上網招標案」或「小額分期契約」分類" onclick="toggleProjectTrack('${h(p.project_id)}')">${isMicro ? '🔧 小額契約 ⇄' : '🏛️ 上網招標 ⇄'}</span>
            <span class="tag tag-gray num-mono">${h(caseNo)}</span>
            <span class="tag tag-blue">${h(p.procurement_type)}・${h(p.status)}</span>
            <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text-primary,#1C1917)" title="${h(p.project_name)}">${h(sm.cleanTitle)}</h2>
            ${linkedP
              ? `<button type="button" class="btn-xs" style="background:#ECFDF5;border-color:#6EE7B7;color:#047857;font-weight:800" onclick="openProjectDetail('${h(linkedP.project_id)}')">🔗 互跳關聯案：${h(smart(linkedP.project_name).cleanTitle)} →</button>`
              : `<button type="button" class="btn-xs" onclick="openLinkProjectModal('${h(p.project_id)}')">🔗 綁定母子案</button>`}
          </div>

          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="num-mono" style="font-size:14px;font-weight:800;color:var(--brand-accent,#0D9488);margin-right:4px">進度 ${prog.pct}% (${prog.doneChecks}/${prog.totalChecks})</span>
            ${showPresetBtn ? `
              <span style="display:inline-flex;align-items:center;gap:3px">
                <button type="button" class="btn-sm btn-primary" onclick="openTimelinePresetModal('${h(p.project_id)}','${h(matchedPreset.key)}')">📅 匯入核定期程</button>
                <button type="button" class="btn-xs" title="隱藏此期程提示" onclick="spvDismissPreset('${h(presetDismissKey)}','匯入核定期程')">✕</button>
              </span>
            ` : ''}
            <button type="button" class="btn-sm" onclick="openDocCopilotModal({tplId:'REQ_SIGN',title:'${h(p.project_name)}',vendor:'${h(p.vendor_name || '')}',amount:'${h(p.award_amount || p.budget_amount || '')}',dueDate:'${h(p.orig_end_date || '')}'})">📝 公文草稿</button>
            <button type="button" class="btn-sm" onclick="openEditProjectModal('${h(p.project_id)}')">✎ 基本資料</button>
            ${showMaintScheduleTools && typeof openBatchScheduleModal === 'function' ? `<button type="button" class="btn-sm" onclick="openBatchScheduleModal('${h(p.project_id)}')">📅 期程推估</button>` : ''}
            ${showMaintScheduleTools && typeof openImportMaintSpecModal === 'function' ? `<button type="button" class="btn-sm" onclick="openImportMaintSpecModal('${h(p.project_id)}')">📥 匯入分期</button>` : ''}
            ${typeof openSaveAsTemplateModal === 'function' ? `<button type="button" class="btn-sm" onclick="openSaveAsTemplateModal('${h(p.project_id)}')">🗂️ 存模板</button>` : ''}
            <button type="button" class="btn-sm" onclick="printSingleProjectPDF('${h(p.project_id)}')">🖨️ 甘特PDF</button>
            <button type="button" class="btn-sm" style="color:#B91C1C" title="刪除此標案與所屬檢核項目" onclick="deleteProject('${h(p.project_id)}')">🗑️ 刪除</button>
          </div>
        </div>

        <!-- 子頁籤切換列 -->
        <div class="spv-subtab-bar">
          <div class="sp-tabs">
            <button type="button" class="sp-tab ${selectedProjectSubtab === 'checklist' ? 'active' : ''}" onclick="selectedProjectSubtab='checklist';renderCurrentView()">✅ 雙欄階段檢核 (${tasks.length} 階段)</button>
            ${isEng && eng ? `
              <button type="button" class="sp-tab ${selectedProjectSubtab === 'materials' ? 'active' : ''}" onclick="selectedProjectSubtab='materials';renderCurrentView()">🧱 材料送審 (${eng.approvedMats}/${eng.mats.length})</button>
              <button type="button" class="sp-tab ${selectedProjectSubtab === 'responsibilities' ? 'active' : ''}" onclick="selectedProjectSubtab='responsibilities';renderCurrentView()">👥 附表二權責 (${eng.doneRespsCount}/${eng.activeRespsCount})</button>
              <button type="button" class="sp-tab ${selectedProjectSubtab === 'changes' ? 'active' : ''}" onclick="selectedProjectSubtab='changes';renderCurrentView()">📐 變更設計 (${eng.changes.length})</button>
              <button type="button" class="sp-tab ${selectedProjectSubtab === 'billings' ? 'active' : ''}" onclick="selectedProjectSubtab='billings';renderCurrentView()">💰 估驗計價 (${eng.billings.length})</button>
            ` : ''}
            ${isMaintOrService ? `
              <button type="button" class="sp-tab ${selectedProjectSubtab === 'billings' ? 'active' : ''}" onclick="selectedProjectSubtab='billings';renderCurrentView()">💰 分期付款核銷 (${billings.length})</button>
            ` : ''}
            <button type="button" class="sp-tab ${selectedProjectSubtab === 'gantt' ? 'active' : ''}" onclick="selectedProjectSubtab='gantt';renderCurrentView()">📊 單案甘特圖</button>
          </div>
          <div class="item-meta num-mono" style="font-size:13.5px;margin:0">
            預算 <strong>${fmtMoney(p.budget_amount)}</strong> ｜ 決標 <strong>${p.award_amount ? fmtMoney(p.award_amount) : '未決標'}</strong>
            ${p.grant_deadline ? ` ｜ <strong style="color:#DC2626">補助死線 ${roc(p.grant_deadline)}</strong>` : ''}
          </div>
        </div>

        ${selectedProjectSubtab === 'checklist' ? `
          <!-- 主體：左 290px 階段導覽樹 × 右單一階段 16px 特大字檢核工作台 -->
          <div class="ga-split-body" style="grid-template-columns: 295px minmax(0, 1fr)">
            <aside class="panel ga-pane" aria-label="標案階段導覽樹（支援鍵盤上下鍵切換）">
              <div class="ga-pane-scroll" style="padding:8px">
                ${tasks.map((t, i) => {
                  const items = parseJSON(t.checklist_json, []);
                  const doneCnt = items.filter(x => x.done).length;
                  const isCur = curTask && curTask.task_id === t.task_id;
                  const dotColor = t.status === '已完成' ? '#047857' : t.status === '缺件卡關' ? '#DC2626' : t.status === '進行中' ? '#0D9488' : '#A8A29E';
                  return `
                    <button type="button" class="spv-stage-node ${isCur ? 'is-active' : ''}"
                            onclick="spvSelectStage('${h(p.project_id)}','${h(t.task_id)}')">
                      <span class="spv-stage-dot" style="background:${dotColor}">${i + 1}</span>
                      <div style="flex:1;min-width:0;text-align:left">
                        <div class="spv-stage-title">${h(t.stage_name)}</div>
                        <div class="spv-stage-meta num-mono">
                          <span>${doneCnt}/${items.length} 完成</span>
                          ${t.sla_deadline ? `<span style="color:#DC2626;font-weight:800">死線 ${roc(t.sla_deadline, { noYear: true })}</span>` : (t.plan_end ? `<span>迄 ${roc(t.plan_end, { noYear: true })}</span>` : '')}
                        </div>
                      </div>
                    </button>
                  `;
                }).join('')}
              </div>
            </aside>

            <section class="panel ga-pane">
              ${curTask ? (() => {
                const items = parseJSON(curTask.checklist_json, []);
                const doneCnt = items.filter(x => x.done).length;
                const prevT = curIdx > 0 ? tasks[curIdx - 1] : null;
                const nextT = curIdx < tasks.length - 1 ? tasks[curIdx + 1] : null;
                return `
                  <div class="panel-hd" style="flex-wrap:wrap;gap:8px">
                    <div>
                      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span class="tag tag-amber num-mono">第 ${curTask.stage_order} / ${tasks.length} 階段</span>
                        <h3 style="font-size:18px;margin:0">${h(curTask.stage_name)}</h3>
                        <span class="tag ${curTask.status === '已完成' ? 'tag-green' : curTask.status === '缺件卡關' ? 'tag-red' : curTask.status === '進行中' ? 'tag-blue' : 'tag-gray'}">${h(curTask.status)}（${doneCnt}/${items.length}）</span>
                      </div>
                      <div class="item-meta num-mono" style="font-size:13.5px;margin-top:4px">
                        預計期程：${roc(curTask.plan_start)} ～ ${roc(curTask.plan_end)}
                        ${curTask.sla_deadline ? ` ｜ <strong style="color:#DC2626">🚨 上級／法定死線：${roc(curTask.sla_deadline)}</strong>` : ''}
                        ${curTask.blocker_note ? ` ｜ <strong style="color:#B45309">⚠️ 卡關備忘：${h(curTask.blocker_note)}</strong>` : ''}
                      </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      <button type="button" class="btn-xs" ${prevT ? '' : 'disabled'} title="鍵盤 ↑ 上一階段" onclick="${prevT ? `spvSelectStage('${h(p.project_id)}','${h(prevT.task_id)}')` : ''}">◀ 上一階段</button>
                      <button type="button" class="btn-xs" ${nextT ? '' : 'disabled'} title="鍵盤 ↓ 下一階段" onclick="${nextT ? `spvSelectStage('${h(p.project_id)}','${h(nextT.task_id)}')` : ''}">下一階段 ▶</button>
                      <select aria-label="階段狀態" style="padding:5px 8px;border:1px solid var(--border-strong,#D6CBB9);border-radius:8px;font-size:14px;font-weight:700"
                              onchange="updateTaskField('${h(curTask.task_id)}','status',this.value)">
                        ${['未開始', '進行中', '缺件卡關', '已完成'].map(s => `<option value="${s}" ${curTask.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                      </select>
                      <button type="button" class="btn-xs" onclick="openEditTaskDatesModal('${h(curTask.task_id)}')">📅 期程與卡關</button>
                      <button type="button" class="btn-xs btn-primary" onclick="addChecklistItem('${h(curTask.task_id)}')">＋ 新增檢核項</button>
                    </div>
                  </div>

                  <div class="ga-pane-scroll" style="padding:6px 14px">
                    ${items.length ? items.map((it, idx) => `
                      <div class="spv-chk-row ${it.done ? 'is-done' : ''}">
                        <input type="checkbox" ${it.done ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer"
                               onchange="toggleCheckItem('${h(curTask.task_id)}', ${idx}, this.checked)">
                        <div class="spv-chk-text">
                          ${it.required ? '<span class="req-star" title="必備檢核項">*</span>' : ''}${h(it.text)}
                        </div>
                        <input type="text" placeholder="公文文號／備註" value="${h(it.doc_no || '')}"
                               onchange="updateCheckMeta('${h(curTask.task_id)}', ${idx}, 'doc_no', this.value)">
                        <input type="date" value="${h(it.done_date || '')}" title="${it.done_date ? roc(it.done_date) : '選擇完成日期'}"
                               onchange="updateCheckMeta('${h(curTask.task_id)}', ${idx}, 'done_date', this.value)">
                        <button type="button" class="btn-xs" style="border:none;background:transparent;color:#78716C;font-size:14px"
                                title="移除此檢核項（支援 8 秒復原）" onclick="removeCheckItem('${h(curTask.task_id)}', ${idx})">✕</button>
                      </div>
                    `).join('') : '<div class="empty-state">本階段尚無檢核細項，可點右上「＋ 新增檢核項」新增。</div>'}
                  </div>
                `;
              })() : '<div class="empty-state">尚無階段資料</div>'}
            </section>
          </div>
        ` : `
          <div class="panel ga-pane">
            <div class="ga-pane-scroll" style="padding:12px 14px">${nonChecklistBodyHTML}</div>
          </div>
        `}
      </div>
    `;
  };

  // 鍵盤 ↑ / ↓ 快速切換標案階段（不干擾輸入框或彈窗）
  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (typeof currentTab === 'undefined' || currentTab !== 'projects' || !selectedProjectId || selectedProjectSubtab !== 'checklist') return;
    const tag = (e.target?.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target?.isContentEditable) return;
    if (document.getElementById('modal-backdrop')?.classList.contains('open')) return;
    const tasks = getProjectTasks(selectedProjectId);
    if (tasks.length < 2) return;
    const curId = spvState.stageByProject[selectedProjectId];
    const idx = tasks.findIndex(t => t.task_id === curId);
    const nextIdx = e.key === 'ArrowDown' ? Math.min(tasks.length - 1, idx + 1) : Math.max(0, idx - 1);
    if (nextIdx >= 0 && nextIdx !== idx) {
      e.preventDefault();
      window.spvSelectStage(selectedProjectId, tasks[nextIdx].task_id);
    }
  });

  // ==========================================================================
  // 3. 例行與續約：雙欄執行台 ↔ 1～12 月負荷矩陣 ＋ ⚡ 年末批次續約開案精靈
  // ==========================================================================
  window.selectSplitRoutine = function(rid) {
    spvState.rtnSelectedId = rid;
    spvState.rtnMode = 'SPLIT';
    renderCurrentView();
  };
  window.spvSetRtnMode = function(m) { spvState.rtnMode = m; renderCurrentView(); };
  window.spvSetRtnBucket = function(b) { spvState.rtnBucket = b; renderCurrentView(); };

  window.spvToggleRoutineActive = async function(routineId) {
    const r = (appData.tables.Annual_Routines || []).find(x => x.routine_id === routineId);
    if (!r) return;
    const prev = r.is_active !== false;
    r.is_active = !prev;
    r.updated_at = nowStr();
    persistCache();
    renderCurrentView();
    await pushToCloud({ action: 'upsert', table: 'Annual_Routines', record: r });
    window.GA_CORE.pushUndoAction(
      r.is_active ? `已恢復啟用「${r.title}」` : `已暫停通知「${r.title}」`,
      async () => {
        r.is_active = prev;
        r.updated_at = nowStr();
        persistCache();
        renderCurrentView();
        await pushToCloud({ action: 'upsert', table: 'Annual_Routines', record: r });
      }
    );
  };

  window.spvQuickAddRoutineStep = async function(routineId) {
    const inp = document.getElementById('spv-rtn-step-in');
    const txt = (inp?.value || '').trim();
    if (!txt) return;
    const r = (appData.tables.Annual_Routines || []).find(x => x.routine_id === routineId);
    if (!r) return;
    const prevNote = r.note || '';
    const parsed = typeof parseRoutineNoteStructured === 'function' ? parseRoutineNoteStructured(prevNote) : { steps: [] };
    const nextNum = (parsed.steps?.length || 0) + 1;
    const line = `${nextNum}. ${txt}`;
    r.note = prevNote ? `${prevNote}\n${line}` : line;
    r.updated_at = nowStr();
    if (inp) inp.value = '';
    persistCache();
    renderCurrentView();
    await pushToCloud({ action: 'upsert', table: 'Annual_Routines', record: r });
    window.GA_CORE.pushUndoAction(`已新增步驟「${txt.slice(0, 16)}」`, async () => {
      r.note = prevNote;
      r.updated_at = nowStr();
      persistCache();
      renderCurrentView();
      await pushToCloud({ action: 'upsert', table: 'Annual_Routines', record: r });
    });
  };

  function isRenewalRoutine(r) {
    return /續約|續租|維護|保養|委外|招標|開口契約/.test(`${r.title || ''} ${r.category || ''} ${r.note || ''}`)
      || /^1[12]-/.test(String(r.due_rule || ''));
  }

  window.openBatchRenewalModal = function() {
    const nextRocYear = new Date().getFullYear() - 1911 + 1;
    const candidates = (appData.tables.Annual_Routines || [])
      .filter(r => r.is_active !== false && isRenewalRoutine(r))
      .map(r => ({ r, sch: computeRoutineSchedule(r) }))
      .sort((a, b) => a.sch.diffDays - b.sch.diffDays);

    openModal(`⚡ 年末維護／委外契約批次續約開案精靈（預開 ${nextRocYear} 年度契約）`, `
      <div class="gate-banner amber" style="margin-bottom:12px;font-size:14px">
        💡 每年 11～12 月總務處常同時面臨多筆年度維護／清潔／機電／保全／飲水機契約到期。勾選下方項目並選擇分流屬性，即可一鍵批次建立草稿與標準檢核階段！
      </div>
      <div class="form-grid" style="margin-bottom:10px">
        <div class="field">
          <label>新開契約會計年度（民國）</label>
          <input id="brw-year" type="number" value="${nextRocYear}">
        </div>
        <div class="field">
          <label>採購分流歸屬（避免小額與上網招標混放）</label>
          <select id="brw-track">
            <option value="MICRO">🔧 小額分期契約（15萬以下逕洽・歸入小額台帳）</option>
            <option value="TENDER">🏛️ 上網招標案（15～150萬公開取得／公開招標）</option>
          </select>
        </div>
      </div>
      <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border-subtle,#E7DFD3);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px">
        ${candidates.length ? candidates.map(({ r, sch }) => `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border-subtle,#E7DFD3);border-radius:8px;background:#fff;cursor:pointer">
            <input type="checkbox" class="brw-chk" value="${h(r.routine_id)}" checked style="width:18px;height:18px">
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:700">${h(r.title)}</div>
              <div class="item-meta">原例行應辦日：${roc(sch.dueDate)} ｜ 分類：${h(r.category || '續約')}</div>
            </div>
          </label>
        `).join('') : '<div class="empty-state">目前例行事務中尚無標記續約／維護項目。</div>'}
      </div>
    `, `
      <button type="button" onclick="closeModal()">取消</button>
      <button type="button" class="btn-primary" ${candidates.length ? '' : 'disabled'} onclick="executeBatchRenewal()">⚡ 一鍵批次建立下年度案件</button>
    `);
  };

  window.executeBatchRenewal = async function() {
    const targetFy = Number(document.getElementById('brw-year')?.value) || (new Date().getFullYear() - 1911 + 1);
    const track = document.getElementById('brw-track')?.value || 'MICRO';
    const isTender = track === 'TENDER';
    const adYear = targetFy + 1911;
    const checkedIds = [...document.querySelectorAll('.brw-chk:checked')].map(el => el.value);
    if (!checkedIds.length) return toast('請至少勾選 1 項續約業務');

    let pSeq = 0;
    (appData.tables.Projects || []).forEach(p => {
      const m = String(p.project_id || '').match(/(\d+)$/);
      if (m) pSeq = Math.max(pSeq, parseInt(m[1], 10));
    });
    let tSeq = 0;
    (appData.tables.Project_Tasks || []).forEach(t => {
      const m = String(t.task_id || '').match(/(\d+)$/);
      if (m) tSeq = Math.max(tSeq, parseInt(m[1], 10));
    });

    const newProjects = [];
    const newTasks = [];
    const tierVal = isTender ? '未達(15-150萬)' : '小額(15萬以下)';
    const pmVal = isTender ? '公開取得報價單或企劃書' : '逕行採購';
    const awVal = isTender ? '最低標' : '逕洽';

    checkedIds.forEach((rid, idx) => {
      const r = (appData.tables.Annual_Routines || []).find(x => x.routine_id === rid);
      if (!r) return;
      const cleanBase = r.title.replace(/^\d{2,3}\s*年度?/, '').replace(/續約|重新招標|招標作業/g, '').trim() || r.title;
      const projName = `${targetFy}年度${cleanBase}`;
      if ((appData.tables.Projects || []).some(p => p.project_name === projName && p.status !== '廢標撤案')) return;

      const pid = `PRJ-${String(pSeq + idx + 1).padStart(4, '0')}`;
      const startDate = `${adYear}-01-01`;
      const endDate = `${adYear}-12-31`;
      const projRec = {
        project_id: pid,
        fiscal_year: targetFy,
        project_name: projName,
        procurement_type: '勞務',
        threshold_tier: tierVal,
        procurement_method: pmVal,
        award_method: awVal,
        budget_amount: '',
        award_amount: '',
        vendor_name: '',
        start_date: startDate,
        orig_end_date: endDate,
        status: '籌備中',
        flags_json: JSON.stringify({ is_maintenance: true, maint_periods: 4, from_routine_id: rid, proc_track: track }),
        updated_at: nowStr(),
        is_deleted: false
      };
      newProjects.push(projRec);
      upsertLocal('Projects', projRec, 'project_id');

      const builtStages = typeof buildStandardStages === 'function'
        ? buildStandardStages({ type: '勞務', tier: tierVal, startDate, endDate, flags: { is_maintenance: true, maint_periods: 4 } })
        : [];
      builtStages.forEach(st => {
        tSeq++;
        const taskRec = {
          ...st,
          task_id: `TSK-${String(tSeq).padStart(4, '0')}`,
          project_id: pid,
          updated_at: nowStr(),
          is_deleted: false
        };
        newTasks.push(taskRec);
        upsertLocal('Project_Tasks', taskRec, 'task_id');
      });
    });

    closeModal();
    if (!newProjects.length) {
      toast('所選項目已存在下年度同名標案，未重複建立');
      return;
    }
    persistCache();
    spvState.projFilter = isTender ? 'TENDER' : 'MICRO';
    switchTab('projects');
    await pushToCloud({
      action: 'batchUpsert',
      items: [
        { table: 'Projects', records: newProjects },
        { table: 'Project_Tasks', records: newTasks }
      ]
    });
    toast(`🎉 已建立 ${newProjects.length} 件 ${targetFy} 年度${isTender ? '上網招標案' : '小額分期契約'}草稿！`);
  };

  function renderSplitRoutinesHTML() {
    const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
    const rawRoutines = (appData.tables.Annual_Routines || [])
      .filter(r => !q || `${r.title} ${r.category} ${r.note || ''}`.toLowerCase().includes(q));
    const all = rawRoutines
      .filter(r => r.is_active !== false)
      .map(r => ({ ...r, sch: computeRoutineSchedule(r) }))
      .sort((a, b) => a.sch.diffDays - b.sch.diffDays);
    const inactiveList = rawRoutines
      .filter(r => r.is_active === false)
      .map(r => ({ ...r, sch: computeRoutineSchedule(r) }));

    const renewalList = all.filter(isRenewalRoutine);
    let shown = all;
    if (spvState.rtnBucket === 'SOON') shown = all.filter(r => r.sch.diffDays <= 14 || r.sch.isVisible);
    else if (spvState.rtnBucket === 'DAYS30') shown = all.filter(r => r.sch.diffDays >= 0 && r.sch.diffDays <= 30);
    else if (spvState.rtnBucket === 'RENEWAL') shown = renewalList;
    else if (spvState.rtnBucket === 'INACTIVE') shown = inactiveList;

    const poolForSelect = spvState.rtnBucket === 'INACTIVE' ? inactiveList : all;
    if (!spvState.rtnSelectedId || ![...all, ...inactiveList].some(r => r.routine_id === spvState.rtnSelectedId)) {
      spvState.rtnSelectedId = shown[0]?.routine_id || poolForSelect[0]?.routine_id || '';
    }
    const cur = [...all, ...inactiveList].find(r => r.routine_id === spvState.rtnSelectedId) || null;
    const parsedNote = (cur && typeof parseRoutineNoteStructured === 'function')
      ? parseRoutineNoteStructured(cur.note || '')
      : { steps: [], files: [], plainNote: cur?.note || '' };

    // 1~12 月年度矩陣分佈
    const monthBuckets = Array.from({ length: 12 }, (_, idx) => ({ month: idx + 1, items: [] }));
    all.forEach(r => {
      if (r.recurrence_type === '每月') {
        monthBuckets.forEach(mb => mb.items.push(r));
      } else {
        const m = parseInt(String(r.sch?.dueDate || '').slice(5, 7), 10);
        if (m >= 1 && m <= 12) monthBuckets[m - 1].items.push(r);
      }
    });

    return `
      <div class="ga-split-shell">
        <div class="vb-top-bar">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:18px;font-weight:800;color:var(--brand-primary,#7C4A21)">🔁 年度固定例行與契約續約工作台</span>
            <div class="sp-tabs">
              <button type="button" class="sp-tab ${spvState.rtnMode === 'SPLIT' ? 'active' : ''}" onclick="spvSetRtnMode('SPLIT')">📋 雙欄執行台</button>
              <button type="button" class="sp-tab ${spvState.rtnMode === 'MATRIX' ? 'active' : ''}" onclick="spvSetRtnMode('MATRIX')">🗓️ 1～12 月負荷矩陣</button>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn-sm" style="background:#FFFBEB;border-color:#F59E0B;color:#92400E;font-weight:800" onclick="openBatchRenewalModal()">⚡ 年末批次續約精靈 (${renewalList.length})</button>
            <button type="button" class="btn-sm btn-primary" onclick="openRoutineModal('')">＋ 新增例行事務</button>
          </div>
        </div>

        ${spvState.rtnMode === 'MATRIX' ? `
          <section class="panel ga-pane">
            <div class="ga-pane-scroll" style="padding:12px">
              <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:10px">
                ${monthBuckets.map(mb => {
                  const heavy = mb.items.length >= 5;
                  return `
                    <div style="border:1px solid ${heavy ? '#F59E0B' : 'var(--border-subtle,#E7DFD3)'};border-radius:10px;padding:10px 12px;background:${heavy ? '#FFFBEB' : '#fff'}">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <strong style="font-size:16px;color:var(--brand-primary,#7C4A21)">${mb.month} 月份</strong>
                        <span class="tag ${heavy ? 'tag-amber' : 'tag-blue'}">${mb.items.length} 項應辦</span>
                      </div>
                      <div style="display:flex;flex-direction:column;gap:4px">
                        ${mb.items.slice(0, 5).map(it => `
                          <div style="font-size:13.5px;padding:4px 6px;border-radius:6px;background:var(--bg-subtle,#FAF6F0);cursor:pointer;font-weight:600"
                               onclick="selectSplitRoutine('${h(it.routine_id)}')">‧ ${h(it.title)}</div>
                        `).join('')}
                        ${mb.items.length > 5 ? `<div class="item-meta">＋ 其餘 ${mb.items.length - 5} 項（點選切換檢視）</div>` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </section>
        ` : `
          <div class="ga-split-body" style="grid-template-columns: minmax(0, 1.2fr) minmax(350px, 1fr)">
            <!-- 左欄：時間桶分組清單 -->
            <section class="panel ga-pane">
              <div class="sp-filter-bar" style="border-top:none;border-bottom:1px solid var(--border-subtle,#E7DFD3)">
                <div class="sp-tabs">
                  <button type="button" class="sp-tab ${spvState.rtnBucket === 'SOON' ? 'active' : ''}" onclick="spvSetRtnBucket('SOON')">🔥 近期應辦</button>
                  <button type="button" class="sp-tab ${spvState.rtnBucket === 'DAYS30' ? 'active' : ''}" onclick="spvSetRtnBucket('DAYS30')">🟡 30日內預告</button>
                  <button type="button" class="sp-tab ${spvState.rtnBucket === 'RENEWAL' ? 'active' : ''}" onclick="spvSetRtnBucket('RENEWAL')">🏦 續約與招標 (${renewalList.length})</button>
                  <button type="button" class="sp-tab ${spvState.rtnBucket === 'ALL' ? 'active' : ''}" onclick="spvSetRtnBucket('ALL')">📚 全部列管 (${all.length})</button>
                  ${inactiveList.length ? `<button type="button" class="sp-tab ${spvState.rtnBucket === 'INACTIVE' ? 'active' : ''}" onclick="spvSetRtnBucket('INACTIVE')">⏸️ 已停用 (${inactiveList.length})</button>` : ''}
                </div>
              </div>
              <div class="ga-pane-scroll" style="padding:10px 12px;display:flex;flex-direction:column;gap:8px">
                ${shown.length ? shown.map(r => {
                  const d = r.sch.diffDays;
                  const isPaused = r.is_active === false;
                  const tagCls = isPaused ? 'tag-gray' : d < 0 ? 'tag-red' : d <= 7 ? 'tag-amber' : 'tag-blue';
                  const relTxt = isPaused ? '⏸️ 已停用' : d < 0 ? `逾期 ${Math.abs(d)} 天` : d === 0 ? '今日截止' : `剩 ${d} 天`;
                  const isSel = cur && cur.routine_id === r.routine_id;
                  return `
                    <div class="spv-list-card ${isSel ? 'is-selected' : ''}" onclick="selectSplitRoutine('${h(r.routine_id)}')">
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                          <span class="tag ${tagCls} num-mono">${h(relTxt)}</span>
                          <span class="tag tag-gray">${h(r.category || '例行')}</span>
                          <span class="item-meta num-mono" style="margin:0">應辦日 ${roc(r.sch.dueDate)}（${h(r.recurrence_type)}）</span>
                        </div>
                        <div style="display:flex;gap:5px;align-items:center">
                          ${isPaused
                            ? `<button type="button" class="btn-xs btn-primary" onclick="event.stopPropagation();spvToggleRoutineActive('${h(r.routine_id)}')">▶️ 啟用</button>`
                            : `<button type="button" class="btn-xs btn-success" onclick="event.stopPropagation();markRoutineDone('${h(r.routine_id)}','${h(r.sch.cycle)}')">✓ 完成打卡</button>`}
                        </div>
                      </div>
                      <div style="font-size:16px;font-weight:800;color:var(--text-primary,#1C1917);margin-top:5px">${h(r.title)}</div>
                    </div>
                  `;
                }).join('') : '<div class="empty-state">此分類下目前無待辦例行事項，可切換「全部列管」檢視全年度清單。</div>'}
              </div>
            </section>

            <!-- 右欄：選中例行事項 SOP 作業步驟與傳送門 -->
            <section class="panel ga-pane">
              ${cur ? `
                <div class="panel-hd" style="flex-wrap:wrap;gap:6px">
                  <h3>📌 作業細節：${h(cur.title)}</h3>
                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    <button type="button" class="btn-xs" onclick="openRoutineModal('${h(cur.routine_id)}')">✎ 編輯設定</button>
                    <button type="button" class="btn-xs" onclick="spvToggleRoutineActive('${h(cur.routine_id)}')" title="不需刪除即可暫停或恢復此例行提醒">${cur.is_active === false ? '▶️ 恢復啟用' : '⏸️ 停用通知'}</button>
                    <button type="button" class="btn-xs" style="color:#B91C1C" onclick="deleteRoutine('${h(cur.routine_id)}')" title="刪除此例行項目（支援 8 秒復原）">🗑️ 刪除</button>
                  </div>
                </div>
                <div class="ga-pane-scroll" style="padding:12px 14px;display:flex;flex-direction:column;gap:12px">
                  <div style="padding:10px 12px;border-radius:10px;background:var(--bg-subtle,#FAF6F0);border:1px solid var(--border-subtle,#E7DFD3)">
                    <div class="num-mono" style="font-size:14.5px;font-weight:700">本期期別：${h(cur.sch.cycle)} ｜ 應辦期限：${roc(cur.sch.dueDate, { withWeekday: true })}</div>
                    <div class="item-meta" style="font-size:13.5px;margin-top:4px">規則說明：${h(typeof describeDueRuleHuman === 'function' ? describeDueRuleHuman(cur) : cur.due_rule)} ｜ 上次完成：${h(cur.last_done_cycle || '尚無紀錄')}</div>
                  </div>

                  <div>
                    <div style="font-size:14.5px;font-weight:800;color:var(--brand-primary,#7C4A21);margin-bottom:6px">✅ 標準作業步驟（SOP）</div>
                    ${parsedNote.steps && parsedNote.steps.length ? parsedNote.steps.map((st, idx) => `
                      <div style="padding:8px 10px;border:1px solid var(--border-subtle,#E7DFD3);border-radius:8px;background:#fff;margin-bottom:6px;font-size:15px">
                        <strong>${idx + 1}.</strong> ${h(typeof st === 'string' ? st : st.text || '')}
                      </div>
                    `).join('') : '<div class="item-meta" style="margin-bottom:6px">尚無標準步驟，可於下方直接輸入新增：</div>'}
                    <div style="display:flex;gap:6px;margin-top:6px">
                      <input id="spv-rtn-step-in" type="text" placeholder="快速新增一步驟（例如：至環教網上傳成果照片）按 Enter..."
                             style="flex:1;padding:6px 10px;border:1px solid var(--border-strong,#D6CBB9);border-radius:8px;font-size:13.5px"
                             onkeydown="if(event.key==='Enter') spvQuickAddRoutineStep('${h(cur.routine_id)}')">
                      <button type="button" class="btn-xs btn-primary" onclick="spvQuickAddRoutineStep('${h(cur.routine_id)}')">＋加步驟</button>
                    </div>
                  </div>

                  ${parsedNote.plainNote ? `
                    <div style="padding:10px 12px;border-radius:10px;background:#FFFBEB;border:1px solid #FDE68A;font-size:14.5px;line-height:1.55">
                      💡 <strong>作業備忘與要領：</strong><br>${h(parsedNote.plainNote)}
                    </div>
                  ` : ''}

                  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto">
                    <button type="button" class="btn-primary" onclick="markRoutineDone('${h(cur.routine_id)}','${h(cur.sch.cycle)}')">✓ 標記本期（${h(cur.sch.cycle)}）已完成</button>
                    ${cur.portal_url ? `<a href="${h(cur.portal_url)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;padding:8px 14px;border-radius:8px;border:1px solid var(--border-strong,#D6CBB9);background:#fff;color:#1C1917;font-weight:700;text-decoration:none;font-size:14px">🌐 前往申報網站 ↗</a>` : ''}
                    <button type="button" class="btn-sm" onclick="openDocCopilotModal({tplId:'REQ_SIGN',title:'${h(cur.title)}',dueDate:'${h(cur.sch.dueDate)}'})">📝 簽呈／催辦草稿</button>
                    ${typeof openRoutineQuickPurchase === 'function' ? `<button type="button" class="btn-sm" onclick="openRoutineQuickPurchase('${h(cur.routine_id)}')">📋 轉開採購案</button>` : ''}
                  </div>
                </div>
              ` : '<div class="empty-state">請選擇左側例行項目</div>'}
            </section>
          </div>
        `}
      </div>
    `;
  }

  // ==========================================================================
  // 4. 太陽能租賃：修正「本年應收 KPI（整合繳納時程）」＋ 左右雙欄契約管理
  // ==========================================================================
  function calcSolarYearStats(rocYear) {
    const adYear = Number(rocYear) + 1911;
    const contracts = appData.tables.Solar_Contracts || [];
    const records = appData.tables.Solar_Records || [];
    const cMap = Object.fromEntries(contracts.map(c => [c.solar_id, c]));
    let yearReceivable = 0;
    let yearPaid = 0;
    const countedInstKeys = new Set();

    records.forEach(r => {
      if (typeof getRecordRocYear === 'function' && getRecordRocYear(r) === Number(rocYear)) {
        const k = calcSolarBillV2(r, cMap[r.solar_id]);
        yearReceivable += Number(k.calculatedRent) || 0;
        if (k.hasActual) yearPaid += Number(k.actualPaid) || 0;
        if (r.due_date) countedInstKeys.add(`${r.solar_id}:${String(r.due_date).slice(0, 10)}`);
      }
    });

    // 整合 rent_terms 繳納時程中落在該年度之約定應收金額（解決尚未建對帳單前「本年應收 0 元」盲點！）
    if (typeof window.getSolarRentTerms === 'function') {
      contracts.filter(c => !['已屆滿', '已期滿', '已解約'].includes(c.status)).forEach(c => {
        const terms = window.getSolarRentTerms(c);
        if (!terms || !Array.isArray(terms.schedule)) return;
        terms.schedule.forEach(inst => {
          const due = String(inst.due_date || '').slice(0, 10);
          if (!due.startsWith(`${adYear}-`)) return;
          if (countedInstKeys.has(`${c.solar_id}:${due}`)) return;
          const amt = Number(inst.amount) || 0;
          yearReceivable += amt;
          if (Number(terms.prior_settled_through) >= Number(inst.no)) {
            yearPaid += amt;
          }
        });
      });
    }
    return { yearReceivable, yearPaid };
  }

  window.calcSolarYearStats = calcSolarYearStats;

  window.spvSelectSolar = function(solarId, subtab) {
    spvState.solarActiveId = solarId;
    solarV2SelectedId = solarId;
    if (subtab) solarV2DetailTab = subtab;
    renderCurrentView();
  };

  function renderSplitSolarHTML() {
    if (typeof ensureSolarV2Tables === 'function') ensureSolarV2Tables();
    const contracts = appData.tables.Solar_Contracts || [];
    const alerts = typeof buildSolarV2Alerts === 'function' ? buildSolarV2Alerts() : [];
    const active = contracts.filter(c => !['已屆滿', '已期滿', '已解約'].includes(c.status));
    const totalKwp = active.reduce((s, c) => s + (Number(c.capacity_kwp) || 0), 0);
    const totalBondBal = contracts.reduce((s, c) => s + getContractBondSummary(c.solar_id, c).balance, 0);
    const yr = calcSolarYearStats(opsSolarYear);

    const activeId = solarV2SelectedId || spvState.solarActiveId || active[0]?.solar_id || contracts[0]?.solar_id || '';
    spvState.solarActiveId = activeId;
    const curC = contracts.find(c => c.solar_id === activeId) || null;

    const uiPrefs = window.GA_CORE.getUiPrefs();
    const rentPresets = window.GA_CORE.getCloudPresets('SOLAR_RENT')
      .filter(pr => pr.newContract && !contracts.some(c => pr.match(c)) && !uiPrefs.dismissedPresets.includes(`SOLAR:${pr.key}`));

    let rightDetailHTML = '';
    if (curC) {
      const bond = getContractBondSummary(curC.solar_id, curC);
      const cmp = getContractComplianceSummary(curC.solar_id, curC);
      const recs = (appData.tables.Solar_Records || [])
        .filter(r => r.solar_id === curC.solar_id)
        .sort((a, b) => String(b.period_end || b.period_label).localeCompare(String(a.period_end || a.period_label)));
      const tabBody = solarV2DetailTab === 'bonds'
        ? renderSolarDetailBondsTabHTML(curC, bond)
        : solarV2DetailTab === 'compliance'
        ? renderSolarDetailComplianceTabHTML(curC, cmp)
        : renderSolarDetailBillingTabHTML(curC, recs);

      rightDetailHTML = `
        <div class="panel-hd" style="flex-wrap:wrap;gap:8px">
          <div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span class="tag tag-blue num-mono">${h(curC.solar_id)}</span>
              ${curC.phase_label ? `<span class="tag tag-amber">${h(curC.phase_label)}</span>` : ''}
              <h3 style="margin:0;font-size:18px">${h(curC.building_name)}</h3>
            </div>
            <div class="item-meta" style="font-size:13.5px;margin-top:3px">
              廠商：<strong>${h(curC.vendor_name || curC.lessee_vendor || '-')}</strong> ｜ 容量 <strong>${curC.capacity_kwp} kWp</strong> ｜ 租期 ${roc(curC.contract_start)} ～ ${roc(curC.contract_end)}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="btn-xs" onclick="openDocCopilotModal({tplId:'VENDOR_NUDGE',title:'${h(curC.building_name)}（${h(curC.phase_label || curC.solar_id)}）',vendor:'${h(curC.vendor_name || '')}',amount:'${h(curC.base_annual_rent || '')}'})">📲 複製廠商催辦詞</button>
            <button type="button" class="btn-xs" onclick="openSolarContractModal('${h(curC.solar_id)}')">✎ 編輯主檔</button>
            <button type="button" class="btn-xs" onclick="printSingleSolarContractPDF('${h(curC.solar_id)}')">🖨️ 本約PDF</button>
            ${typeof deleteSolarContractV2 === 'function' ? `<button type="button" class="btn-xs" style="color:#B91C1C" title="刪除此租賃契約" onclick="deleteSolarContractV2('${h(curC.solar_id)}')">🗑️ 刪除契約</button>` : ''}
          </div>
        </div>
        <div class="sp-filter-bar" style="border-top:none;border-bottom:1px solid var(--border-subtle,#E7DFD3)">
          <div class="sp-tabs">
            <button type="button" class="sp-tab ${solarV2DetailTab === 'billing' ? 'active' : ''}" onclick="spvSelectSolar('${h(curC.solar_id)}','billing')">📊 繳納時程與對帳 (${recs.length})</button>
            <button type="button" class="sp-tab ${solarV2DetailTab === 'compliance' ? 'active' : ''}" onclick="spvSelectSolar('${h(curC.solar_id)}','compliance')">🛡️ 雙保險與變更 (${cmp.logs.length})</button>
            <button type="button" class="sp-tab ${solarV2DetailTab === 'bonds' ? 'active' : ''}" onclick="spvSelectSolar('${h(curC.solar_id)}','bonds')">🔒 履約保證金 (${fmtMoney(bond.balance)})</button>
          </div>
        </div>
        <div class="ga-pane-scroll" style="padding:12px 14px">${tabBody}</div>
      `;
    }

    return `
      <div class="ga-split-shell">
        <!-- 頂部：四張太陽能核心指標與年度切換 -->
        <div class="sp-top-deck" style="grid-template-columns: repeat(4, minmax(0, 1fr))">
          <div class="sp-gauge-card tone-green">
            <div class="sp-gauge-hd"><span>☀️ 併聯管理總容量</span><span class="tag tag-green">${active.length} 份有效契約</span></div>
            <div class="sp-gauge-val num-mono">${totalKwp.toFixed(2)} <small>kWp</small></div>
            <div class="sp-gauge-sub">共 ${contracts.length} 份歷年租約主檔</div>
          </div>

          <div class="sp-gauge-card tone-${yr.yearReceivable > yr.yearPaid ? 'amber' : 'green'}">
            <div class="sp-gauge-hd">
              <span>💰 ${opsSolarYear} 年度應收／實收回饋金</span>
              <div style="display:flex;gap:4px">
                <button type="button" class="btn-xs" onclick="opsSolarYear--;renderCurrentView()">◀</button>
                <button type="button" class="btn-xs" onclick="opsSolarYear++;renderCurrentView()">▶</button>
              </div>
            </div>
            <div class="sp-gauge-val num-mono">${fmtMoney(yr.yearReceivable)} <small>應收</small></div>
            <div class="sp-gauge-sub">已入帳實收：<strong>${fmtMoney(yr.yearPaid)}</strong>${yr.yearReceivable > yr.yearPaid ? `（待收 ${fmtMoney(yr.yearReceivable - yr.yearPaid)}）` : ''}</div>
          </div>

          <div class="sp-gauge-card tone-green">
            <div class="sp-gauge-hd"><span>🔒 留存履約保證金餘額</span></div>
            <div class="sp-gauge-val num-mono">${fmtMoney(totalBondBal)}</div>
            <div class="sp-gauge-sub">含現金專戶與銀行書面連帶保證</div>
          </div>

          <div class="sp-gauge-card tone-${alerts.some(a => a.level === 'red') ? 'red' : alerts.length ? 'amber' : 'green'}">
            <div class="sp-gauge-hd">
              <span>🔔 保單／催繳／續租預警</span>
              <button type="button" class="btn-xs btn-primary" onclick="openSolarContractModal()">＋ 新增契約</button>
            </div>
            <div class="sp-gauge-val num-mono">${alerts.length} <small>項提醒</small></div>
            <div class="sp-gauge-sub" style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="btn-xs" onclick="openSharedMeterBatchModal()">⚡ 共錶拆帳</button>
              ${rentPresets.map(pr => `
                <span style="display:inline-flex;align-items:center;gap:2px">
                  <button type="button" class="btn-xs" onclick="openCreatePresetContract('${h(pr.key)}')">📄 新增${h(pr.label)}</button>
                  <button type="button" class="btn-xs" title="隱藏此範本提示" onclick="spvDismissPreset('SOLAR:${h(pr.key)}','${h(pr.label)}')">✕</button>
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 主體：左 350px 契約選擇清單 × 右選中契約三頁籤同屏控管 -->
        <div class="ga-split-body" style="grid-template-columns: 350px minmax(0, 1fr)">
          <aside class="panel ga-pane">
            <div class="panel-hd"><h3>🏢 太陽能契約清單 (${contracts.length})</h3></div>
            <div class="ga-pane-scroll" style="padding:10px;display:flex;flex-direction:column;gap:8px">
              ${contracts.map(c => {
                const cmp = getContractComplianceSummary(c.solar_id, c);
                const isSel = curC && curC.solar_id === c.solar_id;
                return `
                  <div class="spv-list-card ${isSel ? 'is-selected' : ''}" onclick="spvSelectSolar('${h(c.solar_id)}')">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                      <span class="tag tag-blue num-mono">${h(c.solar_id)}</span>
                      <span class="tag ${c.status === '併聯發電中' ? 'tag-green' : 'tag-gray'}">${h(c.status)}</span>
                    </div>
                    <div style="font-size:16px;font-weight:800;margin-top:4px">${h(c.building_name)}</div>
                    <div class="item-meta num-mono">${c.phase_label ? h(c.phase_label) + '｜' : ''}${c.capacity_kwp} kWp｜基準租 ${fmtMoney(c.base_annual_rent)}</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
                      <span class="tag ${cmp.pub.level === 'ok' ? 'tag-green' : cmp.pub.level === 'amber' ? 'tag-amber' : 'tag-red'}">意外險 ${cmp.pub.exists ? (cmp.pub.level === 'red' ? '逾期' : '有效') : '未登'}</span>
                      <span class="tag ${cmp.prop.level === 'ok' ? 'tag-green' : cmp.prop.level === 'amber' ? 'tag-amber' : 'tag-red'}">產險 ${cmp.prop.exists ? (cmp.prop.level === 'red' ? '逾期' : '有效') : '未登'}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </aside>

          <section class="panel ga-pane">
            ${curC ? rightDetailHTML : '<div class="empty-state">尚未建立太陽能租賃契約</div>'}
          </section>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 5. 水電費監控：單列濃縮工具條 ＋ 左 55% 同期對照圖與錶號 × 右 45% 帳單異常表
  // ==========================================================================
  // 升級 SVG 圖表字級至 >= 12px 確保高清晰閱讀
  if (typeof buildUtilitiesMonthlySVG === 'function') {
    const _origBuildUtilSVG = buildUtilitiesMonthlySVG;
    buildUtilitiesMonthlySVG = function(adYear, allBills, meterIdSet) {
      return _origBuildUtilSVG(adYear, allBills, meterIdSet)
        .replace(/font-size="9\.5"/g, 'font-size="12"')
        .replace(/font-size="10\.5"/g, 'font-size="12.5"')
        .replace(/font-size="11\.5"/g, 'font-size="13.5"');
    };
  }

  function renderSplitUtilitiesHTML() {
    const adYear = Number(opsUtilYear) + 1911;
    const meters = (appData.tables.Utilities_Meters || []).filter(m => m.is_active !== false);
    const allBills = appData.tables.Utilities_Bills || [];
    const filteredMeters = meters.filter(m => opsUtilTypeFilter === 'all' || m.utility_type === opsUtilTypeFilter);
    const validMeterIds = new Set(filteredMeters.map(m => m.meter_id));
    const targetIds = opsUtilMeterFilter === 'all' ? validMeterIds : new Set([opsUtilMeterFilter]);
    const mMap = Object.fromEntries(meters.map(m => [m.meter_id, m]));

    const yearBills = allBills
      .filter(b => targetIds.has(b.meter_id) && String(b.billing_ym || '').startsWith(`${adYear}-`))
      .sort((a, b) => String(b.billing_ym || '').localeCompare(String(a.billing_ym || '')))
      .map(b => ({ ...b, _meter: mMap[b.meter_id], _eval: evaluateUtilityBill(b, mMap[b.meter_id], allBills) }));

    const yearSpent = yearBills.reduce((s, b) => s + (Number(b.bill_amount) || 0), 0);
    const totalBudget = filteredMeters.reduce((s, m) => s + (Number(m.annual_budget) || 0), 0);
    const budgetPct = totalBudget > 0 ? Math.round((yearSpent / totalBudget) * 100) : 0;

    return `
      <div class="ga-split-shell">
        <div class="vb-top-bar">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:18px;font-weight:800;color:var(--brand-primary,#7C4A21)">⚡ 水電費預算與異常監控</span>
            <button type="button" class="btn-xs" onclick="opsUtilYear--;renderCurrentView()">◀</button>
            <strong class="num-mono" style="font-size:15px">${opsUtilYear} 年度</strong>
            <button type="button" class="btn-xs" onclick="opsUtilYear++;renderCurrentView()">▶</button>
            <div class="sp-tabs">
              ${[['all', '全部'], ['電費', '⚡ 電費'], ['水費', '💧 水費']].map(([v, lbl]) => `
                <button type="button" class="sp-tab ${opsUtilTypeFilter === v ? 'active' : ''}" onclick="opsUtilTypeFilter='${v}';opsUtilMeterFilter='all';renderCurrentView()">${lbl}</button>
              `).join('')}
            </div>
            <select aria-label="篩選錶號" onchange="opsUtilMeterFilter=this.value;renderCurrentView()" style="padding:5px 8px;border-radius:8px;border:1px solid var(--border-strong,#D6CBB9);font-size:14px;font-weight:700">
              <option value="all" ${opsUtilMeterFilter === 'all' ? 'selected' : ''}>全部錶號 (${filteredMeters.length})</option>
              ${filteredMeters.map(m => `<option value="${h(m.meter_id)}" ${opsUtilMeterFilter === m.meter_id ? 'selected' : ''}>${h(m.meter_label)} (${h(m.meter_no)})</option>`).join('')}
            </select>
          </div>

          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span class="tag ${budgetPct >= 95 ? 'tag-red' : budgetPct >= 80 ? 'tag-amber' : 'tag-green'} num-mono">累計 ${fmtMoney(yearSpent)}${totalBudget ? ` / 預算 ${budgetPct}%` : ''}</span>
            ${typeof openSyncExternalElecModal === 'function' ? `<button type="button" class="btn-sm" onclick="openSyncExternalElecModal()">🔄 同步原電費表</button>` : ''}
            <button type="button" class="btn-sm" onclick="openUtilityMeterModal('')">＋ 新增錶號</button>
            <button type="button" class="btn-sm btn-primary" onclick="openUtilityBillModal('')">＋ 登錄帳單</button>
            <button type="button" class="btn-sm" onclick="printUtilitiesPDF()">🖨️ 報表PDF</button>
          </div>
        </div>

        <div class="ga-split-body" style="grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr)">
          <!-- 左欄：1~12 月同期走勢比較圖 ＋ 各錶號健康與契約需量卡 -->
          <section class="panel ga-pane">
            <div class="panel-hd">
              <h3>📈 1～12 月本年 vs 去年同期對照</h3>
              <div class="sp-tabs">
                <button type="button" class="sp-tab ${opsUtilChartMetric === 'amount' ? 'active' : ''}" onclick="opsUtilChartMetric='amount';renderCurrentView()">金額 (元)</button>
                <button type="button" class="sp-tab ${opsUtilChartMetric === 'usage' ? 'active' : ''}" onclick="opsUtilChartMetric='usage';renderCurrentView()">度數</button>
              </div>
            </div>
            <div class="ga-pane-scroll" style="padding:12px">
              ${filteredMeters.length ? `
                <div style="border:1px solid var(--border-subtle,#E7DFD3);border-radius:10px;padding:8px;background:#fff;margin-bottom:10px">
                  ${buildUtilitiesMonthlySVG(adYear, allBills, targetIds)}
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:8px">
                  ${filteredMeters.map(m => renderMeterStatusCardHTML(m, allBills)).join('')}
                </div>
              ` : `<div class="empty-state">尚未建立水電錶主檔<br><button class="btn-sm btn-primary" style="margin-top:8px" onclick="seedDefaultSchoolMeters()">⚡ 一鍵建立 4 顆常用水電錶範本</button></div>`}
            </div>
          </section>

          <!-- 右欄：帳單與異常查修明細表 -->
          <section class="panel ga-pane">
            <div class="panel-hd">
              <h3>🧾 ${opsUtilYear} 年度帳單與異常查修 (${yearBills.length} 筆)</h3>
            </div>
            <div class="ga-pane-scroll">
              ${yearBills.length ? `
                <table class="sp-table">
                  <thead><tr><th>年月／錶別</th><th>度數／YoY</th><th>應繳金額</th><th>狀態與需量警示</th><th style="text-align:right">操作</th></tr></thead>
                  <tbody>
                    ${yearBills.map(b => {
                      const ev = b._eval;
                      const m = b._meter || {};
                      return `
                        <tr>
                          <td class="num-mono" style="white-space:nowrap">
                            <strong>${h(b.billing_ym)}</strong>
                            <div class="item-meta">${h(m.meter_label || b.meter_id)}</div>
                          </td>
                          <td class="num-mono" style="white-space:nowrap">
                            <strong>${Number(b.usage_units || 0).toLocaleString('zh-TW')} 度</strong>
                            <div class="item-meta">${ev.yoyPct !== null ? `同期 ${ev.yoyPct > 0 ? '+' : ''}${ev.yoyPct}%` : '無同期'}</div>
                          </td>
                          <td class="num-mono" style="white-space:nowrap;font-weight:800">${fmtMoney(b.bill_amount)}</td>
                          <td>
                            <span class="tag ${ev.level === 'red' ? 'tag-red' : ev.level === 'amber' ? 'tag-amber' : 'tag-green'}">${h(ev.alertText)}</span>
                            ${m.utility_type === '電費' && b.max_demand_kw ? `<div class="item-meta num-mono">最高需量 ${b.max_demand_kw} kW</div>` : ''}
                          </td>
                          <td style="text-align:right;white-space:nowrap">
                            <button type="button" class="btn-xs" onclick="openUtilityBillModal('${h(b.meter_id)}','${h(b.bill_id)}')">✎</button>
                            <button type="button" class="btn-xs" onclick="deleteUtilityBill('${h(b.bill_id)}')">刪</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              ` : '<div class="empty-state">本年度尚無符合篩選的水電帳單紀錄。</div>'}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  // 掛載替換子視圖產生器
  renderProjectsListHTML = renderSplitProjectsListHTML;
  renderRoutinesHTML = renderSplitRoutinesHTML;
  renderSolarViewHTML = renderSplitSolarHTML;
  renderUtilitiesViewHTML = renderSplitUtilitiesHTML;

  window.spvSetGanttTrack = function(tf) {
    spvState.ganttTrackFilter = tf;
    renderCurrentView();
  };

  // 確保甘特圖與模板頁亦包覆於 100dvh 零外層捲動容器內，並支援甘特圖「上網招標 vs 小額契約」一鍵分流
  if (typeof renderAnnualGanttHTML === 'function') {
    const _origGantt = renderAnnualGanttHTML;
    renderAnnualGanttHTML = function() {
      const origProjs = (appData.tables && appData.tables.Projects) || [];
      const tenderList = origProjs.filter(p => window.GA_CORE.isFormalTenderProject(p));
      const microList = origProjs.filter(p => window.GA_CORE.isMicroPurchaseProject(p));
      let bodyHTML = '';
      try {
        if (spvState.ganttTrackFilter === 'TENDER') appData.tables.Projects = tenderList;
        else if (spvState.ganttTrackFilter === 'MICRO') appData.tables.Projects = microList;
        bodyHTML = _origGantt();
      } finally {
        if (appData.tables) appData.tables.Projects = origProjs;
      }
      return `
        <div class="ga-split-shell">
          <div class="vb-top-bar">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span style="font-size:18px;font-weight:800;color:var(--brand-primary,#7C4A21)">📅 全校跨案甘特圖排程</span>
              <div class="sp-tabs">
                <button type="button" class="sp-tab ${spvState.ganttTrackFilter === 'TENDER' ? 'active' : ''}" onclick="spvSetGanttTrack('TENDER')">🏛️ 只看上網招標案 (${tenderList.length})</button>
                <button type="button" class="sp-tab ${spvState.ganttTrackFilter === 'MICRO' ? 'active' : ''}" onclick="spvSetGanttTrack('MICRO')">🔧 只看小額契約 (${microList.length})</button>
                <button type="button" class="sp-tab ${spvState.ganttTrackFilter === 'ALL' ? 'active' : ''}" onclick="spvSetGanttTrack('ALL')">📚 全部顯示 (${origProjs.length})</button>
              </div>
            </div>
            <button type="button" class="btn-sm" onclick="switchTab('projects')">← 返回標案工作台</button>
          </div>
          <div class="panel ga-pane"><div class="ga-pane-scroll" style="padding:12px">${bodyHTML}</div></div>
        </div>
      `;
    };
  }
  if (typeof renderTemplatesHTML === 'function') {
    const _origTpl = renderTemplatesHTML;
    renderTemplatesHTML = function() {
      return `<div class="ga-split-shell"><div class="panel ga-pane"><div class="ga-pane-scroll" style="padding:12px">${_origTpl()}</div></div></div>`;
    };
  }

  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('split-pane-views.js', 'v2.1', '全業務子分頁 100dvh 左右雙欄工作台升級（招標與小額分流＋卡片刪除復原）');
  }
})();
