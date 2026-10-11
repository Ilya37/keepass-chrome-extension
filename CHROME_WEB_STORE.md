# Chrome Web Store Submission Guide

## 🚀 Публикация в Chrome Web Store

### Этап 1: Подготовка файлов

1. **Собрать расширение:**
```bash
npm run build
```

2. **Архивировать для загрузки:**
```bash
cd .output/chrome-mv3
zip -r ../../keepass-extension.zip .
cd ../..
```

### Этап 2: Скриншоты

Chrome Web Store требует скриншоты **1280×800** (или 640×400), от 2 до 5 штук. Готовые файлы лежат в `store-assets/screenshots/` (все 1280×800 PNG, загружать по порядку):

| # | Файл | Что показано |
|---|------|--------------|
| 1 | `01-private-by-design.png` | Экран Unlock. Заголовок «Your passwords. Your device. Nothing else.» — локальность, .kdbx, no network, open source |
| 2 | `02-open-existing-kdbx.png` | Create Vault в режиме **Open Existing** с плашкой «Your file stays on this device» — ответ на страх «импорт = копия базы в интернете» |
| 3 | `03-all-passwords.png` | Список записей с поиском, фильтром по тегам |
| 4 | `04-autofill.png` | Макет окна браузера на github.com/login, popup с блоком «On this page: GitHub [Fill]» |
| 5 | `05-generator.png` | Генератор паролей со strength meter |

Снято с реального собранного расширения (`.output/chrome-mv3`) в Playwright-Chromium: демо-база «My Passwords» с 8 вымышленными записями (alex.morgan), пароли сгенерированы. Текст на кадрах описывает только реально существующие функции — экрана recovery codes в UI нет, поэтому отдельного скриншота под него нет.

> Google Chrome ≥ 137 игнорирует `--load-extension`, поэтому для пересъёмки нужен Chromium из Playwright (`npx playwright install chromium`), а не системный Chrome.

### Этап 3: Информация для Web Store

**Store Listing Informations:**

| Поле | Значение |
|------|----------|
| **Name** | KeePass Password Manager |
| **Short Description** | Secure KeePass-compatible password manager. All data encrypted locally—nothing leaves your browser. |
| **Detailed Description** | Смотри ниже |
| **Language** | English |
| **Category** | Productivity |
| **Pricing** | Free |
| **Official Website** | https://github.com/Ilya37/keepass-chrome-extension |
| **Support Email** | (опционально) |

**Полное описание для Web Store:**

```
🔐 KeePass Password Manager - All Your Passwords, Completely Private

Secure password management for Chrome with local encryption. Zero cloud, zero tracking.

FEATURES:
✓ Local encryption only - all passwords stay on your device
✓ KeePass compatible - open your existing .kdbx database (kept as an encrypted copy on your device only)
✓ One-click Fill - open the extension on a login page, matching entries appear on top
✓ Export anytime - download your database as a standard .kdbx file
✓ Search and tags - find any login instantly, group entries by tag
✓ Password generator - with live strength meter
✓ Auto-lock after 15 minutes idle, clipboard auto-clears after 15 seconds
✓ Redundant local storage - encrypted copy kept in both Chrome Storage and IndexedDB

SECURITY:
✓ Standard KeePass .kdbx encryption: AES-256 / ChaCha20, Argon2 or AES-KDF key derivation
✓ All data encrypted locally with KeePass format
✓ No plaintext passwords stored
✓ No remote backups or cloud sync
✓ No analytics or tracking
✓ Makes no network requests - verifiable in the open-source code

PRIVACY:
This extension is completely offline. Your passwords never leave your device.
- No servers accessed
- No data collection
- No advertising
- Open source code available on GitHub

WHAT HAPPENS TO YOUR .KDBX FILE:
When you open an existing KeePass file, the extension keeps an encrypted copy
of it in Chrome's extension storage on this computer. That copy is a standard
encrypted .kdbx file protected by the same master password - it cannot be read
without it. It is never uploaded, synced, or sent anywhere. Your original file is
not modified; use Export to save changes back to a .kdbx file.

USAGE:
1. Create a new KeePass database or open your existing .kdbx file
2. Enter your master password
3. On a login page, open the extension and click Fill
4. Use Export to save your changes back to a .kdbx file
5. Your encrypted database stays on this device, even after closing the browser

PRIVACY POLICY:
https://github.com/Ilya37/keepass-chrome-extension/blob/main/PRIVACY_POLICY.md

GITHUB:
https://github.com/Ilya37/keepass-chrome-extension
```

### Этап 4: Регистрация разработчика

1. Перейди на https://chrome.google.com/webstore/developer
2. Войди в Google аккаунт
3. Оплати регистрацию ($5)
4. Загрузи расширение

### Этап 5: Загрузка в Web Store

