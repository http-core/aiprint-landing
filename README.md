# Лендинг «Фотобудка с нейросетью»

Одностраничный сайт из пяти сцен, связанных скроллом:
**вспышка → фотоплёнка со стилями → печать снимка → оборудование → заявка**.
Заявки уходят в Telegram-чат через серверную ручку `POST /api/lead`.

Стек: Astro 7 (статическая страница + одна серверная ручка через `@astrojs/node`), GSAP ScrollTrigger, TypeScript, zod.
Спецификация и решения: `openspec/changes/add-ai-photobooth-landing/`.

## Запуск

```bash
npm ci
npm run dev        # http://localhost:4321, заглушки подсвечены пунктиром
npm run build      # проверка типов + сборка в dist/
npm start          # node dist/server/entry.mjs
```

Требуется Node.js 22+.

## Переменные окружения

Скопируйте `.env.example` в `.env` (или задайте переменные в systemd/pm2/docker):

| Переменная | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен бота от @BotFather |
| `TELEGRAM_CHAT_ID` | id чата/группы, куда падают заявки (бот должен быть добавлен в чат) |
| `TRUST_PROXY` | `1` — брать IP из `X-Forwarded-For` (только за своим nginx) |
| `SITE_URL` | адрес сайта для canonical, например `https://example.ru` |
| `HOST`, `PORT` | адрес Node-сервера, по умолчанию `localhost:4321` |

Без `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` сайт работает, но форма честно сообщает
«приём заявок не настроен» и предлагает написать в Telegram — ложного «успеха» нет.

**Как узнать `TELEGRAM_CHAT_ID`:** добавьте бота в нужный чат, напишите в чат любое сообщение и
откройте `https://api.telegram.org/bot<TOKEN>/getUpdates` — значение `chat.id`.

## CI и Docker-образ

GitHub Actions (`.github/workflows/ci.yml`) на каждый PR и пуш:

1. проверка типов и unit-тесты;
2. e2e в Chrome, Safari (WebKit) и эмуляции iPhone;
3. сборка Docker-образа. Из `main` и тегов `v*` он публикуется в GitHub Container Registry:
   `ghcr.io/http-core/aiprint-landing` с тегами `latest`, `main`, `sha-xxxxxxx`, а для тега `v1.2.0` — ещё `1.2.0` и `1.2`.

Локально: `docker build -t aiprint-landing . && docker run -p 4321:4321 --env-file .env aiprint-landing`.

## Деплой на VPS (Docker + nginx)

Готовые файлы — в `deploy/`.

**Один раз на сервере:**

```bash
# 1. Docker (если ещё нет): https://docs.docker.com/engine/install/
# 2. Если репозиторий приватный — вход в GHCR токеном GitHub с правом read:packages
echo <TOKEN> | docker login ghcr.io -u <github-user> --password-stdin

# 3. Папка сайта
mkdir -p /opt/aiprint && cd /opt/aiprint
#    скопируйте сюда deploy/docker-compose.yml и создайте .env:
#    TELEGRAM_BOT_TOKEN=…
#    TELEGRAM_CHAT_ID=…
#    SITE_URL=https://example.ru

# 4. nginx: deploy/nginx.conf → /etc/nginx/sites-available/aiprint (замените example.ru)
ln -s /etc/nginx/sites-available/aiprint /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d example.ru -d www.example.ru   # HTTPS
```

**Запуск и обновление:**

```bash
cd /opt/aiprint
docker compose pull && docker compose up -d
docker compose logs -f web      # логи (в т.ч. ошибки доставки в Telegram)
```

Откат — указать в `docker-compose.yml` предыдущий тег (`sha-xxxxxxx` или `1.2.0`) и снова `up -d`.

Контейнер слушает только `127.0.0.1:4321`, наружу сайт отдаёт nginx (gzip, кэш `/_astro/`, HTTPS).
Лимит заявок (5 за 10 минут с IP) хранится в памяти контейнера — запускайте одну реплику.

## Как менять контент

Весь контент — в `src/data/`, разметку и анимации трогать не нужно.

