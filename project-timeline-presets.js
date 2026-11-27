/**
 * ============================================================================
 * 學校總務行政助理 — 標案期程控管預設 (project-timeline-presets.js)
 *
 * 將已核定之全案推動期程，一次匯入既有標案的「階段（Project_Tasks）」：
 *   - 每階段含預定起迄、上級／法定死線（sla_deadline，自動進入戰情室死線提醒）與檢核清單
 *   - 取代建案時自動產生的通用階段（已有勾選進度者改為附加，不覆蓋）
 *   - 可選擇同步更新預算金額、建立「每月 5 日前進度填報」例行事務
 *
 * 預設期程資料存於雲端擴充表（CLOUD_PRESET / PROJECT_TIMELINE），公開程式碼庫不含特定機關個資或公文文號。
 * ============================================================================
 */

(function initProjectTimelinePresets() {
  const getTimelinePresets = () => (window.GA_CORE && typeof window.GA_CORE.getCloudPresets === 'function')
    ? window.GA_CORE.getCloudPresets('PROJECT_TIMELINE')
    : [];
  const rocShort = ymd => { const [y, m, d] = String(ymd).split('-').map(Number); return `${y - 1911}/${m}/${d}`; };

  function buildTaskRecords(p, preset, seqBase, orderBase) {
    return preset.stages.map((st, i) => {
      const allDone = st.status === '已完成';
      return {
        task_id: `TSK-${String(seqBase + i + 1).padStart(4, '0')}`,
        project_id: p.project_id,
        stage_order: orderBase + i + 1,
        stage_name: st.name,
        plan_start: st.start,
        plan_end: st.end,
        actual_start: allDone || st.status === '進行中' ? st.start : '',
        actual_end: allDone ? st.end : '',
        sla_deadline: st.sla || '',
        blocker_note: '',
        status: st.status,
        checklist_json: JSON.stringify(st.items.map((it, j) => ({
          id: `chk_${orderBase + i + 1}_${j + 1}`, text: it.text, required: !!it.required,
          done: !!it.done, doc_no: it.doc_no || '', done_date: it.done_date || ''
        }))),
        updated_at: nowStr(), is_deleted: false
      };
    });
  }

  const normName = s => String(s ?? '').replace(/\s+/g, '').trim();

  // 依「標案內實際存在的同名階段」判斷是否已匯入過（不只看標記，雲端若未保存標記也不會重複匯入）
  function existingState(p, preset) {
    const tasks = getProjectTasks(p.project_id);
    const names = new Set(tasks.map(t => normName(t.stage_name)));
    const presetNames = new Set(preset.stages.map(st => normName(st.name)));
    const present = preset.stages.filter(st => names.has(normName(st.name)));
    const missing = preset.stages.filter(st => !names.has(normName(st.name)));
    const others = tasks.filter(t => !presetNames.has(normName(t.stage_name)));
    const doneOthers = others.reduce((s, t) => s + parseJSON(t.checklist_json, []).filter(x => x.done).length, 0);
    const mode = present.length ? 'fill' : (doneOthers === 0 ? 'replace' : 'append');
    return { tasks, others, present, missing, doneOthers, mode };
  }

  // 相似的例行事務
  function similarRoutine(preset) {
    if (!preset.routine) return null;
    return (appData.tables.Annual_Routines || []).find(r => r.title === preset.routine.title
      || (r.recurrence_type === preset.routine.recurrence_type && /跑道/.test(r.title || '') && /填報/.test(r.title || '')));
  }

  window.openTimelinePresetModal = function(projectId, key) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    const preset = getTimelinePresets().find(x => x.key === key);
    if (!p || !preset) return;
    const st = existingState(p, preset);
    const simRt = similarRoutine(preset);
    const hasRoutine = !!simRt;
    const toAdd = st.mode === 'fill' ? st.missing : preset.stages;
    openModal(`📅 匯入期程控管：${preset.label}`, `
      ${st.mode === 'fill' ? `<div class="gate-banner red" style="margin-bottom:10px;font-size:13px">
        ⚠️ 此標案<strong>已有 ${st.present.length} 個相同名稱的階段</strong>，期程應已匯入過，請先確認是否還需要匯入：
        <div class="item-meta" style="margin-top:4px">已存在：${st.present.map(x => esc(x.name)).join('、')}</div>
        ${st.missing.length ? `<div class="item-meta" style="margin-top:2px">尚缺：<strong>${st.missing.map(x => esc(x.name)).join('、')}</strong></div>` : '<div class="item-meta" style="margin-top:2px">13 個階段皆已存在，不需匯入。</div>'}
      </div>` : ''}
      <div class="gate-banner amber" style="margin-bottom:10px;font-size:13px">
        ${st.mode === 'fill'
          ? (st.missing.length ? `若繼續，只會<strong>補上缺少的 ${st.missing.length} 個階段</strong>，已存在的階段不會重複建立或變更。` : '不會建立任何階段。')
          : `將匯入 <strong>${preset.stages.length} 個階段</strong>至 <strong>${esc(formatProjectCaseNo(p))}｜${esc(p.project_name)}</strong>。
            ${st.tasks.length ? (st.mode === 'replace'
              ? `目前 ${st.tasks.length} 個自動產生的通用階段尚無勾選進度，將<strong>以本期程取代</strong>。`
              : `目前階段已有 ${st.doneOthers} 項勾選進度，為避免遺失，本期程將<strong>附加於後</strong>，原階段保留。`) : ''}`}
        <div class="item-meta" style="margin-top:4px">依據：${esc(preset.source || '-')}</div>
      </div>
      <div style="max-height:300px;overflow:auto;border:1px solid var(--border);border-radius:8px">
        <table><thead><tr><th>#</th><th>階段</th><th>預定期間</th><th>死線</th><th>狀態</th></tr></thead><tbody>
        ${toAdd.map((s) => `<tr>
          <td>${preset.stages.indexOf(s) + 1}</td>
          <td><strong>${esc(s.name)}</strong><div class="item-meta">${s.items.length} 項檢核</div></td>
          <td style="white-space:nowrap">${rocShort(s.start)}～${rocShort(s.end)}</td>
          <td style="white-space:nowrap">${s.sla ? `<span class="tag tag-red">${rocShort(s.sla)}</span>` : '-'}</td>
          <td style="white-space:nowrap"><span class="tag ${s.status === '已完成' ? 'tag-green' : s.status === '進行中' ? 'tag-blue' : 'tag-gray'}">${s.status}</span></td>
        </tr>`).join('')}
        </tbody></table>
      </div>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:13px;cursor:pointer">
        <input type="checkbox" id="tp-budget" ${Number(p.budget_amount) !== preset.budget ? 'checked' : ''} style="margin-top:3px">
        <span>預算金額更新為 <strong>${fmtMoney(preset.budget)}</strong>（含營業稅；目前 ${fmtMoney(p.budget_amount)}）</span>
      </label>
      ${preset.routine ? `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:6px;font-size:13px;cursor:pointer">
        <input type="checkbox" id="tp-routine" ${hasRoutine ? 'disabled' : 'checked'} style="margin-top:3px">
        <span>${hasRoutine ? `已有相似例行事務「${esc(simRt.title)}」，不再建立` : `同時建立例行事務「${esc(preset.routine.title)}」`}</span>
      </label>` : ''}
    `, st.mode === 'fill' && !st.missing.length
      ? `<button class="btn-primary" onclick="closeModal()">不匯入，關閉</button>`
      : `<button onclick="closeModal()">${st.mode === 'fill' ? '不匯入' : '取消'}</button><button class="btn-primary" onclick="applyTimelinePreset('${esc(projectId)}','${esc(key)}')">💾 ${st.mode === 'fill' ? `只補上缺少的 ${st.missing.length} 個階段` : `匯入 ${preset.stages.length} 個階段`}</button>`);
  };

  window.applyTimelinePreset = async function(projectId, key) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    const preset = getTimelinePresets().find(x => x.key === key);
    if (!p || !preset) return;
    const st = existingState(p, preset);
    if (st.mode === 'fill' && !st.missing.length) { closeModal(); return; }
    const updateBudget = !!document.getElementById('tp-budget')?.checked;
    const addRoutine = !!preset.routine && !!document.getElementById('tp-routine')?.checked && !document.getElementById('tp-routine')?.disabled;

    let seqBase = 0;
    (appData.tables.Project_Tasks || []).forEach(r => {
      const m = String(r.task_id || '').match(/(\d+)$/);
      if (m) seqBase = Math.max(seqBase, parseInt(m[1], 10));
    });
    const orderBase = st.mode === 'replace' ? 0 : st.tasks.reduce((mx, t) => Math.max(mx, Number(t.stage_order) || 0), 0);
    const removed = st.mode === 'replace' ? st.tasks.map(t => t.task_id) : [];
    if (removed.length) appData.tables.Project_Tasks = appData.tables.Project_Tasks.filter(t => !removed.includes(t.task_id));
    const taskRecs = buildTaskRecords(p, st.mode === 'fill' ? { ...preset, stages: st.missing } : preset, seqBase, orderBase);
    taskRecs.forEach(t => upsertLocal('Project_Tasks', t, 'task_id'));

    // 匯入標記同時寫入既有的 flags_json 欄（保證存入試算表）與 timeline_preset 欄
    const flags = { ...parseJSON(p.flags_json, {}), timeline_preset: preset.key };
    const projRec = { ...p, timeline_preset: preset.key, flags_json: JSON.stringify(flags), updated_at: nowStr(), ...(updateBudget ? { budget_amount: preset.budget } : {}) };
    upsertLocal('Projects', projRec, 'project_id');

    const items = [{ table: 'Projects', records: [projRec] }, { table: 'Project_Tasks', records: taskRecs }];
    if (addRoutine) {
      const rt = {
        routine_id: nextId('Annual_Routines', 'routine_id', 'RTN', 3), ...preset.routine,
        last_done_date: '', linked_template_id: '', is_active: true, updated_at: nowStr(), is_deleted: false
      };
      upsertLocal('Annual_Routines', rt, 'routine_id');
      items.push({ table: 'Annual_Routines', records: [rt] });
    }

    closeModal();
    renderCurrentView();
    await pushToCloud({ action: 'batchUpsert', items });
    for (const id of removed) await pushToCloud({ action: 'softDelete', table: 'Project_Tasks', id });
    toast(`✅ 已${st.mode === 'fill' ? '補上' : '匯入'} ${taskRecs.length} 個階段${addRoutine ? '＋每月填報例行事務' : ''}`);
  };

  // 標案詳情頁：符合且尚未匯入時，於頁首顯示匯入提示
  const _prevRenderView_tp = renderCurrentView;
  renderCurrentView = function() {
    _prevRenderView_tp();
    if (typeof currentTab === 'undefined' || currentTab !== 'projects' || !selectedProjectId) return;
    const p = (appData.tables.Projects || []).find(x => x.project_id === selectedProjectId);
    const main = document.getElementById('main-view');
    if (!p || !main || document.getElementById('tp-banner')) return;
    const preset = getTimelinePresets().find(pr => pr.match(p));
    if (!preset) return;
    const st = existingState(p, preset);
    if (!st.missing.length) return;                                   // 已全部存在
    const marked = p.timeline_preset === preset.key || parseJSON(p.flags_json, {}).timeline_preset === preset.key;
    if (!st.present.length && marked) return; // 已匯入後使用者自行移除，不再提示
    const partial = st.present.length > 0;
    const div = document.createElement('div');
    div.id = 'tp-banner';
    div.className = 'gate-banner amber';
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap';
    div.innerHTML = partial
      ? `<span>📅 核定期程已部分存在（${st.present.length}／${preset.stages.length} 個階段），尚缺 ${st.missing.length} 個</span>
        <button class="btn-sm" onclick="openTimelinePresetModal('${esc(p.project_id)}','${esc(preset.key)}')">檢視後決定</button>`
      : `<span>📅 已有核定期程：${esc(preset.label)}</span>
        <button class="btn-sm btn-primary" onclick="openTimelinePresetModal('${esc(p.project_id)}','${esc(preset.key)}')">匯入 ${preset.stages.length} 個階段</button>`;
    main.prepend(div);
  };

  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('project-timeline-presets.js', 'v1.0', '標案核定期程一鍵匯入（階段、死線、檢核清單）');
  }
})();
