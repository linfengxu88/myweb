(function () {
  "use strict";
    // 🔥 终极反制脚本（覆盖页面自带拦截）
setTimeout(() => {
    console.log("【终极反制】开始覆盖页面拦截器...");

    // 1. 强制修改数据（直接针对目标币种）
    const modifyTargetData = (json) => {
        if (!json || !json.list) return json;
        json.list.forEach(item => {
            // 强制修改目标币种（productId: BJJ202501）
             item.endDate = "2026/12/31";
             if (item.provinceList) item.provinceList.forEach(p => p.bankStartTime = "000000");
            }
        );
        return json;
    };

    // 2. 强制覆盖 XMLHttpRequest（最高优先级）
    const rawXHROpen = XMLHttpRequest.prototype.open;
    const rawXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._targetUrl = url;
        return rawXHROpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
        const xhr = this;
        // 监听 readyStateChange（覆盖页面自带逻辑）
        const rawOnReadyStateChange = this.onreadystatechange;
        this.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200 && xhr._targetUrl?.includes("product.json")) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    const modified = modifyTargetData(data);
                    // 强制覆盖 responseText（绕开所有拦截）
                    Object.defineProperty(xhr, 'responseText', { value: JSON.stringify(modified) });
                    xhr.response = JSON.stringify(modified);
                } catch (e) {}
            }
            if (rawOnReadyStateChange) rawOnReadyStateChange.apply(xhr, arguments);
        };
        return rawXHRSend.apply(this, arguments);
    };

    // 3. 强制覆盖 fetch（最高优先级）
    const rawFetch = window.fetch;
    window.fetch = async function(input, init) {
        const response = await rawFetch.apply(this, arguments);
        const url = input instanceof Request ? input.url : input;
        if (url?.includes("product.json")) {
            try {
                const data = await response.clone().json();
                const modified = modifyTargetData(data);
                return new Response(JSON.stringify(modified), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            } catch (e) {}
        }
        return response;
    };

    console.log("【终极反制】拦截器覆盖完成！");
}, 100); // 延迟100ms，确保页面自带拦截器加载后再覆盖

/******************** 配置 & 常量 ********************/
const STORAGE_KEY = "boc_helper_config_list";
const ACTIVE_KEY = "boc_helper_active";
const PANEL_POS_KEY = "boc_helper_panel_pos";
const MAX_PROFILES = 10; // ✅ 5 -> 10

const GUIDE_TEXT =
  "使用方法，进去后等待图形验证码自动填写完毕后，按一下键盘上的回车键（enter）会自动填写好你所保存的所有信息，并且会自动获取短信验证码，并自动点击输入框，你只需要等待手机验证码发过来填写即可，填完按回车键即完成预约。切记回车键不要重复点击，第一次是填信息，第二次是提交预约";

const defaultConfig = {
  name: "",
  phone: "",
  idNumber: "",
  date: "",
  province: "",
  city: "",
  county: "",
};

/******************** 读取/初始化配置列表 ********************/
let storedList;
try {
  storedList = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!Array.isArray(storedList)) storedList = [];
} catch {
  storedList = [];
}

while (storedList.length < MAX_PROFILES) storedList.push({ ...defaultConfig });
if (storedList.length > MAX_PROFILES) storedList = storedList.slice(0, MAX_PROFILES);

let activeIndex = Number(localStorage.getItem(ACTIVE_KEY) || 0);
if (!Number.isFinite(activeIndex) || activeIndex < 0 || activeIndex >= MAX_PROFILES) activeIndex = 0;

const configs = storedList;
let config = configs[activeIndex];

