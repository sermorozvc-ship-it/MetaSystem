-- ============================================
-- MetaSystem — ПОЛНЫЙ СКРИПТ ВОССТАНОВЛЕНИЯ БД
-- Дата: 2026-07-05
-- Описание: Восстанавливает все таблицы, функции и RLS-политики.
--           Идемпотентен: можно запускать повторно без ошибок.
--
-- ИНСТРУКЦИЯ:
-- 1. Откройте Supabase Dashboard → SQL Editor
-- 2. Вставьте содержимое этого файла
-- 3. Нажмите "Run"
-- ============================================

-- ============================================
-- 0. РАСШИРЕНИЯ
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ФУНКЦИИ-ПОМОЩНИКИ
-- ============================================

-- Автообновление updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. ТАБЛИЦА profiles (существует, добавляем недостающие поля)
-- ============================================

-- Базовые поля из 001_initial_schema (id, email, full_name, created_at, updated_at уже есть)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cohort_start_date DATE DEFAULT (DATE_TRUNC('week', CURRENT_DATE + INTERVAL '1 day')::DATE),
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS waist_cm INTEGER,
  ADD COLUMN IF NOT EXISTS hips_cm INTEGER,
  ADD COLUMN IF NOT EXISTS visceral_risk TEXT CHECK (visceral_risk IN ('low', 'moderate', 'high')),
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

-- Поля из v2 (20260510)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client' CHECK (role IN ('client', 'admin', 'trainer', 'curator')),
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS telegram TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS questionnaire_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'paused', 'expired')),
  ADD COLUMN IF NOT EXISTS subscription_start_date DATE,
  ADD COLUMN IF NOT EXISTS subscription_end_date DATE,
  ADD COLUMN IF NOT EXISTS has_nutrition_plan BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_reason TEXT,
  ADD COLUMN IF NOT EXISTS training_brain_client_id TEXT;

