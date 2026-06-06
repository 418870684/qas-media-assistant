const state = {
  defaultSaveRoot: "/影视",
  candidates: [],
  candidatePage: 1,
  candidatePageSize: 5,
  currentView: "search",
  renameMode: "tv",
  renamePrefixTouched: false,
  qasTasks: [],
  previewPath: [],
  lastPreviewRawFiles: [],
  lastPreviewFiles: [],
  aiConfig: { enabled: false, configured: false, confidenceThreshold: 0.75 },
  aiByName: new Map(),
  aiMediaType: "",
  suffixConfig: { systemDisabled: [], user: [] },
  suffixDecisions: new Map()
};

const SYSTEM_VERSION_SUFFIXES = ["完整版", "会员版", "高码率", "杜比", "HDR", "4K"];

const els = {
  status: document.querySelector("#status"),
  viewTabs: document.querySelector("#viewTabs"),
  viewPanels: document.querySelectorAll("[data-view-panel]"),
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
  renameModeSwitch: document.querySelector("#renameModeSwitch"),
  aiEnabled: document.querySelector("#aiEnabled"),
  aiBaseUrl: document.querySelector("#aiBaseUrl"),
  aiModel: document.querySelector("#aiModel"),
  aiApiKey: document.querySelector("#aiApiKey"),
  aiConfidenceThreshold: document.querySelector("#aiConfidenceThreshold"),
  aiStatus: document.querySelector("#aiStatus"),
  saveAiConfig: document.querySelector("#saveAiConfig"),
  testAiConfig: document.querySelector("#testAiConfig"),
  renameStart: document.querySelector("#renameStart"),
  renamePad: document.querySelector("#renamePad"),
  applyRename: document.querySelector("#applyRename"),
  createAllDirs: document.querySelector("#createAllDirs"),
  cleanupMatchingTasks: document.querySelector("#cleanupMatchingTasks"),
  cleanupBeforeCreate: document.querySelector("#cleanupBeforeCreate"),
  previewShare: document.querySelector("#previewShare"),
  reviewWithAi: document.querySelector("#reviewWithAi"),
  manageSuffixes: document.querySelector("#manageSuffixes"),
  previewList: document.querySelector("#previewList"),
  previewCount: document.querySelector("#previewCount"),
  breadcrumb: document.querySelector("#breadcrumb"),
  loginShell: document.querySelector("#loginShell"),
  loginForm: document.querySelector("#loginForm"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  logoutButton: document.querySelector("#logoutButton"),
  reloadQasTasks: document.querySelector("#reloadQasTasks"),
  taskFilter: document.querySelector("#taskFilter"),
  filterCurrentTask: document.querySelector("#filterCurrentTask"),
  clearTaskFilter: document.querySelector("#clearTaskFilter"),
  qasTaskList: document.querySelector("#qasTaskList")
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
    switchView("tasks");
    els.taskFilter.value = task.taskname;
    await loadTasks({ silent: true });
  } else {
    addMessage("assistant", `创建失败：${result.message || "QAS 没有返回明确原因"}`);
  }
});

