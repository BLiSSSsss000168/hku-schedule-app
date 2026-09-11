const STORAGE_KEY = "hku-schedule-app-v2-empty";
const REMINDER_KEY = "hku-schedule-reminder-v1";

const DAYS = [
  { index: 0, short: "周日", name: "Sunday", label: "日" },
  { index: 1, short: "周一", name: "Monday", label: "一" },
  { index: 2, short: "周二", name: "Tuesday", label: "二" },
  { index: 3, short: "周三", name: "Wednesday", label: "三" },
  { index: 4, short: "周四", name: "Thursday", label: "四" },
  { index: 5, short: "周五", name: "Friday", label: "五" },
  { index: 6, short: "周六", name: "Saturday", label: "六" },
];

const SESSION_COLORS = {
  LEC: "#9DC3E6",
  TUT: "#F4B183",
};

const DEFAULT_SESSIONS = [];

const ui = {
  tab: "schedule",
  scheduleMode: "day",
  selectedDay: getTodayDayIndex(),
  search: "",
  importMode: "merge",
  activeImageBlob: null,
  activeImageUrl: "",
};

let sessions = loadSessions();
let reminderSettings = loadReminderSettings();

const view = document.querySelector("#view");
const pageTitle = document.querySelector("#page-title");
const headerActions = document.querySelector("#header-actions");
const modalRoot = document.querySelector("#modal-root");
const toast = document.querySelector("#toast");
const filePicker = document.querySelector("#html-file-picker");

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadSessions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(stored)) {
      return stored.map(normalizeSession).filter(Boolean);
    }
  } catch (error) {
    console.warn("Unable to load saved timetable", error);
  }
  return DEFAULT_SESSIONS;
}

function loadReminderSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(REMINDER_KEY) || "null");
    if (stored && typeof stored === "object") {
      return {
        enabled: Boolean(stored.enabled),
        minutes: Math.min(120, Math.max(1, Number(stored.minutes) || 10)),
        permission: String(stored.permission || "unknown"),
        scheduledCount: Math.max(0, Number(stored.scheduledCount) || 0),
      };
    }
  } catch (error) {
    console.warn("Unable to load reminder settings", error);
  }
  return {
    enabled: false,
    minutes: 10,
    permission: "unknown",
    scheduledCount: 0,
  };
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function saveReminderSettings() {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(reminderSettings));
}

function normalizeSession(value) {
  if (!value || typeof value !== "object") return null;
  const code = String(value.code || "").trim().toUpperCase();
  const start = normalizeTime(value.start);
  const end = normalizeTime(value.end);
  if (!code || !start || !end) return null;

  return {
    id: String(value.id || makeId()),
    code,
    section: String(value.section || "").trim(),
    type: String(value.type || "LEC").toUpperCase() === "TUT" ? "TUT" : "LEC",
    day: Math.min(6, Math.max(0, Number(value.day) || 0)),
    start,
    end,
    location: String(value.location || "").trim(),
    notes: String(value.notes || "").trim(),
    source: String(value.source || "manual"),
  };
}

function normalizeTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getTodayDayIndex() {
  const day = new Date().getDay();
  return day === 0 || day === 6 ? 1 : day;
}

function timeToMinutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function durationMinutes(session) {
  return Math.max(0, timeToMinutes(session.end) - timeToMinutes(session.start));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function refreshIcons() {
  if (globalThis.lucide?.createIcons) {
    lucide.createIcons({ icons: lucide.icons });
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function sortedSessions(items = sessions) {
  return [...items].sort(
    (a, b) =>
      a.day - b.day ||
      timeToMinutes(a.start) - timeToMinutes(b.start) ||
      a.code.localeCompare(b.code),
  );
}

function activeDays() {
  const hasWeekend = sessions.some((session) => session.day === 0 || session.day === 6);
  return DAYS.filter((day) => day.index >= 1 && day.index <= 5 || hasWeekend);
}

function weekDates() {
  const now = new Date();
  const monday = new Date(now);
  const weekday = now.getDay() === 0 ? 7 : now.getDay();
  monday.setDate(now.getDate() - weekday + 1);
  return DAYS.map((day) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + ((day.index + 6) % 7));
    return date;
  });
}

function sessionsForDay(dayIndex) {
  return sortedSessions(sessions.filter((session) => session.day === dayIndex));
}

function courseGroups() {
  const groups = new Map();
  for (const session of sortedSessions()) {
    if (!groups.has(session.code)) groups.set(session.code, []);
    groups.get(session.code).push(session);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function render() {
  const renderers = {
    schedule: renderSchedule,
    courses: renderCourses,
    export: renderExport,
    reminder: renderReminder,
  };
  renderers[ui.tab]();
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === ui.tab);
  });
  refreshIcons();
}