-- Поля из subscription_renewals (20260513)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS nutrition_questionnaire_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_pending BOOLEAN DEFAULT false;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Триггер updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- 3. ТРИГГЕР: автосоздание профиля при регистрации
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, cohort_start_date)
  VALUES (
    NEW.id,
    NEW.email,
    (DATE_TRUNC('week', CURRENT_DATE + INTERVAL '1 day')::DATE)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 4. ТАБЛИЦА daily_content
-- ============================================

CREATE TABLE IF NOT EXISTS daily_content (
  id SERIAL PRIMARY KEY,
  day_number INTEGER NOT NULL UNIQUE CHECK (day_number BETWEEN 1 AND 7),
  title_ru TEXT NOT NULL,
  subtitle_ru TEXT NOT NULL,
  context_ru TEXT NOT NULL,
  tasks JSONB NOT NULL DEFAULT '[]',
  has_workout BOOLEAN DEFAULT false,
  has_video BOOLEAN DEFAULT false,
  has_audio BOOLEAN DEFAULT false,
  has_tool TEXT CHECK (has_tool IN ('visceral_calculator', 'body_measurements', NULL)),
  video_url TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE daily_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view daily content" ON daily_content;
CREATE POLICY "Anyone can view daily content" ON daily_content
  FOR SELECT USING (true);

-- ============================================
-- 5. ТАБЛИЦА user_progress
-- ============================================

CREATE TABLE IF NOT EXISTS user_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, day_number, task_id)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_day ON user_progress(day_number);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own progress" ON user_progress;
CREATE POLICY "Users can view own progress" ON user_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
CREATE POLICY "Users can insert own progress" ON user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
CREATE POLICY "Users can update own progress" ON user_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 6. ТАБЛИЦА body_measurements
-- ============================================

CREATE TABLE IF NOT EXISTS body_measurements (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  height_cm INTEGER,
  waist_cm INTEGER,
  hips_cm INTEGER,
  weight_kg DECIMAL(5,2),
  whr DECIMAL(4,2),
  whtr DECIMAL(4,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_body_measurements_user_id ON body_measurements(user_id);
CREATE INDEX IF NOT EXISTS idx_body_measurements_date ON body_measurements(measurement_date);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own measurements" ON body_measurements;
CREATE POLICY "Users can view own measurements" ON body_measurements
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own measurements" ON body_measurements;
CREATE POLICY "Users can insert own measurements" ON body_measurements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 7. ТАБЛИЦА day_reports
-- ============================================

CREATE TABLE IF NOT EXISTS day_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  comment TEXT,
  files JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  curator_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_day_reports_user_id ON day_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_day_reports_status ON day_reports(status);

ALTER TABLE day_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own day_reports" ON day_reports;
CREATE POLICY "Users can view own day_reports" ON day_reports
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own day_reports" ON day_reports;
CREATE POLICY "Users can insert own day_reports" ON day_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own day_reports" ON day_reports;
CREATE POLICY "Users can update own day_reports" ON day_reports
  FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_day_reports_updated_at ON day_reports;
CREATE TRIGGER update_day_reports_updated_at
  BEFORE UPDATE ON day_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. ТАБЛИЦА journal_entries
-- ============================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood INTEGER DEFAULT 3,
  energy INTEGER DEFAULT 3,
  sleep_hours DECIMAL(4,2) DEFAULT 0,
  water_liters DECIMAL(4,2) DEFAULT 0,
  workout_done BOOLEAN DEFAULT false,
  nutrition_notes TEXT,
  reflection TEXT,
  photo_front TEXT,
  photo_side TEXT,
  photo_back TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own journal" ON journal_entries;
CREATE POLICY "Users can view own journal" ON journal_entries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own journal" ON journal_entries;
CREATE POLICY "Users can insert own journal" ON journal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own journal" ON journal_entries;
CREATE POLICY "Users can update own journal" ON journal_entries
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own journal" ON journal_entries;
CREATE POLICY "Users can delete own journal" ON journal_entries
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 9. ТАБЛИЦА admin_messages
-- ============================================

CREATE TABLE IF NOT EXISTS admin_messages (
  id BIGSERIAL PRIMARY KEY,
  from_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  message_type TEXT DEFAULT 'message' CHECK (message_type IN ('message', 'warning', 'announcement')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their messages" ON admin_messages;
CREATE POLICY "Users can view their messages" ON admin_messages
  FOR SELECT USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Users can insert messages" ON admin_messages;
CREATE POLICY "Users can insert messages" ON admin_messages
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- ============================================
-- 10. ТАБЛИЦА payments
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  currency TEXT DEFAULT 'RUB',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'refunded')),
  payment_method TEXT DEFAULT 'manual' CHECK (payment_method IN ('manual', 'stripe', 'yookassa', 'yoomoney', 'prodamus')),
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  cohort_start DATE,
  plan_type TEXT CHECK (plan_type IN ('1_month', '3_months', '6_months')),
  plan_months INTEGER,
  includes_nutrition BOOLEAN DEFAULT false,
  base_amount DECIMAL(10,2),
  nutrition_amount DECIMAL(10,2) DEFAULT 0,
  renewal_type TEXT CHECK (renewal_type IN ('initial', 'renewal', 'nutrition_upgrade')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_plan_type ON payments(plan_type);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create payment requests" ON payments;
CREATE POLICY "Users can create payment requests" ON payments
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Admins can manage all payments" ON payments;
CREATE POLICY "Admins can manage all payments" ON payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer')
    )
  );

DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. ТАБЛИЦА client_questionnaires
-- ============================================

CREATE TABLE IF NOT EXISTS client_questionnaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female')),
  height_cm INTEGER,
  weight_kg DECIMAL(5,2),
  goal TEXT,
  training_experience TEXT,
  preferred_training_days INTEGER CHECK (preferred_training_days BETWEEN 2 AND 7),
  available_equipment TEXT[],
  injuries TEXT,
  health_conditions TEXT,
  sleep_hours_avg DECIMAL(3,1),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  activity_level TEXT,
  waist_cm DECIMAL(5,1),
  hips_cm DECIMAL(5,1),
  chest_cm DECIMAL(5,1),
  arm_cm DECIMAL(5,1),
  thigh_cm DECIMAL(5,1),
  photo_front TEXT,
  photo_side TEXT,
  photo_back TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questionnaires_user_id ON client_questionnaires(user_id);

ALTER TABLE client_questionnaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own questionnaire" ON client_questionnaires;
CREATE POLICY "Users can view own questionnaire" ON client_questionnaires
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own questionnaire" ON client_questionnaires;
CREATE POLICY "Users can insert own questionnaire" ON client_questionnaires
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own questionnaire" ON client_questionnaires;
CREATE POLICY "Users can update own questionnaire" ON client_questionnaires
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all questionnaires" ON client_questionnaires;
CREATE POLICY "Admins can view all questionnaires" ON client_questionnaires
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer', 'curator')
    )
  );

DROP TRIGGER IF EXISTS update_questionnaires_updated_at ON client_questionnaires;
CREATE TRIGGER update_questionnaires_updated_at
  BEFORE UPDATE ON client_questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 12. ТАБЛИЦА training_programs
-- ============================================

CREATE TABLE IF NOT EXISTS training_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  training_days_count INTEGER NOT NULL CHECK (training_days_count BETWEEN 2 AND 7),
  program_md TEXT NOT NULL,
  program_data JSONB NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  notes_trainer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_training_programs_user_id ON training_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_training_programs_week ON training_programs(week_number);
