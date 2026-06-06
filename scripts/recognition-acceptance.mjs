import fs from "node:fs";
import vm from "node:vm";

function fakeEl() {
  return {
    addEventListener() {},
    querySelector() {
      return fakeEl();
    },
    querySelectorAll() {
      return [];
    },
    append() {},
    remove() {},
    focus() {},
    select() {},
    classList: { toggle() {} },
    style: { setProperty() {} },
    dataset: {},
    checked: false,
    value: "",
    textContent: "",
    innerHTML: "",
    disabled: false
  };
}

const context = {
  console,
  setTimeout,
  clearTimeout,
  Map,
  Number,
  String,
  RegExp,
  JSON,
  Math,
  URL,
  fetch: async () => ({
    status: 200,
    json: async () => ({ success: false, data: { authenticated: false } })
  }),
  document: {
    body: fakeEl(),
    querySelector: () => fakeEl(),
    querySelectorAll: () => [],
    createElement: () => fakeEl()
  },
  window: { confirm: () => true, scrollTo() {} }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync("public/app.js", "utf8"), context);

process.env.NODE_ENV = "test";
const { __test: serverTest } = await import("../server.js");

const prefix = "奔跑吧 第十季";
const cases = [
  {
    name: "2026.04.23-精编特辑.mp4",
    fileType: "special",
    label: "特辑",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260423-精编特辑.mp4"
  },
  {
    name: "2026.04.25-发布会(1).mp4",
    fileType: "press",
    label: "发布会",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260425-发布会(1).mp4"
  },
  {
    name: "20260427.第1期加更.mp4",
    fileType: "bonus",
    label: "加更",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260427-第1期加更.mp4"
  },
  {
    name: "20260428特别加更.mp4",
    fileType: "bonus",
    label: "加更",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260428-特别加更.mp4"
  },
  {
    name: "20260504.第2期特别加更.mp4",
    fileType: "bonus",
    label: "加更",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260504-第2期特别加更.mp4"
  },
  {
    name: "20260510.纯享版.mp4",
    fileType: "pure",
    label: "纯享",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260510-纯享版.mp4"
  },
  {
    name: "20260512期.纯享版.mp4",
    fileType: "pure",
    label: "纯享",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260512期-纯享版.mp4"
  },
  {
    name: "20260513.纯享版.mp4",
    fileType: "pure",
    label: "纯享",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260513-纯享版.mp4"
  },
  {
    name: "20260521.泥潭游戏纯享.mp4",
    fileType: "pure",
    label: "纯享",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260521-泥潭游戏纯享.mp4"
  },
  {
    name: "第25期.mp4",
    cleanName: "第25期.mp4",
    fileType: "main",
    label: "第25期",
    countsAsEpisode: true,
    preview: "奔跑吧 第十季-第25期.mp4"
  },
  {
    name: "2026.04.24-第1期完整版 4KFR酒Co🌙z.mp4",
    cleanName: "2026.04.24-第1期完整版.mp4",
    fileType: "main",
    label: "第1期",
    versionTag: "完整版",
    countsAsEpisode: true,
    preview: "奔跑吧 第十季-20260424-第1期-完整版.mp4"
  },
  {
    name: "2026.04.20-十亿吨跑男的料第2期 4UDB⚙信x.mp4",
    cleanName: "2026.04.20-十亿吨跑男的料第2期.mp4",
    fileType: "unknown",
    label: "待确认",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260420-十亿吨跑男的料第2期.mp4"
  },
  {
    name: "2026.05.01-第2期 4K8WTyu🔥3流G.mp4",
    cleanName: "2026.05.01-第2期.mp4",
    fileType: "main",
    label: "第2期",
    countsAsEpisode: true,
    preview: "奔跑吧 第十季-20260501-第2期.mp4"
  },
  {
    name: "2026.05.11-第3期加更 4Kjo使 fiNL.mp4",
    cleanName: "2026.05.11-第3期加更.mp4",
    fileType: "bonus",
    label: "加更",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260511-第3期加更.mp4"
  },
  {
    name: "2026.05.11-第3期加更-高码率 4K玥 2GS3T8.mp4",
    cleanName: "2026.05.11-第3期加更-高码率.mp4",
    fileType: "bonus",
    label: "加更",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260511-第3期加更-高码率.mp4"
  },
  {
    name: "2026.05.11-第3期特别加更 4KZz6wLaG物txD.mp4",
    cleanName: "2026.05.11-第3期特别加更.mp4",
    fileType: "bonus",
    label: "加更",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260511-第3期特别加更.mp4"
  },
  {
    name: "第1期完整版.mp4",
    cleanName: "第1期完整版.mp4",
    fileType: "main",
    label: "第1期",
    versionTag: "完整版",
    countsAsEpisode: true,
    preview: "奔跑吧 第十季-第1期-完整版.mp4"
  },
  {
    name: "第1期会员版.mp4",
    cleanName: "第1期会员版.mp4",
    fileType: "main",
    label: "第1期",
    versionTag: "会员版",
    countsAsEpisode: true,
    preview: "奔跑吧 第十季-第1期-会员版.mp4"
  },
  {
    name: "第1期高码率.mp4",
    cleanName: "第1期高码率.mp4",
    fileType: "main",
    label: "第1期",
    versionTag: "高码率",
    countsAsEpisode: true,
    preview: "奔跑吧 第十季-第1期-高码率.mp4"
  },
  {
    name: "第1期 4K.mp4",
    cleanName: "第1期4K.mp4",
    fileType: "main",
    label: "第1期",
    versionTag: "4K",
    countsAsEpisode: true,
    preview: "奔跑吧 第十季-第1期-4K.mp4"
  },
  {
    name: "2026-05-26《副本解锁中》第1期.mp4",
    cleanName: "2026-05-26《副本解锁中第1期.mp4",
    fileType: "extra",
    label: "衍生",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260526-副本解锁中第1期.mp4"
  },
  {
    name: "2026-05-27 第1期上.mp4",
    cleanName: "2026-05-27第1期上.mp4",
    fileType: "main",
    label: "第1期上",
    countsAsEpisode: true,
    preview: "奔跑吧 第十季-20260527-第1期上.mp4"
  },
  {
    name: "2026-05-28 第1期下.mp4",
    cleanName: "2026-05-28第1期下.mp4",
    fileType: "main",
    label: "第1期下",
    countsAsEpisode: true,
    preview: "奔跑吧 第十季-20260528-第1期下.mp4"
  },
  {
    name: "2026-05-28《副本存档中》第1期 4K 60FPS.mp4",
    cleanName: "2026-05-28《副本存档中第1期-4K.mp4",
    fileType: "extra",
    label: "衍生",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260528-副本存档中第1期-4K.mp4"
  },
  {
    name: "2026-05-29 居民采访第1期.mp4",
    cleanName: "2026-05-29 居民采访第1期.mp4",
    fileType: "extra",
    label: "衍生",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260529-居民采访第1期.mp4"
  },
  {
    name: "20260530普通文件.mp4",
    cleanName: "20260530普通文件.mp4",
    fileType: "unknown",
    label: "待确认",
    countsAsEpisode: false,
    preview: "奔跑吧 第十季-20260530普通文件.mp4"
  }
];