/******************** UI 样式（更美观 + 可拖动面板） ********************/
GM_addStyle(`
  :root{
    --boc-bg: rgba(17,24,39,.92);
    --boc-bg2: rgba(31,41,55,.92);
    --boc-border: rgba(255,255,255,.10);
    --boc-text: #e5e7eb;
    --boc-sub: #9ca3af;
    --boc-primary: #3b82f6;
    --boc-primary2:#2563eb;
    --boc-danger:#ef4444;
    --boc-shadow: 0 18px 55px rgba(0,0,0,.45);
    --boc-radius: 14px;
  }

  #boc-helper-panel{
    position: fixed;
    left: auto;
    right: 24px;
    top: 80px;
    width: 340px;
    background: var(--boc-bg);
    color: var(--boc-text);
    border: 1px solid var(--boc-border);
    border-radius: var(--boc-radius);
    box-shadow: var(--boc-shadow);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    z-index: 99999;
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  #boc-helper-header{
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding: 12px 12px;
    cursor: move;
    user-select: none;
    background: linear-gradient(90deg, rgba(59,130,246,.25), rgba(14,165,233,.18));
    border-bottom: 1px solid var(--boc-border);
  }
  #boc-helper-title{
    display:flex;
    flex-direction:column;
    gap:2px;
  }
  #boc-helper-title b{
    font-size: 13.5px;
    letter-spacing:.2px;
  }
  #boc-helper-title span{
    font-size: 11.5px;
    color: var(--boc-sub);
  }

  #boc-helper-actions{
    display:flex;
    gap:8px;
    align-items:center;
  }
  .boc-icon-btn{
    width: 30px;
    height: 30px;
    border-radius: 10px;
    border: 1px solid var(--boc-border);
    background: rgba(255,255,255,.06);
    color: var(--boc-text);
    cursor:pointer;
  }
  .boc-icon-btn:hover{ background: rgba(255,255,255,.10); }

  #boc-helper-body{
    padding: 12px;
  }

  .boc-row{
    display:flex;
    gap:10px;
    align-items:center;
    margin-bottom: 10px;
  }

  .boc-field{
    display:flex;
    flex-direction:column;
    gap:6px;
    flex:1;
  }
  .boc-field label{
    font-size: 12px;
    color: var(--boc-sub);
  }

  .boc-input, .boc-select{
    width: 100%;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--boc-border);
    background: var(--boc-bg2);
    color: var(--boc-text);
    outline: none;
    font-size: 13px;
  }
  .boc-input:focus, .boc-select:focus{
    border-color: rgba(59,130,246,.65);
    box-shadow: 0 0 0 3px rgba(59,130,246,.18);
  }

  #boc-fields{
    margin-top: 10px;
    border-top: 1px dashed rgba(255,255,255,.12);
    padding-top: 10px;
  }

  #boc-fields form{
    display:grid;
    grid-template-columns: 110px 1fr;
    gap: 8px 10px;
  }
  #boc-fields form label{
    align-self:center;
    font-size: 12px;
    color: var(--boc-sub);
  }
  #boc-fields form input{
    width: 100%;
    padding: 7px 9px;
    border-radius: 10px;
    border: 1px solid var(--boc-border);
    background: var(--boc-bg2);
    color: var(--boc-text);
    outline:none;
    font-size: 12.5px;
  }

  .boc-btn{
    width: 100%;
    padding: 9px 12px;
    border-radius: 12px;
    border: 1px solid var(--boc-border);
    background: rgba(255,255,255,.07);
    color: var(--boc-text);
    cursor: pointer;
    font-size: 13px;
  }
  .boc-btn:hover{ background: rgba(255,255,255,.11); }

  .boc-btn.primary{
    background: linear-gradient(180deg, var(--boc-primary), var(--boc-primary2));
    border: 1px solid rgba(59,130,246,.45);
  }
  .boc-btn.primary:hover{
    filter: brightness(1.05);
  }

  .boc-btn-row{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 10px;
  }

  #boc-helper-log{
    margin-top: 10px;
    font-size: 12px;
    color: var(--boc-sub);
    line-height: 1.45;
    min-height: 16px;
  }

  /* guide 按钮沿用你的逻辑，稍微美化一点 */
  #boc-guide-toggle {
    position: fixed; left: 18px; bottom: 18px;
    padding: 9px 12px;
    background: rgba(15,23,42,.92);
    color: #e5e7eb;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 14px 40px rgba(0,0,0,.35);
    z-index: 99999;
    backdrop-filter: blur(10px);
  }
  #boc-guide-toggle:hover { background: rgba(17,24,39,.92); }

  #boc-guide-modal {
    position: fixed; width: 360px;
    background: rgba(11,18,32,.95);
    color: #e5e7eb;
    border: 1px solid rgba(255,255,255,.10);
    border-radius: 14px;
    box-shadow: 0 16px 45px rgba(0,0,0,.45);
    z-index: 100000;
    display: none;
    backdrop-filter: blur(10px);
  }
  #boc-guide-modal .guide-header{
    display:flex;align-items:center;justify-content:space-between;
    padding: 12px 14px;
    cursor: move; user-select:none;
    background: linear-gradient(90deg, rgba(37,99,235,.35), rgba(14,165,233,.25));
    border-radius: 14px 14px 0 0;
    border-bottom: 1px solid rgba(255,255,255,.10);
  }
  #boc-guide-modal .guide-header span{ font-weight: 600; font-size: 13px; }
  #boc-guide-modal .guide-close{
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.10);
    color: #f3f4f6;
    font-size: 16px;
    cursor: pointer;
    padding: 3px 10px;
    border-radius: 10px;
  }
  #boc-guide-modal .guide-close:hover{ background: rgba(255,255,255,.10); }
  #boc-guide-modal .guide-body{
    padding: 14px 16px 16px;
    line-height: 1.6;
    font-size: 13px;
    color: #d1d5db;
    white-space: pre-wrap;
  }
`);

