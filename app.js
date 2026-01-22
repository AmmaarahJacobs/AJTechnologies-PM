/* Project Manager — Local-first (Responsive + Logo Upload + Project Edit/Delete)
   Data model:
   db = {
     meta: { currencySymbol: "R", taxRate: 25, savingsTarget: 0, logoDataUrl: "" },
     projects: [],
     tasks: [],
     timeEntries: [],
     transactions: [],
     activeTimer: { taskId, startAt } | null
   }
*/

(function(){
  "use strict";

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
  const todayISO = () => new Date().toISOString().slice(0,10);

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function parseNumber(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function formatMoney(amount, symbol){
    const val = Number(amount || 0);
    return `${symbol}${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  }
  function daysFromNow(dateStr){
    if(!dateStr) return null;
    const d = new Date(dateStr + "T00:00:00");
    const now = new Date();
    const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = d - a;
    return Math.round(diffMs / (1000*60*60*24));
  }
  function minutesToHM(mins){
    const m = Math.max(0, Math.round(mins));
    const h = Math.floor(m / 60);
    const r = m % 60;
    return h > 0 ? `${h}h ${r}m` : `${r}m`;
  }
  function hoursCompact(mins){
    const h = mins / 60;
    return `${Math.round(h * 10) / 10}h`;
  }
  function monthKey(dateStr){
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }
  function isSameMonth(dateStr, key){
    return monthKey(dateStr) === key;
  }
  function toast(msg){
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"), 2200);
  }
  function safeText(s){
    return String(s ?? "").replace(/[<>]/g, "");
  }

  const KEY = "ajpm_db_v2";

  function defaultDB(){
    return {
      meta: {
        currencySymbol: "R",
        taxRate: 25,
        savingsTarget: 0,
        logoDataUrl: ""
      },
      projects: [],
      tasks: [],
      timeEntries: [],
      transactions: [],
      activeTimer: null
    };
  }

  function loadDB(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return defaultDB();
      const parsed = JSON.parse(raw);
      return {
        ...defaultDB(),
        ...parsed,
        meta: { ...defaultDB().meta, ...(parsed.meta || {}) }
      };
    }catch(e){
      console.warn("DB load failed:", e);
      return defaultDB();
    }
  }

  function saveDB(){
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  let db = loadDB();

  // ---------- Editing State (Projects) ----------
  let editingProjectId = null;

  // ---------- Elements ----------
  const navItems = $$(".nav-item");
  const views = $$(".view");

  const pageTitle = $("#pageTitle");
  const pageSubtitle = $("#pageSubtitle");

  const todayStr = $("#todayStr");
  const activeTimerStr = $("#activeTimerStr");

  const globalSearch = $("#globalSearch");

  // Responsive menu
  const sidebar = $("#sidebar");
  const scrim = $("#scrim");
  const menuToggle = $("#menuToggle");

  // Brand/logo
  const brandLogo = $("#brandLogo");
  const brandLogoMobile = $("#brandLogoMobile");
  const brandMarkFallback = $("#brandMarkFallback");

  // Dashboard KPIs
  const kpiOpenProjects = $("#kpiOpenProjects");
  const kpiOpenProjectsFoot = $("#kpiOpenProjectsFoot");
  const kpiDueSoon = $("#kpiDueSoon");
  const kpiDueSoonFoot = $("#kpiDueSoonFoot");
  const kpiTime7d = $("#kpiTime7d");
  const kpiTime7dFoot = $("#kpiTime7dFoot");
  const kpiProfitMonth = $("#kpiProfitMonth");
  const kpiProfitMonthFoot = $("#kpiProfitMonthFoot");

  const deadlinesTable = $("#deadlinesTable");
  const timeChart = $("#timeChart");
  const timeChartFoot = $("#timeChartFoot");

  // Projects
  const projectForm = $("#projectForm");
  const projectName = $("#projectName");
  const projectClient = $("#projectClient");
  const projectDeadline = $("#projectDeadline");
  const projectPriority = $("#projectPriority");
  const projectStatus = $("#projectStatus");
  const projectBudget = $("#projectBudget");
  const projectNotes = $("#projectNotes");
  const projectFormReset = $("#projectFormReset");
  const projectList = $("#projectList");
  const projectFilter = $("#projectFilter");

  // Project form buttons for edit flow
  const projectSubmitBtn = $("#projectSubmitBtn");
  const projectCancelEdit = $("#projectCancelEdit");

  // Tasks
  const taskForm = $("#taskForm");
  const taskTitle = $("#taskTitle");
  const taskProject = $("#taskProject");
  const taskDue = $("#taskDue");
  const taskPriority = $("#taskPriority");
  const taskStatus = $("#taskStatus");
  const taskEstimate = $("#taskEstimate");
  const taskResources = $("#taskResources");
  const taskResourceCost = $("#taskResourceCost");
  const taskTags = $("#taskTags");
  const taskFormReset = $("#taskFormReset");
  const taskList = $("#taskList");
  const taskFilter = $("#taskFilter");

  // Finance
  const sumIncomeMonth = $("#sumIncomeMonth");
  const sumExpenseMonth = $("#sumExpenseMonth");
  const sumProfitMonth = $("#sumProfitMonth");
  const sumSavingsMonth = $("#sumSavingsMonth");
  const sumTaxRate = $("#sumTaxRate");
  const sumTaxMonth = $("#sumTaxMonth");

  const txForm = $("#txForm");
  const txDate = $("#txDate");
  const txType = $("#txType");
  const txAmount = $("#txAmount");
  const txCategory = $("#txCategory");
  const txProject = $("#txProject");
  const txRef = $("#txRef");
  const txFormReset = $("#txFormReset");
  const txTable = $("#txTable");
  const txFilter = $("#txFilter");

  const financeSettingsForm = $("#financeSettingsForm");
  const taxRate = $("#taxRate");
  const savingsTarget = $("#savingsTarget");
  const financeSettingsReset = $("#financeSettingsReset");

  // Settings
  const currencySymbol = $("#currencySymbol");
  const saveGeneral = $("#saveGeneral");
  const wipeData = $("#wipeData");

  // Logo controls
  const logoFile = $("#logoFile");
  const removeLogo = $("#removeLogo");

  // Export/Import
  const exportBtn = $("#exportBtn");
  const importFile = $("#importFile");

  const exportBtnTop = $("#exportBtnTop");
  const importFileTop = $("#importFileTop");

  const exportBtnMobile = $("#exportBtnMobile");
  const importFileMobile = $("#importFileMobile");

  // ---------- Navigation ----------
  const viewMeta = {
    dashboard: { title: "Dashboard", subtitle: "Overview of work, deadlines, time, and finances." },
    projects: { title: "Projects", subtitle: "Create and manage projects with deadlines and budgets." },
    tasks: { title: "Tasks & Time", subtitle: "Track tasks, time spent, and resources used." },
    finance: { title: "Finance", subtitle: "Track income, expenses, savings, and estimated tax." },
    settings: { title: "Settings", subtitle: "Brand, preferences, export/import, and data management." }
  };

  function openSidebar(){
    sidebar.classList.add("open");
    scrim.classList.add("show");
    menuToggle?.setAttribute("aria-expanded", "true");
  }
  function closeSidebar(){
    sidebar.classList.remove("open");
    scrim.classList.remove("show");
    menuToggle?.setAttribute("aria-expanded", "false");
  }
  function toggleSidebar(){
    if(sidebar.classList.contains("open")) closeSidebar();
    else openSidebar();
  }

  menuToggle?.addEventListener("click", toggleSidebar);
  scrim?.addEventListener("click", closeSidebar);
  window.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closeSidebar(); });

  function showView(name){
    navItems.forEach(b => b.classList.toggle("active", b.dataset.view === name));
    views.forEach(v => v.classList.toggle("active", v.id === `view-${name}`));

    pageTitle.textContent = viewMeta[name]?.title || "Project Manager";
    pageSubtitle.textContent = viewMeta[name]?.subtitle || "";

    closeSidebar();
    renderAll();
  }

  navItems.forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
  $$("[data-jump]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.jump)));

  // ---------- Brand / Logo ----------
  function applyLogo(){
    const dataUrl = (db.meta.logoDataUrl || "").trim();
    const hasLogo = Boolean(dataUrl);

    if(hasLogo){
      brandLogo.src = dataUrl;
      brandLogo.style.display = "block";
      brandMarkFallback.style.display = "none";

      brandLogoMobile.src = dataUrl;
      brandLogoMobile.style.display = "block";
    }else{
      brandLogo.removeAttribute("src");
      brandLogo.style.display = "none";
      brandMarkFallback.style.display = "grid";

      brandLogoMobile.removeAttribute("src");
      brandLogoMobile.style.display = "none";
    }
  }

  async function fileToDataUrl(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  logoFile?.addEventListener("change", async ()=>{
    const f = logoFile.files && logoFile.files[0];
    if(!f) return;

    const okTypes = ["image/png","image/jpeg","image/webp","image/gif","image/svg+xml"];
    if(!okTypes.includes(f.type)){
      toast("Please upload a valid image (PNG/JPG/WebP).");
      logoFile.value = "";
      return;
    }

    try{
      const dataUrl = await fileToDataUrl(f);
      if(dataUrl.length > 900_000){
        toast("Logo is too large. Please use a smaller image (under ~700KB).");
        logoFile.value = "";
        return;
      }

      db.meta.logoDataUrl = dataUrl;
      saveDB();
      applyLogo();
      toast("Logo updated.");
    }catch(e){
      console.error(e);
      toast("Logo upload failed.");
    }finally{
      logoFile.value = "";
    }
  });

  removeLogo?.addEventListener("click", ()=>{
    db.meta.logoDataUrl = "";
    saveDB();
    applyLogo();
    toast("Logo removed.");
  });

  // ---------- Helpers ----------
  function projectById(id){ return db.projects.find(p => p.id === id) || null; }
  function taskById(id){ return db.tasks.find(t => t.id === id) || null; }

  function priorityBadge(p){
    const map = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
    return `<span class="badge ${p === "critical" ? "danger" : (p==="high" ? "primary" : "")}">${map[p] || "—"}</span>`;
  }
  function statusBadgeProject(s){
    const map = { active: "Active", on_hold: "On Hold", completed: "Completed" };
    return `<span class="badge">${map[s] || s}</span>`;
  }
  function statusBadgeTask(s){
    const map = { todo: "To Do", doing: "In Progress", done: "Complete", blocked: "Blocked" };
    const cls = (s === "blocked") ? "danger" : (s === "doing" ? "primary" : "");
    return `<span class="badge ${cls}">${map[s] || s}</span>`;
  }
  function dueBadge(due){
    if(!due) return `<span class="badge">No due</span>`;
    const df = daysFromNow(due);
    if(df === null) return `<span class="badge">No due</span>`;
    if(df < 0) return `<span class="badge danger">Overdue ${Math.abs(df)}d</span>`;
    if(df === 0) return `<span class="badge danger">Due today</span>`;
    if(df <= 7) return `<span class="badge primary">Due ${df}d</span>`;
    return `<span class="badge">Due ${df}d</span>`;
  }

  function taskLoggedMinutes(taskId){
    return db.timeEntries
      .filter(e => e.taskId === taskId && e.endAt)
      .reduce((acc, e) => acc + (e.minutes || 0), 0);
  }

  function last7DaysKeys(){
    const keys = [];
    const now = new Date();
    for(let i=6;i>=0;i--){
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      keys.push(d.toISOString().slice(0,10));
    }
    return keys;
  }

  function timeLoggedInRange(dateFromISO, dateToISO){
    const from = new Date(dateFromISO + "T00:00:00").getTime();
    const to = new Date(dateToISO + "T23:59:59").getTime();
    return db.timeEntries.filter(e => {
      if(!e.endAt) return false;
      const end = new Date(e.endAt).getTime();
      return end >= from && end <= to;
    });
  }

  // ---------- Project Edit Mode ----------
  function enterProjectEditMode(projectId){
    const p = projectById(projectId);
    if(!p) return;

    editingProjectId = p.id;

    projectName.value = p.name || "";
    projectClient.value = p.client || "";
    projectDeadline.value = p.deadline || "";
    projectPriority.value = p.priority || "medium";
    projectStatus.value = p.status || "active";
    projectBudget.value = (p.budget ?? "") === 0 ? "" : String(p.budget ?? "");
    projectNotes.value = p.notes || "";

    if(projectSubmitBtn) projectSubmitBtn.textContent = "Update Project";
    projectCancelEdit?.classList.remove("hidden");

    // Bring form into view for a clean UX
    projectForm.scrollIntoView({ behavior: "smooth", block: "start" });
    toast("Editing project. Update fields and save.");
  }

  function exitProjectEditMode(){
    editingProjectId = null;
    projectForm.reset();

    if(projectSubmitBtn) projectSubmitBtn.textContent = "Add Project";
    projectCancelEdit?.classList.add("hidden");
  }

  projectCancelEdit?.addEventListener("click", ()=>{
    exitProjectEditMode();
    toast("Edit cancelled.");
  });

  // ---------- Header / Sidebar status ----------
  function renderHeaderBits(){
    const d = new Date();
    todayStr.textContent = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" });

    if(db.activeTimer){
      const t = taskById(db.activeTimer.taskId);
      const start = new Date(db.activeTimer.startAt);
      const mins = Math.floor((Date.now() - start.getTime()) / 60000);
      activeTimerStr.textContent = t ? `${t.title} · ${minutesToHM(mins)}` : `Running · ${minutesToHM(mins)}`;
    }else{
      activeTimerStr.textContent = "None";
    }
  }

  // ---------- Dashboard ----------
  function renderDashboard(){
    const openProjects = db.projects.filter(p => p.status !== "completed").length;
    kpiOpenProjects.textContent = String(openProjects);
    kpiOpenProjectsFoot.textContent = `${db.projects.length} total`;

    const dueSoonTasks = db.tasks.filter(t => {
      if(!t.due) return false;
      const df = daysFromNow(t.due);
      return df !== null && df >= 0 && df <= 7 && t.status !== "done";
    }).length;
    kpiDueSoon.textContent = String(dueSoonTasks);
    kpiDueSoonFoot.textContent = "Excludes completed tasks";

    const keys7 = last7DaysKeys();
    const entries7 = timeLoggedInRange(keys7[0], keys7[keys7.length-1]);
    const totalMins7 = entries7.reduce((a,e)=>a+(e.minutes||0),0);
    kpiTime7d.textContent = hoursCompact(totalMins7);
    kpiTime7dFoot.textContent = `${entries7.length} time entries`;

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const monthTx = db.transactions.filter(t => isSameMonth(t.date, thisMonthKey));
    const income = monthTx.filter(t=>t.type==="income").reduce((a,t)=>a+(t.amount||0),0);
    const expense = monthTx.filter(t=>t.type==="expense").reduce((a,t)=>a+(t.amount||0),0);
    const profit = income - expense;

    kpiProfitMonth.textContent = formatMoney(profit, db.meta.currencySymbol);
    kpiProfitMonthFoot.textContent = `${thisMonthKey} (month-to-date)`;

    const deadlineItems = [];
    db.projects.forEach(p=>{
      if(!p.deadline) return;
      if(p.status === "completed") return;
      deadlineItems.push({ type: "Project", title: p.name, due: p.deadline, status: p.status });
    });
    db.tasks.forEach(t=>{
      if(!t.due) return;
      if(t.status === "done") return;
      deadlineItems.push({ type: "Task", title: t.title, due: t.due, status: t.status });
    });

    deadlineItems.sort((a,b)=> (a.due||"").localeCompare(b.due||""));
    const top = deadlineItems.slice(0,10);

    deadlinesTable.innerHTML = top.length ? top.map(it=>{
      const status = it.type === "Project" ? statusBadgeProject(it.status) : statusBadgeTask(it.status);
      return `
        <tr>
          <td>${safeText(it.type)}</td>
          <td>${safeText(it.title)}</td>
          <td>${safeText(it.due || "—")}</td>
          <td>${status}</td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="4" class="muted">No upcoming deadlines yet.</td></tr>`;

    renderTimeChart7d();
  }

  function renderTimeChart7d(){
    const ctx = timeChart.getContext("2d");
    const keys = last7DaysKeys();

    const daily = keys.map(k=>{
      const dayEntries = timeLoggedInRange(k, k);
      return dayEntries.reduce((a,e)=>a+(e.minutes||0),0);
    });

    const max = Math.max(60, ...daily);
    const w = timeChart.width, h = timeChart.height;
    ctx.clearRect(0,0,w,h);

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.strokeRect(0.5,0.5,w-1,h-1);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for(let i=1;i<=3;i++){
      const y = (h/4)*i;
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(w,y);
      ctx.stroke();
    }

    const padX = 24;
    const barGap = 10;
    const barW = (w - padX*2 - barGap*(keys.length-1)) / keys.length;

    daily.forEach((mins, i)=>{
      const x = padX + i*(barW+barGap);
      const barH = clamp((mins / max) * (h - 56), 0, h-56);
      const y = h - 30 - barH;

      ctx.fillStyle = "rgba(202,167,74,0.70)";
      ctx.fillRect(x, y, barW, barH);

      const d = new Date(keys[i] + "T00:00:00");
      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      ctx.fillStyle = "rgba(255,255,255,0.60)";
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, x + barW/2, h - 10);
    });

    const totalMins = daily.reduce((a,b)=>a+b,0);
    timeChartFoot.style.paddingLeft = "24px";
    timeChartFoot.textContent = `Total this week: ${minutesToHM(totalMins)}. Max day: ${minutesToHM(Math.max(...daily))}.`;
}

  // ---------- Projects ----------
  function fillProjectSelects(){
    const opts = [`<option value="">No Project</option>`]
      .concat(db.projects.map(p => `<option value="${p.id}">${safeText(p.name)}</option>`));
    taskProject.innerHTML = opts.join("");
    txProject.innerHTML = opts.join("");
  }

  function renderProjects(){
    fillProjectSelects();

    const filter = projectFilter.value;
    const query = globalSearch.value.trim().toLowerCase();

    let items = [...db.projects];
    if(filter !== "all") items = items.filter(p => p.status === filter);
    if(query){
      items = items.filter(p =>
        (p.name || "").toLowerCase().includes(query) ||
        (p.client || "").toLowerCase().includes(query) ||
        (p.notes || "").toLowerCase().includes(query)
      );
    }

    items.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));

    projectList.innerHTML = items.length ? items.map(p=>{
      const deadlineText = p.deadline ? `${p.deadline}` : "No deadline";
      const due = dueBadge(p.deadline);
      const budget = p.budget ? formatMoney(p.budget, db.meta.currencySymbol) : "—";

      const pTasks = db.tasks.filter(t => t.projectId === p.id);
      const doneCount = pTasks.filter(t => t.status === "done").length;
      const progress = pTasks.length ? Math.round((doneCount / pTasks.length) * 100) : 0;

      return `
        <div class="item">
          <div class="item-main">
            <div class="item-title">${safeText(p.name)}</div>
            <div class="item-meta">
              ${p.client ? `<span>${safeText(p.client)}</span>` : ""}
              <span>Budget: ${safeText(budget)}</span>
              <span>${safeText(deadlineText)}</span>
              <span>${priorityBadge(p.priority)}</span>
              <span>${statusBadgeProject(p.status)}</span>
              <span>${due}</span>
              <span class="badge">Progress ${progress}%</span>
            </div>
          </div>
          <div class="item-actions">
            <div class="inline-actions">
              <button class="btn btn-ghost" data-act="project-open" data-id="${p.id}">Open</button>
              <button class="btn btn-ghost" data-act="project-edit" data-id="${p.id}">Edit</button>
              <button class="btn btn-ghost" data-act="project-status" data-id="${p.id}">Toggle Status</button>
              <button class="btn btn-danger" data-act="project-delete" data-id="${p.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join("") : `<div class="muted" style="padding: 12px 14px;">No projects yet. Create your first project on the left.</div>`;
  }

  // ---------- Tasks ----------
  function renderTasks(){
    fillProjectSelects();

    const filter = taskFilter.value;
    const query = globalSearch.value.trim().toLowerCase();

    let items = [...db.tasks];
    if(filter !== "all") items = items.filter(t => t.status === filter);
    if(query){
      items = items.filter(t =>
        (t.title || "").toLowerCase().includes(query) ||
        (t.resources || "").toLowerCase().includes(query) ||
        (t.tags || []).join(",").toLowerCase().includes(query)
      );
    }

    items.sort((a,b)=>{
      const ad = a.due ? a.due : "9999-12-31";
      const bd = b.due ? b.due : "9999-12-31";
      if(ad !== bd) return ad.localeCompare(bd);
      return (b.createdAt||0) - (a.createdAt||0);
    });

    taskList.innerHTML = items.length ? items.map(t=>{
      const project = t.projectId ? projectById(t.projectId) : null;
      const loggedMins = taskLoggedMinutes(t.id);
      const estimate = parseNumber(t.estimateHours);
      const estimateMins = estimate > 0 ? estimate * 60 : 0;

      const over = estimateMins > 0 && loggedMins > estimateMins;
      const timeBadge = `<span class="badge ${over ? "danger" : ""}">Logged ${minutesToHM(loggedMins)}${estimateMins ? ` / Est ${estimate}h` : ""}</span>`;

      const isActive = db.activeTimer && db.activeTimer.taskId === t.id;
      const timerBadge = isActive ? `<span class="badge primary">Timer Running</span>` : "";

      const resourcesBadge = (parseNumber(t.resourceCost) > 0)
        ? `<span class="badge">Res Cost ${formatMoney(t.resourceCost, db.meta.currencySymbol)}</span>`
        : `<span class="badge">Res Cost —</span>`;

      const tags = (t.tags || []).filter(Boolean).slice(0,6).map(x=>`<span class="badge">${safeText(x)}</span>`).join("");

      return `
        <div class="item">
          <div class="item-main">
            <div class="item-title">${safeText(t.title)}</div>
            <div class="item-meta">
              ${project ? `<span>${safeText(project.name)}</span>` : `<span>No project</span>`}
              ${priorityBadge(t.priority)}
              ${statusBadgeTask(t.status)}
              ${dueBadge(t.due)}
              ${timeBadge}
              ${resourcesBadge}
              ${timerBadge}
              ${tags}
            </div>
            ${t.resources ? `<div class="muted small" style="margin-top:8px; white-space: pre-wrap;">${safeText(t.resources).slice(0,280)}${t.resources.length>280?"…":""}</div>` : ""}
          </div>
          <div class="item-actions">
            <div class="inline-actions">
              <button class="btn btn-ghost" data-act="task-timer" data-id="${t.id}">${isActive ? "Stop" : "Start"}</button>
              <button class="btn btn-ghost" data-act="task-status" data-id="${t.id}">Next Status</button>
              <button class="btn btn-ghost" data-act="task-log" data-id="${t.id}">Add Time</button>
              <button class="btn btn-danger" data-act="task-delete" data-id="${t.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join("") : `<div class="muted" style="padding: 12px 14px;">No tasks yet. Create tasks on the left.</div>`;
  }

  // ---------- Finance ----------
  function renderFinance(){
    fillProjectSelects();

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const monthTx = db.transactions.filter(t => isSameMonth(t.date, thisMonthKey));

    const income = monthTx.filter(t=>t.type==="income").reduce((a,t)=>a+(t.amount||0),0);
    const expense = monthTx.filter(t=>t.type==="expense").reduce((a,t)=>a+(t.amount||0),0);
    const savings = monthTx.filter(t=>t.type==="savings").reduce((a,t)=>a+(t.amount||0),0);
    const profit = income - expense;

    const taxR = clamp(parseNumber(db.meta.taxRate), 0, 100);
    const taxEstimate = Math.max(0, profit) * (taxR / 100);

    sumIncomeMonth.textContent = formatMoney(income, db.meta.currencySymbol);
    sumExpenseMonth.textContent = formatMoney(expense, db.meta.currencySymbol);
    sumProfitMonth.textContent = formatMoney(profit, db.meta.currencySymbol);
    sumSavingsMonth.textContent = formatMoney(savings, db.meta.currencySymbol);

    sumTaxRate.textContent = `${taxR.toLocaleString(undefined, {maximumFractionDigits: 1})}%`;
    sumTaxMonth.textContent = formatMoney(taxEstimate, db.meta.currencySymbol);

    taxRate.value = String(db.meta.taxRate ?? 25);
    savingsTarget.value = String(db.meta.savingsTarget ?? 0);

    const filter = txFilter.value;
    const query = globalSearch.value.trim().toLowerCase();
    let items = [...db.transactions];

    if(filter !== "all") items = items.filter(t => t.type === filter);
    if(query){
      items = items.filter(t=>{
        const p = t.projectId ? projectById(t.projectId)?.name : "";
        return (t.category||"").toLowerCase().includes(query) ||
               (t.ref||"").toLowerCase().includes(query) ||
               (p||"").toLowerCase().includes(query);
      });
    }

    items.sort((a,b)=> (b.date||"").localeCompare(a.date||""));

    txTable.innerHTML = items.length ? items.map(t=>{
      const pName = t.projectId ? (projectById(t.projectId)?.name || "—") : "—";
      return `
        <tr>
          <td>${safeText(t.date)}</td>
          <td>${safeText(t.type)}</td>
          <td>${safeText(formatMoney(t.amount, db.meta.currencySymbol))}</td>
          <td>${safeText(t.category || "—")}</td>
          <td>${safeText(pName)}</td>
          <td>${safeText(t.ref || "—")}</td>
          <td><button class="btn btn-danger" data-act="tx-delete" data-id="${t.id}" style="padding:6px 10px; border-radius: 12px;">Delete</button></td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="7" class="muted">No transactions yet.</td></tr>`;
  }

  function renderSettings(){
    currencySymbol.value = db.meta.currencySymbol || "R";
  }

  function renderAll(){
    applyLogo();
    renderHeaderBits();
    renderDashboard();
    renderProjects();
    renderTasks();
    renderFinance();
    renderSettings();
  }

  // ---------- Forms ----------
  projectForm.addEventListener("submit", (e)=>{
    e.preventDefault();

    const payload = {
      name: projectName.value.trim(),
      client: projectClient.value.trim(),
      deadline: projectDeadline.value || "",
      priority: projectPriority.value,
      status: projectStatus.value,
      budget: parseNumber(projectBudget.value),
      notes: projectNotes.value.trim()
    };

    if(!payload.name){ toast("Project name is required."); return; }

    // Update existing
    if(editingProjectId){
      const p = projectById(editingProjectId);
      if(!p){
        toast("Project not found.");
        exitProjectEditMode();
        return;
      }

      p.name = payload.name;
      p.client = payload.client;
      p.deadline = payload.deadline;
      p.priority = payload.priority;
      p.status = payload.status;
      p.budget = payload.budget;
      p.notes = payload.notes;

      saveDB();
      toast("Project updated.");
      exitProjectEditMode();
      renderAll();
      return;
    }

    // Create new
    const p = {
      id: uid(),
      ...payload,
      createdAt: Date.now()
    };

    db.projects.push(p);
    saveDB();
    projectForm.reset();
    toast("Project added.");
    renderAll();
  });

  projectFormReset.addEventListener("click", ()=>{
    projectForm.reset();
    // Do not exit edit mode automatically; Clear should clear the form
    // If you want Clear to also cancel edit, uncomment:
    // exitProjectEditMode();
  });

  taskForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    const tags = taskTags.value.split(",").map(x=>x.trim()).filter(Boolean);

    const t = {
      id: uid(),
      title: taskTitle.value.trim(),
      projectId: taskProject.value || "",
      due: taskDue.value || "",
      priority: taskPriority.value,
      status: taskStatus.value,
      estimateHours: parseNumber(taskEstimate.value),
      resources: taskResources.value.trim(),
      resourceCost: parseNumber(taskResourceCost.value),
      tags,
      createdAt: Date.now()
    };
    if(!t.title){ toast("Task title is required."); return; }
    db.tasks.push(t);
    saveDB();
    taskForm.reset();
    toast("Task added.");
    renderAll();
  });

  taskFormReset.addEventListener("click", ()=> taskForm.reset());

  txForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    const tx = {
      id: uid(),
      date: txDate.value,
      type: txType.value,
      amount: parseNumber(txAmount.value),
      category: txCategory.value.trim(),
      projectId: txProject.value || "",
      ref: txRef.value.trim()
    };
    if(!tx.date){ toast("Transaction date is required."); return; }
    if(tx.amount <= 0){ toast("Amount must be greater than 0."); return; }
    db.transactions.push(tx);
    saveDB();
    txForm.reset();
    txDate.value = todayISO();
    toast("Transaction added.");
    renderAll();
  });

  txFormReset.addEventListener("click", ()=>{
    txForm.reset();
    txDate.value = todayISO();
  });

  financeSettingsForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    db.meta.taxRate = clamp(parseNumber(taxRate.value), 0, 100);
    db.meta.savingsTarget = Math.max(0, parseNumber(savingsTarget.value));
    saveDB();
    toast("Finance settings saved.");
    renderAll();
  });

  financeSettingsReset.addEventListener("click", ()=>{
    taxRate.value = String(db.meta.taxRate ?? 25);
    savingsTarget.value = String(db.meta.savingsTarget ?? 0);
  });

  saveGeneral.addEventListener("click", ()=>{
    db.meta.currencySymbol = (currencySymbol.value || "R").trim() || "R";
    saveDB();
    toast("Settings saved.");
    renderAll();
  });

  wipeData.addEventListener("click", ()=>{
    const ok = confirm("Wipe all data? This cannot be undone.");
    if(!ok) return;
    db = defaultDB();
    saveDB();
    applyLogo();
    toast("All data wiped.");
    exitProjectEditMode();
    renderAll();
  });

  // ---------- Filters & search ----------
  projectFilter.addEventListener("change", renderAll);
  taskFilter.addEventListener("change", renderAll);
  txFilter.addEventListener("change", renderAll);

  let searchTimer = null;
  globalSearch.addEventListener("input", ()=>{
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderAll, 120);
  });

  // ---------- Delegated actions ----------
  document.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-act]");
    if(!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;

    if(act === "project-edit"){
      enterProjectEditMode(id);
      return;
    }

    if(act === "project-delete"){
      const p = projectById(id);
      if(!p) return;

      const ok = confirm(`Delete project "${p.name}"? Tasks and transactions will be unlinked from this project.`);
      if(!ok) return;

      // Cancel edit if deleting the one being edited
      if(editingProjectId === id){
        exitProjectEditMode();
      }

      db.tasks.forEach(t => { if(t.projectId === id) t.projectId = ""; });
      db.transactions.forEach(t => { if(t.projectId === id) t.projectId = ""; });

      db.projects = db.projects.filter(x => x.id !== id);
      saveDB();
      toast("Project deleted.");
      renderAll();
      return;
    }

    if(act === "project-status"){
      const p = projectById(id);
      if(!p) return;
      const order = ["active", "on_hold", "completed"];
      const idx = order.indexOf(p.status);
      p.status = order[(idx + 1) % order.length];
      saveDB();
      toast("Project status updated.");
      renderAll();
      return;
    }

    if(act === "project-open"){
      const p = projectById(id);
      if(!p) return;
      showView("tasks");
      taskProject.value = p.id;
      toast(`Opened: ${p.name}`);
      return;
    }

    if(act === "task-delete"){
      const t = taskById(id);
      if(!t) return;
      const ok = confirm(`Delete task "${t.title}"? Time entries for this task will also be removed.`);
      if(!ok) return;

      if(db.activeTimer && db.activeTimer.taskId === id){
        db.activeTimer = null;
      }

      db.timeEntries = db.timeEntries.filter(te => te.taskId !== id);
      db.tasks = db.tasks.filter(x => x.id !== id);
      saveDB();
      toast("Task deleted.");
      renderAll();
      return;
    }

    if(act === "task-status"){
      const t = taskById(id);
      if(!t) return;
      const order = ["todo", "doing", "done", "blocked"];
      const idx = order.indexOf(t.status);
      t.status = order[(idx + 1) % order.length];
      saveDB();
      toast("Task status updated.");
      renderAll();
      return;
    }

    if(act === "task-log"){
      const t = taskById(id);
      if(!t) return;
      const mins = parseNumber(prompt("Add time (minutes):", "30"));
      if(mins <= 0) return;

      const note = prompt("Optional note:", "") || "";
      const now = new Date();

      db.timeEntries.push({
        id: uid(),
        taskId: t.id,
        startAt: new Date(now.getTime() - mins*60000).toISOString(),
        endAt: now.toISOString(),
        minutes: Math.round(mins),
        note: note.trim()
      });

      if(t.status === "todo") t.status = "doing";

      saveDB();
      toast("Time entry added.");
      renderAll();
      return;
    }

    if(act === "task-timer"){
      const t = taskById(id);
      if(!t) return;

      if(db.activeTimer && db.activeTimer.taskId !== t.id){
        toast("Stop the current timer first.");
        return;
      }

      if(!db.activeTimer){
        db.activeTimer = { taskId: t.id, startAt: new Date().toISOString() };
        if(t.status === "todo") t.status = "doing";
        saveDB();
        toast("Timer started.");
        renderAll();
        return;
      }

      const start = new Date(db.activeTimer.startAt);
      const end = new Date();
      const mins = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 60000));

      const note = prompt(`Timer stopped. Add note? (logged ${minutesToHM(mins)})`, "") || "";

      db.timeEntries.push({
        id: uid(),
        taskId: t.id,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        minutes: mins,
        note: note.trim()
      });

      db.activeTimer = null;
      saveDB();
      toast(`Logged ${minutesToHM(mins)}.`);
      renderAll();
      return;
    }

    if(act === "tx-delete"){
      const ok = confirm("Delete this transaction?");
      if(!ok) return;
      db.transactions = db.transactions.filter(x => x.id !== id);
      saveDB();
      toast("Transaction deleted.");
      renderAll();
      return;
    }
  });

  // ---------- Export / Import ----------
  function doExport(){
    const payload = JSON.stringify(db, null, 2);
    const blob = new Blob([payload], {type: "application/json"});
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `project-manager-export-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    toast("Export downloaded.");
  }

  async function doImportFromFile(file){
    try{
      const text = await file.text();
      const incoming = JSON.parse(text);

      if(!incoming || typeof incoming !== "object") throw new Error("Invalid JSON data.");
      if(!Array.isArray(incoming.projects) || !Array.isArray(incoming.tasks) || !Array.isArray(incoming.transactions)){
        throw new Error("Missing required collections.");
      }

      db = {
        ...defaultDB(),
        ...incoming,
        meta: { ...defaultDB().meta, ...(incoming.meta || {}) }
      };

      saveDB();
      applyLogo();
      toast("Import successful.");
      exitProjectEditMode();
      renderAll();
    }catch(err){
      console.error(err);
      toast("Import failed. Invalid file.");
    }
  }

  exportBtn?.addEventListener("click", doExport);
  exportBtnTop?.addEventListener("click", doExport);
  exportBtnMobile?.addEventListener("click", doExport);

  function wireImportInput(inputEl){
    inputEl?.addEventListener("change", async ()=>{
      const file = inputEl.files && inputEl.files[0];
      if(!file) return;
      await doImportFromFile(file);
      inputEl.value = "";
    });
  }

  wireImportInput(importFile);
  wireImportInput(importFileTop);
  wireImportInput(importFileMobile);

  // ---------- Init ----------
  function initDefaults(){
    txDate.value = todayISO();
    fillProjectSelects();
    applyLogo();
    renderAll();
    showView("dashboard");
    setInterval(()=>renderHeaderBits(), 15000);

    // Ensure edit button starts hidden
    projectCancelEdit?.classList.add("hidden");
  }

  initDefaults();

})();