els.viewTabs.addEventListener("click", (event) => {
  const view = event.target.dataset.view;
  if (!view) return;
  switchView(view);
  if (view === "tasks" && !state.qasTasks.length) loadTasks({ silent: true });
});
els.refreshTasks.addEventListener("click", () => {
  switchView("tasks");
  loadTasks();
});
els.applyRename.addEventListener("click", () => {
  applyRenameRule();
  previewShare();
});
els.previewShare.addEventListener("click", previewShare);
els.reviewWithAi.addEventListener("click", reviewCurrentPreviewWithAi);
els.manageSuffixes.addEventListener("click", openSuffixManager);
els.createAllDirs.addEventListener("click", createAllDirectoryTasks);
els.cleanupMatchingTasks.addEventListener("click", cleanupCurrentTaskFamily);
els.renameModeSwitch.addEventListener("click", (event) => {
  const mode = event.target.dataset.renameMode;
  if (!mode) return;
  setRenameMode(mode);
});
els.saveAiConfig.addEventListener("click", saveAiConfig);
els.testAiConfig.addEventListener("click", testAiConfig);
els.aiEnabled.addEventListener("change", () => {
  state.aiConfig.enabled = els.aiEnabled.checked;
  updateAiStatus();
  rerenderCurrentPreview();
});
els.renamePrefix.addEventListener("input", () => {
  state.renamePrefixTouched = true;
  rerenderCurrentPreview();
});
els.taskname.addEventListener("input", () => {
  syncAutoRenamePrefix();
});
els.renameStart.addEventListener("input", rerenderCurrentPreview);
els.renamePad.addEventListener("input", rerenderCurrentPreview);
els.reloadQasTasks.addEventListener("click", () => loadTasks({ silent: true }));
els.filterCurrentTask.addEventListener("click", () => {
  els.taskFilter.value = taskFromForm().taskname;
  renderQasTasks();
});
els.clearTaskFilter.addEventListener("click", () => {
  els.taskFilter.value = "";
  renderQasTasks();
});
els.taskFilter.addEventListener("input", renderQasTasks);
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
  switchView("search");
  const config = await api("/api/config", { method: "GET" });
  if (config.success) {
    state.defaultSaveRoot = config.data.defaultSaveRoot || state.defaultSaveRoot;
    applyAiConfig(config.data.ai || {});
    applySuffixConfig(config.data.suffixes || {});
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

function switchView(view) {
  state.currentView = view;
  els.viewTabs.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  els.viewPanels.forEach((panel) => {
    panel.classList.toggle("active-view", panel.dataset.viewPanel === view);
  });
  if (typeof window.scrollTo === "function") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function setRenameMode(mode, { rerender = true } = {}) {
  state.renameMode = mode;
  els.renameModeSwitch.querySelectorAll("[data-rename-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.renameMode === mode);
  });
  if (rerender) rerenderCurrentPreview();
}

function applyAiConfig(config) {
  state.aiConfig = {
    enabled: Boolean(config.enabled),
    configured: Boolean(config.configured),
    hasApiKey: Boolean(config.hasApiKey),
    baseUrl: config.baseUrl || "",
    model: config.model || "",
    source: config.source || "saved",
    editable: config.editable !== false,
    confidenceThreshold: Number(config.confidenceThreshold || 0.75),
    timeoutMs: Number(config.timeoutMs || 20000)
  };
  els.aiEnabled.checked = state.aiConfig.enabled;
  els.aiBaseUrl.value = state.aiConfig.baseUrl;
  els.aiModel.value = state.aiConfig.model;
  els.aiApiKey.value = "";
  els.aiConfidenceThreshold.value = state.aiConfig.confidenceThreshold;
  applyAiEditMode();
  updateAiStatus();
}

function applySuffixConfig(config = {}) {
  state.suffixConfig = {
    systemDisabled: Array.isArray(config.systemDisabled) ? config.systemDisabled : [],
    user: Array.isArray(config.user) ? config.user : []
  };
}

function applyAiEditMode() {
  const editable = state.aiConfig.editable !== false;
  [els.aiEnabled, els.aiBaseUrl, els.aiModel, els.aiApiKey, els.aiConfidenceThreshold].forEach((input) => {
    input.disabled = !editable;
  });
  els.saveAiConfig.disabled = !editable;
  els.saveAiConfig.textContent = editable ? "保存 AI 配置" : "ENV 管理";
  els.aiApiKey.placeholder = editable ? "留空则沿用已保存 Key" : "由 .env 提供，不在网页显示";
}

function aiConfigFromForm() {
  return {
    enabled: els.aiEnabled.checked,
    baseUrl: els.aiBaseUrl.value.trim(),
    model: els.aiModel.value.trim(),
    apiKey: els.aiApiKey.value.trim(),
    confidenceThreshold: Number(els.aiConfidenceThreshold.value || 0.75),
    timeoutMs: state.aiConfig.timeoutMs || 20000
  };
}

async function saveAiConfig() {
  if (state.aiConfig.editable === false) {
    updateAiStatus("由 .env 管理", "ok");
    addMessage("assistant", "AI 配置由 .env 管理，请修改 .env 后重启服务。");
    return;
  }
  els.saveAiConfig.disabled = true;
  els.saveAiConfig.textContent = "保存中";
  const result = await api("/api/ai/config", {
    method: "POST",
    body: JSON.stringify(aiConfigFromForm())
  });
  els.saveAiConfig.disabled = false;
  els.saveAiConfig.textContent = "保存 AI 配置";
  if (result.success) {
    applyAiConfig(result.data);
    addMessage("assistant", "AI 配置已保存。");
  } else {
    updateAiStatus(result.message || "保存失败", "bad");
    addMessage("assistant", `AI 配置保存失败：${result.message || "未知错误"}`);
  }
}

async function testAiConfig() {
  els.testAiConfig.disabled = true;
  els.testAiConfig.textContent = "测试中";
  updateAiStatus("测试中");
  const result = await api("/api/ai/test", {
    method: "POST",
    body: JSON.stringify(aiConfigFromForm())
  }, false);
  els.testAiConfig.disabled = false;
  els.testAiConfig.textContent = "测试连接";
  updateAiStatus(result.message || (result.success ? "连接成功" : "连接失败"), result.success ? "ok" : "bad");
  addMessage("assistant", result.success ? "AI 模型连接成功。" : `AI 模型连接失败：${result.message || "未知错误"}`);
}

function updateAiStatus(text = "", tone = "") {
  const source = state.aiConfig.source === "env" ? "ENV" : "网页";
  const status = text || (
    state.aiConfig.enabled
      ? state.aiConfig.configured
        ? `${source} 已配置 ${state.aiConfig.model || ""}`.trim()
        : "已开启，未配置"
      : "未开启"
  );
  els.aiStatus.textContent = status;
  els.aiStatus.className = tone || (state.aiConfig.enabled && state.aiConfig.configured ? "ok" : "");
}

function handleChatResponse(data) {
  if (!data.success) {
    addMessage("assistant", data.message || "处理失败");
    return;
  }
  addMessage("assistant", data.message);
  if (data.type === "search") {
    switchView("search");
    renderCandidates(data.candidates || []);
  }
  if (data.type === "draft") {
    fillTask(data.draft);
    switchView("preview");
    loadSharePreview({ name: "顶层", shareUrl: data.draft.shareurl, mode: "reset" });
  }
  if (data.type === "tasks") {
    state.qasTasks = data.tasks || [];
    switchView("tasks");
    renderQasTasks();
  }
}

async function loadTasks({ silent = false, filterCurrent = false } = {}) {
  if (!silent) addMessage("user", "任务列表");
  const data = await api("/api/qas/tasks", { method: "GET" });
  if (!data.success) {
    addMessage("assistant", data.message || "获取任务失败");
    return;
  }
  state.qasTasks = data.data || [];
  if (filterCurrent) els.taskFilter.value = taskFromForm().taskname;
  if (!silent) addMessage("assistant", state.qasTasks.length ? `当前有 ${state.qasTasks.length} 个任务。` : "当前还没有任务。");
  renderQasTasks();
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
      <p>${escapeHtml(item.source || "未知来源")}${item.displayTime || item.timeText ? ` · ${escapeHtml(item.displayTime || item.timeText)}` : ""} · 已验证${Number.isFinite(item.detailCount) ? ` · ${escapeHtml(item.detailCount)} 项` : ""}</p>
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
      addMessage("assistant", `已填入第 ${index + 1} 个候选资源。`);
      switchView("preview");
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
  state.qasTasks = tasks || [];
  renderQasTasks();
}

function renderQasTasks() {
  const keyword = els.taskFilter.value.trim();
  const tasks = keyword
    ? state.qasTasks.filter((task) => {
        const text = [task.taskname, task.savepath, task.shareurl].join(" ");
        return text.includes(keyword);
      })
    : state.qasTasks;

  if (!tasks.length) {
    els.qasTaskList.innerHTML = `<p class="empty">${keyword ? "没有匹配的 QAS 任务。" : "暂无任务。"}</p>`;
    return;
  }
  els.qasTaskList.innerHTML = "";
  tasks.forEach((task) => {
    const row = document.createElement("article");
    row.className = "task-row";
    row.innerHTML = `
      <h3>${escapeHtml(task.taskname || "未命名任务")}</h3>
      <p>${escapeHtml(task.savepath || "")}</p>
      <p>${escapeHtml(task.shareurl || "")}</p>
    `;
    els.qasTaskList.append(row);
  });
}

function fillTask(task) {
  els.taskname.value = task.taskname || "";
  els.shareurl.value = task.shareurl || "";
  els.savepath.value = task.savepath || "";
  els.pattern.value = task.pattern || "$TV";
  els.replace.value = task.replace || "";
  if (task.taskname) {
    state.renamePrefixTouched = false;
    syncAutoRenamePrefix(true);
  }
}

function syncAutoRenamePrefix(force = false) {
  if (state.renamePrefixTouched && !force) return;
  els.renamePrefix.value = deriveRenamePrefix(els.taskname.value);
  rerenderCurrentPreview();
}

function deriveRenamePrefix(taskname) {
  return String(taskname || "")
    .replace(/[【\[]\s*更新至?\s*\d+\s*集?\s*[】\]]/gi, "")
    .replace(/[【\[]\s*\d+\s*集全?\s*[】\]]/gi, "")
    .replace(/\s*(4K|2160P|1080P|720P|高码|高码率|中字|国语|粤语|杜比|HDR|WEB-?DL|BluRay).*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[：:]\s*$/, "")
    .trim();
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

  if (state.renameMode === "variety") {
    els.pattern.value = ".*?(第\\s*\\d{1,4}\\s*期(?:上|中|下)?|加更|纯享|特别篇|番外|先导片).*?\\.(mp4|mkv|avi|mov|wmv|flv|ts|m2ts)$";
    els.replace.value = `${prefix}\\1.\\2`;
  } else {
    els.pattern.value = ".*?(?:S\\d{1,2}E|EP|第)?0*(\\d{1,4})(?:集|话)?.*?\\.(mp4|mkv|avi|mov|wmv|flv|ts|m2ts)$";
    els.replace.value = `${prefix}\\1.\\2`;
  }
  addMessage("assistant", "已按当前命名模式生成 QAS 正则规则。文件级创建时会优先使用每个文件的精确匹配规则。");
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
    state.suffixDecisions = new Map();
  } else if (!state.previewPath.length) {
    state.previewPath = [{ name, shareUrl: targetShareUrl }];
  }
  syncTaskShareUrlToPreview();
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

  state.lastPreviewRawFiles = result.data || [];
  state.aiByName = new Map();
  state.aiMediaType = "";
  const files = buildRenamePreview(state.lastPreviewRawFiles);
  state.lastPreviewFiles = files;
  renderPreview(files);
  switchView("preview");
  updateAiStatus(state.aiConfig.enabled && state.aiConfig.configured ? "本地预览，按需 AI 检查" : "");
}

