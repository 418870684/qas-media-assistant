import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

loadDotEnv(path.join(__dirname, ".env"));

const env = {
  port: numberEnv("PORT", 8787),
  qasHost: trimSlash(process.env.QAS_HOST || ""),
  qasToken: process.env.QAS_API_TOKEN || "",
  webPassword: process.env.WEB_PASSWORD || "",
  defaultSaveRoot: process.env.DEFAULT_SAVE_ROOT || "/影视",
  searchDepth: process.env.SEARCH_DEPTH || "0",
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramAllowedChatIds: new Set(
    (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  )
};

const telegramState = {
  offset: 0,
  lastResults: new Map()
};
const sessions = new Map();
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;

const server = http.createServer(async (req, res) => {
  try {
    setSecurityHeaders(res);
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/session" || url.pathname === "/api/login" || url.pathname === "/api/logout") {
      return handlePublicApi(req, res, url);
    }

    if (requiresPassword(req) && !isAuthorized(req)) {
      return sendJson(res, 401, { success: false, message: "请先登录" });
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, res, url);
    }

    return serveStatic(res, url.pathname);
  } catch (error) {
    return sendJson(res, 500, { success: false, message: error.message || "服务器错误" });
  }
});

server.listen(env.port, () => {
  console.log(`QAS Media Assistant listening on http://0.0.0.0:${env.port}`);
  startTelegramBot();
});