const failures = [];
for (let index = 0; index < cases.length; index += 1) {
  const expected = cases[index];
  const cleanName = context.cleanRecognitionName(expected.name);
  const analysis = context.analyzeVarietyFileName(cleanName, index + 1);
  const actual = {
    cleanName,
    fileType: analysis.fileType,
    label: analysis.label,
    versionTag: analysis.versionTag || "",
    countsAsEpisode: analysis.countsAsEpisode,
    preview: context.buildPreviewName(prefix, ".mp4", analysis, 3, cleanName)
  };
  for (const key of Object.keys(actual).filter((item) => item in expected)) {
    if (actual[key] !== expected[key]) {
      failures.push({
        name: expected.name,
        key,
        expected: expected[key],
        actual: actual[key]
      });
    }
  }
}

const duplicates = context.duplicateTaskTargets([
  { task: { savepath: "/a", replace: "same.mp4" }, name: "1" },
  { task: { savepath: "/a", replace: "same.mp4" }, name: "2" },
  { task: { savepath: "/b", replace: "same.mp4" }, name: "3" }
]);
if (duplicates.length !== 1 || !duplicates[0].includes("same.mp4")) {
  failures.push({
    name: "duplicate target check",
    key: "duplicates",
    expected: "one duplicate in the same save path",
    actual: duplicates
  });
}

const localUpper = context.analyzeVarietyFileName(context.cleanRecognitionName("2026-05-27 第1期上.mp4"), 1);
const mergedUpper = context.mergeAiAnalysis(localUpper, {
  originalName: "2026-05-27 第1期上.mp4",
  mediaType: "variety",
  fileType: "main",
  number: 1,
  episodeLabel: "第1期",
  confidence: 0.99,
  needsConfirm: false
});
if (mergedUpper.label !== "第1期上") {
  failures.push({
    name: "AI merge protection",
    key: "label",
    expected: "第1期上",
    actual: mergedUpper.label
  });
}

const conflictPreview = context.markPreviewConflicts([
  { name: "a.mp4", previewName: "same.mp4" },
  { name: "b.mp4", previewName: "same.mp4" },
  { name: "c.mp4", previewName: "other.mp4" }
]);
if (!conflictPreview[0].hasConflict || !conflictPreview[1].hasConflict || conflictPreview[2].hasConflict) {
  failures.push({
    name: "preview conflict check",
    key: "hasConflict",
    expected: "only duplicate preview names are marked",
    actual: conflictPreview
  });
}