function renderSchedule() {
  pageTitle.textContent = "课表";
  headerActions.innerHTML = `
    <button class="icon-button" type="button" data-action="open-image" title="生成课表图片" aria-label="生成课表图片">
      <i data-lucide="image"></i>
    </button>
    <button class="icon-button" type="button" data-action="add-course" title="手动添加课程" aria-label="手动添加课程">
      <i data-lucide="plus"></i>
    </button>
  `;

  const courseCount = new Set(sessions.map((session) => session.code)).size;
  const lecCount = sessions.filter((session) => session.type === "LEC").length;
  const tutCount = sessions.filter((session) => session.type === "TUT").length;

  view.innerHTML = `
    <div class="stat-strip">
      <div class="stat"><strong>${courseCount}</strong><span>门课程</span></div>
      <div class="stat"><strong>${lecCount}</strong><span>LEC 时段</span></div>
      <div class="stat"><strong>${tutCount}</strong><span>TUT 时段</span></div>
    </div>
    <div class="toolbar-row">
      <div class="segmented" aria-label="课表显示方式">
        <button class="${ui.scheduleMode === "day" ? "is-active" : ""}" type="button" data-action="mode-day">按天</button>
        <button class="${ui.scheduleMode === "week" ? "is-active" : ""}" type="button" data-action="mode-week">周视图</button>
      </div>
      <span class="meta-line">${sessions.length} 个时段</span>
    </div>
    <div id="schedule-content"></div>
  `;

  const content = document.querySelector("#schedule-content");
  if (sessions.length === 0) {
    content.innerHTML = emptyState(
      "calendar-plus",
      "还没有课程",
      "上传 HKU 网页或手动添加课程后，课表会显示在这里。",
      "手动添加",
      "add-course",
    );
    return;
  }
  content.innerHTML = ui.scheduleMode === "week" ? weekViewHtml() : dayViewHtml();
}

function weekViewHtml() {
  const days = activeDays();
  const dates = weekDates();
  const startMinute = 8 * 60;
  const endMinute = 20 * 60;
  const slotHeight = 30;
  const totalSlots = (endMinute - startMinute) / 30;
  const bodyHeight = totalSlots * slotHeight;
  const dateByDay = new Map(dates.map((date) => [date.getDay(), date]));

  const header = days
    .map((day) => {
      const date = dateByDay.get(day.index);
      return `<div class="week-day"><div><strong>${day.short}</strong><small>${date ? `${date.getMonth() + 1}/${date.getDate()}` : ""}</small></div></div>`;
    })
    .join("");

  const lanes = days
    .map((day) => {
      const blocks = sessionsForDay(day.index)
        .map((session) => {
          const top = ((timeToMinutes(session.start) - startMinute) / 30) * slotHeight;
          const height = Math.max(
            38,
            (durationMinutes(session) / 30) * slotHeight - 2,
          );
          return `
            <button
              class="class-block ${session.type.toLowerCase()}"
              type="button"
              data-action="edit-session"
              data-id="${escapeAttribute(session.id)}"
              style="top:${top}px;height:${height}px"
              title="编辑 ${escapeAttribute(session.code)}-${escapeAttribute(session.section)}"
            >
              <strong>${escapeHtml(session.code)}-${escapeHtml(session.section)}</strong>
              <span>${session.start}-${session.end}</span>
              <span>${session.location ? `@${escapeHtml(session.location)}` : session.type}</span>
            </button>
          `;
        })
        .join("");
      return `<div class="day-lane" style="height:${bodyHeight}px">${blocks}</div>`;
    })
    .join("");

  const axisLabels = Array.from({ length: totalSlots / 2 + 1 }, (_, index) => {
    const minute = startMinute + index * 60;
    return `<span class="time-label" style="top:${index * slotHeight * 2}px">${String(Math.floor(minute / 60)).padStart(2, "0")}:00</span>`;
  }).join("");

  return `
    <div class="week-hint">
      <i data-lucide="move-horizontal"></i>
      <span>左右滑动查看整周</span>
    </div>
    <div class="week-scroll">
      <div class="week-grid" style="--day-count:${days.length}">
        <div class="week-corner"></div>
        ${header}
        <div class="time-axis" style="height:${bodyHeight}px">${axisLabels}</div>
        ${lanes}
      </div>
    </div>
  `;
}

function dayViewHtml() {
  const dateByDay = new Map(weekDates().map((date) => [date.getDay(), date]));
  const picker = DAYS.filter((day) => day.index >= 1 && day.index <= 5)
    .map((day) => {
      const date = dateByDay.get(day.index);
      return `
        <button class="day-chip ${ui.selectedDay === day.index ? "is-active" : ""}" type="button" data-action="select-day" data-day="${day.index}">
          ${day.short}
          <small>${date ? `${date.getMonth() + 1}/${date.getDate()}` : ""}</small>
        </button>
      `;
    })
    .join("");
  const items = sessionsForDay(ui.selectedDay);
  const list = items.length
    ? `<div class="session-list">${items.map(sessionCardHtml).join("")}</div>`
    : emptyState(
        "calendar-check",
        "当天没有课程",
        "你可以切换到其他日期，或手动添加一个新时段。",
        "添加课程",
        "add-course",
      );
  return `<div class="day-picker">${picker}</div>${list}`;
}

function sessionCardHtml(session) {
  const day = DAYS.find((item) => item.index === session.day)?.short || "";
  const detail = [session.location ? `@${session.location}` : "", session.notes]
    .filter(Boolean)
    .join(" · ");
  return `
    <article class="session-card ${session.type.toLowerCase()}">
      <div class="session-time">
        <strong>${session.start}</strong>
        <span>${session.end}</span>
      </div>
      <div class="session-main">
        <h3>${escapeHtml(session.code)}-${escapeHtml(session.section)} · ${session.type}</h3>
        <p>${escapeHtml(day)}${detail ? ` · ${escapeHtml(detail)}` : ""}</p>
      </div>
      <div class="session-actions">
        <button class="mini-button" type="button" data-action="edit-session" data-id="${escapeAttribute(session.id)}" title="编辑" aria-label="编辑课程">
          <i data-lucide="pencil"></i>
        </button>
        <button class="mini-button danger" type="button" data-action="delete-session" data-id="${escapeAttribute(session.id)}" title="删除" aria-label="删除课程">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </article>
  `;
}