function buildRenamePreview(files, aiByName = state.aiByName) {
  const prefix = els.renamePrefix.value.trim();
  const start = Math.max(0, Number(els.renameStart.value || 1));
  const pad = Math.max(1, Number(els.renamePad.value || 3));
  const sorted = [...files].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    const ea = analyzeFileName(cleanRecognitionName(a.name), state.renameMode, 99999);
    const eb = analyzeFileName(cleanRecognitionName(b.name), state.renameMode, 99999);
    if (ea.sortNumber !== eb.sortNumber) return ea.sortNumber - eb.sortNumber;
    return a.name.localeCompare(b.name, "zh-CN");
  });

  let nextFallbackNumber = start;
  const previewFiles = sorted.map((file, index) => {
    const ext = extensionOf(file.name);
    const fileId = fileIdentity(file, index);
    const fallbackNumber = nextFallbackNumber;
    const cleanName = cleanRecognitionName(file.name);
    const localAnalysis = analyzeFileName(cleanName, state.renameMode, fallbackNumber);
    const aiItem = state.aiConfig.enabled ? findAiItem(aiByName, file, index) : null;
    const aiFileType = aiItem ? normalizeAiFileType(aiItem.fileType || aiItem.contentType || aiItem.special || "") : "";
    const mergedAnalysis = aiItem ? mergeAiAnalysis(localAnalysis, aiItem) : localAnalysis;
    const analysis = applySuffixDecision(mergedAnalysis, fileId);
    if (!file.isDir && isVideoFile(file.name) && analysis.countsAsEpisode !== false) {
      nextFallbackNumber += 1;
    }
    const generated = file.isDir
      ? file.name
      : prefix
      ? buildPreviewName(prefix, ext, analysis, pad, cleanName)
      : file.renamed || file.name;
    return {
      ...file,
      fileId,
      analysis,
      episode: analysis.number,
      episodeLabel: analysis.label,
      fileType: analysis.fileType || "main",
      localFileType: localAnalysis.fileType || "main",
      aiFileType,
      cleanName,
      aiMediaType: aiItem?.mediaType || "",
      aiConfidence: aiItem ? aiItem.confidence : null,
      aiReason: aiItem?.reason || "",
      aiSuggestion: aiItem ? aiSuggestionText(aiFileType, aiItem) : "",
      unknownSuffixes: analysis.unknownSuffixes || [],
      needsConfirm: analysis.confidence !== "high" || Boolean(analysis.unknownSuffixes?.length),
      previewName: generated
    };
  });
  return markPreviewConflicts(previewFiles);
}

function fileIdentity(file, index = 0) {
  return String(file?.fileId || file?.fid || `${index}:${file?.name || ""}`);
}

function findAiItem(aiByName, file, index = 0) {
  if (!aiByName || typeof aiByName.get !== "function") return null;
  const fileId = fileIdentity(file, index);
  return aiByName.get(fileId) || aiByName.get(file?.name) || null;
}

function suffixDecision(fileId) {
  if (!state.suffixDecisions.has(fileId)) {
    state.suffixDecisions.set(fileId, { keep: [], ignore: [] });
  }
  return state.suffixDecisions.get(fileId);
}

function applySuffixDecision(analysis, fileId) {
  if (!analysis || analysis.mode !== "variety" || analysis.countsAsEpisode === false) return analysis;
  const decision = suffixDecision(fileId);
  const ignored = new Set(decision.ignore || []);
  const kept = new Set(decision.keep || []);
  const unknownSuffixes = (analysis.unknownSuffixes || []).filter((item) => !ignored.has(item) && !kept.has(item));
  const versionTag = mergeTags(analysis.versionTag, [...kept].join("-"));
  const confidence = unknownSuffixes.length ? "low" : analysis.confidence;
  return {
    ...analysis,
    versionTag,
    unknownSuffixes,
    confidence
  };
}

