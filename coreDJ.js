(function () {
  "use strict";
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

  const STORAGE_KEY = "boc_helper_config_list";
  const ACTIVE_KEY = "boc_helper_active";
  const MAX_PROFILES = 5;
  const GUIDE_TEXT = "使用方法，进去后等待图形验证码自动填写完毕后，按一下键盘上的回车键（enter）会自动填写好你所保存的所有信息，并且会自动获取短信验证码，并自动点击输入框，你只需要等待手机验证码发过来填写即可，填完按回车键即完成预约。切记回车键不要重复点击，第一次是填信息，第二次是提交预约";

  const defaultConfig = {
    name: "",
    phone: "",
    idNumber: "",
    date: "",
    province: "",
    city: "",
    county: "",
  };

  const storedList = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  while (storedList.length < MAX_PROFILES) storedList.push({ ...defaultConfig });
  let activeIndex = Number(localStorage.getItem(ACTIVE_KEY) || 0);
  if (activeIndex >= MAX_PROFILES) activeIndex = 0;

  const configs = storedList;
  let config = configs[activeIndex];

  GM_addStyle(`
    #boc-helper-panel { position: fixed; right: 24px; top: 80px; width: 320px; background: #111827; color: #f3f4f6; border-radius: 12px; box-shadow: 0 10px 35px rgba(0,0,0,.35); font-family: "Segoe UI", sans-serif; z-index: 99999; }
    #boc-helper-panel h2 { margin: 0; padding: 16px; font-size: 15px; border-bottom: 1px solid rgba(255,255,255,.08); }
    #boc-helper-panel form { padding: 14px 16px 8px; display: grid; grid-template-columns: 90px 1fr; gap: 8px 10px; font-size: 13px; }
    #boc-helper-panel label { align-self: center; color: #9ca3af; }
    #boc-helper-panel input { width: 100%; padding: 6px 8px; border-radius: 6px; border: 1px solid #374151; background: #1f2937; color: #f9fafb; }
    #boc-helper-panel button { margin: 8px; padding: 8px 12px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; }
    #boc-helper-panel .primary { background: #2563eb; color: #fff; width: calc(100% - 16px); }
    #boc-helper-panel .secondary { background: rgba(255,255,255,.08); color: #f3f4f6; width: calc(50% - 14px); }
    #boc-helper-panel small { display: block; padding: 0 16px 12px; color: #9CA3AF; }
    #boc-guide-toggle { position: fixed; left: 18px; bottom: 18px; padding: 8px 12px; background: #0f172a; color: #e5e7eb; border: 1px solid #1f2937; border-radius: 8px; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,.25); z-index: 99999; }
    #boc-guide-toggle:hover { background: #111827; }
    #boc-guide-modal { position: fixed; width: 360px; background: #0b1220; color: #e5e7eb; border: 1px solid #1f2937; border-radius: 12px; box-shadow: 0 16px 45px rgba(0,0,0,.45); z-index: 100000; display: none; }
    #boc-guide-modal .guide-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; cursor: move; user-select: none; background: linear-gradient(90deg, rgba(37,99,235,.35), rgba(14,165,233,.35)); border-radius: 12px 12px 0 0; }
    #boc-guide-modal .guide-header span { font-weight: 600; }
    #boc-guide-modal .guide-close { background: transparent; border: none; color: #f3f4f6; font-size: 16px; cursor: pointer; padding: 4px 8px; }
    #boc-guide-modal .guide-body { padding: 14px 16px 16px; line-height: 1.6; font-size: 13px; white-space: pre-wrap; }
  `);

  const panel = document.createElement("div");
  panel.id = "boc-helper-panel";
 panel.innerHTML = `
    <h2>中行预约助手</h2>
    <div style="padding: 0 16px 8px;">
      <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:4px;">选择配置</label>
      <select id="boc-profile-picker" class="profile-select">
        ${configs
          .map(
            (cfg, idx) =>
              `<option value="${idx}" ${idx === activeIndex ? "selected" : ""}>配置${idx + 1}</option>`
          )
          .join("")}
      </select>
      <button class="secondary" data-action="toggle-fields" style="margin-top:6px;width:100%;">展开/收起填写项</button>
    </div>
    <div id="boc-fields">
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
    <div style="display:flex; justify-content:space-between;">
      <button class="secondary" data-action="save">保存</button>
      <button class="secondary" data-action="apply">填表</button>
    </div>
    <button class="primary" data-action="ocr">识别验证码并填写</button>
    <small id="boc-helper-log">等待操作…</small>
  `;
  document.body.appendChild(panel);
  document.getElementById("boc-fields").hidden = true; // 默认收起

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
    if (guideModal.style.display === "none" || !guideModal.style.display) {
      openGuide();
    } else {
      closeGuide();
    }
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
      config = configs[activeIndex] = { ...defaultConfig, ...configs[activeIndex] };
      localStorage.setItem(ACTIVE_KEY, String(activeIndex));
      renderFields(); // 自己写一个函数，把当前 config 的值填回 form
      log(`已切换到配置 ${activeIndex + 1}`);
    }
  });
  let enterCount = 0;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    e.preventDefault();
    enterCount++;

    if (enterCount === 1) {
      applyForm(); // 第一次 Enter → 填表
    } else if (enterCount === 2) {
      const confirmBtn = document.getElementById("btn_nextstep_1956722");
      if (confirmBtn) confirmBtn.click(); // 第二次 Enter → 点击确认
      enterCount = 0;
    }
  });

  function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    localStorage.setItem(ACTIVE_KEY, String(activeIndex));
    log("配置已保存。");
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
    //获取验证码点击
    const captchaBtn = await waitFor(() => document.getElementById("get-sms-input"));
    captchaBtn.click();
    await delay(200); // 给 DOM 刷新时间
    //点击输入框
    const inputsms = document.getElementById("txt_phonechar");
if (inputsms) {
  inputsms.focus();  // 把光标移进去
  inputsms.dispatchEvent(new Event("focus", { bubbles: true }));
  // 如需填值：
  // inputsms.value = "123456";
  // inputsms.dispatchEvent(new Event("input", { bubbles: true }));
  // inputsms.dispatchEvent(new Event("change", { bubbles: true }));
}
  }

  async function selectCascade() {
    const ids = ["sel_province", "sel_city", "sel_county_0826"];
    const texts = [config.province, config.city, config.county];
    const delayAfterClick = [200, 200, 200];


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
    try {
      const worker = await getWorker();
      const dataUrl = await captureCaptchaDataURL();

      await worker.setParameters({
        tessedit_char_whitelist: OCR_CONFIG.whitelist,
        classify_bln_numeric_mode: 0,
      });

      const {
        data: { text },
      } = await worker.recognize(dataUrl);

      const code = text.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 6);
      if (!code) throw new Error("识别结果为空");

      const input = document.getElementById("txt_captcha_79449");
      if (!input) throw new Error("验证码输入框不存在");

      fire(input, code);
      log(`验证码识别完成：${code}`);
    } catch (err) {
      log(`OCR 失败：${err.message}`);
    }
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

  function log(msg) {
    document.getElementById("boc-helper-log").textContent = msg;
    console.log("[BOC Helper]", msg);
  }

  renderFields();
  getWorker();
})();