CREATE INDEX IF NOT EXISTS idx_training_programs_status ON training_programs(status);
CREATE INDEX IF NOT EXISTS idx_training_programs_dates ON training_programs(start_date, end_date);

ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own programs" ON training_programs;
CREATE POLICY "Users can view own programs" ON training_programs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all programs" ON training_programs;
CREATE POLICY "Admins can manage all programs" ON training_programs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer', 'curator')
    )
  );

DROP TRIGGER IF EXISTS update_training_programs_updated_at ON training_programs;
CREATE TRIGGER update_training_programs_updated_at
  BEFORE UPDATE ON training_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 13. ТАБЛИЦА training_entries
-- ============================================

CREATE TABLE IF NOT EXISTS training_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  day_number INTEGER NOT NULL,
  entry_data JSONB NOT NULL DEFAULT '{}',
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_training_entries_program_id ON training_entries(program_id);
CREATE INDEX IF NOT EXISTS idx_training_entries_user_id ON training_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_training_entries_day ON training_entries(day_number);

ALTER TABLE training_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own entries" ON training_entries;
CREATE POLICY "Users can view own entries" ON training_entries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own entries" ON training_entries;
CREATE POLICY "Users can insert own entries" ON training_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own entries" ON training_entries;
CREATE POLICY "Users can update own entries" ON training_entries
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all entries" ON training_entries;
CREATE POLICY "Admins can view all entries" ON training_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer', 'curator')
    )
  );

DROP POLICY IF EXISTS "Admins can manage all entries" ON training_entries;
CREATE POLICY "Admins can manage all entries" ON training_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer', 'curator')
    )
  );

DROP TRIGGER IF EXISTS update_training_entries_updated_at ON training_entries;
CREATE TRIGGER update_training_entries_updated_at
  BEFORE UPDATE ON training_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 14. ТАБЛИЦА client_metrics
-- ============================================

CREATE TABLE IF NOT EXISTS client_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg DECIMAL(5,2),
  body_fat_pct DECIMAL(4,1),
  waist_cm DECIMAL(5,1),
  hips_cm DECIMAL(5,1),
  chest_cm DECIMAL(5,1),
  arm_left_cm DECIMAL(5,1),
  arm_right_cm DECIMAL(5,1),
  thigh_left_cm DECIMAL(5,1),
  thigh_right_cm DECIMAL(5,1),
  sleep_hours DECIMAL(3,1),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  steps_avg INTEGER,
  water_liters DECIMAL(3,1),
  photo_front TEXT,
  photo_side TEXT,
  photo_back TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, measured_at)
);

CREATE INDEX IF NOT EXISTS idx_client_metrics_user_id ON client_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_client_metrics_date ON client_metrics(measured_at);

ALTER TABLE client_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own metrics" ON client_metrics;
CREATE POLICY "Users can view own metrics" ON client_metrics
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own metrics" ON client_metrics;
CREATE POLICY "Users can insert own metrics" ON client_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own metrics" ON client_metrics;
CREATE POLICY "Users can update own metrics" ON client_metrics
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all metrics" ON client_metrics;
CREATE POLICY "Admins can view all metrics" ON client_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer', 'curator')
    )
  );

-- ============================================
-- 15. ТАБЛИЦА notifications
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'payment_confirmed', 'program_uploaded', 'training_completed',
    'metric_added', 'message_received', 'subscription_expiring', 'subscription_expired'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;
CREATE POLICY "Admins can view all notifications" ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 16. ТАБЛИЦА subscription_renewals
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_renewals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  previous_plan_type TEXT,
  previous_end_date DATE,
  previous_had_nutrition BOOLEAN DEFAULT false,
  new_plan_type TEXT NOT NULL CHECK (new_plan_type IN ('1_month', '3_months', '6_months')),
  new_plan_months INTEGER NOT NULL,
  includes_nutrition BOOLEAN DEFAULT false,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  amount DECIMAL(10,2),
  renewal_type TEXT NOT NULL DEFAULT 'renewal' CHECK (renewal_type IN ('renewal', 'nutrition_upgrade', 'plan_change')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  new_start_date DATE,
  new_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewals_user_id ON subscription_renewals(user_id);
CREATE INDEX IF NOT EXISTS idx_renewals_status ON subscription_renewals(status);
CREATE INDEX IF NOT EXISTS idx_renewals_type ON subscription_renewals(renewal_type);

ALTER TABLE subscription_renewals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own renewals" ON subscription_renewals;
CREATE POLICY "Users can view own renewals" ON subscription_renewals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own renewals" ON subscription_renewals;
CREATE POLICY "Users can insert own renewals" ON subscription_renewals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all renewals" ON subscription_renewals;
CREATE POLICY "Admins can manage all renewals" ON subscription_renewals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer')
    )
  );