async function handlePublicApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/session") {
    return sendJson(res, 200, {
      success: true,
      data: {
        passwordEnabled: Boolean(env.webPassword),
        authenticated: !env.webPassword || isAuthorized(req)
      }
    });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    if (!env.webPassword) {
      return sendJson(res, 200, { success: true, message: "未启用网页密码" });
    }
    const body = await readJson(req);
    if (String(body.password || "") !== env.webPassword) {
      return sendJson(res, 401, { success: false, message: "密码不正确" });
    }
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + sessionTtlMs);
    res.setHeader("Set-Cookie", makeSessionCookie(req, token));
    return sendJson(res, 200, { success: true, message: "登录成功" });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const token = sessionToken(req);
    if (token) sessions.delete(token);
    res.setHeader("Set-Cookie", clearSessionCookie());
    return sendJson(res, 200, { success: true, message: "已退出登录" });
  }

  return sendJson(res, 404, { success: false, message: "接口不存在" });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/config") {
    return sendJson(res, 200, {
      success: true,
      data: {
        qasHost: env.qasHost,
        qasConfigured: Boolean(env.qasHost && env.qasToken),
        defaultSaveRoot: env.defaultSaveRoot,
        searchDepth: env.searchDepth,
        passwordEnabled: Boolean(env.webPassword),
        telegramEnabled: Boolean(env.telegramToken)
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    const data = await qasData();
    return sendJson(res, 200, {
      success: data.success,
      message: data.success ? "QAS 已连接" : data.message,
      data: data.success
        ? {
            taskCount: Array.isArray(data.data?.tasklist) ? data.data.tasklist.length : 0
          }
        : null
    });
  }

  if (req.method === "GET" && url.pathname === "/api/qas/tasks") {
    const data = await qasData();
    if (!data.success) return sendJson(res, 502, data);
    return sendJson(res, 200, {
      success: true,
      data: Array.isArray(data.data?.tasklist) ? data.data.tasklist : []
    });
  }

  if (req.method === "POST" && url.pathname === "/api/qas/tasks/delete") {
    const body = await readJson(req);
    const result = await deleteQasTasksByName(body.tasknames || []);
    return sendJson(res, result.success ? 200 : 502, result);
  }

  if (req.method === "GET" && url.pathname === "/api/search") {
    const q = url.searchParams.get("q") || "";
    const depth = url.searchParams.get("depth") || env.searchDepth;
    const results = await searchResources(q, depth);
    return sendJson(res, 200, results);
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const body = await readJson(req);
    const result = await chat(body.message || "");
    return sendJson(res, 200, result);
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    const body = await readJson(req);
    const result = await addTask(body);
    if (body.runNow && result.success) {
      const runResult = await runTask(body);
      result.run = runResult;
    }
    return sendJson(res, result.success ? 200 : 502, result);
  }

  if (req.method === "POST" && url.pathname === "/api/share-detail") {
    const body = await readJson(req);
    const result = await getShareDetail(body);
    return sendJson(res, result.success ? 200 : 502, result);
  }

  if (req.method === "POST" && url.pathname === "/api/run") {
    const body = await readJson(req);
    const result = await runTask(body.task || null);
    return sendJson(res, result.success ? 200 : 502, result);
  }

  return sendJson(res, 404, { success: false, message: "接口不存在" });
}

async function chat(message) {
  const text = String(message || "").trim();
  if (!text) {
    return assistantMessage("你可以输入片名搜索，也可以直接粘贴夸克分享链接。");
  }

  if (/(任务|task|list|列表)/i.test(text)) {
    const data = await qasData();
    if (!data.success) return assistantMessage(data.message);
    const tasks = Array.isArray(data.data?.tasklist) ? data.data.tasklist : [];
    return {
      success: true,
      type: "tasks",
      message: tasks.length ? `当前有 ${tasks.length} 个 QAS 任务。` : "当前还没有 QAS 任务。",
      tasks
    };
  }

  const share = extractShareUrl(text);
  if (share) {
    const name = guessName(text) || "新转存任务";
    const savepath = extractSavePath(text) || `${env.defaultSaveRoot}/${sanitizePathName(name)}`;
    return {
      success: true,
      type: "draft",
      message: "识别到夸克分享链接，已经帮你填好一个待创建任务。",
      draft: {
        taskname: name,
        shareurl: share,
        savepath,
        pattern: "$TV",
        replace: ""
      }
    };
  }

  const keyword = normalizeSearchKeyword(text);
  const search = await searchResources(keyword, env.searchDepth);
  if (!search.success) return assistantMessage(search.message);
  return {
    success: true,
    type: "search",
    message: search.data.length
      ? `找到 ${search.data.length} 个候选资源，挑一个就能创建 QAS 任务。`
      : "暂时没有搜到候选资源。你也可以直接粘贴夸克分享链接。",
    query: keyword,
    candidates: search.data
  };
}

async function qasData() {
  if (!env.qasHost || !env.qasToken) {
    return { success: false, message: "还没有配置 QAS_HOST 和 QAS_API_TOKEN" };
  }
  return qasFetch("/data", { method: "GET" });
}

async function searchResources(q, depth = "0") {
  const keyword = String(q || "").trim();
  if (!keyword) return { success: false, message: "请输入要搜索的影视名称", data: [] };
  if (!env.qasHost || !env.qasToken) {
    return { success: false, message: "还没有配置 QAS_HOST 和 QAS_API_TOKEN", data: [] };
  }

  const result = await qasFetch(`/task_suggestions?q=${encodeURIComponent(keyword)}&d=${encodeURIComponent(depth)}`, {
    method: "GET"
  });
  if (!result.success && !Array.isArray(result.data)) {
    return { success: false, message: result.message || "QAS 搜索接口不可用", data: [] };
  }

  const rows = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.data?.list)
      ? result.data.list
      : Array.isArray(result.suggestions)
        ? result.suggestions
        : [];

  const candidates = rows.map(normalizeCandidate).filter((item) => item.shareurl);
  const validation = await validateCandidates(candidates);
  return {
    success: true,
    message: `找到 ${validation.valid.length} 个可用候选资源，已剔除 ${validation.invalidCount} 个失效资源`,
    data: validation.valid
  };
}

