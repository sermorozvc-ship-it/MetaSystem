-- ============================================
-- ПРОВЕРКА И ИСПРАВЛЕНИЕ ПРОБЛЕМЫ С РЕДИРЕКТОМ
-- ============================================

-- 1. ПРОВЕРКА: Посмотреть текущее состояние
SELECT 
  p.id,
  p.email,
  p.role,
  p.questionnaire_completed as "Флаг анкеты",
  CASE WHEN q.id IS NOT NULL THEN 'ДА' ELSE 'НЕТ' END as "Анкета заполнена",
  pay.status as "Статус оплаты",
  pay.amount as "Сумма"
FROM profiles p
LEFT JOIN client_questionnaires q ON q.user_id = p.id
LEFT JOIN payments pay ON pay.user_id = p.id
WHERE p.role IN ('user', 'client')
ORDER BY p.created_at DESC;

-- 2. ИСПРАВЛЕНИЕ: Установить флаг для всех с заполненной анкетой
UPDATE profiles
SET questionnaire_completed = true
WHERE id IN (
  SELECT user_id 
  FROM client_questionnaires
)
AND (questionnaire_completed IS NULL OR questionnaire_completed = false);

-- 3. ПРОВЕРКА ПОСЛЕ ИСПРАВЛЕНИЯ
SELECT 
  p.email,
  p.questionnaire_completed,
  CASE WHEN q.id IS NOT NULL THEN 'ДА' ELSE 'НЕТ' END as "Анкета есть"
FROM profiles p
LEFT JOIN client_questionnaires q ON q.user_id = p.id
WHERE p.role IN ('user', 'client')
ORDER BY p.created_at DESC;

-- 4. ЕСЛИ НУЖНО ИСПРАВИТЬ ДЛЯ КОНКРЕТНОГО ПОЛЬЗОВАТЕЛЯ
-- Замените 'ваш@email.com' на реальный email
/*
UPDATE profiles
SET questionnaire_completed = true
WHERE email = 'ваш@email.com';
*/