function renderCourses() {
  pageTitle.textContent = "课程";
  headerActions.innerHTML = `
    <button class="icon-button" type="button" data-action="add-course" title="添加课程" aria-label="添加课程">
      <i data-lucide="plus"></i>
    </button>
  `;

  const query = ui.search.trim().toLowerCase();
  const filtered = sessions.filter((session) => {
    if (!query) return true;
    return [
      session.code,
      session.section,
      session.type,
      session.location,
      session.notes,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const groups = new Map();
  for (const session of sortedSessions(filtered)) {
    if (!groups.has(session.code)) groups.set(session.code, []);
    groups.get(session.code).push(session);
  }

  view.innerHTML = `
    <input id="course-search" class="search-field" type="search" value="${escapeAttribute(ui.search)}" placeholder="搜索课程、教室或备注" autocomplete="off">
    <div id="course-results">
      ${
        groups.size
          ? `<div class="course-list">${[...groups.entries()]
              .map(([code, items]) => courseCardHtml(code, items))
              .join("")}</div>`
          : emptyState(
              "search-x",
              "没有匹配的课程",
              query ? "请尝试其他关键词。" : "点击右上角加号添加课程。",
              query ? "清除搜索" : "添加课程",
              query ? "clear-search" : "add-course",
            )
      }
    </div>
  `;

  document.querySelector("#course-search")?.addEventListener("input", (event) => {
    ui.search = event.target.value;
    const caret = event.target.selectionStart;
    renderCourses();
    refreshIcons();
    const nextInput = document.querySelector("#course-search");
    nextInput?.focus();
    nextInput?.setSelectionRange(caret, caret);
  });
}

function courseCardHtml(code, items) {
  const rows = items
    .map((session) => {
      const day = DAYS.find((item) => item.index === session.day)?.short || "";
      const detail = [session.location, session.notes].filter(Boolean).join(" · ");
      return `
        <div class="course-session-row">
          <strong>${day} ${session.start}</strong>
          <span>${session.type} · Section ${escapeHtml(session.section)}${detail ? ` · ${escapeHtml(detail)}` : ""}</span>
          <div class="course-session-actions">
            <button class="mini-button" type="button" data-action="edit-session" data-id="${escapeAttribute(session.id)}" title="编辑时段" aria-label="编辑时段">
              <i data-lucide="pencil"></i>
            </button>
            <button class="mini-button danger" type="button" data-action="delete-session" data-id="${escapeAttribute(session.id)}" title="删除时段" aria-label="删除时段">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <article class="course-card">
      <div class="course-card-header">
        <div class="course-code">
          <h3>${escapeHtml(code)}</h3>
        </div>
        <div class="session-actions">
          <button class="text-button" type="button" data-action="add-course" data-code="${escapeAttribute(code)}" title="添加该课程时段" aria-label="添加该课程时段">
            <i data-lucide="plus"></i>
            添加时段
          </button>
        </div>
      </div>
      <div class="course-sessions">${rows}</div>
    </article>
  `;
}

function renderExport() {
  pageTitle.textContent = "导入导出";
  headerActions.innerHTML = "";
  view.innerHTML = `
    <section class="section-card import-card">
      <h2>导入本地网页</h2>
      <p>选择 HKU Event Calendar 保存的网页。若主文件使用 frameset，请选择资源文件夹中的 <strong>HKUESD_files/esd.html</strong>，也可一次选择多个 HTML 文件。</p>
      <div class="field full">
        <label for="import-mode">导入方式</label>
        <select id="import-mode">
          <option value="merge" ${ui.importMode === "merge" ? "selected" : ""}>合并并更新相同课程</option>
          <option value="replace" ${ui.importMode === "replace" ? "selected" : ""}>替换全部现有课程</option>
        </select>
      </div>
      <div class="button-stack" style="margin-top:14px">
        <button class="primary-button" type="button" data-action="import-html">
          <i data-lucide="file-up"></i>
          选择 HTML 文件
        </button>
        <button class="secondary-button" type="button" data-action="add-course">
          <i data-lucide="plus"></i>
          手动添加课程
        </button>
      </div>
    </section>

    <section class="section-card export-card">
      <h2>生成课表图片</h2>
      <p>生成高清 PNG 周课表，包含课程代码、时间、类型、教室和备注入口。可以直接保存到相册或分享。</p>
      <div class="button-stack">
        <button class="primary-button" type="button" data-action="open-image">
          <i data-lucide="image"></i>
          预览并导出图片
        </button>
      </div>
    </section>

    <section class="section-card export-card">
      <h2>本地数据</h2>
      <p>课表只保存在当前设备。导入新网页不会删除手动填写的教室和备注，除非手动清空数据。</p>
      <div class="button-stack">
        <button class="secondary-button" type="button" data-action="export-json">
          <i data-lucide="download"></i>
          导出数据备份
        </button>
        <button class="danger-button" type="button" data-action="clear-all">
          <i data-lucide="trash-2"></i>
          清空所有课程
        </button>
      </div>
    </section>

    <p class="footer-note">支持 iOS 文件 App 中的本地 HTML 文件。导入前无需登录 HKU 系统。</p>
  `;

  document.querySelector("#import-mode")?.addEventListener("change", (event) => {
    ui.importMode = event.target.value;
  });
}

function renderReminder() {
  pageTitle.textContent = "提醒";
  headerActions.innerHTML = "";

  const plugin = getNotificationPlugin();
  const nativeAvailable = Boolean(plugin);
  const permissionText =
    {
      granted: "已授权",
      denied: "已拒绝",
      prompt: "等待授权",
      unsupported: "当前环境不支持",
      unknown: "尚未检查",
    }[reminderSettings.permission] || "尚未检查";
  const statusClass =
    reminderSettings.permission === "granted" ? "granted" : "neutral";
  const options = [5, 10, 15, 30, 60];

  view.innerHTML = `
    <section class="section-card reminder-card">
      <div class="reminder-heading">
        <div>
          <h2>课前本地提醒</h2>
          <p>课程开始前发送 iPhone 通知。修改课程或提醒时间后会自动重新安排。</p>
        </div>
        <label class="switch-control" aria-label="启用课前提醒">
          <input id="reminder-enabled" type="checkbox" ${reminderSettings.enabled ? "checked" : ""}>
          <span></span>
        </label>
      </div>
      <div class="reminder-status">
        <span class="status-dot ${statusClass}"></span>
        <span>通知权限：${escapeHtml(permissionText)}</span>
        <span>·</span>
        <span>已安排 ${reminderSettings.scheduledCount} 个提醒</span>
      </div>
    </section>

    <section class="section-card export-card">
      <h2>提前时间</h2>
      <p>每节课开始前多久弹出通知。</p>
      <div class="reminder-options">
        ${options
          .map(
            (minutes) => `
              <button class="reminder-option ${reminderSettings.minutes === minutes ? "is-active" : ""}" type="button" data-action="set-reminder-minutes" data-minutes="${minutes}">
                ${minutes} 分钟
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="field" style="margin-top:14px">
        <label for="reminder-minutes">自定义分钟数</label>
        <input id="reminder-minutes" type="number" min="1" max="120" inputmode="numeric" value="${reminderSettings.minutes}">
      </div>
    </section>

    <section class="section-card export-card">
      <div class="button-stack">
        <button class="primary-button" type="button" data-action="save-reminder">
          <i data-lucide="bell-ring"></i>
          应用提醒设置
        </button>
        <button class="secondary-button" type="button" data-action="request-notification-permission">
          <i data-lucide="shield-check"></i>
          检查并申请通知权限
        </button>
      </div>
      <p class="footer-note reminder-footnote">
        ${
          nativeAvailable
            ? "提醒会在 App 关闭或锁屏后继续生效。iOS 设置中可以随时关闭通知。"
            : "当前是浏览器预览，无法提供后台弹窗。安装 iOS 工程到 iPhone 后即可使用本地通知。"
        }
      </p>
    </section>
  `;
}

function emptyState(icon, title, text, buttonLabel, action) {
  return `
    <div class="empty-state">
      <i data-lucide="${escapeAttribute(icon)}"></i>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(text)}</p>
      <button class="primary-button" type="button" data-action="${escapeAttribute(action)}">
        <i data-lucide="plus"></i>
        ${escapeHtml(buttonLabel)}
      </button>
    </div>
  `;
}

function openSessionEditor(session = null, presetCode = "") {
  const isEditing = Boolean(session);
  const model = session || {
    id: "",
    code: presetCode,
    section: "",
    type: "LEC",
    day: ui.selectedDay || 1,
    start: "09:00",
    end: "09:50",
    location: "",
    notes: "",
  };

  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="editor-title" data-stop-close>
        <div class="sheet-header">
          <h2 id="editor-title">${isEditing ? "编辑课程" : "添加课程"}</h2>
          <button class="icon-button" type="button" data-action="close-modal" aria-label="关闭">
            <i data-lucide="x"></i>
          </button>
        </div>
        <form id="session-form">
          <div class="form-grid">
            <div class="field">
              <label for="session-code">课程代码</label>
              <input id="session-code" name="code" required maxlength="18" value="${escapeAttribute(model.code)}" placeholder="ABCD1234" autocapitalize="characters">
            </div>
            <div class="field">
              <label for="session-section">Section</label>
              <input id="session-section" name="section" maxlength="12" value="${escapeAttribute(model.section)}" placeholder="1E">
            </div>
            <div class="field full">
              <label>类型</label>
              <input id="session-type" name="type" type="hidden" value="${escapeAttribute(model.type)}">
              <div class="type-selector">
                <button class="type-option lec ${model.type === "LEC" ? "is-active" : ""}" type="button" data-action="set-type" data-type="LEC">LEC</button>
                <button class="type-option tut ${model.type === "TUT" ? "is-active" : ""}" type="button" data-action="set-type" data-type="TUT">TUT</button>
              </div>
            </div>
            <div class="field full">
              <label for="session-day">星期</label>
              <select id="session-day" name="day">
                ${DAYS.map((day) => `<option value="${day.index}" ${Number(model.day) === day.index ? "selected" : ""}>${day.short} · ${day.name}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="session-start">开始时间</label>
              <input id="session-start" name="start" type="time" required value="${escapeAttribute(model.start)}">
            </div>
            <div class="field">
              <label for="session-end">结束时间</label>
              <input id="session-end" name="end" type="time" required value="${escapeAttribute(model.end)}">
            </div>
            <div class="field full">
              <label for="session-location">教室地点</label>
              <input id="session-location" name="location" maxlength="80" value="${escapeAttribute(model.location)}" placeholder="LE1 / LG.01 / KK101">
            </div>
            <div class="field full">
              <label for="session-notes">备注</label>
              <textarea id="session-notes" name="notes" maxlength="500" placeholder="考试、作业、教师或其他信息">${escapeHtml(model.notes)}</textarea>
            </div>
          </div>
          <div class="sheet-actions">
            ${
              isEditing
                ? `<button class="danger-button" type="button" data-action="delete-session" data-id="${escapeAttribute(model.id)}">删除</button>`
                : ""
            }
            <div class="sheet-actions-right">
              <button class="secondary-button" type="button" data-action="close-modal">取消</button>
              <button class="primary-button" type="submit">
                <i data-lucide="check"></i>
                保存
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  `;

  refreshIcons();
  document.querySelector("#session-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = normalizeSession({
      id: model.id || makeId(),
      code: form.get("code"),
      section: form.get("section"),
      type: form.get("type"),
      day: form.get("day"),
      start: form.get("start"),
      end: form.get("end"),
      location: form.get("location"),
      notes: form.get("notes"),
      source: isEditing ? session.source : "manual",
    });

    if (!value) {
      showToast("请填写完整的课程代码和时间。");
      return;
    }

    if (timeToMinutes(value.end) <= timeToMinutes(value.start)) {
      showToast("结束时间必须晚于开始时间。");
      return;
    }

    if (hasConflict(value)) {
      const proceed = confirm(
        "这个时间与其他课程重叠。是否仍然保存？",
      );
      if (!proceed) return;
    }

    if (isEditing) {
      sessions = sessions.map((item) => (item.id === value.id ? value : item));
    } else {
      sessions = [...sessions, value];
    }
    saveSessions();
    syncLocalNotifications();
    closeModal();
    render();
    showToast(isEditing ? "课程已更新。" : "课程已添加。");
  });
}

function hasConflict(candidate) {
  const start = timeToMinutes(candidate.start);
  const end = timeToMinutes(candidate.end);
  return sessions.some((session) => {
    if (session.id === candidate.id || session.day !== candidate.day) return false;
    const otherStart = timeToMinutes(session.start);
    const otherEnd = timeToMinutes(session.end);
    return start < otherEnd && end > otherStart;
  });
}

function closeModal() {
  if (ui.activeImageUrl) {
    URL.revokeObjectURL(ui.activeImageUrl);
    ui.activeImageUrl = "";
  }
  ui.activeImageBlob = null;
  modalRoot.innerHTML = "";
}

function deleteSession(id) {
  const match = sessions.find((session) => session.id === id);
  if (!match) return;
  if (!confirm(`删除 ${match.code}-${match.section} (${match.type})？`)) return;
  sessions = sessions.filter((session) => session.id !== id);
  saveSessions();
  syncLocalNotifications();
  closeModal();
  render();
  showToast("课程已删除。");
}

async function importHtmlFiles(files) {
  try {
    let imported = [];
    let lastError = null;
    const fileTexts = [];

    for (const file of files) {
      const text = await file.text();
      fileTexts.push(text);
      try {
        const parsed = parseHkuHtml(text);
        if (parsed.length > imported.length) imported = parsed;
      } catch (error) {
        lastError = error;
      }
    }

    if (!imported.length) {
      if (fileTexts.some((text) => /<frameset[\s>]/i.test(text))) {
        throw new Error(
          "这是网页框架文件，请选择同一资源文件夹中的 HKUESD_files/esd.html",
        );
      }
      throw lastError || new Error("没有识别到课程时段");
    }

    if (ui.importMode === "replace") {
      sessions = imported.map((session) =>
        preserveCustomFields(session, sessions),
      );
    } else {
      sessions = mergeSessions(sessions, imported);
    }

    saveSessions();
    syncLocalNotifications();
    render();
    showToast(`已导入 ${imported.length} 个课程时段。`);
  } catch (error) {
    console.error(error);
    showToast(`导入失败：${error.message}`);
  } finally {
    filePicker.value = "";
  }
}

function parseHkuHtml(html) {
  const documentFragment = new DOMParser().parseFromString(html, "text/html");
  const headers = [
    ...documentFragment.querySelectorAll(".fc-head .fc-day-header"),
  ];
  const columns = [
    ...documentFragment.querySelectorAll(
      ".fc-time-grid .fc-content-skeleton tbody tr > td > .fc-content-col",
    ),
  ];

  if (!headers.length || headers.length !== columns.length) {
    throw new Error("页面结构无法识别，请保存完整的事件日历网页");
  }

  const imported = [];
  headers.forEach((header, dayIndex) => {
    const resolvedDay = dayIndexFromHeader(header);
    for (const event of columns[dayIndex].querySelectorAll("a.fc-event")) {
      const title = event.querySelector(".fc-title")?.textContent?.trim() || "";
      const timeText =
        event.querySelector(".fc-time")?.getAttribute("data-full") || "";
      const parsed = parseTitle(title);
      const time = parseEventTime(timeText);
      if (!parsed || !time) continue;

      const location =
        event.getAttribute("data-location") ||
        event.dataset.location ||
        event.querySelector(".fc-location")?.textContent?.trim() ||
        "";

      imported.push({
        id: makeId(),
        code: parsed.code,
        section: parsed.section,
        type: parsed.type,
        day: resolvedDay,
        start: time.start,
        end: time.end,
        location,
        notes: "",
        source: "html",
      });
    }
  });

  return imported;
}

function dayIndexFromHeader(header) {
  const classes = header.classList;
  const classDay = DAYS.find((day) =>
    classes.contains(`fc-${day.name.slice(0, 3).toLowerCase()}`),
  );
  if (classDay) return classDay.index;

  const text = header.textContent.trim().toLowerCase();
  const headerDay = DAYS.find((day) =>
    text.startsWith(day.name.slice(0, 3).toLowerCase()),
  );
  if (headerDay) return headerDay.index;
  throw new Error("无法识别课程日期");
}

function parseTitle(title) {
  const match = title.match(/^([A-Z0-9]+)-([A-Z0-9]+)\s+\((LEC|TUT)\)$/i);
  if (!match) return null;
  return {
    code: match[1].toUpperCase(),
    section: match[2].toUpperCase(),
    type: match[3].toUpperCase(),
  };
}

function parseEventTime(value) {
  const match = String(value).match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i,
  );
  if (!match) return null;
  return {
    start: twelveHourTo24(match[1], match[2], match[3]),
    end: twelveHourTo24(match[4], match[5], match[6]),
  };
}

function twelveHourTo24(hourValue, minute, period) {
  let hour = Number(hourValue) % 12;
  if (String(period).toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function sessionKey(session) {
  return [
    session.code,
    session.section,
    session.type,
    session.day,
    session.start,
    session.end,
  ].join("|");
}

function preserveCustomFields(imported, existing) {
  const previous = existing.find(
    (session) => sessionKey(session) === sessionKey(imported),
  );
  return {
    ...imported,
    location: imported.location || previous?.location || "",
    notes: imported.notes || previous?.notes || "",
  };
}

function mergeSessions(current, imported) {
  const result = current.map((session) => ({ ...session }));
  const indexByKey = new Map(
    result.map((session, index) => [sessionKey(session), index]),
  );

  for (const session of imported) {
    const key = sessionKey(session);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      result.push(session);
      indexByKey.set(key, result.length - 1);
      continue;
    }
    const existing = result[existingIndex];
    result[existingIndex] = {
      ...session,
      id: existing.id,
      location: session.location || existing.location,
      notes: session.notes || existing.notes,
    };
  }
  return result;
}

async function openImagePreview() {
  if (!sessions.length) {
    showToast("请先添加至少一个课程时段。");
    return;
  }

  const blob = await renderScheduleImage();
  ui.activeImageBlob = blob;
  ui.activeImageUrl = URL.createObjectURL(blob);
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="image-title" data-stop-close>
        <div class="sheet-header">
          <h2 id="image-title">课表图片</h2>
          <button class="icon-button" type="button" data-action="close-modal" aria-label="关闭">
            <i data-lucide="x"></i>
          </button>
        </div>
        <img class="image-preview" src="${escapeAttribute(ui.activeImageUrl)}" alt="生成的周课表">
        <div class="sheet-actions">
          <div class="sheet-actions-right">
            <button class="secondary-button" type="button" data-action="download-image">
              <i data-lucide="download"></i>
              保存图片
            </button>
            <button class="primary-button" type="button" data-action="share-image">
              <i data-lucide="share"></i>
              分享
            </button>
          </div>
        </div>
      </section>
    </div>
  `;
  refreshIcons();
}

async function renderScheduleImage() {
  const canvas = document.createElement("canvas");
  const width = 2400;
  const height = 1560;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  const background = "#f4f6f8";
  const navy = "#17365d";
  const line = "#d8dee6";
  const muted = "#66717d";
  const days = activeDays();
  const startMinute = 8 * 60;
  const endMinute = 20 * 60;
  const left = 150;
  const top = 250;
  const timeWidth = 110;
  const headerHeight = 92;
  const boardWidth = width - left - 90;
  const columnWidth = (boardWidth - timeWidth) / days.length;
  const boardHeight = 1120;
  const minuteHeight = boardHeight / (endMinute - startMinute);
  const dateByDay = new Map(weekDates().map((date) => [date.getDay(), date]));

  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  roundedRect(context, left, 82, boardWidth, height - 160, 24);
  context.fillStyle = "#ffffff";
  context.fill();
  context.strokeStyle = line;
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = navy;
  context.font = '700 68px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText("HKU Year 1 Semester 1", left + 52, 168);
  context.fillStyle = muted;
  context.font = '400 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(
    `Weekly timetable · ${sessions.length} sessions · LEC / TUT`,
    left + 52,
    208,
  );

  const gridLeft = left + 34 + timeWidth;
  const gridTop = top + headerHeight;
  context.fillStyle = "#f8fafb";
  context.fillRect(gridLeft, top, boardWidth - timeWidth - 34, headerHeight);
  context.fillStyle = navy;
  context.textAlign = "center";
  context.font = '700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  days.forEach((day, index) => {
    const x = gridLeft + columnWidth * index;
    const date = dateByDay.get(day.index);
    context.fillText(day.short, x + columnWidth / 2, top + 38);
    context.fillStyle = muted;
    context.font = '400 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(
      date ? `${date.getMonth() + 1}/${date.getDate()}` : "",
      x + columnWidth / 2,
      top + 68,
    );
    context.fillStyle = navy;
    context.font = '700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  });

  context.textAlign = "right";
  context.font = '400 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  for (let minute = startMinute; minute <= endMinute; minute += 60) {
    const y = gridTop + (minute - startMinute) * minuteHeight;
    context.fillStyle = muted;
    context.fillText(
      `${String(Math.floor(minute / 60)).padStart(2, "0")}:00`,
      gridLeft - 18,
      y + 7,
    );
    context.beginPath();
    context.moveTo(gridLeft, y);
    context.lineTo(gridLeft + columnWidth * days.length, y);
    context.strokeStyle = line;
    context.lineWidth = 1.5;
    context.stroke();
  }

  days.forEach((_, index) => {
    const x = gridLeft + columnWidth * index;
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, gridTop + boardHeight);
    context.strokeStyle = line;
    context.lineWidth = 1.5;
    context.stroke();
  });

  for (const session of sortedSessions()) {
    const dayPosition = days.findIndex((day) => day.index === session.day);
    if (dayPosition < 0) continue;
    const x = gridLeft + dayPosition * columnWidth + 10;
    const y =
      gridTop + (timeToMinutes(session.start) - startMinute) * minuteHeight + 4;
    const cardHeight = Math.max(
      62,
      durationMinutes(session) * minuteHeight - 8,
    );
    const cardWidth = columnWidth - 20;
    roundedRect(context, x, y, cardWidth, cardHeight, 12);
    context.fillStyle = SESSION_COLORS[session.type] || SESSION_COLORS.LEC;
    context.fill();
    context.strokeStyle = "rgba(45, 60, 75, 0.5)";
    context.lineWidth = 1.5;
    context.stroke();

    context.save();
    context.beginPath();
    context.rect(x + 8, y + 5, cardWidth - 16, cardHeight - 10);
    context.clip();
    context.textAlign = "left";
    context.fillStyle = "#17212b";
    const compact = cardHeight < 100;
    const titleFontSize = compact ? 21 : 24;
    const metaFontSize = compact ? 17 : 20;
    const titleBaseline = compact ? 22 : 31;
    const timeBaseline = compact ? 43 : 59;
    const locationBaseline = compact ? 64 : 87;
    context.font = `700 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    drawTruncatedText(
      context,
      `${session.code}-${session.section} (${session.type})`,
      x + 16,
      y + titleBaseline,
      cardWidth - 32,
    );
    context.font = `500 ${metaFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    drawTruncatedText(
      context,
      `${session.start}-${session.end}`,
      x + 16,
      y + timeBaseline,
      cardWidth - 32,
    );
    if (session.location) {
      drawTruncatedText(
        context,
        `@${session.location}`,
        x + 16,
        y + locationBaseline,
        cardWidth - 32,
      );
    }
    context.restore();
  }

  context.textAlign = "center";
  context.fillStyle = muted;
  context.font = '400 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(
    "Generated from HKU Schedule · Verify room and holiday changes with HKU",
    width / 2,
    height - 62,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("图片生成失败"));
    }, "image/png", 1);
  });
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawTruncatedText(context, text, x, y, maxWidth) {
  if (context.measureText(text).width <= maxWidth) {
    context.fillText(text, x, y);
    return;
  }
  let result = text;
  while (result.length > 4 && context.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  context.fillText(`${result}…`, x, y);
}

async function shareImage() {
  if (!ui.activeImageBlob) return;
  const file = new File([ui.activeImageBlob], "HKU_Timetable.png", {
    type: "image/png",
  });

  const plugins = globalThis.Capacitor?.Plugins;
  if (plugins?.Filesystem && plugins?.Share) {
    try {
      const base64 = await blobToBase64(ui.activeImageBlob);
      const path = "HKU_Timetable.png";
      await plugins.Filesystem.writeFile({
        path,
        data: base64,
        directory: "CACHE",
      });
      const result = await plugins.Filesystem.getUri({
        path,
        directory: "CACHE",
      });
      await plugins.Share.share({
        title: "HKU Timetable",
        text: "HKU Year 1 Semester 1 timetable",
        url: result.uri,
        dialogTitle: "分享课表图片",
      });
      return;
    } catch (error) {
      console.warn("Native share failed", error);
    }
  }

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "HKU Timetable",
    });
    return;
  }
  downloadBlob(ui.activeImageBlob, "HKU_Timetable.png");
}

