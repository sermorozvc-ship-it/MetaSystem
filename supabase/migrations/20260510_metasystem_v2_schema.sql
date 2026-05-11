-- ============================================
-- MetaSystem v2 — Database Schema Migration
-- Date: 2026-05-10
-- Description: Переход от когортной модели к индивидуальному ведению
-- ============================================

-- ============================================
-- 1.4 Обновление таблицы profiles
-- ============================================

-- Добавляем новые поля для индивидуального ведения
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client' 
    CHECK (role IN ('client', 'admin', 'trainer')),
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS telegram TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS questionnaire_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'active', 'paused', 'expired')),
  ADD COLUMN IF NOT EXISTS subscription_end_date DATE,
  ADD COLUMN IF NOT EXISTS has_nutrition_plan BOOLEAN DEFAULT false;

-- Создаем индексы для новых полей
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);

-- Комментарии к полям
COMMENT ON COLUMN profiles.role IS 'Роль пользователя: client, admin, trainer';
COMMENT ON COLUMN profiles.subscription_status IS 'Статус подписки: inactive, active, paused, expired';
COMMENT ON COLUMN profiles.has_nutrition_plan IS 'Включен ли план питания в тариф';

-- ============================================
-- 1.8 Обновление таблицы payments (тарифы)
-- ============================================

-- Добавляем поля для новой тарифной системы
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS plan_type TEXT
    CHECK (plan_type IN ('1_month', '3_months', '6_months')),
  ADD COLUMN IF NOT EXISTS plan_months INTEGER,
  ADD COLUMN IF NOT EXISTS includes_nutrition BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS nutrition_amount DECIMAL(10,2) DEFAULT 0;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_payments_plan_type ON payments(plan_type);

-- Комментарии
COMMENT ON COLUMN payments.plan_type IS 'Тип тарифа: 1_month (14900₽), 3_months (35900₽), 6_months (59900₽)';
COMMENT ON COLUMN payments.includes_nutrition IS 'Включен ли план питания (+3000₽ для 1 и 3 мес, бесплатно для 6 мес)';

-- ============================================
-- 1.5 Таблица анкет клиентов
-- ============================================

CREATE TABLE IF NOT EXISTS client_questionnaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Базовые данные
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female')),
  height_cm INTEGER,
  weight_kg DECIMAL(5,2),
  
  -- Цели и опыт
  goal TEXT,
  training_experience TEXT,
  preferred_training_days INTEGER CHECK (preferred_training_days BETWEEN 2 AND 7),
  available_equipment TEXT[],
  
  -- Ограничения
  injuries TEXT,
  health_conditions TEXT,
  
  -- Образ жизни
  sleep_hours_avg DECIMAL(3,1),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  activity_level TEXT,
  
  -- Начальные замеры
  waist_cm DECIMAL(5,1),
  hips_cm DECIMAL(5,1),
  chest_cm DECIMAL(5,1),
  arm_cm DECIMAL(5,1),
  thigh_cm DECIMAL(5,1),
  
  -- Фото (начальные)
  photo_front TEXT,
  photo_side TEXT,
  photo_back TEXT,
  
  -- Доп. информация
  additional_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_questionnaires_user_id ON client_questionnaires(user_id);

-- Комментарии
COMMENT ON TABLE client_questionnaires IS 'Анкеты клиентов — заполняются после оплаты';

-- ============================================
-- 1.6 Таблица тренировочных программ
-- ============================================

CREATE TABLE IF NOT EXISTS training_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  training_days_count INTEGER NOT NULL CHECK (training_days_count BETWEEN 2 AND 7),
  
  -- Markdown для экспорта/ИИ
  program_md TEXT NOT NULL,
  
  -- Структурированные данные для UI
  program_data JSONB NOT NULL,
  
  status TEXT DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  
  notes_trainer TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, week_number)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_training_programs_user_id ON training_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_training_programs_week ON training_programs(week_number);
