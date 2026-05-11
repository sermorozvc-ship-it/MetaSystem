-- ============================================
-- MetaSystem v2 — Настройка тестовых данных
-- ============================================
-- Используйте этот скрипт ПОСЛЕ регистрации тестовых пользователей

-- ============================================
-- 1. Назначить роль админа
-- ============================================
-- Выполните ПОСЛЕ регистрации admin@metasystem.ru

UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@metasystem.ru';

-- Проверка:
SELECT id, email, role FROM profiles WHERE email = 'admin@metasystem.ru';

-- ============================================
-- 2. Активировать тестового клиента
-- ============================================
-- Выполните ПОСЛЕ регистрации test-client@example.com

-- Активировать подписку
UPDATE profiles 
SET 
  subscription_status = 'active',
  subscription_end_date = CURRENT_DATE + INTERVAL '30 days',
  has_nutrition_plan = true,
  questionnaire_completed = true
WHERE email = 'test-client@example.com';

-- Создать запись оплаты
INSERT INTO payments (user_id, amount, status, plan_type, plan_months, includes_nutrition, base_amount, nutrition_amount)
SELECT 
  id, 
  17900.00, 
  'completed', 
  '1_month', 
  1, 
  true,
  14900.00,
  3000.00
FROM profiles 
WHERE email = 'test-client@example.com'
ON CONFLICT DO NOTHING;

-- Создать анкету клиента
INSERT INTO client_questionnaires (
  user_id,
  age,
  gender,
  height_cm,
  weight_kg,
  goal,
  training_experience,
  preferred_training_days,
  available_equipment,
  sleep_hours_avg,
  stress_level,
  activity_level,
  waist_cm,
  hips_cm,
  chest_cm,
  arm_cm,
  thigh_cm
)
SELECT 
  id,
  28,
  'male',
  180,
  85.5,
  'Набор мышечной массы и улучшение композиции тела',
  'Средний (1-2 года)',
  4,
  ARRAY['Гантели', 'Штанга', 'Тренажеры'],
  7.5,
  5,
  'Умеренная активность',
  85.0,
  95.0,
  100.0,
  35.0,
  58.0
FROM profiles 
WHERE email = 'test-client@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- Создать уведомление о подтверждении оплаты
INSERT INTO notifications (user_id, type, title, message, link)
SELECT 
  id,
  'payment_confirmed',
  'Оплата подтверждена',
  'Ваша подписка активирована на 30 дней. Заполните анкету для начала работы.',
  '/questionnaire'
FROM profiles 
WHERE email = 'test-client@example.com';

-- Проверка:
SELECT 
  p.email,
  p.subscription_status,
  p.subscription_end_date,
  p.has_nutrition_plan,
  p.questionnaire_completed,
  pay.amount,
  pay.status,
  q.age,
  q.goal
FROM profiles p
LEFT JOIN payments pay ON pay.user_id = p.id
LEFT JOIN client_questionnaires q ON q.user_id = p.id
WHERE p.email = 'test-client@example.com';

-- ============================================
-- 3. Создать тестовую программу (опционально)
-- ============================================
-- Выполните ПОСЛЕ создания клиента

-- Примечание: Программу лучше загрузить через UI админ-панели,
-- используя файл docs/test_program_example.md

-- Если нужно создать через SQL:
/*
INSERT INTO training_programs (
  user_id,
  week_number,
  start_date,
  end_date,
  training_days_count,
  program_md,
  program_data,
  status
)
SELECT 
  id,
  1,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  4,
  '# Неделя 1 — Адаптация...',  -- Вставьте полный MD
  '{
    "weekNumber": 1,
    "startDate": "2026-05-11",
    "endDate": "2026-05-18",
    "days": []
  }'::jsonb,
  'active'
FROM profiles 
WHERE email = 'test-client@example.com'
ON CONFLICT (user_id, week_number) DO NOTHING;
*/

-- ============================================
-- 4. Создать тестовые метрики
-- ============================================

INSERT INTO client_metrics (
  user_id,
  measured_at,
  weight_kg,
  waist_cm,
  hips_cm,
  chest_cm,
  sleep_hours,
  stress_level,
  water_liters
)
SELECT 
  id,
  CURRENT_DATE - INTERVAL '7 days',
  86.0,
  85.5,
  95.5,
  100.5,
  7.0,
  6,
  2.5