1. **Developer Dashboard** → New Item
2. **Upload ZIP file** → выбери `keepass-extension.zip`
3. **Заполни Store Listing:**
   - Name
   - Description
   - Language (English)
   - Category (Productivity)
   - Images (128px icon, скриншоты, промо-иконка)
   - Links (GitHub, Privacy Policy)

4. **Review Policies:**
   - ✅ Прочитай все требования
   - ✅ Убедись что нет инъекций или malware
   - ✅ Нет политических/оскорбительных материалов

5. **Privacy practices** — для каждой permission укажи обоснование (см. ниже)

6. **Submit for Review**

### Permission justifications (Privacy practices tab)

При заполнении вкладки Privacy practices Chrome Web Store запрашивает обоснование для некоторых разрешений. Используй следующий текст:

**activeTab**
> Used to access the active tab when the user clicks the extension icon, so we can detect the current page URL and show matching password entries. Access is granted only in response to an explicit user gesture (clicking the extension icon). Required for the Fill feature — user opens the extension on a login page, sees matching entries, and clicks Fill to autofill credentials.

**scripting**
> Used to inject a fill script into the current tab when the user clicks the "Fill" button in the popup. The script fills username and password fields in login forms. Execution happens only on explicit user action (Fill button click) and only targets the active tab that the user opened the extension on. No background injection — scripts run solely in response to user gestures.

### Примерный календарь

| День | Статус |
|------|--------|
| День 1 | Submission → "Pending Review" |
| День 2-7 | Google reviews extension |
| День 5-7 | ✅ Approved / ❌ Rejected |
| День 7+ | 🎉 Live in Chrome Web Store |

### Типичные причины отклонения

❌ **Не будет одобрено если:**
- Расширение делает что-то скрытое (spyware/malware)
- Инъекции кода на веб-сайты
- Требует непредусмотренные permissions
- Рекламные баннеры внутри
- Отправляет данные на внешние серверы
- Нарушает авторские права

✅ **Будет одобрено если:**
- Работает как описано в Store Listing
- Не требует excessive permissions (storage, alarms, activeTab, scripting + optional clipboardWrite)
- Обоснования для activeTab и scripting заполнены во вкладке Privacy practices
- Privacy Policy ясная и полная
- Код безопасен и открыт (GitHub)

### Обновление расширения

Когда выпустишь обновление:

1. Обнови версию в `package.json`
2. Собери: `npm run build`
3. В Developer Dashboard → "Upload new package"
4. Обновление появится в Web Store через день-два

---

## 🎨 Советы по скриншотам

### Размеры
- **1280×800** - рекомендуется
- **640×400** - мобильная версия

### Правила Chrome Web Store
- Максимум 5 скриншотов
- Минимум 2 скриншота
- PNG или JPG формат
- Максимум 5 МБ на скриншот

### Лучшие практики
1. Показать самые важные фичи первыми
2. Использовать текст поверх скриншотов
3. Скрыть sensitive информацию (реальные пароли)
4. Использовать яркие цвета и контраст
5. Тестировать на мобильных устройствах

---

## 🔍 Chrome Web Store Audit (последняя проверка)

| Категория | Статус | Примечания |
|-----------|--------|------------|
| Permissions | ✅ | storage, alarms, activeTab, scripting + optional clipboardWrite — все используются |
| Privacy & Data | ✅ | Нет внешних запросов (favicon убран), нет аналитики/трекинга |
| Content Security | ✅ | CSP в порядке, нет eval пользовательского контента |
| Manifest | ✅ | MV3, нет запрещённых полей |
| Code Quality | ✅ | Без обфускации, без запрещённых API |
| Store Listing | ⚠️ | Текст должен соответствовать реальной работе (autofill через popup → Fill) |

**Исправлено при аудите:** Запрос favicon к `google.com/s2/favicons` удалён — нарушал Privacy Policy («No network requests»). Теперь используется локальная SVG-иконка.

---

## ✅ Финальный чеклист перед публикацией

- [ ] Все иконки 16, 32, 48, 96, 128 созданы
- [ ] Расширение собирается без ошибок (`npm run build`)
- [ ] Нет console errors в background.ts
- [ ] Нет логирования sensitive данных
- [ ] Privacy Policy готова
- [ ] Скриншоты (2-5) готовы (1280×800)
- [ ] Store Listing заполнена полностью
- [ ] GitHub ссылка актуальна
- [ ] Версия обновлена в package.json
- [ ] ZIP архив готов
- [ ] Регистрация разработчика активна

---

## 📞 Поддержка

Если расширение отклонили:
1. Проверь email от Google (причина отклонения)
2. Исправь указанные проблемы
3. Повторно загрузи обновленный ZIP
4. Можно добавить примечание при повторной загрузке

Обычно при втором субмишене одобрение происходит быстрее (1-2 дня).