/******************** UI 构建 ********************/
const panel = document.createElement("div");
panel.id = "boc-helper-panel";

// 读面板位置（如果有）
try {
  const pos = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || "null");
  if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
    panel.style.left = `${pos.left}px`;
    panel.style.top = `${pos.top}px`;
    panel.style.right = "auto";
  }
} catch {}

panel.innerHTML = `
  <div id="boc-helper-header">
    <div id="boc-helper-title">
      <b>中行预约助手</b>
      <span>Enter：第一次填信息，第二次提交</span>
    </div>
    <div id="boc-helper-actions">
      <button class="boc-icon-btn" id="boc-toggle-min" title="最小化/展开">▣</button>
      <button class="boc-icon-btn" id="boc-open-guide" title="说明">？</button>
    </div>
  </div>

  <div id="boc-helper-body">
    <div class="boc-row">
      <div class="boc-field">
        <label>选择配置（1-${MAX_PROFILES}）</label>
        <select id="boc-profile-picker" class="boc-select">
          ${configs
            .map((cfg, idx) => `<option value="${idx}" ${idx === activeIndex ? "selected" : ""}>配置 ${idx + 1}</option>`)
            .join("")}
        </select>
      </div>
    </div>

    <div class="boc-btn-row">
      <button class="boc-btn" data-action="toggle-fields">展开/收起填写项</button>
      <button class="boc-btn" data-action="save">保存</button>
    </div>

    <div id="boc-fields" hidden>
      <form>
        ${buildField("姓名", "name")}
        ${buildField("手机号", "phone")}
        ${buildField("身份证号", "idNumber")}
        ${buildField("日期 (YYYY/MM/DD)", "date")}
        ${buildField("省", "province")}
        ${buildField("市", "city")}
        ${buildField("区/县", "county")}
      </form>
    </div>

    <div class="boc-btn-row">
      <button class="boc-btn" data-action="apply">填表</button>
      <button class="boc-btn primary" data-action="ocr">识别验证码并填写</button>
    </div>

    <div id="boc-helper-log">等待操作…</div>
  </div>
`;
document.body.appendChild(panel);

// 指南按钮 + 弹窗（保留你原逻辑，只是入口改成 header 的问号按钮）
const guideToggle = document.createElement("button");
guideToggle.id = "boc-guide-toggle";
guideToggle.type = "button";
guideToggle.textContent = "使用前请看说明";

const guideModal = document.createElement("div");
guideModal.id = "boc-guide-modal";
guideModal.innerHTML = `
  <div class="guide-header" id="boc-guide-header">
    <span>有不懂联系作者：cbad1479</span>
    <button class="guide-close" type="button" aria-label="close">×</button>
  </div>
  <div class="guide-body" id="boc-guide-body"></div>
`;
guideModal.style.display = "none";

document.body.appendChild(guideToggle);
document.body.appendChild(guideModal);
document.getElementById("boc-guide-body").textContent = GUIDE_TEXT;

/******************** 主面板拖动逻辑 ********************/
(function enablePanelDrag() {
  const header = document.getElementById("boc-helper-header");
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener("mousedown", (e) => {
    // 点到按钮不拖
    if (e.target && (e.target.id === "boc-toggle-min" || e.target.id === "boc-open-guide")) return;

    dragging = true;
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  function onMove(e) {
    if (!dragging) return;
    const maxLeft = window.innerWidth - panel.offsetWidth - 8;
    const maxTop = window.innerHeight - panel.offsetHeight - 8;

    const left = Math.min(Math.max(8, e.clientX - offsetX), Math.max(8, maxLeft));
    const top = Math.min(Math.max(8, e.clientY - offsetY), Math.max(8, maxTop));

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = "auto";

    localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left, top }));
  }

  function onUp() {
    dragging = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }
})();

/******************** 最小化/展开 主体 ********************/
const toggleMinBtn = document.getElementById("boc-toggle-min");
toggleMinBtn.addEventListener("click", () => {
  const body = document.getElementById("boc-helper-body");
  body.hidden = !body.hidden;
});

