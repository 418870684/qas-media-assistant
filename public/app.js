const state = {
  defaultSaveRoot: "/影视",
  candidates: [],
  candidatePage: 1,
  candidatePageSize: 5,
  previewPath: [],
  lastPreviewFiles: []
};

const els = {
  status: document.querySelector("#status"),
  messages: document.querySelector("#messages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  results: document.querySelector("#results"),
  refreshTasks: document.querySelector("#refreshTasks"),
  taskForm: document.querySelector("#taskForm"),
  taskname: document.querySelector("#taskname"),
  shareurl: document.querySelector("#shareurl"),
  savepath: document.querySelector("#savepath"),
  pattern: document.querySelector("#pattern"),
  replace: document.querySelector("#replace"),
  runNow: document.querySelector("#runNow"),
  renamePrefix: document.querySelector("#renamePrefix"),
  renameStart: document.querySelector("#renameStart"),
  renamePad: document.querySelector("#renamePad"),
  applyRename: document.querySelector("#applyRename"),
  previewShare: document.querySelector("#previewShare"),
  previewList: document.querySelector("#previewList"),
  previewCount: document.querySelector("#previewCount"),
  breadcrumb: document.querySelector("#breadcrumb"),
  loginShell: document.querySelector("#loginShell"),
  loginForm: document.querySelector("#loginForm"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  logoutButton: document.querySelector("#logoutButton")
};

boot();

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.loginError.textContent = "";
  const password = els.loginPassword.value;
  const result = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ password })
  });
  if (!result.success) {
    els.loginError.textContent = result.message || "登录失败";
    els.loginPassword.select();
    return;
  }
  els.loginPassword.value = "";
  await enterApp();
});

els.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = els.chatInput.value.trim();
  if (!text) return;
  els.chatInput.value = "";
  addMessage("user", text);
  const data = await api("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message: text })
  });
  handleChatResponse(data);
});

els.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const task = taskFromForm();
  if (!confirmTask(task)) return;
  const result = await api("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ ...task, runNow: els.runNow.checked })
  });
  if (result.success) {
    const runText = result.run ? `；立即运行${result.run.success ? "已通知" : "通知失败"}` : "";
    addMessage("assistant", `任务已创建：${task.taskname}${runText}`);
  } else {
    addMessage("assistant", `创建失败：${result.message || "QAS 没有返回明确原因"}`);
  }
});

els.refreshTasks.addEventListener("click", loadTasks);
els.applyRename.addEventListener("click", () => {
  applyRenameRule();
  previewShare();
});
els.previewShare.addEventListener("click", previewShare);
els.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" }, false);
  showLogin();
});

async function boot() {
  const session = await api("/api/session", { method: "GET" }, false);
  if (session.success && session.data.authenticated) {
    await enterApp();
    return;
  }
  showLogin(session.success && session.data.passwordEnabled);
}

async function enterApp() {
  document.body.className = "auth-ready";
  const config = await api("/api/config", { method: "GET" });
  if (config.success) {
    state.defaultSaveRoot = config.data.defaultSaveRoot || state.defaultSaveRoot;
  }
  await checkHealth();
}

function showLogin(passwordEnabled = true) {
  document.body.className = passwordEnabled ? "auth-required" : "auth-ready";
  if (passwordEnabled) {
    els.loginPassword.focus();
  } else {
    enterApp();
  }
}

async function checkHealth() {
  const result = await api("/api/health", { method: "GET" });
  els.status.textContent = result.success ? `QAS ${result.data.taskCount} 任务` : "未连接";
  els.status.className = result.success ? "status ok" : "status bad";
  if (!result.success) addMessage("system", result.message || "QAS 连接失败，请检查配置。");
}

function handleChatResponse(data) {
  if (!data.success) {
    addMessage("assistant", data.message || "处理失败");
    return;
  }
  addMessage("assistant", data.message);
  if (data.type === "search") renderCandidates(data.candidates || []);
  if (data.type === "draft") fillTask(data.draft);
  if (data.type === "tasks") renderTasks(data.tasks || []);
}

async function loadTasks() {
  addMessage("user", "任务列表");
  const data = await api("/api/qas/tasks", { method: "GET" });
  if (!data.success) {
    addMessage("assistant", data.message || "获取任务失败");
    return;
  }
  addMessage("assistant", data.data.length ? `当前有 ${data.data.length} 个任务。` : "当前还没有任务。");
  renderTasks(data.data);
}

function renderCandidates(candidates) {
  state.candidates = candidates;
  state.candidatePage = 1;
  renderCandidatePage();
}

