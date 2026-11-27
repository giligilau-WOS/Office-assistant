/**
 * ============================================================================
 * 總務行政戰情助理 — 【模組 F5】場地與教室短期借用卡片式看板 (venue-classroom-board.js)
 * 遵循規範：UI_DESIGN_RULES.md §0–§5.2 F5
 *
 * 設計重點：
 * 1. 分棟樓層「卡片式空間看板」（3×3 / 3×2 自適應網格），一眼看清全校球場、穿堂、普通教室與專科教室借用狀態
 * 2. 支援「多間教室批次勾選借用」（如週末外部考試試場、營隊借用 101～102 班）與時段衝突防呆攔截
 * 3. 自動與「採購與工程」工期／開標日連動鎖場（如跑道整建施工期、食育教室開標評審時段）
 * 4. 雙向串聯 campus-3d.html?room=... 空間定位，並預留未來「場地收費標準與保證金規則 (Venue_Rules)」插槽
 * ============================================================================
 */

(function initVenueClassroomBoard() {
  if (!window.GA_CORE) return;

  const BOOKING_KEY = 'VENUE_BOOKING';
  const CUSTOM_SPACE_KEY = 'VENUE_SPACE';
  const RULES_KEY = 'VENUE_RULES';

  const DEFAULT_SPACES = [
    { id: 'SP-GYM', name: 'D4 風雨球場', floor: '戶外館', category: '戶外與球場', room3d: '風雨球場', keywords: ['風雨球場'] },
    { id: 'SP-TRACK', name: '戶外運動場＆跑道', floor: '戶外區', category: '戶外與球場', room3d: '運動場', keywords: ['跑道', '運動場', '操場'] },
    { id: 'SP-BASKET', name: '戶外籃球場', floor: '戶外區', category: '戶外與球場', room3d: '籃球場', keywords: ['籃球場'] },
    { id: 'SP-HALL', name: '1F 中央穿堂', floor: '主棟 1F', category: '1F 教室與空間', room3d: '穿堂', keywords: ['穿堂'] },
    { id: 'SP-101', name: '1F 101 班教室', floor: '主棟 1F', category: '1F 教室與空間', room3d: '101', keywords: ['101班', '101教室'] },
    { id: 'SP-102', name: '1F 102 班教室', floor: '主棟 1F', category: '1F 教室與空間', room3d: '102', keywords: ['102班', '102教室'] },
    { id: 'SP-LIB', name: '1F 圖書室', floor: '主棟 1F', category: '1F 教室與空間', room3d: '圖書室', keywords: ['圖書室'] },
    { id: 'SP-FOOD', name: '央廚 2-7 食育教室', floor: '央廚 1F', category: '專科與會議室', room3d: '食育教室', keywords: ['食育教室'] },
    { id: 'SP-MTG', name: '2F 會議室', floor: '主棟 2F', category: '專科與會議室', room3d: '會議室', keywords: ['會議室'] },
    { id: 'SP-301', name: '2F 301 班教室', floor: '主棟 2F', category: '2F–3F 普通教室', room3d: '301', keywords: ['301班', '301教室'] },
    { id: 'SP-302', name: '2F 302 班教室', floor: '主棟 2F', category: '2F–3F 普通教室', room3d: '302', keywords: ['302班', '302教室'] },
    { id: 'SP-201', name: '3F 201 班教室', floor: '主棟 3F', category: '2F–3F 普通教室', room3d: '201', keywords: ['201班', '201教室'] },
    { id: 'SP-202', name: '3F 202 班教室', floor: '主棟 3F', category: '2F–3F 普通教室', room3d: '202', keywords: ['202班', '202教室'] },
    { id: 'SP-INFO', name: '3F 資訊教室', floor: '主棟 3F', category: '專科與會議室', room3d: '資訊教室', keywords: ['資訊教室', '電腦教室'] },
    { id: 'SP-SCI', name: '3F 理化實驗室', floor: '主棟 3F', category: '專科與會議室', room3d: '理化實驗室', keywords: ['理化實驗室'] }
  ];

  const CATEGORIES = ['全部空間', '只看使用中', '戶外與球場', '1F 教室與空間', '2F–3F 普通教室', '專科與會議室'];

  const SPACE_META_KEY = 'VENUE_META';

  const state = {
    viewDate: typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10),
    category: '全部空間',
    page: 1,
    rightTab: 'BOOK_FORM', // BOOK_FORM | DAY_LIST
    selectedSpaceIds: [],
    editingBookingId: ''
  };

  const h = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const roc = (ymd, opts) => window.GA_CORE.formatRocDate(ymd, opts);

  function getHiddenSpaceIds() {
    const meta = window.GA_CORE.extStore.get(SPACE_META_KEY, 'MAIN') || {};
    return new Set(Array.isArray(meta.hiddenIds) ? meta.hiddenIds : []);
  }

  function getAllSpaces(opts = {}) {
    const customList = window.GA_CORE.extStore.list(CUSTOM_SPACE_KEY);
    const customById = Object.fromEntries(customList.map(c => [c.id, c]));
    const hidden = getHiddenSpaceIds();
    const merged = DEFAULT_SPACES.map(d => customById[d.id] ? { ...d, ...customById[d.id] } : d);
    customList.forEach(c => {
      if (!DEFAULT_SPACES.some(d => d.id === c.id)) merged.push(c);
    });
    return opts.includeHidden ? merged : merged.filter(sp => !hidden.has(sp.id));
  }

  function getAllBookings() {
    return window.GA_CORE.extStore.list(BOOKING_KEY)
      .sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`));
  }

  // 掃描標案施工工期與開標日，自動產生空間鎖場提示
  function getAutoProjectLocksForDate(ymd) {
    const locks = [];
    const projs = (typeof appData !== 'undefined' && appData?.tables?.Projects) || [];
    const tasks = (typeof appData !== 'undefined' && appData?.tables?.Project_Tasks) || [];
    const spaces = getAllSpaces();

    for (const p of projs) {
      if (['已結案', '廢標撤案'].includes(p.status)) continue;
      const pName = String(p.project_name || '');
      const pTasks = tasks.filter(t => t.project_id === p.project_id && t.status !== '已完成');

      for (const t of pTasks) {
        const stName = String(t.stage_name || '');
        // 1. 工程施工階段期間自動鎖定對應場域（如跑道施工鎖運動場）
        if (/施工|整建工程施工|修繕施工/.test(stName) && t.plan_start && t.plan_end && ymd >= t.plan_start && ymd <= t.plan_end) {
          spaces.forEach(sp => {
            if ((sp.keywords || []).some(kw => pName.includes(kw) || stName.includes(kw))) {
              locks.push({
                space_id: sp.id,
                start_time: '08:00',
                end_time: '18:00',
                title: `工程施工管制：${window.GA_CORE.formatSmartTitle(pName).cleanTitle}`,
                project_id: p.project_id
              });
            }
          });
        }
        // 2. 檢核項寫明特定民國日期與地點（例如「115/12/9 10:30 食育教室開標」）
        const chks = parseJSON(t.checklist_json, []);
        for (const chk of chks) {
          if (chk.done) continue;
          const txt = String(chk.text || '');
          const dm = txt.match(/(\d{3})\/(\d{1,2})\/(\d{1,2})\s*(\d{1,2}:\d{2})?/);
          if (!dm) continue;
          const chkYmd = `${parseInt(dm[1], 10) + 1911}-${String(parseInt(dm[2], 10)).padStart(2, '0')}-${String(parseInt(dm[3], 10)).padStart(2, '0')}`;
          if (chkYmd !== ymd) continue;
          spaces.forEach(sp => {
            if ((sp.keywords || []).some(kw => txt.includes(kw))) {
              const st = dm[4] ? dm[4].padStart(5, '0') : '09:00';
              locks.push({
                space_id: sp.id,
                start_time: st,
                end_time: '12:00',
                title: `公務保留：${stName}`,
                project_id: p.project_id
              });
            }
          });
        }
      }
    }
    return locks;
  }

  function timeToMin(hhmm) {
    const [hh, mm] = String(hhmm || '00:00').split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  }

  function checkVenueTimeConflict(spaceIds, ymd, startTime, endTime, ignoreBookingId = '') {
    const sMin = timeToMin(startTime);
    const eMin = timeToMin(endTime);
    if (eMin <= sMin) return { ok: false, reason: '結束時間必須晚於開始時間' };

    const spacesById = Object.fromEntries(getAllSpaces().map(s => [s.id, s]));
    const dayBookings = getAllBookings().filter(b => b.date === ymd && b.id !== ignoreBookingId);
    const dayLocks = getAutoProjectLocksForDate(ymd);

    for (const sid of spaceIds) {
      const spName = spacesById[sid]?.name || sid;
      const hitB = dayBookings.find(b => b.space_id === sid && timeToMin(b.start_time) < eMin && timeToMin(b.end_time) > sMin);
      if (hitB) {
        return {
          ok: false,
          conflict: hitB,
          reason: `「${spName}」於 ${hitB.start_time}～${hitB.end_time} 已由「${hitB.borrower_unit}（${hitB.event_title}）」借用！`
        };
      }
      const hitL = dayLocks.find(l => l.space_id === sid && timeToMin(l.start_time) < eMin && timeToMin(l.end_time) > sMin);
      if (hitL) {
        return {
          ok: false,
          conflict: hitL,
          reason: `「${spName}」於當日 ${hitL.start_time}～${hitL.end_time} 有「${hitL.title}」管制鎖場！`
        };
      }
    }
    return { ok: true };
  }

  window.checkVenueTimeConflict = checkVenueTimeConflict;

  function computeSpaceDayStatus(space, ymd, dayBookings, dayLocks) {
    const myBookings = dayBookings.filter(b => b.space_id === space.id);
    const myLocks = dayLocks.filter(l => l.space_id === space.id);
    const hasMorning = myBookings.some(b => timeToMin(b.start_time) < 720) || myLocks.some(l => timeToMin(l.start_time) < 720);
    const hasAfternoon = myBookings.some(b => timeToMin(b.start_time) < 1050 && timeToMin(b.end_time) > 720)
      || myLocks.some(l => timeToMin(l.start_time) < 1050 && timeToMin(l.end_time) > 720);
    const hasNight = myBookings.some(b => timeToMin(b.end_time) > 1050);

    let stateKey = 'FREE';
    let badgeCls = 'tag-green';
    let badgeText = '🟢 空閒可借';
    if (myLocks.length) {
      stateKey = 'LOCKED';
      badgeCls = 'tag-amber';
      badgeText = '🚧 工程／公務保留';
    } else if (myBookings.length) {
      stateKey = 'BOOKED';
      badgeCls = 'tag-blue';
      badgeText = `🔵 已借用 (${myBookings.length}場)`;
    }

    return { space, myBookings, myLocks, hasMorning, hasAfternoon, hasNight, stateKey, badgeCls, badgeText };
  }

  // --------------------------------------------------------------------------
  // UI 互動操作
  // --------------------------------------------------------------------------
  function nextWeekdayYmd(targetDow) {
    const base = new Date((typeof todayStr === 'function' ? todayStr() : state.viewDate) + 'T00:00:00');
    const diff = (targetDow - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + diff);
    return fmtDate(base);
  }

  window.vbSetDate = function(ymd) {
    const parsed = window.GA_CORE.parseFlexibleRocDate(ymd) || ymd;
    if (/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
      state.viewDate = parsed;
      state.page = 1;
      renderCurrentView();
    }
  };
  window.vbShiftDate = function(days) {
    state.viewDate = addDays(state.viewDate, days);
    renderCurrentView();
  };
  window.vbQuickWeekend = function(dow) {
    state.viewDate = nextWeekdayYmd(dow);
    renderCurrentView();
  };
  window.vbSetCategory = function(cat) {
    state.category = cat;
    state.page = 1;
    renderCurrentView();
  };
  window.vbSetPage = function(p) {
    state.page = Math.max(1, p);
    renderCurrentView();
  };
  window.vbSetRightTab = function(t) {
    state.rightTab = t;
    renderCurrentView();
  };

  window.vbToggleSpaceSelect = function(spaceId, multi = false) {
    if (!spaceId) {
      state.selectedSpaceIds = [];
      renderCurrentView();
      return;
    }
    if (multi) {
      if (state.selectedSpaceIds.includes(spaceId)) {
        state.selectedSpaceIds = state.selectedSpaceIds.filter(x => x !== spaceId);
      } else {
        state.selectedSpaceIds = [...state.selectedSpaceIds, spaceId];
      }
    } else {
      if (state.selectedSpaceIds.length === 1 && state.selectedSpaceIds[0] === spaceId) {
        state.selectedSpaceIds = [];
      } else {
        state.selectedSpaceIds = [spaceId];
      }
    }
    state.rightTab = 'BOOK_FORM';
    renderCurrentView();
  };

  window.vbHideSpaceCard = async function(spaceId, ev) {
    if (ev) ev.stopPropagation();
    const all = getAllSpaces({ includeHidden: true });
    const sp = all.find(s => s.id === spaceId);
    const prevMeta = window.GA_CORE.extStore.get(SPACE_META_KEY, 'MAIN') || { hiddenIds: [] };
    const prevHidden = Array.isArray(prevMeta.hiddenIds) ? prevMeta.hiddenIds : [];
    const nextHidden = [...new Set([...prevHidden, spaceId])];
    state.selectedSpaceIds = state.selectedSpaceIds.filter(id => id !== spaceId);
    await window.GA_CORE.extStore.upsert(SPACE_META_KEY, 'MAIN', { id: 'MAIN', hiddenIds: nextHidden }, '場地卡片顯示設定', 'META');
    window.GA_CORE.pushUndoAction(`已隱藏用不到的卡片「${sp?.name || spaceId}」`, async () => {
      await window.GA_CORE.extStore.upsert(SPACE_META_KEY, 'MAIN', { id: 'MAIN', hiddenIds: prevHidden }, '場地卡片顯示設定', 'META');
    });
  };

  window.vbOpenManageSpacesModal = function() {
    const all = getAllSpaces({ includeHidden: true });
    const hidden = getHiddenSpaceIds();
    openModal('⚙️ 批次勾選要顯示的場地與教室卡片', `
      <div class="gate-banner amber" style="margin-bottom:10px;font-size:14px">
        💡 平時不開放外借或用不到的教室／專科空間，取消勾選即可從看板收起來（隨時可再打開）！
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
        <button type="button" class="btn-xs" onclick="document.querySelectorAll('.vbm-chk').forEach(c=>c.checked=true)">✓ 全部顯示</button>
        <button type="button" class="btn-xs" onclick="document.querySelectorAll('.vbm-chk').forEach(c=>{c.checked=(c.dataset.cat==='戶外與球場')})">🏟️ 只留戶外與球場</button>
        <button type="button" class="btn-xs" onclick="document.querySelectorAll('.vbm-chk').forEach(c=>c.checked=false)">✕ 全部取消</button>
      </div>
      <div style="max-height:330px;overflow-y:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px">
        ${all.map(sp => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border-subtle,#E7DFD3);border-radius:8px;background:#fff;cursor:pointer;font-size:14px;font-weight:700">
            <input type="checkbox" class="vbm-chk" value="${h(sp.id)}" data-cat="${h(sp.category)}" ${hidden.has(sp.id) ? '' : 'checked'} style="width:17px;height:17px">
            <span>${h(sp.name)} <small style="color:#78716C;font-weight:500">(${h(sp.floor)})</small></span>
          </label>
        `).join('')}
      </div>
    `, `<button onclick="closeModal()">取消</button><button class="btn-primary" onclick="vbSaveManagedSpaces()">💾 儲存顯示清單</button>`);
  };

  window.vbSaveManagedSpaces = async function() {
    const all = getAllSpaces({ includeHidden: true });
    const checked = new Set([...document.querySelectorAll('.vbm-chk:checked')].map(c => c.value));
    const hiddenIds = all.map(s => s.id).filter(id => !checked.has(id));
    state.selectedSpaceIds = state.selectedSpaceIds.filter(id => checked.has(id));
    closeModal();
    await window.GA_CORE.extStore.upsert(SPACE_META_KEY, 'MAIN', { id: 'MAIN', hiddenIds }, '場地卡片顯示設定', 'META');
    toast(`✅ 已更新場地看板（目前顯示 ${checked.size} 張卡片）`);
  };

  window.vbApplySlotPreset = function(s, e) {
    const sEl = document.getElementById('vb-f-start');
    const eEl = document.getElementById('vb-f-end');
    if (sEl) sEl.value = s;
    if (eEl) eEl.value = e;
  };

  window.vbSaveBooking = async function() {
    const eventTitle = (document.getElementById('vb-f-title')?.value || '').trim();
    const unit = (document.getElementById('vb-f-unit')?.value || '').trim();
    const rawDate = (document.getElementById('vb-f-date')?.value || '').trim();
    const ymd = window.GA_CORE.parseFlexibleRocDate(rawDate) || state.viewDate;
    const startTime = document.getElementById('vb-f-start')?.value || '08:00';
    const endTime = document.getElementById('vb-f-end')?.value || '12:00';
    const borrowerType = document.getElementById('vb-f-type')?.value || '校外短期租借';
    const feeStatus = document.getElementById('vb-f-fee')?.value || '待核計場地費';
    const acKeyNote = (document.getElementById('vb-f-ackey')?.value || '').trim();

    if (!eventTitle) return toast('請輸入活動／借用事由名稱');
    if (!unit) return toast('請輸入借用單位或申請人');
    if (!state.selectedSpaceIds.length) return toast('請先點選左側至少 1 張要借用的空間／教室卡片');

    const chk = checkVenueTimeConflict(state.selectedSpaceIds, ymd, startTime, endTime, state.editingBookingId);
    if (!chk.ok) {
      toast(`⛔ 時段衝突：${chk.reason}`);
      return;
    }

    const spacesById = Object.fromEntries(getAllSpaces({ includeHidden: true }).map(s => [s.id, s]));
    const batchGroupId = `GRP-${Date.now().toString(36)}`;
    let baseMax = 0;
    getAllBookings().forEach(b => {
      const m = String(b.id || '').match(/(\d+)$/);
      if (m) baseMax = Math.max(baseMax, parseInt(m[1], 10));
    });

    const entries = state.selectedSpaceIds.map((sid, idx) => {
      const id = (state.editingBookingId && idx === 0)
        ? state.editingBookingId
        : `VBK-${String(baseMax + idx + 1).padStart(4, '0')}`;
      const spName = spacesById[sid]?.name || sid;
      const rec = {
        id,
        batch_group_id: batchGroupId,
        space_id: sid,
        space_name: spName,
        date: ymd,
        start_time: startTime,
        end_time: endTime,
        event_title: eventTitle,
        borrower_unit: unit,
        borrower_type: borrowerType,
        fee_status: feeStatus,
        ac_key_note: acKeyNote
      };
      return {
        id,
        record: rec,
        summary: `${ymd} ${startTime}-${endTime}｜${spName}｜${unit} ${eventTitle}`,
        subType: sid
      };
    });

    state.editingBookingId = '';
    state.viewDate = ymd;
    await window.GA_CORE.extStore.batchUpsert(BOOKING_KEY, entries);
    toast(`✅ 已完成 ${entries.length} 間空間／教室借用登記（${roc(ymd)} ${startTime}～${endTime}）`);
  };

  window.vbDeleteBooking = async function(id, label) {
    await window.GA_CORE.extStore.remove(BOOKING_KEY, id, label || '場地借用');
  };

  window.vbOpenAddSpaceModal = function(editId = '', ev = null) {
    if (ev) ev.stopPropagation();
    const existing = editId ? getAllSpaces({ includeHidden: true }).find(s => s.id === editId) : null;
    openModal(existing ? `✎ 編輯空間卡片：${existing.name}` : '＋ 新增自訂教室／場地卡片', `
      <div class="form-grid">
        <div class="field"><label>空間或教室名稱 *</label><input id="vbs-name" type="text" value="${h(existing?.name || '')}" placeholder="例：1F 103 班教室、視聽教室"></div>
        <div class="field"><label>棟別與樓層標記 *</label><input id="vbs-floor" type="text" value="${h(existing?.floor || '主棟 1F')}" placeholder="例：主棟 2F"></div>
        <div class="field"><label>歸屬卡片分類</label>
          <select id="vbs-cat">
            ${['1F 教室與空間', '2F–3F 普通教室', '專科與會議室', '戶外與球場'].map(c => `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>對應 3D 校舍關鍵字（選填）</label><input id="vbs-3d" type="text" value="${h(existing?.room3d || '')}" placeholder="例：103 或 視聽"></div>
      </div>
    `, `
      ${existing ? `<button type="button" class="btn-danger" style="margin-right:auto" onclick="closeModal();vbHideSpaceCard('${h(existing.id)}')">🗑️ 隱藏／移除此卡</button>` : ''}
      <button onclick="closeModal()">取消</button>
      <button class="btn-primary" onclick="vbSaveCustomSpace('${h(editId)}')">💾 ${existing ? '儲存修改' : '新增卡片'}</button>
    `);
  };

  window.vbSaveCustomSpace = async function(editId = '') {
    const name = (document.getElementById('vbs-name')?.value || '').trim();
    if (!name) return toast('請輸入教室或空間名稱');
    const id = editId || window.GA_CORE.extStore.nextSeqId(CUSTOM_SPACE_KEY, 'SPC', 3);
    const prev = getAllSpaces({ includeHidden: true }).find(s => s.id === id);
    const rec = {
      id,
      name,
      floor: (document.getElementById('vbs-floor')?.value || '校舍').trim(),
      category: document.getElementById('vbs-cat')?.value || '1F 教室與空間',
      room3d: (document.getElementById('vbs-3d')?.value || name).trim(),
      keywords: prev?.keywords ? [...new Set([...prev.keywords, name])] : [name]
    };
    closeModal();
    await window.GA_CORE.extStore.upsert(CUSTOM_SPACE_KEY, id, rec, `空間卡片｜${name}`, rec.category);
    toast(`✅ 已${editId ? '更新' : '新增'}「${name}」卡片`);
  };

  window.vbOpenRulesSlotModal = function() {
    const saved = window.GA_CORE.extStore.get(RULES_KEY, 'MAIN_RULES') || {};
    openModal('📜 場地與教室租借規則設定（預留擴充插槽）', `
      <div class="gate-banner amber" style="margin-bottom:12px;font-size:14px">
        💡 您先前提到<strong>「之後再把場地租用規則放上來」</strong>——此處已預先建好雲端規則插槽！日後只需貼上貴校《場地開放管理辦法》收費表或備註，借用登記時即可自動帶入場地費、冷氣費與保證金。
      </div>
      <div class="form-grid">
        <div class="field"><label>風雨球場／每時段（4小時）場地費參考 (元)</label><input id="vbr-gym" type="number" value="${h(saved.gym_fee ?? '')}" placeholder="日後依辦法填入"></div>
        <div class="field"><label>普通教室／每間每時段場地費參考 (元)</label><input id="vbr-cls" type="number" value="${h(saved.cls_fee ?? '')}" placeholder="日後依辦法填入"></div>
        <div class="field"><label>冷氣電費計收標準說明</label><input id="vbr-ac" type="text" value="${h(saved.ac_rule ?? '')}" placeholder="例：每間每小時 XX 元或插卡計費"></div>
        <div class="field"><label>保證金與退還規則</label><input id="vbr-dep" type="text" value="${h(saved.deposit_rule ?? '')}" placeholder="例：活動結束檢查復原後無息退還"></div>
        <div class="field full"><label>辦法條文／補充備註</label><textarea id="vbr-note" rows="3" placeholder="可貼上校內場地租借要點摘要...">${h(saved.note ?? '')}</textarea></div>
      </div>
    `, `<button onclick="closeModal()">關閉</button><button class="btn-primary" onclick="vbSaveRulesSlot()">💾 儲存規則草稿</button>`);
  };

  window.vbSaveRulesSlot = async function() {
    const rec = {
      id: 'MAIN_RULES',
      gym_fee: document.getElementById('vbr-gym')?.value || '',
      cls_fee: document.getElementById('vbr-cls')?.value || '',
      ac_rule: document.getElementById('vbr-ac')?.value || '',
      deposit_rule: document.getElementById('vbr-dep')?.value || '',
      note: document.getElementById('vbr-note')?.value || ''
    };
    closeModal();
    await window.GA_CORE.extStore.upsert(RULES_KEY, 'MAIN_RULES', rec, '場地租借收費規則設定', 'RULES');
    toast('✅ 已儲存場地租借規則設定');
  };

  // --------------------------------------------------------------------------
  // 視圖渲染（100dvh 零外層捲動・左側空間教室卡片牆 ＋ 右側多選批次借用台）
  // --------------------------------------------------------------------------
  function renderView(container) {
    const tdy = typeof todayStr === 'function' ? todayStr() : state.viewDate;
    const satYmd = nextWeekdayYmd(6);
    const sunYmd = nextWeekdayYmd(0);

    const allSpaces = getAllSpaces();
    const hiddenCount = getHiddenSpaceIds().size;
    const allBookings = getAllBookings();
    const dayBookings = allBookings.filter(b => b.date === state.viewDate);
    const dayLocks = getAutoProjectLocksForDate(state.viewDate);

    const cardModels = allSpaces.map(sp => computeSpaceDayStatus(sp, state.viewDate, dayBookings, dayLocks));
    const freeCount = cardModels.filter(c => c.stateKey === 'FREE').length;
    const bookedCount = cardModels.filter(c => c.stateKey === 'BOOKED').length;
    const lockedCount = cardModels.filter(c => c.stateKey === 'LOCKED').length;

    let visibleCards = cardModels;
    if (state.category === '只看使用中') {
      visibleCards = cardModels.filter(c => c.stateKey !== 'FREE');
    } else if (state.category !== '全部空間') {
      visibleCards = cardModels.filter(c => c.space.category === state.category);
    }

    const pageSize = window.innerHeight < 710 ? 6 : 9;
    const totalPages = Math.max(1, Math.ceil(visibleCards.length / pageSize));
    if (state.page > totalPages) state.page = totalPages;
    const pageCards = visibleCards.slice((state.page - 1) * pageSize, state.page * pageSize);

    const spacesById = Object.fromEntries(allSpaces.map(s => [s.id, s]));
    const selectedNames = state.selectedSpaceIds.filter(id => spacesById[id]).map(id => spacesById[id].name);

    const upcoming14 = allBookings.filter(b => b.date >= tdy && diffDays(tdy, b.date) <= 14);

    container.innerHTML = `
      <div class="ga-split-shell" id="vb-module-root">
        <!-- 頂部：日期快速切換列 ＋ 全校空間即時燈號統計 -->
        <div class="vb-top-bar">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:17px;font-weight:800;color:var(--brand-primary,#7C4A21)">🏟️ ${h(roc(state.viewDate, { withWeekday: true }))}</span>
            <button type="button" class="btn-xs ${state.viewDate === tdy ? 'btn-primary' : ''}" onclick="vbSetDate('${tdy}')">今日</button>
            <button type="button" class="btn-xs ${state.viewDate === satYmd ? 'btn-primary' : ''}" onclick="vbQuickWeekend(6)">本週六</button>
            <button type="button" class="btn-xs ${state.viewDate === sunYmd ? 'btn-primary' : ''}" onclick="vbQuickWeekend(0)">本週日</button>
            <button type="button" class="btn-xs" onclick="vbShiftDate(-1)" title="前一天">◀</button>
            <input type="date" aria-label="選擇檢視日期" value="${h(state.viewDate)}" onchange="vbSetDate(this.value)" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border-strong,#D6CBB9);font-size:14px;font-weight:700">
            <button type="button" class="btn-xs" onclick="vbShiftDate(1)" title="後一天">▶</button>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="tag tag-green">🟢 空閒 ${freeCount}</span>
            <span class="tag tag-blue">🔵 已借 ${bookedCount}</span>
            ${lockedCount ? `<span class="tag tag-amber">🚧 保留 ${lockedCount}</span>` : ''}
            <button type="button" class="btn-sm" onclick="vbOpenManageSpacesModal()">⚙️ 管理卡片${hiddenCount ? ` (已藏${hiddenCount})` : ''}</button>
            <button type="button" class="btn-sm" onclick="vbOpenRulesSlotModal()">📜 租用規則</button>
            <button type="button" class="btn-sm btn-primary" onclick="vbOpenAddSpaceModal()">＋ 新增卡片</button>
          </div>
        </div>

        <!-- 主體：左 64% 空間與教室卡片網格 ＋ 右 36% 批次借用與當日時程 -->
        <div class="ga-split-body" style="grid-template-columns: minmax(0, 1.75fr) minmax(340px, 1fr)">
          <!-- 左欄：空間卡片看板 -->
          <section class="panel ga-pane">
            <div class="sp-filter-bar" style="border-top:none;border-bottom:1px solid var(--border-subtle,#E7DFD3)">
              <div class="sp-tabs">
                ${CATEGORIES.map(cat => `
                  <button type="button" class="sp-tab ${state.category === cat ? 'active' : ''}" onclick="vbSetCategory('${h(cat)}')">${h(cat)}</button>
                `).join('')}
              </div>
              <div class="sp-pager num-mono">
                <button type="button" class="btn-xs" ${state.page <= 1 ? 'disabled' : ''} onclick="vbSetPage(${state.page - 1})">◀</button>
                <span>${state.page} / ${totalPages}</span>
                <button type="button" class="btn-xs" ${state.page >= totalPages ? 'disabled' : ''} onclick="vbSetPage(${state.page + 1})">▶</button>
              </div>
            </div>

            <div class="vb-card-grid">
              ${pageCards.length ? pageCards.map(cm => {
                const sp = cm.space;
                const isSel = state.selectedSpaceIds.includes(sp.id);
                const firstEvent = cm.myLocks[0]
                  ? `🚧 ${cm.myLocks[0].start_time}-${cm.myLocks[0].end_time} ${cm.myLocks[0].title}`
                  : cm.myBookings[0]
                  ? `${cm.myBookings[0].start_time}-${cm.myBookings[0].end_time}｜${cm.myBookings[0].borrower_unit}（${cm.myBookings[0].event_title}）`
                  : '全天時段空閒，點選即可登記借用';

                return `
                  <div class="vb-space-card state-${cm.stateKey.toLowerCase()} ${isSel ? 'is-selected' : ''}"
                       onclick="vbToggleSpaceSelect('${h(sp.id)}', event.shiftKey || event.ctrlKey || event.metaKey)">
                    <div class="vb-card-top">
                      <span class="vb-floor-pill">${h(sp.floor)}</span>
                      <div style="display:flex;align-items:center;gap:5px">
                        <span class="tag ${cm.badgeCls}">${cm.badgeText}</span>
                        <input type="checkbox" aria-label="勾選${h(sp.name)}批次借用" ${isSel ? 'checked' : ''}
                          onclick="event.stopPropagation();vbToggleSpaceSelect('${h(sp.id)}', true)"
                          title="勾選或取消勾選此空間" style="width:16px;height:16px;cursor:pointer">
                        <button type="button" class="ga-card-dismiss" title="隱藏／移除這張用不到的空間卡（可復原）"
                          onclick="vbHideSpaceCard('${h(sp.id)}', event)">✕</button>
                      </div>
                    </div>

                    <div class="vb-card-title">${h(sp.name)}</div>

                    <div class="vb-slot-strip" aria-label="當日時段占用概況">
                      <span class="vb-slot-pill ${cm.hasMorning ? 'busy' : 'free'}">上午 ${cm.hasMorning ? '占' : '空'}</span>
                      <span class="vb-slot-pill ${cm.hasAfternoon ? 'busy' : 'free'}">下午 ${cm.hasAfternoon ? '占' : '空'}</span>
                      <span class="vb-slot-pill ${cm.hasNight ? 'busy' : 'free'}">夜間 ${cm.hasNight ? '占' : '空'}</span>
                    </div>

                    <div class="vb-card-summary" title="${h(firstEvent)}">${h(firstEvent)}</div>

                    <div class="vb-card-foot">
                      <button type="button" class="btn-xs" style="padding:2px 6px;border:none;background:transparent;color:#78716C"
                              onclick="vbOpenAddSpaceModal('${h(sp.id)}', event)">✎ 改名</button>
                      <a href="./campus-3d.html?room=${encodeURIComponent(sp.room3d || sp.name)}" target="_blank" rel="noopener"
                         onclick="event.stopPropagation()" class="vb-3d-link">🏫 3D位置 ↗</a>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div class="empty-state" style="grid-column:1 / -1">
                  此篩選條件下目前沒有空間卡片。<br>
                  <button type="button" class="btn-sm" style="margin-top:8px" onclick="vbOpenManageSpacesModal()">⚙️ 開啟卡片管理恢復顯示</button>
                </div>
              `}
            </div>
          </section>

          <!-- 右欄：多教室批次借用登記 ↔ 當日／近期借用清單 -->
          <section class="panel ga-pane">
            <div class="panel-hd">
              <div class="sp-tabs">
                <button type="button" class="sp-tab ${state.rightTab === 'BOOK_FORM' ? 'active' : ''}" onclick="vbSetRightTab('BOOK_FORM')">✍️ 登記借用 (${selectedNames.length}間)</button>
                <button type="button" class="sp-tab ${state.rightTab === 'DAY_LIST' ? 'active' : ''}" onclick="vbSetRightTab('DAY_LIST')">📋 時段明細 (${dayBookings.length || upcoming14.length})</button>
              </div>
              ${selectedNames.length ? `<button type="button" class="btn-xs" onclick="vbToggleSpaceSelect('')">清除已選</button>` : ''}
            </div>

            <div class="ga-pane-scroll" style="padding:12px 14px">
              ${state.rightTab === 'DAY_LIST' ? `
                <div style="display:flex;flex-direction:column;gap:8px">
                  <div style="font-size:14px;font-weight:700;color:var(--brand-primary,#7C4A21)">📅 ${h(roc(state.viewDate, { withWeekday: true }))} 當日借用 (${dayBookings.length} 筆)</div>
                  ${dayBookings.length ? dayBookings.map(b => `
                    <div style="padding:10px 12px;border:1px solid var(--border-subtle,#E7DFD3);border-left:4px solid #0284C7;border-radius:10px;background:#fff">
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                        <strong style="font-size:15.5px">${h(b.space_name)}｜${h(b.start_time)}～${h(b.end_time)}</strong>
                        <button type="button" class="btn-xs" onclick="vbDeleteBooking('${h(b.id)}','${h(b.space_name + ' ' + b.event_title)}')">取消借用</button>
                      </div>
                      <div style="font-size:14px;margin-top:4px">${h(b.borrower_unit)} — ${h(b.event_title)}</div>
                      <div class="item-meta">${h(b.borrower_type || '')}｜${h(b.fee_status || '')}${b.ac_key_note ? `｜🔑 ${h(b.ac_key_note)}` : ''}</div>
                    </div>
                  `).join('') : `<div class="empty-state" style="padding:14px">當日尚無借用登記。</div>`}

                  <div style="font-size:14px;font-weight:700;color:var(--text-secondary,#44403C);margin-top:8px">🔜 未來 14 日內短期借用預告 (${upcoming14.length} 筆)</div>
                  ${upcoming14.length ? upcoming14.slice(0, 6).map(b => `
                    <div style="padding:8px 10px;border:1px solid var(--border-subtle,#E7DFD3);border-radius:8px;background:var(--bg-subtle,#FAF6F0);cursor:pointer" onclick="vbSetDate('${h(b.date)}')">
                      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700">
                        <span>${h(roc(b.date))} ${h(b.start_time)}-${h(b.end_time)}</span>
                        <span class="tag tag-blue">${h(b.space_name)}</span>
                      </div>
                      <div class="item-meta">${h(b.borrower_unit)}｜${h(b.event_title)}</div>
                    </div>
                  `).join('') : `<div class="item-meta">未來兩週暫無預約紀錄。</div>`}
                </div>
              ` : `
                <div style="padding:9px 12px;border-radius:10px;background:var(--brand-soft,#F5EDE3);border:1px solid var(--border-strong,#D6CBB9);margin-bottom:10px">
                  <div style="font-size:13px;color:var(--text-secondary,#44403C);font-weight:700">已選取借用空間（點卡片選取，再點一次即可取消勾選）：</div>
                  <div style="font-size:15px;font-weight:800;color:var(--brand-primary,#7C4A21);margin-top:3px">${h(selectedNames.join('、') || '尚未選取（請點選左側要借用的卡片）')}</div>
                </div>

                <div class="form-grid">
                  <div class="field full">
                    <label>活動／借用事由 *</label>
                    <input id="vb-f-title" type="text" placeholder="例：社區週末羽球聯誼、全民英檢借用試場教室">
                  </div>
                  <div class="field">
                    <label>借用單位／聯絡人 *</label>
                    <input id="vb-f-unit" type="text" placeholder="例：○○協會 陳先生／教務處">
                  </div>
                  <div class="field">
                    <label>借用性質</label>
                    <select id="vb-f-type">
                      <option value="校外短期租借">校外短期租借</option>
                      <option value="社區運動團體">社區運動團體</option>
                      <option value="校內處室／營隊">校內處室／營隊</option>
                      <option value="國家考試／試場">國家考試／試場</option>
                    </select>
                  </div>
                  <div class="field full">
                    <label>借用日期（民國或西元）與快速時段</label>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                      <input id="vb-f-date" type="date" value="${h(state.viewDate)}" style="flex:1;min-width:135px">
                      <button type="button" class="btn-xs" onclick="vbApplySlotPreset('08:00','12:00')">上午</button>
                      <button type="button" class="btn-xs" onclick="vbApplySlotPreset('13:00','17:00')">下午</button>
                      <button type="button" class="btn-xs" onclick="vbApplySlotPreset('18:00','21:00')">夜間</button>
                      <button type="button" class="btn-xs" onclick="vbApplySlotPreset('08:00','17:00')">全天</button>
                    </div>
                  </div>
                  <div class="field">
                    <label>開始時間</label>
                    <input id="vb-f-start" type="time" value="08:00">
                  </div>
                  <div class="field">
                    <label>結束時間</label>
                    <input id="vb-f-end" type="time" value="12:00">
                  </div>
                  <div class="field">
                    <label>收費／保證金狀態</label>
                    <select id="vb-f-fee">
                      <option value="待核計場地費">待核計場地費</option>
                      <option value="已收訖場地費及保證金">已收訖場地費及保證金</option>
                      <option value="校內／公務免收費">校內／公務免收費</option>
                    </select>
                  </div>
                  <div class="field">
                    <label>冷氣卡／鑰匙借還備註</label>
                    <input id="vb-f-ackey" type="text" placeholder="例：警衛室領鑰匙＋冷氣卡2張">
                  </div>
                </div>
                <div style="display:flex;justify-content:flex-end;margin-top:12px">
                  <button type="button" class="btn-primary" onclick="vbSaveBooking()">💾 確認借用並檢查時段衝突</button>
                </div>
              `}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  window.GA_CORE.registerModule({
    id: 'venue-board',
    title: '場地與教室',
    navGroup: 'assets',
    icon: '🏟️',
    version: 'v2.0',
    getSummaryTile() {
      const tdy = typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10);
      const allB = getAllBookings();
      const todayB = allB.filter(b => b.date === tdy);
      const weekB = allB.filter(b => b.date >= tdy && diffDays(tdy, b.date) <= 7);
      const locks = getAutoProjectLocksForDate(tdy);
      const unpaid = weekB.filter(b => b.fee_status === '待核計場地費').length;
      return {
        id: 'venue-board',
        icon: '🏟️',
        title: '場地與教室',
        kpi: String(todayB.length || weekB.length),
        unit: todayB.length ? '場今日使用' : '場本週預約',
        tone: unpaid > 0 ? 'amber' : 'teal',
        redCount: 0,
        amberCount: unpaid,
        subText: todayB.length
          ? `今日：${todayB[0].space_name} ${todayB[0].start_time}`
          : locks.length
          ? `🚧 今日公務/施工保留 ${locks.length} 處`
          : `全校 ${getAllSpaces().length} 間空間卡片空閒可借`
      };
    },
    getAlerts(data, today) {
      const upcoming = getAllBookings().filter(b => b.date >= today && diffDays(today, b.date) <= 3 && b.fee_status === '待核計場地費');
      return upcoming.map(b => ({
        level: 'amber',
        badge: '場地待收費',
        title: `${b.space_name}｜${b.borrower_unit}（${b.event_title}）`,
        dueDate: b.date,
        actionHint: `${roc(b.date)} ${b.start_time}～${b.end_time} 借用，請確認場地費與冷氣卡／鑰匙交接`,
        action: () => { state.viewDate = b.date; switchTab('venue-board'); }
      }));
    },
    renderView
  });
})();
