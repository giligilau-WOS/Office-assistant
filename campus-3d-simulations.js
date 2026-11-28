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

const SEASON_PROFILES = {
  SPRING: { key: 'SPRING', label: '🌱 春季微風（偏東北東）', shortLabel: '春季微風', month: 3, windFromDeg: 65, monsoonWeight: 0.50, colorHex: 0x2dd4bf },
  SUMMER: { key: 'SUMMER', label: '☀️ 夏季西南季風', shortLabel: '夏季西南季風', month: 6, windFromDeg: 225, monsoonWeight: 0.72, colorHex: 0x34d399 },
  AUTUMN: { key: 'AUTUMN', label: '🍂 秋季轉東北風', shortLabel: '秋季轉東北風', month: 9, windFromDeg: 50, monsoonWeight: 0.65, colorHex: 0xfbbf24 },
  WINTER: { key: 'WINTER', label: '❄️ 冬季東北季風', shortLabel: '冬季東北季風', month: 12, windFromDeg: 35, monsoonWeight: 0.85, colorHex: 0x38bdf8 }
};

/**
 * 計算高雄大樹（北緯 22.72°、西臨台灣海峽、東倚中央山脈丘陵）日夜海陸風／山谷風與季風之合成風場：
 * - 白天（約 10:30–17:30，午後 14:30 最強）：海風／谷風自西南西 (240° WSW) 吹入內陸
 * - 清晨／夜間（日落後～08:30 或夜間模式）：陸風／山風自東北東 (55° ENE) 沿山谷下沉吹向沿海
 * - 08:30–10:30 與 17:30–19:00：海陸風轉換微風期
 */
export function computeDiurnalWind(seasonKey, hour = 10.5, isNight = false) {
  const prof = SEASON_PROFILES[seasonKey] || SEASON_PROFILES.WINTER;
  const effHour = isNight ? 2.0 : Math.max(0, Math.min(24, Number(hour) || 12));
  // 熱力相位：09:00 為 0，15:00 達峰值 +1（海風／谷風），03:00 達谷值 -1（陸風／山風）
  const thermal = Math.sin(((effHour - 9.0) / 24) * 2 * Math.PI);
  const breezeMag = Math.abs(thermal) * 0.88;
  const breezeFromDeg = thermal >= 0 ? 240 : 55;

  const mRad = (prof.windFromDeg * Math.PI) / 180;
  const bRad = (breezeFromDeg * Math.PI) / 180;
  const mx = Math.sin(mRad) * prof.monsoonWeight;
  const my = Math.cos(mRad) * prof.monsoonWeight;
  const bx = Math.sin(bRad) * breezeMag;
  const by = Math.cos(bRad) * breezeMag;

  const rx = mx + bx;
  const ry = my + by;
  const mag = Math.hypot(rx, ry);
  const windFromDeg = mag < 0.08
    ? prof.windFromDeg
    : Math.round(((Math.atan2(rx, ry) * 180) / Math.PI + 360) % 360);
  const speedFactor = Math.max(0.68, Math.min(1.38, 0.58 + mag * 0.48));

  let phaseTag = '轉風微風';
  let phaseDesc = '⚖️ 上午海陸風轉換期，以季節季風為主';
  if (isNight || effHour >= 19.5 || effHour < 5.5) {
    phaseTag = '夜間山陸風';
    phaseDesc = '🌙 夜間陸風／山風（自東側山谷偏 ENE 下沉吹向沿海）';
  } else if (thermal < -0.25) {
    phaseTag = '清晨山陸風';
    phaseDesc = '🌄 清晨日出前陸風／山風（偏東北東冷空氣下沉）';
  } else if (thermal > 0.35 && effHour <= 17.2) {
    phaseTag = '白天海谷風';
    phaseDesc = '☀️ 白天日照增溫海風／谷風（自西南西海峽吹入內陸）';
  } else if (effHour > 17.2) {
    phaseTag = '黃昏轉風期';
    phaseDesc = '🌇 日落海風減弱，準備轉為夜間山陸風';
  }

  return { windFromDeg, speedFactor, thermal, phaseTag, phaseDesc };
}

function monthToSeason(m) {
  const mm = ((Math.round(m) - 1 + 12) % 12) + 1;
  if (mm >= 3 && mm <= 5) return 'SPRING';
  if (mm >= 6 && mm <= 8) return 'SUMMER';
  if (mm >= 9 && mm <= 11) return 'AUTUMN';
  return 'WINTER';
}

function degToCompass(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const norm = ((deg % 360) + 360) % 360;
  return dirs[Math.round(norm / 45) % 8];
}

const COLOR_LEGENDS = {
  MOI_SLOPEP_LV7_2: {
    title: '📊 國土 7 級坡度圖（MOI）',
    items: [
      ['#15803d', '1 級 (≤5%) 平地／極緩坡'],
      ['#65a30d', '2 級 (5–15%) 緩坡'],
      ['#bef264', '3 級 (15–30%) 中坡'],
      ['#facc15', '4 級 (30–40%) 較陡坡（限建）'],
      ['#fb923c', '5 級 (40–55%) 陡坡（加強水保）'],
      ['#ef4444', '6 級 (55–100%) 極陡坡'],
      ['#991b1b', '7 級 (>100%) 峭壁／崩塌警戒']
    ]
  },
  MOI_ASPECT: {
    title: '🧭 國土坡向圖（坡面朝向＝水流方向）',
    items: [
      ['#ef4444', '紅：北坡（水流向北）'],
      ['#f97316', '橘：東北坡（水流向東北）'],
      ['#eab308', '黃：東坡（水流向東）'],
      ['#22c55e', '綠：東南坡（水流向東南）'],
      ['#06b6d4', '青：南坡（水流向南）'],
      ['#38bdf8', '天藍：西南坡（水流向西南）'],
      ['#3b82f6', '藍：西坡（水流向西）'],
      ['#a855f7', '紫：西北坡（水流向西北）'],
      ['#94a3b8', '灰：平坦地（無明顯坡向）']
    ]
  },
  MOI_CONTOUR_2: {
    title: '⛰️ 等高線圖（高程線）',
    items: [
      ['#92400e', '粗棕線：主要等高線（計曲線）'],
      ['#d97706', '細棕線：加密等高線（線越密坡越陡）']
    ]
  },
  LANDSECT: {
    title: '📐 段籍圖（地籍界線）',
    items: [
      ['#e11d48', '紅／洋紅線：官方地段界線'],
      ['#f43f5e', '紅色標註：地段名稱']
    ]
  },
  SCHOOL: {
    title: '🏫 各級學校範圍圖',
    items: [
      ['#8b5cf6', '紫／藍線框：國土測繪官方校地邊界']
    ]
  },
  evac: {
    title: '🚨 防災疏散與消防圖例',
    items: [
      ['#10b981', '翠綠管線：各棟➔操場安全集合區'],
      ['#ef4444', '紅帶／紅點：外牆落物警戒／消防栓'],
      ['#f97316', '橘點：滅火器（15m 覆蓋圈）'],
      ['#38bdf8', '藍點：AED 急救設備'],
      ['#facc15', '黃柱：消防泵浦室']
    ]
  },
  construction: {
    title: '🚧 工程施工圍籬與人車分流',
    items: [
      ['#ef4444', '紅白圍欄：施工管制禁區'],
      ['#f97316', '橘線／黃車：工程車進出場動線'],
      ['#22c55e', '綠線：學生安全人行替代通道']
    ]
  },
  night: {
    title: '🌙 夜間照明與 CCTV 覆蓋',
    items: [
      ['#fde047', '暖黃光暈：校園路燈與走廊照明'],
      ['#38bdf8', '藍綠扇形：監視器可視角度'],
      ['#f97316', '橘紅空心圓：夜間照明／監視暗角']
    ]
  },
  wind: {
    title: '🌬️ 季節風場 ＆ 開窗通風（+2.6° 軸線校準）',
    items: [
      ['#5eead4', '亮青綠：開窗教室／1F 穿堂對流氣流'],
      ['#e0f2fe', '亮冰白：遇實牆／屋頂迎風爬升與繞流'],
      ['#38bdf8', '冰藍箭帶：冬季東北季風（NE）'],
      ['#34d399', '翠綠箭帶：夏季西南季風（SW）'],
      ['#2dd4bf', '薄荷箭帶：春季偏東微風'],
      ['#fbbf24', '琥珀箭帶：秋季轉東北風']
    ]
  },
  rain: {
    title: '🌧️ 豪雨積水與坡向水流預測',
    items: [
      ['#0284c7', '深藍水窪：低窪易積水熱區'],
      ['#38bdf8', '天藍管線：校園既設排水溝方向'],
      ['#22d3ee', '亮青箭頭：依坡向預測之地表水流'],
      ['#facc15', '黃色角錐：沙包／抽水機建議部署點']
    ]
  },
  terrain: {
    title: '⛰️ 周邊坡地 3D 地形起伏',
    items: [
      ['#10b981', '翠綠格網：北側較高坡地（+12m 示意）'],
      ['#0f766e', '深青格網：南／西南側緩降平地（校區維持 0m 水平）']
    ]
  },
  wra: {
    title: '🌊 水利署官方淹水圖資套繪',
    items: [
      ['#06b6d4', '淺青面：淺積水（<0.3m）'],
      ['#2563eb', '深藍面：中度積水（0.3–1.0m）'],
      ['#7c3aed', '深紫面：嚴重淹水（1.0–2.0m）'],
      ['#ef4444', '紅面／紅柱：極端淹水或即時警戒點']
    ]
  }
};

