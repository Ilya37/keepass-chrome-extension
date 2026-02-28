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

### Этап 2: Создание скриншотов

Chrome Web Store требует скриншоты размерами **1280×800** или **640×400**. Нужно 2-5 скриншотов:

**Скриншот 1: Разблокировка БД**
- Показать popup с полем пароля
- Кнопку "Unlock Database"
- Текст: "Enter your master password"

**Скриншот 2: Список паролей**
- Popup с списком сохранённых паролей
- Иконки категорий (e.g., 🌐 Websites, 📧 Email)
- Поле поиска

**Скриншот 3: Автозаполнение**
- Показать браузер с формой login
- Popup подсказывает пароль для сайта
- "Auto-fill enabled" текст

**Скриншот 4: Безопасность**
- Текст: "All data stored locally. No cloud. No tracking."
- Иконки: 🔐 Encrypted, 💾 Local Storage, 🔄 Auto-backup

**Скриншот 5: Восстановление**
- Recovery codes на экране
- Текст: "20 one-time recovery codes for account recovery"

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
✓ KeePass compatible - import existing .kdbx databases
✓ Auto-fill passwords - seamless browsing experience
✓ Dual storage backup - Chrome Storage + IndexedDB
✓ Auto-unlock - encrypted tokens for fast access
✓ Automatic snapshots - hourly backups + edit threshold
✓ Recovery codes - 20 one-time codes for account recovery
✓ Version history - restore from previous versions
✓ Operation journal - full audit trail for forensics

SECURITY:
✓ PBKDF2 password hashing with SHA-256
✓ All data encrypted locally with KeePass format
✓ No plaintext passwords stored
✓ No remote backups or cloud sync
✓ No analytics or tracking
✓ No permissions for external communication

PRIVACY:
This extension is completely offline. Your passwords never leave your device.
- No servers accessed
- No data collection
- No advertising
- Open source code available on GitHub

USAGE:
1. Create or import a KeePass database
2. Set your master password
3. Save your recovery codes (important!)
4. Passwords auto-fill on compatible websites
5. All data persists even after closing the browser

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