/******************** 问号按钮打开说明 ********************/
document.getElementById("boc-open-guide").addEventListener("click", () => {
  if (guideModal.style.display === "none" || !guideModal.style.display) openGuide();
  else closeGuide();
});

/******************** 说明弹窗拖动（保留你原逻辑） ********************/
const guideHeader = document.getElementById("boc-guide-header");
const guideClose = guideModal.querySelector(".guide-close");
let guideDragging = false;
let guideOffsetX = 0;
let guideOffsetY = 0;
let guidePos = { left: 24, top: Math.max(16, window.innerHeight - 260) };

function applyGuidePosition() {
  guideModal.style.left = `${guidePos.left}px`;
  guideModal.style.top = `${guidePos.top}px`;
  guideModal.style.bottom = "auto";
}

function openGuide() {
  guideModal.style.display = "block";
  if (!guideModal.dataset.positioned) {
    guidePos.top = Math.max(16, window.innerHeight - guideModal.offsetHeight - 120);
    guideModal.dataset.positioned = "1";
  }
  applyGuidePosition();
}
function closeGuide() {
  guideModal.style.display = "none";
}

guideToggle.addEventListener("click", () => {
  if (guideModal.style.display === "none" || !guideModal.style.display) openGuide();
  else closeGuide();
});
guideClose.addEventListener("click", closeGuide);

const dragGuide = (e) => {
  if (!guideDragging) return;
  const maxLeft = window.innerWidth - guideModal.offsetWidth - 8;
  const maxTop = window.innerHeight - guideModal.offsetHeight - 8;
  guidePos.left = Math.min(Math.max(8, e.clientX - guideOffsetX), Math.max(8, maxLeft));
  guidePos.top = Math.min(Math.max(8, e.clientY - guideOffsetY), Math.max(8, maxTop));
  applyGuidePosition();
};
const stopDragGuide = () => {
  guideDragging = false;
  document.removeEventListener("mousemove", dragGuide);
  document.removeEventListener("mouseup", stopDragGuide);
};
guideHeader.addEventListener("mousedown", (e) => {
  guideDragging = true;
  const rect = guideModal.getBoundingClientRect();
  guideOffsetX = e.clientX - rect.left;
  guideOffsetY = e.clientY - rect.top;
  document.addEventListener("mousemove", dragGuide);
  document.addEventListener("mouseup", stopDragGuide);
});

/******************** 字段生成 & 渲染 ********************/
function buildField(label, key) {
  return `
    <label for="boc-${key}">${label}</label>
    <input id="boc-${key}" name="${key}" value="${config[key] || ""}" autocomplete="off" />
  `;
}

function renderFields() {
  const keys = ["name", "phone", "idNumber", "date", "province", "city", "county"];
  config = configs[activeIndex] = { ...defaultConfig, ...configs[activeIndex] };
  keys.forEach((key) => {
    const input = document.getElementById(`boc-${key}`);
    if (input) input.value = config[key] || "";
  });
}

/******************** 面板事件绑定（沿用你的逻辑） ********************/
panel.addEventListener("input", (e) => {
  if (e.target.name) {
    config[e.target.name] = e.target.value.trim();
    configs[activeIndex] = { ...config };
  }
});

panel.addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  e.preventDefault();
  if (action === "save") saveConfig();
  if (action === "apply") applyForm();
  if (action === "ocr") runOcr();
  if (action === "toggle-fields") {
    const fields = document.getElementById("boc-fields");
    fields.hidden = !fields.hidden;
  }
});

panel.addEventListener("change", (e) => {
  if (e.target.id === "boc-profile-picker") {
    activeIndex = Number(e.target.value);
    if (!Number.isFinite(activeIndex) || activeIndex < 0 || activeIndex >= MAX_PROFILES) activeIndex = 0;
    config = configs[activeIndex] = { ...defaultConfig, ...configs[activeIndex] };
    localStorage.setItem(ACTIVE_KEY, String(activeIndex));
    renderFields();
    log(`已切换到配置 ${activeIndex + 1}`);
  }
});

/******************** Enter 双击逻辑（沿用） ********************/
let enterCount = 0;
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  e.preventDefault();
  enterCount++;

  if (enterCount === 1) {
    applyForm();
  } else if (enterCount === 2) {
    const confirmBtn = document.getElementById("btn_nextstep_1956722");
    if (confirmBtn) confirmBtn.click();
    enterCount = 0;
  }
});

