/**
 * ============================================================================
 * 學校總務行政助理 — 標案期程控管預設 (project-timeline-presets.js)
 *
 * 將已核定之全案推動期程，一次匯入既有標案的「階段（Project_Tasks）」：
 *   - 每階段含預定起迄、上級／法定死線（sla_deadline，自動進入戰情室死線提醒）與檢核清單
 *   - 取代建案時自動產生的通用階段（已有勾選進度者改為附加，不覆蓋）
 *   - 可選擇同步更新預算金額、建立「每月 5 日前進度填報」例行事務
 *
 * 目前收錄：115年溪埔國中跑道及周邊設施整建工程（委託設計監造勞務採購及後續整建工程）
 * ============================================================================
 */

(function initProjectTimelinePresets() {
  const item = (text, required = true, extra = {}) => ({ text, required, ...extra });

  const XIPU_TRACK_115 = {
    key: 'xipu-track-115',
    label: '115年溪埔國中跑道整建全案期程（116/2/28 發包・8/31 竣工・10/31 核結）',
    match: p => /跑道及周邊設施整建工程委託設計監造/.test(String(p.project_name || '')),
    budget: 673230,
    source: '教育部 115.10.16 臺教授國部字第1156602443L號函；教育局 115.10.21 高市教健字第11506204700號、115.11.13 高市教健字第11539024900號函',
    stages: [
      {
        name: '計畫申請與上級核定', start: '2026-09-07', end: '2026-11-13', status: '已完成',
        items: [
          item('115/9/7 市府完成實地勘查（原申請金額逾150萬元）', true, { done: true, done_date: '2026-09-07' }),
          item('115/10/16 教育部核定補助（總經費773萬：國教署80% 618.4萬＋教育局116年度配合款20% 154.6萬），補助執行期程至116/8/31', true, { done: true, done_date: '2026-10-16', doc_no: '臺教授國部字第1156602443L號' }),
          item('115/10/21 教育局函轉核定補助', true, { done: true, done_date: '2026-10-21', doc_no: '高市教健字第11506204700號' }),
          item('115/11/13 教育局函核定配合款支應', true, { done: true, done_date: '2026-11-13', doc_no: '高市教健字第11539024900號' })
        ]
      },
      {
        name: '勞務公告稿校正與上網公告', start: '2026-11-26', end: '2026-12-08', status: '進行中', sla: '2026-12-08',
        items: [
          item('【上傳前校正】「履約期限」欄截斷，補齊「（詳契約第7條及需求規範書）」'),
          item('【上傳前校正】「是否受機關補助」改勾「是」，填列國教署補助80%（618萬4,000元）'),
          item('【上傳前校正】確認「是否刊登公報」勾選符合未達公告金額採購規定'),
          item('【上傳前校正】附加說明補登高雄市政府政風處檢舉資訊'),
          item('【上傳前校正】契約第8條（14日提送／7日審查／預設10工作天）與需求規範書第五點（7日曆天提送／5日曆天審查／細部設計7工作天）一致'),
          item('確認已簽准：第一次公告未達3家當場改採限制性招標（未達公告金額招標辦法第3條）'),
          item('115/11/27 上網公告（公開取得報價單或企劃書，等標期12日曆天）'),
          item('受理釋疑（等標期1/4，約至115/11/30）；最遲115/12/8書面答復，且最後釋疑次日至截標日不少於等標期1/4，不足須延後截標（施行細則第43條第3項）')
        ]
      },
      {
        name: '勞務開標、評審與議價決標', start: '2026-12-09', end: '2026-12-16', status: '未開始',
        items: [
          item('115/12/9 09:00 截止投標收件'),
          item('115/12/9 10:30 食育教室開標、資格審查（未達3家依簽准當場改限制性招標）'),
          item('開標後立即召開評審小組：書面審查及簡報詢答，擇定最符合需要者'),
          item('參考該廠商報價訂定底價後議價決標（施行細則第54條第3項）'),
          item('【風險】評審前先開校內會議凝聚「跑道縮道評估」共識', false)
        ]
      },
      {
        name: '勞務簽約與書面履約通知', start: '2026-12-17', end: '2026-12-24', status: '未開始',
        items: [
          item('決標次日起7日內核對資格文件正本（建議洽廠商5日內併辦）'),
          item('決標次日起10日內完成書面簽約（末日遇例假日順延）'),
          item('簽約當日核發書面履約通知（設計期程起算日）')
        ]
      },
      {
        name: '服務實施計畫書與跑道縮道評估', start: '2026-12-25', end: '2027-01-05', status: '未開始',
        items: [
          item('履約通知後7日曆天內提送服務實施計畫書'),
          item('提送跑道縮道評估（維持6道或縮道：經費配置、教學需求、維護成本）'),
          item('機關收件後5日曆天內完成審查')
        ]
      },
      {
        name: '細部設計（21日曆天，免辦基本設計）', start: '2026-12-25', end: '2027-01-14', status: '未開始',
        items: [
          item('提送細部設計圖說、施工規範、工程預算書（含PCCES電子檔）'),
          item('辦理不同性別師生意見調查'),
          item('完成無障礙動線檢討'),
          item('【風險】設計期間與建築師／顧問密切工作會報，力求一次通過審查', false),
          item('【風險】要求覈實擬訂分項施工進度表及雨季因應對策（AC養護期、夏季豪雨）', false)
        ]
      },
      {
        name: '細部設計審查、修正與複審核定', start: '2027-01-15', end: '2027-02-05', status: '未開始',
        items: [
          item('收件當日啟動審查並書面留存收發文（逾審查期限「視同甲方接受」，契約第8條）'),
          item('機關7個工作天內完成初審並通知修正'),
          item('廠商5日曆天內完成修正（同一待改善項目第1次不計入履約期限）'),
          item('機關複審核定（建議5個工作天內）')
        ]
      },
      {
        name: '交付工程招標預算書圖', start: '2027-02-06', end: '2027-02-08', status: '未開始',
        items: [
          item('核定次日起3日曆天內交付書圖5份（A3以上簽證設計圖、預算書、單價分析表、數量計算書、施工規範、施工計畫）'),
          item('交付可編輯電子檔（CAD、PDF、空白工程標單、PCCES）')
        ]
      },
      {
        name: '整建工程招標發包【上級死線 116/2/28】', start: '2027-02-01', end: '2027-02-28', status: '未開始', sla: '2027-02-28',
        items: [
          item('工程招標校內簽核（發包工程費上限683萬8,367元，公告金額以上公開招標）'),
          item('上網公告（留足法定等標期及第一次流標重行招標時間）'),
          item('開標、審標、決標（監造廠商依契約附件2協辦釋疑、資格審查、開審標及簽約）'),
          item('116/2/28 前完成工程發包')
        ]
      },
      {
        name: '工程簽約與開工準備', start: '2027-03-01', end: '2027-03-15', status: '未開始',
        items: [
          item('完成工程契約簽訂'),
          item('監造計畫、施工計畫書、品質計畫、安全衛生管理計畫送審核定'),
          item('施工進度表（含雨季因應）與工程保險送審核定'),
          item('繳納空氣污染防制費並申報開工')
        ]
      },
      {
        name: '工程施工與駐地監造【竣工死線 116/8/31】', start: '2027-03-15', end: '2027-08-31', status: '未開始', sla: '2027-08-31',
        items: [
          item('AC刨除3公分、新鋪4公分AC並落實壓實度'),
          item('養護期及試水檢測平整度'),
          item('新設13mm以上全密式PU面層'),
          item('內排水溝面重作、畫線及外界石修補'),
          item('監造人員留駐工地持續監督至機關確認竣工日'),
          item('116/8/31 前完成竣工（同日屆滿補助經費執行期程）')
        ]
      },
      {
        name: '完工驗收與點交', start: '2027-09-01', end: '2027-09-30', status: '未開始',
        items: [
          item('承商申報完工、竣工確認、核計總工期'),
          item('審查竣工圖說及工程結算明細表'),
          item('辦理初驗與驗收（複驗）'),
          item('填具工程結算驗收證明書、點交及繕製決算書（監造服務至驗收合格止）')
        ]
      },
      {
        name: '計畫核結【上級死線 116/10/31】', start: '2027-10-01', end: '2027-10-31', status: '未開始', sla: '2027-10-31',
        items: [
          item('核章工程經費明細表、教育部及教育局核准公文影本'),
          item('設計監造及工程契約影本、5欄核章之支出機關分攤表'),
          item('空污費繳費收據、性別意見調查與成果報告表、竣工維護管理手冊'),
          item('結餘款依80%補助比率繳回'),
          item('核定後1年內（116/10/15前）派員參加國教署體育設施設備研習至少1場次')
        ]
      }
    ],
    routine: {
      title: '跑道整建補助案進度填報（教育部體育設施網站）',
      category: '法定填報', recurrence_type: '每月', due_rule: 'D-05', lead_days: 5,
      last_done_cycle: '115-11', portal_url: 'https://facility.schoolpe.tw/',
      note: '每月5日前填報 115年溪埔國中跑道及周邊設施整建工程進度（納入計畫及預算考核），至116/10/31計畫核結後停用。'
    }
  };

  const PRESETS = [XIPU_TRACK_115];
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

  // 相似的例行事務（同名，或同為每月、標題含「跑道」與「填報」）
  function similarRoutine(preset) {
    return (appData.tables.Annual_Routines || []).find(r => r.title === preset.routine.title
      || (r.recurrence_type === preset.routine.recurrence_type && /跑道/.test(r.title || '') && /填報/.test(r.title || '')));
  }

  window.openTimelinePresetModal = function(projectId, key) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    const preset = PRESETS.find(x => x.key === key);
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
        <div class="item-meta" style="margin-top:4px">依據：${esc(preset.source)}</div>
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
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:6px;font-size:13px;cursor:pointer">
        <input type="checkbox" id="tp-routine" ${hasRoutine ? 'disabled' : 'checked'} style="margin-top:3px">
        <span>${hasRoutine ? `已有相似例行事務「${esc(simRt.title)}」，不再建立` : `同時建立例行事務「${esc(preset.routine.title)}」（每月5日前，首次 115/12/5）`}</span>
      </label>
    `, st.mode === 'fill' && !st.missing.length
      ? `<button class="btn-primary" onclick="closeModal()">不匯入，關閉</button>`
      : `<button onclick="closeModal()">${st.mode === 'fill' ? '不匯入' : '取消'}</button><button class="btn-primary" onclick="applyTimelinePreset('${esc(projectId)}','${esc(key)}')">💾 ${st.mode === 'fill' ? `只補上缺少的 ${st.missing.length} 個階段` : `匯入 ${preset.stages.length} 個階段`}</button>`);
  };

  window.applyTimelinePreset = async function(projectId, key) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    const preset = PRESETS.find(x => x.key === key);
    if (!p || !preset) return;
    const st = existingState(p, preset);
    if (st.mode === 'fill' && !st.missing.length) { closeModal(); return; }
    const updateBudget = !!document.getElementById('tp-budget')?.checked;
    const addRoutine = !!document.getElementById('tp-routine')?.checked && !document.getElementById('tp-routine')?.disabled;

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
    const preset = PRESETS.find(pr => pr.match(p));
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
