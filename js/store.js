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
    var msg = err.message || err.error_description || err.hint || fallback;
    if (typeof msg === 'object') msg = JSON.stringify(msg);
    if (/Load failed|Failed to fetch|NetworkError|network error/i.test(msg)) {
      msg = '无法连接云端服务器（网络不通或被拦截），请换网络后重试';
    }
    if (/Invalid login credentials/i.test(msg)) msg = '邮箱或密码不正确';
    if (/User already registered/i.test(msg)) msg = '该邮箱已注册';
    if (/Email not confirmed/i.test(msg)) msg = '邮箱尚未确认，请先在邮箱中点击确认链接';
    if (/row-level security policy/i.test(msg)) msg = '保存失败（权限限制），请刷新后重试';
    if (/duplicate key|already exists/i.test(msg)) msg = '记录已存在';
    return new Error(msg);
  }

  // 用原生 fetch 调 PostgREST，绕开 Supabase SDK 某些版本的奇怪行为
  async function rest(method, path, body, query) {
    var session = sb && sb.auth ? await sb.auth.getSession() : null;
    var token = (session && session.data && session.data.session && session.data.session.access_token) || '';
    if (!token) {
      // 从 localStorage 直接读兜底
      try {
        var raw = localStorage.getItem('sb-' + (CFG.SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0] + '-auth-token');
        if (raw) token = JSON.parse(raw).access_token || '';
      } catch (e) { token = ''; }
    }
    var url = CFG.SUPABASE_URL + '/rest/v1/' + path + (query ? '?' + query : '');
    // 只有需要返回结果（带 select=）时才要求 representation，
    // 否则 RETURNING 会触发 SELECT 策略校验，非管理员写日志等场景会被误判为 RLS 失败
    var prefer = (query && query.indexOf('select=') >= 0) ? 'return=representation' : 'return=minimal';
    // on_conflict 表示 upsert，必须显式要求冲突时合并，否则第二次勾选会报 409 duplicate key
    if (method === 'POST' && query && query.indexOf('on_conflict=') >= 0) {
      prefer += ',resolution=merge-duplicates';
    }
    var opts = {
      method: method,
      headers: {
        apikey: CFG.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Prefer: prefer
      }
    };
    if (body !== undefined && body !== null) opts.body = JSON.stringify(body);
    try {
      var res = await fetch(url, opts);
      var text = await res.text();
      var data = text ? JSON.parse(text) : null;
      if (!res.ok) {
        var err = (data && (data.message || data.error_description || data.details)) || res.statusText;
        var e = new Error(err);
        e.status = res.status;
        e.data = data;
        throw e;
      }
      return data;
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error('服务器返回格式异常');
      throw e;
    }
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
      var payload = Object.assign({ owner_id: profile.id, owner_name: profile.full_name, updated_at: nowIso() }, data);
      try {
        var rows = await rest('POST', 'schedules', payload, 'select=*');
        return Array.isArray(rows) ? rows[0] : rows;
      } catch (e) { throw wrapError(e, '创建日程失败'); }
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
      try {
        var rows = await rest('PATCH', 'schedules?id=eq.' + encodeURIComponent(id), Object.assign({ updated_at: nowIso() }, patch), 'select=*');
        return Array.isArray(rows) ? rows[0] : rows;
      } catch (e) { throw wrapError(e, '保存日程失败（只有创建者可以修改）'); }
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
      try { await rest('DELETE', 'schedules?id=eq.' + encodeURIComponent(id)); return true; }
      catch (e) { throw wrapError(e, '删除日程失败'); }
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
      try {
        await rest('DELETE', 'shares?schedule_id=eq.' + encodeURIComponent(scheduleId));
        if (userIds.length) {
          await rest('POST', 'shares', userIds.map(function (u) {
            return { schedule_id: scheduleId, user_id: u };
          }));
        }
        return true;
      } catch (e) { throw wrapError(e, '更新共享成员失败'); }
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
      try {
        await rest('POST', 'progress', {
          schedule_id: scheduleId,
          user_id: profile.id,
          done: done,
          notes: notes,
          updated_at: nowIso()
        }, 'on_conflict=schedule_id,user_id');
        return true;
      } catch (e) { throw wrapError(e, '保存进度失败'); }
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
      try {
        var rows = await rest('POST', 'templates', Object.assign({ created_by: profile.id, is_public: true }, data), 'select=*');
        return Array.isArray(rows) ? rows[0] : rows;
      } catch (e) { throw wrapError(e, '发布模板失败（仅管理员可发布）'); }
    },

    async deleteTemplate(id) {
      if (!CLOUD) {
        await delay(40);
        var db = readDb();
        db.templates = db.templates.filter(function (t) { return t.id !== id; });
        writeDb(db);
        return true;
      }
      try { await rest('DELETE', 'templates?id=eq.' + encodeURIComponent(id)); return true; }
      catch (e) { throw wrapError(e, '删除模板失败'); }
    },

    async listLogs() {
      if (!CLOUD) {
        await delay(40);
        return readDb().logs.slice().reverse();
      }
      try { return await rest('GET', 'logs?select=*&order=created_at.desc&limit=300'); }
      catch (e) { throw wrapError(e, '读取日志失败'); }
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
        await rest('POST', 'logs', payload);
      } catch (e) { /* 日志失败不影响主流程 */ }
    },

    /* ============ 新增：密码管理 ============ */

    async changePassword(newPassword) {
      if (!newPassword || newPassword.length < 6) throw new Error('密码至少 6 位');
      if (!CLOUD) {
        var db = readDb();
        db.passwords[profile.email] = newPassword;
        writeDb(db);
        return true;
      }
      var res = await sb.auth.updateUser({ password: newPassword });
      if (res.error) throw wrapError(res.error, '修改密码失败');
      return true;
    },

    async adminResetPassword(userId) {
      if (!CLOUD) throw new Error('本地模式不支持重置密码');
      // 管理员通过 Supabase auth API 发密码重置邮件
      var p = await this.listProfiles();
      var target = p.filter(function (x) { return x.id === userId; })[0];
      if (!target) throw new Error('用户不存在');
      var res = await sb.auth.resetPasswordForEmail(target.email, {
        redirectTo: window.location.origin + window.location.pathname + '?reset=1'
      });
      if (res.error) throw wrapError(res.error, '发送重置邮件失败（请确认对方邮箱能收信）');
      return target.email;
    },

    async adminDeleteUser(userId) {
      if (!CLOUD) throw new Error('本地模式不支持删除用户');
      if (userId === profile.id) throw new Error('不能删除当前登录账号');
      // 先停用再删，auth.users 层面删除需后端服务，这里先标记停用+清空资料
      await this.updateProfile(userId, { enabled: false });
      try {
        // 尝试调用 SECURITY DEFINER 函数彻底删除 auth.users
        await rest('POST', 'rpc/admin_delete_user', { user_id: userId });
      } catch (e) { /* 函数不存在时忽略，只停用 */ }
      return true;
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