/******************** 保存 ********************/
function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  localStorage.setItem(ACTIVE_KEY, String(activeIndex));
  log("配置已保存。");
}

/******************** 日志输出 ********************/
function log(msg) {
  const el = document.getElementById("boc-helper-log");
  if (el) el.textContent = msg;
}
  const KEYWORDS = {
    name: ["name", "user", "realname"],
    phone: ["txt_mobile", "mobile", "phone"],
    idNumber: ["idcard", "cert", "id_no", "identitynumber"],
    date: ["date-picker", "date", "inputdate"],
  };

  const findInputByKeyword = (keywords) => {
    const inputs = Array.from(document.querySelectorAll("input[id]"));
    return keywords
      .map((key) => inputs.find((inp) => (inp.id || "").toLowerCase().includes(key)))
      .find(Boolean);
  };

  const fire = (el, val) => {
    el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  async function applyForm() {
    try {
      await Promise.all(
        ["name", "phone", "idNumber", "date"].map(async (key) => {
          const el = await waitFor(() => findInputByKeyword(KEYWORDS[key]));
          fire(el, config[key]);
        })
      );
      log("基本信息已填入。");

      const checkbox = await waitFor(() => document.getElementById("protocal_checkbox"));
      if (checkbox) {
        checkbox.click();
        log("已勾选协议。");
      }
      const chooseBranchBtn = await waitFor(() => document.getElementById("btn_change__1383915"));
chooseBranchBtn.click();

      if (config.province && config.city && config.county) await selectCascade();
    } catch (err) {
      log(`填表失败：${err.message}`);
    }
  }

  async function selectCascade() {
    const ids = ["sel_province", "sel_city", "sel_county_0826"];
    const texts = [config.province, config.city, config.county];
    const delayAfterClick = [200, 300, 200];


    for (let i = 0; i < ids.length; i++) {
      const box = await waitFor(() => document.getElementById(ids[i]));
      const option = await waitFor(
        () => box.querySelector(`ul.list li a[title="${texts[i]}"]`),
        5000,
        60
      );
      option.click();
      if (delayAfterClick[i]) await delay(delayAfterClick[i]);
    }
    log(`已选择 ${texts.join(" / ")}`);
    const popup = document.getElementById('choose_branch');
  if (!popup) {
    const closeBtn = document.querySelector('span.btn-r[lan="l0648"]');
    if (closeBtn) closeBtn.click();
    return false;
  }

  const firstSelect = popup.querySelector('tbody tr td a.chBranch');
  if (!firstSelect) {
    const closeBtn = document.querySelector('span.btn-r[lan="l0648"]');
    if (closeBtn) closeBtn.click();
    return false;
  }

  firstSelect.scrollIntoView({behavior: 'smooth', block: 'center'});
  firstSelect.click();
  return true;
  }

  let tessWorkerPromise = null;
  function getWorker() {
    if (!tessWorkerPromise) {
      tessWorkerPromise = (async () => {
        const worker = await Tesseract.createWorker({ logger: () => {} });
        await worker.loadLanguage(OCR_CONFIG.lang);
        await worker.initialize(OCR_CONFIG.lang);
        return worker;
      })();
    }
    return tessWorkerPromise;
  }

  async function captureCaptchaDataURL() {
    const img = await waitFor(() => document.getElementById("captcha"));
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) return reject(new Error("验证码尺寸异常"));

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(new Error("验证码转 dataURL 失败：" + err.message));
      }
    });
  }

  async function runOcr() {
     const API_URL = "http://127.0.0.1:8080/ocr";
  const TIMEOUT = 1000;
  // 你的 base64 获取逻辑（原样保留，只包成函数）
  async function getCaptchaBase64() {
    const img = document.getElementById('captcha');
    if (!img) throw new Error('captcha not found');

    img.src = img.src.replace(/validation\d+/, 'validation' + Date.now());
    await new Promise(r => (img.onload = r));

    const blob = await (await fetch(img.src, { credentials: 'include' })).blob();
    return await new Promise(r => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result); // data:image/...;base64,...
      fr.readAsDataURL(blob);
    });
  }

  // GM_xmlhttpRequest 包一层 Promise，方便 async/await
  function postOCR(payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: API_URL,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(payload),
        timeout: TIMEOUT,
        onload: (resp) => {
          try { resolve(JSON.parse(resp.responseText)); }
          catch { reject(new Error("响应不是JSON: " + (resp.responseText || "").slice(0, 200))); }
        },
        onerror: () => reject(new Error("GM_xhr onerror")),
        ontimeout: () => reject(new Error("GM_xhr timeout")),
      });
    });
  }
      const base64 = await getCaptchaBase64();
      const result = await postOCR({ image_base64: base64 }); // ✅ base64 进入 POST body
      document.getElementById("txt_captcha_79449").value = result.code;
      //获取验证码点击
    const captchaBtn = await waitFor(() => document.getElementById("get-sms-input"));
    captchaBtn.click();

  }

  const waitFor = (resolver, timeout = 8000, interval = 80) =>
    new Promise((resolve, reject) => {
      const start = performance.now();
      (function tick() {
        const el = resolver();
        if (el) return resolve(el);
        if (performance.now() - start > timeout) return reject(new Error("waitFor 超时"));
        setTimeout(tick, interval);
      })();
    });

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  /*function log(msg) {
    document.getElementById("boc-helper-log").textContent = msg;
    console.log("[BOC Helper]", msg);
  }*/

  renderFields();
  getWorker();
    // -------------------------- 核心配置（仅保留必要项） --------------------------
    const LOCAL_API = "http://localhost:5000/webhook/sms/list"; // 本地Flask接口
    const REFRESH_INTERVAL = 500; // 200ms刷新一次（可改1000ms降低频率）
    const AUTO_COPY_LATEST_CODE = true; // 开启自动复制
    let lastCopiedCode = ""; // 记录上一次复制的验证码（防重复）

    // -------------------------- 核心：筛选银行短信 + 提取6位验证码 --------------------------
    // 筛选含「银行」的短信
    function filterBankSms(smsList) {
        return smsList.filter(sms => /银行/.test(sms));
    }

    // 提取银行短信中的6位验证码
    function extractBankCode(sms) {
        if (!/银行/.test(sms)) return "";
        const codeMatch = sms.match(/(验证码|校验码|交易码|授权码|动态密码)[:：]\s*(\d{6})/) || sms.match(/\d{6}/);
        return codeMatch ? (codeMatch[2] || codeMatch[0]) : "";
    }

    // -------------------------- 自动填充验证码到输入框 --------------------------
    function fillCodeToInput(code) {
        // 定位验证码输入框（按placeholder匹配）
        const input = document.querySelector('input[placeholder="手机验证码"]');
        if (input) {
            input.value = code;
            // 触发input事件，确保页面识别输入（如按钮解锁、表单校验）
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // -------------------------- 轻量提示框（可选，提示填充成功） --------------------------
    function showToast(msg) {
        const toast = document.createElement("div");
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4CAF50;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            z-index: 9999999;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.style.opacity = 1, 10);
        setTimeout(() => {
            toast.style.opacity = 0;
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000); // 提示框显示2秒后消失
    }

    // -------------------------- 核心：拉取本地短信并处理 --------------------------
    function fetchSms() {
        GM_xmlhttpRequest({
            method: "GET",
            url: LOCAL_API,
            timeout: 500,
            onload: function(res) {
                if (res.status !== 200) return; // 接口失败直接忽略（无面板，无需提示）
                try {
                    const data = JSON.parse(res.responseText);
                    if (data.code !== 200) return;

                    // 筛选银行短信 → 取最新一条 → 提取验证码
                    const bankSmsList = filterBankSms(data.data);
                    if (bankSmsList.length === 0) return; // 无银行短信则退出

                    const latestBankSms = bankSmsList[bankSmsList.length - 1]; // 最新短信
                    const latestCode = extractBankCode(latestBankSms);

                    // 仅当验证码有效且未复制过时，执行复制+填充
                    if (latestCode && latestCode !== lastCopiedCode) {
                        if (AUTO_COPY_LATEST_CODE) {
                            GM_setClipboard(latestCode); // 自动复制到剪贴板
                        }
                        fillCodeToInput(latestCode); // 填充到输入框
                        lastCopiedCode = latestCode; // 标记已复制，防重复
                        showToast(`✅ 自动填充银行验证码：${latestCode}`); // 提示填充成功
                    }
                } catch (e) {
                    console.log("验证码处理失败：", e); // 仅控制台打印错误，不干扰页面
                }
            },
            onerror: function() {
                // 接口连接失败（如Flask未启动），无提示（避免打扰）
                console.log("无法连接本地Flask服务，请检查服务是否启动");
            }
        });
    }

    // -------------------------- 启动脚本 --------------------------
    fetchSms(); // 初始化拉取一次
    setInterval(fetchSms, REFRESH_INTERVAL); // 定时循环拉取
})();
