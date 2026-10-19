#!/usr/bin/env python3
"""Контур · запуск тестов в headless-Chromium.

    pip install playwright && playwright install chromium
    python3 tests/run.py            # все тесты
    python3 tests/run.py --filter "Ассистент"
    python3 tests/run.py --json out.json

Что делает:
  1. поднимает локальный сервер на корне проекта;
  2. гоняет tests/index.html (браузерный набор) и собирает результат;
  3. отдельно проверяет то, что из страницы не проверить: необработанные ошибки
     по всем фреймам, офлайн-запуск через сервис-воркер, docx-шаблон без школьной лексики.
Код возврата 0 — всё прошло, 1 — есть провалы.
"""
import argparse, asyncio, functools, http.server, json, os, re, socketserver, sys, threading, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LEX = re.compile(r'школ|урок|ученик|учител|\bкласс(?:а|у|ом|е)?\b|домашн|домашк|\bдз\b|перемен[аыуе]\b|каникул|кружок|кружк|дневник|родител|орбит|продл[её]нк|лице[йяю]|гимнази|рюкзак|школьн', re.I)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(port):
    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def docx_text(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8', 'ignore')
    return re.sub(r'<[^>]+>', ' ', xml)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--filter', default='')
    ap.add_argument('--json', default='')
    ap.add_argument('--port', type=int, default=8791)
    a = ap.parse_args()
    from playwright.async_api import async_playwright

    srv = serve(a.port)
    base = f'http://127.0.0.1:{a.port}/'
    extra = []   # (name, ok, detail)
    page_errors = []

    async with async_playwright() as p:
        b = await p.chromium.launch()

        # 1) основной набор (сервис-воркер блокируем: тесты не должны зависеть от кэша)
        ctx = await b.new_context(viewport={'width': 1000, 'height': 900}, service_workers='block')
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: page_errors.append(str(e)))
        url = base + 'tests/index.html?auto=1' + ('&filter=' + a.filter if a.filter else '')
        await pg.goto(url)
        try:
            await pg.wait_for_function('window.__RESULTS && window.__RESULTS.done', timeout=600000)
        except Exception:
            print('Тесты не завершились за 10 минут'); sys.exit(2)
        res = await pg.evaluate('window.__RESULTS.results')
        await ctx.close()

        # 2) офлайн: после установки сервис-воркера приложение открывается без сети
        if not a.filter:
            ctx = await b.new_context(viewport={'width': 390, 'height': 800})
            pg2 = await ctx.new_page()
            await pg2.add_init_script("localStorage.setItem('orbit-welcome-v4','1')")
            await pg2.goto(base + 'index.html')
            try:
                await pg2.evaluate('navigator.serviceWorker.ready.then(()=>1)')
                await pg2.wait_for_timeout(2500)   # дать дозаполнить кэш
                await ctx.set_offline(True)
                await pg2.reload()
                await pg2.wait_for_function('window.OrbitReady === true', timeout=8000)
                extra.append(('PWA', 'Офлайн: приложение запускается из кэша без сети', True, ''))
                for t in ['schedule', 'agent', 'calc', 'flow']:
                    await pg2.evaluate(f"OrbitCore.switchTab('{t}')")
                    await pg2.wait_for_timeout(600)
                fr = {t: pg2.frame_locator(f'#{t}-frame') for t in ['cifra', 'flow']}
                n_cifra = await fr['cifra'].locator('body *').count()
                n_flow = await fr['flow'].locator('body *').count()
                extra.append(('PWA', 'Офлайн: калькулятор и схемы открываются из кэша', n_cifra > 5 and n_flow > 5, f'cifra={n_cifra}, flow={n_flow}'))
            except Exception as e:
                extra.append(('PWA', 'Офлайн: приложение запускается из кэша без сети', False, str(e)[:300]))
            await ctx.close()
        await b.close()

    # 3) docx-шаблон
    if not a.filter:
        try:
            t = docx_text(os.path.join(ROOT, 'templates', 'orbit-import-template.docx'))
            m = LEX.search(t)
            extra.append(('Ребрендинг', 'Word-шаблон импорта без школьной лексики', not m, ('…' + t[max(0, m.start() - 30):m.end() + 30] + '…') if m else ''))
        except Exception as e:
            extra.append(('Ребрендинг', 'Word-шаблон импорта читается', False, str(e)))
        extra.append(('Запуск', 'Нет необработанных ошибок на странице тестов (все фреймы)', not page_errors, '; '.join(sorted(set(page_errors)))[:400]))

    for g, n, ok_, d in extra:
        res.append({'group': g, 'name': n, 'status': 'ok' if ok_ else 'fail', 'ms': 0, **({'error': d} if not ok_ else {})})

    fails = [r for r in res if r['status'] == 'fail']
    groups = {}
    for r in res:
        groups.setdefault(r['group'], []).append(r)
    for g, rs in groups.items():
        bad = [r for r in rs if r['status'] == 'fail']
        print(f"\n{'✗' if bad else '✓'} {g}: {len(rs) - len(bad)}/{len(rs)}")
        for r in bad:
            print(f"   ✗ {r['name']}\n       {r.get('error', '')}")
    print(f"\nИТОГО: пройдено {len(res) - len(fails)} из {len(res)}, провалено {len(fails)}")
    if a.json:
        with open(a.json, 'w', encoding='utf-8') as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
    srv.shutdown()
    sys.exit(1 if fails else 0)


asyncio.run(main())