async function addTask(input) {
  const task = normalizeTask(input);
  if (!task.taskname || !task.shareurl || !task.savepath) {
    return { success: false, message: "任务名、分享链接、保存路径都要填写" };
  }
  return qasFetch("/api/add_task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task)
  });
}

async function deleteQasTasksByName(tasknames) {
  const names = new Set(
    (Array.isArray(tasknames) ? tasknames : [])
      .map((name) => String(name || "").trim())
      .filter(Boolean)
  );
  if (!names.size) return { success: false, message: "没有收到要删除的任务名" };

  const data = await qasData();
  if (!data.success) return data;
  const tasks = Array.isArray(data.data?.tasklist) ? data.data.tasklist : [];
  const kept = [];
  const removed = [];

  for (const task of tasks) {
    if (names.has(String(task.taskname || "").trim())) removed.push(task);
    else kept.push(task);
  }

  if (!removed.length) {
    return {
      success: true,
      message: "没有找到同名旧任务",
      data: { removedCount: 0, removedTasks: [] }
    };
  }

  const result = await qasFetch("/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasklist: kept })
  });

  if (!result.success) {
    return {
      success: false,
      message: result.message || "删除 QAS 任务失败",
      data: result.data
    };
  }

  return {
    success: true,
    message: `已删除 ${removed.length} 个 QAS 任务`,
    data: {
      removedCount: removed.length,
      removedTasks: removed.map((task) => ({
        taskname: task.taskname || "",
        savepath: task.savepath || "",
        shareurl: task.shareurl || ""
      }))
    }
  };
}

async function getShareDetail(input) {
  const task = normalizeTask(input.task || input);
  const shareurl = String(input.shareurl || task.shareurl || "").trim();
  if (!shareurl) return { success: false, message: "请先填写夸克分享链接", data: [] };

  const payload = { shareurl };
  const result = await qasFetch("/get_share_detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (result.success === false) {
    return {
      success: false,
      message: result.data?.error || result.message || "分享不可用",
      data: []
    };
  }
  return {
    success: true,
    message: "已读取分享文件",
    data: normalizeShareDetail(result, shareurl)
  };
}

