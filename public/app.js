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
  lastPreviewFiles: []
};

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
  renameStart: document.querySelector("#renameStart"),
  renamePad: document.querySelector("#renamePad"),
  applyRename: document.querySelector("#applyRename"),
  createAllDirs: document.querySelector("#createAllDirs"),
  cleanupMatchingTasks: document.querySelector("#cleanupMatchingTasks"),
  cleanupBeforeCreate: document.querySelector("#cleanupBeforeCreate"),
  previewShare: document.querySelector("#previewShare"),
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
els.createAllDirs.addEventListener("click", createAllDirectoryTasks);
els.cleanupMatchingTasks.addEventListener("click", cleanupCurrentTaskFamily);
els.renameModeSwitch.addEventListener("click", (event) => {
  const mode = event.target.dataset.renameMode;
  if (!mode) return;
  state.renameMode = mode;
  els.renameModeSwitch.querySelectorAll("[data-rename-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.renameMode === mode);
  });
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
  const files = buildRenamePreview(state.lastPreviewRawFiles);
  state.lastPreviewFiles = files;
  renderPreview(files);
  switchView("preview");
}

function buildRenamePreview(files) {
  const prefix = els.renamePrefix.value.trim();
  const start = Math.max(0, Number(els.renameStart.value || 1));
  const pad = Math.max(1, Number(els.renamePad.value || 3));
  const sorted = [...files].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    const ea = analyzeFileName(a.name, state.renameMode, 99999);
    const eb = analyzeFileName(b.name, state.renameMode, 99999);
    if (ea.sortNumber !== eb.sortNumber) return ea.sortNumber - eb.sortNumber;
    return a.name.localeCompare(b.name, "zh-CN");
  });

  return sorted.map((file, index) => {
    const ext = extensionOf(file.name);
    const fallbackNumber = start + index;
    const analysis = analyzeFileName(file.name, state.renameMode, fallbackNumber);
    const generated = file.isDir
      ? file.name
      : prefix
      ? buildPreviewName(prefix, ext, analysis, pad)
      : file.renamed || file.name;
    return {
      ...file,
      analysis,
      episode: analysis.number,
      episodeLabel: analysis.label,
      needsConfirm: analysis.confidence !== "high",
      previewName: generated
    };
  });
}

function rerenderCurrentPreview() {
  if (!state.lastPreviewRawFiles.length) return;
  const files = buildRenamePreview(state.lastPreviewRawFiles);
  state.lastPreviewFiles = files;
  renderPreview(files);
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
  files.forEach((file) => {
    const row = document.createElement("article");
    row.className = `preview-row${file.isDir ? " is-dir" : ""}`;
    row.innerHTML = `
      <div class="file-main">
        <p class="from">${escapeHtml(file.isDir ? `目录：${file.name}` : file.name)}${file.isDir && file.size ? `（${escapeHtml(file.size)} 项）` : ""}</p>
        <p class="to">${escapeHtml(file.isDir ? "进入目录查看文件" : file.previewName || file.renamed || file.name)}</p>
      </div>
      <div class="file-meta">
        ${file.isDir ? '<span class="pill blue">目录</span>' : `<span class="pill blue">${escapeHtml(file.episodeLabel || `第 ${file.episode} 集`)}</span>`}
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
    els.previewList.append(row);
  });
  renderBreadcrumb();
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
            <input type="checkbox" data-action="select-all" checked />
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
  const preview = buildRenamePreview(files || []);
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
      <input type="checkbox" data-plan-id="${escapeHtml(item.id)}" checked />
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

function buildPreviewName(prefix, ext, analysis, pad) {
  if (analysis.mode === "variety") {
    return `${prefix}${analysis.label}${ext}`;
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
  const explicit = text.match(/第\s*0*(\d{1,4})\s*期\s*(上|中|下)?/);
  const special = text.match(/(加更|纯享|特别篇|番外|先导片|会员版|未播|花絮|彩蛋)/);
  if (explicit) {
    const number = Number(explicit[1]);
    const part = explicit[2] || "";
    const tag = special?.[1] || "";
    return {
      mode: "variety",
      confidence: "high",
      number,
      sortNumber: number,
      label: `第${number}期${part}${tag}`
    };
  }

  if (hasDateLikeText(text)) {
    return {
      mode: "variety",
      confidence: "low",
      number: fallbackNumber,
      sortNumber: fallbackNumber,
      label: `第${fallbackNumber}期`
    };
  }

  const loose = text.match(/(?:^|[^\d])0*(\d{1,3})\s*(上|中|下)?(?=\D*$)/);
  if (loose) {
    const number = Number(loose[1]);
    const part = loose[2] || "";
    const tag = special?.[1] || "";
    return {
      mode: "variety",
      confidence: "medium",
      number,
      sortNumber: number,
      label: `第${number}期${part}${tag}`
    };
  }

  return {
    mode: "variety",
    confidence: "low",
    number: fallbackNumber,
    sortNumber: fallbackNumber,
    label: special?.[1] || `第${fallbackNumber}期`
  };
}

function hasDateLikeText(text) {
  return /(?:19|20)\d{2}[._-](?:0?[1-9]|1[0-2])[._-](?:0?[1-9]|[12]\d|3[01])/.test(String(text || ""));
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
