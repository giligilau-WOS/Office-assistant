/**
 * ============================================================================
 * 學校總務行政助理 — 第一期 B 工程強化外掛模組 (eng-module.js)
 * 整合：材料送審管制、附表二四方權責分工(50項)、變更設計與工期、分期估驗計價
 * 並自動升級：單案甘特圖 SVG、A4 橫式 PDF 報表與首頁跨模組預警雷達
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 0. 注入工程模組專屬樣式與介面狀態
// ----------------------------------------------------------------------------
(function injectEngStyles() {
  const css = `
    .eng-subtabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
    .eng-kpi-row { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:12px; }
    .eng-stat { background:#fff; border:1px solid var(--border); border-radius:8px; padding:9px 12px; }
    .eng-stat .lbl { font-size:12px; color:var(--muted); font-weight:600; }
    .eng-stat .val { font-size:18px; font-weight:800; margin-top:2px; }
    .gate-banner { padding:9px 12px; border-radius:8px; margin-bottom:12px; font-size:13px; border:1px solid; }
    .gate-banner.red { background:#fef2f2; border-color:#fecaca; color:#991b1b; }
    .gate-banner.amber { background:#fffbeb; border-color:#fde68a; color:#92400e; }
    .gate-banner.green { background:#ecfdf5; border-color:#a7f3d0; color:#065f46; }
    .filter-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
    .pill-btn { padding:4px 10px; border-radius:999px; font-size:12px; border:1px solid var(--border); background:#fff; }
    .pill-btn.active { background:var(--primary); color:#fff; border-color:var(--primary); }
    .role-badge { display:inline-block; padding:1px 6px; border-radius:4px; font-size:12px; font-weight:700; }
    .role-do { background:#dbeafe; color:#1d4ed8; }
    .role-rev { background:#fef3c7; color:#b45309; }
    .role-app { background:#d1fae5; color:#047857; }
    .role-ref { background:#f1f5f9; color:#475569; }
    .doc-chips { display:flex; gap:4px; flex-wrap:wrap; }
    .doc-chip { font-size:12px; padding:1px 5px; border-radius:4px; border:1px solid #cbd5e1; color:#64748b; }
    .doc-chip.ok { background:#d1fae5; border-color:#6ee7b7; color:#065f46; font-weight:700; }
    @media (max-width: 1100px) { .eng-kpi-row { grid-template-columns:repeat(2,1fr); } }
    @media print {
      .print-table { width:100%; border-collapse:collapse; font-size:10px; }
      .print-table th, .print-table td { border:1px solid #94a3b8; padding:4px 5px; text-align:left; vertical-align:top; }
      .print-table th { background:#e2e8f0 !important; font-weight:700; text-align:center; }
      .print-table thead { display:table-header-group; }
      .print-table tr { page-break-inside:avoid; }
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

let matFilter = 'all';
let respPhaseFilter = 'all';
let respHolderFilter = 'all';
let respShowExempt = false;

// ----------------------------------------------------------------------------
// 1. 附表二 50 項標準權責分工範本（無委託專案管理廠商）
// 格式：[item_no, phase, nameGeneral, nameBuilding, basis, owner, designer, supervisor, contractor, hasPenalty, linkedModule, defaultExempt, defaultSla]
// ----------------------------------------------------------------------------
const RESP_TEMPLATE_50 = [
  // 一、工程開(施)工前 (11項)
  [1,'工程開(施)工前','申請主管單位各階段勘驗','申請建管單位各階段勘驗','工契附錄2-5.2.16、2-5.5','督導','協辦','協辦','辦理',true,'無',true,'承造人：各階段施工前依規申請'],
  [2,'工程開(施)工前','擬定施工進度表','擬定施工進度表','工契9-(四)-1、9-(四)-3、附錄2-5.2.4、品管要點11','核定','','審查','辦理',true,'無',false,'承造人：訂約後7日／監造：3日／機關：3日'],
  [3,'工程開(施)工前','合法土資場或借土區資料送審','合法土資場或借土區資料送審','工契9-(廿三)','依契約規定','依契約規定','依契約規定','依契約規定',false,'無',true,'依個案契約規定辦理'],
  [4,'工程開(施)工前','向主管單位申報開工','向建管單位申報開工','工契附錄2-5.2.16、2-5.5','督導','協辦','協辦','辦理',true,'無',true,'承造人：開工前依建管規定申報'],
  [5,'工程開(施)工前','向業主申報開工','向業主申報開工','工契7-(一)、附錄2-5.2.6','核定','','審查','辦理',true,'無',false,'承造人：決標訂約後7日／監造：3日／機關：3日'],
  [6,'工程開(施)工前','編擬監造計畫','編擬監造計畫','品管要點8','核定','','辦理','',true,'無',false,'監造人：決標後10日（開工前）／機關：7日'],
  [7,'工程開(施)工前','編擬及提報施工計畫書（向主管單位及工程管理單位）','編擬及提報施工計畫書（向建管單位及工程管理單位）','工契9-(四)、附錄1-3、2-5.2.4、品管要點11','核定','','審查','辦理',true,'無',false,'承造人：開工前7日／監造：7日／機關：7日'],
  [8,'工程開(施)工前','編擬品質計畫','編擬品質計畫','工契附錄4-3、品管要點3、6、11','核定','','審查','辦理',true,'無',false,'承造人：開工前7日／監造：7日／機關：7日'],
  [9,'工程開(施)工前','編擬安全衛生管理計畫','編擬安全衛生管理計畫','工契附錄1-3、1-4','核定','','審查','辦理',true,'無',false,'承造人：開工前7日／監造：7日／機關：7日'],
  [10,'工程開(施)工前','辦理工程保險','辦理工程保險','工契13','備查','','核定','辦理',true,'無',false,'承造人：開工前3日／監造：3日／機關：3日'],
  [11,'工程開(施)工前','向勞檢單位申請丁類危險性工作場所審查','向勞檢單位申請丁類危險性工作場所審查','工契附錄1-1、2-5.2.16','督導','','監督','辦理',true,'無',true,'符合丁類危評規模者開工前1個月申請'],

  // 二、工程施工階段 (28項)
  [1,'工程施工階段','填報公共工程監造（監督、查核）報表','填報建築工程監造（監督、查核）報表','品管要點11','核定','','辦理','',true,'無',false,'監造人：每日填報、每7日彙送／機關：5日'],
  [2,'工程施工階段','填報公共工程施工日誌','填報建築物施工日誌','工契9-(四)-5、附錄2-5.2.7、品管要點7','備查','','核定','辦理',true,'無',false,'承造人：每日填報、每7日彙送／監造：5日／機關：5日'],
  [3,'工程施工階段','填報公共工程施工中營造業專任工程人員督察紀錄表','填報建築物施工中營造業專任工程人員督察紀錄表','工契附錄4-3.6.1、品管要點7','督導','','督導','辦理',false,'無',false,'承造人：依營造業法規定定期督察並提送'],
  [4,'工程施工階段','停工、復工報核','停工、復工報核','工契7-(三)-2、附錄2-5.2.6','核定','','審查','辦理',true,'ChangeOrders',false,'承造人：事實發生日起7日／監造：5日／機關：5日'],
  [5,'工程施工階段','營建剩餘土石方流向管制','營建剩餘土石方流向管制','工契9-(廿三)','備查/督導','','監督','辦理',false,'無',true,'出土期間每月申報與查核'],
  [6,'工程施工階段','定期召開工程協調會議','定期召開工程協調會議','工契附錄3-3','核定','協辦','辦理','協辦',true,'無',false,'監造人：每週或雙週召開並於3日內送紀錄'],
  [7,'工程施工階段','工程界面協調','工程界面協調','工契10-(三)-7、10-(五)','備查','協辦','辦理','協辦',false,'無',false,'施工期間隨時協調並留存紀錄'],
  [8,'工程施工階段','工程材料送審進度管制','工程材料送審進度管制','工契11-(二)、附錄4-1、4-2、品管要點11、13','備查','','核定/審查','辦理',true,'Materials',false,'承造人：開工後提管制總表／監造：5日'],
  [9,'工程施工階段','繪製施工詳圖','繪製施工詳圖','工契9-(四)-1、9-(四)-3、9-(四)-4、10-(三)、附錄1-5.1、品管要點11','備查','','核定/審查','辦理',true,'無',false,'承造人：施作前14日提送／監造：7日'],
  [10,'工程施工階段','工程材料資料送審','工程材料資料送審','工契11-(二)、附錄4-1、4-2、品管要點11、13','核定','','審查','辦理',true,'Materials',false,'承造人：進場前15日／監造：7日／機關：5日'],
  [11,'工程施工階段','工程材料資料送審（同等品）','工程材料資料送審（同等品）','工契11-(二)、附錄4-1、4-2、品管要點11、13','核定','','審查','辦理',true,'Materials',false,'承造人：進場前30日／監造：7日／機關：5日'],
  [12,'工程施工階段','工程材料試驗結果之查察（廠商自主品管）','工程材料試驗結果之查察（廠商自主品管）','工契附錄4-2、品管要點11、13','備查/督導','','審查','辦理',true,'Materials',false,'承造人：試驗報告出具後3日／監造：5日'],
  [13,'工程施工階段','工程材料樣品送審','工程材料樣品送審','工契11-(二)、附錄2-5.2.3、品管要點11','核定','','審查','辦理',true,'Materials',false,'承造人：進場前15日／監造：7日／機關：5日'],
  [14,'工程施工階段','施工材料與設備查核【包括檢（抽）驗】','施工材料與設備查核【包括檢（抽）驗】','工契11-(二)、附錄4-2、品管要點11、13','備查/督導','','辦理','協辦',true,'Materials',false,'監造人：材料進場時會同抽驗並於5日內報備'],
  [15,'工程施工階段','施工品質管理','施工品質管理','工契10-(三)、11、附錄2-5.2.11、4','備查/督導','','監督','辦理',false,'無',false,'依品質計畫與三級品管持續執行'],
  [16,'工程施工階段','工地安衛與環境保護','工地安衛與環境保護','工契附錄1、2-2、2-3、2-5.3、品管要點11','備查/督導','','監督','辦理',false,'無',false,'施工期間每日自主檢查與監造抽查'],
  [17,'工程施工階段','施工進度管制','施工進度管制','工契9-(四)-1、10-(三)、品管要點11','備查/督導','','審查','辦理',true,'無',false,'按週／月檢討預定與實際進度落差'],
  [18,'工程施工階段','擬定趕工計畫','擬定趕工計畫','工契5-(一)-5','核定','','審查','辦理',true,'無',false,'進度落後達契約門檻時7日內提送／監造5日／機關5日'],
  [19,'工程施工階段','施工中工期核計','施工中工期核計','工契9-(四)-1、10-(三)、品管要點11','核定','','審查','辦理',true,'ChangeOrders',false,'承造人：按月提報／監造：5日／機關：5日'],
  [20,'工程施工階段','工期展延','工期展延','工契7-(三)','核定','','審查','辦理',true,'ChangeOrders',false,'承造人：原因發生後7日／監造：5日／機關：5日'],
  [21,'工程施工階段','施工中估驗計價','施工中估驗計價','工契5-(一)-2、附錄4-2、品管要點11','核定','','審查','辦理',true,'Billings',false,'承造人：依約請款／監造：5日／機關：10日內核銷撥款'],
  [22,'工程施工階段','工程變更設計作業（確定變更後之作業）','工程變更設計作業（確定變更後之作業）','工契7-(二)、7-(三)、20、附錄2-5.2.9、品管要點11','核定','辦理','協辦','協辦',true,'ChangeOrders',false,'設計人：會勘確認後14日提送修正書圖／機關：10日簽准'],
  [23,'工程施工階段','解釋合約、圖說與規範','解釋合約、圖說與規範','工契10-(三)','核定','協辦','辦理','',true,'無',false,'監造人：收受疑義後5日內釋疑／機關：5日核定'],
  [24,'工程施工階段','處理鄰房損害糾紛','處理鄰房損害糾紛','工契9-(十六)、18-(五)、18-(八)','備查','','協辦','辦理',false,'無',true,'發生時立即處理並通報機關備查'],
  [25,'工程施工階段','工程爭議處理','工程爭議處理','工契22','核定','協辦','辦理','協辦',false,'無',false,'依契約爭議處理機制即時召開協調'],
  [26,'工程施工階段','申請電信、消防、電、水、污排等管線埋設事宜','申請電信、消防、電、水、污排等管線埋設事宜','工契附錄2-5.2.16','依契約規定','依契約規定','依契約規定','依契約規定',true,'無',true,'依個案契約規定與管線單位期程辦理'],
  [27,'工程施工階段','向主管單位申報竣工','向建管單位申報竣工','工契附錄2-5.2.6','督導','協辦','協辦','辦理',true,'無',true,'承造人：竣工後依主管／建管規定申報'],
  [28,'工程施工階段','準備使用執照申請事宜','準備使用執照申請事宜','工契9-(十四)','督導','協辦','協辦','辦理',true,'無',true,'承造人：完工前備妥使照申請相關文件'],

  // 三、工程完工驗收階段 (11項)
  [1,'工程完工驗收階段','辦理使用執照申請','辦理使用執照申請','工契9-(十四)、15-(十三)','督導','協辦','協辦','辦理',true,'無',true,'承造人：依契約期限取得使用執照'],
  [2,'工程完工驗收階段','向業主申報完工','向業主申報完工','工契15-(二)、附錄2-5.2.6','核定','','審查','辦理',true,'無',false,'承造人：竣工當日（至遲次日）書面申報／監造：3日'],
  [3,'工程完工驗收階段','竣工確認','竣工確認','工契15-(二)','核定','','辦理','協辦',true,'無',false,'法定：收受竣工通知日起7日內會同確認竣工'],
  [4,'工程完工驗收階段','核計總工期','核計總工期','工契7-(三)-1','核定','','審查','辦理',true,'無',false,'承造人：竣工後7日／監造：5日／機關：5日'],
  [5,'工程完工驗收階段','繪製竣工圖說','繪製竣工圖說','工契15-(二)','核定','','審查','辦理',true,'無',false,'承造人：竣工確認後7日／監造：5日／機關：5日'],
  [6,'工程完工驗收階段','製作工程結算明細表及辦理工程結算','製作工程結算明細表及辦理工程結算','工契15-(二)、21-(三)、品管要點11','核定','','審查','辦理',true,'無',false,'承造人：竣工確認後7日／監造：5日／機關：5日'],
  [7,'工程完工驗收階段','測試設備運轉','測試設備運轉','工契15-(三)、品管要點11','核定','','監督','辦理',true,'無',false,'承造人：驗收前完成試運轉並提測試紀錄'],
  [8,'工程完工驗收階段','辦理工程驗收','辦理工程驗收','工契15-(二)、品管要點11','辦理','','協辦','協辦',false,'無',false,'法定：確認竣工後30日內（有初驗者初驗合格後20日內）'],
  [9,'工程完工驗收階段','填具工程結算驗收證明書或其他類似文件','填具工程結算驗收證明書或其他類似文件','採購法73條、細則101條、品管要點11','辦理','','協辦','協辦',false,'無',false,'法定：驗收完畢後15日內填具'],
  [10,'工程完工驗收階段','辦理點交作業','辦理點交作業','工契15-(九)','核定','','協辦','辦理',true,'無',false,'承造人：驗收合格後7日內辦理點交'],
  [11,'工程完工驗收階段','繕製工程決算書','繕製工程決算書','','辦理','','協辦','協辦',false,'無',false,'機關：驗收核銷完成後依規繕製歸檔']
];

const MATERIAL_DOCS = [
  { key: 'catalog', label: '型錄' },
  { key: 'sample', label: '樣品板' },
  { key: 'factory', label: '出廠證明' },
  { key: 'taf', label: 'TAF試驗報告' },
  { key: 'green', label: '綠建材標章' }
];

const BILLING_STAGES = ['廠商送件', '監造簽認', '總務複核', '主計審核', '校長核章', '已撥款入帳'];
const CHANGE_STAGES = ['現場會勘', '書圖審查中', '校內簽准', '新增項目議價', '修正契約用印', '核定生效', '撤銷'];

// ----------------------------------------------------------------------------
// 2. 工程帳本動態彙總引擎（永遠不覆蓋原始契約基準）
// ----------------------------------------------------------------------------
function calcEngineeringSummary(projectId) {
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId) || {};
  const mats = (appData.tables.Project_Materials || []).filter(m => m.project_id === projectId);
  const changes = (appData.tables.Project_ChangeOrders || []).filter(c => c.project_id === projectId)
    .sort((a, b) => Number(a.change_seq) - Number(b.change_seq));
  const billings = (appData.tables.Project_Billings || []).filter(b => b.project_id === projectId);
  const resps = (appData.tables.Project_Responsibilities || []).filter(r => r.project_id === projectId);

  const today = todayStr();
  const baseContract = Number(p.award_amount) || 0;
  const budget = Number(p.budget_amount) || 0;

  let approvedNet = 0, approvedAdd = 0, approvedAbs = 0, approvedDays = 0, pendingChanges = 0;
  changes.forEach(c => {
    if (c.status === '核定生效') {
      approvedNet += Number(c.net_amount) || 0;
      approvedAdd += Number(c.add_amount) || 0;
      approvedAbs += Number(c.abs_total_amount) || 0;
      approvedDays += Number(c.days_delta) || 0;
    } else if (c.status !== '撤銷') {
      pendingChanges++;
    }
  });

  const effectiveContract = baseContract > 0 ? (baseContract + approvedNet) : 0;
  const addRatioPct = baseContract > 0 ? Number(((approvedAdd / baseContract) * 100).toFixed(1)) : 0;
  const revisedEndDate = (p.orig_end_date && approvedDays !== 0) ? addDays(p.orig_end_date, approvedDays) : (p.orig_end_date || '');
  const isOverBudget = budget > 0 && effectiveContract > budget;

  let totalBilled = 0, totalRetention = 0, totalNetPayable = 0, totalDisbursed = 0, latestProgress = 0;
  billings.forEach(b => {
    totalBilled += Number(b.period_amount) || 0;
    totalRetention += Number(b.retention_deduct) || 0;
    totalNetPayable += Number(b.net_payable) || 0;
    if (b.workflow_stage === '已撥款入帳') totalDisbursed += Number(b.net_payable) || 0;
    latestProgress = Math.max(latestProgress, Number(b.cum_progress_pct) || 0);
  });
  const payExecPct = effectiveContract > 0 ? Number(((totalBilled / effectiveContract) * 100).toFixed(1)) : 0;

  const approvedMats = mats.filter(m => m.status === '已核定' || m.status === '進場檢驗合格').length;
  const inspectedMats = mats.filter(m => m.status === '進場檢驗合格').length;
  const overdueMats = mats.filter(m =>
    (m.status === '待送審' || m.status === '退回修正') && m.submit_deadline && diffDays(today, m.submit_deadline) < 0
  ).length;
  const greenMats = mats.filter(m => m.is_green_material).length;

  const activeResps = resps.filter(r => !r.is_exempt);
  const doneResps = activeResps.filter(r => r.current_holder === '已完成').length;
  const holderCounts = { '承造人': 0, '監造人': 0, '設計人': 0, '起造人(學校)': 0 };
  activeResps.forEach(r => { if (holderCounts[r.current_holder] !== undefined) holderCounts[r.current_holder]++; });

  return {
    mats, changes, billings, resps,
    baseContract, budget, effectiveContract, approvedNet, approvedAdd, approvedAbs, approvedDays,
    pendingChanges, addRatioPct, revisedEndDate, isOverBudget,
    totalBilled, totalRetention, totalNetPayable, totalDisbursed, latestProgress, payExecPct,
    approvedMats, inspectedMats, overdueMats, greenMats,
    activeRespsCount: activeResps.length, doneRespsCount: doneResps, holderCounts
  };
}

// ----------------------------------------------------------------------------
// 3. 覆寫標案詳情頁（動態展開工程專屬 6 頁籤）與基本資料編輯
// ----------------------------------------------------------------------------
const _origRenderProjectDetailHTML = renderProjectDetailHTML;
renderProjectDetailHTML = function(projectId) {
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
  if (!p) { selectedProjectId = null; return renderProjectsListHTML(); }

  const isEng = p.procurement_type === '工程' || p.engineering_category === '一般公共工程' || p.engineering_category === '公有建築物';
  if (!isEng && !['checklist', 'gantt'].includes(selectedProjectSubtab)) {
    selectedProjectSubtab = 'checklist';
  }

  const tasks = getProjectTasks(projectId);
  const prog = calcProjectProgress(projectId);
  const eng = calcEngineeringSummary(projectId);

  let subContent = '';
  if (selectedProjectSubtab === 'checklist') {
    const matGateWarn = (isEng && eng.mats.length > 0 && eng.inspectedMats < eng.mats.length)
      ? `<div class="gate-banner amber">🧱 <strong>材料品管防呆提醒：</strong>本案共有 ${eng.mats.length} 項送審材料，目前尚有 <strong>${eng.mats.length - eng.inspectedMats} 項</strong>尚未完成「進場檢驗合格」，辦理估驗計價與竣工驗收前請先至「材料送審」頁籤確認文件與報告齊備。</div>`
      : '';
    subContent = matGateWarn + renderProjectStagesHTML(p, tasks);
  } else if (selectedProjectSubtab === 'materials') {
    subContent = renderMaterialsTabHTML(p, eng);
  } else if (selectedProjectSubtab === 'responsibilities') {
    subContent = renderResponsibilitiesTabHTML(p, eng);
  } else if (selectedProjectSubtab === 'changes') {
    subContent = renderChangeOrdersTabHTML(p, eng);
  } else if (selectedProjectSubtab === 'billings') {
    subContent = renderBillingsTabHTML(p, eng);
  } else {
    subContent = renderProjectGanttPreviewHTML(p, tasks);
  }

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <button class="btn-sm" onclick="selectedProjectId=null;renderCurrentView()">← 返回標案清單</button>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-sm" onclick="openEditProjectModal('${esc(p.project_id)}')">✎ 編輯基本資料／監造設計</button>
        <button class="btn-sm" onclick="openSaveAsTemplateModal('${esc(p.project_id)}')">🗂️ 存為年度模板</button>
        <button class="btn-sm btn-primary" onclick="printSingleProjectPDF('${esc(p.project_id)}')">🖨️ 單案甘特圖 PDF</button>
        <button class="btn-sm btn-danger" onclick="deleteProject('${esc(p.project_id)}')">🗑️ 刪除標案</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-bd">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:280px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
              <span class="tag tag-gray">${esc(typeof formatProjectCaseNo === 'function' ? formatProjectCaseNo(p) : p.project_id)}</span>
              <span class="tag tag-gray">${esc(p.procurement_type)}</span>
              <span class="tag tag-gray">${esc(p.threshold_tier)}</span>
              <span class="tag tag-gray">${esc(p.award_method)}</span>
              ${isEng ? `<span class="tag tag-gray">附表二：${esc(p.engineering_category || '一般公共工程')}｜${esc(p.supervision_mode || '委外監造')}</span>` : ''}
              ${typeof statusTagHTML === 'function' ? statusTagHTML(p) : `<span class="tag ${statusTagCls(p.status)}">${esc(p.status)}</span>`}
            </div>
            <h2 style="margin:4px 0 6px;font-size:20px">${esc(p.project_name)}</h2>
            <div class="item-meta">
              預算：<strong>${fmtMoney(p.budget_amount)}</strong>
              ｜原決標：<strong>${p.award_amount ? fmtMoney(p.award_amount) : '未決標'}</strong>
              ${isEng && eng.effectiveContract > 0 ? `｜現行有效契約：<strong style="color:${eng.isOverBudget?'var(--red)':'var(--primary)'}">${fmtMoney(eng.effectiveContract)}</strong>${eng.approvedNet!==0?`（變更 ${eng.approvedNet>0?'+':''}${eng.approvedNet.toLocaleString('zh-TW')}｜追加 ${eng.addRatioPct}%）`:''}` : ''}
            </div>
            <div class="item-meta">
              承造／得標：<strong>${esc(p.vendor_name || '尚未決標')}</strong>
              ${p.supervisor_contact ? `｜監造：${esc(p.supervisor_contact)}` : ''}
              ${p.designer_contact ? `｜設計：${esc(p.designer_contact)}` : ''}
            </div>
            <div class="item-meta">
              開工／履約：${esc(p.start_date || '-')} ~ 原訂 ${esc(p.orig_end_date || '-')}
              ${isEng && eng.approvedDays !== 0 ? ` → <strong style="color:var(--primary)">修正完工 ${esc(eng.revisedEndDate)}（${eng.approvedDays>0?'+':''}${eng.approvedDays}天）</strong>` : ''}
              ${p.grant_deadline ? `｜<span style="color:var(--red);font-weight:700">補助死線：${esc(p.grant_deadline)}</span>` : ''}
              ${p.warranty_end_date ? `｜保固至：${esc(p.warranty_end_date)}` : ''}
              ${p.drive_folder_url ? `｜<a href="${esc(p.drive_folder_url)}" target="_blank">📁 雲端資料夾</a>` : ''}
            </div>
          </div>
          <div style="text-align:right;min-width:150px">
            <div style="font-size:12px;color:var(--muted)">流程檢核完成率</div>
            <div style="font-size:24px;font-weight:800;color:var(--primary)">${prog.pct}%</div>
            <div class="item-meta">${prog.doneChecks} / ${prog.totalChecks} 項</div>
            ${isEng && eng.effectiveContract > 0 ? `<div class="item-meta">計價執行：<strong>${eng.payExecPct}%</strong></div>` : ''}
          </div>
        </div>
      </div>
    </div>

    <div class="eng-subtabs">
      <button class="${selectedProjectSubtab === 'checklist' ? 'btn-primary' : ''}" onclick="selectedProjectSubtab='checklist';renderCurrentView()">✅ 流程階段與 Checklist</button>
      ${isEng ? `
        <button class="${selectedProjectSubtab === 'materials' ? 'btn-primary' : ''}" onclick="selectedProjectSubtab='materials';renderCurrentView()">🧱 材料送審管制 (${eng.approvedMats}/${eng.mats.length})</button>
        <button class="${selectedProjectSubtab === 'responsibilities' ? 'btn-primary' : ''}" onclick="selectedProjectSubtab='responsibilities';renderCurrentView()">👥 附表二權責分工 (${eng.doneRespsCount}/${eng.activeRespsCount})</button>
        <button class="${selectedProjectSubtab === 'changes' ? 'btn-primary' : ''}" onclick="selectedProjectSubtab='changes';renderCurrentView()">📐 變更設計與工期 (${eng.changes.length})</button>
        <button class="${selectedProjectSubtab === 'billings' ? 'btn-primary' : ''}" onclick="selectedProjectSubtab='billings';renderCurrentView()">💰 分期估驗計價 (${eng.billings.length})</button>
      ` : ''}
      <button class="${selectedProjectSubtab === 'gantt' ? 'btn-primary' : ''}" onclick="selectedProjectSubtab='gantt';renderCurrentView()">📊 單案甘特圖預覽</button>
    </div>

    ${subContent}
  `;
};

// 升級標案編輯彈窗（補上四方聯絡人、監造模式、附表二工程類別、保留款比例）
openEditProjectModal = function(projectId) {
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
  if (!p) return;
  openModal('✎ 編輯標案基本資料、四方角色與關鍵日期', `
    <div class="form-grid">
      <div class="field full"><label>標案名稱</label><input id="ep-name" type="text" value="${esc(p.project_name)}"></div>
      <div class="field"><label>案件狀態</label>
        <select id="ep-status">${['籌備中','招標中','履約中','驗收中','保固追蹤中','已結案','廢標撤案'].map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label>原決標金額（鎖定契約基準不覆蓋）</label><input id="ep-award" type="number" value="${esc(p.award_amount)}"></div>
      <div class="field"><label>預算金額（元）</label><input id="ep-budget" type="number" value="${esc(p.budget_amount)}"></div>
      <div class="field"><label>保留款比例（預設 0.05 即 5%）</label><input id="ep-ret" type="number" step="0.01" value="${esc(p.retention_rate !== '' ? p.retention_rate : 0.05)}"></div>
      <div class="field"><label>附表二工程類別</label>
        <select id="ep-engcat">${['一般公共工程','公有建築物','不適用'].map(s=>`<option value="${s}" ${p.engineering_category===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label>監造模式（影響材料審查關卡）</label>
        <select id="ep-supmode">${['委外監造','自辦監造','不適用'].map(s=>`<option value="${s}" ${p.supervision_mode===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label>承造人／得標廠商</label><input id="ep-vendor" type="text" value="${esc(p.vendor_name)}"></div>
      <div class="field"><label>廠商窗口與電話</label><input id="ep-vcontact" type="text" value="${esc(p.vendor_contact)}"></div>
      <div class="field"><label>設計人與聯絡方式</label><input id="ep-designer" type="text" value="${esc(p.designer_contact)}" placeholder="例：XX建築師事務所／王建築師"></div>
      <div class="field"><label>監造人與聯絡方式</label><input id="ep-supervisor" type="text" value="${esc(p.supervisor_contact)}" placeholder="例：XX技師事務所／林監造"></div>
      <div class="field"><label>開工／履約起日</label><input id="ep-start" type="date" value="${esc(p.start_date)}"></div>
      <div class="field"><label>原訂完工／迄日（鎖定基準）</label><input id="ep-end" type="date" value="${esc(p.orig_end_date)}"></div>
      <div class="field"><label>實際竣工日</label><input id="ep-comp" type="date" value="${esc(p.actual_completion_date)}"></div>
      <div class="field"><label>驗收合格日</label><input id="ep-acc" type="date" value="${esc(p.acceptance_date)}"></div>
      <div class="field"><label>保固年限（年）</label><input id="ep-wyr" type="number" value="${esc(p.warranty_years || 1)}"></div>
      <div class="field"><label>保固到期日（留空則由驗收日自動算）</label><input id="ep-wend" type="date" value="${esc(p.warranty_end_date)}"></div>
      <div class="field"><label>補助核銷死線</label><input id="ep-gdl" type="date" value="${esc(p.grant_deadline)}"></div>
      <div class="field"><label>雲端資料夾網址（Google Drive）</label><input id="ep-drive" type="url" value="${esc(p.drive_folder_url)}"></div>
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveEditProject('${esc(projectId)}')">儲存變更</button>
  `);
};

saveEditProject = async function(projectId) {
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
  if (!p) return;
  p.project_name = document.getElementById('ep-name').value.trim() || p.project_name;
  p.status = document.getElementById('ep-status').value;
  p.award_amount = Number(document.getElementById('ep-award').value) || '';
  p.budget_amount = Number(document.getElementById('ep-budget').value) || 0;
  p.retention_rate = Number(document.getElementById('ep-ret').value);
  if (isNaN(p.retention_rate)) p.retention_rate = 0.05;
  p.engineering_category = document.getElementById('ep-engcat').value;
  p.supervision_mode = document.getElementById('ep-supmode').value;
  p.vendor_name = document.getElementById('ep-vendor').value.trim();
  p.vendor_contact = document.getElementById('ep-vcontact').value.trim();
  p.designer_contact = document.getElementById('ep-designer').value.trim();
  p.supervisor_contact = document.getElementById('ep-supervisor').value.trim();
  p.start_date = document.getElementById('ep-start').value;
  p.orig_end_date = document.getElementById('ep-end').value;
  p.actual_completion_date = document.getElementById('ep-comp').value;
  p.acceptance_date = document.getElementById('ep-acc').value;
  p.warranty_years = Number(document.getElementById('ep-wyr').value) || 1;
  let wEnd = document.getElementById('ep-wend').value;
  if (!wEnd && p.acceptance_date) {
    const dt = new Date(p.acceptance_date + 'T00:00:00');
    dt.setFullYear(dt.getFullYear() + p.warranty_years);
    wEnd = fmtDate(dt);
  }
  p.warranty_end_date = wEnd;
  p.grant_deadline = document.getElementById('ep-gdl').value;
  p.drive_folder_url = document.getElementById('ep-drive').value.trim();
  p.updated_at = nowStr();

  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Projects', record: p });
  toast('✅ 已更新標案與工程角色設定');
};

const _origDeleteProject = deleteProject;
deleteProject = async function(projectId) {
  await _origDeleteProject(projectId);
  ['Project_Materials', 'Project_ChangeOrders', 'Project_Billings', 'Project_Responsibilities'].forEach(tb => {
    appData.tables[tb] = (appData.tables[tb] || []).filter(r => r.project_id !== projectId);
  });
  persistCache();
};

// ----------------------------------------------------------------------------
// 4. 頁籤一：工程材料設備送審管制 (Project_Materials)
// ----------------------------------------------------------------------------
function renderMaterialsTabHTML(p, eng) {
  const today = todayStr();
  const isSelfSup = p.supervision_mode === '自辦監造';
  const filtered = eng.mats.filter(m => {
    if (matFilter === 'overdue') return (m.status === '待送審' || m.status === '退回修正') && m.submit_deadline && diffDays(today, m.submit_deadline) < 0;
    if (matFilter === 'review') return m.status === '監造審查中' || m.status === '機關核備中';
    if (matFilter === 'revise') return m.status === '退回修正';
    if (matFilter === 'green') return !!m.is_green_material;
    return true;
  });

  return `
    <div class="eng-kpi-row">
      <div class="eng-stat"><div class="lbl">管制材料總項數</div><div class="val">${eng.mats.length}</div></div>
      <div class="eng-stat"><div class="lbl">已核定／待進場</div><div class="val" style="color:var(--primary)">${eng.approvedMats}</div></div>
      <div class="eng-stat"><div class="lbl">進場抽驗合格</div><div class="val" style="color:var(--green)">${eng.inspectedMats}</div></div>
      <div class="eng-stat"><div class="lbl">逾期未送審</div><div class="val" style="color:${eng.overdueMats?'var(--red)':'var(--muted)'}">${eng.overdueMats}</div></div>
      <div class="eng-stat"><div class="lbl">🌿 綠色採購品項</div><div class="val" style="color:#047857">${eng.greenMats}</div></div>
    </div>

    <div class="panel">
      <div class="panel-hd">
        <h3>🧱 材料設備送審與進場抽驗管制（${isSelfSup ? '自辦監造精簡流程' : '三級品管標準流程'}）</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-sm" onclick="printMaterialsPDF('${esc(p.project_id)}')">🖨️ 輸出管制總表 PDF</button>
          <button class="btn-sm btn-primary" onclick="openMaterialModal('${esc(p.project_id)}')">＋ 新增送審材料</button>
        </div>
      </div>
      <div class="panel-bd">
        <div class="filter-bar">
          ${[
            ['all', `全部 (${eng.mats.length})`],
            ['overdue', `🔴 逾期未送 (${eng.overdueMats})`],
            ['review', '⏳ 審查核備中'],
            ['revise', '↩️ 退回修正'],
            ['green', `🌿 綠建材 (${eng.greenMats})`]
          ].map(([k, lbl]) => `<button class="pill-btn ${matFilter===k?'active':''}" onclick="matFilter='${k}';renderCurrentView()">${lbl}</button>`).join('')}
        </div>

        <div style="overflow-x:auto">
          ${filtered.length ? `
            <table>
              <thead>
                <tr>
                  <th>材料／設備名稱與標記</th>
                  <th>預計進場／死線</th>
                  <th>版次與狀態</th>
                  <th>必備文件與試驗</th>
                  <th>歷次軌跡</th>
                  <th>快速流轉操作</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(m => {
                  const docs = parseJSON(m.docs_check_json, {});
                  const hist = parseJSON(m.review_history_json, []);
                  const isOver = (m.status === '待送審' || m.status === '退回修正') && m.submit_deadline && diffDays(today, m.submit_deadline) < 0;
                  const stCls = m.status === '進場檢驗合格' ? 'tag-green'
                    : (m.status === '退回修正' || isOver ? 'tag-red'
                    : (m.status === '已核定' ? 'tag-blue' : 'tag-amber'));
                  return `
                    <tr>
                      <td>
                        <strong>${esc(m.item_name)}</strong>
                        <div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap">
                          ${m.is_equivalent ? '<span class="tag tag-amber">同等品</span>' : ''}
                          ${m.is_green_material ? '<span class="tag tag-green">🌿 綠建材</span>' : ''}
                          ${m.need_lab_test ? `<span class="tag ${m.lab_test_passed?'tag-green':'tag-red'}">${m.lab_test_passed?'✓ 試驗合格':'須取樣送驗'}</span>` : ''}
                          ${m.drive_file_url ? `<a class="tag tag-blue" href="${esc(m.drive_file_url)}" target="_blank">📎 型錄/報告</a>` : ''}
                        </div>
                      </td>
                      <td style="white-space:nowrap">
                        <div>進場：${esc(m.plan_arrival_date || '-')}</div>
                        <div class="item-meta" style="${isOver?'color:var(--red);font-weight:700':''}">死線：${esc(m.submit_deadline || '-')}</div>
                      </td>
                      <td style="white-space:nowrap">
                        <span class="tag tag-gray">Rev.${Number(m.revision_no) || 0}</span>
                        <span class="tag ${stCls}">${esc(m.status)}</span>
                        <div class="item-meta">
                          ${m.submitted_date ? `送:${m.submitted_date}` : ''}
                          ${m.approved_date ? ` 核:${m.approved_date}` : ''}
                          ${m.inspected_date ? ` 驗:${m.inspected_date}` : ''}
                        </div>
                      </td>
                      <td>
                        <div class="doc-chips">
                          ${MATERIAL_DOCS.map(d => `<span class="doc-chip ${docs[d.key]?'ok':''}">${docs[d.key]?'✓':''}${d.label}</span>`).join('')}
                        </div>
                      </td>
                      <td style="max-width:190px">
                        <div class="item-meta">${hist.length ? esc(hist[hist.length-1].date + ' ' + hist[hist.length-1].note) : '尚無退修紀錄'}</div>
                      </td>
                      <td style="white-space:nowrap">
                        ${renderMaterialActionsHTML(m, isSelfSup)}
                        <button class="btn-xs" onclick="openMaterialModal('${esc(p.project_id)}','${esc(m.material_id)}')">✎</button>
                        <button class="btn-xs btn-danger" onclick="deleteMaterial('${esc(m.material_id)}')">刪</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : '<div class="empty-state">目前沒有符合篩選條件的材料送審紀錄，點擊「＋ 新增送審材料」開始管制。</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderMaterialActionsHTML(m, isSelfSup) {
  const id = esc(m.material_id);
  if (m.status === '待送審') {
    const nextSt = isSelfSup ? '機關核備中' : '監造審查中';
    return `<button class="btn-xs btn-primary" onclick="advanceMaterial('${id}','${nextSt}')">廠商提送 →</button>`;
  }
  if (m.status === '監造審查中') {
    return `<button class="btn-xs btn-primary" onclick="advanceMaterial('${id}','機關核備中')">監造轉陳 →</button>
            <button class="btn-xs btn-danger" onclick="rejectMaterial('${id}','監造單位')">退件</button>`;
  }
  if (m.status === '退回修正') {
    const nextSt = isSelfSup ? '機關核備中' : '監造審查中';
    return `<button class="btn-xs btn-primary" onclick="resubmitMaterial('${id}','${nextSt}')">重送(Rev+1)</button>`;
  }
  if (m.status === '機關核備中') {
    return `<button class="btn-xs btn-success" onclick="advanceMaterial('${id}','已核定')">機關核定 ✓</button>
            <button class="btn-xs btn-danger" onclick="rejectMaterial('${id}','機關退補件')">退件</button>`;
  }
  if (m.status === '已核定') {
    return `<button class="btn-xs btn-success" onclick="inspectMaterial('${id}')">進場抽驗合格 ✓</button>`;
  }
  return `<span class="tag tag-green">已結案歸檔</span>`;
}

function openMaterialModal(projectId, materialId = '') {
  const m = materialId ? (appData.tables.Project_Materials || []).find(x => x.material_id === materialId) : {};
  const docs = parseJSON(m.docs_check_json, {});
  const hist = parseJSON(m.review_history_json, []);

  openModal(materialId ? '✎ 編輯材料送審資料' : '＋ 新增工程材料／設備送審管制', `
    <div class="form-grid">
      <div class="field full"><label>材料／設備名稱與規格 *</label><input id="mat-name" type="text" value="${esc(m.item_name || '')}" placeholder="例：30×30cm 防滑地磚（CNS 9737）"></div>
      <div class="field"><label>預計進場日</label><input id="mat-arr" type="date" value="${esc(m.plan_arrival_date || '')}" onchange="autoCalcMatDeadline()"></div>
      <div class="field"><label>最晚應送審日（預設前15日／同等品前30日）</label><input id="mat-dl" type="date" value="${esc(m.submit_deadline || '')}"></div>
      <div class="field"><label>目前審查狀態</label>
        <select id="mat-status">${['待送審','監造審查中','退回修正','機關核備中','已核定','進場檢驗合格'].map(s=>`<option value="${s}" ${(m.status||'待送審')===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label>送審版次（0 代表 Rev.0）</label><input id="mat-rev" type="number" min="0" value="${Number(m.revision_no) || 0}"></div>
      <div class="field full">
        <label>屬性標記</label>
        <div class="check-group">
          <label><input type="checkbox" id="mat-eq" ${m.is_equivalent?'checked':''} onchange="autoCalcMatDeadline()"> 同等品送審（附表二第11項）</label>
          <label><input type="checkbox" id="mat-lab" ${m.need_lab_test?'checked':''}> 須取樣送實驗室試驗</label>
          <label><input type="checkbox" id="mat-labok" ${m.lab_test_passed?'checked':''}> 試驗報告已合格</label>
          <label><input type="checkbox" id="mat-green" ${m.is_green_material?'checked':''}> 🌿 屬綠色採購／綠建材項目</label>
        </div>
      </div>
      <div class="field full">
        <label>必備文件勾稽</label>
        <div class="check-group">
          ${MATERIAL_DOCS.map(d => `<label><input type="checkbox" id="mdoc-${d.key}" ${docs[d.key]?'checked':''}> ${d.label}</label>`).join('')}
        </div>
      </div>
      <div class="field full"><label>Google Drive 型錄／試驗報告／抽驗照片連結</label><input id="mat-url" type="url" value="${esc(m.drive_file_url || '')}" placeholder="https://drive.google.com/..."></div>
      ${hist.length ? `<div class="field full"><label>歷次審查與退件軌跡（唯讀存證）</label><div class="lessons-box" style="margin:0">${hist.map(h=>`• [Rev.${h.rev}] ${esc(h.date)} (${esc(h.actor)})：${esc(h.note)}`).join('\n')}</div></div>` : ''}
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveMaterial('${esc(projectId)}','${esc(materialId)}')">儲存材料紀錄</button>
  `);
}

function autoCalcMatDeadline() {
  const arr = document.getElementById('mat-arr')?.value;
  const isEq = document.getElementById('mat-eq')?.checked;
  const dlEl = document.getElementById('mat-dl');
  if (arr && dlEl && !dlEl.value) {
    dlEl.value = addDays(arr, isEq ? -30 : -15);
  }
}

async function saveMaterial(projectId, materialId) {
  const name = document.getElementById('mat-name').value.trim();
  if (!name) return toast('請輸入材料／設備名稱');
  const existing = materialId ? (appData.tables.Project_Materials || []).find(x => x.material_id === materialId) : {};
  const docs = {};
  MATERIAL_DOCS.forEach(d => { docs[d.key] = !!document.getElementById('mdoc-' + d.key)?.checked; });
  const arr = document.getElementById('mat-arr').value;
  const isEq = document.getElementById('mat-eq').checked;
  let dl = document.getElementById('mat-dl').value;
  if (!dl && arr) dl = addDays(arr, isEq ? -30 : -15);

  const rec = {
    ...existing,
    material_id: materialId || nextId('Project_Materials', 'material_id', 'MAT', 4),
    project_id: projectId,
    item_name: name,
    is_equivalent: isEq,
    plan_arrival_date: arr,
    submit_deadline: dl,
    revision_no: Number(document.getElementById('mat-rev').value) || 0,
    status: document.getElementById('mat-status').value,
    submitted_date: existing.submitted_date || '',
    supervisor_done_date: existing.supervisor_done_date || '',
    approved_date: existing.approved_date || '',
    inspected_date: existing.inspected_date || '',
    docs_check_json: JSON.stringify(docs),
    need_lab_test: document.getElementById('mat-lab').checked,
    lab_test_passed: document.getElementById('mat-labok').checked,
    is_green_material: document.getElementById('mat-green').checked,
    review_history_json: existing.review_history_json || '[]',
    drive_file_url: document.getElementById('mat-url').value.trim(),
    updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Project_Materials', rec, 'material_id');
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_Materials', record: rec });
  toast('✅ 已儲存材料送審紀錄');
}

async function advanceMaterial(id, nextStatus) {
  const m = (appData.tables.Project_Materials || []).find(x => x.material_id === id);
  if (!m) return;
  const today = todayStr();
  const hist = parseJSON(m.review_history_json, []);
  if (m.status === '待送審') m.submitted_date = today;
  if (nextStatus === '機關核備中' && m.status === '監造審查中') m.supervisor_done_date = today;
  if (nextStatus === '已核定') m.approved_date = today;
  m.status = nextStatus;
  hist.push({ rev: Number(m.revision_no)||0, date: today, actor: '系統流轉', note: `進入「${nextStatus}」` });
  m.review_history_json = JSON.stringify(hist);
  m.updated_at = nowStr();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_Materials', record: m });
  toast(`✅ ${m.item_name} → ${nextStatus}`);
}

async function rejectMaterial(id, actor) {
  const reason = prompt(`請輸入【${actor}】退回修正原因（將永久留存作為工期歸責佐證）：`);
  if (!reason || !reason.trim()) return;
  const m = (appData.tables.Project_Materials || []).find(x => x.material_id === id);
  if (!m) return;
  const hist = parseJSON(m.review_history_json, []);
  hist.push({ rev: Number(m.revision_no)||0, date: todayStr(), actor, note: '退件：' + reason.trim() });
  m.status = '退回修正';
  m.review_history_json = JSON.stringify(hist);
  m.updated_at = nowStr();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_Materials', record: m });
  toast('↩️ 已登記退回修正並留存軌跡');
}

async function resubmitMaterial(id, nextStatus) {
  const m = (appData.tables.Project_Materials || []).find(x => x.material_id === id);
  if (!m) return;
  const today = todayStr();
  m.revision_no = (Number(m.revision_no) || 0) + 1;
  m.submitted_date = today;
  m.status = nextStatus;
  const hist = parseJSON(m.review_history_json, []);
  hist.push({ rev: m.revision_no, date: today, actor: '承造人', note: `修正重新提送 Rev.${m.revision_no}` });
  m.review_history_json = JSON.stringify(hist);
  m.updated_at = nowStr();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_Materials', record: m });
  toast(`✅ 已重新提送為 Rev.${m.revision_no}`);
}

async function inspectMaterial(id) {
  const m = (appData.tables.Project_Materials || []).find(x => x.material_id === id);
  if (!m) return;
  if (m.need_lab_test && !m.lab_test_passed) {
    if (!confirm('此材料標記「須取樣送驗」但尚未勾選試驗合格，是否確認已取得合格報告並同步標記試驗合格？')) return;
    m.lab_test_passed = true;
  }
  const today = todayStr();
  m.status = '進場檢驗合格';
  m.inspected_date = today;
  const hist = parseJSON(m.review_history_json, []);
  hist.push({ rev: Number(m.revision_no)||0, date: today, actor: '監造/機關', note: '進場抽驗合格並歸檔' });
  m.review_history_json = JSON.stringify(hist);
  m.updated_at = nowStr();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_Materials', record: m });
  toast('✅ 已完成進場抽驗合格');
}

async function deleteMaterial(id) {
  if (!confirm('確定刪除此材料送審項目？')) return;
  appData.tables.Project_Materials = appData.tables.Project_Materials.filter(m => m.material_id !== id);
  renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Project_Materials', id });
}

function printMaterialsPDF(projectId) {
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
  if (!p) return;
  const eng = calcEngineeringSummary(projectId);
  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <div>
        <div style="font-size:12px;color:#475569">${esc(appData.schoolName)} ｜ 工程材料設備送審管制總表</div>
        <h2 style="margin:2px 0 0;font-size:17px">${esc(p.project_name)}（${esc(typeof formatProjectCaseNo === 'function' ? formatProjectCaseNo(p) : p.project_id)}）</h2>
      </div>
      <div style="text-align:right;font-size:11px;color:#475569">
        <div>總項數：${eng.mats.length} ｜ 核定：${eng.approvedMats} ｜ 抽驗合格：${eng.inspectedMats} ｜ 綠建材：${eng.greenMats}</div>
        <div>列印日期：${todayStr()}</div>
      </div>
    </div>
    <table class="print-table">
      <thead>
        <tr>
          <th style="width:32px">項次</th>
          <th style="width:190px">材料／設備名稱與規格</th>
          <th style="width:74px">預計進場</th>
          <th style="width:74px">送審死線</th>
          <th style="width:45px">版次</th>
          <th style="width:155px">送審與核定日期軌跡</th>
          <th style="width:140px">文件與試驗勾稽</th>
          <th style="width:75px">目前狀態</th>
          <th>歷次退件與查驗備註</th>
        </tr>
      </thead>
      <tbody>
        ${eng.mats.map((m, i) => {
          const docs = parseJSON(m.docs_check_json, {});
          const hist = parseJSON(m.review_history_json, []);
          const docStr = MATERIAL_DOCS.filter(d => docs[d.key]).map(d => d.label).join('、') || '-';
          const lastNote = hist.map(h => `[R${h.rev} ${h.date}] ${h.note}`).slice(-2).join('\n');
          return `<tr>
            <td style="text-align:center">${i + 1}</td>
            <td><strong>${esc(m.item_name)}</strong>${m.is_equivalent?' [同等品]':''}${m.is_green_material?' [綠建材]':''}</td>
            <td style="text-align:center">${esc(m.plan_arrival_date || '-')}</td>
            <td style="text-align:center">${esc(m.submit_deadline || '-')}</td>
            <td style="text-align:center">Rev.${Number(m.revision_no)||0}</td>
            <td>提送：${esc(m.submitted_date||'-')}<br>監造：${esc(m.supervisor_done_date||'-')}<br>核定：${esc(m.approved_date||'-')} ／ 抽驗：${esc(m.inspected_date||'-')}</td>
            <td>${esc(docStr)}${m.need_lab_test ? `<br>取樣試驗：${m.lab_test_passed?'合格':'未完成'}` : ''}</td>
            <td style="text-align:center;font-weight:700">${esc(m.status)}</td>
            <td style="white-space:pre-line">${esc(lastNote || '-')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
  setTimeout(() => window.print(), 80);
}

// ----------------------------------------------------------------------------
// 5. 頁籤二：附表二四方權責分工控管 (Project_Responsibilities)
// ----------------------------------------------------------------------------
function renderResponsibilitiesTabHTML(p, eng) {
  if (!eng.resps.length) {
    const defCat = p.engineering_category === '公有建築物' ? '公有建築物' : '一般公共工程';
    return `
      <div class="panel">
        <div class="panel-hd"><h3>👥 初始化「公共工程施工階段契約約定權責分工表（無專案管理）」</h3></div>
        <div class="panel-bd">
          <p style="margin-top:0">本標案尚未載入附表二 50 項四方權責分工（開工前 11 項、施工階段 28 項、完工驗收 11 項）。請確認適用表別並點擊一鍵建立：</p>
          <div class="form-grid" style="max-width:620px;margin-bottom:14px">
            <div class="field">
              <label>適用附表二類型</label>
              <select id="init-resp-cat">
                <option value="一般公共工程" ${defCat==='一般公共工程'?'selected':''}>一般公共工程（非建築物：球場／跑道／鋪面）</option>
                <option value="公有建築物" ${defCat==='公有建築物'?'selected':''}>公有建築物（校舍建物／廁所整修）</option>
              </select>
            </div>
            <div class="field" style="justify-content:flex-end">
              <label><input type="checkbox" id="init-resp-fold" checked> 預設將建管勘驗／使照／土資場／丁類危評標記為「本案免辦」</label>
            </div>
          </div>
          <button class="btn-primary" onclick="initProjectResponsibilities('${esc(p.project_id)}')">⚡ 一鍵載入附表二 50 項權責分工表</button>
        </div>
      </div>
    `;
  }

  const phaseOrder = { '工程開(施)工前': 1, '工程施工階段': 2, '工程完工驗收階段': 3 };
  const list = eng.resps
    .filter(r => respShowExempt || !r.is_exempt)
    .filter(r => respPhaseFilter === 'all' || r.phase_name === respPhaseFilter)
    .filter(r => respHolderFilter === 'all' || r.current_holder === respHolderFilter)
    .sort((a, b) => (phaseOrder[a.phase_name] - phaseOrder[b.phase_name]) || (Number(a.item_no) - Number(b.item_no)));

  return `
    <div class="eng-kpi-row">
      <div class="eng-stat"><div class="lbl">本案應辦／已完成</div><div class="val" style="color:var(--green)">${eng.doneRespsCount} / ${eng.activeRespsCount}</div></div>
      <div class="eng-stat" style="cursor:pointer" onclick="respHolderFilter='承造人';renderCurrentView()"><div class="lbl">👷 球在承造人（廠商）</div><div class="val" style="color:var(--primary)">${eng.holderCounts['承造人']}</div></div>
      <div class="eng-stat" style="cursor:pointer" onclick="respHolderFilter='監造人';renderCurrentView()"><div class="lbl">📐 球在監造人</div><div class="val" style="color:var(--amber)">${eng.holderCounts['監造人']}</div></div>
      <div class="eng-stat" style="cursor:pointer" onclick="respHolderFilter='設計人';renderCurrentView()"><div class="lbl">✏️ 球在設計人</div><div class="val">${eng.holderCounts['設計人']}</div></div>
      <div class="eng-stat" style="cursor:pointer" onclick="respHolderFilter='起造人(學校)';renderCurrentView()"><div class="lbl">🏫 球在學校（待核定/辦理）</div><div class="val" style="color:var(--red)">${eng.holderCounts['起造人(學校)']}</div></div>
    </div>

    <div class="panel">
      <div class="panel-hd">
        <h3>👥 附表二四方權責分工接力追蹤（${esc(p.engineering_category || '一般公共工程')}）</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-sm" onclick="printResponsibilitiesPDF('${esc(p.project_id)}','contract')">🖨️ 契約附件版 PDF</button>
          <button class="btn-sm btn-primary" onclick="printResponsibilitiesPDF('${esc(p.project_id)}','audit')">🖨️ 履約查核版 PDF</button>
        </div>
      </div>
      <div class="panel-bd">
        <div class="filter-bar">
          ${['all','工程開(施)工前','工程施工階段','工程完工驗收階段'].map(ph =>
            `<button class="pill-btn ${respPhaseFilter===ph?'active':''}" onclick="respPhaseFilter='${ph}';renderCurrentView()">${ph==='all'?'全部期程':ph}</button>`
          ).join('')}
          <select style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px" onchange="respHolderFilter=this.value;renderCurrentView()">
            ${[['all','全部球權'],['起造人(學校)','🏫 只看學校待辦'],['承造人','👷 催辦承造人'],['監造人','📐 催辦監造人'],['設計人','✏️ 催辦設計人'],['已完成','✅ 已完成']].map(([v,l])=>`<option value="${v}" ${respHolderFilter===v?'selected':''}>${l}</option>`).join('')}
          </select>
          <label style="font-size:12px;margin-left:auto;cursor:pointer"><input type="checkbox" ${respShowExempt?'checked':''} onchange="respShowExempt=this.checked;renderCurrentView()"> 顯示本案免辦項 (${eng.resps.length - eng.activeRespsCount})</label>
        </div>

        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>期程／項次</th>
                <th>工作項目與法規依據</th>
                <th>業主(校)</th>
                <th>設計</th>
                <th>監造</th>
                <th>承造</th>
                <th>目前球權</th>
                <th>約定期限與接力紀錄</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(r => {
                const rm = parseJSON(r.roles_matrix_json, {});
                const sla = parseJSON(r.sla_days_json, {});
                const rd = parseJSON(r.relay_dates_json, {});
                const linkTab = r.linked_module === 'Materials' ? 'materials'
                  : r.linked_module === 'ChangeOrders' ? 'changes'
                  : r.linked_module === 'Billings' ? 'billings' : '';
                return `
                  <tr style="${r.is_exempt ? 'opacity:.45;background:#f8fafc' : ''}">
                    <td style="white-space:nowrap">
                      <span class="tag tag-gray">${esc(r.phase_name.replace('工程',''))} #${r.item_no}</span>
                    </td>
                    <td>
                      <strong>${esc(r.item_name)}</strong>
                      ${r.has_penalty ? '<span class="tag tag-red" style="margin-left:4px" title="附表二備註：未於時程完成期限內辦理應予懲罰">罰則</span>' : ''}
                      ${linkTab ? `<button class="btn-xs" style="margin-left:4px;color:var(--primary)" onclick="selectedProjectSubtab='${linkTab}';renderCurrentView()">🔗 前往${r.linked_module==='Materials'?'材料':r.linked_module==='ChangeOrders'?'變更':'計價'}</button>` : ''}
                      <div class="item-meta">${esc(r.contract_basis || '')} ${r.doc_ref ? '｜文號：' + esc(r.doc_ref) : ''}</div>
                    </td>
                    <td>${roleBadgeHTML(rm.owner)}</td>
                    <td>${roleBadgeHTML(rm.designer)}</td>
                    <td>${roleBadgeHTML(rm.supervisor)}</td>
                    <td>${roleBadgeHTML(rm.contractor)}</td>
                    <td>
                      <select style="padding:3px 5px;border:1px solid #cbd5e1;border-radius:5px;font-size:12px" onchange="updateRespHolder('${esc(r.resp_id)}',this.value)">
                        ${['承造人','監造人','設計人','起造人(學校)','已完成','免辦'].map(h=>`<option value="${h}" ${r.current_holder===h?'selected':''}>${h}</option>`).join('')}
                      </select>
                    </td>
                    <td style="max-width:210px">
                      <div class="item-meta">${esc(sla.text || '')}</div>
                      ${(rd.submit || rd.review || rd.approve) ? `<div class="item-meta" style="color:var(--primary)">送:${rd.submit||'-'} 審:${rd.review||'-'} 核:${rd.approve||'-'}</div>` : ''}
                    </td>
                    <td style="white-space:nowrap">
                      <button class="btn-xs" onclick="openRespModal('${esc(r.resp_id)}')">✎ 期限/日期</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function roleBadgeHTML(verb) {
  if (!verb) return '<span style="color:#cbd5e1">-</span>';
  const cls = verb.includes('辦理') ? 'role-do' : (verb.includes('核定') ? 'role-app' : (verb.includes('審查') ? 'role-rev' : 'role-ref'));
  return `<span class="role-badge ${cls}">${esc(verb)}</span>`;
}

async function initProjectResponsibilities(projectId) {
  const cat = document.getElementById('init-resp-cat')?.value || '一般公共工程';
  const autoFold = !!document.getElementById('init-resp-fold')?.checked;
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
  if (p) p.engineering_category = cat;

  let seqBase = 0;
  (appData.tables.Project_Responsibilities || []).forEach(r => {
    const m = String(r.resp_id || '').match(/(\d+)$/);
    if (m) seqBase = Math.max(seqBase, parseInt(m[1], 10));
  });

  const recs = RESP_TEMPLATE_50.map((row, idx) => {
    const [itemNo, phase, nameGen, nameBld, basis, owner, designer, supervisor, contractor, hasPenalty, linkedMod, defExempt, defSla] = row;
    const isExempt = autoFold && defExempt;
    let initHolder = '承造人';
    if (isExempt) initHolder = '免辦';
    else if (contractor === '辦理') initHolder = '承造人';
    else if (supervisor === '辦理') initHolder = '監造人';
    else if (designer === '辦理') initHolder = '設計人';
    else if (owner === '辦理') initHolder = '起造人(學校)';

    return {
      resp_id: `RSP-${String(seqBase + idx + 1).padStart(4, '0')}`,
      project_id: projectId,
      phase_name: phase,
      item_no: itemNo,
      item_name: cat === '公有建築物' ? nameBld : nameGen,
      contract_basis: basis,
      roles_matrix_json: JSON.stringify({ owner, designer, supervisor, contractor }),
      linked_module: linkedMod,
      is_exempt: isExempt,
      has_penalty: hasPenalty,
      sla_days_json: JSON.stringify({ text: defSla }),
      relay_dates_json: JSON.stringify({ submit: '', review: '', approve: '' }),
      current_holder: initHolder,
      doc_ref: '',
      note: hasPenalty ? '未於時程完成期限內辦理，應予懲罰。' : '',
      updated_at: nowStr(), is_deleted: false
    };
  });

  recs.forEach(r => upsertLocal('Project_Responsibilities', r, 'resp_id'));
  renderCurrentView();
  const items = [{ table: 'Project_Responsibilities', records: recs }];
  if (p) items.push({ table: 'Projects', records: [p] });
  await pushToCloud({ action: 'batchUpsert', items });
  toast(`✅ 已載入附表二 50 項權責分工表（${cat}）`);
}

async function updateRespHolder(respId, holder) {
  const r = (appData.tables.Project_Responsibilities || []).find(x => x.resp_id === respId);
  if (!r) return;
  r.current_holder = holder;
  r.is_exempt = (holder === '免辦');
  r.updated_at = nowStr();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_Responsibilities', record: r });
}

function openRespModal(respId) {
  const r = (appData.tables.Project_Responsibilities || []).find(x => x.resp_id === respId);
  if (!r) return;
  const sla = parseJSON(r.sla_days_json, {});
  const rd = parseJSON(r.relay_dates_json, {});
  openModal(`✎ 編輯權責分工項目（${r.phase_name} #${r.item_no}）`, `
    <div class="form-grid">
      <div class="field full"><label>工作項目名稱</label><input id="rsp-name" type="text" value="${esc(r.item_name)}"></div>
      <div class="field full"><label>契約約定各單位完成期限</label><input id="rsp-sla" type="text" value="${esc(sla.text || '')}"></div>
      <div class="field"><label>辦理方提送日期</label><input id="rsp-d1" type="date" value="${esc(rd.submit || '')}"></div>
      <div class="field"><label>監造／審查完成日期</label><input id="rsp-d2" type="date" value="${esc(rd.review || '')}"></div>
      <div class="field"><label>機關核定／備查日期</label><input id="rsp-d3" type="date" value="${esc(rd.approve || '')}"></div>
      <div class="field"><label>核定／備查公文文號</label><input id="rsp-doc" type="text" value="${esc(r.doc_ref || '')}"></div>
      <div class="field full">
        <div class="check-group">
          <label><input type="checkbox" id="rsp-ex" ${r.is_exempt?'checked':''}> 標記為本案免辦（不計入逾期）</label>
          <label><input type="checkbox" id="rsp-pen" ${r.has_penalty?'checked':''}> 附帶逾期懲罰條款</label>
        </div>
      </div>
      <div class="field full"><label>罰則標準與執行備註</label><textarea id="rsp-note">${esc(r.note || '')}</textarea></div>
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveRespModal('${esc(respId)}')">儲存</button>
  `);
}

async function saveRespModal(respId) {
  const r = (appData.tables.Project_Responsibilities || []).find(x => x.resp_id === respId);
  if (!r) return;
  r.item_name = document.getElementById('rsp-name').value.trim() || r.item_name;
  r.sla_days_json = JSON.stringify({ text: document.getElementById('rsp-sla').value.trim() });
  r.relay_dates_json = JSON.stringify({
    submit: document.getElementById('rsp-d1').value,
    review: document.getElementById('rsp-d2').value,
    approve: document.getElementById('rsp-d3').value
  });
  r.doc_ref = document.getElementById('rsp-doc').value.trim();
  r.is_exempt = document.getElementById('rsp-ex').checked;
  r.has_penalty = document.getElementById('rsp-pen').checked;
  r.note = document.getElementById('rsp-note').value.trim();
  if (r.is_exempt) r.current_holder = '免辦';
  else if (r.current_holder === '免辦') r.current_holder = '承造人';
  if (document.getElementById('rsp-d3').value && !r.is_exempt) r.current_holder = '已完成';
  r.updated_at = nowStr();
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_Responsibilities', record: r });
  toast('✅ 已更新權責分工紀錄');
}

function printResponsibilitiesPDF(projectId, mode) {
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
  if (!p) return;
  const eng = calcEngineeringSummary(projectId);
  const phaseOrder = { '工程開(施)工前': 1, '工程施工階段': 2, '工程完工驗收階段': 3 };
  const rows = eng.resps
    .filter(r => mode === 'contract' ? !r.is_exempt : !r.is_exempt)
    .sort((a, b) => (phaseOrder[a.phase_name] - phaseOrder[b.phase_name]) || (Number(a.item_no) - Number(b.item_no)));
  const isAudit = mode === 'audit';

  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <div>
        <div style="font-size:12px;color:#475569">${esc(appData.schoolName)} ｜ 附表二 ${esc(p.engineering_category || '一般公共工程')}施工階段契約約定權責分工表（無委託專案管理廠商）</div>
        <h2 style="margin:2px 0 0;font-size:16px">${esc(p.project_name)}（${isAudit ? '履約進度查核版' : '招標契約附件版'}）</h2>
      </div>
      <div style="text-align:right;font-size:11px;color:#475569">
        <div>承造：${esc(p.vendor_name || '-')} ｜ 監造：${esc(p.supervisor_contact || '-')}</div>
        <div>列印日期：${todayStr()}（已自動過濾本案免辦項目）</div>
      </div>
    </div>
    <table class="print-table">
      <thead>
        <tr>
          <th style="width:78px">期程</th>
          <th style="width:190px">工作項目</th>
          <th style="width:48px">起造人(業主)</th>
          <th style="width:45px">設計人</th>
          <th style="width:52px">監造人</th>
          <th style="width:52px">承造人</th>
          <th style="width:130px">約定完成期限</th>
          ${isAudit ? '<th style="width:125px">實際接力日期／文號</th><th style="width:65px">目前球權</th>' : '<th style="width:115px">契約依據</th>'}
          <th>備註／罰則</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const rm = parseJSON(r.roles_matrix_json, {});
          const sla = parseJSON(r.sla_days_json, {});
          const rd = parseJSON(r.relay_dates_json, {});
          return `<tr>
            <td style="text-align:center">${esc(r.phase_name.replace('工程',''))}<br>#${r.item_no}</td>
            <td><strong>${esc(r.item_name)}</strong></td>
            <td style="text-align:center">${esc(rm.owner || '')}</td>
            <td style="text-align:center">${esc(rm.designer || '')}</td>
            <td style="text-align:center">${esc(rm.supervisor || '')}</td>
            <td style="text-align:center">${esc(rm.contractor || '')}</td>
            <td>${esc(sla.text || '')}</td>
            ${isAudit
              ? `<td>送:${esc(rd.submit||'-')} 審:${esc(rd.review||'-')}<br>核:${esc(rd.approve||'-')} ${r.doc_ref?'('+esc(r.doc_ref)+')':''}</td><td style="text-align:center;font-weight:700">${esc(r.current_holder)}</td>`
              : `<td>${esc(r.contract_basis || '')}</td>`
            }
            <td>${esc(r.note || '')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
  setTimeout(() => window.print(), 80);
}

// ----------------------------------------------------------------------------
// 6. 頁籤三：變更設計與工期展延帳本 (Project_ChangeOrders)
// ----------------------------------------------------------------------------
function renderChangeOrdersTabHTML(p, eng) {
  const capWarn = eng.addRatioPct >= 50
    ? `<div class="gate-banner red">🚨 <strong>法定 50% 上限紅燈：</strong>本案已核定累計加帳達原決標金額 <strong>${eng.addRatioPct}%</strong>，請立即確認採購法第 22 條第 1 項第 6 款限制！</div>`
    : (eng.addRatioPct >= 35
      ? `<div class="gate-banner amber">⚠️ <strong>變更額度預警：</strong>本案已核定累計加帳達 <strong>${eng.addRatioPct}%</strong>，接近 50% 上限，後續追加請審慎控管。</div>` : '');
  const budgetWarn = eng.isOverBudget
    ? `<div class="gate-banner red">🚨 <strong>超預算警示：</strong>現行有效契約金額（${fmtMoney(eng.effectiveContract)}）已超過核定預算金額（${fmtMoney(eng.budget)}），請辦理經費調整或校內配合款簽准！</div>` : '';

  return `
    ${capWarn}${budgetWarn}
    <div class="eng-kpi-row">
      <div class="eng-stat"><div class="lbl">原決標金額（鎖定）</div><div class="val">${eng.baseContract ? fmtMoney(eng.baseContract) : '-'}</div></div>
      <div class="eng-stat"><div class="lbl">現行有效契約金額</div><div class="val" style="color:var(--primary)">${eng.effectiveContract ? fmtMoney(eng.effectiveContract) : '-'}</div></div>
      <div class="eng-stat"><div class="lbl">累計加帳比例（上限50%）</div><div class="val" style="color:${eng.addRatioPct>=50?'var(--red)':eng.addRatioPct>=35?'var(--amber)':'var(--green)'}">${eng.addRatioPct}%</div></div>
      <div class="eng-stat"><div class="lbl">核定工期異動累計</div><div class="val">${eng.approvedDays >= 0 ? '+' : ''}${eng.approvedDays} 天</div></div>
      <div class="eng-stat"><div class="lbl">修正後完工日</div><div class="val" style="font-size:16px">${esc(eng.revisedEndDate || '-')}</div></div>
    </div>

    <div class="panel">
      <div class="panel-hd">
        <h3>📐 變更設計與停工展延帳本（草稿隔離：僅「核定生效」滾動更新契約與甘特圖）</h3>
        <button class="btn-sm btn-primary" onclick="openChangeOrderModal('${esc(p.project_id)}')">＋ 新增變更／停工展延</button>
      </div>
      <div class="panel-bd" style="overflow-x:auto">
        ${eng.changes.length ? `
          <table>
            <thead>
              <tr>
                <th>次別／類型</th>
                <th>變更或停工事由</th>
                <th>加帳／減帳／淨額</th>
                <th>加減絕對值（監辦門檻）</th>
                <th>工期異動</th>
                <th>辦理狀態與核准文號</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${eng.changes.map(c => {
                const abs = Number(c.abs_total_amount) || 0;
                const threshTag = abs >= 1500000 ? '<span class="tag tag-red">達公告金額(須監辦)</span>'
                  : (abs >= 150000 ? '<span class="tag tag-amber">未達公告金額監辦</span>' : '');
                const stCls = c.status === '核定生效' ? 'tag-green' : (c.status === '撤銷' ? 'tag-gray' : 'tag-amber');
                return `
                  <tr>
                    <td style="white-space:nowrap"><strong>第 ${c.change_seq} 次</strong><div class="item-meta">${esc(c.change_type)}</div></td>
                    <td>
                      <strong>${esc(c.reason)}</strong>
                      <div class="item-meta">
                        ${c.stop_start_date ? `停工：${c.stop_start_date} ~ ${c.resume_date || '復工未定'} ` : ''}
                        ${c.designer_submit_date ? `｜設計提送：${c.designer_submit_date}` : ''}
                        ${c.drive_file_url ? `｜<a href="${esc(c.drive_file_url)}" target="_blank">📎 變更書圖</a>` : ''}
                      </div>
                    </td>
                    <td style="white-space:nowrap">
                      <div>加：+${Number(c.add_amount||0).toLocaleString('zh-TW')} ／ 減：-${Number(c.deduct_amount||0).toLocaleString('zh-TW')}</div>
                      <div class="item-meta"><strong>淨額：${Number(c.net_amount||0)>=0?'+':''}${Number(c.net_amount||0).toLocaleString('zh-TW')} 元</strong></div>
                    </td>
                    <td>${abs.toLocaleString('zh-TW')} 元<div>${threshTag}</div></td>
                    <td style="white-space:nowrap"><strong>${Number(c.days_delta||0)>=0?'+':''}${Number(c.days_delta||0)} 天</strong></td>
                    <td>
                      <span class="tag ${stCls}">${esc(c.status)}</span>
                      <div class="item-meta">${c.approval_doc_no ? esc(c.approval_doc_no) + ' (' + esc(c.approval_date||'') + ')' : (c.status==='核定生效'?'已生效':'尚未計入有效契約')}</div>
                    </td>
                    <td style="white-space:nowrap">
                      <button class="btn-xs" onclick="openChangeOrderModal('${esc(p.project_id)}','${esc(c.change_id)}')">✎ 編輯</button>
                      <button class="btn-xs btn-danger" onclick="deleteChangeOrder('${esc(c.change_id)}')">刪</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        ` : '<div class="empty-state">目前尚無變更設計或停工展延紀錄。</div>'}
      </div>
    </div>
  `;
}

function openChangeOrderModal(projectId, changeId = '') {
  const c = changeId ? (appData.tables.Project_ChangeOrders || []).find(x => x.change_id === changeId) : {};
  const eng = calcEngineeringSummary(projectId);
  const nextSeq = c.change_seq || (eng.changes.length + 1);

  openModal(changeId ? '✎ 編輯變更設計／工期展延' : '＋ 新增變更設計或停工展延', `
    <div id="chg-preview-banner" class="gate-banner green" style="display:none"></div>
    <div class="form-grid">
      <div class="field"><label>變更次別</label><input id="chg-seq" type="number" value="${nextSeq}"></div>
      <div class="field"><label>異動類型</label>
        <select id="chg-type">${['金額與工期變更','純工期展延或停工','純金額加減'].map(t=>`<option value="${t}" ${c.change_type===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="field full"><label>變更或停工事由 *</label><input id="chg-reason" type="text" value="${esc(c.reason || '')}" placeholder="例：豪雨停工展延、現場管線遷移追加"></div>
      <div class="field"><label>本次加帳金額（填正數）</label><input id="chg-add" type="number" min="0" value="${Number(c.add_amount)||0}" oninput="previewChangeOrderImpact('${esc(projectId)}','${esc(changeId)}')"></div>
      <div class="field"><label>本次減帳金額（填正數）</label><input id="chg-ded" type="number" min="0" value="${Number(c.deduct_amount)||0}" oninput="previewChangeOrderImpact('${esc(projectId)}','${esc(changeId)}')"></div>
      <div class="field"><label>工期異動天數（正為展延、負為縮短）</label><input id="chg-days" type="number" value="${Number(c.days_delta)||0}"></div>
      <div class="field"><label>設計人提送修正書圖日（附表二第22項）</label><input id="chg-des" type="date" value="${esc(c.designer_submit_date || '')}"></div>
      <div class="field"><label>停工起日（純停工選填）</label><input id="chg-s1" type="date" value="${esc(c.stop_start_date || '')}" onchange="autoCalcStopDays()"></div>
      <div class="field"><label>復工日（純停工選填）</label><input id="chg-s2" type="date" value="${esc(c.resume_date || '')}" onchange="autoCalcStopDays()"></div>
      <div class="field"><label>辦理狀態（切至「核定生效」才正式更新契約）</label>
        <select id="chg-status">${CHANGE_STAGES.map(s=>`<option value="${s}" ${(c.status||'現場會勘')===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label>核准文號</label><input id="chg-doc" type="text" value="${esc(c.approval_doc_no || '')}" placeholder="例：高市溪中總字第115..."></div>
      <div class="field"><label>核定生效日</label><input id="chg-adate" type="date" value="${esc(c.approval_date || '')}"></div>
      <div class="field"><label>變更書圖／議價紀錄連結</label><input id="chg-url" type="url" value="${esc(c.drive_file_url || '')}"></div>
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveChangeOrder('${esc(projectId)}','${esc(changeId)}')">儲存變更紀錄</button>
  `);
  previewChangeOrderImpact(projectId, changeId);
}

function autoCalcStopDays() {
  const s1 = document.getElementById('chg-s1')?.value;
  const s2 = document.getElementById('chg-s2')?.value;
  if (s1 && s2 && diffDays(s1, s2) >= 0) {
    document.getElementById('chg-days').value = diffDays(s1, s2);
  }
}

function previewChangeOrderImpact(projectId, excludeId) {
  const banner = document.getElementById('chg-preview-banner');
  if (!banner) return;
  const eng = calcEngineeringSummary(projectId);
  const add = Math.max(0, Number(document.getElementById('chg-add')?.value) || 0);
  const ded = Math.max(0, Number(document.getElementById('chg-ded')?.value) || 0);
  const net = add - ded, abs = add + ded;

  // 排除本筆原本已核定額度再試算
  let prevAdd = eng.approvedAdd, prevNet = eng.approvedNet;
  const old = eng.changes.find(x => x.change_id === excludeId);
  if (old && old.status === '核定生效') {
    prevAdd -= Number(old.add_amount) || 0;
    prevNet -= Number(old.net_amount) || 0;
  }
  const simContract = eng.baseContract + prevNet + net;
  const simRatio = eng.baseContract > 0 ? ((prevAdd + add) / eng.baseContract * 100) : 0;

  const msgs = [`本次淨額：${net>=0?'+':''}${net.toLocaleString('zh-TW')} 元 ｜ 加減絕對值：${abs.toLocaleString('zh-TW')} 元`];
  let level = 'green';
  if (abs >= 1500000) { msgs.push('⚠️ 加減絕對值達公告金額（150萬），須通知主計／政風監辦並注意新增項目議價程序'); level = 'amber'; }
  else if (abs >= 150000) { msgs.push('ℹ️ 加減絕對值達未達公告金額（15萬），請依地方未達監辦辦法簽核'); level = 'amber'; }
  if (eng.baseContract > 0 && simRatio >= 50) { msgs.push(`🚨 試算累計加帳達 ${simRatio.toFixed(1)}%，超過 50% 法定上限！`); level = 'red'; }
  else if (eng.baseContract > 0 && simRatio >= 35) { msgs.push(`⚠️ 試算累計加帳達 ${simRatio.toFixed(1)}%，逼近 50% 紅線`); if (level !== 'red') level = 'amber'; }
  if (eng.budget > 0 && simContract > eng.budget) { msgs.push(`🚨 試算契約額 ${fmtMoney(simContract)} 超過原核定預算 ${fmtMoney(eng.budget)}！`); level = 'red'; }

  banner.style.display = 'block';
  banner.className = 'gate-banner ' + level;
  banner.innerHTML = msgs.join('<br>');
}

async function saveChangeOrder(projectId, changeId) {
  const reason = document.getElementById('chg-reason').value.trim();
  if (!reason) return toast('請填寫變更或停工事由');
  const add = Math.max(0, Number(document.getElementById('chg-add').value) || 0);
  const ded = Math.max(0, Number(document.getElementById('chg-ded').value) || 0);
  const status = document.getElementById('chg-status').value;
  let adate = document.getElementById('chg-adate').value;
  if (status === '核定生效' && !adate) adate = todayStr();

  const rec = {
    change_id: changeId || nextId('Project_ChangeOrders', 'change_id', 'CHG', 4),
    project_id: projectId,
    change_seq: Number(document.getElementById('chg-seq').value) || 1,
    change_type: document.getElementById('chg-type').value,
    reason,
    add_amount: add,
    deduct_amount: ded,
    net_amount: add - ded,
    abs_total_amount: add + ded,
    days_delta: Number(document.getElementById('chg-days').value) || 0,
    stop_start_date: document.getElementById('chg-s1').value,
    resume_date: document.getElementById('chg-s2').value,
    designer_submit_date: document.getElementById('chg-des').value,
    status,
    approval_doc_no: document.getElementById('chg-doc').value.trim(),
    approval_date: adate,
    drive_file_url: document.getElementById('chg-url').value.trim(),
    updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Project_ChangeOrders', rec, 'change_id');
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_ChangeOrders', record: rec });
  toast(status === '核定生效' ? '✅ 變更已核定生效，契約金額與甘特圖完工日已自動更新' : '✅ 已儲存變更草稿（尚未影響有效契約）');
}

async function deleteChangeOrder(id) {
  if (!confirm('確定刪除此筆變更紀錄？')) return;
  appData.tables.Project_ChangeOrders = appData.tables.Project_ChangeOrders.filter(c => c.change_id !== id);
  renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Project_ChangeOrders', id });
}

// ----------------------------------------------------------------------------
// 7. 頁籤四：分期估驗與結算計價帳本 (Project_Billings)
// ----------------------------------------------------------------------------
function renderBillingsTabHTML(p, eng) {
  const uninspected = eng.mats.filter(m => m.status !== '進場檢驗合格');
  const matGate = uninspected.length
    ? `<div class="gate-banner amber">🧱 <strong>計價前材料品管卡控：</strong>尚有 <strong>${uninspected.length} 項</strong>材料未達「進場檢驗合格」（${uninspected.slice(0, 3).map(m => esc(m.item_name)).join('、')}${uninspected.length > 3 ? '…' : ''}），估驗前請確認本期請款工項之材料文件與報告均已到位。</div>` : '';
  const chgGate = eng.pendingChanges
    ? `<div class="gate-banner amber">📐 <strong>未核定變更防呆：</strong>目前有 <strong>${eng.pendingChanges} 筆</strong>變更設計尚未「核定生效」，請勿將尚未議價核定之新增項目計入本期估驗。</div>` : '';

  return `
    ${matGate}${chgGate}
    <div class="eng-kpi-row">
      <div class="eng-stat"><div class="lbl">現行有效契約金額</div><div class="val">${eng.effectiveContract ? fmtMoney(eng.effectiveContract) : '未決標'}</div></div>
      <div class="eng-stat"><div class="lbl">最新進度 vs 計價執行</div><div class="val" style="color:var(--primary)">${eng.latestProgress}% / ${eng.payExecPct}%</div></div>
      <div class="eng-stat"><div class="lbl">累計實付淨額（應付）</div><div class="val">${fmtMoney(eng.totalNetPayable)}</div></div>
      <div class="eng-stat"><div class="lbl">累計扣留保留款</div><div class="val" style="color:var(--amber)">${fmtMoney(eng.totalRetention)}</div></div>
      <div class="eng-stat"><div class="lbl">已撥款入帳累計</div><div class="val" style="color:var(--green)">${fmtMoney(eng.totalDisbursed)}</div></div>
    </div>

    <div class="panel">
      <div class="panel-hd">
        <h3>💰 分期估驗與結算計價帳本（保留款比例：${((Number(p.retention_rate)||0.05)*100).toFixed(0)}%）</h3>
        <button class="btn-sm btn-primary" onclick="openBillingModal('${esc(p.project_id)}')">＋ 新增估驗／結算計價</button>
      </div>
      <div class="panel-bd" style="overflow-x:auto">
        ${eng.billings.length ? `
          <table>
            <thead>
              <tr>
                <th>期別</th>
                <th>累計進度／完成額</th>
                <th>本期估驗金額</th>
                <th>扣保留款／預付／違約</th>
                <th>本次實付淨額</th>
                <th>校內核銷跑關狀態</th>
                <th>傳票與撥款日</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${eng.billings.map(b => {
                const stDates = parseJSON(b.stage_dates_json, {});
                const lastStageDate = stDates[b.workflow_stage] || '';
                return `
                  <tr>
                    <td><strong>${esc(b.billing_seq)}</strong><div class="item-meta">基準 ${fmtMoney(b.base_contract_amount)}</div></td>
                    <td>${b.cum_progress_pct}%<div class="item-meta">累計 ${fmtMoney(b.cum_billed_amount)}</div></td>
                    <td><strong>${fmtMoney(b.period_amount)}</strong></td>
                    <td style="white-space:nowrap">
                      <div>保留：${Number(b.retention_deduct||0).toLocaleString('zh-TW')}</div>
                      <div class="item-meta">預付：${Number(b.advance_recoup||0).toLocaleString('zh-TW')} ｜ 扣款：${Number(b.penalty_deduct||0).toLocaleString('zh-TW')}</div>
                    </td>
                    <td><strong style="color:var(--primary)">${fmtMoney(b.net_payable)}</strong></td>
                    <td>
                      <select style="padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;font-size:12px" onchange="advanceBillingStage('${esc(b.billing_id)}',this.value)">
                        ${BILLING_STAGES.map(s=>`<option value="${s}" ${b.workflow_stage===s?'selected':''}>${s}</option>`).join('')}
                      </select>
                      ${lastStageDate ? `<div class="item-meta">更新：${esc(lastStageDate)}</div>` : ''}
                    </td>
                    <td>
                      <div>${esc(b.voucher_no || '-')}</div>
                      <div class="item-meta">${b.paid_date ? '撥款 ' + esc(b.paid_date) : ''}</div>
                    </td>
                    <td style="white-space:nowrap">
                      <button class="btn-xs" onclick="openBillingModal('${esc(p.project_id)}','${esc(b.billing_id)}')">✎</button>
                      <button class="btn-xs btn-danger" onclick="deleteBilling('${esc(b.billing_id)}')">刪</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        ` : '<div class="empty-state">尚未建立估驗計價紀錄。點擊「＋ 新增估驗／結算計價」自動試算保留款並追蹤主計跑關。</div>'}
      </div>
    </div>
  `;
}

function openBillingModal(projectId, billingId = '') {
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId) || {};
  const eng = calcEngineeringSummary(projectId);
  const b = billingId ? (appData.tables.Project_Billings || []).find(x => x.billing_id === billingId) : {};
  const prevCum = billingId
    ? ((Number(b.cum_billed_amount) || 0) - (Number(b.period_amount) || 0))
    : eng.totalBilled;
  const retRate = Number(p.retention_rate !== '' ? p.retention_rate : 0.05);
  const defSeq = b.billing_seq || `第${eng.billings.length + 1}期估驗`;

  openModal(billingId ? '✎ 編輯估驗計價單' : '＋ 開立估驗／結算計價單', `
    <input type="hidden" id="bil-prev-cum" value="${prevCum}">
    <input type="hidden" id="bil-base" value="${b.base_contract_amount || eng.effectiveContract || eng.baseContract}">
    <input type="hidden" id="bil-retrate" value="${retRate}">
    <div class="form-grid">
      <div class="field"><label>計價期別 *</label><input id="bil-seq" type="text" value="${esc(defSeq)}" placeholder="例：第1期估驗／結算尾款／退還保留款"></div>
      <div class="field"><label>累計施工進度（%）</label><input id="bil-pct" type="number" step="0.1" value="${esc(b.cum_progress_pct ?? '')}" oninput="recalcBilling('pct')"></div>
      <div class="field"><label>累計完成金額（前期累計：${prevCum.toLocaleString('zh-TW')} 元）</label><input id="bil-cum" type="number" value="${esc(b.cum_billed_amount ?? prevCum)}" oninput="recalcBilling('cum')"></div>
      <div class="field"><label>本期估驗金額（自動差額）</label><input id="bil-per" type="number" value="${Number(b.period_amount)||0}" oninput="recalcBilling('per')"></div>
      <div class="field"><label>本期扣留保留款（預設 ${(retRate*100).toFixed(0)}%；退還保留款填負數）</label><input id="bil-ret" type="number" value="${Number(b.retention_deduct)||0}" oninput="recalcBilling('net')"></div>
      <div class="field"><label>預付款扣回</label><input id="bil-adv" type="number" value="${Number(b.advance_recoup)||0}" oninput="recalcBilling('net')"></div>
      <div class="field"><label>違約金／品管扣款</label><input id="bil-pen" type="number" value="${Number(b.penalty_deduct)||0}" oninput="recalcBilling('net')"></div>
      <div class="field"><label>本次實付淨額（自動計算）</label><input id="bil-net" type="number" value="${Number(b.net_payable)||0}" style="font-weight:800;color:var(--primary)"></div>
      <div class="field"><label>校內核銷跑關進度</label>
        <select id="bil-stage">${BILLING_STAGES.map(s=>`<option value="${s}" ${(b.workflow_stage||'廠商送件')===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label>傳票／核銷文號</label><input id="bil-vch" type="text" value="${esc(b.voucher_no || '')}"></div>
      <div class="field"><label>實際撥款入帳日</label><input id="bil-paid" type="date" value="${esc(b.paid_date || '')}"></div>
      <div class="field"><label>材料抽驗檢核備註</label><input id="bil-gate" type="text" value="${esc(b.material_gate_ack || (eng.mats.length ? `已抽驗合格 ${eng.inspectedMats}/${eng.mats.length} 項` : '無須抽驗或尚未建檔'))}"></div>
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveBilling('${esc(projectId)}','${esc(billingId)}')">儲存計價單</button>
  `);
}

function recalcBilling(src) {
  const prevCum = Number(document.getElementById('bil-prev-cum').value) || 0;
  const base = Number(document.getElementById('bil-base').value) || 0;
  const retRate = Number(document.getElementById('bil-retrate').value) || 0;

  let cum = Number(document.getElementById('bil-cum').value) || 0;
  let per = Number(document.getElementById('bil-per').value) || 0;

  if (src === 'pct' && base > 0) {
    const pct = Number(document.getElementById('bil-pct').value) || 0;
    cum = Math.round(base * (pct / 100));
    per = Math.max(0, cum - prevCum);
    document.getElementById('bil-cum').value = cum;
    document.getElementById('bil-per').value = per;
    document.getElementById('bil-ret').value = Math.round(per * retRate);
  } else if (src === 'cum') {
    per = Math.max(0, cum - prevCum);
    document.getElementById('bil-per').value = per;
    if (base > 0) document.getElementById('bil-pct').value = ((cum / base) * 100).toFixed(1);
    document.getElementById('bil-ret').value = Math.round(per * retRate);
  } else if (src === 'per') {
    document.getElementById('bil-ret').value = Math.round(per * retRate);
  }

  const ret = Number(document.getElementById('bil-ret').value) || 0;
  const adv = Number(document.getElementById('bil-adv').value) || 0;
  const pen = Number(document.getElementById('bil-pen').value) || 0;
  document.getElementById('bil-net').value = per - ret - adv - pen;
}

async function saveBilling(projectId, billingId) {
  const seq = document.getElementById('bil-seq').value.trim();
  if (!seq) return toast('請填寫計價期別');
  const existing = billingId ? (appData.tables.Project_Billings || []).find(x => x.billing_id === billingId) : {};
  const stage = document.getElementById('bil-stage').value;
  const stDates = parseJSON(existing.stage_dates_json, {});
  if (!stDates[stage]) stDates[stage] = todayStr();
  let paidDate = document.getElementById('bil-paid').value;
  if (stage === '已撥款入帳' && !paidDate) paidDate = todayStr();

  const rec = {
    billing_id: billingId || nextId('Project_Billings', 'billing_id', 'BIL', 4),
    project_id: projectId,
    billing_seq: seq,
    base_contract_amount: Number(document.getElementById('bil-base').value) || 0,
    cum_progress_pct: Number(document.getElementById('bil-pct').value) || 0,
    cum_billed_amount: Number(document.getElementById('bil-cum').value) || 0,
    period_amount: Number(document.getElementById('bil-per').value) || 0,
    retention_deduct: Number(document.getElementById('bil-ret').value) || 0,
    advance_recoup: Number(document.getElementById('bil-adv').value) || 0,
    penalty_deduct: Number(document.getElementById('bil-pen').value) || 0,
    net_payable: Number(document.getElementById('bil-net').value) || 0,
    workflow_stage: stage,
    stage_dates_json: JSON.stringify(stDates),
    voucher_no: document.getElementById('bil-vch').value.trim(),
    paid_date: paidDate,
    material_gate_ack: document.getElementById('bil-gate').value.trim(),
    updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Project_Billings', rec, 'billing_id');
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_Billings', record: rec });
  toast('✅ 已儲存估驗計價單');
}

async function advanceBillingStage(billingId, newStage) {
  const b = (appData.tables.Project_Billings || []).find(x => x.billing_id === billingId);
  if (!b) return;
  const stDates = parseJSON(b.stage_dates_json, {});
  stDates[newStage] = todayStr();
  b.workflow_stage = newStage;
  b.stage_dates_json = JSON.stringify(stDates);
  if (newStage === '已撥款入帳' && !b.paid_date) b.paid_date = todayStr();
  b.updated_at = nowStr();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Project_Billings', record: b });
  toast(`✅ ${b.billing_seq} 跑關進度 → ${newStage}`);
}

async function deleteBilling(id) {
  if (!confirm('確定刪除此筆計價單？')) return;
  appData.tables.Project_Billings = appData.tables.Project_Billings.filter(b => b.billing_id !== id);
  renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Project_Billings', id });
}

// ----------------------------------------------------------------------------
// 8. 升級單案甘特圖 SVG、A4 橫式 PDF 與首頁紅黃燈預警引擎
// ----------------------------------------------------------------------------
buildSingleGanttSVG = function(p, tasks) {
  const eng = calcEngineeringSummary(p.project_id);
  const isEng = p.procurement_type === '工程';
  const dates = [];
  tasks.forEach(t => {
    [t.plan_start, t.plan_end, t.actual_start, t.actual_end, t.sla_deadline].forEach(d => { if (d) dates.push(d); });
  });
  if (p.orig_end_date) dates.push(p.orig_end_date);
  if (eng.revisedEndDate) dates.push(eng.revisedEndDate);
  eng.changes.filter(c => c.status === '核定生效' && c.approval_date).forEach(c => dates.push(c.approval_date));
  eng.billings.filter(b => b.paid_date).forEach(b => dates.push(b.paid_date));

  if (!dates.length) return '<div class="empty-state">尚未設定各階段日期，請點擊「📅 期程／死線」設定起迄日。</div>';
  dates.sort();
  const minDate = addDays(dates[0], -5);
  const maxDate = addDays(dates[dates.length - 1], 12);
  const totalDays = Math.max(15, diffDays(minDate, maxDate));

  const W = 1040, leftW = 290, chartW = W - leftW - 20;
  const rowH = 38, headH = 34;
  const extraRows = (isEng && eng.mats.length > 0) ? 1 : 0;
  const H = headH + (tasks.length + extraRows) * rowH + 22;
  const xOf = ymd => leftW + (diffDays(minDate, ymd) / totalDays) * chartW;

  const tickStep = Math.max(5, Math.ceil(totalDays / 10));
  let gridSvg = '';
  for (let d = 0; d <= totalDays; d += tickStep) {
    const dt = addDays(minDate, d);
    const x = leftW + (d / totalDays) * chartW;
    gridSvg += `<line x1="${x}" y1="${headH}" x2="${x}" y2="${H - 12}" stroke="#e2e8f0" stroke-width="1"/>`;
    gridSvg += `<text x="${x}" y="22" font-size="10.5" fill="#64748b" text-anchor="middle">${dt.slice(5)}</text>`;
  }

  const today = todayStr();
  let markersSvg = '';
  if (today >= minDate && today <= maxDate) {
    const tx = xOf(today);
    markersSvg += `<line x1="${tx}" y1="${headH}" x2="${tx}" y2="${H - 12}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,3"/>`;
    markersSvg += `<text x="${tx}" y="11" font-size="9.5" fill="#dc2626" font-weight="700" text-anchor="middle">今日</text>`;
  }
  if (p.orig_end_date && p.orig_end_date >= minDate && p.orig_end_date <= maxDate) {
    const ox = xOf(p.orig_end_date);
    markersSvg += `<line x1="${ox}" y1="${headH}" x2="${ox}" y2="${H - 12}" stroke="#475569" stroke-width="1.5" stroke-dasharray="5,3"/>`;
    markersSvg += `<text x="${ox}" y="${H - 2}" font-size="9.5" fill="#475569" font-weight="700" text-anchor="middle">原訂完工</text>`;
  }
  if (isEng && eng.approvedDays !== 0 && eng.revisedEndDate >= minDate && eng.revisedEndDate <= maxDate) {
    const rx = xOf(eng.revisedEndDate);
    markersSvg += `<line x1="${rx}" y1="${headH}" x2="${rx}" y2="${H - 12}" stroke="#7c3aed" stroke-width="1.8" stroke-dasharray="6,2"/>`;
    markersSvg += `<text x="${rx}" y="${H - 2}" font-size="9.5" fill="#7c3aed" font-weight="700" text-anchor="middle">修正完工</text>`;
  }
  // 變更核定菱形里程碑 & 估驗撥款圓點
  eng.changes.filter(c => c.status === '核定生效' && c.approval_date).forEach(c => {
    const cx = xOf(c.approval_date);
    markersSvg += `<polygon points="${cx},${headH-6} ${cx+6},${headH} ${cx},${headH+6} ${cx-6},${headH}" fill="#ea580c"/>`;
    markersSvg += `<text x="${cx}" y="${headH-8}" font-size="9" fill="#ea580c" font-weight="700" text-anchor="middle">變更#${c.change_seq}${c.days_delta?`(${c.days_delta>0?'+':''}${c.days_delta}d)`:''}</text>`;
  });
  eng.billings.filter(b => b.paid_date).forEach(b => {
    const bx = xOf(b.paid_date);
    markersSvg += `<circle cx="${bx}" cy="${H - 12}" r="4.5" fill="#059669" stroke="#fff" stroke-width="1"><title>${escSvg(b.billing_seq)} 撥款 ${b.paid_date}</title></circle>`;
  });

  let rowsSvg = '';
  tasks.forEach((t, idx) => {
    const y = headH + idx * rowH;
    const items = parseJSON(t.checklist_json, []);
    const done = items.filter(i => i.done).length;
    rowsSvg += `<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="${idx % 2 ? '#f8fafc' : '#ffffff'}"/>`;
    rowsSvg += `<line x1="0" y1="${y + rowH}" x2="${W}" y2="${y + rowH}" stroke="#f1f5f9"/>`;
    rowsSvg += `<text x="10" y="${y + 16}" font-size="12" font-weight="700" fill="#0f172a">${t.stage_order}. ${escSvg(t.stage_name)}</text>`;
    rowsSvg += `<text x="10" y="${y + 31}" font-size="10.5" fill="#64748b">檢核 ${done}/${items.length} ｜ ${escSvg(t.status)}</text>`;

    if (t.plan_start && t.plan_end) {
      const x1 = xOf(t.plan_start), x2 = Math.max(x1 + 6, xOf(t.plan_end));
      rowsSvg += `<rect x="${x1}" y="${y + 7}" width="${x2 - x1}" height="10" rx="3" fill="#cbd5e1"/>`;
    }
    if (t.actual_start) {
      const aEnd = t.actual_end || (today > t.actual_start ? today : t.actual_start);
      const ax1 = xOf(t.actual_start), ax2 = Math.max(ax1 + 6, xOf(aEnd));
      const color = t.status === '已完成' ? '#059669' : t.status === '缺件卡關' ? '#dc2626' : '#1d4ed8';
      rowsSvg += `<rect x="${ax1}" y="${y + 20}" width="${ax2 - ax1}" height="10" rx="3" fill="${color}"/>`;
    }
    if (t.sla_deadline && t.sla_deadline >= minDate && t.sla_deadline <= maxDate) {
      const sx = xOf(t.sla_deadline);
      rowsSvg += `<polygon points="${sx},${y+8} ${sx+5},${y+13} ${sx},${y+18} ${sx-5},${y+13}" fill="#dc2626"/>`;
    }
  });

  // 工程專屬：底端材料送審總進度條
  if (extraRows) {
    const y = headH + tasks.length * rowH;
    const matPct = Math.round((eng.approvedMats / eng.mats.length) * 100);
    rowsSvg += `<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="#fffbeb"/>`;
    rowsSvg += `<text x="10" y="${y + 16}" font-size="12" font-weight="700" fill="#92400e">🧱 材料送審總進度</text>`;
    rowsSvg += `<text x="10" y="${y + 31}" font-size="10.5" fill="#b45309">核定 ${eng.approvedMats}/${eng.mats.length} ｜ 抽驗 ${eng.inspectedMats} ｜ 逾期 ${eng.overdueMats}</text>`;
    rowsSvg += `<rect x="${leftW + 10}" y="${y + 12}" width="${chartW - 20}" height="14" rx="7" fill="#fde68a"/>`;
    rowsSvg += `<rect x="${leftW + 10}" y="${y + 12}" width="${Math.round((chartW - 20) * matPct / 100)}" height="14" rx="7" fill="${eng.overdueMats ? '#ea580c' : '#059669'}"/>`;
    rowsSvg += `<text x="${leftW + chartW / 2}" y="${y + 23}" font-size="10.5" font-weight="700" fill="#0f172a" text-anchor="middle">${matPct}% 已核定</text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;font-family:'Microsoft JhengHei',sans-serif">
    <rect x="0" y="0" width="${W}" height="${headH}" fill="#f1f5f9"/>
    <text x="10" y="22" font-size="12" font-weight="700" fill="#334155">階段名稱與檢核進度</text>
    ${rowsSvg}${gridSvg}${markersSvg}
  </svg>`;
};

printSingleProjectPDF = function(projectId) {
  const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
  if (!p) return;
  const tasks = getProjectTasks(projectId);
  const eng = calcEngineeringSummary(projectId);
  const blockers = tasks.filter(t => t.blocker_note).map(t => `• [${t.stage_name}] ${t.blocker_note}`);
  if (eng.overdueMats > 0) blockers.push(`• [材料送審] 有 ${eng.overdueMats} 項材料逾期未送審`);
  if (eng.pendingChanges > 0) blockers.push(`• [變更設計] 有 ${eng.pendingChanges} 筆變更尚在審查／議價中`);
  const prog = calcProjectProgress(projectId);

  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <div>
        <div style="font-size:12px;color:#475569">${esc(appData.schoolName)} ｜ 標案進度與財務甘特圖管制表</div>
        <h2 style="margin:2px 0 0;font-size:18px">${esc(p.project_name)}</h2>
      </div>
      <div style="text-align:right;font-size:12px;color:#475569">
        <div>案號：${esc(typeof formatProjectCaseNo === 'function' ? formatProjectCaseNo(p) : p.project_id)} ｜ 狀態：<strong>${esc(p.status)}</strong></div>
        <div>列印日期：${todayStr()}</div>
      </div>
    </div>
    <div class="print-meta">
      <div><strong>採購性質：</strong>${esc(p.procurement_type)}（${esc(p.threshold_tier)}）</div>
      <div><strong>得標廠商：</strong>${esc(p.vendor_name || '尚未決標')}</div>
      <div><strong>監造／設計：</strong>${esc(p.supervisor_contact || p.supervision_mode || '-')}</div>
      <div><strong>檢核進度：</strong>${prog.doneChecks}/${prog.totalChecks}（${prog.pct}%）</div>
      <div><strong>開工／原訂完工：</strong>${esc(p.start_date || '-')} ~ ${esc(p.orig_end_date || '-')}</div>
      <div><strong>修正後完工日：</strong>${esc(eng.revisedEndDate || '-')} ${eng.approvedDays ? `(${eng.approvedDays>0?'+':''}${eng.approvedDays}天)` : ''}</div>
      <div><strong>補助核銷死線：</strong>${esc(p.grant_deadline || '無')}</div>
      <div><strong>保固到期日：</strong>${esc(p.warranty_end_date || '-')}</div>
    </div>
    <div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px">${buildSingleGanttSVG(p, tasks)}</div>
    <div class="print-footer">
      <div class="print-box">
        <strong>經費與契約財務總覽</strong>
        <div style="margin-top:4px">原決標金額：${p.award_amount ? fmtMoney(p.award_amount) : '尚未決標'}（預算 ${fmtMoney(p.budget_amount)}）</div>
        <div>現行有效契約：${eng.effectiveContract ? fmtMoney(eng.effectiveContract) : '-'}（累計加帳 ${eng.addRatioPct}%）</div>
        <div>累計估驗實付：${fmtMoney(eng.totalNetPayable)}（計價執行 ${eng.payExecPct}%）｜ 保留款：${fmtMoney(eng.totalRetention)}</div>
      </div>
      <div class="print-box">
        <strong>目前卡關與工程管制備註</strong>
        <div style="margin-top:4px;white-space:pre-line">${blockers.length ? esc(blockers.join('\n')) : '目前各階段與品管執行順暢，無重大卡關事項。'}</div>
      </div>
      <div class="print-box">
        <div class="sign-grid">
          <div class="sign-cell"><span>承辦人</span><span></span></div>
          <div class="sign-cell"><span>總務主任</span><span></span></div>
          <div class="sign-cell"><span>校長</span><span></span></div>
        </div>
      </div>
    </div>
  `;
  setTimeout(() => window.print(), 80);
};

// 擴充首頁戰情室跨模組紅黃燈預警雷達（納入材料、變更、計價、權責）
const _origBuildAllAlerts = buildAllAlerts;
buildAllAlerts = function() {
  const alerts = _origBuildAllAlerts();
  const today = todayStr();
  const prjMap = {};
  (appData.tables.Projects || []).forEach(p => { prjMap[p.project_id] = p; });

  // 1. 材料送審紅黃燈
  (appData.tables.Project_Materials || []).forEach(m => {
    const p = prjMap[m.project_id];
    if (!p || p.status === '已結案' || p.status === '廢標撤案' || m.status === '進場檢驗合格') return;
    if ((m.status === '待送審' || m.status === '退回修正') && m.submit_deadline) {
      const d = diffDays(today, m.submit_deadline);
      if (d < 0) {
        alerts.push({
          level: 'red', badge: '材料逾期', title: `${p.project_name}｜${m.item_name}`,
          detail: `最晚送審日 ${m.submit_deadline}（已逾期 ${Math.abs(d)} 天，目前：${m.status}）`,
          sortKey: d, action: () => { openProjectDetail(p.project_id); selectedProjectSubtab = 'materials'; renderCurrentView(); }
        });
      }
    }
    if (m.status === '監造審查中' && m.submitted_date && diffDays(m.submitted_date, today) > 7) {
      alerts.push({
        level: 'amber', badge: '催辦監造', title: `${p.project_name}｜${m.item_name}`,
        detail: `廠商已於 ${m.submitted_date} 送件，監造審查超過 7 天`,
        sortKey: 2, action: () => { openProjectDetail(p.project_id); selectedProjectSubtab = 'materials'; renderCurrentView(); }
      });
    }
    if (m.status === '機關核備中' && m.supervisor_done_date && diffDays(m.supervisor_done_date, today) > 5) {
      alerts.push({
        level: 'amber', badge: '待機關核備', title: `${p.project_name}｜${m.item_name}`,
        detail: `監造已於 ${m.supervisor_done_date} 轉陳，機關核備超過 5 天`,
        sortKey: 1, action: () => { openProjectDetail(p.project_id); selectedProjectSubtab = 'materials'; renderCurrentView(); }
      });
    }
  });

  // 2. 變更設計 50% / 超預算預警
  (appData.tables.Projects || []).forEach(p => {
    if (p.procurement_type !== '工程' || p.status === '已結案' || p.status === '廢標撤案') return;
    const eng = calcEngineeringSummary(p.project_id);
    if (eng.addRatioPct >= 50 || eng.isOverBudget) {
      alerts.push({
        level: 'red', badge: '變更紅線', title: p.project_name,
        detail: `${eng.addRatioPct>=50?`累計追加達 ${eng.addRatioPct}% `:''}${eng.isOverBudget?'現行契約已超預算':''}`,
        sortKey: -3, action: () => { openProjectDetail(p.project_id); selectedProjectSubtab = 'changes'; renderCurrentView(); }
      });
    } else if (eng.addRatioPct >= 35) {
      alerts.push({
        level: 'amber', badge: '變更額度', title: p.project_name,
        detail: `累計追加已達原契約 ${eng.addRatioPct}%，留意 50% 法定上限`,
        sortKey: 4, action: () => { openProjectDetail(p.project_id); selectedProjectSubtab = 'changes'; renderCurrentView(); }
      });
    }
  });

  const rank = { red: 0, amber: 1, blue: 2 };
  alerts.sort((a, b) => (rank[a.level] - rank[b.level]) || (a.sortKey - b.sortKey));
  return alerts;
};

// 更新下階段頁籤說明
renderUpcomingHTML = function() {
  return `
    <div class="panel">
      <div class="panel-hd"><h3>🔧 系統分期擴充進度</h3></div>
      <div class="panel-bd">
        <div class="alert-item" style="border-left:4px solid var(--green);background:#ecfdf5">
          <strong>✅ 第一期 B（已啟用上線）｜工程材料送審、附表二 50 項權責分工、變更設計與估驗計價</strong>
          <div class="item-meta">請前往「📋 招標與工程控管」，點進任一「工程」類標案即可使用完整 6 頁籤與 PDF 輸出。</div>
        </div>
        <div class="alert-item blue">
          <strong>⏳ 第二期（下一階段）｜太陽能屋頂租賃控管 ＋ 學校水電費多錶號異常分析</strong>
          <div class="item-meta">對應試算表 <code>Solar_Contracts</code>、<code>Solar_Records</code>、<code>Utilities_Meters</code>、<code>Utilities_Bills</code> 已建表完成，待第一期 B 確認後接續製作 <code>ops-module.js</code> 掛載上線。</div>
        </div>
      </div>
    </div>
  `;
};

// 載入完畢後立即重繪畫面套用第一期 B 功能
renderCurrentView();
