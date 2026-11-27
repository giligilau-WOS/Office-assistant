/**
 * ============================================================================
 * 學校總務行政助理 — 重複資料檢查與清理 (data-dedupe.js)
 *
 * 找出重複推送到雲端的資料，列出後由使用者勾選、確認才刪除（雲端軟刪除）：
 *   - 標案階段：同一標案、同名階段（保留勾選進度最多者）
 *   - 標案：同名標案（保留底下有階段／資料者）
 *   - 例行事務：同名例行事務
 *   - 太陽能：同契約同保單號之保險紀錄、同起租日同容量之契約、同契約同期別之對帳單
 *   - 交辦 Memo：內容相同且未完成
 * 只有「內容完全相同的多餘複本」會預先勾選；其餘僅列出供判斷。
 * 入口：⚙️ 設定 →「🔍 檢查重複資料」；標案詳情頁偵測到重複階段時於頁首提醒。
 * ============================================================================
 */

(function initDataDedupe() {
  const norm = s => String(s ?? '').replace(/\s+/g, '').trim();
  const T = name => (appData.tables && appData.tables[name]) || [];

  const doneCount = t => parseJSON(t.checklist_json, []).filter(i => i.done).length;
  const idNum = id => { const m = String(id || '').match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };

  // 每組：{ key, title, table, pk, keep, extras:[{rec, preselect, label}] }
  function groupBy(rows, keyFn) {
    const map = new Map();
    rows.forEach(r => { const k = keyFn(r); if (!k) return; if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
    return [...map.values()].filter(g => g.length > 1);
  }

  function findDuplicates(scope = {}) {
    const groups = [];
    const projName = id => (T('Projects').find(p => p.project_id === id) || {}).project_name || id;

    // 1. 標案階段
    const tasks = T('Project_Tasks').filter(t => !scope.projectId || t.project_id === scope.projectId);
    groupBy(tasks, t => t.project_id && t.stage_name ? `${t.project_id}|${norm(t.stage_name)}` : '').forEach(g => {
      const sorted = [...g].sort((a, b) =>
        (doneCount(b) - doneCount(a)) || ((b.status === '已完成') - (a.status === '已完成')) || (idNum(a.task_id) - idNum(b.task_id)));
      const keep = sorted[0];
      groups.push({
        kind: '標案階段', table: 'Project_Tasks', pk: 'task_id',
        title: `${projName(keep.project_id)}｜${keep.stage_name}`,
        keepLabel: `${keep.task_id}（${keep.plan_start || '-'}～${keep.plan_end || '-'}，已勾 ${doneCount(keep)} 項）`,
        extras: sorted.slice(1).map(r => ({
          rec: r, id: r.task_id,
          preselect: r.plan_start === keep.plan_start && r.plan_end === keep.plan_end && doneCount(r) <= doneCount(keep),
          label: `${r.task_id}（${r.plan_start || '-'}～${r.plan_end || '-'}，已勾 ${doneCount(r)} 項，${r.status || '-'}）`
        }))
      });
    });

    if (scope.projectId) return groups;

    // 2. 同名標案
    const childCount = id => Object.entries(appData.tables || {})
      .filter(([k, rows]) => k !== 'Projects' && Array.isArray(rows))
      .reduce((s, [, rows]) => s + rows.filter(r => r && r.project_id === id).length, 0);
    groupBy(T('Projects'), p => norm(p.project_name)).forEach(g => {
      const sorted = [...g].sort((a, b) => childCount(b.project_id) - childCount(a.project_id));
      const keep = sorted[0];
      groups.push({
        kind: '標案', table: 'Projects', pk: 'project_id', cascade: false,
        title: keep.project_name,
        keepLabel: `${keep.project_id}（底下 ${childCount(keep.project_id)} 筆資料）`,
        extras: sorted.slice(1).map(r => ({
          rec: r, id: r.project_id, preselect: childCount(r.project_id) === 0,
          label: `${r.project_id}（底下 ${childCount(r.project_id)} 筆資料${childCount(r.project_id) ? '，刪除前請先確認' : '，空標案'}）`
        }))
      });
    });

    // 3. 同名例行事務
    groupBy(T('Annual_Routines'), r => norm(r.title)).forEach(g => {
      const sorted = [...g].sort((a, b) => (!!b.last_done_cycle - !!a.last_done_cycle) || (idNum(a.routine_id) - idNum(b.routine_id)));
      const keep = sorted[0];
      groups.push({
        kind: '例行事務', table: 'Annual_Routines', pk: 'routine_id', title: keep.title,
        keepLabel: `${keep.routine_id}（${keep.recurrence_type || '-'}，上次辦結 ${keep.last_done_cycle || '無'}）`,
        extras: sorted.slice(1).map(r => ({
          rec: r, id: r.routine_id,
          preselect: r.recurrence_type === keep.recurrence_type && r.due_rule === keep.due_rule,
          label: `${r.routine_id}（${r.recurrence_type || '-'} ${r.due_rule || ''}，上次辦結 ${r.last_done_cycle || '無'}）`
        }))
      });
    });

    // 4. 太陽能保險紀錄：同契約、同類別、同保單號
    const solarName = id => (T('Solar_Contracts').find(c => c.solar_id === id) || {}).building_name || id;
    groupBy(T('Solar_Compliance_Logs'), l => l.solar_id && l.doc_or_policy_no ? `${l.solar_id}|${l.log_type}|${norm(l.doc_or_policy_no)}` : '').forEach(g => {
      const sorted = [...g].sort((a, b) => idNum(a.log_id) - idNum(b.log_id));
      const keep = sorted[0];
      groups.push({
        kind: '太陽能保險／變更紀錄', table: 'Solar_Compliance_Logs', pk: 'log_id',
        title: `${solarName(keep.solar_id)}｜${keep.doc_or_policy_no}`,
        keepLabel: `${keep.log_id}（${keep.effective_date || '-'}～${keep.expiry_date || '-'}）`,
        extras: sorted.slice(1).map(r => ({
          rec: r, id: r.log_id,
          preselect: r.effective_date === keep.effective_date && r.expiry_date === keep.expiry_date,
          label: `${r.log_id}（${r.effective_date || '-'}～${r.expiry_date || '-'}）`
        }))
      });
    });

    // 5. 太陽能契約：同起租日、同容量（僅列出）
    groupBy(T('Solar_Contracts'), c => c.contract_start && c.capacity_kwp ? `${String(c.contract_start).slice(0, 10)}|${Number(c.capacity_kwp)}` : '').forEach(g => {
      const keep = g[0];
      groups.push({
        kind: '太陽能契約', table: 'Solar_Contracts', pk: 'solar_id', title: `${keep.building_name}（${keep.contract_start} 起，${keep.capacity_kwp} kWp）`,
        keepLabel: keep.solar_id,
        extras: g.slice(1).map(r => ({ rec: r, id: r.solar_id, preselect: false, label: `${r.solar_id}｜${r.building_name}（請確認是否為同一份契約）` }))
      });
    });

    // 6. 太陽能對帳單：同契約、同期別（僅列出）
    groupBy(T('Solar_Records'), r => r.solar_id && r.period_label ? `${r.solar_id}|${norm(r.period_label)}` : '').forEach(g => {
      const keep = g[0];
      groups.push({
        kind: '太陽能對帳單', table: 'Solar_Records', pk: 'record_id', title: `${solarName(keep.solar_id)}｜${keep.period_label}`,
        keepLabel: keep.record_id,
        extras: g.slice(1).map(r => ({ rec: r, id: r.record_id, preselect: false, label: `${r.record_id}（${r.period_start || '-'}～${r.period_end || '-'}）` }))
      });
    });

    // 7. 交辦 Memo：內容相同且未完成（僅列出）
    groupBy(T('Quick_Memos').filter(m => !m.is_done), m => norm(m.content)).forEach(g => {
      const keep = g[0];
      groups.push({
        kind: '交辦 Memo', table: 'Quick_Memos', pk: 'memo_id', title: keep.content, keepLabel: keep.memo_id,
        extras: g.slice(1).map(r => ({ rec: r, id: r.memo_id, preselect: false, label: r.memo_id }))
      });
    });

    return groups;
  }
  window.findDuplicateData = findDuplicates;

  let ddGroups = [];

  window.openDedupeModal = function(scope = {}) {
    ddGroups = findDuplicates(scope);
    const total = ddGroups.reduce((s, g) => s + g.extras.length, 0);
    if (!total) {
      openModal('🔍 檢查重複資料', `<div class="empty-state" style="padding:20px">✓ ${scope.projectId ? '此標案' : '目前資料'}沒有發現重複。</div>`,
        `<button class="btn-primary" onclick="closeModal()">關閉</button>`);
      return;
    }
    const body = ddGroups.map((g, gi) => `
      <div style="border:1px solid var(--border,#E2E8F0);border-radius:8px;padding:8px 10px;margin-bottom:8px">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="tag tag-gray">${esc(g.kind)}</span><strong style="font-size:13.5px">${esc(g.title)}</strong></div>
        <div class="item-meta" style="margin:4px 0 2px">保留：${esc(g.keepLabel)}</div>
        ${g.extras.map((x, xi) => `
          <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer;margin-top:3px">
            <input type="checkbox" class="dd-chk" data-g="${gi}" data-x="${xi}" ${x.preselect ? 'checked' : ''} onchange="updateDedupeCount()" style="margin-top:3px">
            <span>刪除 ${esc(x.label)}${x.preselect ? '' : ' <span class="tag tag-amber">請確認</span>'}</span>
          </label>`).join('')}
      </div>`).join('');
    openModal(`🔍 檢查重複資料（${ddGroups.length} 組、多出 ${total} 筆）`, `
      <div class="gate-banner amber" style="margin-bottom:10px;font-size:13px">
        已預先勾選「內容完全相同」的多餘複本；標示「請確認」者內容不完全相同，預設不刪除。
        刪除會同步到雲端試算表（軟刪除，紀錄仍保留在試算表中）。
      </div>
      <div style="max-height:420px;overflow:auto">${body}</div>
    `, `<button onclick="closeModal()">取消</button><button class="btn-danger" id="dd-apply" onclick="applyDedupe()">刪除勾選的 0 筆</button>`);
    window.updateDedupeCount();
  };

  window.updateDedupeCount = function() {
    const n = document.querySelectorAll('.dd-chk:checked').length;
    const btn = document.getElementById('dd-apply');
    if (btn) { btn.textContent = `刪除勾選的 ${n} 筆`; btn.disabled = n === 0; }
  };

  window.applyDedupe = async function() {
    const picks = [...document.querySelectorAll('.dd-chk:checked')].map(el => {
      const g = ddGroups[Number(el.dataset.g)];
      return { g, x: g.extras[Number(el.dataset.x)] };
    });
    if (!picks.length) return;
    picks.forEach(({ g, x }) => {
      appData.tables[g.table] = (appData.tables[g.table] || []).filter(r => r[g.pk] !== x.id);
      if (g.table === 'Projects' && typeof selectedProjectId !== 'undefined' && selectedProjectId === x.id) selectedProjectId = null;
    });
    closeModal();
    renderCurrentView();
    for (const { g, x } of picks) {
      await pushToCloud({ action: 'softDelete', table: g.table, id: x.id, ...(g.table === 'Projects' ? { cascade: false } : {}) });
    }
    toast(`✅ 已刪除 ${picks.length} 筆重複資料`);
  };

  // 標案詳情頁：偵測到重複階段時於頁首提醒
  window.GA_CORE.onAfterRender(tab => {
    if (tab !== 'projects' || !selectedProjectId) return;
    const main = document.getElementById('main-view');
    if (!main || document.getElementById('dd-banner')) return;
    const groups = findDuplicates({ projectId: selectedProjectId });
    const n = groups.reduce((s, g) => s + g.extras.length, 0);
    if (!n) return;
    const div = document.createElement('div');
    div.id = 'dd-banner';
    div.className = 'gate-banner red';
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap';
    div.innerHTML = `<span>⚠️ 此標案有 <strong>${n}</strong> 個重複階段（${groups.length} 個階段名稱重複出現），完成率與死線提醒可能重複計算</span>
      <button class="btn-sm btn-danger" onclick="openDedupeModal({ projectId: '${esc(selectedProjectId)}' })">檢視並清理</button>`;
    main.prepend(div);
  });

  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('data-dedupe.js', 'v1.0', '重複資料檢查與清理（確認後軟刪除）');
  }
})();