const unknownSuffixAnalysis = context.analyzeVarietyFileName(context.cleanRecognitionName("2026-05-28 第1期下 臻彩版 4K.mp4"), 1);
const unknownSuffixPreview = context.buildPreviewName(prefix, ".mp4", unknownSuffixAnalysis, 3, "2026-05-28 第1期下 臻彩版 4K.mp4");
if (!unknownSuffixAnalysis.unknownSuffixes?.includes("臻彩版") || unknownSuffixPreview.includes("臻彩版")) {
  failures.push({
    name: "unknown variety suffix waits for confirmation",
    key: "unknownSuffixes",
    expected: "臻彩版 is detected but not added to final name",
    actual: { unknownSuffixes: unknownSuffixAnalysis.unknownSuffixes, preview: unknownSuffixPreview }
  });
}

vm.runInContext('state.suffixConfig = { systemDisabled: [], user: ["臻彩版"] };', context);
const knownSuffixAnalysis = context.analyzeVarietyFileName(context.cleanRecognitionName("2026-05-28 第1期下 臻彩版 4K.mp4"), 1);
const knownSuffixPreview = context.buildPreviewName(prefix, ".mp4", knownSuffixAnalysis, 3, "2026-05-28 第1期下 臻彩版 4K.mp4");
vm.runInContext('state.suffixConfig = { systemDisabled: [], user: [] };', context);
if (knownSuffixAnalysis.unknownSuffixes?.length || !knownSuffixPreview.includes("臻彩版")) {
  failures.push({
    name: "user suffix is kept automatically",
    key: "versionTag",
    expected: "臻彩版 is treated as a known suffix",
    actual: { unknownSuffixes: knownSuffixAnalysis.unknownSuffixes, preview: knownSuffixPreview }
  });
}

const searchCandidates = [
  serverTest.normalizeCandidate({ title: "开始推理吧 2026-06-03", shareurl: "https://pan.quark.cn/s/newer" }, 0),
  serverTest.normalizeCandidate({ title: "开始推理吧 2026-05-28", shareurl: "https://pan.quark.cn/s/older" }, 1),
  serverTest.normalizeCandidate({ title: "开始推理吧 无日期", date: "2026-06-01", shareurl: "https://pan.quark.cn/s/explicit" }, 2)
];
const sortedSearch = serverTest.sortCandidatesByTime(searchCandidates);
if (
  sortedSearch[0].displayTime !== "2026-05-28" ||
  sortedSearch[1].displayTime !== "2026-06-01" ||
  sortedSearch[2].displayTime !== "2026-06-03"
) {
  failures.push({
    name: "search display time and sort",
    key: "displayTime",
    expected: ["2026-05-28", "2026-06-01", "2026-06-03"],
    actual: sortedSearch.map((item) => item.displayTime)
  });
}

const sameNameAiItems = serverTest.normalizeAiRenameItems([
  {
    fileId: "file-a",
    originalName: "same.mp4",
    mediaType: "variety",
    fileType: "main",
    number: 1,
    episodeLabel: "第1期",
    confidence: 0.96,
    needsConfirm: false
  },
  {
    fileId: "file-b",
    originalName: "same.mp4",
    mediaType: "variety",
    fileType: "extra",
    title: "居民采访第1期",
    confidence: 0.97,
    needsConfirm: false
  }
], [
  { fileId: "file-a", originalName: "same.mp4", name: "same.mp4" },
  { fileId: "file-b", originalName: "same.mp4", name: "same.mp4" }
], 0.75);
const sameNameAiMap = new Map(sameNameAiItems.map((item) => [item.fileId, item]));
const firstSameName = context.findAiItem(sameNameAiMap, { fileId: "file-a", name: "same.mp4" }, 0);
const secondSameName = context.findAiItem(sameNameAiMap, { fileId: "file-b", name: "same.mp4" }, 1);
if (sameNameAiItems.length !== 2 || firstSameName?.fileType !== "main" || secondSameName?.fileType !== "extra") {
  failures.push({
    name: "same original name AI match by fileId",
    key: "fileId",
    expected: "same filename keeps two different AI results",
    actual: sameNameAiItems
  });
}

const shareDraft = await serverTest.chat("开始推理吧第四季 https://pan.quark.cn/s/abcDEF123");
if (shareDraft.type !== "draft" || shareDraft.draft?.shareurl !== "https://pan.quark.cn/s/abcDEF123") {
  failures.push({
    name: "share link goes to preview draft",
    key: "type",
    expected: "draft with extracted quark share url",
    actual: shareDraft
  });
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log(`Recognition acceptance passed: ${cases.length} naming cases + search time + fileId AI + share draft + suffix checks.`);