| Что | Где |
|---|---|
| Тексты сцен, контакт Telegram, бот для результатов, политика ПДн | `src/data/site.ts` |
| Стили на плёнке (порядок, названия, картинки), 4 финальных варианта, выбранный | `src/data/styles.ts` |
| Модели будки: название, цена, описание, характеристики, фото | `src/data/models.ts` |
| Изображения | `src/assets/…` (путь указывается в данных) |

- **Портреты.** Положите файлы в `src/assets/styles/` (портрет 3:4, от 900×1200) и укажите пути
  в `styles.ts`. Первый стиль — это портрет со вспышки (он «падает» в первый кадр плёнки).
  Добавить или удалить стиль — добавить/удалить объект в массиве, анимация подстроится.
- **Фото будки.** Замените `src/assets/booth/booth-1.jpg` (или путь в `models.ts`).
  Сейчас это обрезанный рендер из `media/` в низком разрешении; лучше — PNG/JPG от 600 px по ширине на белом фоне.
- **Цена.** Добавьте `price: 1490000` модели — карточка покажет «1 490 000 ₽».
  Без `price` выводится «Стоимость по запросу».
- **Новая модель / комплектация.** Добавьте объект в `models.ts` — появятся стрелки,
  счётчик и свайп карусели.

### Заглушки

Неподтверждённые значения обёрнуты в `ph(…)`. В dev-режиме они обведены пунктиром,
а `npm run build` печатает их полный список. Когда значение подтверждено — уберите `ph()`:

```ts
{ label: 'Экран', value: ph('Сенсорный, 21,5″') }   // заглушка
{ label: 'Экран', value: 'Сенсорный, 21,5″' }       // подтверждено
```

Заглушки портретов перегенерируются командой `node scripts/generate-placeholders.mjs`
(она же кадрирует рендер будки) — после замены на реальные фото запускать её не нужно.

## Что нужно от заказчика

1. **Токен бота и id чата** для заявок. Реальная доставка в Telegram не проверялась:
   токена нет. Обработчик покрыт тестами с заглушкой Telegram API (успех, ошибка API,
   сетевая ошибка, отсутствие настроек). После настройки отправьте тестовую заявку с сайта.
2. **AI-портреты:** исходное фото и готовые стили (сейчас 8 сгенерированных заглушек).
3. **Характеристики, описание и цена «Будки 1.0»** — сейчас выдуманы и помечены как заглушки.
4. **Фото будки** лучшего качества.
5. **Текст политики обработки ПДн** и реквизиты оператора (`/privacy` — заглушка).
6. **Контакт для «написать напрямую»** — сейчас @AI66Robot (помечен как заглушка).
7. Цифры с оклейки («100+ стилей») на сайт не выводятся, пока не подтверждены.

## Тесты

```bash
npm test                      # unit: валидация, Telegram, rate-limit, /api/lead, данные
npx playwright install        # один раз — браузеры
npm run test:e2e              # e2e: Chrome, Firefox, WebKit, iPhone 13, Pixel 7
npm run test:safari18         # сценарий в WebKit 18 (≈ Safari 18); нужен запущенный npm start
```

Основные e2e идут на свежем WebKit, поэтому отдельно проверяется WebKit 18 — у реальных
пользователей Safari 18 встречается часто, и он ведёт себя иначе (см. `tests/compat/safari18.cjs`).

e2e проверяют порядок сцен, отсутствие горизонтального переполнения в каждой точке скролла,
отсутствие ошибок консоли и запросов разрешений, reduced-motion, вспышку (одна, ≤0.85),
детерминированность при повторной прокрутке, ресайз, axe (WCAG 2.1 AA), клавиатуру,
все состояния формы и работу без JavaScript.

## Структура

```
src/
  data/               контент и zod-схемы (ph() — заглушки)
  assets/             изображения (styles/, booth/)
  components/scenes/  HeroFlash · Filmstrip · PrintScene · Equipment · LeadForm
  components/ui/      Lens · Portrait · PrintCard · Button · Footer
  scripts/            motion.ts (GSAP, ветки desktop/mobile/reduced), scenes/*, carousel, lead-form
  lib/                валидация, Telegram, rate-limit, обработчик заявки, изображения, отчёт о заглушках
  pages/              index · privacy · api/lead
```
