# Запуск dev сервера

## Если сервер не запускается с ошибкой lock:

### Вариант 1: Автоматическая очистка (рекомендуется)
```bash
# Остановить все процессы Node.js и очистить .next
npm run clean
npm run dev
```

### Вариант 2: Вручную через PowerShell
```powershell
# 1. Остановить все процессы Node.js
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# 2. Удалить папку .next
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue

# 3. Запустить сервер
npm run dev
```

### Вариант 3: Через Task Manager
1. Откройте Task Manager (Ctrl+Shift+Esc)
2. Найдите все процессы "Node.js"
3. Завершите их (End Task)
4. Запустите `npm run dev`

## Нормальный запуск:
```bash
npm run dev
```

Сервер будет доступен на:
- Local: http://localhost:3001
- Network: http://192.168.1.3:3001

## Если порт 3001 занят:
```bash
# Запустить на другом порту
npm run dev -- -p 3002
```

## Полезные команды:
```bash
# Сборка для продакшена
npm run build

# Запуск продакшен версии
npm start

# Проверка типов
npm run type-check

# Линтинг
npm run lint
```
