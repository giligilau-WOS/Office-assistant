/**
 * ============================================================================
 * 學校總務行政助理 — 標案案號更正 (project-case-number.js)
 *
 * 案號即標案主鍵（Projects.project_id），原「編輯基本資料」無法修改。
 * 本模組於標案詳情頁加入「🔢 更改案號」，更正時：
 *   1. 掃描所有資料表，將 project_id＝舊案號的子資料（階段、分期付款、材料、變更、權責分工…）改為新案號
 *   2. Memo「已轉標案」連結（converted_ref）一併更新
 *   3. 雲端先寫入新案號資料，再軟刪除舊案號標案（不連帶刪除子資料）
 * ============================================================================
 */

(function initProjectCaseNumber() {
  const CASE_RE = /^XP\d{3}0[123]\d{2,}$/;

  function findChildren(oldId) {
    const out = [];
    Object.entries(appData.tables || {}).forEach(([table, rows]) => {
      if (table === 'Projects' || !Array.isArray(rows)) return;
      const hit = rows.filter(r => r && r.project_id === oldId);
      if (hit.length) out.push({ table, rows: hit });
    });
    return out;
  }

  const tableLabel = {
    Project_Tasks: '流程階段', Project_Billings: '分期付款', Project_Materials: '材料送審',
    Project_ChangeOrders: '契約變更', Project_Responsibilities: '權責分工'
  };

  window.openChangeCaseNoModal = function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return;
    const children = findChildren(projectId);
    const memos = (appData.tables.Quick_Memos || []).filter(m => m.converted_ref === projectId);
    openModal('🔢 更改案號', `
      <div class="form-grid">
        <div class="field"><label>目前案號</label><input type="text" value="${esc(projectId)}" disabled></div>
        <div class="field"><label>正確案號 *</label><input id="cn-new" type="text" value="" placeholder="例：XP1150205" oninput="previewCaseNoChange('${esc(projectId)}')"></div>
      </div>
      <div class="item-meta" style="margin-top:4px">格式：XP＋民國年（3碼）＋採購性質（01工程／02勞務／03財物）＋序號，例如 XP1150205。</div>
      <div id="cn-msg" style="margin-top:8px;font-size:13px"></div>
      <div class="gate-banner amber" style="margin-top:10px;font-size:13px">
        將一併更新：${children.length ? children.map(c => `${tableLabel[c.table] || c.table} ${c.rows.length} 筆`).join('、') : '（無子資料）'}${memos.length ? `、Memo 連結 ${memos.length} 筆` : ''}。
        <div class="item-meta" style="margin-top:4px">雲端會先寫入新案號資料，再將舊案號標案標記刪除（子資料不受影響）。</div>
      </div>
    `, `<button onclick="closeModal()">取消</button><button class="btn-primary" id="cn-save" disabled onclick="applyCaseNoChange('${esc(projectId)}')">確認更改</button>`);
    setTimeout(() => document.getElementById('cn-new')?.focus(), 50);
  };

  function validate(oldId, raw) {
    const v = String(raw || '').trim().toUpperCase();
    if (!v) return { ok: false, v, msg: '' };
    if (v === oldId) return { ok: false, v, msg: '與目前案號相同。' };
    if ((appData.tables.Projects || []).some(x => x.project_id === v)) return { ok: false, v, msg: `⚠️ 案號 ${v} 已被其他標案使用。` };
    if (!CASE_RE.test(v)) return { ok: true, v, warn: true, msg: `⚠️ ${v} 不符合 XP＋民國年＋01/02/03＋序號 格式，仍可儲存，請再次確認。` };
    return { ok: true, v, msg: `✓ 將由 ${oldId} 改為 <strong>${v}</strong>` };
  }

  window.previewCaseNoChange = function(oldId) {
    const r = validate(oldId, document.getElementById('cn-new')?.value);
    const msg = document.getElementById('cn-msg');
    const btn = document.getElementById('cn-save');
    if (msg) { msg.innerHTML = r.msg; msg.style.color = r.ok && !r.warn ? 'var(--green, #047857)' : '#b45309'; }
    if (btn) btn.disabled = !r.ok;
  };

  window.applyCaseNoChange = async function(oldId) {
    const r = validate(oldId, document.getElementById('cn-new')?.value);
    if (!r.ok) return;
    const newId = r.v;
    const p = (appData.tables.Projects || []).find(x => x.project_id === oldId);
    if (!p) return;

    const children = findChildren(oldId);
    children.forEach(c => c.rows.forEach(row => { row.project_id = newId; row.updated_at = nowStr(); }));
    const memos = (appData.tables.Quick_Memos || []).filter(m => m.converted_ref === oldId);
    memos.forEach(m => { m.converted_ref = newId; m.updated_at = nowStr(); });
    p.project_id = newId;
    p.updated_at = nowStr();

    if (typeof selectedProjectId !== 'undefined' && selectedProjectId === oldId) selectedProjectId = newId;
    closeModal();
    renderCurrentView();

    const items = [{ table: 'Projects', records: [p] }]
      .concat(children.map(c => ({ table: c.table, records: c.rows })))
      .concat(memos.length ? [{ table: 'Quick_Memos', records: memos }] : []);
    await pushToCloud({ action: 'batchUpsert', items });
    await pushToCloud({ action: 'softDelete', table: 'Projects', id: oldId, cascade: false });
    toast(`✅ 案號已更正為 ${newId}`);
  };

  // 標案詳情頁：於「編輯基本資料」旁加入「更改案號」
  window.GA_CORE.onAfterRender(tab => {
    if (tab !== 'projects' || !selectedProjectId) return;
    if (document.getElementById('btn-change-caseno')) return;
    const editBtn = Array.from(document.querySelectorAll('#main-view button')).find(b => (b.getAttribute('onclick') || '').startsWith('openEditProjectModal('));
    if (!editBtn) return;
    const b = document.createElement('button');
    b.id = 'btn-change-caseno';
    b.className = 'btn-sm';
    b.textContent = '🔢 更改案號';
    b.onclick = () => window.openChangeCaseNoModal(selectedProjectId);
    editBtn.insertAdjacentElement('afterend', b);
  });

  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('project-case-number.js', 'v1.0', '標案案號更正（連動子資料）');
  }
})();
