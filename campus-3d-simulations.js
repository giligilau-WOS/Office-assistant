/**
 * ============================================================================
 * 3D 校舍數位雙生 — 6 大情境模擬引擎 × 國土測繪雲 NLSC 圖層 × 總務戰情連動
 * Module: campus-3d-simulations.js (v1.0)
 *
 * 1. ☀️ 1～12 月真實天文日照模擬（北緯 22.719°N 高雄太陽赤緯／仰角／方位角／3D 日軌／縮時播放）
 * 2. 🗺️ 國土測繪圖資服務雲免申請 WMTS 圖層（正射影像／灰階地圖／段籍圖／學校範圍／等高線／7級坡度）
 * 3. 🚨 防災疏散動線與消防設備覆蓋（教室→樓梯→操場集合區＋消防栓／滅火器／AED／泵浦室）
 * 4. 🚧 工程施工圍籬與人車分流（自動連動主系統進行中工程標案＋可手動切換情境）
 * 5. 🌙 夜間校園照明與監視器（CCTV）可視扇形與暗角模擬
 * 6. 🌬️ 季節風場與教室通風流線（冬季東北季風 NE vs 夏季西南季風 SW）
 * 7. 🌧️ 豪雨積水與校園排水路徑模擬（大雨／豪雨／颱風三段雨勢＋抽水機／沙包點位）
 * ============================================================================
 */

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const MONTH_MID_DOY = [21, 52, 80, 111, 141, 172, 202, 233, 264, 294, 325, 355]; // 每月約 21 日（對齊春分/夏至/秋分/冬至）

const NLSC_LAYERS = {
  NONE: { label: '原 Google 衛星底圖', zoom: 18, desc: '本機預載高解析衛星底圖' },
  PHOTO2: { label: '🛰️ 國土正射影像 (PHOTO2)', zoom: 18, desc: '內政部國土測繪中心最新正射航照' },
  PHOTO_MIX: { label: '🛰️ 航照混合含路名 (PHOTO_MIX)', zoom: 18, desc: '正射航照疊加道路名稱標註' },
  EMAP01: { label: '🗺️ 灰階電子地圖 (EMAP01)', zoom: 18, desc: '低飽和灰階底圖（最利於檢視 3D 模擬線條）' },
  EMAP5: { label: '🗺️ 通用電子地圖 (EMAP5)', zoom: 18, desc: '臺灣通用電子地圖含等高線' },
  SCHOOL: { label: '🏫 各級學校範圍圖 (SCHOOL)', zoom: 17, desc: '官方校地範圍邊界標示' },
  LANDSECT: { label: '📐 段籍圖 (LANDSECT)', zoom: 17, desc: '官方地段界線（校產撥用與界址核對）' },
  MOI_CONTOUR_2: { label: '⛰️ 等高線圖 (MOI_CONTOUR_2)', zoom: 17, desc: '地形高程等高線（搭配排水與坡地檢視）' },
  MOI_SLOPEP_LV7_2: { label: '📊 7 級坡度圖 (MOI_SLOPEP_LV7_2)', zoom: 17, desc: '官方 7 級坡度分級（防汛／邊坡安全佐證）' },
  MOI_ASPECT: { label: '🧭 坡向圖 (MOI_ASPECT)', zoom: 17, desc: '地形坡面朝向（搭配日照分析）' },
  B5000: { label: '📋 1/5000 基本地形圖 (B5000)', zoom: 17, desc: '工程會勘常用基本地形圖' }
};

/**
 * 精確天文太陽位置計算（適用於北緯 latDeg、東經 lngDeg、台灣標準時間 UTC+8）
 * 回傳：altitudeDeg（仰角）、azimuthDeg（方位角：北=0, 東=90, 南=180, 西=270）、
 * 以及本 3D 座標系 (+X=東, +Y=上, +Z=南) 之單位方向向量。
 */
export function computeSolarPosition(month, hour, latDeg = 22.71906, lngDeg = 120.4435) {
  const mIdx = Math.max(0, Math.min(11, Math.round(month) - 1));
  const doy = MONTH_MID_DOY[mIdx];
  const rad = Math.PI / 180;

  // 太陽赤緯角 δ (度)
  const declDeg = 23.44 * Math.sin(((2 * Math.PI) / 365) * (doy - 81));
  const decl = declDeg * rad;
  const lat = latDeg * rad;

  // 均時差 (EoT, 分鐘) + 經度校正 (台灣中央經線 120°E)
  const B = ((2 * Math.PI) / 365) * (doy - 81);
  const eotMin = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const solarTime = hour + (4 * (lngDeg - 120) + eotMin) / 60;
  const haDeg = (solarTime - 12) * 15; // 時角 H（上午負、下午正）
  const ha = haDeg * rad;

  const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAlt = Math.max(1e-5, Math.cos(alt));

  // 方位角 (由正北順時針)
  const cosAz = (Math.sin(decl) - Math.sin(alt) * Math.sin(lat)) / (cosAlt * Math.cos(lat));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (haDeg > 0) az = 2 * Math.PI - az;

  // 轉換為 3D 世界座標向量 (+X 東, +Y 上, +Z 南；北為 -Z)
  const x = Math.cos(alt) * Math.sin(az);
  const y = Math.sin(alt);
  const z = -Math.cos(alt) * Math.cos(az);

  // 估算當日日出／日落
  const cosH0 = Math.max(-1, Math.min(1, -Math.tan(lat) * Math.tan(decl)));
  const halfDayHrs = (Math.acos(cosH0) / rad) / 15;
  const noonLocal = 12 - (4 * (lngDeg - 120) + eotMin) / 60;

  return {
    month: mIdx + 1,
    hour,
    declDeg,
    altitudeDeg: alt / rad,
    azimuthDeg: az / rad,
    sunrise: noonLocal - halfDayHrs,
    sunset: noonLocal + halfDayHrs,
    dir: { x, y, z }
  };
}

