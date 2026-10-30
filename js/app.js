/* 惠州市考试工作日程系统 · 界面逻辑 */
(function () {
  'use strict';

  var S = {
    me: null,
    schedules: [],
    profiles: [],
    myProgress: {},
    view: 'home',
    todoFilter: 'open',
    detail: null,
    detailShared: [],
    detailProgress: [],
    editSchedule: null,
    editTasks: [],
    editShares: []
  };

  /* ================= 工具 ================= */
  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDate(s) { return new Date(String(s).slice(0, 10) + 'T00:00:00'); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
  function diffDays(a, b) { return Math.round((parseDate(a) - parseDate(b)) / 86400000); }
  function weekday(s) { return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseDate(s).getDay()]; }
  function cnDate(s) { var d = parseDate(s); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function shortDate(s) { var d = parseDate(s); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function taskDate(s, t) { return addDays(s.exam_date, t.offset || 0); }
  function toast(msg, type) {
    var el = $('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (type || '');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.className = 'toast ' + (type || ''); }, 2400);
  }
  function isMine(s) { return s.owner_id === (S.me && S.me.id); }
  function canEdit(s) { return isMine(s) || (S.me && S.me.role === 'admin'); }
  function myProg(sid) { return S.myProgress[sid] || { done: {}, notes: {} }; }
  function typeName(k) {
    var t = window.EXAM_TEMPLATES[k];
    return t ? t.name : '自定义考试';
  }
  function empty(text, sub) {
    return '<div class="empty"><div class="icon">🗂️</div><div class="txt">' + esc(text) + '</div>' +
      (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>';
  }

  /* ================= 启动 ================= */
  function showAuthMsg(msg, type) {
    var el = $('authMsg');
    el.hidden = false;
    el.className = 'auth-msg ' + (type === 'ok' ? 'ok' : 'err');
    el.textContent = msg;
  }

  async function boot() {
    $('modeBadge').hidden = Store.isCloud;
    if (!Store.isCloud) {
      $('demoHint').hidden = false;
      $('demoHint').innerHTML = '<strong>本地演示模式</strong>：数据只保存在本浏览器。<br>演示账号：管理员 admin@demo / admin123；普通用户 li@demo / 123456。<br>配置 Supabase 后即为多人协作正式版。';
    }
    try {
      var p = await Store.init();
      if (p) enterApp(p);
    } catch (e) {
      showAuthMsg(e.message || '初始化失败', 'err');
    }
  }

  async function enterApp(p) {
    S.me = p;
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('userChip').textContent = (p.full_name || p.email) + (p.role === 'admin' ? '（管理员）' : '');
    $('navAdmin').hidden = p.role !== 'admin';
    await reloadAll();
    switchView('home');
  }

  async function reloadAll() {
    try {
      S.profiles = await Store.listProfiles();
      S.schedules = await Store.listSchedules();
      await loadMyProgress();
      updateTodoBadge();
    } catch (e) {
      toast(e.message || '加载数据失败', 'error');
    }
  }

  async function loadMyProgress() {
    var out = {};
    var jobs = S.schedules.map(async function (s) {
      try {
        var rows = await Store.getProgress(s.id);
        var mine = rows.filter(function (r) { return r.user_id === S.me.id; })[0];
        out[s.id] = mine
          ? { done: mine.done || {}, notes: mine.notes || {} }
          : { done: {}, notes: {} };
      } catch (e) {
        out[s.id] = { done: {}, notes: {} };
      }
    });
    await Promise.all(jobs);
    S.myProgress = out;
  }

  function involvedSchedules() {
    return S.schedules.filter(function (s) { return isMine(s) || s._shared; });
  }

  function countTodo() {
    var n = 0;
    involvedSchedules().forEach(function (s) {
      var prog = myProg(s.id);
      (s.tasks || []).forEach(function (t) { if (!prog.done[t.id]) n++; });
    });
    return n;
  }

  function updateTodoBadge() {
    var n = countTodo();
    var b = $('todoBadge');
    b.hidden = n === 0;
    b.textContent = n > 99 ? '99+' : n;
  }

  /* ================= 视图切换 ================= */
  function switchView(v) {
    S.view = v;
    ['home', 'todo', 'templates', 'admin', 'settings'].forEach(function (k) {
      var el = $('view' + k.charAt(0).toUpperCase() + k.slice(1));
      if (el) el.hidden = k !== v;
    });
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === v);
    });
    if (v === 'home') renderHome();
    if (v === 'todo') renderTodo();
    if (v === 'templates') renderTemplates();
    if (v === 'admin') renderAdmin();
    if (v === 'settings') renderSettings();
  }

  /* ================= 我的日程 ================= */
  function scheduleCard(s) {
    var days = diffDays(s.exam_date, fmtDate(today()));
    var dText = days > 0 ? ('还有 ' + days + ' 天') : (days === 0 ? '今天开考' : ('已过 ' + Math.abs(days) + ' 天'));
    var dTag = days > 30 ? 'tag' : (days > 7 ? 'tag tag-warning' : (days >= 0 ? 'tag tag-danger' : 'tag'));
    var prog = myProg(s.id);
    var total = (s.tasks || []).length;
    var done = (s.tasks || []).filter(function (t) { return prog.done[t.id]; }).length;
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="card" data-open="' + esc(s.id) + '">' +
      '<div class="card-title">' + esc(s.title) + '</div>' +
      '<div class="card-meta">' +
      '<span>' + esc(typeName(s.exam_type)) + '</span>' +
      '<span>' + esc(cnDate(s.exam_date)) + ' ' + weekday(s.exam_date) + '</span>' +
      '</div>' +
      '<div class="card-foot">' +
      '<span class="' + dTag + '">' + dText + '</span>' +
      (s._shared ? '<span class="tag tag-primary">' + esc(s.owner_name || '他人') + ' 创建</span>' : '<span class="tag">我创建的</span>') +
      '<span class="tag">' + done + '/' + total + '</span>' +
      '</div>' +
      '<div class="prog-bar"><i style="width:' + pct + '%"></i></div>' +
      '</div>';
  }

  function renderHome() {
    var mine = S.schedules.filter(isMine);
    var shared = involvedSchedules().filter(function (s) { return !isMine(s); });
    var html = '';
    if (!mine.length && !shared.length) {
      $('homeList').innerHTML = empty('还没有日程', '点右上角「+ 新建日程」开始');
      return;
    }
    html += '<div class="todo-group"><div class="todo-group-title">我创建的（' + mine.length + '）</div><div class="card-list">' +
      (mine.length ? mine.map(scheduleCard).join('') : '<div class="empty" style="padding:20px">暂无</div>') + '</div></div>';
    html += '<div class="todo-group"><div class="todo-group-title">共享给我的（' + shared.length + '）</div><div class="card-list">' +
      (shared.length ? shared.map(scheduleCard).join('') : '<div class="empty" style="padding:20px">暂无</div>') + '</div></div>';
    $('homeList').innerHTML = html;
    renderReminder();
  }

  function upcomingTasks(days) {
    var list = [];
    involvedSchedules().forEach(function (s) {
      var prog = myProg(s.id);
      (s.tasks || []).forEach(function (t) {
        if (prog.done[t.id]) return;
        var d = taskDate(s, t);
        var n = diffDays(d, fmtDate(today()));
        if (n >= 0 && n <= days) list.push({ s: s, t: t, date: d, days: n });
      });
    });
    list.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return list;
  }

  function renderReminder() {
    var up = upcomingTasks(7);
    var bar = $('remindBar');
    if (!up.length) { bar.hidden = true; return; }
    var todayN = up.filter(function (x) { return x.days === 0; }).length;
    bar.hidden = false;
    bar.innerHTML = '⏰ <strong>' + up.length + ' 项工作将在 7 天内到期</strong>' +
      (todayN ? '，其中 <strong>' + todayN + ' 项今天到期</strong>' : '') + '：' +
      up.slice(0, 4).map(function (x) {
        return '<div style="margin-top:4px">· ' + esc(shortDate(x.date)) + '　' + esc(x.t.title) +
          '　<span style="opacity:.7">' + esc(x.s.title) + '</span></div>';
      }).join('') +
      (up.length > 4 ? '<div style="margin-top:4px;opacity:.7">…等 ' + up.length + ' 项，详见「待办日程」</div>' : '');
  }

  /* ================= 待办日程 ================= */
  function renderTodo() {
    var rows = [];
    involvedSchedules().forEach(function (s) {
      var prog = myProg(s.id);
      (s.tasks || []).forEach(function (t) {
        rows.push({
          s: s, t: t, date: taskDate(s, t),
          done: !!prog.done[t.id], note: (prog.notes || {})[t.id] || ''
        });
      });
    });
    var f = S.todoFilter;
    if (f === 'open') rows = rows.filter(function (r) { return !r.done; });
    if (f === 'done') rows = rows.filter(function (r) { return r.done; });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });

    if (!rows.length) {
      $('todoList').innerHTML = empty(f === 'done' ? '还没有已完成的事项' : '暂无待办事项',
        f === 'open' ? '新建日程或等待同事分享给您' : '');
      return;
    }

    var t0 = fmtDate(today());
    var groups = [
      { key: 'over', title: '已逾期', items: [] },
      { key: 'today', title: '今天', items: [] },
      { key: 'week', title: '7 天内', items: [] },
      { key: 'later', title: '以后', items: [] }
    ];
    rows.forEach(function (r) {
      var n = diffDays(r.date, t0);
      if (f === 'done') groups[3].items.push(r);
      else if (n < 0) groups[0].items.push(r);
      else if (n === 0) groups[1].items.push(r);
      else if (n <= 7) groups[2].items.push(r);
      else groups[3].items.push(r);
    });
    if (f === 'done') groups[3].title = '已完成';

    var html = '';
    groups.forEach(function (g) {
      if (!g.items.length) return;
      html += '<div class="todo-group"><div class="todo-group-title">' + g.title + '（' + g.items.length + '）</div>';
      g.items.forEach(function (r) {
        html += '<div class="task-row ' + (r.done ? 'is-done' : '') + '">' +
          '<input type="checkbox" class="task-check" data-check="' + esc(r.s.id) + '|' + esc(r.t.id) + '"' +
          (r.done ? ' checked' : '') + '>' +
          '<div class="task-main">' +
          '<div class="task-title">' + esc(r.t.title) + '</div>' +
          '<div class="task-sub"><span>' + esc(r.s.title) + '</span>' +
          '<span>' + esc(r.t.phase) + '</span>' +
          '<span>' + esc(r.s.owner_name || '') + '</span>' +
          (r.note ? '<span style="color:var(--primary)">已备注</span>' : '') + '</div>' +
          (r.note ? '<div class="task-note">备注：' + esc(r.note) + '</div>' : '') +
          '</div>' +
          '<div class="task-actions">' +
          '<span class="task-date">' + esc(shortDate(r.date)) + '<br><span style="color:var(--text-3)">' + weekday(r.date) + '</span></span>' +
          '<button class="link-btn" data-note="' + esc(r.s.id) + '|' + esc(r.t.id) + '">备注</button>' +
          '</div></div>';
      });
      html += '</div>';
    });
    $('todoList').innerHTML = html;
  }

  /* ================= 打勾 / 备注 ================= */
  async function toggleTask(scheduleId, taskId, checked) {
    var prog = myProg(scheduleId);
    var done = Object.assign({}, prog.done);
    var notes = Object.assign({}, prog.notes);
    if (checked) done[taskId] = true; else delete done[taskId];
    try {
      await Store.saveMyProgress(scheduleId, done, notes);
      prog.done = done;
      prog.notes = notes;
      S.myProgress[scheduleId] = prog;
      toast(checked ? '已标记完成' : '已取消完成', 'success');
      if (S.view === 'todo') renderTodo();
      if (S.view === 'home') renderHome();
      updateTodoBadge();
      if (S.detail && S.detail.id === scheduleId) await openDetail(scheduleId, true);
      if (checked) checkAllDone(scheduleId);
    } catch (e) {
      toast(e.message || '保存失败', 'error');
    }
  }

  function checkAllDone(scheduleId) {
    var s = S.schedules.filter(function (x) { return x.id === scheduleId; })[0];
    if (!s) return;
    var prog = myProg(scheduleId);
    var total = (s.tasks || []).length;
    var done = (s.tasks || []).filter(function (t) { return prog.done[t.id]; }).length;
    if (total && done === total) toast('🎉 这份日程的全部工作已完成', 'success');
  }

  function openNoteModal(scheduleId, taskId) {
    var s = S.schedules.filter(function (x) { return x.id === scheduleId; })[0];
    if (!s) return;
    var t = (s.tasks || []).filter(function (x) { return x.id === taskId; })[0];
    if (!t) return;
    var prog = myProg(scheduleId);
    var cur = (prog.notes || {})[taskId] || '';
    openModal({
      title: '任务备注',
      sub: s.title + ' · ' + t.title,
      narrow: true,
      body: '<label class="field"><span>备注内容（仅自己和其他同事可见）</span>' +
        '<textarea id="noteText" class="inline-note" placeholder="例如：已电话通知各考点，材料已收齐">' + esc(cur) + '</textarea></label>',
      foot: '<button class="btn" data-close="1">取消</button>' +
        '<button class="btn btn-primary" id="btnSaveNote">保存备注</button>',
      onMount: function () {
        $('btnSaveNote').onclick = async function () {
          var notes = Object.assign({}, prog.notes);
          var v = $('noteText').value.trim();
          if (v) notes[taskId] = v; else delete notes[taskId];
          try {
            await Store.saveMyProgress(scheduleId, prog.done || {}, notes);
            prog.notes = notes;
            S.myProgress[scheduleId] = prog;
            closeModal();
            toast('备注已保存', 'success');
            if (S.view === 'todo') renderTodo();
            if (S.detail && S.detail.id === scheduleId) await openDetail(scheduleId, true);
          } catch (e) { toast(e.message || '保存失败', 'error'); }
        };
      }
    });
  }

  /* ================= 通用弹窗 ================= */
  var modalState = {};
  function openModal(opt) {
    modalState = opt;
    var root = $('modalRoot');
    root.innerHTML =
      '<div class="modal-mask" id="mask">' +
      '<div class="modal ' + (opt.wide ? 'wide ' : '') + (opt.narrow ? 'narrow' : '') + '">' +
      '<div class="modal-head"><div><h3>' + opt.title + '</h3>' +
      (opt.sub ? '<div class="sub">' + opt.sub + '</div>' : '') + '</div>' +
      '<button class="modal-close" data-close="1">×</button></div>' +
      '<div class="modal-body" id="modalBody">' + (opt.body || '') + '</div>' +
      (opt.foot ? '<div class="modal-foot">' + opt.foot + '</div>' : '') +
      '</div></div>';
    var mask = $('mask');
    mask.addEventListener('click', function (e) {
      if (e.target === mask) closeModal();
    });
    root.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', closeModal);
    });
    if (opt.onMount) opt.onMount();
  }

  function closeModal() {
    $('modalRoot').innerHTML = '';
    modalState = {};
  }
  window.__closeModal = closeModal;

  /* ================= 日程详情 ================= */
  function findName(id) {
    var p = S.profiles.filter(function (x) { return x.id === id; })[0];
    return p ? (p.full_name || p.email) : '未知用户';
  }

  async function openDetail(id, silent) {
    var s = S.schedules.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var shares = [], progRows = [];
    try {
      var res = await Promise.all([Store.getShares(id), Store.getProgress(id)]);
      shares = res[0] || [];
      progRows = res[1] || [];
    } catch (e) { /* 忽略单次读取失败 */ }
    S.detail = s;
    S.detailShared = shares;
    S.detailProgress = progRows;
    renderDetail(silent);
  }

  function renderDetail(silent) {
    var s = S.detail;
    if (!s) return;
    var prog = myProg(s.id);
    var tasks = (s.tasks || []).slice().sort(function (a, b) {
      var pa = window.PHASE_ORDER.indexOf(a.phase), pb = window.PHASE_ORDER.indexOf(b.phase);
      if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
      return (a.offset || 0) - (b.offset || 0);
    });
    var doneCount = tasks.filter(function (t) { return prog.done[t.id]; }).length;
    var days = diffDays(s.exam_date, fmtDate(today()));

    var participants = [{ id: s.owner_id, name: s.owner_name || findName(s.owner_id) }].concat(
      S.detailShared.map(function (x) { return { id: x.user_id, name: findName(x.user_id) }; })
    );
    var uniq = {}, pList = [];
    participants.forEach(function (p) {
      if (p.id && !uniq[p.id]) { uniq[p.id] = 1; pList.push(p); }
    });

    var progHtml = '';
    if (pList.length > 1 || canEdit(s)) {
      progHtml = '<div class="section-label">完成进度</div><div class="progress-wrap">';
      pList.forEach(function (p) {
        var row = S.detailProgress.filter(function (x) { return x.user_id === p.id; })[0] || { done: {} };
        var d = tasks.filter(function (t) { return (row.done || {})[t.id]; }).length;
        var pct = tasks.length ? Math.round(d / tasks.length * 100) : 0;
        progHtml += '<div class="progress-line"><span style="width:90px">' + esc(p.name) +
          (p.id === S.me.id ? ' (我)' : '') + '</span>' +
          '<span class="bar"><i style="width:' + pct + '%"></i></span>' +
          '<span class="num">' + d + '/' + tasks.length + '</span></div>';
      });
      progHtml += '</div>';
    }

    var body = '<div class="detail-stats">' +
      '<div class="stat"><span class="k">考试类型</span><span class="v">' + esc(typeName(s.exam_type)) + '</span></div>' +
      '<div class="stat"><span class="k">考试日期</span><span class="v">' + esc(cnDate(s.exam_date)) + ' ' + weekday(s.exam_date) + '</span></div>' +
      '<div class="stat"><span class="k">距考试</span><span class="v">' + (days > 0 ? days + ' 天' : (days === 0 ? '今天' : '已结束 ' + Math.abs(days) + ' 天')) + '</span></div>' +
      '<div class="stat"><span class="k">我的完成度</span><span class="v">' + doneCount + '/' + tasks.length + '</span></div>' +
      '</div>' + progHtml;

    var lastPhase = '';
    tasks.forEach(function (t) {
      if (t.phase !== lastPhase) {
        lastPhase = t.phase;
        body += '<div class="phase-head">' + (window.PHASE_ICON[t.phase] || '📌') + ' ' + esc(t.phase) +
          '<span class="line"></span></div>';
      }
      var d = taskDate(s, t);
      var n = diffDays(d, fmtDate(today()));
      var isDone = !!prog.done[t.id];
      var note = (prog.notes || {})[t.id] || '';
      body += '<div class="task-row ' + (isDone ? 'is-done' : '') + '">' +
        '<input type="checkbox" class="task-check" data-check="' + esc(s.id) + '|' + esc(t.id) + '"' + (isDone ? ' checked' : '') + '>' +
        '<div class="task-main">' +
        '<div class="task-title">' + esc(t.title) +
        (t.isExamDay ? ' <span class="tag tag-primary">考试日</span>' : '') + '</div>' +
        '<div class="task-sub">' +
        '<span>' + esc(shortDate(d)) + ' ' + weekday(d) + '</span>' +
        '<span>' + (t.offset < 0 ? '考前 ' + Math.abs(t.offset) + ' 天' : (t.offset === 0 ? '考试当天' : '考后 ' + t.offset + ' 天')) + '</span>' +
        (n < 0 ? '<span style="color:var(--text-3)">已过</span>' : (n === 0 ? '<span style="color:var(--danger)">今天</span>' : '')) +
        '</div>' +
        (t.desc ? '<div class="task-sub" style="color:var(--text-3)">' + esc(t.desc) + '</div>' : '') +
        (note ? '<div class="task-note">我的备注：' + esc(note) + '</div>' : '') +
        '</div>' +
        '<div class="task-actions"><button class="link-btn" data-note="' + esc(s.id) + '|' + esc(t.id) + '">备注</button></div>' +
        '</div>';
    });

    var foot = '<button class="btn btn-sm" data-close="1">关闭</button>' +
      '<div class="spacer"></div>' +
      (canEdit(s) ? '<button class="btn btn-sm" id="btnShare">共享给同事</button>' : '') +
      (canEdit(s) ? '<button class="btn btn-sm" id="btnEditSchedule">编辑日程</button>' : '') +
      '<button class="btn btn-sm" id="btnCsv">导出CSV</button>' +
      '<button class="btn btn-sm btn-primary" id="btnIcs">📲 导入手机日历</button>' +
      '<button class="btn btn-sm" id="btnPrint">打印</button>' +
      (canEdit(s) ? '<button class="btn btn-sm btn-danger" id="btnDelete">删除</button>' : '');

    openModal({
      title: esc(s.title),
      sub: (isMine(s) ? '我创建的' : esc(s.owner_name || '') + ' 创建 · 邀请我协作') +
        (S.detailShared.length ? ' · 协同 ' + (S.detailShared.length + 1) + ' 人' : ''),
      wide: true,
      body: body,
      foot: foot,
      onMount: function () {
        var root = $('modalBody');
        root.querySelectorAll('[data-check]').forEach(function (cb) {
          cb.addEventListener('change', function () {
            var p = cb.getAttribute('data-check').split('|');
            toggleTask(p[0], p[1], cb.checked);
          });
        });
        root.querySelectorAll('[data-note]').forEach(function (b) {
          b.addEventListener('click', function () {
            var p = b.getAttribute('data-note').split('|');
            openNoteModal(p[0], p[1]);
          });
        });
        if ($('btnShare')) $('btnShare').onclick = function () { openShareModal(s); };
        if ($('btnEditSchedule')) $('btnEditSchedule').onclick = function () { openEditSchedule(s); };
        $('btnIcs').onclick = function () {
          ICS.download(s);
          toast('已生成日历文件，按提示导入手机日历', 'success');
        };
        $('btnCsv').onclick = function () { exportCSV(s); };
        $('btnPrint').onclick = function () { printSchedule(s); };
        if ($('btnDelete')) {
          $('btnDelete').onclick = async function () {
            if (!confirm('确定删除《' + s.title + '》吗？删除后不可恢复。')) return;
            try {
              await Store.deleteSchedule(s.id);
              await Store.addLog('删除日程', s.title, '');
              closeModal();
              toast('已删除', 'success');
              await reloadAll();
              renderHome();
            } catch (e) { toast(e.message || '删除失败', 'error'); }
          };
        }
      }
    });
  }

  /* ================= 共享给同事 ================= */
  function openShareModal(s) {
    var cur = S.detailShared.map(function (x) { return x.user_id; });
    var others = S.profiles.filter(function (p) { return p.id !== s.owner_id && p.enabled !== false; });
    var body = '<div class="hint" style="font-size:12px;color:var(--text-3);margin-bottom:10px">' +
      '被勾选的同事会在「待办日程」中看到这份日程。日程内容只有创建者（和管理员）可以修改，同事可以打勾、写备注。</div>' +
      '<div class="share-list">' +
      (others.length ? others.map(function (p) {
        var on = cur.indexOf(p.id) >= 0;
        return '<label class="person-check ' + (on ? 'checked' : '') + '">' +
          '<input type="checkbox" data-person="' + esc(p.id) + '"' + (on ? ' checked' : '') + '>' +
          esc(p.full_name || p.email) + (p.department ? '<span style="color:var(--text-3);font-size:11px">（' + esc(p.department) + '）</span>' : '') +
          '</label>';
      }).join('') : '<div class="hint">暂无其他用户，请先让同事注册账号</div>') +
      '</div>';

    openModal({
      title: '共享日程给同事',
      sub: esc(s.title),
      narrow: true,
      body: body,
      foot: '<button class="btn" data-close="1">取消</button>' +
        '<button class="btn btn-primary" id="btnSaveShare">保存共享</button>',
      onMount: function () {
        $('modalBody').querySelectorAll('[data-person]').forEach(function (cb) {
          cb.addEventListener('change', function () {
            cb.parentElement.classList.toggle('checked', cb.checked);
          });
        });
        $('btnSaveShare').onclick = async function () {
          var ids = [];
          $('modalBody').querySelectorAll('[data-person]').forEach(function (cb) {
            if (cb.checked) ids.push(cb.getAttribute('data-person'));
          });
          try {
            await Store.setShares(s.id, ids);
            await Store.addLog('共享日程', s.title, ids.length ? '共享给 ' + ids.map(findName).join('、') : '取消全部共享');
            toast('共享设置已保存', 'success');
            await openDetail(s.id);
          } catch (e) { toast(e.message || '保存失败', 'error'); }
        };
      }
    });
  }

  /* ================= 新建 / 编辑日程 ================= */
  function buildTemplateOptions(selected) {
    var opts = '';
    Object.keys(window.EXAM_TEMPLATES).forEach(function (k) {
      var t = window.EXAM_TEMPLATES[k];
      opts += '<option value="builtin:' + k + '"' + (selected === 'builtin:' + k ? ' selected' : '') + '>内置 · ' +
        esc(t.name) + '（' + t.tasks.length + ' 项）</option>';
    });
    (S.libTemplates || []).forEach(function (t) {
      opts += '<option value="lib:' + esc(t.id) + '"' + (selected === 'lib:' + t.id ? ' selected' : '') + '>中心模板 · ' +
        esc(t.title) + '（' + (t.tasks || []).length + ' 项）</option>';
    });
    opts += '<option value="empty"' + (selected === 'empty' ? ' selected' : '') + '>空白（自己添加）</option>';
    return opts;
  }

  function taskEditRow(t, i) {
    var phaseOpts = window.PHASE_ORDER.map(function (p) {
      return '<option value="' + esc(p) + '"' + (t.phase === p ? ' selected' : '') + '>' + esc(p) + '</option>';
    }).join('');
    return '<div class="task-edit-row" data-row="' + i + '">' +
      '<input type="text" data-f="title" value="' + esc(t.title) + '" placeholder="工作事项名称">' +
      '<input type="number" class="num-input" data-f="offset" value="' + (t.offset || 0) + '" title="负数=考前天数">' +
      '<select data-f="phase">' + phaseOpts + '</select>' +
      '<button class="icon-btn" data-del="' + i + '" title="删除">✕</button>' +
      '</div>';
  }

  function renderTaskEditor() {
    var box = $('taskEditList');
    if (!box) return;
    box.innerHTML = S.editTasks.length
      ? S.editTasks.map(taskEditRow).join('')
      : '<div class="hint" style="padding:10px;color:var(--text-3);font-size:13px">还没有工作事项，点「+ 添加」</div>';
    $('taskCount').textContent = S.editTasks.length;
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        collectTasks();
        S.editTasks.splice(+b.getAttribute('data-del'), 1);
        renderTaskEditor();
      });
    });
  }

  function collectTasks() {
    var box = $('taskEditList');
    if (!box) return;
    var rows = box.querySelectorAll('[data-row]');
    var out = [];
    rows.forEach(function (row, idx) {
      var title = row.querySelector('[data-f="title"]').value.trim();
      var offset = parseInt(row.querySelector('[data-f="offset"]').value, 10);
      var phase = row.querySelector('[data-f="phase"]').value;
      if (!title) return;
      out.push({
        id: (S.editTasks[idx] && S.editTasks[idx].id) || ('t' + Date.now().toString(36) + idx),
        title: title,
        offset: isNaN(offset) ? 0 : offset,
        phase: phase,
        desc: (S.editTasks[idx] && S.editTasks[idx].desc) || '',
        isExamDay: offset === 0 && phase === '考试实施'
      });
    });
    S.editTasks = out;
  }

  function applyTemplate(val) {
    collectTasks();
    if (val === 'empty') {
      S.editTasks = [];
    } else if (val.indexOf('builtin:') === 0) {
      var key = val.split(':')[1];
      var tpl = window.EXAM_TEMPLATES[key];
      S.editTasks = tpl.tasks.map(function (t, i) {
        return { id: 't' + (i + 1), phase: t.phase, title: t.title, desc: t.desc || '', offset: t.offset, isExamDay: !!t.isExamDay };
      });
      if (!$('eTitle').value.trim() || $('eTitle').dataset.auto === '1') {
        var y = new Date().getFullYear();
        $('eTitle').value = '惠州市' + y + '年' + tpl.name;
        $('eTitle').dataset.auto = '1';
      }
    } else if (val.indexOf('lib:') === 0) {
      var id = val.slice(4);
      var lib = (S.libTemplates || []).filter(function (x) { return x.id === id; })[0];
      if (lib) {
        S.editTasks = (lib.tasks || []).map(function (t, i) {
          return { id: 't' + (i + 1), phase: t.phase || '考前筹备', title: t.title, desc: t.desc || '', offset: t.offset || 0, isExamDay: !!t.isExamDay };
        });
        if (!$('eTitle').value.trim() || $('eTitle').dataset.auto === '1') {
          $('eTitle').value = lib.title;
          $('eTitle').dataset.auto = '1';
        }
      }
    }
    renderTaskEditor();
  }

  function editBodyHtml(isEdit) {
    var people = S.profiles.filter(function (p) { return p.id !== S.me.id && p.enabled !== false; });
    return '<div class="grid2">' +
      '<label class="field"><span>日程名称</span><input id="eTitle" type="text" placeholder="如：惠州市2026年普通高考"></label>' +
      '<label class="field"><span>考试类型</span><select id="eType">' +
      Object.keys(window.EXAM_TEMPLATES).map(function (k) {
        return '<option value="' + k + '">' + esc(window.EXAM_TEMPLATES[k].name) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field"><span>考试开始日期</span><input id="eDate" type="date"></label>' +
      '<label class="field"><span>考试结束日期</span><input id="eEnd" type="date"></label>' +
      '</div>' +
      (isEdit ? '' : '<label class="field"><span>流程模板</span><select id="eTpl">' +
        buildTemplateOptions('builtin:gaokao') + '</select></label>') +
      '<div class="section-label">协同同事<span class="hint" style="font-weight:400;color:var(--text-3)">被选中的人可在「待办日程」看到并打勾</span></div>' +
      '<div class="share-list">' + (people.length ? people.map(function (p) {
        return '<label class="person-check"><input type="checkbox" data-person="' + esc(p.id) + '">' +
          esc(p.full_name || p.email) + '</label>';
      }).join('') : '<span class="hint">暂无其他用户</span>') + '</div>' +
      '<div class="section-label">工作事项（<span id="taskCount">0</span> 项）' +
      '<button class="btn btn-sm" id="btnAddTask">+ 添加事项</button></div>' +
      '<div id="taskEditList"></div>' +
      '<div class="tpl-preview">天数为负数表示考试前 N 天，0 表示考试当天，正数为考后 N 天。</div>';
  }

  function mountEditModal(isEdit, s) {
    if (isEdit) {
      $('eTitle').value = s.title;
      $('eType').value = s.exam_type || 'custom';
      $('eDate').value = s.exam_date;
      $('eEnd').value = s.exam_end_date || s.exam_date;
      $('eTitle').dataset.auto = '1';
    } else {
      $('eDate').value = addDays(fmtDate(today()), 30);
      $('eEnd').value = addDays(fmtDate(today()), 30);
    }
    $('modalBody').querySelectorAll('[data-person]').forEach(function (cb) {
      if (S.editShares.indexOf(cb.getAttribute('data-person')) >= 0) {
        cb.checked = true;
        cb.parentElement.classList.add('checked');
      }
      cb.addEventListener('change', function () {
        cb.parentElement.classList.toggle('checked', cb.checked);
      });
    });
    $('eTitle').addEventListener('input', function () { this.dataset.auto = '0'; });
    renderTaskEditor();
    $('btnAddTask').onclick = function () {
      collectTasks();
      S.editTasks.push({ id: 'n' + Date.now().toString(36), phase: '考前筹备', title: '', desc: '', offset: -7 });
      renderTaskEditor();
    };
    if (!isEdit && $('eTpl')) {
      $('eTpl').addEventListener('change', function () { applyTemplate(this.value); });
      applyTemplate('builtin:gaokao');
    }
    $('eType').addEventListener('change', function () {
      if (!isEdit && $('eTpl')) {
        var v = 'builtin:' + this.value;
        $('eTpl').value = v;
        $('eTitle').dataset.auto = '1';
        applyTemplate(v);
      }
    });
    $('btnSaveSchedule').onclick = function () { saveSchedule(isEdit, s); };
  }

  async function openCreate() {
    try { S.libTemplates = await Store.listTemplates(); } catch (e) { S.libTemplates = []; }
    S.editId = null;
    S.editTasks = [];
    S.editShares = [];
    S.editing = null;
    openModal({
      title: '新建考试日程',
      wide: true,
      body: editBodyHtml(false),
      foot: '<button class="btn" data-close="1">取消</button>' +
        '<button class="btn btn-primary" id="btnSaveSchedule">保存日程</button>',
      onMount: function () { mountEditModal(false, null); }
    });
  }

  async function openEditSchedule(s) {
    try { S.libTemplates = await Store.listTemplates(); } catch (e) { S.libTemplates = []; }
    S.editId = s.id;
    S.editing = s;
    S.editTasks = (s.tasks || []).map(function (t) { return Object.assign({}, t); });
    S.editShares = (S.detailShared || []).map(function (x) { return x.user_id; });
    openModal({
      title: '编辑日程',
      sub: esc(s.title),
      wide: true,
      body: editBodyHtml(true),
      foot: '<button class="btn" data-close="1">取消</button>' +
        '<button class="btn btn-primary" id="btnSaveSchedule">保存修改</button>',
      onMount: function () { mountEditModal(true, s); }
    });
  }

  async function saveSchedule(isEdit, s) {
    collectTasks();
    var title = $('eTitle').value.trim();
    var date = $('eDate').value;
    var end = $('eEnd').value || date;
    if (!title) { toast('请填写日程名称', 'error'); return; }
    if (!date) { toast('请选择考试日期', 'error'); return; }
    if (end < date) { toast('结束日期不能早于开始日期', 'error'); return; }
    if (!S.editTasks.length) { toast('至少需要一个工作事项', 'error'); return; }
    var ids = [];
    $('modalBody').querySelectorAll('[data-person]').forEach(function (cb) {
      if (cb.checked) ids.push(cb.getAttribute('data-person'));
    });
    var type = $('eType').value || 'custom';
    var payload = {
      title: title, exam_type: type, exam_date: date, exam_end_date: end, tasks: S.editTasks
    };
    try {
      var row;
      if (isEdit) {
        row = await Store.updateSchedule(s.id, payload);
        await Store.addLog('修改日程', title, '共 ' + S.editTasks.length + ' 项工作');
      } else {
        row = await Store.createSchedule(payload);
        await Store.addLog('创建日程', title, '共 ' + S.editTasks.length + ' 项工作');
      }
      await Store.setShares(row.id, ids);
      if (!isEdit && ids.length) await Store.addLog('共享日程', title, '共享给 ' + ids.map(findName).join('、'));
      closeModal();
      toast(isEdit ? '修改已保存' : '日程已创建', 'success');
      await reloadAll();
      renderHome();
      await openDetail(row.id);
    } catch (e) {
      toast(e.message || '保存失败', 'error');
    }
  }

  /* ================= 模板库 ================= */
  async function createFromTemplate(val) {
    await openCreate();
    if ($('eTpl')) {
      $('eTpl').value = val;
      applyTemplate(val);
    }
  }

  async function renderTemplates() {
    var builtin = Object.keys(window.EXAM_TEMPLATES).map(function (k) {
      var t = window.EXAM_TEMPLATES[k];
      return '<div class="tpl-item"><div><div class="tpl-name">' + esc(t.name) + '</div>' +
        '<div class="tpl-meta">' + t.tasks.length + ' 个工作事项 · 自动按考试日期倒推</div></div>' +
        '<button class="btn btn-sm" data-tpl="builtin:' + k + '">使用</button></div>';
    }).join('');
    $('builtinList').innerHTML = builtin;

    $('libList').innerHTML = '<div class="empty" style="padding:20px">加载中…</div>';
    try {
      S.libTemplates = await Store.listTemplates();
    } catch (e) {
      S.libTemplates = [];
    }
    if (!S.libTemplates.length) {
      $('libList').innerHTML = '<div class="empty" style="padding:24px"><div class="txt">还没有中心发布的模板</div>' +
        '<div class="sub">管理员可在「管理中心」把成熟日程发布为模板</div></div>';
    } else {
      $('libList').innerHTML = S.libTemplates.map(function (t) {
        return '<div class="tpl-item"><div><div class="tpl-name">' + esc(t.title) + '</div>' +
          '<div class="tpl-meta">' + (t.tasks || []).length + ' 项 · ' + esc(typeName(t.exam_type)) + '</div></div>' +
          '<div class="task-actions"><button class="btn btn-sm" data-tpl="lib:' + esc(t.id) + '">使用</button>' +
          (S.me.role === 'admin' ? '<button class="link-btn" data-del-tpl="' + esc(t.id) + '">删除</button>' : '') + '</div></div>';
      }).join('');
    }
    $('btnPublishTemplate').hidden = S.me.role !== 'admin';
    $('btnPublishTemplate').onclick = openPublishTemplate;
    document.querySelectorAll('[data-tpl]').forEach(function (b) {
      b.onclick = function () { createFromTemplate(b.getAttribute('data-tpl')); };
    });
    document.querySelectorAll('[data-del-tpl]').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('确定删除该模板吗？')) return;
        try {
          await Store.deleteTemplate(b.getAttribute('data-del-tpl'));
          await Store.addLog('删除模板', '', '');
          toast('模板已删除', 'success');
          renderTemplates();
        } catch (e) { toast(e.message || '删除失败', 'error'); }
      };
    });
  }

  function openPublishTemplate() {
    var options = S.schedules.map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.title) + '（' + (s.tasks || []).length + ' 项）</option>';
    }).join('');
    openModal({
      title: '发布标准模板',
      sub: '把一份成熟日程的流程固化为模板，供全体同事套用',
      narrow: true,
      body: '<label class="field"><span>模板名称</span><input id="tplTitle" type="text" placeholder="如：高考考前一周检查清单"></label>' +
        '<label class="field"><span>来源日程</span><select id="tplSource">' + (options || '<option value="">暂无可选日程</option>') + '</select></label>',
      foot: '<button class="btn" data-close="1">取消</button>' +
        '<button class="btn btn-primary" id="btnDoPublish">发布</button>',
      onMount: function () {
        $('btnDoPublish').onclick = async function () {
          var title = $('tplTitle').value.trim();
          var sid = $('tplSource').value;
          var src = S.schedules.filter(function (x) { return x.id === sid; })[0];
          if (!title) { toast('请填写模板名称', 'error'); return; }
          if (!src) { toast('请选择来源日程', 'error'); return; }
          try {
            await Store.createTemplate({ title: title, exam_type: src.exam_type, tasks: src.tasks });
            await Store.addLog('发布模板', title, '');
            closeModal();
            toast('模板已发布', 'success');
            renderTemplates();
          } catch (e) { toast(e.message || '发布失败', 'error'); }
        };
      }
    });
  }

  /* ================= 管理中心 ================= */
  function adminCard(s) {
    return '<div class="card" data-open="' + esc(s.id) + '">' +
      '<div class="card-title">' + esc(s.title) + '</div>' +
      '<div class="card-meta"><span>' + esc(s.owner_name || findName(s.owner_id)) + '</span>' +
      '<span>' + esc(cnDate(s.exam_date)) + '</span><span>' + (s.tasks || []).length + ' 项</span></div>' +
      '<div class="card-foot"><span class="tag">' + esc(typeName(s.exam_type)) + '</span></div></div>';
  }

  async function renderAdmin() {
    if (S.me.role !== 'admin') return;
    var kw = ($('adminSearch').value || '').trim();
    var list = S.schedules.filter(function (s) {
      if (!kw) return true;
      return (s.title || '').indexOf(kw) >= 0 || (s.owner_name || '').indexOf(kw) >= 0;
    });
    $('adminSchedules').innerHTML = list.length
      ? list.map(adminCard).join('')
      : empty('没有匹配的日程');

    $('adminUsers').innerHTML = S.profiles.map(function (p) {
      var isMe = p.id === S.me.id;
      return '<div class="user-row"><div style="flex:1;min-width:150px">' +
        '<div class="user-name">' + esc(p.full_name || p.email) +
        (p.role === 'admin' ? ' <span class="tag tag-primary">管理员</span>' : '') +
        (p.enabled === false ? ' <span class="tag tag-danger">已停用</span>' : '') + '</div>' +
        '<div class="user-dept">' + esc(p.email || '') + (p.department ? ' · ' + esc(p.department) : '') + '</div></div>' +
        '<div class="task-actions">' +
        (isMe ? '<span class="tag">当前账号</span>' : '<button class="btn btn-sm" data-enable="' + esc(p.id) + '">' + (p.enabled === false ? '启用' : '停用') + '</button>') +
        (isMe ? '' : '<button class="btn btn-sm" data-role="' + esc(p.id) + '">' + (p.role === 'admin' ? '取消管理员' : '设为管理员') + '</button>') +
        '</div></div>';
    }).join('');

    $('adminUsers').querySelectorAll('[data-enable]').forEach(function (b) {
      b.onclick = async function () {
        var id = b.getAttribute('data-enable');
        var p = S.profiles.filter(function (x) { return x.id === id; })[0];
        try {
          await Store.updateProfile(id, { enabled: p.enabled === false });
          await Store.addLog(p.enabled === false ? '启用账号' : '停用账号', p.full_name || p.email, '');
          toast('已更新账号状态', 'success');
          await reloadAll();
          renderAdmin();
        } catch (e) { toast(e.message || '操作失败', 'error'); }
      };
    });
    $('adminUsers').querySelectorAll('[data-role]').forEach(function (b) {
      b.onclick = async function () {
        var id = b.getAttribute('data-role');
        var p = S.profiles.filter(function (x) { return x.id === id; })[0];
        if (!confirm('确定修改「' + (p.full_name || p.email) + '」的管理员身份吗？')) return;
        try {
          await Store.updateProfile(id, { role: p.role === 'admin' ? 'user' : 'admin' });
          await Store.addLog('调整角色', p.full_name || p.email, p.role === 'admin' ? '取消管理员' : '设为管理员');
          toast('角色已更新', 'success');
          await reloadAll();
          renderAdmin();
        } catch (e) { toast(e.message || '操作失败', 'error'); }
      };
    });

    $('adminLogs').innerHTML = '<div class="empty" style="padding:20px">加载中…</div>';
    try {
      var logs = await Store.listLogs();
      $('adminLogs').innerHTML = logs.length ? logs.map(function (l) {
        var t = l.created_at ? String(l.created_at).replace('T', ' ').slice(0, 16) : '';
        return '<div class="log-row"><span class="log-time">' + esc(t) + '</span>' +
          '<span><strong>' + esc(l.actor_name || '') + '</strong> ' + esc(l.action) +
          (l.target ? '：' + esc(l.target) : '') + (l.detail ? '（' + esc(l.detail) + '）' : '') + '</span></div>';
      }).join('') : empty('暂无日志');
    } catch (e) {
      $('adminLogs').innerHTML = empty('读取日志失败', e.message || '');
    }
  }

  /* ================= 设置 ================= */
  function renderSettings() {
    $('pfName').value = S.me.full_name || '';
    $('pfDept').value = S.me.department || '';
    $('pfPhone').value = S.me.phone || '';
    $('pfEmail').value = S.me.email || '';
  }

  async function saveProfile() {
    try {
      var row = await Store.updateProfile(S.me.id, {
        full_name: $('pfName').value.trim(),
        department: $('pfDept').value.trim(),
        phone: $('pfPhone').value.trim()
      });
      S.me = Object.assign({}, S.me, row);
      $('userChip').textContent = (S.me.full_name || S.me.email) + (S.me.role === 'admin' ? '（管理员）' : '');
      toast('资料已保存', 'success');
    } catch (e) { toast(e.message || '保存失败', 'error'); }
  }

  /* ================= 导出 / 打印 ================= */
  function downloadText(name, text, mime) {
    var blob = new Blob(['\ufeff' + text], { type: mime + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name.replace(/[\\/:*?"<>|]/g, '_');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }

  function exportCSV(s) {
    var prog = myProg(s.id);
    var rows = [['阶段', '日期', '星期', '工作事项', '说明', '距考试天数', '我的状态', '我的备注']];
    (s.tasks || []).slice().sort(function (a, b) { return (a.offset || 0) - (b.offset || 0); })
      .forEach(function (t) {
        var d = taskDate(s, t);
        rows.push([
          t.phase, d, weekday(d), t.title, t.desc || '',
          String(t.offset || 0), prog.done[t.id] ? '已完成' : '未完成', (prog.notes || {})[t.id] || ''
        ]);
      });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    downloadText(s.title + '_工作日程.csv', csv, 'text/csv');
    toast('CSV 已导出', 'success');
  }

  function printSchedule(s) {
    var prog = myProg(s.id);
    var html = '<html><head><meta charset="utf-8"><title>' + esc(s.title) + '</title><style>' +
      'body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;padding:28px;color:#222}' +
      'h1{font-size:20px;margin:0 0 6px}p.meta{color:#666;font-size:12px;margin:0 0 18px}' +
      'table{width:100%;border-collapse:collapse;font-size:12px}' +
      'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}' +
      'th{background:#f2f5f9}tr.exam td{background:#eef4ff;font-weight:600}' +
      '.done{color:#2f9e44}' +
      '</style></head><body>';
    html += '<h1>' + esc(s.title) + '</h1><p class="meta">考试日期：' + esc(cnDate(s.exam_date)) +
      '　创建人：' + esc(s.owner_name || '') + '　打印时间：' + fmtDate(new Date()) + '</p>';
    html += '<table><tr><th style="width:70px">阶段</th><th style="width:80px">日期</th><th style="width:48px">星期</th>' +
      '<th style="width:200px">工作事项</th><th>说明</th><th style="width:60px">状态</th></tr>';
    (s.tasks || []).slice().sort(function (a, b) {
      return (a.offset || 0) - (b.offset || 0);
    }).forEach(function (t) {
      var d = taskDate(s, t);
      html += '<tr' + (t.isExamDay ? ' class="exam"' : '') + '><td>' + esc(t.phase) + '</td><td>' + d + '</td><td>' +
        weekday(d) + '</td><td>' + esc(t.title) + '</td><td>' + esc(t.desc || '') + '</td><td class="' +
        (prog.done[t.id] ? 'done' : '') + '">' + (prog.done[t.id] ? '已完成' : '') + '</td></tr>';
    });
    html += '</table></body></html>';
    var w = window.open('', '_blank');
    if (!w) { toast('浏览器阻止了弹窗，请允许后重试', 'error'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(function () { w.print(); }, 400);
  }

  async function backupAll() {
    try {
      var data = await Store.exportAllData();
      var text = JSON.stringify({ exported_at: new Date().toISOString(), org: '惠州市考试中心', data: data }, null, 2);
      downloadText('考试日程系统备份_' + fmtDate(new Date()) + '.json', text, 'application/json');
      await Store.addLog('导出备份', '全部数据', '');
      toast('备份文件已生成', 'success');
    } catch (e) { toast(e.message || '导出失败', 'error'); }
  }

  /* ================= 事件绑定 ================= */
  function switchAuthTab(tab) {
    document.querySelectorAll('[data-auth-tab]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-auth-tab') === tab);
    });
    $('loginPanel').hidden = tab !== 'login';
    $('registerPanel').hidden = tab !== 'register';
    $('authMsg').hidden = true;
  }

  function bindEvents() {
    document.querySelectorAll('[data-auth-tab]').forEach(function (b) {
      b.addEventListener('click', function () { switchAuthTab(b.getAttribute('data-auth-tab')); });
    });

    $('btnLogin').addEventListener('click', async function () {
      var email = $('loginEmail').value.trim();
      var pwd = $('loginPassword').value;
      if (!email || !pwd) { showAuthMsg('请输入邮箱和密码'); return; }
      var btn = this;
      btn.disabled = true;
      btn.textContent = '登录中…';
      try {
        var p = await Store.signIn(email, pwd);
        await enterApp(p);
      } catch (e) {
        showAuthMsg(e.message || '登录失败');
        btn.disabled = false;
        btn.textContent = '登 录';
      }
    });

    $('loginPassword').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') $('btnLogin').click();
    });

    $('btnDiag').addEventListener('click', async function () {
      var cfg = window.APP_CONFIG || {};
      if (!cfg.SUPABASE_URL) { showAuthMsg('当前为本地演示模式，无需联网', 'ok'); return; }
      showAuthMsg('正在检测云端连接…', 'ok');
      var t0 = Date.now();
      try {
        var ctl = new AbortController();
        var timer = setTimeout(function () { ctl.abort(); }, 8000);
        var res = await fetch(cfg.SUPABASE_URL + '/auth/v1/settings', {
          headers: { apikey: cfg.SUPABASE_ANON_KEY },
          signal: ctl.signal
        });
        clearTimeout(timer);
        var cost = Date.now() - t0;
        if (res.ok) {
          showAuthMsg('云端连接正常（' + cost + 'ms）', 'ok');
        } else {
          showAuthMsg('云端返回异常状态 ' + res.status + '（' + cost + 'ms），请截图反馈', 'err');
        }
      } catch (e) {
        var cost2 = Date.now() - t0;
        var why = e.name === 'AbortError' ? '超时 8 秒未响应' : (e.message || e.name);
        showAuthMsg('连接失败（' + cost2 + 'ms）：' + why + '｜目标 ' + cfg.SUPABASE_URL.replace('https://', ''), 'err');
      }
    });

    $('btnRegister').addEventListener('click', async function () {
      var name = $('regName').value.trim();
      var dept = $('regDept').value.trim();
      var email = $('regEmail').value.trim();
      var pwd = $('regPassword').value;
      var code = $('regInvite').value.trim();
      if (!name) { showAuthMsg('请填写姓名'); return; }
      if (!email || !pwd) { showAuthMsg('请填写邮箱和密码'); return; }
      if (pwd.length < 6) { showAuthMsg('密码至少 6 位'); return; }
      var btn = this;
      btn.disabled = true;
      btn.textContent = '注册中…';
      try {
        var r = await Store.signUp(email, pwd, name, dept, code);
        if (r.needsConfirm) {
          showAuthMsg('注册成功，请到邮箱点击确认链接后再登录', 'ok');
          switchAuthTab('login');
          $('loginEmail').value = email;
        } else {
          await enterApp(r.profile);
        }
      } catch (e) {
        showAuthMsg(e.message || '注册失败');
      }
      btn.disabled = false;
      btn.textContent = '注 册';
    });

    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.addEventListener('click', function () { switchView(b.getAttribute('data-view')); });
    });

    $('btnNew').addEventListener('click', openCreate);

    $('btnLogout').addEventListener('click', async function () {
      await Store.signOut();
      location.reload();
    });

    $('todoFilter').querySelectorAll('.seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        S.todoFilter = b.getAttribute('data-todo');
        $('todoFilter').querySelectorAll('.seg-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
        renderTodo();
      });
    });

    var searchTimer = null;
    $('adminSearch').addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { if (S.view === 'admin') renderAdmin(); }, 200);
    });

    $('btnBackup').addEventListener('click', backupAll);
    $('btnSaveProfile').addEventListener('click', saveProfile);

    document.addEventListener('click', function (e) {
      if (e.target.closest('#modalRoot')) return;
      var card = e.target.closest('[data-open]');
      if (card) { openDetail(card.getAttribute('data-open')); return; }
      var note = e.target.closest('[data-note]');
      if (note) {
        var p = note.getAttribute('data-note').split('|');
        openNoteModal(p[0], p[1]);
      }
    });

    document.addEventListener('change', function (e) {
      if (e.target.closest('#modalRoot')) return;
      var cb = e.target.closest('[data-check]');
      if (!cb) return;
      var p = cb.getAttribute('data-check').split('|');
      toggleTask(p[0], p[1], cb.checked);
    });
  }

  bindEvents();
  boot();

})();