function downloadImage() {
  if (!ui.activeImageBlob) return;
  downloadBlob(ui.activeImageBlob, "HKU_Timetable.png");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function exportJsonBackup() {
  const data = JSON.stringify({ version: 1, sessions }, null, 2);
  downloadBlob(new Blob([data], { type: "application/json" }), "HKU_Schedule.json");
  showToast("数据备份已生成。");
}

function clearAllData() {
  if (!confirm("确定清空所有课程吗？此操作无法撤销。")) return;
  sessions = [];
  saveSessions();
  syncLocalNotifications();
  render();
  showToast("所有课程已清空。");
}

function getNotificationPlugin() {
  const plugin = globalThis.Capacitor?.Plugins?.LocalNotifications;
  return plugin && typeof plugin.schedule === "function" ? plugin : null;
}

async function cancelScheduledNotifications(plugin) {
  if (typeof plugin.cancelAll === "function") {
    await plugin.cancelAll();
    return;
  }
  const pending = await plugin.getPending();
  if (pending.notifications?.length) {
    await plugin.cancel({ notifications: pending.notifications });
  }
}

async function syncLocalNotifications({ requestPermission = false } = {}) {
  const plugin = getNotificationPlugin();
  if (!plugin) {
    reminderSettings.permission = "unsupported";
    reminderSettings.scheduledCount = 0;
    saveReminderSettings();
    return { permission: "unsupported", scheduledCount: 0 };
  }

  if (!reminderSettings.enabled) {
    await cancelScheduledNotifications(plugin);
    reminderSettings.scheduledCount = 0;
    saveReminderSettings();
    return { permission: reminderSettings.permission, scheduledCount: 0 };
  }

  try {
    let permission = await plugin.checkPermissions();
    let display = permission.display || permission.notifications || "unknown";
    if (requestPermission && display !== "granted") {
      permission = await plugin.requestPermissions();
      display = permission.display || permission.notifications || "unknown";
    }

    reminderSettings.permission = display;
    if (display !== "granted") {
      reminderSettings.scheduledCount = 0;
      saveReminderSettings();
      return { permission: display, scheduledCount: 0 };
    }

    await cancelScheduledNotifications(plugin);
    const notifications = sessions.slice(0, 64).map((session, index) => {
      const leadMinutes = reminderSettings.minutes;
      let reminderDay = session.day;
      let reminderMinutes = timeToMinutes(session.start) - leadMinutes;
      if (reminderMinutes < 0) {
        reminderMinutes += 24 * 60;
        reminderDay = (reminderDay + 6) % 7;
      }
      const locationText = session.location ? ` · ${session.location}` : "";
      const notesText = session.notes ? `\n${session.notes}` : "";

      return {
        id: 100000 + index,
        title: `${leadMinutes} 分钟后上课：${session.code}-${session.section}`,
        body: `${session.start}-${session.end}${locationText}${notesText}`,
        foreground: true,
        silent: false,
        schedule: {
          on: {
            weekday: reminderDay + 1,
            hour: Math.floor(reminderMinutes / 60),
            minute: reminderMinutes % 60,
          },
          repeats: true,
        },
      };
    });

    if (notifications.length) {
      await plugin.schedule({ notifications });
    }
    reminderSettings.scheduledCount = notifications.length;
    saveReminderSettings();
    return {
      permission: display,
      scheduledCount: notifications.length,
    };
  } catch (error) {
    console.error("Unable to schedule local notifications", error);
    reminderSettings.scheduledCount = 0;
    saveReminderSettings();
    showToast(`提醒设置失败：${error.message}`);
    return {
      permission: reminderSettings.permission,
      scheduledCount: 0,
    };
  }
}

function applyReminderSettingsFromForm() {
  const enabled = Boolean(document.querySelector("#reminder-enabled")?.checked);
  const minutesInput = document.querySelector("#reminder-minutes");
  const minutes = Math.min(
    120,
    Math.max(1, Number(minutesInput?.value) || 10),
  );
  reminderSettings.enabled = enabled;
  reminderSettings.minutes = minutes;
  saveReminderSettings();
}

document.addEventListener("click", (event) => {
  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) {
    ui.tab = tabButton.dataset.tab;
    render();
    return;
  }

  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;
  if (
    actionElement.dataset.action === "close-modal" &&
    event.target.closest("[data-stop-close]")
  ) {
    return;
  }
  const action = actionElement.dataset.action;

  if (action === "mode-day") {
    ui.scheduleMode = "day";
    render();
  } else if (action === "mode-week") {
    ui.scheduleMode = "week";
    render();
  } else if (action === "select-day") {
    ui.selectedDay = Number(actionElement.dataset.day);
    render();
  } else if (action === "add-course") {
    openSessionEditor(null, actionElement.dataset.code || "");
  } else if (action === "edit-session") {
    const session = sessions.find(
      (item) => item.id === actionElement.dataset.id,
    );
    if (session) openSessionEditor(session);
  } else if (action === "delete-session") {
    deleteSession(actionElement.dataset.id);
  } else if (action === "set-type") {
    const hidden = document.querySelector("#session-type");
    if (hidden) hidden.value = actionElement.dataset.type;
    document
      .querySelectorAll(".type-option")
      .forEach((button) =>
        button.classList.toggle(
          "is-active",
          button.dataset.type === actionElement.dataset.type,
        ),
      );
  } else if (action === "close-modal") {
    closeModal();
  } else if (action === "open-image") {
    openImagePreview();
  } else if (action === "share-image") {
    shareImage();
  } else if (action === "download-image") {
    downloadImage();
  } else if (action === "import-html") {
    filePicker.click();
  } else if (action === "clear-search") {
    ui.search = "";
    renderCourses();
    refreshIcons();
  } else if (action === "export-json") {
    exportJsonBackup();
  } else if (action === "clear-all") {
    clearAllData();
  } else if (action === "set-reminder-minutes") {
    reminderSettings.minutes = Number(actionElement.dataset.minutes);
    saveReminderSettings();
    renderReminder();
    refreshIcons();
  } else if (action === "save-reminder") {
    applyReminderSettingsFromForm();
    syncLocalNotifications({ requestPermission: true }).then((result) => {
      renderReminder();
      refreshIcons();
      if (result.permission === "granted") {
        showToast(`已安排 ${result.scheduledCount} 个课前提醒。`);
      } else if (result.permission === "unsupported") {
        showToast("浏览器预览不支持后台通知，请在 iPhone App 中使用。");
      } else {
        showToast("尚未获得通知权限，请在 iOS 设置中允许通知。");
      }
    });
  } else if (action === "request-notification-permission") {
    applyReminderSettingsFromForm();
    syncLocalNotifications({ requestPermission: true }).then((result) => {
      renderReminder();
      refreshIcons();
      showToast(
        result.permission === "granted"
          ? "通知权限已开启。"
          : "未获得通知权限，请前往 iOS 设置。",
      );
    });
  }
});

filePicker.addEventListener("change", () => {
  const files = [...(filePicker.files || [])];
  if (files.length) importHtmlFiles(files);
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

render();
syncLocalNotifications();
