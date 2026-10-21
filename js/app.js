(() => {
  'use strict';

  const STORAGE_KEY = 'orbit-planner-v3';
  const BACKUP_KEY = 'orbit-planner-backup-v3';
  const APP_VERSION = '5.7.1';
  const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const SUBJECTS = [
    'Планёрка', 'Дейли', 'Стендап', 'Один на один', 'Ретро', 'Планирование', 'Демо', 'Код-ревью', 'Созвон с клиентом', 'Совещание',
    'Переговоры', 'Собеседование', 'Фокус-работа', 'Обучение', 'Документация', 'Релиз', 'Отчётность', 'Поддержка', 'Обед', 'Дорога'
  ];
  // TEMPORARY STUB - full restore in progress
  console.error('[Контур] app.js restore in progress - please wait');
  window.OrbitCore = { version: '5.7.1', state: {}, save() {}, render() {}, toast(m) { console.log(m); } };
})();
