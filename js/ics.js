/* ICS 日历文件生成：可导入 iPhone 日历 / 安卓 Google 日历 / 华为日历 / Outlook */
(function () {
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function icsDate(str) {
    var p = String(str).split('-');
    return p[0] + pad(+p[1]) + pad(+p[2]);
  }

  function icsStamp() {
    var d = new Date();
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
      'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }

  function addDay(str, n) {
    var d = new Date(str + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function esc(text) {
    return String(text || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  function fold(line) {
    var out = [];
    var s = line;
    while (s.length > 74) {
      out.push(s.slice(0, 74));
      s = ' ' + s.slice(74);
    }
    out.push(s);
    return out.join('\r\n');
  }

  function buildEvent(opt) {
    var lines = [
      'BEGIN:VEVENT',
      'UID:' + opt.uid,
      'DTSTAMP:' + icsStamp(),
      'DTSTART;VALUE=DATE:' + icsDate(opt.date),
      'DTEND;VALUE=DATE:' + icsDate(addDay(opt.date, 1)),
      fold('SUMMARY:' + esc(opt.summary)),
      fold('DESCRIPTION:' + esc(opt.description)),
      fold('LOCATION:' + esc(opt.location || '')),
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'TRIGGER:' + (opt.alarm || '-P1D'),
      'ACTION:DISPLAY',
      fold('DESCRIPTION:' + esc(opt.summary)),
      'END:VALARM',
      'END:VEVENT'
    ];
    return lines.join('\r\n');
  }

  function build(schedule) {
    var tasks = schedule.tasks || [];
    var head = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Huizhou Exam Center//Work Schedule//CN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      fold('X-WR-CALNAME:' + esc(schedule.title)),
      'X-WR-TIMEZONE:Asia/Shanghai'
    ];

    var body = tasks.map(function (t) {
      var date = t.date || addDay(schedule.exam_date, t.offset || 0);
      return buildEvent({
        uid: schedule.id + '-' + t.id + '@huizhou-exam',
        date: date,
        summary: '【' + schedule.title + '】' + t.title,
        description: '考试：' + schedule.title + '\n阶段：' + (t.phase || '') +
          '\n说明：' + (t.desc || t.description || '') +
          '\n距考试：' + (t.offset || 0) + ' 天',
        alarm: t.isExamDay ? '-P2D' : '-P1D'
      });
    });

    return head.concat(body).concat(['END:VCALENDAR']).join('\r\n');
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.replace(/[\\/:*?"<>|]/g, '_') + '.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }

  window.ICS = {
    build: build,
    download: function (schedule) {
      download(schedule.title + '_工作日程', build(schedule));
    },
    downloadOne: function (schedule, task) {
      var date = task.date || addDay(schedule.exam_date, task.offset || 0);
      var single = {
        id: schedule.id,
        title: schedule.title,
        exam_date: schedule.exam_date,
        tasks: [task]
      };
      download(schedule.title + '_' + task.title, build(single));
    }
  };
})();