async function validateCandidates(candidates) {
  const valid = [];
  let invalidCount = 0;
  let cursor = 0;
  const workerCount = Math.min(4, candidates.length);

  async function worker() {
    while (cursor < candidates.length) {
      const index = cursor++;
      const candidate = candidates[index];
      const check = await validateShareUrl(candidate.shareurl);
      if (check.valid) valid.push({ ...candidate, detailCount: check.count });
      else invalidCount += 1;
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  valid.sort((a, b) => candidates.findIndex((item) => item.shareurl === a.shareurl) - candidates.findIndex((item) => item.shareurl === b.shareurl));
  return { valid, invalidCount };
}

async function validateShareUrl(shareurl) {
  const result = await qasFetch("/get_share_detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shareurl })
  });
  if (result.success === false) {
    return { valid: false, count: 0, message: result.data?.error || result.message || "分享不可用" };
  }
  const files = normalizeShareDetail(result, shareurl);
  return { valid: true, count: files.length };
}

async function runTask(task) {
  const body = task ? { tasklist: [normalizeTask(task)] } : undefined;
  const response = await qasRawFetch("/run_script_now", {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return {
    success: response.ok,
    message: response.ok ? "已通知 QAS 执行任务" : "QAS 执行失败",
    data: text.slice(0, 4000)
  };
}

async function qasFetch(endpoint, options = {}) {
  try {
    const response = await qasRawFetch(endpoint, options);
    const text = await response.text();
    const parsed = safeJson(text);
    if (!response.ok) {
      return {
        success: false,
        message: parsed?.message || `QAS 返回 ${response.status}`,
        data: parsed
      };
    }
    if (parsed && typeof parsed === "object") return parsed;
    return { success: true, data: parsed ?? text };
  } catch (error) {
    return { success: false, message: error.message || "连接 QAS 失败" };
  }
}

async function qasRawFetch(endpoint, options = {}) {
  if (!env.qasHost || !env.qasToken) throw new Error("还没有配置 QAS_HOST 和 QAS_API_TOKEN");
  const url = new URL(endpoint, env.qasHost);
  url.searchParams.set("token", env.qasToken);
  return fetch(url, options);
}

function normalizeTask(input = {}) {
  return {
    taskname: String(input.taskname || input.title || "").trim(),
    shareurl: String(input.shareurl || input.url || "").trim(),
    savepath: String(input.savepath || "").trim(),
    pattern: String(input.pattern || "$TV").trim(),
    replace: String(input.replace || "").trim()
  };
}

function normalizeCandidate(raw, index) {
  const shareurl = raw.shareurl || raw.shareUrl || raw.url || raw.link || extractShareUrl(JSON.stringify(raw));
  const title = raw.taskname || raw.title || raw.name || raw.text || raw.label || `候选资源 ${index + 1}`;
  const source = raw.source || raw.sourceName || raw.source_name || raw.site || raw.provider || raw.engine || raw.from || "盘搜";
  return {
    title: String(title),
    shareurl: String(shareurl || ""),
    source: String(source),
    note: raw.note || raw.desc || raw.description || ""
  };
}

function normalizeShareDetail(result, shareurl = "") {
  const root =
    result.data?.detail ||
    result.data?.data ||
    result.data ||
    result.detail ||
    result;
  const rows = firstNonEmpty(
    flattenFiles(root?.filelist),
    flattenFiles(root?.files),
    flattenFiles(root?.list),
    flattenFiles(root)
  );

  return rows.map((file, index) => {
    const original =
      file.name ||
      file.file_name ||
      file.filename ||
      file.title ||
      file.original ||
      `文件 ${index + 1}`;
    const renamed =
      file.rename ||
      file.new_name ||
      file.save_name ||
      file.target_name ||
      file.magic_name ||
      file.name_after ||
      "";
    const fid = file.fid || file.file_id || "";
    return {
      name: String(original),
      renamed: String(renamed || original),
      size: file.size || file.file_size || file.include_items || "",
      isDir: Boolean(file.dir || file.isdir || file.is_dir),
      fid: String(fid),
      childShareUrl: fid ? makeShareDirUrl(shareurl, fid, original) : "",
      previewUrl: file.preview_url || file.thumbnail || ""
    };
  });
}

function makeShareDirUrl(shareurl, fid, name) {
  const base = String(shareurl || "").split("#")[0];
  return `${base}#/list/share/${encodeURIComponent(fid)}-${encodeURIComponent(String(name || ""))}`;
}

function firstNonEmpty(...lists) {
  return lists.find((list) => Array.isArray(list) && list.length) || [];
}

function flattenFiles(value) {
  if (!value) return [];
  const output = [];
  const stack = Array.isArray(value) ? [...value] : [value];
  while (stack.length) {
    const item = stack.shift();
    if (!item || typeof item !== "object") continue;
    const children = item.children || item.filelist || item.files || item.list;
    if (Array.isArray(children)) stack.push(...children);
    if (item.name || item.file_name || item.filename || item.title) output.push(item);
  }
  return output;
}

function normalizeSearchKeyword(text) {
  return text
    .replace(/^(搜索|搜|找|查找|帮我找|search)\s*/i, "")
    .replace(/(最新|资源|夸克|网盘|转存)$/g, "")
    .trim();
}

function extractShareUrl(text) {
  const match = String(text || "").match(/https?:\/\/pan\.quark\.cn\/s\/[A-Za-z0-9_-]+/);
  return match ? match[0] : "";
}

function extractSavePath(text) {
  const match = String(text || "").match(/(?:保存到|存到|目录|路径)\s*([/／][^\s，,]+)/);
  return match ? match[1].replaceAll("／", "/") : "";
}

function guessName(text) {
  const cleaned = String(text || "")
    .replace(extractShareUrl(text), "")
    .replace(/保存到.+$/, "")
    .trim();
  return cleaned.length > 1 ? cleaned : "";
}

function sanitizePathName(name) {
  return String(name || "未命名").replace(/[\\:*?"<>|]/g, "").trim() || "未命名";
}

function assistantMessage(message) {
  return { success: true, type: "message", message };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...res.getHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function serveStatic(res, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, cleanPath));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end("Not found");
  }
  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  res.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300"
  });
  fs.createReadStream(filePath).pipe(res);
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function numberEnv(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function requiresPassword(req) {
  if (!env.webPassword) return false;
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  return url.pathname.startsWith("/api/");
}

function isAuthorized(req) {
  if (!env.webPassword) return true;
  const token = sessionToken(req);
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  sessions.set(token, Date.now() + sessionTtlMs);
  return true;
}

function sessionToken(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)qas_media_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function makeSessionCookie(req, token) {
  const isHttps = req.headers["x-forwarded-proto"] === "https";
  return [
    `qas_media_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=604800",
    isHttps ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
}

function clearSessionCookie() {
  return "qas_media_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

function startTelegramBot() {
  if (!env.telegramToken) return;
  setInterval(pollTelegram, 2500);
  pollTelegram();
}

async function pollTelegram() {
  try {
    const params = new URLSearchParams({
      timeout: "1",
      offset: String(telegramState.offset)
    });
    const response = await fetch(`https://api.telegram.org/bot${env.telegramToken}/getUpdates?${params}`);
    const data = await response.json();
    if (!data.ok) return;
    for (const update of data.result || []) {
      telegramState.offset = update.update_id + 1;
      const message = update.message?.text || "";
      const chatId = String(update.message?.chat?.id || "");
      if (!message || !chatId) continue;
      if (env.telegramAllowedChatIds.size && !env.telegramAllowedChatIds.has(chatId)) {
        await telegramSend(chatId, "这个会话没有使用权限。");
        continue;
      }
      await handleTelegramMessage(chatId, message);
    }
  } catch (error) {
    console.error("Telegram polling failed:", error.message);
  }
}

async function handleTelegramMessage(chatId, text) {
  if (/^\/tasks/.test(text)) {
    const data = await qasData();
    const tasks = Array.isArray(data.data?.tasklist) ? data.data.tasklist : [];
    await telegramSend(chatId, tasks.length ? tasks.map((task, i) => `${i + 1}. ${task.taskname}`).join("\n") : "暂无任务");
    return;
  }

  if (/^\/save\s+/.test(text)) {
    const [, indexText, ...pathParts] = text.split(/\s+/);
    const index = Number(indexText) - 1;
    const list = telegramState.lastResults.get(chatId) || [];
    const item = list[index];
    if (!item) return telegramSend(chatId, "没有找到这个候选编号，请先 /search 片名。");
    const savepath = pathParts.join(" ") || `${env.defaultSaveRoot}/${sanitizePathName(item.title)}`;
    const result = await addTask({
      taskname: item.title,
      shareurl: item.shareurl,
      savepath,
      pattern: "$TV"
    });
    await telegramSend(chatId, result.success ? `已创建任务：${item.title}` : `创建失败：${result.message}`);
    return;
  }

  const query = text.replace(/^\/search\s*/i, "").trim();
  const result = await searchResources(query, env.searchDepth);
  if (!result.success) return telegramSend(chatId, result.message);
  telegramState.lastResults.set(chatId, result.data);
  const lines = result.data.slice(0, 8).map((item, index) => `${index + 1}. ${item.title}\n${item.shareurl}`);
  await telegramSend(chatId, lines.length ? lines.join("\n\n") : "没有搜到候选资源。");
}

async function telegramSend(chatId, text) {
  await fetch(`https://api.telegram.org/bot${env.telegramToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 3900) })
  });
}