FROM profiles 
WHERE email = 'test-client@example.com'
ON CONFLICT (user_id, measured_at) DO NOTHING;

INSERT INTO client_metrics (
  user_id,
  measured_at,
  weight_kg,
  waist_cm,
  hips_cm,
  chest_cm,
  sleep_hours,
  stress_level,
  water_liters
)
SELECT 
  id,
  CURRENT_DATE,
  85.5,
  85.0,
  95.0,
  100.0,
  7.5,
  5,
  3.0
FROM profiles 
WHERE email = 'test-client@example.com'
ON CONFLICT (user_id, measured_at) DO NOTHING;

-- Проверка метрик:
SELECT 
  measured_at,
  weight_kg,
  waist_cm,
  sleep_hours,
  stress_level
FROM client_metrics
WHERE user_id = (SELECT id FROM profiles WHERE email = 'test-client@example.com')
ORDER BY measured_at DESC;

-- ============================================
-- 5. Создать тестовое сообщение в чате
-- ============================================

-- Примечание: Таблица messages должна существовать из предыдущих миграций
-- Если таблицы нет, создайте её:

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- RLS для messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY IF NOT EXISTS "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Вставить тестовое сообщение от админа к клиенту
INSERT INTO messages (sender_id, receiver_id, content)
SELECT 
  (SELECT id FROM profiles WHERE email = 'admin@metasystem.ru'),
  (SELECT id FROM profiles WHERE email = 'test-client@example.com'),
  'Привет! Добро пожаловать в MetaSystem. Я загрузил для тебя первую программу. Начинай тренироваться и заполняй данные после каждой тренировки. Если будут вопросы — пиши!'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'admin@metasystem.ru')
  AND EXISTS (SELECT 1 FROM profiles WHERE email = 'test-client@example.com');

-- Проверка сообщений:
SELECT 
  m.content,
  m.created_at,
  sender.email as sender_email,
  receiver.email as receiver_email
FROM messages m
JOIN profiles sender ON sender.id = m.sender_id
JOIN profiles receiver ON receiver.id = m.receiver_id
ORDER BY m.created_at DESC
LIMIT 5;

-- ============================================
-- 6. Итоговая проверка всех данных
-- ============================================

-- Проверка пользователей
SELECT 
  email,
  role,
  subscription_status,
  subscription_end_date,
  has_nutrition_plan,
  questionnaire_completed,
  created_at
FROM profiles
WHERE email IN ('admin@metasystem.ru', 'test-client@example.com')
ORDER BY email;

-- Проверка платежей
SELECT 
  p.email,
  pay.amount,
  pay.status,
  pay.plan_type,
  pay.includes_nutrition,
  pay.created_at
FROM payments pay
JOIN profiles p ON p.id = pay.user_id
WHERE p.email = 'test-client@example.com'
ORDER BY pay.created_at DESC;

-- Проверка анкет
SELECT 
  p.email,
  q.age,
  q.gender,
  q.height_cm,
  q.weight_kg,
  q.goal,
  q.preferred_training_days
FROM client_questionnaires q
JOIN profiles p ON p.id = q.user_id
WHERE p.email = 'test-client@example.com';

-- Проверка программ
SELECT 
  p.email,
  tp.week_number,
  tp.start_date,
  tp.end_date,
  tp.training_days_count,
  tp.status
FROM training_programs tp
JOIN profiles p ON p.id = tp.user_id
WHERE p.email = 'test-client@example.com'
ORDER BY tp.week_number;

-- Проверка метрик
SELECT 
  p.email,
  COUNT(cm.id) as metrics_count,
  MIN(cm.measured_at) as first_measurement,
  MAX(cm.measured_at) as last_measurement
FROM client_metrics cm
JOIN profiles p ON p.id = cm.user_id
WHERE p.email = 'test-client@example.com'
GROUP BY p.email;

-- Проверка уведомлений
SELECT 
  p.email,
  n.type,
  n.title,
  n.read,
  n.created_at
FROM notifications n
JOIN profiles p ON p.id = n.user_id
WHERE p.email = 'test-client@example.com'
ORDER BY n.created_at DESC;

-- ============================================
-- Готово! ✅
-- ============================================

-- Теперь можно:
-- 1. Войти как admin@metasystem.ru / AdminPass123!
-- 2. Войти как test-client@example.com / TestClient123!
-- 3. Загрузить программу через UI (docs/test_program_example.md)
-- 4. Протестировать все функции

