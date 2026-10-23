/* Контур 5.4 · CRON — расписания сценариев: локальный тикер (пока приложение открыто) + таблица script_jobs
   для серверного cron Supabase (push-уведомления даже с закрытым приложением, если подключено облако). */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {}, KEY = 'orbit-cron-v1';
  const C = () => O.core();
  const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  let list = [], lastFire = '';
  try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { list = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };
  const uid = () => 'cr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function nextRun(j) {
    if (j.kind === 'once') return j.at || 0;
    const now = new Date(), [h, m] = String(j.time || '08:00').split(':').map(Number);
    const d = new Date(now); d.setHours(h || 0, m || 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    if (j.kind === 'weekly' && (j.days || []).length) {
      for (let k = 0; k < 8; k++) { const di = (d.getDay() + 6) % 7; if ((j.days || []).includes(di)) break; d.setDate(d.getDate() + 1); }
    }
    return d.getTime();
  }
  function cronText(j) {
    if (j.kind === 'once') return 'один раз ' + new Date(j.at || Date.now()).toLocaleString('ru-RU');
    const days = j.kind === 'weekly' && (j.days || []).length ? ' ' + (j.days || []).map(i => DAYS[i]).join(',') : ' каждый день';
    return 'в ' + (j.time || '08:00') + days;
  }
  /* cron-выражение для серверного планировщика (упрощённо, только daily/weekly) */
  function toCron(j) {
    if (j.kind === 'once' || !j.time) return '';
    const [h, m] = String(j.time).split(':');
    if (j.kind === 'weekly' && (j.days || []).length) return `${+m} ${+h} * * ${(j.days || []).map(d => (d + 1) % 7).join(',')}`;
    return `${+m} ${+h} * * *`;
  }

  const Cr = O.cron = {
    list: () => list.slice(),
    get: id => list.find(j => j.id === id),
    add(spec) {
      const j = {
        id: uid(), name: spec.name || 'Задание', kind: spec.kind || 'daily', time: spec.time || '08:00',
        cmd: spec.cmd || 'что дальше', scriptId: spec.scriptId || '', enabled: true,
        pushTitle: spec.pushTitle || '', pushBody: spec.pushBody || '', cloud: !!spec.cloud
      };
      if (spec.kind === 'once') j.at = spec.date ? new Date(spec.date + 'T' + (spec.time || '08:00')).getTime() : Date.now() + 60000;
      if (spec.kind === 'weekly') j.days = spec.days || [0, 1, 2, 3, 4];
      j.nextRun = nextRun(j); j.cronText = cronText(j); j.cron = toCron(j);
      list.push(j); save();
      return j;
    },
    addForScript(sc, spec) {
      // из редактора сценариев: «поставить на расписание»
      const trig = sc.trigger || {};
      const base = { name: sc.name, cmd: 'запусти ' + sc.name, scriptId: sc.id };
      if (trig.kind === 'time' && trig.at) Object.assign(base, { kind: 'weekly', time: trig.at, days: trig.days || [0, 1, 2, 3, 4] });
      else Object.assign(base, spec || { kind: 'daily', time: '08:00' });
      return Cr.add(Object.assign({}, base, spec || {}));
    },
    toggle(id) { const j = Cr.get(id); if (j) { j.enabled = !j.enabled; j.nextRun = nextRun(j); save(); } return j; },
    del(id) {
      list = list.filter(j => j.id !== id); save();
      const cl = O.cloud;
      if (cl && cl.logged && cl.logged() && cl._api) cl._api('jobDel', c => c.from('script_jobs').delete().eq('uid', cl.user.id).eq('script_id', id)).catch(() => {});
    },
    syncToCloud() {
      // вызывается из cloud.js после логина: отдаём задания в script_jobs
      return list.filter(j => j.enabled);
    }
  };

  /* локальный тикер: срабатывает, пока приложение открыто (серверный cron добирает остальное) */
  setInterval(() => {
    const now = Date.now(), d = new Date(), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const key = d.toDateString() + hm;
    for (const j of list) {
      if (!j.enabled) continue;
      let due = false;
      if (j.kind === 'once') due = (j.at || 0) <= now && (j.at || 0) > now - 120000;
      else if (j.kind === 'weekly') due = j.time === hm && (j.days || []).includes((d.getDay() + 6) % 7);
      else due = j.time === hm;
      if (!due || lastFire === j.id + key) continue;
      lastFire = j.id + key;
      fire(j);
    }
  }, 20000);

  async function fire(j) {
    const A = O.assistant; if (!A) return;
    if (j.pushTitle && O.notify) O.notify.show(j.pushTitle, j.pushBody || j.name, 'cron' + j.id + Date.now());
    if (O.scripts && j.scriptId) { const sc = O.scripts.list().find(s => s.id === j.scriptId); if (sc) { O.scripts.run(sc); return; } }
    if (j.cmd) { try { await A.send(j.cmd); } catch (e) {} }
  }
})();