function fmtHour(h) {
  const clamped = Math.max(0, Math.min(23.99, h));
  const hh = Math.floor(clamped);
  const mm = Math.round((clamped - hh) * 60);
  return `${String(hh + (mm === 60 ? 1 : 0)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
}

function readMainAppCache() {
  try {
    const raw = localStorage.getItem('ga_assistant_cache_v2');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function initCampusSimulations(ctx) {
  const {
    THREE, scene, sunLight, fillLight, hemiLight, ambientLight,
    ELEV, gx, gz, GEO, flyToCamera, satOverlayMesh, satOverlayMat
  } = ctx;

  const root = new THREE.Group();
  root.name = 'Campus_Simulations_Root';
  scene.add(root);

  const simState = {
    // 1. Solar
    month: new Date().getMonth() + 1,
    hour: 10.5,
    showSunArc: true,
    playMode: null, // null | 'day' | 'year'
    // 2. NLSC WMTS
    nlscLayer: 'NONE',
    nlscOpacity: 0.85,
    // 3. Five campus simulation layers
    evac: false,
    evacRadius: true,
    construction: false,
    constructionZone: 'auto', // 'auto' | 'track' | 'restroom' | 'kitchen'
    night: false,
    showCctv: true,
    wind: false,
    windSeason: 'NE', // 'NE' (冬季東北季風) | 'SW' (夏季西南季風)
    rain: false,
    rainLevel: 'heavy', // 'heavy' | 'torrential' | 'typhoon'
    // Live data summary
    liveSummary: { projects: [], solar: [], bookings: [] }
  };

  // =========================================================================
  // 0. 讀取主系統即時資料（Projects / Solar_Contracts / Venue_Bookings）
  // =========================================================================
  function refreshLiveBizData() {
    const cache = readMainAppCache();
    const tables = cache?.tables || {};
    const activeProjs = (tables.Projects || []).filter(p => !['已結案', '廢標撤案'].includes(p.status));
    const activeSolar = (tables.Solar_Contracts || []).filter(c => !['已屆滿', '已期滿', '已解約'].includes(c.status));
    const bookings = (tables.Project_Responsibilities || [])
      .filter(r => r.project_id === '__SYS_EXT__' && r.phase_name === 'VENUE_BOOKING' && !r.is_deleted)
      .map(r => { try { return JSON.parse(r.roles_matrix_json || '{}'); } catch { return null; } })
      .filter(Boolean);
    simState.liveSummary = { projects: activeProjs, solar: activeSolar, bookings };
    return simState.liveSummary;
  }
  refreshLiveBizData();

  function detectAutoConstructionZone() {
    const names = simState.liveSummary.projects.map(p => String(p.project_name || '')).join(' ');
    if (/跑道|操場|運動場/.test(names)) return 'track';
    if (/廁所|浴廁/.test(names)) return 'restroom';
    if (/廚房|食育/.test(names)) return 'kitchen';
    return 'track';
  }

  // =========================================================================
  // 1. ☀️ 1～12 月真實天文日照模擬 ＋ 3D 太陽軌跡弧線
  // =========================================================================
  const sunArcGroup = new THREE.Group();
  sunArcGroup.name = 'Sim_Sun_Arc';
  root.add(sunArcGroup);

  const SUN_RADIUS = 135;
  const CENTER_X = gx(25);
  const CENTER_Z = gz(38);

  const sunOrb = new THREE.Mesh(
    new THREE.SphereGeometry(3.8, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe066 })
  );
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(6.4, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.28, depthWrite: false })
  );
  sunOrb.add(sunHalo);
  sunArcGroup.add(sunOrb);

  let sunArcLine = null;
  let sunRayLine = null;

  function rebuildSunArc(month) {
    if (sunArcLine) { sunArcGroup.remove(sunArcLine); sunArcLine.geometry.dispose(); }
    const pts = [];
    for (let h = 5.5; h <= 18.5; h += 0.25) {
      const sp = computeSolarPosition(month, h, GEO.lat0, GEO.lng0);
      if (sp.altitudeDeg >= -1) {
        pts.push(new THREE.Vector3(
          CENTER_X + sp.dir.x * SUN_RADIUS,
          Math.max(1.5, sp.dir.y * SUN_RADIUS),
          CENTER_Z + sp.dir.z * SUN_RADIUS
        ));
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.72 });
    sunArcLine = new THREE.Line(geo, mat);
    sunArcGroup.add(sunArcLine);
  }

  function applySolarState() {
    const sp = computeSolarPosition(simState.month, simState.hour, GEO.lat0, GEO.lng0);
    const sunX = CENTER_X + sp.dir.x * SUN_RADIUS;
    const sunY = Math.max(4, sp.dir.y * SUN_RADIUS);
    const sunZ = CENTER_Z + sp.dir.z * SUN_RADIUS;

    sunOrb.position.set(sunX, sunY, sunZ);
    sunArcGroup.visible = simState.showSunArc && !simState.night;

    if (sunRayLine) { sunArcGroup.remove(sunRayLine); sunRayLine.geometry.dispose(); }
    sunRayLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(sunX, sunY, sunZ),
        new THREE.Vector3(CENTER_X, 2, CENTER_Z)
      ]),
      new THREE.LineDashedMaterial({ color: 0xfde68a, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.45 })
    );
    sunRayLine.computeLineDistances();
    sunArcGroup.add(sunRayLine);

    // 若非夜間模式，由真實天文日照主導光線與天空色
    if (!simState.night) {
      sunLight.position.set(sunX, Math.max(8, sunY), sunZ);
      const elevNorm = Math.max(0, Math.sin((Math.max(0, sp.altitudeDeg) * Math.PI) / 180));
      const rainDim = simState.rain ? (simState.rainLevel === 'typhoon' ? 0.48 : simState.rainLevel === 'torrential' ? 0.62 : 0.78) : 1.0;

      sunLight.intensity = (0.45 + elevNorm * 1.25) * rainDim;
      sunLight.color.setHex(sp.altitudeDeg < 18 ? 0xffb36b : sp.altitudeDeg < 35 ? 0xffe4b5 : 0xfff8ea);
      hemiLight.intensity = (0.65 + elevNorm * 0.22) * rainDim;
      if (ambientLight) ambientLight.intensity = 0.28 * rainDim;
      fillLight.intensity = 0.35 * rainDim;

      const daySky = new THREE.Color().lerpColors(
        new THREE.Color(0xf2a97c),
        new THREE.Color(0xbad6ef),
        Math.min(1, elevNorm * 1.65)
      );
      if (simState.rain) {
        daySky.lerp(new THREE.Color(0x475569), simState.rainLevel === 'typhoon' ? 0.72 : 0.5);
      }
      scene.background.copy(daySky);
      if (scene.fog) scene.fog.color.copy(daySky);
    }

    // 更新 UI 標籤與智慧分析
    const timeLbl = document.getElementById('sun-time-label');
    if (timeLbl) timeLbl.textContent = `${MONTH_NAMES[simState.month - 1]} ${fmtHour(simState.hour)}`;
    const monthLbl = document.getElementById('sun-month-label');
    if (monthLbl) monthLbl.textContent = `${MONTH_NAMES[simState.month - 1]}（21日）`;

    const metaEl = document.getElementById('sun-astro-meta');
    if (metaEl) {
      const azDir = sp.azimuthDeg < 45 || sp.azimuthDeg >= 315 ? '偏北'
        : sp.azimuthDeg < 135 ? '偏東'
        : sp.azimuthDeg < 225 ? '偏南' : '偏西';
      let tip = '日照均勻';
      if (sp.altitudeDeg <= 2) tip = '日出／日落低角度斜射';
      else if (simState.month >= 5 && simState.month <= 7 && Math.abs(simState.hour - 12) <= 1.2) tip = '☀️ 高雄夏至正午近天頂略偏北，北側外廊亦有日照';
      else if (simState.hour >= 14.5 && simState.hour <= 17.5) tip = '🔥 西曬尖峰（檢視西側教室／球場遮陽需求）';
      else if ((simState.month === 12 || simState.month === 1) && sp.altitudeDeg < 48) tip = '❄️ 冬季低仰角長影（留意北棟與屋頂光電板遮陰）';
      metaEl.innerHTML = `仰角 <strong>${Math.max(0, sp.altitudeDeg).toFixed(1)}°</strong>・方位 <strong>${Math.round(sp.azimuthDeg)}° (${azDir})</strong>・日出 ${fmtHour(sp.sunrise)} / 日落 ${fmtHour(sp.sunset)}<div class="text-amber-200/95 mt-0.5">${tip}</div>`;
    }

    updateHudBanner(sp);
  }

  // =========================================================================
  // 2. 🗺️ 國土測繪雲 NLSC 免申請 WMTS 圖層（實測跑道＋噴水池基準 ＋ 0.2m 微調）
  // =========================================================================
  const NLSC_CAL_KEY = 'ga_nlsc_cal_v2';
  const NLSC_BASE_ROT_DEG = 2.6; // 依正射影像對齊跑道與噴水池實測之校園軸線偏角 (+2.6°)
  const NLSC_BOUNDS = { rx0: -130, rx1: 185, rz0: -68, rz1: 146 }; // 315m × 214m（中心 rx=27.5, rz=39.0）
  const NLSC_W = NLSC_BOUNDS.rx1 - NLSC_BOUNDS.rx0;
  const NLSC_H = NLSC_BOUNDS.rz1 - NLSC_BOUNDS.rz0;
  const NLSC_CX = gx((NLSC_BOUNDS.rx0 + NLSC_BOUNDS.rx1) * 0.5);
  const NLSC_CZ = gz((NLSC_BOUNDS.rz0 + NLSC_BOUNDS.rz1) * 0.5);

  let nlscCal = { dx: 0, dz: 0, rotDeg: 0, scalePct: 100 };
  try {
    const saved = JSON.parse(localStorage.getItem(NLSC_CAL_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      nlscCal = {
        dx: Number(saved.dx) || 0,
        dz: Number(saved.dz) || 0,
        rotDeg: Number(saved.rotDeg) || 0,
        scalePct: Number(saved.scalePct) || 100
      };
    }
  } catch {}

  let nlscMesh = null;
  let nlscMat = null;
  const nlscTexCache = new Map();

  function lonLatToTileF(lng, lat, z) {
    const n = Math.pow(2, z);
    const x = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    return { x, y };
  }

  function applyNlscTransform() {
    if (!nlscMesh) return;
    nlscMesh.position.set(NLSC_CX + nlscCal.dx, 0.028, NLSC_CZ + nlscCal.dz);
    nlscMesh.rotation.set(-Math.PI / 2, 0, ((NLSC_BASE_ROT_DEG + nlscCal.rotDeg) * Math.PI) / 180, 'XYZ');
    const sc = nlscCal.scalePct / 100;
    nlscMesh.scale.set(sc, sc, 1);
    try { localStorage.setItem(NLSC_CAL_KEY, JSON.stringify(nlscCal)); } catch {}
  }

  function ensureNlscMesh() {
    if (nlscMesh) return;
    nlscMat = new THREE.MeshStandardMaterial({
      roughness: 0.94,
      metalness: 0.0,
      transparent: true,
      opacity: simState.nlscOpacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    nlscMesh = new THREE.Mesh(new THREE.PlaneGeometry(NLSC_W, NLSC_H), nlscMat);
    nlscMesh.receiveShadow = true;
    nlscMesh.visible = false;
    nlscMesh.userData.nonBlocking = true;
    applyNlscTransform();
    root.add(nlscMesh);
  }

  function syncNlscSatVisibility(layerId) {
    if (!satOverlayMesh) return;
    if (layerId === 'NONE') { satOverlayMesh.visible = true; return; }
    const isOverlayOnly = ['SCHOOL', 'LANDSECT', 'MOI_CONTOUR_2', 'MOI_SLOPEP_LV7_2', 'MOI_ASPECT'].includes(layerId);
    satOverlayMesh.visible = isOverlayOnly || simState.nlscOpacity < 0.96;
  }

  async function loadNlscLayer(layerId) {
    simState.nlscLayer = layerId;
    ensureNlscMesh();
    const statusEl = document.getElementById('nlsc-status-msg');
    if (layerId === 'NONE' || !NLSC_LAYERS[layerId]) {
      nlscMesh.visible = false;
      syncNlscSatVisibility('NONE');
      if (statusEl) statusEl.textContent = '目前使用本機高解析衛星底圖';
      updateHudBanner();
      return;
    }

    const cfg = NLSC_LAYERS[layerId];
    syncNlscSatVisibility(layerId);

    if (nlscTexCache.has(layerId)) {
      nlscMat.map = nlscTexCache.get(layerId);
      nlscMat.opacity = simState.nlscOpacity;
      nlscMat.needsUpdate = true;
      nlscMesh.visible = true;
      applyNlscTransform();
      if (statusEl) statusEl.textContent = `✅ 已套繪：${cfg.desc}`;
      updateHudBanner();
      return;
    }

    if (statusEl) statusEl.textContent = `⏳ 正在載入國土測繪雲 ${layerId} 圖磚...`;

    // 以精準 WGS84 換算係數計算 315m × 214m 校地貼圖矩形之經緯度邊界
    const mPerDegLat = 110742;
    const mPerDegLng = 111320 * Math.cos((GEO.lat0 * Math.PI) / 180);
    const lngMin = GEO.lng0 + (gx(NLSC_BOUNDS.rx0) - GEO.x0) / mPerDegLng;
    const lngMax = GEO.lng0 + (gx(NLSC_BOUNDS.rx1) - GEO.x0) / mPerDegLng;
    const latMax = GEO.lat0 - (gz(NLSC_BOUNDS.rz0) - GEO.z0) / mPerDegLat;
    const latMin = GEO.lat0 - (gz(NLSC_BOUNDS.rz1) - GEO.z0) / mPerDegLat;

    const z = cfg.zoom;
    const tl = lonLatToTileF(lngMin, latMax, z);
    const br = lonLatToTileF(lngMax, latMin, z);
    const tx0 = Math.floor(tl.x), tx1 = Math.floor(br.x);
    const ty0 = Math.floor(tl.y), ty1 = Math.floor(br.y);

    const tileW = 256;
    const fullW = (tx1 - tx0 + 1) * tileW;
    const fullH = (ty1 - ty0 + 1) * tileW;
    const stitch = document.createElement('canvas');
    stitch.width = fullW;
    stitch.height = fullH;
    const sCtx = stitch.getContext('2d');

    const tasks = [];
    let okCount = 0;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const url = `https://wmts.nlsc.gov.tw/wmts/${layerId}/default/GoogleMapsCompatible/${z}/${ty}/${tx}`;
        tasks.push(new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const timer = setTimeout(() => resolve(false), 6000);
          img.onload = () => {
            clearTimeout(timer);
            try {
              sCtx.drawImage(img, (tx - tx0) * tileW, (ty - ty0) * tileW, tileW, tileW);
              okCount++;
              resolve(true);
            } catch { resolve(false); }
          };
          img.onerror = () => { clearTimeout(timer); resolve(false); };
          img.src = url;
        }));
      }
    }

    await Promise.all(tasks);
    if (okCount === 0) {
      nlscMesh.visible = false;
      syncNlscSatVisibility('NONE');
      if (statusEl) statusEl.textContent = `⚠️ 無法連線國土測繪圖磚（可能離線或跨網域受限），已自動維持本機衛星底圖`;
      return;
    }

    // 依精確像素範圍裁切至 315×214 比例（高解析 1280px 寬）
    const cropX = (tl.x - tx0) * tileW;
    const cropY = (tl.y - ty0) * tileW;
    const cropW = Math.max(8, (br.x - tl.x) * tileW);
    const cropH = Math.max(8, (br.y - tl.y) * tileW);
    const out = document.createElement('canvas');
    out.width = 1280;
    out.height = Math.round(1280 * (NLSC_H / NLSC_W));
    out.getContext('2d').drawImage(stitch, cropX, cropY, cropW, cropH, 0, 0, out.width, out.height);

    const tex = new THREE.CanvasTexture(out);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    nlscTexCache.set(layerId, tex);

    if (simState.nlscLayer === layerId) {
      nlscMat.map = tex;
      nlscMat.opacity = simState.nlscOpacity;
      nlscMat.needsUpdate = true;
      nlscMesh.visible = true;
      applyNlscTransform();
      if (statusEl) statusEl.textContent = `✅ 已套繪：${cfg.desc}`;
      updateHudBanner();
    }
  }

  // =========================================================================
  // 3. 🚨 防災疏散動線與消防設備覆蓋 (EvacFireLayer)
  // =========================================================================
  const evacGroup = new THREE.Group();
  evacGroup.name = 'Sim_Evac_Fire';
  evacGroup.visible = false;
  root.add(evacGroup);

  const evacPulses = [];
  const evacCoverageDiscs = [];

  function buildEvacLayer() {
    const matPath = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.85 });
    const matOrb = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });

    // 4 條主疏散動線：西側 B 梯、穿堂中段、東側 A 梯、中央廚房 → 200m 操場安全集合區 (x=10, z=46.5)
    const routes = [
      [[gx(18), ELEV.F3 + 0.4, gz(10.2)], [gx(5.5), ELEV.F3 + 0.4, gz(10.2)], [gx(5.5), ELEV.F1 + 0.4, gz(10.2)], [gx(5.5), 0.35, gz(26)], [gx(8), 0.35, gz(45)]],
      [[gx(42), ELEV.F2 + 0.4, gz(10.2)], [gx(53.5), ELEV.F2 + 0.4, gz(10.2)], [gx(53.5), ELEV.F1 + 0.4, gz(10.2)], [gx(40), 0.35, gz(24)], [gx(14), 0.35, gz(45)]],
      [[gx(68), ELEV.F3 + 0.4, gz(10.2)], [gx(74.2), ELEV.F3 + 0.4, gz(12.2)], [gx(74.2), ELEV.F1 + 0.4, gz(15.5)], [gx(58), 0.35, gz(32)], [gx(22), 0.35, gz(46.5)]],
      [[gx(-22), ELEV.F1 + 0.4, gz(8.5)], [gx(-18), 0.35, gz(18)], [gx(-6), 0.35, gz(36)], [gx(6), 0.35, gz(46.5)]]
    ];

    routes.forEach((ptsArr) => {
      const curve = new THREE.CatmullRomCurve3(ptsArr.map(p => new THREE.Vector3(p[0], p[1], p[2])));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.32, 8, false), matPath);
      evacGroup.add(tube);
      for (let k = 0; k < 4; k++) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.68, 10, 10), matOrb);
        evacGroup.add(orb);
        evacPulses.push({ curve, mesh: orb, offset: k * 0.25 });
      }
    });

    // 操場安全集合區雙層光環
    const safeRing = new THREE.Mesh(
      new THREE.RingGeometry(10.5, 12.2, 48),
      new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.set(gx(10), 0.14, gz(46.5));
    evacGroup.add(safeRing);

    const safeDisc = new THREE.Mesh(
      new THREE.CircleGeometry(10.5, 48),
      new THREE.MeshBasicMaterial({ color: 0x34d399, side: THREE.DoubleSide, transparent: true, opacity: 0.22, depthWrite: false })
    );
    safeDisc.rotation.x = -Math.PI / 2;
    safeDisc.position.set(gx(10), 0.12, gz(46.5));
    evacGroup.add(safeDisc);

    // 建築周邊 4m 玻璃／外牆落物警戒帶
    const fallZone = new THREE.Mesh(
      new THREE.PlaneGeometry(88, 19),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    fallZone.rotation.x = -Math.PI / 2;
    fallZone.position.set(gx(40), 0.08, gz(6.5));
    evacGroup.add(fallZone);

    // 消防栓 / 滅火器 / AED / 緊急發電機與消防泵浦室標記 ＋ 18m 覆蓋半徑
    const safetyNodes = [
      { x: 74.2, y: 2.2, z: 14.5, color: 0xdc2626, r: 22, label: '消防泵浦/發電機' },
      { x: 53.5, y: 2.2, z: 7.5,  color: 0x0ea5e9, r: 20, label: '穿堂 AED' },
      { x: 5.5,  y: 2.2, z: 9.5,  color: 0xef4444, r: 18, label: '西側消防栓' },
      { x: 38.0, y: 2.2, z: 10.5, color: 0xef4444, r: 18, label: '中段消防栓' },
      { x: -24,  y: 2.2, z: 7.0,  color: 0xf97316, r: 18, label: '中央廚房滅火器' },
      { x: 86.0, y: 2.2, z: 78.0, color: 0xef4444, r: 20, label: '風雨球場滅火器' }
    ];
    safetyNodes.forEach((n) => {
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.75, 3.2, 12),
        new THREE.MeshBasicMaterial({ color: n.color })
      );
      beacon.position.set(gx(n.x), n.y, gz(n.z));
      evacGroup.add(beacon);

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(n.r, 36),
        new THREE.MeshBasicMaterial({ color: n.color, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(gx(n.x), 0.11, gz(n.z));
      evacGroup.add(disc);
      evacCoverageDiscs.push(disc);
    });
  }
  buildEvacLayer();

  // =========================================================================
  // 4. 🚧 工程施工圍籬與人車分流 (ConstructionLayer — 自動連動主系統標案)
  // =========================================================================
  const constructionGroup = new THREE.Group();
  constructionGroup.name = 'Sim_Construction';
  constructionGroup.visible = false;
  root.add(constructionGroup);

  const truckPulses = [];
  const ZONE_SPECS = {
    track: {
      title: '跑道及周邊設施整建工程（操場圍籬鎖區）',
      box: { x: 10.5, z: 46.5, w: 102, d: 51 },
      truckPath: [[gx(-45), 0.45, gz(68)], [gx(-34), 0.45, gz(62)], [gx(-20), 0.45, gz(58)], [gx(5), 0.45, gz(58)]],
      studentPath: [[gx(5), 0.35, gz(14)], [gx(42), 0.35, gz(14)], [gx(74), 0.35, gz(16)], [gx(86), 0.35, gz(56)], [gx(86), 0.35, gz(74)]],
      cam: { pos: [gx(12), 54, gz(118)], target: [gx(10), 0, gz(46)] }
    },
    restroom: {
      title: '東側 1~3F 廁所整修工程（東翼圍籬分流）',
      box: { x: 75.5, z: 5.0, w: 13, d: 14 },
      truckPath: [[gx(102), 0.45, gz(18)], [gx(88), 0.45, gz(14)], [gx(82), 0.45, gz(9)]],
      studentPath: [[gx(66), 0.35, gz(12)], [gx(53), 0.35, gz(12)], [gx(53), 0.35, gz(24)]],
      cam: { pos: [gx(106), 28, gz(38)], target: [gx(75), 4, gz(6)] }
    },
    kitchen: {
      title: '中央廚房周邊修繕工程（西側車道分流）',
      box: { x: -28, z: 3.5, w: 28, d: 22 },
      truckPath: [[gx(-48), 0.45, gz(30)], [gx(-44), 0.45, gz(16)], [gx(-36), 0.45, gz(12)]],
      studentPath: [[gx(-8), 0.35, gz(12)], [gx(8), 0.35, gz(12)], [gx(8), 0.35, gz(24)]],
      cam: { pos: [gx(-26), 34, gz(46)], target: [gx(-28), 3, gz(4)] }
    }
  };

  function rebuildConstructionZone() {
    while (constructionGroup.children.length) {
      const ch = constructionGroup.children.pop();
      if (ch.geometry) ch.geometry.dispose();
    }
    truckPulses.length = 0;

    const zoneKey = simState.constructionZone === 'auto' ? detectAutoConstructionZone() : simState.constructionZone;
    const spec = ZONE_SPECS[zoneKey] || ZONE_SPECS.track;
    const { x, z, w, d } = spec.box;

    // 禁入紅區地面填充
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(gx(x), 0.16, gz(z));
    constructionGroup.add(pad);

    // 紅白相間 3D 圍籬柱＋頂桿
    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const corners = [
      [x - w / 2, z - d / 2], [x + w / 2, z - d / 2],
      [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]
    ];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const segs = Math.max(4, Math.round(len / 4));
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs, tm = (t0 + t1) / 2;
        const segLen = len / segs;
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(segLen, 1.85, 0.18),
          s % 2 === 0 ? redMat : whiteMat
        );
        panel.position.set(gx(ax + (bx - ax) * tm), 0.925, gz(az + (bz - az) * tm));
        panel.rotation.y = Math.atan2(-(bz - az), bx - ax);
        constructionGroup.add(panel);
      }
    }

    // 橘色工程車動線（帶流動光點）
    const truckCurve = new THREE.CatmullRomCurve3(spec.truckPath.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    constructionGroup.add(new THREE.Mesh(
      new THREE.TubeGeometry(truckCurve, 32, 0.42, 8, false),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9 })
    ));
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.1), new THREE.MeshBasicMaterial({ color: 0xfdba74 }));
      constructionGroup.add(m);
      truckPulses.push({ curve: truckCurve, mesh: m, offset: k / 3 });
    }

    // 綠色學生安全替代步道
    const stuCurve = new THREE.CatmullRomCurve3(spec.studentPath.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    constructionGroup.add(new THREE.Mesh(
      new THREE.TubeGeometry(stuCurve, 36, 0.35, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.85 })
    ));
  }
  rebuildConstructionZone();

  // =========================================================================
  // 5. 🌙 夜間校園照明與監視器（CCTV）死角模擬 (NightCctvLayer)
  // =========================================================================
  const nightGroup = new THREE.Group();
  nightGroup.name = 'Sim_Night_CCTV';
  nightGroup.visible = false;
  root.add(nightGroup);

  const cctvGroup = new THREE.Group();
  nightGroup.add(cctvGroup);

  function buildNightCctvLayer() {
    // 校園主要路燈光球＋照明光錐
    const lamps = [
      { x: 96, y: 5.5, z: 24, light: true },   // 東大門警衛室
      { x: 53, y: 5.0, z: 12, light: true },   // 主棟穿堂
      { x: 18, y: 5.0, z: 12, light: false },  // 西側教學走廊
      { x: 75, y: 5.0, z: 12, light: false },  // 東側教學走廊
      { x: -18, y: 5.0, z: 12, light: true },  // 中央廚房／食育走廊
      { x: 86, y: 7.5, z: 80, light: true },   // 風雨球場
      { x: 64, y: 5.5, z: 82, light: false }   // 南側門
    ];
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });

    lamps.forEach((lp) => {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), bulbMat);
      bulb.position.set(gx(lp.x), lp.y, gz(lp.z));
      nightGroup.add(bulb);

      const cone = new THREE.Mesh(new THREE.ConeGeometry(7.5, lp.y, 18, 1, true), coneMat);
      cone.position.set(gx(lp.x), lp.y * 0.5, gz(lp.z));
      nightGroup.add(cone);

      if (lp.light) {
        const pt = new THREE.PointLight(0xffe08a, 3.2, 42, 1.5);
        pt.position.set(gx(lp.x), lp.y - 0.5, gz(lp.z));
        nightGroup.add(pt);
      }
    });

    // 監視器（CCTV）青綠色可視扇形（FOV）
    const cams = [
      { x: 95, z: 24, dirRad: Math.PI * 0.85, fov: 1.15, range: 28 }, // 東大門朝校內
      { x: 53, z: 10, dirRad: Math.PI * 0.5,  fov: 1.30, range: 26 }, // 穿堂朝操場
      { x: 6,  z: 10, dirRad: Math.PI * 0.35, fov: 1.15, range: 25 }, // 西側走廊
      { x: -24, z: 11, dirRad: Math.PI * 0.6, fov: 1.15, range: 24 }, // 廚房車道
      { x: 74, z: 72, dirRad: Math.PI * 0.15, fov: 1.25, range: 28 }  // 風雨球場
    ];
    const fovMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
    cams.forEach((cm) => {
      const seg = new THREE.Mesh(new THREE.CircleGeometry(cm.range, 24, cm.dirRad - cm.fov / 2, cm.fov), fovMat);
      seg.rotation.x = -Math.PI / 2;
      seg.position.set(gx(cm.x), 0.22, gz(cm.z));
      cctvGroup.add(seg);

      const camDot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
      camDot.position.set(gx(cm.x), 4.2, gz(cm.z));
      cctvGroup.add(camDot);
    });

    // 暗角／監視死角建議補強提示環（橘紅虛線圓）
    const blindSpots = [
      { x: -34, z: -12, r: 9.5 },  // 廚房北側暗角
      { x: 25,  z: -12, r: 10.5 }, // 主棟北側圍牆外廊
      { x: -28, z: 58,  r: 11.0 }  // 操場西南角
    ];
    blindSpots.forEach((bs) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(bs.r - 0.8, bs.r, 32),
        new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide, transparent: true, opacity: 0.82 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(gx(bs.x), 0.24, gz(bs.z));
      cctvGroup.add(ring);
    });
  }
  buildNightCctvLayer();

  function applyNightState() {
    nightGroup.visible = simState.night;
    cctvGroup.visible = simState.night && simState.showCctv;
    if (simState.night) {
      const nightSky = new THREE.Color(0x0b1528);
      scene.background.copy(nightSky);
      if (scene.fog) scene.fog.color.copy(nightSky);
      sunLight.intensity = 0.08;
      sunLight.color.setHex(0x64748b);
      hemiLight.intensity = 0.22;
      if (ambientLight) ambientLight.intensity = 0.14;
      fillLight.intensity = 0.1;
    } else {
      applySolarState();
    }
    updateHudBanner();
  }

  // =========================================================================
  // 6. 🌬️ 季節風場與教室通風流線 (WindFlowLayer)
  // =========================================================================
  const windGroup = new THREE.Group();
  windGroup.name = 'Sim_Wind_Flow';
  windGroup.visible = false;
  root.add(windGroup);

  const WIND_COUNT = 220;
  const windPositions = new Float32Array(WIND_COUNT * 2 * 3);
  const windSeeds = [];
  for (let i = 0; i < WIND_COUNT; i++) {
    windSeeds.push({
      x: -70 + Math.random() * 200,
      y: 1.5 + Math.random() * 14.5,
      z: -24 + Math.random() * 124,
      speed: 14 + Math.random() * 12,
      len: 4.5 + Math.random() * 4.5
    });
  }
  const windGeo = new THREE.BufferGeometry();
  windGeo.setAttribute('position', new THREE.BufferAttribute(windPositions, 3));
  const windMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 });
  const windLines = new THREE.LineSegments(windGeo, windMat);
  windGroup.add(windLines);

  function tickWind(dt) {
    if (!simState.wind) return;
    // NE 東北季風：從 (+X, -Z) 吹向 (-X, +Z)；SW 西南季風：從 (-X, +Z) 吹向 (+X, -Z)
    const isNE = simState.windSeason === 'NE';
    const dx = isNE ? -0.707 : 0.707;
    const dz = isNE ? 0.707 : -0.707;
    windMat.color.setHex(isNE ? 0x38bdf8 : 0x34d399);

    const pos = windGeo.attributes.position.array;
    for (let i = 0; i < WIND_COUNT; i++) {
      const s = windSeeds[i];
      s.x += dx * s.speed * dt;
      s.z += dz * s.speed * dt;
      if (s.x < -75) s.x = 130;
      if (s.x > 130) s.x = -75;
      if (s.z < -26) s.z = 102;
      if (s.z > 102) s.z = -26;

      const idx = i * 6;
      pos[idx]     = gx(s.x);
      pos[idx + 1] = s.y;
      pos[idx + 2] = gz(s.z);
      pos[idx + 3] = gx(s.x - dx * s.len);
      pos[idx + 4] = s.y;
      pos[idx + 5] = gz(s.z - dz * s.len);
    }
    windGeo.attributes.position.needsUpdate = true;
  }

  // =========================================================================
  // 7. 🌧️ 豪雨積水與校園排水路徑模擬 (RainFloodLayer)
  // =========================================================================
  const rainGroup = new THREE.Group();
  rainGroup.name = 'Sim_Rain_Flood';
  rainGroup.visible = false;
  root.add(rainGroup);

  const RAIN_COUNT = 520;
  const rainPositions = new Float32Array(RAIN_COUNT * 2 * 3);
  const rainDrops = [];
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainDrops.push({
      x: -70 + Math.random() * 200,
      y: Math.random() * 42,
      z: -25 + Math.random() * 125,
      vy: 26 + Math.random() * 14
    });
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainLines = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.55 })
  );
  rainGroup.add(rainLines);

  // 低窪易積水熱區 ＋ 沙包／抽水機預置點
  const puddleMeshes = [];
  function buildFloodZones() {
    const puddles = [
      { x: 10,  z: 46.5, rx: 32, rz: 14, baseOp: 0.34 }, // 操場內野低窪積水
      { x: 53,  z: 16,   rx: 9,  rz: 6,  baseOp: 0.40 }, // 穿堂南側低處
      { x: -34, z: 16,   rx: 11, rz: 6.5, baseOp: 0.42 }, // 中央廚房西南排水口
      { x: 96,  z: 24,   rx: 9,  rz: 6,  baseOp: 0.36 }  // 東大門前庭
    ];
    puddles.forEach((pd) => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(1, 32),
        new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: pd.baseOp, side: THREE.DoubleSide, depthWrite: false })
      );
      m.rotation.x = -Math.PI / 2;
      m.scale.set(pd.rx, pd.rz, 1);
      m.position.set(gx(pd.x), 0.17, gz(pd.z));
      m.userData = pd;
      rainGroup.add(m);
      puddleMeshes.push(m);
    });

    // 排水溝流向藍線
    const drainRoutes = [
      [[gx(53), 0.25, gz(14)], [gx(53), 0.25, gz(24)], [gx(70), 0.25, gz(24)], [gx(95), 0.25, gz(24)]],
      [[gx(-22), 0.25, gz(14)], [gx(-34), 0.25, gz(18)], [gx(-42), 0.25, gz(38)]]
    ];
    drainRoutes.forEach((pts) => {
      const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
      rainGroup.add(new THREE.Mesh(
        new THREE.TubeGeometry(c, 24, 0.28, 6, false),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 })
      ));
    });

    // 黃色沙包／抽水機建議部署點
    const pumpPts = [[53, 12], [-30, 12], [93, 24], [74, 15.5]];
    pumpPts.forEach(([px, pz]) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 2.2, 8),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      cone.position.set(gx(px), 1.1, gz(pz));
      rainGroup.add(cone);
    });
  }
  buildFloodZones();

  function applyRainIntensity() {
    rainGroup.visible = simState.rain;
    const scaleMul = simState.rainLevel === 'typhoon' ? 1.28 : simState.rainLevel === 'torrential' ? 1.08 : 0.82;
    const opMul = simState.rainLevel === 'typhoon' ? 1.35 : simState.rainLevel === 'torrential' ? 1.05 : 0.72;
    puddleMeshes.forEach((m) => {
      const pd = m.userData;
      m.scale.set(pd.rx * scaleMul, pd.rz * scaleMul, 1);
      m.material.opacity = Math.min(0.68, pd.baseOp * opMul);
    });
    if (!simState.night) applySolarState();
    updateHudBanner();
  }

  function tickRain(dt) {
    if (!simState.rain) return;
    const activeCnt = simState.rainLevel === 'typhoon' ? RAIN_COUNT : simState.rainLevel === 'torrential' ? 360 : 210;
    const windTilt = simState.rainLevel === 'typhoon' ? -2.2 : -0.6;
    const pos = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const idx = i * 6;
      if (i >= activeCnt) {
        pos[idx + 1] = -20; pos[idx + 4] = -20;
        continue;
      }
      const d = rainDrops[i];
      d.y -= d.vy * dt;
      if (d.y < 0.2) d.y = 38 + Math.random() * 8;
      pos[idx]     = gx(d.x);
      pos[idx + 1] = d.y;
      pos[idx + 2] = gz(d.z);
      pos[idx + 3] = gx(d.x + windTilt * 0.4);
      pos[idx + 4] = d.y + 1.8;
      pos[idx + 5] = gz(d.z - windTilt * 0.3);
    }
    rainGeo.attributes.position.needsUpdate = true;
  }

  // =========================================================================
  // 8. 浮動模擬狀態 HUD ＆ UI 事件綁定
  // =========================================================================
  function updateHudBanner(spOpt = null) {
    const hud = document.getElementById('sim-hud-bar');
    if (!hud) return;
    const tags = [];
    const sp = spOpt || computeSolarPosition(simState.month, simState.hour, GEO.lat0, GEO.lng0);
    if (!simState.night) {
      tags.push(`☀️ ${MONTH_NAMES[simState.month - 1]} ${fmtHour(simState.hour)}（仰角 ${Math.max(0, sp.altitudeDeg).toFixed(0)}°）`);
    } else {
      tags.push(`🌙 夜間照明${simState.showCctv ? '＋CCTV 視角' : ''}`);
    }
    if (simState.nlscLayer !== 'NONE') tags.push(`🗺️ 國土測繪 ${simState.nlscLayer}`);
    if (simState.evac) tags.push('🚨 防災疏散動線');
    if (simState.construction) {
      const zKey = simState.constructionZone === 'auto' ? detectAutoConstructionZone() : simState.constructionZone;
      const projCnt = simState.liveSummary.projects.length;
      tags.push(`🚧 ${ZONE_SPECS[zKey]?.title?.split('（')[0] || '施工圍籬'}${projCnt ? `（連動 ${projCnt} 案）` : ''}`);
    }
    if (simState.wind) tags.push(simState.windSeason === 'NE' ? '🌬️ 冬季東北季風' : '🌬️ 夏季西南季風');
    if (simState.rain) {
      const lvTxt = simState.rainLevel === 'typhoon' ? '颱風強降雨' : simState.rainLevel === 'torrential' ? '豪雨積水' : '大雨排水';
      tags.push(`🌧️ ${lvTxt}`);
    }

    const activeExtra = simState.evac || simState.construction || simState.night || simState.wind || simState.rain || simState.nlscLayer !== 'NONE' || !!simState.playMode;
    hud.classList.toggle('hidden', !activeExtra);
    hud.innerHTML = tags.map(t => `<span class="px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-600/70 text-[11px] font-semibold text-slate-100 whitespace-nowrap">${t}</span>`).join('');
  }

  function bindUi() {
    const monthSlider = document.getElementById('sun-month-slider');
    const hourSlider = document.getElementById('sun-slider');
    const arcChk = document.getElementById('toggle-sun-arc');
    const playDayBtn = document.getElementById('sun-play-day');
    const playYearBtn = document.getElementById('sun-play-year');

    if (monthSlider) {
      monthSlider.value = String(simState.month);
      monthSlider.addEventListener('input', (e) => {
        simState.month = Number(e.target.value);
        rebuildSunArc(simState.month);
        applySolarState();
      });
    }
    if (hourSlider) {
      hourSlider.min = '5.5';
      hourSlider.max = '18.5';
      hourSlider.step = '0.25';
      hourSlider.value = String(simState.hour);
      hourSlider.addEventListener('input', (e) => {
        simState.hour = parseFloat(e.target.value);
        applySolarState();
      });
    }
    if (arcChk) {
      arcChk.checked = simState.showSunArc;
      arcChk.addEventListener('change', (e) => {
        simState.showSunArc = e.target.checked;
        applySolarState();
      });
    }

    document.querySelectorAll('.sun-term-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        simState.month = Number(btn.dataset.month);
        if (monthSlider) monthSlider.value = String(simState.month);
        if (btn.dataset.hour) {
          simState.hour = parseFloat(btn.dataset.hour);
          if (hourSlider) hourSlider.value = String(simState.hour);
        }
        rebuildSunArc(simState.month);
        applySolarState();
      });
    });

    const syncPlayBtns = () => {
      if (playDayBtn) playDayBtn.textContent = simState.playMode === 'day' ? '⏸ 暫停單日' : '▶ 播放一日';
      if (playYearBtn) playYearBtn.textContent = simState.playMode === 'year' ? '⏸ 暫停全年' : '📅 播放全年';
    };
    if (playDayBtn) {
      playDayBtn.addEventListener('click', () => {
        simState.playMode = simState.playMode === 'day' ? null : 'day';
        syncPlayBtns();
        updateHudBanner();
      });
    }
    if (playYearBtn) {
      playYearBtn.addEventListener('click', () => {
        simState.playMode = simState.playMode === 'year' ? null : 'year';
        if (simState.playMode === 'year') {
          simState.hour = 12.0;
          if (hourSlider) hourSlider.value = '12';
        }
        syncPlayBtns();
        updateHudBanner();
      });
    }

    // 國土測繪 NLSC 圖層選擇器
    const nlscSel = document.getElementById('nlsc-layer-select');
    if (nlscSel) {
      nlscSel.innerHTML = Object.entries(NLSC_LAYERS)
        .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
        .join('');
      nlscSel.addEventListener('change', (e) => loadNlscLayer(e.target.value));
    }
    const nlscOp = document.getElementById('nlsc-opacity');
    if (nlscOp) {
      nlscOp.addEventListener('input', (e) => {
        simState.nlscOpacity = Number(e.target.value) / 100;
        const lbl = document.getElementById('nlsc-opacity-val');
        if (lbl) lbl.textContent = `${e.target.value}%`;
        if (nlscMat) nlscMat.opacity = simState.nlscOpacity;
        syncNlscSatVisibility(simState.nlscLayer);
      });
    }
    const nlscPortalBtn = document.getElementById('btn-open-nlsc-portal');
    if (nlscPortalBtn) {
      nlscPortalBtn.href = `https://maps.nlsc.gov.tw/T09/mapshow.action?In_type=web&In_x=${GEO.lng0.toFixed(6)}&In_y=${GEO.lat0.toFixed(6)}&In_scale=2500`;
    }

    // 圖資對位微調滑桿（即時移動與記憶）
    const syncCalUi = () => {
      const setV = (id, val, txt) => {
        const el = document.getElementById(id);
        const lb = document.getElementById(`${id}-val`);
        if (el) el.value = String(val);
        if (lb) lb.textContent = txt;
      };
      setV('nlsc-cal-dx', nlscCal.dx, `${nlscCal.dx}m`);
      setV('nlsc-cal-dz', nlscCal.dz, `${nlscCal.dz}m`);
      setV('nlsc-cal-rot', nlscCal.rotDeg, `${nlscCal.rotDeg}°`);
      setV('nlsc-cal-scale', nlscCal.scalePct, `${nlscCal.scalePct}%`);
    };
    syncCalUi();
    [
      ['nlsc-cal-dx', 'dx', v => `${v}m`],
      ['nlsc-cal-dz', 'dz', v => `${v}m`],
      ['nlsc-cal-rot', 'rotDeg', v => `${v}°`],
      ['nlsc-cal-scale', 'scalePct', v => `${v}%`]
    ].forEach(([id, key, fmt]) => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        nlscCal[key] = parseFloat(e.target.value);
        const lb = document.getElementById(`${id}-val`);
        if (lb) lb.textContent = fmt(nlscCal[key]);
        applyNlscTransform();
      });
    });
    document.getElementById('btn-nlsc-cal-reset')?.addEventListener('click', () => {
      nlscCal = { dx: 0, dz: 0, rotDeg: 0, scalePct: 100 };
      syncCalUi();
      applyNlscTransform();
    });

    // 5 大校園情境模擬開關
    const bindToggle = (id, key, subId, onChange) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        simState[key] = el.checked;
        if (subId) document.getElementById(subId)?.classList.toggle('hidden', !el.checked);
        onChange(el.checked);
        updateHudBanner();
      });
    };

    bindToggle('toggle-sim-evac', 'evac', 'sim-evac-opts', (on) => {
      evacGroup.visible = on;
      if (on) flyToCamera([gx(20), 68, gz(108)], [gx(22), 2, gz(34)], 700);
    });
    document.getElementById('toggle-sim-evac-radius')?.addEventListener('change', (e) => {
      simState.evacRadius = e.target.checked;
      evacCoverageDiscs.forEach(d => { d.visible = simState.evacRadius; });
    });

    bindToggle('toggle-sim-construction', 'construction', 'sim-construction-opts', (on) => {
      constructionGroup.visible = on;
      if (on) {
        rebuildConstructionZone();
        const zKey = simState.constructionZone === 'auto' ? detectAutoConstructionZone() : simState.constructionZone;
        const cam = ZONE_SPECS[zKey]?.cam;
        if (cam) flyToCamera(cam.pos, cam.target, 750);
      }
    });
    document.getElementById('sim-construction-zone')?.addEventListener('change', (e) => {
      simState.constructionZone = e.target.value;
      rebuildConstructionZone();
      const zKey = simState.constructionZone === 'auto' ? detectAutoConstructionZone() : simState.constructionZone;
      const cam = ZONE_SPECS[zKey]?.cam;
      if (cam && simState.construction) flyToCamera(cam.pos, cam.target, 700);
      updateHudBanner();
    });

    bindToggle('toggle-sim-night', 'night', 'sim-night-opts', () => applyNightState());
    document.getElementById('toggle-sim-cctv')?.addEventListener('change', (e) => {
      simState.showCctv = e.target.checked;
      cctvGroup.visible = simState.night && simState.showCctv;
      updateHudBanner();
    });

    bindToggle('toggle-sim-wind', 'wind', 'sim-wind-opts', (on) => { windGroup.visible = on; });
    document.querySelectorAll('.sim-wind-btn').forEach((b) => {
      b.addEventListener('click', () => {
        simState.windSeason = b.dataset.season;
        document.querySelectorAll('.sim-wind-btn').forEach(x => {
          const active = x.dataset.season === simState.windSeason;
          x.classList.toggle('bg-sky-500', active);
          x.classList.toggle('text-white', active);
          x.classList.toggle('bg-slate-800/90', !active);
        });
        updateHudBanner();
      });
    });

    bindToggle('toggle-sim-rain', 'rain', 'sim-rain-opts', () => applyRainIntensity());
    document.querySelectorAll('.sim-rain-btn').forEach((b) => {
      b.addEventListener('click', () => {
        simState.rainLevel = b.dataset.level;
        document.querySelectorAll('.sim-rain-btn').forEach(x => {
          const active = x.dataset.level === simState.rainLevel;
          x.classList.toggle('bg-sky-500', active);
          x.classList.toggle('text-white', active);
          x.classList.toggle('bg-slate-800/90', !active);
        });
        applyRainIntensity();
      });
    });

    // 一鍵重置全部模擬
    document.getElementById('btn-sim-reset-all')?.addEventListener('click', () => {
      simState.playMode = null;
      syncPlayBtns();
      ['toggle-sim-evac', 'toggle-sim-construction', 'toggle-sim-night', 'toggle-sim-wind', 'toggle-sim-rain'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.checked) { el.checked = false; el.dispatchEvent(new Event('change')); }
      });
      if (nlscSel && nlscSel.value !== 'NONE') {
        nlscSel.value = 'NONE';
        loadNlscLayer('NONE');
      }
      updateHudBanner();
    });

    // 渲染主系統即時連動摘要列
    const liveBox = document.getElementById('sim-live-summary');
    if (liveBox) {
      const { projects, solar, bookings } = simState.liveSummary;
      liveBox.innerHTML = `📊 戰情連動：工程/招標 <strong>${projects.length}</strong> 案・光電合約 <strong>${solar.length}</strong> 件・場地預約 <strong>${bookings.length}</strong> 筆`;
    }
  }

  // 支援 URL 參數 ?sim=evac|construction|night|wind|rain|sun
  function applySimFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const sim = (params.get('sim') || '').toLowerCase();
    const map = {
      evac: 'toggle-sim-evac',
      construction: 'toggle-sim-construction',
      night: 'toggle-sim-night',
      wind: 'toggle-sim-wind',
      rain: 'toggle-sim-rain'
    };
    if (map[sim]) {
      const el = document.getElementById(map[sim]);
      if (el && !el.checked) {
        el.checked = true;
        el.dispatchEvent(new Event('change'));
      }
    }
  }

  let elapsed = 0;
  let yearAccum = 0;

  function tick(dt) {
    elapsed += dt;

    // 1. 縮時播放
    if (simState.playMode === 'day') {
      simState.hour += dt * 1.6;
      if (simState.hour > 18.25) simState.hour = 5.75;
      const hs = document.getElementById('sun-slider');
      if (hs) hs.value = String(simState.hour.toFixed(2));
      applySolarState();
    } else if (simState.playMode === 'year') {
      yearAccum += dt;
      if (yearAccum >= 0.75) {
        yearAccum = 0;
        simState.month = (simState.month % 12) + 1;
        const ms = document.getElementById('sun-month-slider');
        if (ms) ms.value = String(simState.month);
        rebuildSunArc(simState.month);
        applySolarState();
      }
    }

    // 2. 防災疏散流動光點
    if (simState.evac) {
      evacPulses.forEach((p) => {
        const t = (elapsed * 0.16 + p.offset) % 1;
        p.mesh.position.copy(p.curve.getPointAt(t));
      });
    }

    // 3. 工程車流動方塊
    if (simState.construction) {
      truckPulses.forEach((p) => {
        const t = (elapsed * 0.14 + p.offset) % 1;
        const pt = p.curve.getPointAt(t);
        const tan = p.curve.getTangentAt(t);
        p.mesh.position.copy(pt);
        p.mesh.rotation.y = Math.atan2(tan.x, tan.z);
      });
    }

    // 4. 風場與豪雨粒子
    tickWind(dt);
    tickRain(dt);
  }

  // 初始化
  rebuildSunArc(simState.month);
  bindUi();
  applySolarState();
  setTimeout(applySimFromQuery, 260);

  const api = {
    state: simState,
    tick,
    computeSolarPosition,
    setMonth(m) {
      simState.month = Math.max(1, Math.min(12, Math.round(m)));
      const ms = document.getElementById('sun-month-slider');
      if (ms) ms.value = String(simState.month);
      rebuildSunArc(simState.month);
      applySolarState();
    },
    setHour(h) {
      simState.hour = Math.max(5.5, Math.min(18.5, Number(h)));
      const hs = document.getElementById('sun-slider');
      if (hs) hs.value = String(simState.hour);
      applySolarState();
    },
    loadNlscLayer,
    getGroups() {
      return { root, sunArcGroup, evacGroup, constructionGroup, nightGroup, windGroup, rainGroup };
    }
  };
  window.__CAMPUS_SIM__ = api;
  return api;
}
