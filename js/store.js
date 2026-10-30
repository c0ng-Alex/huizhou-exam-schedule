/* 数据层：优先使用 Supabase（云端多人协作）；未配置时自动降级为本地演示模式 */
(function () {
  var CFG = window.APP_CONFIG || {};
  var CLOUD = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  var LS_KEY = 'hzks_demo_db_v1';
  var LS_SESSION = 'hzks_demo_session_v1';
  var sb = null;
  var profile = null;

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms || 80); });
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /* ==================== 本地演示库 ==================== */
  function seedDb() {
    var adminId = 'u-admin';
    var liId = 'u-li';
    var wangId = 'u-wang';

    var tasks = window.EXAM_TEMPLATES.gaokao.tasks.map(function (t, i) {
      return {
        id: 't' + (i + 1),
        phase: t.phase,
        title: t.title,
        desc: t.desc,
        offset: t.offset,
        isExamDay: !!t.isExamDay
      };
    });

    var demoDate = new Date();
    demoDate.setDate(demoDate.getDate() + 45);
    var examDate = demoDate.toISOString().slice(0, 10);

    return {
      profiles: [
        { id: adminId, email: 'admin@demo', full_name: '张主任', department: '考试中心', role: 'admin', enabled: true, created_at: nowIso() },
        { id: liId, email: 'li@demo', full_name: '李老师', department: '考务科', role: 'user', enabled: true, created_at: nowIso() },
        { id: wangId, email: 'wang@demo', full_name: '王老师', department: '综合科', role: 'user', enabled: true, created_at: nowIso() }
      ],
      passwords: { 'admin@demo': 'admin123', 'li@demo': '123456', 'wang@demo': '123456' },
      schedules: [
        {
          id: 's-demo-1',
          owner_id: adminId,
          owner_name: '张主任',
          title: '惠州市2026年普通高考',
          exam_type: 'gaokao',
          exam_date: examDate,
          exam_end_date: examDate,
          tasks: tasks,
          created_at: nowIso(),
          updated_at: nowIso()
        }
      ],
      shares: [
        { schedule_id: 's-demo-1', user_id: liId },
        { schedule_id: 's-demo-1', user_id: wangId }
      ],
      progress: [
        {
          schedule_id: 's-demo-1',
          user_id: adminId,
          done: { t1: true, t2: true, t3: true },
          notes: { t3: '已完成复核，共32人待补材料' },
          updated_at: nowIso()
        }
      ],
      templates: [
        {
          id: 'tp-1',
          title: '高考考前一周检查清单',
          exam_type: 'gaokao',
          tasks: [
            { phase: '临考阶段', title: '考场布置复核', offset: -3, desc: '逐考点拍照留档' },
            { phase: '临考阶段', title: '监考员到岗确认', offset: -1, desc: '确认每位监考员到位' },
            { phase: '临考阶段', title: '保密室双人值守检查', offset: -1, desc: '检查值守记录' }
          ],
          is_public: true,
          created_by: adminId,
          created_at: nowIso()
        }
      ],
      logs: [
        { id: 1, actor_id: adminId, actor_name: '张主任', action: '创建日程', target: '惠州市2026年普通高考', detail: '', created_at: nowIso() }
      ]
    };
  }

  function readDb() {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      var db = seedDb();
      localStorage.setItem(LS_KEY, JSON.stringify(db));
      return db;
    }
    try { return JSON.parse(raw); } catch (e) { return seedDb(); }
  }

  function writeDb(db) {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  }

  function localProfileRow(p) {
    return {
      id: p.id, email: p.email, full_name: p.full_name, department: p.department || '',
      phone: p.phone || '', role: p.role, enabled: p.enabled !== false, created_at: p.created_at
    };
  }

  /* ==================== Supabase 适配 ==================== */
  function loadSupabaseLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    // 本地包未加载时，退回到 CDN
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('无法加载 Supabase 组件，请检查网络')); };
      document.head.appendChild(s);
    });
  }

  function wrapError(err, fallback) {
    if (!err) return new Error(fallback);
    var msg = err.message || err.error_description || fallback;
    if (/Load failed|Failed to fetch|NetworkError|network error/i.test(msg)) {
      msg = '无法连接云端服务器（网络不通或被拦截），请换网络后重试';
    }
    if (/Invalid login credentials/i.test(msg)) msg = '邮箱或密码不正确';
    if (/User already registered/i.test(msg)) msg = '该邮箱已注册';
    if (/Email not confirmed/i.test(msg)) msg = '邮箱尚未确认，请先在邮箱中点击确认链接';
    return new Error(msg);
  }

  async function fetchProfile(userId) {
    var res = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (res.error) throw wrapError(res.error, '读取用户资料失败');
    if (res.data) return res.data;
    var ins = await sb.from('profiles').insert({ id: userId, email: CFG.__email || '', full_name: CFG.__name || '' }).select().single();
    if (ins.error) throw wrapError(ins.error, '创建用户资料失败');
    return ins.data;
  }

  /* ==================== 对外接口 ==================== */
  var Store = {
    mode: CLOUD ? 'cloud' : 'local',
    isCloud: CLOUD,
    get user() { return profile; },

    async init() {
      if (!CLOUD) {
        var row = localStorage.getItem(LS_SESSION);
        if (row) {
          var db = readDb();
          var p = db.profiles.filter(function (x) { return x.id === row; })[0];
          if (p && p.enabled !== false) profile = localProfileRow(p);
        }
        return profile;
      }
      await loadSupabaseLib();
      sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
      var s = await sb.auth.getSession();
      if (s.data && s.data.session) {
        var pr = await fetchProfile(s.data.session.user.id);
        if (pr.enabled === false) {
          await sb.auth.signOut();
          throw new Error('账号已被管理员停用，请联系管理员');
        }
        profile = pr;
      }
      return profile;
    },

    async signIn(email, password) {
      if (!CLOUD) {
        await delay();
        var db = readDb();
        if (db.passwords[email] !== password) throw new Error('邮箱或密码不正确');
        var p = db.profiles.filter(function (x) { return x.email === email; })[0];
        if (!p) throw new Error('账号不存在');
        if (p.enabled === false) throw new Error('账号已被管理员停用');
        localStorage.setItem(LS_SESSION, p.id);
        profile = localProfileRow(p);
        return profile;
      }
      var res = await sb.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw wrapError(res.error, '登录失败');
      var pr = await fetchProfile(res.data.user.id);
      if (pr.enabled === false) {
        await sb.auth.signOut();
        throw new Error('账号已被管理员停用，请联系管理员');
      }
      profile = pr;
      return pr;
    },

    async signUp(email, password, fullName, department, inviteCode) {
      if (CFG.INVITE_CODE && inviteCode !== CFG.INVITE_CODE) {
        throw new Error('邀请码不正确，请向管理员索取');
      }
      if (!CLOUD) {
        await delay();
        var db = readDb();
        if (db.profiles.some(function (x) { return x.email === email; })) throw new Error('该邮箱已注册');
        var isFirst = db.profiles.filter(function (x) { return x.role === 'admin'; }).length === 0;
        var np = {
          id: uid('u'), email: email, full_name: fullName || email.split('@')[0],
          department: department || '', role: isFirst ? 'admin' : 'user', enabled: true, created_at: nowIso()
        };
        db.profiles.push(np);
        db.passwords[email] = password;
        writeDb(db);
        localStorage.setItem(LS_SESSION, np.id);
        profile = localProfileRow(np);
        return { profile: profile, needsConfirm: false };
      }
      CFG.__email = email;
      CFG.__name = fullName;
      var res = await sb.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: fullName, department: department } }
      });
      if (res.error) throw wrapError(res.error, '注册失败');
      if (!res.data.session) {
        return { profile: null, needsConfirm: true };
      }
      var pr = await fetchProfile(res.data.user.id);
      profile = pr;
      return { profile: pr, needsConfirm: false };
    },

    async signOut() {
      profile = null;
      if (!CLOUD) { localStorage.removeItem(LS_SESSION); return; }
      await sb.auth.signOut();
    },

    async listProfiles() {
      if (!CLOUD) {
        await delay(40);
        return readDb().profiles.map(localProfileRow);
      }
      var res = await sb.from('profiles').select('*').order('created_at', { ascending: true });
      if (res.error) throw wrapError(res.error, '读取用户列表失败');
      return res.data;
    },

    async updateProfile(id, patch) {
      if (!CLOUD) {
        await delay(40);
        var db = readDb();
        var p = db.profiles.filter(function (x) { return x.id === id; })[0];
        if (p) Object.assign(p, patch);
        writeDb(db);
        return localProfileRow(p);
      }
      var res = await sb.from('profiles').update(patch).eq('id', id).select().single();
      if (res.error) throw wrapError(res.error, '保存用户资料失败');
      return res.data;
    },

    async listSchedules() {
      if (!CLOUD) {
        await delay(60);
        var db = readDb();
        var me = profile ? profile.id : null;
        var isAdmin = profile && profile.role === 'admin';
        var sharedIds = db.shares.filter(function (s) { return s.user_id === me; }).map(function (s) { return s.schedule_id; });
        return db.schedules.filter(function (s) {
          return isAdmin || s.owner_id === me || sharedIds.indexOf(s.id) >= 0;
        }).map(function (s) {
          return Object.assign({}, s, { _shared: sharedIds.indexOf(s.id) >= 0 });
        }).sort(function (a, b) { return a.exam_date < b.exam_date ? -1 : 1; });
      }
      var res = await sb.from('schedules').select('*, shares(user_id)').order('exam_date', { ascending: true });
      if (res.error) throw wrapError(res.error, '读取日程失败');
      var me2 = profile.id;
      return (res.data || []).map(function (s) {
        var sh = s.shares || [];
        var row = Object.assign({}, s);
        row._shared = sh.some(function (x) { return x.user_id === me2; });
        delete row.shares;
        return row;
      });
    },

    async createSchedule(data) {
      if (!CLOUD) {
        await delay(80);
        var db = readDb();
        var row = Object.assign({
          id: uid('s'), owner_id: profile.id, owner_name: profile.full_name,
          created_at: nowIso(), updated_at: nowIso()
        }, data);
        db.schedules.push(row);
        writeDb(db);
        return row;
      }
      var res = await sb.from('schedules').insert(Object.assign({
        owner_id: profile.id, owner_name: profile.full_name, updated_at: nowIso()
      }, data)).select().single();
      if (res.error) throw wrapError(res.error, '创建日程失败');
      return res.data;
    },

    async updateSchedule(id, patch) {
      if (!CLOUD) {
        await delay(60);
        var db = readDb();
        var row = db.schedules.filter(function (s) { return s.id === id; })[0];
        if (!row) throw new Error('日程不存在');
        Object.assign(row, patch, { updated_at: nowIso() });
        writeDb(db);
        return row;
      }
      var res = await sb.from('schedules').update(Object.assign({ updated_at: nowIso() }, patch)).eq('id', id).select().single();
      if (res.error) throw wrapError(res.error, '保存日程失败（只有创建者可以修改）');
      return res.data;
    },

    async deleteSchedule(id) {
      if (!CLOUD) {
        await delay(60);
        var db = readDb();
        db.schedules = db.schedules.filter(function (s) { return s.id !== id; });
        db.shares = db.shares.filter(function (s) { return s.schedule_id !== id; });
        db.progress = db.progress.filter(function (s) { return s.schedule_id !== id; });
        writeDb(db);
        return true;
      }
      var res = await sb.from('schedules').delete().eq('id', id);
      if (res.error) throw wrapError(res.error, '删除日程失败');
      return true;
    },

    async getShares(scheduleId) {
      if (!CLOUD) {
        await delay(40);
        return readDb().shares.filter(function (s) { return s.schedule_id === scheduleId; });
      }
      var res = await sb.from('shares').select('user_id').eq('schedule_id', scheduleId);
      if (res.error) throw wrapError(res.error, '读取共享成员失败');
      return res.data;
    },

    async setShares(scheduleId, userIds) {
      if (!CLOUD) {
        await delay(60);
        var db = readDb();
        db.shares = db.shares.filter(function (s) { return s.schedule_id !== scheduleId; });
        userIds.forEach(function (u) { db.shares.push({ schedule_id: scheduleId, user_id: u }); });
        writeDb(db);
        return true;
      }
      var del = await sb.from('shares').delete().eq('schedule_id', scheduleId);
      if (del.error) throw wrapError(del.error, '更新共享成员失败');
      if (userIds.length) {
        var ins = await sb.from('shares').insert(userIds.map(function (u) {
          return { schedule_id: scheduleId, user_id: u };
        }));
        if (ins.error) throw wrapError(ins.error, '更新共享成员失败');
      }
      return true;
    },

    async getProgress(scheduleId) {
      if (!CLOUD) {
        await delay(40);
        return readDb().progress.filter(function (p) { return p.schedule_id === scheduleId; });
      }
      var res = await sb.from('progress').select('*').eq('schedule_id', scheduleId);
      if (res.error) throw wrapError(res.error, '读取进度失败');
      return res.data;
    },

    async saveMyProgress(scheduleId, done, notes) {
      if (!CLOUD) {
        await delay(40);
        var db = readDb();
        var row = db.progress.filter(function (p) {
          return p.schedule_id === scheduleId && p.user_id === profile.id;
        })[0];
        if (!row) {
          row = { schedule_id: scheduleId, user_id: profile.id, done: {}, notes: {} };
          db.progress.push(row);
        }
        row.done = done;
        row.notes = notes;
        row.updated_at = nowIso();
        writeDb(db);
        return true;
      }
      var res = await sb.from('progress').upsert({
        schedule_id: scheduleId,
        user_id: profile.id,
        done: done,
        notes: notes,
        updated_at: nowIso()
      }, { onConflict: 'schedule_id,user_id' });
      if (res.error) throw wrapError(res.error, '保存进度失败');
      return true;
    },

    async listTemplates() {
      if (!CLOUD) {
        await delay(40);
        return readDb().templates.slice().reverse();
      }
      var res = await sb.from('templates').select('*').order('created_at', { ascending: false });
      if (res.error) throw wrapError(res.error, '读取模板失败');
      return res.data;
    },

    async createTemplate(data) {
      if (!CLOUD) {
        await delay(60);
        var db = readDb();
        var row = Object.assign({ id: uid('tp'), created_by: profile.id, created_at: nowIso(), is_public: true }, data);
        db.templates.push(row);
        writeDb(db);
        return row;
      }
      var res = await sb.from('templates').insert(Object.assign({ created_by: profile.id, is_public: true }, data)).select().single();
      if (res.error) throw wrapError(res.error, '发布模板失败（仅管理员可发布）');
      return res.data;
    },

    async deleteTemplate(id) {
      if (!CLOUD) {
        await delay(40);
        var db = readDb();
        db.templates = db.templates.filter(function (t) { return t.id !== id; });
        writeDb(db);
        return true;
      }
      var res = await sb.from('templates').delete().eq('id', id);
      if (res.error) throw wrapError(res.error, '删除模板失败');
      return true;
    },

    async listLogs() {
      if (!CLOUD) {
        await delay(40);
        return readDb().logs.slice().reverse();
      }
      var res = await sb.from('logs').select('*').order('created_at', { ascending: false }).limit(300);
      if (res.error) throw wrapError(res.error, '读取日志失败');
      return res.data;
    },

    async addLog(action, target, detail) {
      try {
        var payload = {
          actor_id: profile ? profile.id : null,
          actor_name: profile ? profile.full_name : '',
          action: action,
          target: target || '',
          detail: detail || ''
        };
        if (!CLOUD) {
          var db = readDb();
          payload.id = db.logs.length + 1;
          payload.created_at = nowIso();
          db.logs.push(payload);
          writeDb(db);
          return;
        }
        await sb.from('logs').insert(payload);
      } catch (e) { /* 日志失败不影响主流程 */ }
    },

    async exportAllData() {
      if (!CLOUD) {
        await delay(60);
        return readDb();
      }
      var out = {};
      var tables = ['profiles', 'schedules', 'shares', 'progress', 'templates', 'logs'];
      for (var i = 0; i < tables.length; i++) {
        var t = tables[i];
        var res = await sb.from(t).select('*');
        out[t] = res.data || [];
      }
      return out;
    }
  };

  window.Store = Store;
})();