function renderCandidatePage() {
  const candidates = state.candidates;
  if (!candidates.length) {
    els.results.innerHTML = '<p class="empty">没有候选资源。</p>';
    return;
  }
  const totalPages = Math.max(1, Math.ceil(candidates.length / state.candidatePageSize));
  state.candidatePage = Math.min(Math.max(1, state.candidatePage), totalPages);
  const start = (state.candidatePage - 1) * state.candidatePageSize;
  const pageItems = candidates.slice(start, start + state.candidatePageSize);

  els.results.innerHTML = "";
  pageItems.forEach((item, pageIndex) => {
    const index = start + pageIndex;
    const card = document.createElement("article");
    card.className = "candidate";
    card.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.source || "未知来源")} · 已验证${Number.isFinite(item.detailCount) ? ` · ${escapeHtml(item.detailCount)} 项` : ""}</p>
      <p>${escapeHtml(item.shareurl)}</p>
      <button type="button">填入任务</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      const saveName = cleanPathName(item.title);
      fillTask({
        taskname: item.title,
        shareurl: item.shareurl,
        savepath: `${state.defaultSaveRoot}/${saveName}`,
        pattern: "$TV",
        replace: ""
      });
      els.renamePrefix.value = item.title.replace(/\s*(4K|1080P|2160P|臻彩).*$/i, "").trim();
      addMessage("assistant", `已填入第 ${index + 1} 个候选资源。`);
      loadSharePreview({ name: "顶层", shareUrl: item.shareurl, mode: "reset" });
    });
    els.results.append(card);
  });

  const pager = document.createElement("div");
  pager.className = "pager";
  pager.innerHTML = `
    <button type="button" ${state.candidatePage <= 1 ? "disabled" : ""}>上一页</button>
    <span>${state.candidatePage} / ${totalPages}，共 ${candidates.length} 个</span>
    <button type="button" ${state.candidatePage >= totalPages ? "disabled" : ""}>下一页</button>
  `;
  const [prev, next] = pager.querySelectorAll("button");
  prev.addEventListener("click", () => {
    state.candidatePage -= 1;
    renderCandidatePage();
  });
  next.addEventListener("click", () => {
    state.candidatePage += 1;
    renderCandidatePage();
  });
  els.results.append(pager);
}

function renderTasks(tasks) {
  if (!tasks.length) {
    els.results.innerHTML = '<p class="empty">暂无任务。</p>';
    return;
  }
  els.results.innerHTML = "";
  tasks.forEach((task) => {
    const row = document.createElement("article");
    row.className = "task-row";
    row.innerHTML = `
      <h3>${escapeHtml(task.taskname || "未命名任务")}</h3>
      <p>${escapeHtml(task.savepath || "")}</p>
      <p>${escapeHtml(task.shareurl || "")}</p>
    `;
    els.results.append(row);
  });
}

function fillTask(task) {
  els.taskname.value = task.taskname || "";
  els.shareurl.value = task.shareurl || "";
  els.savepath.value = task.savepath || "";
  els.pattern.value = task.pattern || "$TV";
  els.replace.value = task.replace || "";
  if (!els.renamePrefix.value && task.taskname) els.renamePrefix.value = task.taskname;
}

function taskFromForm() {
  return {
    taskname: els.taskname.value.trim(),
    shareurl: els.shareurl.value.trim(),
    savepath: els.savepath.value.trim(),
    pattern: els.pattern.value.trim(),
    replace: els.replace.value.trim()
  };
}

function applyRenameRule() {
  const prefix = els.renamePrefix.value.trim() || els.taskname.value.trim() || "剧名";

  els.pattern.value = ".*?(?:S\\d{1,2}E|EP|第)?0*(\\d{1,4})(?:集|话)?.*?\\.(mp4|mkv|avi|mov|wmv|flv|ts|m2ts)$";
  els.replace.value = `${prefix}\\1.\\2`;
  addMessage("assistant", "已生成 QAS 正则命名规则：会读取原文件名里的集数。位数设置只用于页面预览，QAS 实际改名按替换规则执行。");
}

async function previewShare() {
  const current = state.previewPath[state.previewPath.length - 1];
  const task = taskFromForm();
  const root = state.previewPath[0];
  if (!root || shareBase(root.shareUrl) !== shareBase(task.shareurl)) {
    return loadSharePreview({ name: "顶层", shareUrl: task.shareurl, mode: "reset" });
  }
  return loadSharePreview({
    name: current?.name || "顶层",
    shareUrl: current?.shareUrl || task.shareurl,
    mode: current ? "refresh" : "reset"
  });
}

