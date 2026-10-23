# Дневник багов и правок · Контур / CIFRA / FlowForge

Краткий журнал: что ломалось → как лечили. Можно читать с конца (свежее сверху).

---

## 2026-10-23 · 5.8.39 — пропорции и переключатель режимов

**Симптом.** Sci съедал место, цифры уезжали в скролл; циферблат огромный; нет явной кнопки режима.  
**Причина.** `#calc .screen { flex:1 !important }` и `#pad { flex:0 1 auto }` из v5.2.5.  
**Лечение.** Screen fixed height; pad flex:1; sci max-height 28vh; mode-bar «Обычный | Математический».

---


## 2026-10-23 · 5.8.38 — режимы калькулятора и текст на кнопках

**Симптом.** После починки вкладок sci-панель (sin/cos/…) сжимала подписи; кнопки нечитаемы.  
**Причина.** Embed CSS `max-height:28%` + мелкий font без `white-space`/`ellipsis`.  
**Лечение.**
- Два режима: **Обычный** (`ƒx`, sci off) и **Математический** (`SCI`, sci on) — переключение по кнопке ƒx/SCI, toast.
- Sci-grid 4 колонки, `min-height:36px`, `clamp` шрифта, `text-overflow:ellipsis`.
- Основной pad: `clamp` шрифта, `white-space:nowrap`.

---

## 2026-10-23 · 5.8.37 — все вкладки CIFRA в одном окне

**Симптом.** Во вкладке «Калькулятор» одновременно видны Конвертер, Финансы, Даты, График, Доска, Учёт.  
**Причина.** `html.cifra-embed .view { display:flex !important }` перебивал `[hidden]`.  
**Лечение.** `.view[hidden] { display:none !important }`; карточка max-width 460px как standalone.

---

## 2026-10-23 · 5.8.36 — док в чате агента не закрывался

**Симптом.** ✕ на «Калькулятор в контейнере чата» не убирал панель.  
**Причина.** Только `dock.open=false` + конфликтующий `max-height:42vh`; iframe оставался.  
**Лечение.** `closeCalc()`: hidden + display:none + unload iframe; hit-area 44px; высота iframe `min(52vh,420px)`.

---

## 2026-10-23 · 5.8.35 — адаптация PC / планшет / телефон

**Симптом.** Пустоты и обрезка iframe calc/flow после tz-фиксов.  
**Причина.** Hardcoded `innerHeight - 120`.  
**Лечение.** `fitEmbedFrame()` по реальному header/nav; resize; FlowForge palette снизу на ≤480px.

---

## Ранее (из CHANGELOG 5.8.x)

- Diary overflow на 320–390 px  
- Viewport zoom iOS  
- FlowForge fit-zoom, TZ экспорта  
- Calc-guard (телефоны/даты не как выражения)

---

*Формат записи:* дата · версия — заголовок → симптом → причина → лечение.