DROP TRIGGER IF EXISTS update_renewals_updated_at ON subscription_renewals;
CREATE TRIGGER update_renewals_updated_at
  BEFORE UPDATE ON subscription_renewals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 17. ТАБЛИЦА program_templates
-- ============================================

CREATE TABLE IF NOT EXISTS program_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  training_days_count INTEGER NOT NULL DEFAULT 3 CHECK (training_days_count BETWEEN 1 AND 7),
  program_md TEXT NOT NULL,
  program_data JSONB,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_global BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_templates_created_by_idx ON program_templates(created_by);
CREATE INDEX IF NOT EXISTS program_templates_updated_at_idx ON program_templates(updated_at DESC);
CREATE INDEX IF NOT EXISTS program_templates_usage_count_idx ON program_templates(usage_count DESC);

ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view templates" ON program_templates;
CREATE POLICY "Admins can view templates" ON program_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer', 'curator')
    )
  );

DROP POLICY IF EXISTS "Admins can insert templates" ON program_templates;
CREATE POLICY "Admins can insert templates" ON program_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer', 'curator')
    )
  );

DROP POLICY IF EXISTS "Admins can update own templates" ON program_templates;
CREATE POLICY "Admins can update own templates" ON program_templates
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete own templates" ON program_templates;
CREATE POLICY "Admins can delete own templates" ON program_templates
  FOR DELETE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS program_templates_set_updated_at ON program_templates;
CREATE TRIGGER program_templates_set_updated_at
  BEFORE UPDATE ON program_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 18. RPC-ФУНКЦИИ
-- ============================================

-- Проверка роли админа
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
    RETURN user_role IN ('admin', 'curator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Получение всех пользователей (для админки)
CREATE OR REPLACE FUNCTION get_all_users_secure()
RETURNS SETOF profiles AS $$
BEGIN
    IF is_admin() THEN
        RETURN QUERY SELECT * FROM profiles ORDER BY created_at DESC;
    ELSE
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Получение отчётов пользователя
CREATE OR REPLACE FUNCTION get_user_reports_secure(p_user_id UUID)
RETURNS SETOF day_reports AS $$
BEGIN
    IF is_admin() OR auth.uid() = p_user_id THEN
        RETURN QUERY SELECT * FROM day_reports WHERE user_id = p_user_id ORDER BY day_number ASC;
    ELSE
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Получение прогресса пользователя
CREATE OR REPLACE FUNCTION get_user_progress_secure(p_user_id UUID)
RETURNS SETOF user_progress AS $$
BEGIN
    IF is_admin() OR auth.uid() = p_user_id THEN
        RETURN QUERY SELECT * FROM user_progress WHERE user_id = p_user_id ORDER BY day_number ASC, task_id ASC;
    ELSE
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Проверка истечения подписок
CREATE OR REPLACE FUNCTION check_subscription_expiry()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET subscription_status = 'expired'
  WHERE subscription_status = 'active'
    AND subscription_end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Применение продления подписки
CREATE OR REPLACE FUNCTION apply_subscription_renewal(
  p_user_id UUID,
  p_payment_id UUID,
  p_new_plan_months INTEGER,
  p_includes_nutrition BOOLEAN,
  p_new_plan_type TEXT
) RETURNS void AS $$
DECLARE
  v_current_end DATE;
  v_new_start DATE;
  v_new_end DATE;
BEGIN
  SELECT subscription_end_date INTO v_current_end
  FROM profiles WHERE id = p_user_id;

  IF v_current_end IS NOT NULL AND v_current_end >= CURRENT_DATE THEN
    v_new_start := v_current_end + INTERVAL '1 day';
  ELSE
    v_new_start := CURRENT_DATE;
  END IF;

  v_new_end := v_new_start + (p_new_plan_months || ' months')::INTERVAL - INTERVAL '1 day';

  UPDATE profiles SET
    subscription_status = 'active',
    subscription_end_date = v_new_end,
    has_nutrition_plan = CASE
      WHEN p_includes_nutrition THEN true
      ELSE has_nutrition_plan
    END,
    renewal_pending = false
  WHERE id = p_user_id;

  UPDATE subscription_renewals SET
    status = 'confirmed',
    new_start_date = v_new_start,
    new_end_date = v_new_end,
    updated_at = NOW()
  WHERE payment_id = p_payment_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Применение докупки питания
CREATE OR REPLACE FUNCTION apply_nutrition_upgrade(
  p_user_id UUID,
  p_payment_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE profiles SET
    has_nutrition_plan = true,
    renewal_pending = false
  WHERE id = p_user_id;

  UPDATE subscription_renewals SET
    status = 'confirmed',
    updated_at = NOW()
  WHERE payment_id = p_payment_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ГОТОВО! Все таблицы, функции и политики восстановлены.
-- ============================================