async function loadSharePreview({ name = "顶层", shareUrl, mode = "reset" }) {
  const task = taskFromForm();
  const targetShareUrl = shareUrl || task.shareurl;
  if (!targetShareUrl) {
    addMessage("assistant", "先填入夸克分享链接，再预览文件。");
    return;
  }

  els.previewCount.textContent = "读取中";
  els.previewList.innerHTML = '<p class="empty">正在读取分享文件...</p>';
  renderBreadcrumb();

  if (mode === "push") {
    state.previewPath.push({ name, shareUrl: targetShareUrl });
  } else if (mode === "reset") {
    state.previewPath = [{ name, shareUrl: targetShareUrl }];
  } else if (!state.previewPath.length) {
    state.previewPath = [{ name, shareUrl: targetShareUrl }];
  }
  renderBreadcrumb();

  const result = await api("/api/share-detail", {
    method: "POST",
    body: JSON.stringify({ shareurl: targetShareUrl, task })
  });

  if (!result.success) {
    els.previewCount.textContent = "失败";
    els.previewList.innerHTML = `<p class="empty">${escapeHtml(result.message || "预览失败")}</p>`;
    renderBreadcrumb();
    addMessage("assistant", result.message || "预览失败");
    return;
  }

  const files = buildRenamePreview(result.data || []);
  state.lastPreviewFiles = files;
  renderPreview(files);
}

function buildRenamePreview(files) {
  const prefix = els.renamePrefix.value.trim();
  const start = Math.max(0, Number(els.renameStart.value || 1));
  const pad = Math.max(1, Number(els.renamePad.value || 3));
  const sorted = [...files].sort((a, b) => {
    const ea = episodeNumber(a.name);
    const eb = episodeNumber(b.name);
    if (ea !== eb) return ea - eb;
    return a.name.localeCompare(b.name, "zh-CN");
  });

  return sorted.map((file, index) => {
    const ext = extensionOf(file.name);
    const episode = episodeNumber(file.name);
    const number = episode === 99999 ? start + index : episode;
    const generated = file.isDir
      ? file.name
      : prefix
      ? `${prefix}${String(number).padStart(pad, "0")}${ext}`
      : file.renamed || file.name;
    return {
      ...file,
      episode: number,
      previewName: generated
    };
  });
}

function renderPreview(files) {
  const stats = previewStats(files);
  els.previewCount.textContent = `${files.length} 个文件`;
  if (!files.length) {
    els.previewList.innerHTML = '<p class="empty">没有读到文件。</p>';
    renderBreadcrumb();
    return;
  }
  els.previewList.innerHTML = "";
  const summary = document.createElement("section");
  summary.className = "preview-summary";
  summary.innerHTML = `
    <div>
      <span>总大小</span>
      <strong>${escapeHtml(formatSize(stats.totalSize))}</strong>
    </div>
    <div>
      <span>视频</span>
      <strong>${escapeHtml(stats.videoCount)}</strong>
    </div>
    <div>
      <span>平均</span>
      <strong>${escapeHtml(formatSize(stats.averageVideoSize))}</strong>
    </div>
  `;
  els.previewList.append(summary);
  if (state.previewPath.length > 1) {
    const back = document.createElement("button");
    back.className = "preview-back";
    back.type = "button";
    back.textContent = "返回上层目录";
    back.addEventListener("click", () => {
      state.previewPath.pop();
      const parent = state.previewPath[state.previewPath.length - 1];
      loadSharePreview({ ...parent, mode: "refresh" });
    });
    els.previewList.append(back);
  }
  files.forEach((file) => {
    const row = document.createElement("article");
    row.className = `preview-row${file.isDir ? " is-dir" : ""}`;
    row.innerHTML = `
      <div class="file-main">
        <p class="from">${escapeHtml(file.isDir ? `目录：${file.name}` : file.name)}${file.isDir && file.size ? `（${escapeHtml(file.size)} 项）` : ""}</p>
        <p class="to">${escapeHtml(file.isDir ? "进入目录查看文件" : file.previewName || file.renamed || file.name)}</p>
      </div>
      <div class="file-meta">
        ${file.isDir ? '<span class="pill blue">目录</span>' : `<span class="pill blue">第 ${escapeHtml(file.episode)} 集</span>`}
        ${file.isDir ? "" : `<span class="pill green">${escapeHtml(formatSize(file.size))}</span>`}
      </div>
      ${file.isDir ? '<button class="enter-dir" type="button">进入目录</button>' : ""}
    `;
    if (file.isDir && file.childShareUrl) {
      const openDir = () => loadSharePreview({ name: file.name, shareUrl: file.childShareUrl, mode: "push" });
      row.tabIndex = 0;
      row.addEventListener("click", openDir);
      row.querySelector(".enter-dir")?.addEventListener("click", (event) => {
        event.stopPropagation();
        openDir();
      });
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDir();
        }
      });
    }
    els.previewList.append(row);
  });
  renderBreadcrumb();
}