const WRA_LIVE_KML_URL = 'https://opendata.wra.gov.tw/cloud/5982FloodWarningOfDisasterPreventionInformation/286-%E9%98%B2%E7%81%BD%E8%B3%87%E8%A8%8A_%E6%B7%B9%E6%B0%B4%E8%AD%A6%E6%88%92.kml';
const WRA_KAOHSIUNG_7Z_URL = 'https://opendata.wra.gov.tw/cloud/25766InundationProbabilityMaps/207-13.7z';
const WRA_SCENARIOS = {
  flood_150mm_6hr:  { label: '6hr 150mm',  level: 'heavy',      scaleMul: 0.78, opMul: 0.72 },
  flood_250mm_6hr:  { label: '6hr 250mm',  level: 'torrential', scaleMul: 1.02, opMul: 0.96 },
  flood_350mm_6hr:  { label: '6hr 350mm',  level: 'typhoon',    scaleMul: 1.24, opMul: 1.22 },
  flood_200mm_12hr: { label: '12hr 200mm', level: 'heavy',      scaleMul: 0.88, opMul: 0.82 },
  flood_300mm_12hr: { label: '12hr 300mm', level: 'torrential', scaleMul: 1.12, opMul: 1.08 },
  flood_400mm_12hr: { label: '12hr 400mm', level: 'typhoon',    scaleMul: 1.30, opMul: 1.28 },
  flood_200mm_24hr: { label: '24hr 200mm', level: 'heavy',      scaleMul: 0.84, opMul: 0.78 },
  flood_350mm_24hr: { label: '24hr 350mm', level: 'torrential', scaleMul: 1.14, opMul: 1.10 },
  flood_500mm_24hr: { label: '24hr 500mm', level: 'typhoon',    scaleMul: 1.35, opMul: 1.34 },
  flood_650mm_24hr: { label: '24hr 650mm', level: 'typhoon',    scaleMul: 1.46, opMul: 1.45 }
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

  const initMonth = new Date().getMonth() + 1;
  const initSeason = monthToSeason(initMonth);
  const simState = {
    // 1. Solar
    month: initMonth,
    hour: 10.5,
    showSunArc: true,
    seasonSync: true,
    playMode: null, // null | 'day' | 'year'
    // 2. NLSC WMTS & 3D Terrain
    nlscLayer: 'NONE',
    nlscOpacity: 0.85,
    terrainRelief: false,
    // 3. Five campus simulation layers
    evac: false,
    evacRadius: true,
    construction: false,
    constructionZone: 'auto', // 'auto' | 'track' | 'restroom' | 'kitchen'
    night: false,
    showCctv: true,
    wind: false,
    windMode: 'ventilate', // 'ventilate' (開窗通風) | 'deflect' (繞流不穿牆) | 'free' (自由風場)
    windDiurnal: true, // 隨日出日落／日夜自動切換海陸風・山谷風
    windDiurnalSpeedFactor: 1.0,
    windDiurnalPhase: '',
    windSeason: initSeason, // 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER'
    windAngleDeg: SEASON_PROFILES[initSeason].windFromDeg,
    windDensity: 260,
    windThickness: 0.35,
    windSpeedMul: 1.2,
    rain: false,
    rainLevel: 'heavy', // 'heavy' | 'torrential' | 'typhoon'
    rainUseAspect: true,
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

    if (typeof applyDiurnalWind === 'function') applyDiurnalWind();
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
  const nlscCanvasCache = new Map();

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

  async function fetchNlscCanvas(layerId) {
    if (nlscCanvasCache.has(layerId)) return nlscCanvasCache.get(layerId);
    const cfg = NLSC_LAYERS[layerId];
    if (!cfg || typeof document === 'undefined' || typeof Image === 'undefined') return null;

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
    if (!sCtx) return null;

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
    if (okCount === 0) return null;

    const cropX = (tl.x - tx0) * tileW;
    const cropY = (tl.y - ty0) * tileW;
    const cropW = Math.max(8, (br.x - tl.x) * tileW);
    const cropH = Math.max(8, (br.y - tl.y) * tileW);
    const out = document.createElement('canvas');
    out.width = 1280;
    out.height = Math.round(1280 * (NLSC_H / NLSC_W));
    const oCtx = out.getContext('2d', { willReadFrequently: true });
    if (!oCtx) return null;
    oCtx.drawImage(stitch, cropX, cropY, cropW, cropH, 0, 0, out.width, out.height);

    nlscCanvasCache.set(layerId, out);
    return out;
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
    const out = await fetchNlscCanvas(layerId);
    if (!out) {
      nlscMesh.visible = false;
      syncNlscSatVisibility('NONE');
      if (statusEl) statusEl.textContent = `⚠️ 無法連線國土測繪圖磚（可能離線或跨網域受限），已自動維持本機衛星底圖`;
      updateHudBanner();
      return;
    }

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
    if (typeof applyDiurnalWind === 'function') applyDiurnalWind();
    updateHudBanner();
  }

  // =========================================================================
  // 6. 🌬️ 季節風場與教室通風流線（立體風帶 InstancedMesh ＋ 不穿建築繞流 ＋ 開窗穿堂對流）
  // =========================================================================
  const windGroup = new THREE.Group();
  windGroup.name = 'Sim_Wind_Flow';
  windGroup.visible = false;
  root.add(windGroup);

  // 校舍建築量體與南北向開窗通風帶（對應 campus-3d.html 實際座標，+X=東, +Z=南）
  const WIND_BUILDINGS = [
    {
      name: 'main',
      x0: -0.4, x1: 83.1, z0: -0.5, z1: 8.3, yMin: 0.0, yMax: 14.4,
      // 1F 穿堂（軸線⑦–⑧）完全南北貫通，所有阻擋模式皆允許氣流加速通過
      breezeway: { x0: 54.0, x1: 63.0, y0: 1.2, y1: 4.8 },
      // 1F–3F 南北側教室開窗高度帶（窗台 +0.9m ～ 窗頂 +2.9m）
      windows: [
        { x0: 1.5, x1: 71.5, y0: 2.05, y1: 4.15 }, // 1F 教室群
        { x0: 1.5, x1: 71.5, y0: 5.85, y1: 7.95 }, // 2F 教室群（含穿堂上方輔導室）
        { x0: 1.5, x1: 71.5, y0: 9.65, y1: 11.75 } // 3F 教室群
      ]
    },
    {
      name: 'east_wing',
      x0: 71.8, x1: 83.1, z0: 8.3, z1: 16.8, yMin: 0.0, yMax: 13.0,
      breezeway: null,
      windows: [] // 東側梯間／機房／浴廁核心（實量體繞流）
    },
    {
      name: 'kitchen_1f',
      x0: -42.8, x1: -15.2, z0: -6.8, z1: 11.6, yMin: 0.0, yMax: 5.9,
      breezeway: null,
      windows: [
        { x0: -41.0, x1: -16.8, y0: 2.15, y1: 4.05 } // 中央廚房與食育教室開窗對流帶
      ]
    },
    {
      name: 'kitchen_2f',
      x0: -36.8, x1: -23.2, z0: -9.6, z1: -3.4, yMin: 5.0, yMax: 9.4,
      breezeway: null,
      windows: [] // 廚房 2F 消防機房（實量體繞流）
    }
  ];

  const MAX_WIND = 360;
  const windSeeds = [];
  const WINDOW_LEVEL_YS = [3.05, 6.85, 10.65, 3.05];
  for (let i = 0; i < MAX_WIND; i++) {
    // 45% 粒子配置在 1F–3F 教室開窗高度，其餘分布於 1.5m–16.5m，同時呈現穿堂對流與屋頂爬升
    const baseY = i < MAX_WIND * 0.45
      ? WINDOW_LEVEL_YS[i % WINDOW_LEVEL_YS.length] + (Math.random() - 0.5) * 1.1
      : 1.5 + Math.random() * 15.0;
    windSeeds.push({
      x: -70 + Math.random() * 200,
      y: baseY,
      baseY,
      z: -24 + Math.random() * 124,
      speed: 13 + Math.random() * 10,
      len: 4.5 + Math.random() * 4.8,
      phase: Math.random() * Math.PI * 2
    });
  }
  // 3D 立體漸縮風箭（+Z 為箭頭尖端），避開 WebGL linewidth=1px 限制
  const windUnitGeo = new THREE.CylinderGeometry(0.06, 0.48, 1, 6);
  if (typeof windUnitGeo.rotateX === 'function') windUnitGeo.rotateX(Math.PI / 2);
  // 材質基色維持白色，由每個 instance 的 instanceColor 個別呈現季節色／開窗通風色／繞流爬升色
  const windMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
    depthWrite: false
  });
  const windMesh = new THREE.InstancedMesh(windUnitGeo, windMat, MAX_WIND);
  windMesh.count = simState.windDensity;
  if (windMesh.instanceMatrix && typeof windMesh.instanceMatrix.setUsage === 'function' && THREE.DynamicDrawUsage !== undefined) {
    windMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  windGroup.add(windMesh);
  const windDummy = new THREE.Object3D();
  const windColorSeason = new THREE.Color();
  const windColorIndoor = new THREE.Color(0x5eead4);  // 亮青綠：開窗教室／1F 穿堂對流氣流
  const windColorDeflect = new THREE.Color(0xe0f2fe); // 亮冰白：遇實牆／屋頂迎風爬升與繞流

  function getCalibratedWindVec() {
    // 校準校園軸線偏角 (+2.6° + 使用者旋轉微調)
    const calDeg = simState.windAngleDeg - (NLSC_BASE_ROT_DEG + nlscCal.rotDeg);
    const fromRad = (calDeg * Math.PI) / 180;
    // 風「自 fromRad 吹來」→ 氣流前進方向為 (-sin, +cos)（+X=東, +Z=南）
    return { dx: -Math.sin(fromRad), dz: Math.cos(fromRad) };
  }

  function findOpenWindowBand(b, x, y, allowWindows) {
    if (b.breezeway && x >= b.breezeway.x0 && x <= b.breezeway.x1 && y >= b.breezeway.y0 && y <= b.breezeway.y1) {
      return { kind: 'breezeway', yMid: (b.breezeway.y0 + b.breezeway.y1) * 0.5 };
    }
    if (allowWindows && b.windows) {
      for (const w of b.windows) {
        if (x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1) {
          return { kind: 'window', yMid: (w.y0 + w.y1) * 0.5 };
        }
      }
    }
    return null;
  }

  function tickWind(dt) {
    if (!simState.wind) return;
    const { dx, dz } = getCalibratedWindVec();
    const prof = SEASON_PROFILES[simState.windSeason] || SEASON_PROFILES.WINTER;
    windColorSeason.setHex(prof.colorHex);
    const hasInstanceColor = typeof windMesh.setColorAt === 'function';
    if (!hasInstanceColor) windMat.color.setHex(prof.colorHex);

    const activeCount = Math.max(40, Math.min(MAX_WIND, Math.round(simState.windDensity)));
    windMesh.count = activeCount;
    const thick = Math.max(0.12, Math.min(0.85, Number(simState.windThickness) || 0.35));
    const diurnalMul = simState.windDiurnal ? (Number(simState.windDiurnalSpeedFactor) || 1.0) : 1.0;
    const spdMul = Math.max(0.3, Math.min(3.2, (Number(simState.windSpeedMul) || 1.2) * diurnalMul));
    const mode = simState.windMode || 'ventilate';
    const allowWindows = mode === 'ventilate';
    const usePhysics = mode !== 'free';

    for (let i = 0; i < activeCount; i++) {
      const s = windSeeds[i];
      const baseSpd = s.speed * spdMul;
      let vx = dx * baseSpd;
      let vy = 0;
      let vz = dz * baseSpd;
      let stateTag = 'ambient'; // 'ambient' | 'indoor' | 'deflect'

      if (usePhysics) {
        const margin = 5.5;
        let blockedBySolid = false;

        for (const b of WIND_BUILDINGS) {
          const inPadX = s.x >= b.x0 - margin && s.x <= b.x1 + margin;
          const inPadZ = s.z >= b.z0 - margin && s.z <= b.z1 + margin;
          const inPadY = s.y >= b.yMin - 0.5 && s.y <= b.yMax + 3.2;
          if (!inPadX || !inPadZ || !inPadY) continue;

          const opening = findOpenWindowBand(b, s.x, s.y, allowWindows);
          const insideZ = s.z >= b.z0 - 1.5 && s.z <= b.z1 + 1.5;

          if (opening && insideZ) {
            // 🪟 開窗通風或 1F 穿堂：氣流被吸入教室／穿堂，沿南北向形成穩定穿堂對流
            stateTag = 'indoor';
            const nsSign = dz >= 0 ? 1 : -1;
            const ventBoost = opening.kind === 'breezeway' ? 1.38 : 0.92;
            const crossWave = Math.sin(elapsed * 2.6 + s.phase + s.z * 0.25) * 1.4;
            // 室內受隔間牆導引，南北向對流為主、東西側向減弱
            vx = vx * (opening.kind === 'breezeway' ? 0.22 : 0.36) + crossWave;
            vz = (Math.abs(vz) < baseSpd * 0.45 ? nsSign * baseSpd * 0.65 : vz) * ventBoost;
            vy = (opening.yMid - s.y) * 2.4;
            continue;
          }

          // 🏢 實牆／樓板／屋頂／封閉核心：不穿透，迎風向上爬升或向東西兩側繞流
          if (s.y <= b.yMax + 1.8) {
            const dxIn = Math.min(s.x - (b.x0 - margin), (b.x1 + margin) - s.x);
            const dzIn = Math.min(s.z - (b.z0 - margin), (b.z1 + margin) - s.z);
            const proximity = Math.max(0, Math.min(1, Math.min(dxIn, dzIn) / margin));
            if (proximity > 0.05) {
              stateTag = 'deflect';
              blockedBySolid = true;
              const distWest = Math.abs(s.x - b.x0);
              const distEast = Math.abs(b.x1 - s.x);
              const nearEnd = Math.min(distWest, distEast) < 11.0;

              if (nearEnd && s.y < b.yMax * 0.72) {
                // 靠近東西山牆端點：向建築外側水平繞流
                const sideDir = distWest < distEast ? -1 : 1;
                vx += sideDir * baseSpd * 0.95 * proximity;
                vz *= (1 - 0.35 * proximity);
              } else {
                // 正對建築立面或偏高處：迎風爬升越過屋頂
                vy += baseSpd * (0.72 + 0.55 * proximity);
                vz *= (1 - 0.45 * proximity);
              }
            }
          }
        }

        // 未受阻擋且在室外時，高度緩慢回復基準巡航高度（呈現越過屋頂後的背風下沉弧線）
        if (!blockedBySolid && stateTag === 'ambient') {
          vy += (s.baseY - s.y) * 0.42;
        }
      }

      // 推進粒子位置
      s.x += vx * dt;
      s.y += vy * dt;
      s.z += vz * dt;

      // 硬性防穿牆保護：確保實牆區域內（非開窗／非穿堂）零粒子穿透
      if (usePhysics) {
        for (const b of WIND_BUILDINGS) {
          if (s.x > b.x0 && s.x < b.x1 && s.z > b.z0 && s.z < b.z1 && s.y >= b.yMin && s.y < b.yMax) {
            const opening = findOpenWindowBand(b, s.x, s.y, allowWindows);
            if (!opening) {
              const dWest = s.x - b.x0;
              const dEast = b.x1 - s.x;
              const dTop = b.yMax - s.y;
              if (dTop <= Math.min(dWest, dEast) + 2.5) {
                s.y = b.yMax + 0.55;
                vy = Math.max(vy, 2.5);
              } else if (dWest < dEast) {
                s.x = b.x0 - 0.6;
              } else {
                s.x = b.x1 + 0.6;
              }
              stateTag = 'deflect';
            }
          }
        }
      }

      // 邊界循環重生
      let wrapped = false;
      if (s.x < -75) { s.x = 130; wrapped = true; }
      else if (s.x > 130) { s.x = -75; wrapped = true; }
      if (s.z < -26) { s.z = 102; wrapped = true; }
      else if (s.z > 102) { s.z = -26; wrapped = true; }
      if (s.y < 1.2) s.y = 1.2;
      if (s.y > 24.0 || wrapped) s.y = s.baseY;

      const horiz = Math.hypot(vx, vz) || 1e-4;
      const rotY = Math.atan2(vx, vz);
      const rotX = -Math.atan2(vy, horiz);

      windDummy.position.set(gx(s.x), s.y, gz(s.z));
      windDummy.rotation.set(rotX, rotY, 0, 'YXZ');
      const lenScale = stateTag === 'indoor' ? s.len * 0.85 : s.len;
      windDummy.scale.set(thick, thick, lenScale);
      windDummy.updateMatrix();
      windMesh.setMatrixAt(i, windDummy.matrix);

      if (hasInstanceColor) {
        windMesh.setColorAt(
          i,
          stateTag === 'indoor' ? windColorIndoor : stateTag === 'deflect' ? windColorDeflect : windColorSeason
        );
      }
    }
    if (windMesh.instanceMatrix) windMesh.instanceMatrix.needsUpdate = true;
    if (windMesh.instanceColor) windMesh.instanceColor.needsUpdate = true;
  }

  // =========================================================================
  // 7. 🌧️ 豪雨積水與坡向水流預測模擬 (RainFloodLayer + MOI_ASPECT)
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
  const PUDDLE_SPECS = [
    { x: 10,  z: 46.5, rx: 32, rz: 14, baseOp: 0.34 }, // 操場內野低窪積水
    { x: 53,  z: 16,   rx: 9,  rz: 6,  baseOp: 0.40 }, // 穿堂南側低處
    { x: -34, z: 16,   rx: 11, rz: 6.5, baseOp: 0.42 }, // 中央廚房西南排水口
    { x: 96,  z: 24,   rx: 9,  rz: 6,  baseOp: 0.36 }  // 東大門前庭
  ];
  const puddleMeshes = [];
  const runoffArrows = [];

  function buildFloodZones() {
    PUDDLE_SPECS.forEach((pd) => {
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

    // 既設排水溝流向藍線
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

    // 10 × 6 地表逕流水流預測箭頭網格（依 MOI_ASPECT 坡向圖或地形模型動態計算方向）
    const arrowGeo = new THREE.ConeGeometry(0.55, 2.6, 6);
    if (typeof arrowGeo.rotateX === 'function') arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.88 });
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 10; col++) {
        const rx = -52 + col * 16.5;
        const rz = -8 + row * 16.8;
        const mesh = new THREE.Mesh(arrowGeo, arrowMat);
        mesh.position.set(gx(rx), 0.42, gz(rz));
        rainGroup.add(mesh);
        runoffArrows.push({
          mesh,
          rx,
          rz,
          dx: -0.22,
          dz: 0.975,
          phase: (row * 0.37 + col * 0.23) % 1
        });
      }
    }
  }
  buildFloodZones();

  // 將內政部坡向圖 (MOI_ASPECT) RGB 色相轉為水流方位角 (0=北, 90=東, 180=南, 270=西)
  function aspectRgbToAzimuthDeg(r, g, b, a) {
    if (a < 40) return null;
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    const s = max === 0 ? 0 : d / max;
    if (s < 0.14 || max < 0.15) return null; // 平坦地（灰／白）
    let h = 0;
    if (d > 0) {
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    const stops = [
      [0, 0], [30, 45], [60, 90], [120, 135],
      [180, 180], [210, 225], [240, 270], [300, 315], [360, 360]
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      const [h0, az0] = stops[i];
      const [h1, az1] = stops[i + 1];
      if (h >= h0 && h <= h1) {
        const t = (h - h0) / Math.max(1e-5, h1 - h0);
        return az0 + t * (az1 - az0);
      }
    }
    return 180;
  }

  function fallbackRunoffVec(rx, rz) {
    // 基準地形：北高南低微偏西南，並受鄰近低窪積水／排水點匯聚影響
    let vx = -0.22;
    let vz = 0.975;
    let bestD2 = Infinity;
    let target = null;
    for (const pd of PUDDLE_SPECS) {
      const d2 = (pd.x - rx) * (pd.x - rx) + (pd.z - rz) * (pd.z - rz);
      if (d2 < bestD2) { bestD2 = d2; target = pd; }
    }
    if (target && bestD2 > 9 && bestD2 < 2600) {
      const dist = Math.sqrt(bestD2);
      const w = 0.55 * (1 - dist / 52);
      vx = vx * (1 - w) + ((target.x - rx) / dist) * w;
      vz = vz * (1 - w) + ((target.z - rz) / dist) * w;
    }
    const len = Math.hypot(vx, vz) || 1;
    return { dx: vx / len, dz: vz / len };
  }

  async function updateRainFlowFromAspect() {
    const srcEl = document.getElementById('rain-flow-source');
    let aspectCtx = null;
    let aspectCanvas = null;

    if (simState.rainUseAspect) {
      if (srcEl) srcEl.textContent = '⏳ 正在分析國土坡向圖 (MOI_ASPECT) 推算地表流向...';
      aspectCanvas = await fetchNlscCanvas('MOI_ASPECT');
      if (aspectCanvas) {
        try { aspectCtx = aspectCanvas.getContext('2d', { willReadFrequently: true }); } catch {}
      }
    }

    let aspectHits = 0;
    const rotRadOffset = ((NLSC_BASE_ROT_DEG + nlscCal.rotDeg) * Math.PI) / 180;

    for (const ar of runoffArrows) {
      let vec = null;
      if (aspectCtx && aspectCanvas) {
        const u = Math.floor(((ar.rx - NLSC_BOUNDS.rx0) / NLSC_W) * aspectCanvas.width);
        const v = Math.floor(((ar.rz - NLSC_BOUNDS.rz0) / NLSC_H) * aspectCanvas.height);
        if (u >= 2 && u < aspectCanvas.width - 2 && v >= 2 && v < aspectCanvas.height - 2) {
          try {
            const imgData = aspectCtx.getImageData(u - 2, v - 2, 5, 5).data;
            let sx = 0, sz = 0, cnt = 0;
            for (let p = 0; p < imgData.length; p += 4) {
              const az = aspectRgbToAzimuthDeg(imgData[p], imgData[p + 1], imgData[p + 2], imgData[p + 3]);
              if (az !== null) {
                const rad = (az * Math.PI) / 180 - rotRadOffset;
                sx += Math.sin(rad);
                sz += -Math.cos(rad);
                cnt++;
              }
            }
            if (cnt >= 4) {
              const len = Math.hypot(sx, sz) || 1;
              vec = { dx: sx / len, dz: sz / len };
              aspectHits++;
            }
          } catch {}
        }
      }
      if (!vec) vec = fallbackRunoffVec(ar.rx, ar.rz);
      ar.dx = vec.dx;
      ar.dz = vec.dz;
      ar.mesh.rotation.y = Math.atan2(ar.dx, ar.dz);
    }

    if (srcEl) {
      if (simState.rainUseAspect && aspectHits > 0) {
        srcEl.textContent = `✅ 已依國土坡向圖 (MOI_ASPECT) 推算 ${aspectHits}/${runoffArrows.length} 處坡面流向（平坦處輔以排水匯聚）`;
      } else if (simState.rainUseAspect) {
        srcEl.textContent = '📐 校區坡向多屬平坦或離線，已以「北高南低＋低窪匯聚」地形模型推算流向';
      } else {
        srcEl.textContent = '📐 目前使用「北高南低＋低窪匯聚」校園地形模型推算流向';
      }
    }
  }

  function applyRainIntensity() {
    rainGroup.visible = simState.rain;
    const sc = simState.wraScenario && WRA_SCENARIOS[simState.wraScenario];
    const scaleMul = sc ? sc.scaleMul : (simState.rainLevel === 'typhoon' ? 1.28 : simState.rainLevel === 'torrential' ? 1.08 : 0.82);
    const opMul = sc ? sc.opMul : (simState.rainLevel === 'typhoon' ? 1.35 : simState.rainLevel === 'torrential' ? 1.05 : 0.72);
    puddleMeshes.forEach((m) => {
      const pd = m.userData;
      m.scale.set(pd.rx * scaleMul, pd.rz * scaleMul, 1);
      m.material.opacity = Math.min(0.75, pd.baseOp * opMul);
    });
    if (simState.rain) updateRainFlowFromAspect();
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

    // 動畫化地表逕流箭頭（依預測流向滑動前進）
    const flowSpd = simState.rainLevel === 'typhoon' ? 1.65 : simState.rainLevel === 'torrential' ? 1.15 : 0.75;
    for (const ar of runoffArrows) {
      const t = (elapsed * flowSpd + ar.phase) % 1;
      const offset = (t - 0.5) * 3.8;
      ar.mesh.position.set(gx(ar.rx + ar.dx * offset), 0.42, gz(ar.rz + ar.dz * offset));
    }
  }

  // =========================================================================
  // 7b. ⛰️ 周邊坡地 3D 地形起伏示意（校區基地維持 0m 水平，外圍北高南低 3D 網格）
  // =========================================================================
  const terrainGroup = new THREE.Group();
  terrainGroup.name = 'Sim_Terrain_Relief';
  terrainGroup.visible = false;
  root.add(terrainGroup);

  function buildTerrainReliefLayer() {
    const geo = new THREE.PlaneGeometry(360, 260, 48, 36);
    const posAttr = geo.attributes && geo.attributes.position;
    const cx = (NLSC_BOUNDS.rx0 + NLSC_BOUNDS.rx1) * 0.5;
    const cz = (NLSC_BOUNDS.rz0 + NLSC_BOUNDS.rz1) * 0.5;
    const smoothstep = (e0, e1, x) => {
      const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };

    if (posAttr && typeof posAttr.count === 'number') {
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const rx = cx + vx;
        const rz = cz - vy; // rotX(-PI/2) 後，local +Y 對應 world -Z（北側）

        // 校區基地範圍 [-72, 108] × [-22, 96] 維持平整，避免校舍與操場模型浮沉
        const dxPad = rx < -72 ? (-72 - rx) : rx > 108 ? (rx - 108) : 0;
        const dzPad = rz < -22 ? (-22 - rz) : rz > 96 ? (rz - 96) : 0;
        const padDist = Math.hypot(dxPad, dzPad);
        const blend = smoothstep(0, 18, padDist);

        // 北側坡地緩升（最高約 +12m），南／西南側緩降（最低約 -2.8m）
        const northLift = rz < -22 ? Math.min(12.2, ((-22 - rz) / 80) * 11.5) : 0;
        const southDip = rz > 96 ? -Math.min(2.6, ((rz - 96) / 60) * 2.4) : 0;
        const westDip = rx < -72 ? -Math.min(1.4, ((-72 - rx) / 70) * 1.4) : 0;
        const undulation = 0.75 * Math.sin(rx * 0.045) * Math.cos(rz * 0.05);

        const h = -0.06 + blend * (northLift + southDip + westDip + undulation);
        posAttr.setZ(i, h);
      }
      posAttr.needsUpdate = true;
      if (typeof geo.computeVertexNormals === 'function') geo.computeVertexNormals();
    }

    const solid = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x0f766e,
        roughness: 0.92,
        metalness: 0.0,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    solid.rotation.x = -Math.PI / 2;
    solid.position.set(NLSC_CX, 0, NLSC_CZ);
    terrainGroup.add(solid);

    const wire = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        wireframe: true,
        transparent: true,
        opacity: 0.28
      })
    );
    wire.rotation.x = -Math.PI / 2;
    wire.position.set(NLSC_CX, 0.03, NLSC_CZ);
    terrainGroup.add(wire);
  }
  buildTerrainReliefLayer();

  // =========================================================================
  // 7c. 🌊 經濟部水利署官方淹水圖資套繪層（即時警戒 KML ／ 淹水潛勢 GeoJSON）
  // =========================================================================
  const wraGroup = new THREE.Group();
  wraGroup.name = 'Sim_WRA_Flood_Overlay';
  wraGroup.visible = false;
  root.add(wraGroup);

  function wgs84ToCampusXZ(lng, lat) {
    const mPerDegLat = 110742;
    const mPerDegLng = 111320 * Math.cos((GEO.lat0 * Math.PI) / 180);
    const eastM = (lng - GEO.lng0) * mPerDegLng;
    const southM = (GEO.lat0 - lat) * mPerDegLat;
    // 依校園軸線偏角 (+2.6° + 使用者微調) 旋回模型本地座標系
    const theta = -((NLSC_BASE_ROT_DEG + nlscCal.rotDeg) * Math.PI) / 180;
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const lx = eastM * cosT - southM * sinT;
    const lz = eastM * sinT + southM * cosT;
    return { x: GEO.x0 + lx + nlscCal.dx, z: GEO.z0 + lz + nlscCal.dz };
  }

  function clearWraOverlay() {
    while (wraGroup.children.length > 0) {
      const ch = wraGroup.children.pop();
      if (ch.geometry && typeof ch.geometry.dispose === 'function') ch.geometry.dispose();
    }
    wraGroup.visible = false;
    simState.wraOverlayCount = 0;
    document.getElementById('btn-wra-clear')?.classList.add('hidden');
    updateHudBanner();
  }

  function depthColorHex(depthVal) {
    const d = Number(depthVal) || 0;
    if (d >= 2.0) return 0xef4444;
    if (d >= 1.0) return 0x7c3aed;
    if (d >= 0.3) return 0x2563eb;
    return 0x06b6d4;
  }

  function addWraPolygonRing(lngLatRing, depthVal = 0.5) {
    if (!Array.isArray(lngLatRing) || lngLatRing.length < 3) return false;
    // 僅繪製距離校區中心 900m 內之多邊形，避免整縣市資料量過大
    const pts = [];
    let nearCampus = false;
    for (const coord of lngLatRing) {
      const lng = Number(coord[0]), lat = Number(coord[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      const p = wgs84ToCampusXZ(lng, lat);
      if (Math.abs(p.x - GEO.x0) < 900 && Math.abs(p.z - GEO.z0) < 900) nearCampus = true;
      pts.push(p);
    }
    if (!nearCampus || pts.length < 3) return false;

    const col = depthColorHex(depthVal);
    if (typeof THREE.Shape === 'function' && typeof THREE.ShapeGeometry === 'function') {
      const shape = new THREE.Shape();
      shape.moveTo(pts[0].x, -pts[0].z);
      for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, -pts[i].z);
      shape.closePath();
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.24;
      wraGroup.add(mesh);
    }
    return true;
  }

  function addWraWarningPin(lng, lat) {
    const p = wgs84ToCampusXZ(lng, lat);
    if (Math.abs(p.x - GEO.x0) > 1500 || Math.abs(p.z - GEO.z0) > 1500) return false;
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 1.4, 9, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 })
    );
    pin.position.set(p.x, 4.5, p.z);
    wraGroup.add(pin);
    return true;
  }

  function importWraFloodText(text, filename = 'WRA') {
    clearWraOverlay();
    let plotted = 0;
    let totalFeatures = 0;
    const trimmed = String(text || '').trim();

    if (trimmed.startsWith('<')) {
      // KML XML 解析
      if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(trimmed, 'text/xml');
        const placemarks = Array.from(doc.getElementsByTagName('Placemark'));
        totalFeatures = placemarks.length;
        for (const pm of placemarks) {
          const coordEls = Array.from(pm.getElementsByTagName('coordinates'));
          const isPoint = pm.getElementsByTagName('Point').length > 0 && pm.getElementsByTagName('Polygon').length === 0;
          for (const cel of coordEls) {
            const pairs = (cel.textContent || '').trim().split(/\s+/).map(s => s.split(',').map(Number)).filter(a => a.length >= 2);
            if (isPoint && pairs[0]) {
              if (addWraWarningPin(pairs[0][0], pairs[0][1])) plotted++;
            } else if (pairs.length >= 3) {
              if (addWraPolygonRing(pairs, 0.8)) plotted++;
            }
          }
        }
      }
    } else {
      // GeoJSON 解析
      try {
        const gj = JSON.parse(trimmed);
        const feats = gj.type === 'FeatureCollection' ? (gj.features || []) : (gj.type === 'Feature' ? [gj] : []);
        totalFeatures = feats.length;
        for (const f of feats) {
          const g = f && f.geometry;
          if (!g) continue;
          const props = f.properties || {};
          const depth = props.DEPTH || props.depth || props.GRIDCODE || props.MAX_DEPTH || props.水深 || 0.5;
          if (g.type === 'Polygon' && g.coordinates?.[0]) {
            if (addWraPolygonRing(g.coordinates[0], depth)) plotted++;
          } else if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
            for (const poly of g.coordinates) {
              if (poly?.[0] && addWraPolygonRing(poly[0], depth)) plotted++;
            }
          } else if (g.type === 'Point' && Array.isArray(g.coordinates)) {
            if (addWraWarningPin(g.coordinates[0], g.coordinates[1])) plotted++;
          }
        }
      } catch {
        return { ok: false, plotted: 0, totalFeatures: 0, msg: `⚠️ ${filename} 格式無法解析（請確認為有效 .kml 或 .geojson）` };
      }
    }

    simState.wraOverlayCount = plotted;
    wraGroup.visible = plotted > 0;
    document.getElementById('btn-wra-clear')?.classList.toggle('hidden', plotted === 0);
    updateHudBanner();
    return {
      ok: true,
      plotted,
      totalFeatures,
      msg: plotted > 0
        ? `✅ 已套繪「${filename}」校區周邊 ${plotted} 處淹水圖徵（檔案共 ${totalFeatures} 筆）`
        : `ℹ️ 已讀取「${filename}」（共 ${totalFeatures} 筆），校區半徑 1km 內目前無重疊淹水／警戒區域`
    };
  }

  async function fetchWraLiveKml() {
    const statusEl = document.getElementById('wra-status-msg');
    if (statusEl) statusEl.textContent = '⏳ 正在連線經濟部水利署查詢即時淹水警戒 KML...';
    try {
      const resp = await fetch(WRA_LIVE_KML_URL, { mode: 'cors' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xmlText = await resp.text();
      const res = importWraFloodText(xmlText, '水利署即時淹水警戒.kml');
      const hasKaohsiung = /高雄|大樹/.test(xmlText);
      if (statusEl) {
        statusEl.textContent = `${res.msg}${hasKaohsiung ? '（含高雄／大樹警戒資訊）' : '（目前高雄大樹無發布警戒）'}`;
      }
      return res;
    } catch {
      if (statusEl) {
        statusEl.innerHTML = `⚠️ 水利署開放資料主機限制瀏覽器跨網域直接讀取 (CORS)。請點 <a href="${WRA_LIVE_KML_URL}" target="_blank" rel="noopener" class="text-cyan-300 underline font-semibold">下載即時警戒 KML ↗</a> 後，直接按上方「📂 匯入 KML / GeoJSON」即可立即套繪。`;
      }
      return { ok: false, corsBlocked: true };
    }
  }

  // =========================================================================
  // 8. 可收折浮動圖例卡片、模擬狀態 HUD、四季連動 ＆ UI 事件綁定
  // =========================================================================
  let legendCollapsed = false;

  function renderLegendCard() {
    const card = document.getElementById('sim-legend-card');
    if (!card) return;
    const keys = [];
    if (simState.nlscLayer !== 'NONE' && COLOR_LEGENDS[simState.nlscLayer]) keys.push(simState.nlscLayer);
    if (simState.terrainRelief) keys.push('terrain');
    if (simState.evac) keys.push('evac');
    if (simState.construction) keys.push('construction');
    if (simState.night) keys.push('night');
    if (simState.wind) keys.push('wind');
    if (simState.rain) keys.push('rain');
    if (simState.wraOverlayCount > 0) keys.push('wra');

    card.classList.toggle('hidden', keys.length === 0);
    if (keys.length === 0) {
      card.innerHTML = '';
      return;
    }

    card.innerHTML = `
      <div class="flex items-center justify-between ${legendCollapsed ? '' : 'border-b border-slate-700/80 pb-1.5 mb-2'}">
        <span class="font-bold text-slate-100 text-[11.5px]">🎨 圖例（${keys.length}）</span>
        <button id="btn-legend-collapse" type="button" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-200 border border-slate-600/60 transition">${legendCollapsed ? '▾ 展開' : '▴ 收合'}</button>
      </div>
      ${legendCollapsed ? '' : `
      <div class="space-y-2.5">
        ${keys.map((k) => {
          const lg = COLOR_LEGENDS[k];
          return `
            <div>
              <div class="font-semibold text-sky-200 text-[11px] mb-1">${lg.title}</div>
              <div class="space-y-1">
                ${lg.items.map(([hex, txt]) => `
                  <div class="flex items-center gap-1.5 leading-snug">
                    <span class="inline-block w-3 h-3 rounded-sm shrink-0 border border-white/25" style="background:${hex}"></span>
                    <span class="text-slate-200">${txt}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      `}
    `;
    document.getElementById('btn-legend-collapse')?.addEventListener('click', () => {
      legendCollapsed = !legendCollapsed;
      renderLegendCard();
    });
  }

  function updateHudBanner(spOpt = null) {
    renderLegendCard();
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
    if (simState.terrainRelief) tags.push('⛰️ 周邊 3D 地形');
    if (simState.evac) tags.push('🚨 防災疏散動線');
    if (simState.construction) {
      const zKey = simState.constructionZone === 'auto' ? detectAutoConstructionZone() : simState.constructionZone;
      const projCnt = simState.liveSummary.projects.length;
      tags.push(`🚧 ${ZONE_SPECS[zKey]?.title?.split('（')[0] || '施工圍籬'}${projCnt ? `（連動 ${projCnt} 案）` : ''}`);
    }
    if (simState.wind) {
      const prof = SEASON_PROFILES[simState.windSeason] || SEASON_PROFILES.WINTER;
      const modeLabel = simState.windMode === 'ventilate' ? '開窗通風' : simState.windMode === 'deflect' ? '繞流不穿' : '自由風場';
      const phaseTxt = simState.windDiurnal && simState.windDiurnalPhase ? `・${simState.windDiurnalPhase}` : '';
      tags.push(`🌬️ ${prof.shortLabel}${phaseTxt}・${modeLabel} ${Math.round(simState.windAngleDeg)}° ${degToCompass(simState.windAngleDeg)}`);
    }
    if (simState.rain) {
      const sc = simState.wraScenario && WRA_SCENARIOS[simState.wraScenario];
      const lvTxt = sc ? `水利署 ${sc.label}` : (simState.rainLevel === 'typhoon' ? '颱風強降雨' : simState.rainLevel === 'torrential' ? '豪雨積水' : '大雨排水');
      tags.push(`🌧️ ${lvTxt}${simState.rainUseAspect ? '＋坡向流向' : ''}`);
    }
    if (simState.wraOverlayCount > 0) tags.push(`🌊 水利署圖資 (${simState.wraOverlayCount})`);

    const activeExtra = simState.evac || simState.construction || simState.night || simState.wind || simState.rain || simState.terrainRelief || simState.wraOverlayCount > 0 || simState.nlscLayer !== 'NONE' || !!simState.playMode;
    hud.classList.toggle('hidden', !activeExtra);
    hud.innerHTML = tags.map(t => `<span class="px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-600/70 text-[11px] font-semibold text-slate-100 whitespace-nowrap">${t}</span>`).join('');
  }

  const WIND_MODE_DESCS = {
    ventilate: '🪟 實牆與屋頂擋風繞流；1～3F 南北教室開窗與 1F 穿堂形成亮青色穿堂對流。',
    deflect: '🏢 完全不穿過建築量體，氣流遇迎風面爬升越過屋頂或向東西山牆繞流（僅 1F 穿堂貫通）。',
    free: '🌬️ 大尺度自由季風方向參考流線（不計建物阻擋）。'
  };

  function applyDiurnalWind() {
    const statusEl = document.getElementById('wind-diurnal-status');
    if (!simState.windDiurnal) {
      simState.windDiurnalSpeedFactor = 1.0;
      simState.windDiurnalPhase = '';
      if (statusEl) statusEl.textContent = '🎛️ 已改為手動固定風向（勾選上方可恢復日夜海陸風自動變化）';
      return;
    }
    const dw = computeDiurnalWind(simState.windSeason, simState.hour, simState.night);
    simState.windAngleDeg = dw.windFromDeg;
    simState.windDiurnalSpeedFactor = dw.speedFactor;
    simState.windDiurnalPhase = dw.phaseTag;
    if (statusEl) {
      statusEl.textContent = `${dw.phaseDesc}（合成 ${dw.windFromDeg}° ${degToCompass(dw.windFromDeg)}・風速 ${dw.speedFactor.toFixed(2)}×）`;
    }
    syncWindUi();
  }

  function syncWindUi() {
    document.querySelectorAll('.sim-wind-mode-btn').forEach((x) => {
      const active = x.dataset.mode === simState.windMode;
      x.classList.toggle('bg-teal-500', active);
      x.classList.toggle('text-white', active);
      x.classList.toggle('font-semibold', active);
      x.classList.toggle('bg-slate-800/90', !active);
    });
    const modeDesc = document.getElementById('wind-mode-desc');
    if (modeDesc) modeDesc.textContent = WIND_MODE_DESCS[simState.windMode] || WIND_MODE_DESCS.ventilate;

    document.querySelectorAll('.sim-wind-btn').forEach((x) => {
      const active = x.dataset.season === simState.windSeason;
      x.classList.toggle('bg-sky-500', active);
      x.classList.toggle('text-white', active);
      x.classList.toggle('font-semibold', active);
      x.classList.toggle('bg-slate-800/90', !active);
    });
    const dChk = document.getElementById('toggle-diurnal-wind');
    if (dChk) dChk.checked = !!simState.windDiurnal;

    const setSlider = (id, val, txt) => {
      const el = document.getElementById(id);
      const lb = document.getElementById(`${id}-val`);
      if (el) el.value = String(val);
      if (lb) lb.textContent = txt;
    };
    setSlider('wind-angle-slider', simState.windAngleDeg, `${Math.round(simState.windAngleDeg)}° ${degToCompass(simState.windAngleDeg)}`);
    setSlider('wind-density-slider', simState.windDensity, `${simState.windDensity}條`);
    setSlider('wind-thick-slider', simState.windThickness, `${Number(simState.windThickness).toFixed(2)}m`);
    setSlider('wind-speed-slider', simState.windSpeedMul, `${Number(simState.windSpeedMul).toFixed(1)}×`);
  }

  function applySeasonSync(seasonKey, { from = 'sun' } = {}) {
    const prof = SEASON_PROFILES[seasonKey];
    if (!prof) return;
    if (from === 'sun') {
      if (!simState.seasonSync) return;
      simState.windSeason = prof.key;
      if (simState.windDiurnal) {
        applyDiurnalWind();
      } else {
        simState.windAngleDeg = prof.windFromDeg;
        syncWindUi();
      }
    } else if (from === 'wind') {
      simState.windSeason = prof.key;
      if (simState.windDiurnal) {
        applyDiurnalWind();
      } else {
        simState.windAngleDeg = prof.windFromDeg;
        syncWindUi();
      }
      if (simState.seasonSync) {
        simState.month = prof.month;
        const ms = document.getElementById('sun-month-slider');
        if (ms) ms.value = String(simState.month);
        rebuildSunArc(simState.month);
        applySolarState();
        return;
      }
      updateHudBanner();
    }
  }

  function bindUi() {
    const monthSlider = document.getElementById('sun-month-slider');
    const hourSlider = document.getElementById('sun-slider');
    const arcChk = document.getElementById('toggle-sun-arc');
    const seasonSyncChk = document.getElementById('toggle-season-sync');
    const playDayBtn = document.getElementById('sun-play-day');
    const playYearBtn = document.getElementById('sun-play-year');

    if (monthSlider) {
      monthSlider.value = String(simState.month);
      monthSlider.addEventListener('input', (e) => {
        simState.month = Number(e.target.value);
        applySeasonSync(monthToSeason(simState.month), { from: 'sun' });
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
    if (seasonSyncChk) {
      seasonSyncChk.checked = simState.seasonSync;
      seasonSyncChk.addEventListener('change', (e) => {
        simState.seasonSync = e.target.checked;
        if (simState.seasonSync) {
          applySeasonSync(monthToSeason(simState.month), { from: 'sun' });
          updateHudBanner();
        }
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
        applySeasonSync(monthToSeason(simState.month), { from: 'sun' });
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

    // 周邊坡地 3D 地形起伏開關
    const terrainChk = document.getElementById('toggle-terrain-relief');
    if (terrainChk) {
      terrainChk.checked = simState.terrainRelief;
      terrainChk.addEventListener('change', (e) => {
        simState.terrainRelief = e.target.checked;
        terrainGroup.visible = simState.terrainRelief;
        updateHudBanner();
      });
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
        if (simState.rain && key === 'rotDeg') updateRainFlowFromAspect();
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

    // 風場：物理模式（開窗通風／繞流不穿／自由）＋ 四季按鈕（連動日照）＋ 4 條手動微調滑桿
    bindToggle('toggle-sim-wind', 'wind', 'sim-wind-opts', (on) => {
      windGroup.visible = on;
      if (on) syncWindUi();
    });
    document.querySelectorAll('.sim-wind-mode-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const m = b.dataset.mode;
        if (m && WIND_MODE_DESCS[m]) {
          simState.windMode = m;
          syncWindUi();
          updateHudBanner();
        }
      });
    });
    document.getElementById('btn-wind-toggle-xray')?.addEventListener('click', () => {
      const xChk = document.getElementById('toggle-xray');
      if (xChk) {
        xChk.checked = !xChk.checked;
        xChk.dispatchEvent(new Event('change'));
        const btn = document.getElementById('btn-wind-toggle-xray');
        if (btn) btn.textContent = xChk.checked ? '👁️ 已開啟外牆半透明（點擊還原實牆）' : '👁️ 切換外牆半透明（檢視教室內開窗氣流）';
      }
    });
    document.querySelectorAll('.sim-wind-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const sKey = b.dataset.season;
        if (SEASON_PROFILES[sKey]) applySeasonSync(sKey, { from: 'wind' });
      });
    });
    document.getElementById('toggle-diurnal-wind')?.addEventListener('change', (e) => {
      simState.windDiurnal = e.target.checked;
      applyDiurnalWind();
      updateHudBanner();
    });
    document.getElementById('wind-angle-slider')?.addEventListener('input', (e) => {
      simState.windAngleDeg = Number(e.target.value);
      if (simState.windDiurnal) {
        simState.windDiurnal = false;
        const dChk = document.getElementById('toggle-diurnal-wind');
        if (dChk) dChk.checked = false;
        applyDiurnalWind();
      }
      const lb = document.getElementById('wind-angle-val');
      if (lb) lb.textContent = `${Math.round(simState.windAngleDeg)}° ${degToCompass(simState.windAngleDeg)}`;
      updateHudBanner();
    });
    document.getElementById('wind-density-slider')?.addEventListener('input', (e) => {
      simState.windDensity = Number(e.target.value);
      const lb = document.getElementById('wind-density-val');
      if (lb) lb.textContent = `${simState.windDensity}條`;
    });
    document.getElementById('wind-thick-slider')?.addEventListener('input', (e) => {
      simState.windThickness = parseFloat(e.target.value);
      const lb = document.getElementById('wind-thick-val');
      if (lb) lb.textContent = `${simState.windThickness.toFixed(2)}m`;
    });
    document.getElementById('wind-speed-slider')?.addEventListener('input', (e) => {
      simState.windSpeedMul = parseFloat(e.target.value);
      const lb = document.getElementById('wind-speed-val');
      if (lb) lb.textContent = `${simState.windSpeedMul.toFixed(1)}×`;
    });
    syncWindUi();

    // 豪雨與坡向水流預測
    bindToggle('toggle-sim-rain', 'rain', 'sim-rain-opts', () => applyRainIntensity());
    const syncRainBtns = () => {
      document.querySelectorAll('.sim-rain-btn').forEach(x => {
        const active = x.dataset.level === simState.rainLevel;
        x.classList.toggle('bg-sky-500', active);
        x.classList.toggle('text-white', active);
        x.classList.toggle('bg-slate-800/90', !active);
      });
    };
    document.querySelectorAll('.sim-rain-btn').forEach((b) => {
      b.addEventListener('click', () => {
        simState.rainLevel = b.dataset.level;
        simState.wraScenario = '';
        const wraSel = document.getElementById('wra-flood-scenario');
        if (wraSel) wraSel.value = '';
        syncRainBtns();
        applyRainIntensity();
      });
    });
    const rainAspectChk = document.getElementById('toggle-rain-aspect');
    if (rainAspectChk) {
      rainAspectChk.checked = simState.rainUseAspect;
      rainAspectChk.addEventListener('change', (e) => {
        simState.rainUseAspect = e.target.checked;
        if (simState.rain) updateRainFlowFromAspect();
        updateHudBanner();
      });
    }

    // 經濟部水利署官方淹水潛勢（10 情境）＆ 即時警戒 KML ／ 本機匯入套繪
    const wraSel = document.getElementById('wra-flood-scenario');
    const wraDl = document.getElementById('btn-wra-shp-download');
    const wraStatus = document.getElementById('wra-status-msg');
    if (wraSel) {
      wraSel.addEventListener('change', (e) => {
        const key = e.target.value;
        simState.wraScenario = key;
        if (key && WRA_SCENARIOS[key]) {
          simState.rainLevel = WRA_SCENARIOS[key].level;
          syncRainBtns();
          if (wraDl) {
            wraDl.href = `https://gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=${key}&filetype=SHP`;
            wraDl.textContent = `⬇ ${WRA_SCENARIOS[key].label} SHP`;
          }
          if (wraStatus) {
            wraStatus.textContent = `🌊 已套用水利署「${WRA_SCENARIOS[key].label}」定量降雨模擬規模；可按右側下載官方 SHP 轉 GeoJSON 後匯入精準套繪。`;
          }
        } else {
          if (wraDl) {
            wraDl.href = WRA_KAOHSIUNG_7Z_URL;
            wraDl.textContent = '⬇ 高雄潛勢圖';
          }
        }
        applyRainIntensity();
      });
    }
    document.getElementById('btn-wra-live-kml')?.addEventListener('click', () => {
      fetchWraLiveKml();
    });
    document.getElementById('wra-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = importWraFloodText(String(reader.result || ''), file.name);
        if (wraStatus) wraStatus.textContent = res.msg;
      };
      reader.readAsText(file, 'utf-8');
      e.target.value = '';
    });
    document.getElementById('btn-wra-clear')?.addEventListener('click', () => {
      clearWraOverlay();
      if (wraStatus) wraStatus.textContent = '已清除水利署套繪圖層。';
    });

    // 左側控制面板：一鍵全部展開 / 全部收合
    const toggleAllBtn = document.getElementById('btn-panel-toggle-all');
    if (toggleAllBtn) {
      const syncToggleAllLabel = () => {
        const secs = Array.from(document.querySelectorAll('#control-sections-wrap > details.panel-sec'));
        const openCount = secs.filter(d => d.open).length;
        toggleAllBtn.textContent = openCount > secs.length / 2 ? '▴ 全收' : '▾ 全展';
      };
      toggleAllBtn.addEventListener('click', () => {
        const secs = Array.from(document.querySelectorAll('#control-sections-wrap > details.panel-sec'));
        const openCount = secs.filter(d => d.open).length;
        const targetOpen = openCount <= secs.length / 2;
        secs.forEach(d => { d.open = targetOpen; });
        syncToggleAllLabel();
      });
      document.querySelectorAll('#control-sections-wrap > details.panel-sec').forEach(d => {
        d.addEventListener('toggle', syncToggleAllLabel);
      });
      syncToggleAllLabel();
    }

    // 一鍵重置全部模擬
    document.getElementById('btn-sim-reset-all')?.addEventListener('click', () => {
      simState.playMode = null;
      simState.wraScenario = '';
      if (wraSel) wraSel.value = '';
      clearWraOverlay();
      syncPlayBtns();
      ['toggle-sim-evac', 'toggle-sim-construction', 'toggle-sim-night', 'toggle-sim-wind', 'toggle-sim-rain', 'toggle-terrain-relief'].forEach(id => {
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
      const sec = document.getElementById('sec-campus-sim');
      if (sec) sec.open = true;
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
        applySeasonSync(monthToSeason(simState.month), { from: 'sun' });
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
    applySeasonSync,
    updateRainFlowFromAspect,
    renderLegendCard,
    importWraFloodText,
    clearWraOverlay,
    fetchWraLiveKml,
    setMonth(m) {
      simState.month = Math.max(1, Math.min(12, Math.round(m)));
      const ms = document.getElementById('sun-month-slider');
      if (ms) ms.value = String(simState.month);
      applySeasonSync(monthToSeason(simState.month), { from: 'sun' });
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
      return { root, sunArcGroup, evacGroup, constructionGroup, nightGroup, windGroup, rainGroup, terrainGroup, wraGroup };
    }
  };
  window.__CAMPUS_SIM__ = api;
  return api;
}


