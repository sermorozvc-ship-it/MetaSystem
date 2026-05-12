-- Скрипт для исправления флага questionnaire_completed
-- Устанавливает флаг в true для всех пользователей, у которых есть заполненная анкета

-- Обновляем флаг для всех пользователей с заполненной анкетой
UPDATE profiles
SET questionnaire_completed = true
WHERE id IN (
  SELECT user_id 
  FROM client_questionnaires
)
AND (questionnaire_completed IS NULL OR questionnaire_completed = false);

-- Проверяем результат
SELECT 
  p.id,
  p.email,
  p.questionnaire_completed,
  CASE WHEN q.id IS NOT NULL THEN 'Да' ELSE 'Нет' END as has_questionnaire
FROM profiles p
LEFT JOIN client_questionnaires q ON q.user_id = p.id
WHERE p.role = 'user'
ORDER BY p.created_at DESC;