function previewStats(files) {
  const videoFiles = files.filter((file) => !file.isDir && isVideoFile(file.name));
  const totalSize = files.reduce((sum, file) => sum + numericSize(file.size), 0);
  const videoSize = videoFiles.reduce((sum, file) => sum + numericSize(file.size), 0);
  return {
    totalSize,
    videoCount: videoFiles.length,
    averageVideoSize: videoFiles.length ? videoSize / videoFiles.length : 0
  };
}

function numericSize(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatSize(value) {
  const bytes = numericSize(value);
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit < 2 ? size.toFixed(0) : size.toFixed(2)} ${units[unit]}`;
}

function isVideoFile(name) {
  return /\.(mp4|mkv|avi|mov|wmv|flv|ts|m2ts)$/i.test(String(name || ""));
}

function renderBreadcrumb() {
  if (!els.breadcrumb) return;
  if (!state.previewPath.length) {
    els.breadcrumb.innerHTML = "<span>未选择资源</span>";
    return;
  }
  els.breadcrumb.innerHTML = "";
  state.previewPath.forEach((part, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = part.name || "目录";
    button.disabled = index === state.previewPath.length - 1;
    button.addEventListener("click", () => {
      state.previewPath = state.previewPath.slice(0, index + 1);
      loadSharePreview({ ...state.previewPath[index], mode: "refresh" });
    });
    els.breadcrumb.append(button);
    if (index < state.previewPath.length - 1) {
      const separator = document.createElement("span");
      separator.textContent = "/";
      els.breadcrumb.append(separator);
    }
  });
}

function episodeNumber(name) {
  const text = String(name || "").replace(/\.[A-Za-z0-9]{2,5}$/, "");
  const leading = text.match(/^\s*0*(\d{1,4})(?=\D|$)/);
  if (leading) return Number(leading[1]);

  const patterns = [
    /S\d{1,2}E(\d{1,4})/i,
    /^S0*(\d{1,4})(?=\D|$)/i,
    /(?:EP|E)(\d{1,4})/i,
    /第\s*(\d{1,4})\s*[集话]/,
    /(?:^|[^\d])0*(\d{1,4})(?=\D*$)/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return 99999;
}

function extensionOf(name) {
  const match = String(name || "").match(/(\.[A-Za-z0-9]{2,5})$/);
  return match ? match[1] : "";
}

function shareBase(value) {
  return String(value || "").split("#")[0];
}

async function api(path, options = {}, retryPassword = true) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch (error) {
    return { success: false, message: `网络请求失败：${error.message}` };
  }
  if (response.status === 401 && retryPassword) {
    showLogin();
    return { success: false, message: "登录已过期，请重新登录。" };
  }
  if (response.status === 401) {
    return { success: false, message: "网页访问密码不正确，请刷新后重新输入。" };
  }
  try {
    return await response.json();
  } catch {
    return { success: false, message: `服务返回了不可解析的响应：HTTP ${response.status}` };
  }
}

function confirmTask(task) {
  const missing = [];
  if (!task.taskname) missing.push("任务名");
  if (!task.shareurl) missing.push("分享链接");
  if (!task.savepath) missing.push("保存目录");
  if (missing.length) {
    addMessage("assistant", `请先补全：${missing.join("、")}。`);
    return false;
  }

  const preview = state.lastPreviewFiles
    .filter((file) => !file.isDir)
    .slice(0, 3)
    .map((file) => `- ${file.name} -> ${file.previewName || file.renamed || file.name}`)
    .join("\n");
  const lines = [
    `确认创建 QAS 任务？`,
    ``,
    `任务名：${task.taskname}`,
    `保存目录：${task.savepath}`,
    `立即运行：${els.runNow.checked ? "是" : "否"}`,
    preview ? `预览示例：\n${preview}` : `尚未读取文件预览。`
  ];
  return window.confirm(lines.join("\n"));
}

function addMessage(role, text) {
  const item = document.createElement("article");
  item.className = `message ${role}`;
  item.innerHTML = `<p>${escapeHtml(text)}</p>`;
  els.messages.append(item);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function cleanPathName(value) {
  return String(value || "未命名").replace(/[\\:*?"<>|]/g, "").trim() || "未命名";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