CREATE INDEX IF NOT EXISTS idx_training_programs_status ON training_programs(status);
CREATE INDEX IF NOT EXISTS idx_training_programs_dates ON training_programs(start_date, end_date);

-- Комментарии
COMMENT ON TABLE training_programs IS 'Тренировочные программы клиентов по неделям';
COMMENT ON COLUMN training_programs.program_md IS 'Markdown-версия программы для экспорта и работы с ИИ';
COMMENT ON COLUMN training_programs.program_data IS 'JSON-структура программы для UI';

-- ============================================
-- 1.6 Таблица тренировочных записей клиента
-- ============================================

CREATE TABLE IF NOT EXISTS training_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  day_number INTEGER NOT NULL,
  
  -- Данные заполнения клиентом (веса, подходы, RPE, комментарии)
  entry_data JSONB NOT NULL DEFAULT '{}',
  
  -- Самочувствие
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  notes TEXT,
  
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(program_id, day_number)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_training_entries_program_id ON training_entries(program_id);
CREATE INDEX IF NOT EXISTS idx_training_entries_user_id ON training_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_training_entries_day ON training_entries(day_number);

-- Комментарии
COMMENT ON TABLE training_entries IS 'Заполненные тренировки клиентов';
COMMENT ON COLUMN training_entries.entry_data IS 'JSON с фактическими весами, подходами, RPE';

-- ============================================
-- 1.7 Таблица метрик клиента
-- ============================================

CREATE TABLE IF NOT EXISTS client_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Основные метрики
  weight_kg DECIMAL(5,2),
  body_fat_pct DECIMAL(4,1),
  
  -- Объемы
  waist_cm DECIMAL(5,1),
  hips_cm DECIMAL(5,1),
  chest_cm DECIMAL(5,1),
  arm_left_cm DECIMAL(5,1),
  arm_right_cm DECIMAL(5,1),
  thigh_left_cm DECIMAL(5,1),
  thigh_right_cm DECIMAL(5,1),
  
  -- Образ жизни
  sleep_hours DECIMAL(3,1),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  steps_avg INTEGER,
  water_liters DECIMAL(3,1),
  
  -- Фото прогресса
  photo_front TEXT,
  photo_side TEXT,
  photo_back TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, measured_at)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_client_metrics_user_id ON client_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_client_metrics_date ON client_metrics(measured_at);

-- Комментарии
COMMENT ON TABLE client_metrics IS 'Метрики и замеры клиентов для отслеживания прогресса';

-- ============================================
-- 1.9 RLS-политики для новых таблиц
-- ============================================

-- === client_questionnaires ===
ALTER TABLE client_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own questionnaire" ON client_questionnaires
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own questionnaire" ON client_questionnaires
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own questionnaire" ON client_questionnaires
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all questionnaires" ON client_questionnaires
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer')
    )
  );

-- === training_programs ===
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own programs" ON training_programs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all programs" ON training_programs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer')
    )
  );

-- === training_entries ===
ALTER TABLE training_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entries" ON training_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries" ON training_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries" ON training_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all entries" ON training_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer')
    )
  );

-- === client_metrics ===
ALTER TABLE client_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics" ON client_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metrics" ON client_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics" ON client_metrics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all metrics" ON client_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer')
    )
  );

-- ============================================
-- Триггеры для updated_at
-- ============================================

CREATE TRIGGER update_questionnaires_updated_at
  BEFORE UPDATE ON client_questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_programs_updated_at
  BEFORE UPDATE ON training_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_entries_updated_at
  BEFORE UPDATE ON training_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Функция для автоматического обновления статуса подписки
-- ============================================

CREATE OR REPLACE FUNCTION check_subscription_expiry()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET subscription_status = 'expired'
  WHERE subscription_status = 'active'
    AND subscription_end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Комментарий
COMMENT ON FUNCTION check_subscription_expiry IS 'Функция для проверки истечения подписок (запускать через cron)';

-- ============================================
-- Готово!
-- ============================================