function markPreviewConflicts(files) {
  const counts = new Map();
  (files || []).forEach((file) => {
    if (file.isDir || !file.previewName) return;
    const key = file.previewName.trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return (files || []).map((file) => {
    if (file.isDir || !file.previewName || (counts.get(file.previewName.trim()) || 0) < 2) return file;
    return {
      ...file,
      hasConflict: true,
      needsConfirm: true,
      conflictMessage: "命名冲突"
    };
  });
}

function rerenderCurrentPreview() {
  if (!state.lastPreviewRawFiles.length) return;
  const files = buildRenamePreview(state.lastPreviewRawFiles);
  state.lastPreviewFiles = files;
  renderPreview(files);
}

async function applyAiRenamePreview(rawFiles) {
  if (!state.aiConfig.enabled || !state.aiConfig.configured) return;
  const videos = (rawFiles || []).filter((file) => !file.isDir && isVideoFile(file.name));
  if (!videos.length) return;
  updateAiStatus("AI 判断中");
  const result = await fetchAiRenameItems(rawFiles);
  if (!result.success) {
    const reason = result.message || "未知错误";
    updateAiStatus(`AI 失败：${reason}`.slice(0, 80), "bad");
    addMessage("assistant", `AI 判断失败，已保留本地规则：${reason}`);
    return;
  }
  state.aiByName = result.itemsByName;
  state.aiMediaType = result.mediaType || "";
  if (state.aiMediaType === "tv" || state.aiMediaType === "variety") {
    setRenameMode(state.aiMediaType, { rerender: false });
  }
  updateAiStatus(`AI 已判断 ${result.itemsByName.size} 个文件`, "ok");
  rerenderCurrentPreview();
}

async function reviewCurrentPreviewWithAi() {
  if (!state.lastPreviewRawFiles.length) {
    addMessage("assistant", "请先预览文件，再让 AI 检查。");
    return;
  }
  if (!state.aiConfig.enabled || !state.aiConfig.configured) {
    updateAiStatus("AI 未启用或未配置", "bad");
    addMessage("assistant", "AI 未启用或未配置，当前只能使用本地规则。");
    return;
  }
  els.reviewWithAi.disabled = true;
  els.reviewWithAi.textContent = "AI 检查中";
  await applyAiRenamePreview(state.lastPreviewRawFiles);
  els.reviewWithAi.disabled = false;
  els.reviewWithAi.textContent = "AI 检查预览";
}

async function fetchAiRenameItems(rawFiles) {
  if (!state.aiConfig.enabled || !state.aiConfig.configured) {
    return { success: false, message: "AI 未启用", itemsByName: new Map() };
  }
  const localFiles = buildRenamePreview(rawFiles || [], new Map());
  const response = await api("/api/ai/rename-preview", {
    method: "POST",
    body: JSON.stringify({
      taskname: els.taskname.value.trim(),
      prefix: els.renamePrefix.value.trim(),
      mode: state.renameMode,
      confidenceThreshold: Number(els.aiConfidenceThreshold.value || 0.75),
      files: localFiles
    })
  }, false);
  if (!response.success) return response;
  const itemsByName = new Map();
  (response.data?.items || []).forEach((item) => {
    itemsByName.set(item.fileId || item.originalName, item);
  });
  return {
    success: true,
    message: response.message,
    mediaType: response.data?.mediaType || "",
    itemsByName
  };
}

function mergeAiAnalysis(localAnalysis, aiItem) {
  const fileType = normalizeAiFileType(aiItem.fileType || aiItem.contentType || aiItem.special || localAnalysis.fileType);
  const protectedLocalMain = localAnalysis.fileType === "main" && localAnalysis.confidence === "high";
  const protectedLocalSpecial = localAnalysis.countsAsEpisode === false && localAnalysis.fileType && localAnalysis.fileType !== "unknown";
  if (protectedLocalSpecial || (protectedLocalMain && fileType !== "main")) {
    return {
      ...localAnalysis,
      mode: aiItem.mediaType || localAnalysis.mode,
      confidence: aiItem.needsConfirm ? "low" : localAnalysis.confidence
    };
  }
  if (fileType !== "main") {
    const label = aiTypeLabel(fileType) || aiItem.episodeLabel || localAnalysis.label || "待确认";
    return {
      ...localAnalysis,
      mode: aiItem.mediaType || localAnalysis.mode,
      fileType,
      confidence: aiItem.needsConfirm || fileType === "unknown" ? "low" : "high",
      number: null,
      sortNumber: aiTypeSort(fileType),
      label,
      title: aiItem.title || aiItem.special || localAnalysis.title || label,
      countsAsEpisode: false
    };
  }
  const localHasNumber = Number.isFinite(Number(localAnalysis.number));
  const number = localHasNumber ? localAnalysis.number : Number.isFinite(Number(aiItem.number)) ? Number(aiItem.number) : localAnalysis.number;
  const aiVersionTag = normalizeVersionTags(aiItem.versionTag || aiItem.versionTags || "");
  return {
    ...localAnalysis,
    mode: aiItem.mediaType || localAnalysis.mode,
    fileType: "main",
    confidence: aiItem.needsConfirm ? "low" : "high",
    number,
    sortNumber: number || localAnalysis.sortNumber,
    label: localAnalysis.label || aiItem.episodeLabel || `第${number}期`,
    versionTag: mergeTags(localAnalysis.versionTag, aiVersionTag),
    countsAsEpisode: true
  };
}

function normalizeAiFileType(value) {
  const text = String(value || "").toLowerCase();
  if (["main", "episode", "正片"].includes(text) || text.includes("正片")) return "main";
  if (["pure", "纯享"].includes(text) || text.includes("纯享")) return "pure";
  if (["bonus", "加更"].includes(text) || text.includes("加更")) return "bonus";
  if (["special", "特辑", "特别篇"].includes(text) || text.includes("特辑") || text.includes("特别")) return "special";
  if (["press", "发布会"].includes(text) || text.includes("发布")) return "press";
  if (["pilot", "先导片"].includes(text) || text.includes("先导")) return "pilot";
  if (["extra", "花絮", "番外", "预告", "衍生"].includes(text) || /副本解锁|解锁中|花絮|番外|预告|未播|彩蛋/.test(text)) return "extra";
  return "unknown";
}

function aiTypeLabel(type) {
  return {
    main: "正片",
    pure: "纯享",
    bonus: "加更",
    special: "特辑",
    press: "发布会",
    pilot: "先导片",
    extra: "衍生",
    unknown: "待确认"
  }[type] || "";
}

function aiSuggestionText(fileType, aiItem) {
  const label = aiTypeLabel(fileType) || "未知";
  const reason = String(aiItem?.reason || "").trim();
  const confirm = aiItem?.needsConfirm ? "待确认" : label;
  return reason ? `AI判断：${confirm}，${reason}` : `AI判断：${confirm}`;
}

function aiTypeSort(type) {
  return {
    main: 1,
    bonus: 91000,
    pure: 92000,
    special: 93000,
    press: 94000,
    pilot: 95000,
    extra: 96000,
    unknown: 99000
  }[type] || 99000;
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
      syncTaskShareUrlToPreview();
      loadSharePreview({ ...parent, mode: "refresh" });
    });
    els.previewList.append(back);
  }
  let lastGroup = "";
  files.forEach((file) => {
    const group = previewGroup(file);
    if (group !== lastGroup) {
      const heading = document.createElement("p");
      heading.className = "preview-group-title";
      heading.textContent = group;
      els.previewList.append(heading);
      lastGroup = group;
    }
    const row = document.createElement("article");
    row.className = `preview-row${file.isDir ? " is-dir" : ""}${file.hasConflict ? " has-conflict" : ""}`;
    row.innerHTML = `
      <div class="file-main">
        <p class="from">${escapeHtml(file.isDir ? `目录：${file.name}` : file.name)}${file.isDir && file.size ? `（${escapeHtml(file.size)} 项）` : ""}</p>
        ${!file.isDir && file.cleanName && file.cleanName !== file.name ? `<p class="clean">识别名：${escapeHtml(file.cleanName)}</p>` : ""}
        ${!file.isDir && file.aiSuggestion ? `<p class="ai-note">${escapeHtml(file.aiSuggestion)}</p>` : ""}
        <p class="to">${escapeHtml(file.isDir ? "进入目录查看文件" : file.previewName || file.renamed || file.name)}</p>
        ${!file.isDir && file.unknownSuffixes?.length ? renderUnknownSuffixPrompt(file) : ""}
      </div>
      <div class="file-meta">
        ${file.isDir ? '<span class="pill blue">目录</span>' : `<span class="pill blue">${escapeHtml(file.episodeLabel || `第 ${file.episode} 集`)}</span>`}
        ${!file.isDir && file.aiMediaType ? `<span class="pill gray">${escapeHtml(file.aiMediaType === "variety" ? "综艺" : file.aiMediaType === "tv" ? "电视剧" : "未知")}</span>` : ""}
        ${!file.isDir && file.aiConfidence !== null ? `<span class="pill gray">AI ${escapeHtml(Math.round(file.aiConfidence * 100))}%</span>` : ""}
        ${!file.isDir && file.hasConflict ? '<span class="pill red">命名冲突</span>' : ""}
        ${!file.isDir && file.needsConfirm ? '<span class="pill orange">待确认</span>' : ""}
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
    row.querySelectorAll("[data-suffix-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleSuffixAction(button.dataset.suffixAction, file.fileId, button.dataset.suffixValue);
      });
    });
    els.previewList.append(row);
  });
  renderBreadcrumb();
}

function renderUnknownSuffixPrompt(file) {
  const suffixes = file.unknownSuffixes || [];
  return suffixes.map((suffix) => `
    <div class="suffix-prompt">
      <strong>发现新后缀：${escapeHtml(suffix)}</strong>
      <p>不会自动写入最终文件名，先由你确认。</p>
      <div class="suffix-actions">
        <button type="button" data-suffix-action="keep" data-suffix-value="${escapeHtml(suffix)}">保留本次</button>
        <button type="button" data-suffix-action="add" data-suffix-value="${escapeHtml(suffix)}">加入常用</button>
        <button type="button" data-suffix-action="ignore" data-suffix-value="${escapeHtml(suffix)}">忽略</button>
      </div>
    </div>
  `).join("");
}

async function handleSuffixAction(action, fileId, suffix) {
  const value = cleanSuffixValue(suffix);
  if (!value || !fileId) return;
  if (action === "keep") {
    const decision = suffixDecision(fileId);
    decision.keep = Array.from(new Set([...(decision.keep || []), value]));
    decision.ignore = (decision.ignore || []).filter((item) => item !== value);
    rerenderCurrentPreview();
    return;
  }
  if (action === "ignore") {
    const decision = suffixDecision(fileId);
    decision.ignore = Array.from(new Set([...(decision.ignore || []), value]));
    decision.keep = (decision.keep || []).filter((item) => item !== value);
    rerenderCurrentPreview();
    return;
  }
  if (action === "add") {
    const result = await api("/api/suffixes", {
      method: "POST",
      body: JSON.stringify({ value })
    });
    if (result.success) {
      applySuffixConfig(result.data || {});
      addMessage("assistant", `已加入常用后缀：${value}`);
      rerenderCurrentPreview();
    } else {
      addMessage("assistant", result.message || "加入常用后缀失败");
    }
  }
}

function openSuffixManager() {
  const overlay = document.createElement("section");
  overlay.className = "task-picker-backdrop";
  overlay.innerHTML = `
    <div class="task-picker suffix-manager" role="dialog" aria-modal="true" aria-label="常用后缀管理">
      <header>
        <h2>常用后缀管理</h2>
        <button type="button" data-action="close">关闭</button>
      </header>
      <div class="suffix-add-row">
        <input data-role="new-suffix" placeholder="输入后缀，例如：臻彩版" />
        <button type="button" data-action="add-user">添加</button>
      </div>
      <div class="task-picker-list" data-role="suffix-list"></div>
      <footer>
        <small>用户添加的后缀可以删除；系统内置后缀只能关闭。</small>
        <button type="button" data-action="close">完成</button>
      </footer>
    </div>
  `;
  const list = overlay.querySelector("[data-role='suffix-list']");
  const input = overlay.querySelector("[data-role='new-suffix']");

  const render = () => {
    const disabled = new Set((state.suffixConfig.systemDisabled || []).map(cleanSuffixValue));
    list.innerHTML = `
      <p class="preview-group-title">系统内置</p>
      ${SYSTEM_VERSION_SUFFIXES.map((suffix) => `
        <div class="suffix-row">
          <div>
            <strong>${escapeHtml(suffix)}</strong>
            <small>${disabled.has(suffix) ? "已关闭" : "自动保留"}</small>
          </div>
          <button type="button" data-action="toggle-system" data-suffix-value="${escapeHtml(suffix)}">${disabled.has(suffix) ? "开启" : "关闭"}</button>
        </div>
      `).join("")}
      <p class="preview-group-title">用户添加</p>
      ${(state.suffixConfig.user || []).length ? (state.suffixConfig.user || []).map((suffix) => `
        <div class="suffix-row">
          <div>
            <strong>${escapeHtml(suffix)}</strong>
            <small>自动保留</small>
          </div>
          <button class="danger" type="button" data-action="remove-user" data-suffix-value="${escapeHtml(suffix)}">删除</button>
        </div>
      `).join("") : '<p class="picker-note">还没有用户添加的常用后缀。</p>'}
    `;
  };

  overlay.addEventListener("click", async (event) => {
    const action = event.target.dataset.action;
    if (!action) return;
    if (action === "close") {
      overlay.remove();
      return;
    }
    if (action === "add-user") {
      const value = cleanSuffixValue(input.value);
      if (!value) return;
      const result = await api("/api/suffixes", {
        method: "POST",
        body: JSON.stringify({ value })
      });
      if (result.success) {
        applySuffixConfig(result.data || {});
        input.value = "";
        render();
        rerenderCurrentPreview();
      } else {
        addMessage("assistant", result.message || "添加后缀失败");
      }
      return;
    }
    const suffix = cleanSuffixValue(event.target.dataset.suffixValue);
    if (action === "remove-user") {
      const result = await api(`/api/suffixes?value=${encodeURIComponent(suffix)}`, { method: "DELETE" });
      if (result.success) {
        applySuffixConfig(result.data || {});
        render();
        rerenderCurrentPreview();
      } else {
        addMessage("assistant", result.message || "删除后缀失败");
      }
      return;
    }
    if (action === "toggle-system") {
      const disabled = new Set((state.suffixConfig.systemDisabled || []).map(cleanSuffixValue));
      const result = await api("/api/suffixes/system", {
        method: "POST",
        body: JSON.stringify({ value: suffix, enabled: disabled.has(suffix) })
      });
      if (result.success) {
        applySuffixConfig(result.data || {});
        render();
        rerenderCurrentPreview();
      } else {
        addMessage("assistant", result.message || "修改系统后缀失败");
      }
    }
  });

  render();
  document.body.append(overlay);
  input.focus();
}

function previewGroup(file) {
  if (file.isDir) return "目录";
  if (file.hasConflict) return "命名冲突";
  if (file.needsConfirm || file.fileType === "unknown") return "待确认";
  if (file.fileType && file.fileType !== "main") return "特殊内容";
  return "正片";
}

async function createAllDirectoryTasks() {
  const baseTask = taskFromForm();
  const missing = [];
  if (!baseTask.taskname) missing.push("任务名");
  if (!baseTask.shareurl) missing.push("分享链接");
  if (!baseTask.savepath) missing.push("保存目录");
  if (missing.length) {
    addMessage("assistant", `请先补全：${missing.join("、")}。`);
    return;
  }
  if (!state.lastPreviewFiles.length) {
    addMessage("assistant", "请先预览当前分享，再选择目录任务。");
    return;
  }

  els.createAllDirs.disabled = true;
  els.createAllDirs.textContent = "选择中";
  const selectedPlan = await selectFileTaskPlan(baseTask);
  els.createAllDirs.disabled = false;
  els.createAllDirs.textContent = "选择目录任务";

  if (!selectedPlan.length) {
    addMessage("assistant", "没有选择要创建任务的视频文件。");
    return;
  }
  const duplicates = duplicateTaskTargets(selectedPlan);
  if (duplicates.length) {
    addMessage("assistant", `发现 ${duplicates.length} 个重复目标文件名，请取消重复项后再创建：\n${duplicates.slice(0, 6).join("\n")}`);
    return;
  }

  els.createAllDirs.disabled = true;
  els.createAllDirs.textContent = "创建中";
  let cleanupText = "";
  if (els.cleanupBeforeCreate.checked) {
    const cleanup = await deleteQasTaskFamily(baseTask.taskname);
    cleanupText = cleanup.success && cleanup.data?.removedCount
      ? `已清理 ${cleanup.data.removedCount} 个同名旧任务。`
      : "";
    if (!cleanup.success) {
      els.createAllDirs.disabled = false;
      els.createAllDirs.textContent = "选择目录任务";
      addMessage("assistant", `清理旧任务失败：${cleanup.message || "QAS 没有返回明确原因"}`);
      return;
    }
  }
  const results = [];
  for (const item of selectedPlan) {
    const result = await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ ...item.task, runNow: els.runNow.checked })
    });
    results.push({ item, result });
  }
  els.createAllDirs.disabled = false;
  els.createAllDirs.textContent = "选择目录任务";

  const successCount = results.filter(({ result }) => result.success).length;
  const failed = results.filter(({ result }) => !result.success);
  const failedText = failed.length
    ? `\n失败：\n${failed.map(({ item, result }) => `- ${item.name}：${result.message || "QAS 没有返回明确原因"}`).join("\n")}`
    : "";
  addMessage("assistant", `${cleanupText}已创建 ${successCount} / ${results.length} 个文件任务。${failedText}`);
  switchView("tasks");
  els.taskFilter.value = baseTask.taskname;
  await loadTasks({ silent: true });
}

function selectFileTaskPlan(baseTask) {
  return new Promise((resolve) => {
    const overlay = document.createElement("section");
    overlay.className = "task-picker-backdrop";
    const rootShareUrl = currentPreviewShareUrl() || baseTask.shareurl;
    const rootNode = {
      id: "root",
      name: currentPreviewName(),
      shareurl: rootShareUrl,
      savepath: baseTask.savepath,
      taskSuffix: "",
      depth: 0,
      loaded: true,
      loading: false,
      files: buildPickerEntries(state.lastPreviewRawFiles.length ? state.lastPreviewRawFiles : state.lastPreviewFiles, {
        baseTask,
        shareurl: rootShareUrl,
        savepath: baseTask.savepath,
        taskSuffix: "",
        depth: 0
      })
    };
    const expanded = new Set(["root"]);

    overlay.innerHTML = `
      <div class="task-picker" role="dialog" aria-modal="true" aria-label="选择目录任务">
        <header>
          <div>
            <p class="eyebrow">QAS TASK PICKER</p>
            <h2>选择要保存的视频文件</h2>
          </div>
          <button class="ghost" type="button" data-action="cancel">取消</button>
        </header>
        <div class="task-picker-actions">
          <label class="inline-check">
            <input type="checkbox" data-action="select-all" />
            <span>全选已加载视频</span>
          </label>
          <small data-role="selected-count"></small>
        </div>
        <div class="task-picker-list" data-role="tree"></div>
        <footer>
          <button type="button" data-action="cancel">取消</button>
          <button class="primary" type="button" data-action="confirm">创建选中任务</button>
        </footer>
      </div>
    `;

    const tree = overlay.querySelector("[data-role='tree']");
    const checkboxes = () => [...overlay.querySelectorAll("input[data-plan-id]")];
    const selectedCount = overlay.querySelector("[data-role='selected-count']");
    const confirmButton = overlay.querySelector("[data-action='confirm']");
    const selectAll = overlay.querySelector("[data-action='select-all']");
    const close = (value) => {
      overlay.remove();
      resolve(value);
    };
    const updateCount = () => {
      const total = checkboxes().length;
      const selected = checkboxes().filter((input) => input.checked).length;
      selectedCount.textContent = total ? `已选 ${selected} / ${total}` : "当前没有已加载的视频";
      confirmButton.disabled = selected === 0;
      selectAll.checked = total > 0 && selected === total;
      selectAll.indeterminate = selected > 0 && selected < total;
    };
    const render = () => {
      tree.innerHTML = "";
      renderPickerNode(rootNode, tree, expanded);
      updateCount();
    };

    overlay.addEventListener("change", (event) => {
      if (event.target.dataset.action === "select-all") {
        checkboxes().forEach((input) => {
          input.checked = event.target.checked;
        });
      }
      updateCount();
    });
    overlay.addEventListener("click", async (event) => {
      if (event.target.dataset.action === "cancel") close([]);
      if (event.target.dataset.action === "toggle-dir") {
        const id = event.target.dataset.nodeId;
        const node = findPickerNode(rootNode, id);
        if (!node) return;
        if (expanded.has(id)) {
          expanded.delete(id);
          render();
          return;
        }
        expanded.add(id);
        if (!node.loaded && !node.loading) {
          node.loading = true;
          render();
          const result = await api("/api/share-detail", {
            method: "POST",
            body: JSON.stringify({
              shareurl: node.shareurl,
              task: { ...baseTask, shareurl: node.shareurl, savepath: node.savepath }
            })
          });
          node.loading = false;
          node.loaded = true;
          if (result.success) {
            node.files = buildPickerEntries(result.data || [], {
              baseTask,
              shareurl: node.shareurl,
              savepath: node.savepath,
              taskSuffix: node.taskSuffix,
              aiByName: new Map(),
              depth: node.depth
            });
          } else {
            node.error = result.message || "读取目录失败";
          }
        }
        render();
      }
      if (event.target.dataset.action === "confirm") {
        const selected = checkboxes()
          .filter((input) => input.checked)
          .map((input) => findPickerPlan(rootNode, input.dataset.planId))
          .filter(Boolean);
        close(selected);
      }
    });

    document.body.append(overlay);
    render();
  });
}

function buildPickerEntries(files, context) {
  const preview = buildRenamePreview(files || [], context.aiByName || state.aiByName);
  return preview.map((file, index) => {
    const id = `${context.shareurl || "share"}::${context.depth}:${index}:${file.name}`;
    if (file.isDir) {
      return {
        type: "dir",
        id,
        name: file.name,
        shareurl: file.childShareUrl,
        savepath: joinSavePath(context.savepath, cleanPathName(file.name)),
        taskSuffix: joinTaskSuffix(context.taskSuffix, cleanPathName(file.name)),
        depth: context.depth + 1,
        loaded: false,
        loading: false,
        files: []
      };
    }
    if (!isVideoFile(file.name)) {
      return {
        type: "other",
        id,
        name: file.name,
        depth: context.depth + 1
      };
    }
    const previewName = file.previewName || file.renamed || file.name;
    const taskFileName = taskFileLabel(previewName);
    return {
      type: "file",
      id,
      name: file.name,
      previewName,
      size: file.size,
      label: file.episodeLabel,
      needsConfirm: file.needsConfirm,
      depth: context.depth + 1,
      plan: {
        id,
        name: file.name,
        task: {
          ...context.baseTask,
          taskname: `${context.baseTask.taskname} ${context.taskSuffix || ""} ${taskFileName}`.replace(/\s+/g, " ").trim(),
          shareurl: context.shareurl,
          savepath: context.savepath,
          pattern: `^${escapeRegex(file.name)}$`,
          replace: previewName
        }
      }
    };
  });
}

function duplicateTaskTargets(plans) {
  const seen = new Map();
  const duplicates = [];
  for (const item of plans || []) {
    const task = item.task || {};
    const key = `${task.savepath || ""}/${task.replace || item.name || ""}`;
    if (seen.has(key)) {
      duplicates.push(`${task.replace || item.name}（${task.savepath || ""}）`);
    } else {
      seen.set(key, item);
    }
  }
  return duplicates;
}

function renderPickerNode(node, container, expanded) {
  const currentOpen = expanded.has(node.id);
  if (node.id !== "root") {
    const row = document.createElement("div");
    row.className = "picker-dir-row";
    row.style.setProperty("--depth", node.depth);
    row.innerHTML = `
      <button type="button" data-action="toggle-dir" data-node-id="${escapeHtml(node.id)}">${currentOpen ? "收起" : "展开"}</button>
      <strong>${escapeHtml(node.name)}</strong>
      <small>${escapeHtml(node.savepath || "")}</small>
    `;
    container.append(row);
  }

  if (!currentOpen) return;
  if (node.loading) {
    const row = document.createElement("p");
    row.className = "picker-note";
    row.style.setProperty("--depth", node.depth + 1);
    row.textContent = "正在读取目录...";
    container.append(row);
    return;
  }
  if (node.error) {
    const row = document.createElement("p");
    row.className = "picker-note error";
    row.style.setProperty("--depth", node.depth + 1);
    row.textContent = node.error;
    container.append(row);
    return;
  }
  node.files.forEach((item) => {
    if (item.type === "dir" && item.shareurl) {
      renderPickerNode(item, container, expanded);
      return;
    }
    if (item.type !== "file") return;
    const row = document.createElement("label");
    row.className = "task-choice file-choice";
    row.style.setProperty("--depth", item.depth);
    row.innerHTML = `
      <input type="checkbox" data-plan-id="${escapeHtml(item.id)}" ${item.needsConfirm ? "" : "checked"} />
      <span>
        <strong>${escapeHtml(item.name)}</strong>
        <em>${escapeHtml(item.previewName)}</em>
        <small>${escapeHtml(item.label || "")}${item.needsConfirm ? " · 待确认" : ""} · ${escapeHtml(formatSize(item.size))}</small>
      </span>
    `;
    container.append(row);
  });
}

function findPickerNode(node, id) {
  if (node.id === id) return node;
  for (const item of node.files || []) {
    if (item.type === "dir") {
      const found = findPickerNode(item, id);
      if (found) return found;
    }
  }
  return null;
}

function findPickerPlan(node, id) {
  for (const item of node.files || []) {
    if (item.type === "file" && item.id === id) return item.plan;
    if (item.type === "dir") {
      const found = findPickerPlan(item, id);
      if (found) return found;
    }
  }
  return null;
}

async function cleanupCurrentTaskFamily() {
  const baseTask = taskFromForm();
  if (!baseTask.taskname) {
    addMessage("assistant", "请先填写任务名，再清理同名旧任务。");
    return;
  }

  els.cleanupMatchingTasks.disabled = true;
  els.cleanupMatchingTasks.textContent = "检查中";
  const data = await api("/api/qas/tasks", { method: "GET" });
  els.cleanupMatchingTasks.disabled = false;
  els.cleanupMatchingTasks.textContent = "清理同名旧任务";

  if (!data.success) {
    addMessage("assistant", data.message || "获取 QAS 任务失败");
    return;
  }

  const names = [...new Set((data.data || [])
    .map((task) => String(task.taskname || "").trim())
    .filter((name) => isSameTaskFamilyName(name, baseTask.taskname)))];

  if (!names.length) {
    addMessage("assistant", "没有找到同名旧任务。");
    return;
  }

  const preview = names.slice(0, 12).map((name, index) => `${index + 1}. ${name}`).join("\n");
  const more = names.length > 12 ? `\n...还有 ${names.length - 12} 类同名任务` : "";
  if (!window.confirm(`将删除 QAS 中这些同名旧任务：\n\n${preview}${more}\n\n确认删除吗？`)) return;

  els.cleanupMatchingTasks.disabled = true;
  els.cleanupMatchingTasks.textContent = "删除中";
  const result = await deleteQasTasksByNames(names);
  els.cleanupMatchingTasks.disabled = false;
  els.cleanupMatchingTasks.textContent = "清理同名旧任务";

  if (result.success) {
    addMessage("assistant", result.message || `已删除 ${result.data?.removedCount || 0} 个同名旧任务。`);
    await checkHealth();
    switchView("tasks");
    els.taskFilter.value = baseTask.taskname;
    await loadTasks({ silent: true });
  } else {
    addMessage("assistant", `删除失败：${result.message || "QAS 没有返回明确原因"}`);
  }
}

async function deleteQasTasksByNames(tasknames) {
  return api("/api/qas/tasks/delete", {
    method: "POST",
    body: JSON.stringify({ tasknames })
  });
}

async function deleteQasTaskFamily(baseName) {
  const data = await api("/api/qas/tasks", { method: "GET" });
  if (!data.success) return data;
  const names = [...new Set((data.data || [])
    .map((task) => String(task.taskname || "").trim())
    .filter((name) => isSameTaskFamilyName(name, baseName)))];
  if (!names.length) {
    return { success: true, message: "没有找到同名旧任务。", data: { removedCount: 0 } };
  }
  return deleteQasTasksByNames(names);
}

function isSameTaskFamilyName(name, baseName) {
  const current = String(name || "").trim();
  const base = String(baseName || "").trim();
  return Boolean(base && (current === base || current.startsWith(`${base} `)));
}

function currentPreviewName() {
  const current = state.previewPath[state.previewPath.length - 1];
  return current?.name || "当前目录";
}

function currentPreviewShareUrl() {
  const current = state.previewPath[state.previewPath.length - 1];
  return current?.shareUrl || "";
}

function joinSavePath(base, name) {
  const left = String(base || "").replace(/\/+$/, "");
  const right = String(name || "").replace(/^\/+/, "");
  return right ? `${left}/${right}` : left;
}

function joinTaskSuffix(base, name) {
  return [base, name]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");
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
      syncTaskShareUrlToPreview();
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

function syncTaskShareUrlToPreview() {
  const current = state.previewPath[state.previewPath.length - 1];
  if (current?.shareUrl) els.shareurl.value = current.shareUrl;
}

function buildPreviewName(prefix, ext, analysis, pad, originalName = "") {
  if (analysis.mode === "variety") {
    if (analysis.countsAsEpisode === false) {
      const title = cleanPathName(analysis.title || analysis.label || stripExtension(originalName));
      return `${prefix}-${title}${ext}`;
    }
    if (!Number.isFinite(Number(analysis.number))) {
      const title = cleanPathName(stripExtension(originalName));
      return `${prefix}-${title}${ext}`;
    }
    return `${prefix}${analysis.dateToken ? `-${analysis.dateToken}` : ""}-${analysis.label}${analysis.versionTag ? `-${cleanPathName(analysis.versionTag)}` : ""}${ext}`;
  }
  return `${prefix}${String(analysis.number).padStart(pad, "0")}${ext}`;
}

function analyzeFileName(name, mode = "tv", fallbackNumber = 1) {
  return mode === "variety"
    ? analyzeVarietyFileName(name, fallbackNumber)
    : analyzeTvFileName(name, fallbackNumber);
}

function analyzeTvFileName(name, fallbackNumber = 1) {
  const text = String(name || "").replace(/\.[A-Za-z0-9]{2,5}$/, "");
  const patterns = [
    /S\d{1,2}E\s*0*(\d{1,4})/i,
    /(?:^|[\s._-])EP\s*0*(\d{1,4})(?=\D|$)/i,
    /(?:^|[\s._-])E\s*0*(\d{1,4})(?=\D|$)/i,
    /第\s*0*(\d{1,4})\s*[集话]/,
    /^\s*0*(\d{1,4})(?=\D|$)/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const number = Number(match[1]);
      return {
        mode: "tv",
        confidence: "high",
        number,
        sortNumber: number,
        label: `第 ${number} 集`
      };
    }
  }
  return {
    mode: "tv",
    confidence: "low",
    number: fallbackNumber,
    sortNumber: fallbackNumber,
    label: `第 ${fallbackNumber} 集`
  };
}

function analyzeVarietyFileName(name, fallbackNumber = 1) {
  const text = String(name || "").replace(/\.[A-Za-z0-9]{2,5}$/, "");
  const dateToken = extractDateToken(text);
  const semanticTitle = extractSemanticTitle(text);
  const special = detectVarietySpecial(text);
  const explicit = text.match(/第\s*0*(\d{1,4})\s*期\s*(上|中|下)?/);
  if (special || semanticTitle) {
    const label = special?.label || "待确认";
    const type = special?.type || "unknown";
    const title = specialTitle(text, special?.label || "衍生", semanticTitle);
    return {
      mode: "variety",
      fileType: type,
      confidence: special ? "high" : "low",
      number: null,
      sortNumber: special?.sortNumber || 99000 + fallbackNumber,
      label,
      title,
      dateToken,
      countsAsEpisode: false
    };
  }

  if (explicit) {
    const number = Number(explicit[1]);
    const part = explicit[2] || "";
    const suffixText = text.slice(explicit.index + explicit[0].length);
    const versionTag = detectVersionTag(suffixText);
    const unknownSuffixes = detectUnknownSuffixTags(suffixText);
    return {
      mode: "variety",
      fileType: "main",
      confidence: unknownSuffixes.length ? "low" : "high",
      number,
      sortNumber: number,
      label: `第${number}期${part}`,
      versionTag,
      unknownSuffixes,
      dateToken,
      countsAsEpisode: true
    };
  }

  if (hasDateLikeText(text)) {
    return {
      mode: "variety",
      fileType: "unknown",
      confidence: "low",
      number: null,
      sortNumber: 99000 + fallbackNumber,
      label: "待确认",
      title: text,
      dateToken,
      countsAsEpisode: false
    };
  }

  const loose = text.match(/(?:^|[^\d])0*(\d{1,3})\s*(上|中|下)?(?=\D*$)/);
  if (loose) {
    const number = Number(loose[1]);
    const part = loose[2] || "";
    const suffixText = text.slice(loose.index + loose[0].length);
    const versionTag = detectVersionTag(suffixText);
    const unknownSuffixes = detectUnknownSuffixTags(suffixText);
    return {
      mode: "variety",
      fileType: "main",
      confidence: unknownSuffixes.length ? "low" : "medium",
      number,
      sortNumber: number,
      label: `第${number}期${part}`,
      versionTag,
      unknownSuffixes,
      dateToken,
      countsAsEpisode: true
    };
  }

  return {
    mode: "variety",
    fileType: "unknown",
    confidence: "low",
    number: null,
    sortNumber: 99000 + fallbackNumber,
    label: "待确认",
    title: text,
    dateToken,
    countsAsEpisode: false
  };
}

function detectVarietySpecial(text) {
  const rules = [
    { type: "bonus", label: "加更", sortNumber: 91000, pattern: /加更|加长版|会员加更/ },
    { type: "pure", label: "纯享", sortNumber: 92000, pattern: /纯享|纯享版|舞台纯享/ },
    { type: "special", label: "特辑", sortNumber: 93000, pattern: /特辑|特别篇|精编|合集|回顾/ },
    { type: "press", label: "发布会", sortNumber: 94000, pattern: /发布会|见面会|直播|首映礼/ },
    { type: "pilot", label: "先导片", sortNumber: 95000, pattern: /先导片|先导|超前企划/ },
    { type: "extra", label: "衍生", sortNumber: 96000, pattern: /副本存档中|副本解锁中|解锁中|采访|花絮|番外|未播|彩蛋|幕后|预告/ }
  ];
  return rules.find((rule) => rule.pattern.test(String(text || ""))) || null;
}

function extractDateToken(text) {
  const match = String(text || "").match(/((?:19|20)\d{2})[年._/-]?((?:1[0-2]|0?[1-9]))[月._/-]?((?:3[01]|[12]\d|0?[1-9]))/);
  if (!match) return "";
  return `${match[1]}${match[2].padStart(2, "0")}${match[3].padStart(2, "0")}`;
}

function extractSemanticTitle(text) {
  const value = String(text || "").replace(/\.[A-Za-z0-9]{2,5}$/, "").trim();
  const episode = value.match(/第\s*\d+\s*期/);
  if (!episode) return "";
  const beforeEpisode = value.slice(0, episode.index);
  const withoutDate = beforeEpisode
    .replace(/(?:19|20)\d{2}[年._/-]?(?:1[0-2]|0?[1-9])[月._/-]?(?:3[01]|[12]\d|0?[1-9])/g, "")
    .replace(/[\s._-]+/g, "")
    .replace(/[《》「」『』【】[\]()（）]/g, "")
    .trim();
  if (!withoutDate) return "";
  if (/^(上|中|下|完整版|会员版|高码率|高码|4K|HDR|杜比)$/i.test(withoutDate)) return "";
  return withoutDate;
}

function detectVersionTag(text) {
  const value = String(text || "");
  const tags = [];
  const known = enabledVersionSuffixes();
  if (known.includes("完整版") && /完整版|完整/.test(value)) tags.push("完整版");
  if (known.includes("会员版") && /会员版/.test(value)) tags.push("会员版");
  if (known.includes("高码率") && /高码率|高码/.test(value)) tags.push("高码率");
  if (known.includes("杜比") && /杜比|Dolby/i.test(value)) tags.push("杜比");
  if (known.includes("HDR") && /(^|[\s._-])HDR版?($|[\s._-])/i.test(value)) tags.push("HDR");
  if (known.includes("4K") && /(^|[\s._-])4K版?($|[\s._-])/i.test(value)) tags.push("4K");
  userVersionSuffixes().forEach((suffix) => {
    if (suffix && value.includes(suffix)) tags.push(suffix);
  });
  return Array.from(new Set(tags)).join("-");
}

function enabledVersionSuffixes() {
  const disabled = new Set((state.suffixConfig.systemDisabled || []).map(cleanSuffixValue));
  return SYSTEM_VERSION_SUFFIXES.filter((item) => !disabled.has(item));
}

function userVersionSuffixes() {
  return (state.suffixConfig.user || []).map(cleanSuffixValue).filter(Boolean);
}

function cleanSuffixValue(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .slice(0, 24);
}

function detectUnknownSuffixTags(text) {
  let value = String(text || "").normalize("NFKC");
  if (!value.trim()) return [];
  const known = [...enabledVersionSuffixes(), ...userVersionSuffixes(), "60FPS", "FPS", "1080P", "2160P", "UHD", "WEB-DL", "H265", "H264", "HEVC", "AAC"];
  known.forEach((tag) => {
    if (!tag) return;
    value = value.replace(new RegExp(escapeRegex(tag), "gi"), " ");
  });
  return Array.from(new Set(value
    .split(/[\s._,，、/()-]+/)
    .map(cleanSuffixValue)
    .filter((item) => /^[\u4e00-\u9fa5]{2,8}版?$/.test(item) && !/^(上|中|下|完整|会员|高码|杜比)$/.test(item))));
}

function normalizeVersionTags(value) {
  if (Array.isArray(value)) return mergeTags(...value);
  return detectVersionTag(String(value || "")) || String(value || "").trim();
}

function mergeTags(...values) {
  const tags = [];
  values.forEach((value) => {
    String(value || "")
      .split(/[-/、,，\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => tags.push(item));
  });
  return Array.from(new Set(tags)).join("-");
}

function specialTitle(text, label, semanticTitle = "") {
  const original = String(text || "").trim();
  const dated = specialTitleWithDate(original);
  if (dated) return dated;
  let cleaned = original
    .replace(/(?:19|20)\d{2}[._-]?(?:1[0-2]|0?[1-9])[._-]?(?:3[01]|[12]\d|0?[1-9])/g, "")
    .replace(/^[\s._-]+|[\s._-]+$/g, "")
    .trim();
  if ((cleaned.startsWith("(") && cleaned.endsWith(")")) || (cleaned.startsWith("（") && cleaned.endsWith("）"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  const genericTitles = new Set([label, `${label}版`, "纯享版", "发布会", "特辑", "加更", "花絮", "先导片"]);
  if (genericTitles.has(cleaned) && original !== cleaned) return original;
  if (semanticTitle) {
    const episode = original.match(/第\s*\d+\s*期\s*(?:上|中|下)?/);
    const versionTag = detectVersionTag(original);
    return `${extractDateToken(original) ? `${extractDateToken(original)}-` : ""}${semanticTitle}${episode ? episode[0].replace(/\s+/g, "") : ""}${versionTag ? `-${versionTag}` : ""}`;
  }
  if (!cleaned) return label;
  return cleaned.includes(label) ? cleaned : `${label}-${cleaned}`;
}

function specialTitleWithDate(text) {
  const match = String(text || "").match(/((?:19|20)\d{2})[._-]?((?:1[0-2]|0?[1-9]))[._-]?((?:3[01]|[12]\d|0?[1-9]))/);
  if (!match) return "";
  const date = `${match[1]}${match[2].padStart(2, "0")}${match[3].padStart(2, "0")}`;
  const tail = String(text || "").slice(match.index + match[0].length);
  const title = tail
    .replace(/^[\s._-]+/, "")
    .replace(/[\s._-]+$/g, "")
    .replace(/[\s._-]+/g, "-")
    .replace(/[《》]/g, "")
    .trim();
  if (!title) return date;
  if (title.startsWith("期")) return `${date}${title}`;
  return `${date}-${title}`;
}

function hasDateLikeText(text) {
  return /(?:19|20)\d{2}[._-]?(?:1[0-2]|0?[1-9])[._-]?(?:3[01]|[12]\d|0?[1-9])/.test(String(text || ""));
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

function stripExtension(name) {
  return String(name || "").replace(/\.[A-Za-z0-9]{2,5}$/, "");
}

function taskFileLabel(name) {
  const label = stripExtension(name);
  const prefix = els.renamePrefix.value.trim();
  if (prefix && label.startsWith(prefix) && label.length > prefix.length) {
    return label.slice(prefix.length).trim();
  }
  return label;
}

function cleanRecognitionName(name) {
  const ext = extensionOf(name);
  let text = stripExtension(name)
    .normalize("NFKC")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[·•★☆🔥🌙⚙️🎉🍺]/g, "")
    .replace(/\b(?:1080P|2160P|UHD|WEB[-_. ]?DL|HEVC|H265|H264|AAC)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[._-]{2,}/g, "-")
    .replace(/^[\s._-]+|[\s._-]+$/g, "")
    .trim();
  text = trimHarmonyNoise(text);
  if (!text) text = stripExtension(name);
  return `${text}${ext}`;
}

function trimHarmonyNoise(text) {
  const value = String(text || "").trim();
  if (!value) return value;

  const special = value.match(/(.*?(?:特别加更|加更|纯享版?|精编特辑|特辑|特别篇|发布会|见面会|直播|首映礼|先导片|先导|副本存档中|副本解锁中|解锁中|采访|花絮|番外|未播|彩蛋|幕后|预告))/);
  if (special) {
    const tail = value.slice(special[0].length);
    const versionTag = detectVersionTag(tail);
    const indexTag = tail.match(/^\s*[（(]\s*\d+\s*[）)]/);
    const followingEpisode = tail.match(/^[》）)]?\s*(第\s*\d+\s*期\s*(?:上|中|下)?)/);
    return `${special[1]}${followingEpisode ? followingEpisode[1].replace(/\s+/g, "") : ""}${indexTag ? indexTag[0].trim() : ""}${versionTag ? `-${versionTag}` : ""}`.replace(/[\s._-]+$/g, "").trim();
  }

  const episode = value.match(/(第\s*\d+\s*期\s*(?:上|中|下)?)/);
  if (episode) {
    const head = value.slice(0, episode.index);
    const tail = value.slice(episode.index + episode[0].length);
    const versionTag = detectVersionTag(tail);
    const unknownSuffixes = detectUnknownSuffixTags(tail);
    const suffixTag = mergeTags(versionTag, unknownSuffixes.join("-"));
    return `${head}${episode[1]}${suffixTag}`
      .replace(/\s+/g, "")
      .replace(/[\s._-]+$/g, "")
      .trim();
  }
  return value;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    `分享链接：${task.shareurl}`,
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
