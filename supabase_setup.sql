-- ============================================
-- MetaSystem: Создание недостающих таблиц
-- Выполните этот SQL в Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Таблица тренировочных программ
CREATE TABLE IF NOT EXISTS training_programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    training_days_count INTEGER NOT NULL DEFAULT 3,
    program_md TEXT NOT NULL DEFAULT '',
    program_data JSONB NOT NULL DEFAULT '{}',
    notes_trainer TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Таблица записей тренировок (заполняется клиентом)
CREATE TABLE IF NOT EXISTS training_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    exercise_id TEXT NOT NULL,
    actual_weight NUMERIC,
    actual_reps INTEGER,
    rpe NUMERIC,
    comment TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(program_id, day_number, exercise_id)
);

-- 3. Таблица уведомлений
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Таблица метрик клиента (если не существует)
CREATE TABLE IF NOT EXISTS client_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weight_kg NUMERIC,
    body_fat_pct NUMERIC,
    waist_cm NUMERIC,
    hips_cm NUMERIC,
    chest_cm NUMERIC,
    arm_cm NUMERIC,
    thigh_cm NUMERIC,
    photo_front TEXT,
    photo_side TEXT,
    photo_back TEXT,
    notes TEXT,
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Таблица анкет клиентов (если не существует)
CREATE TABLE IF NOT EXISTS client_questionnaires (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    age INTEGER,
    gender TEXT,
    height_cm NUMERIC,
    weight_kg NUMERIC,
    goal TEXT,
    training_experience TEXT,
    preferred_training_days INTEGER DEFAULT 3,
    available_equipment TEXT[] DEFAULT '{}',
    injuries TEXT,
    health_conditions TEXT,
    sleep_hours_avg NUMERIC DEFAULT 7,
    stress_level INTEGER DEFAULT 5,
    activity_level TEXT,
    waist_cm NUMERIC,
    hips_cm NUMERIC,
    chest_cm NUMERIC,
    arm_cm NUMERIC,
    thigh_cm NUMERIC,
    photo_front TEXT,
    photo_side TEXT,
    photo_back TEXT,
    additional_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS (Row Level Security) Policies
-- ============================================

-- training_programs
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;

-- Клиент видит свои программы
CREATE POLICY "Users can view own programs" ON training_programs
    FOR SELECT USING (auth.uid() = user_id);

-- Админ может всё
CREATE POLICY "Admin full access to programs" ON training_programs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'curator'))
    );

-- Вставка для админов
CREATE POLICY "Admin can insert programs" ON training_programs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'curator'))
    );

-- training_entries
ALTER TABLE training_entries ENABLE ROW LEVEL SECURITY;

-- Клиент видит и редактирует свои записи
CREATE POLICY "Users can manage own entries" ON training_entries
    FOR ALL USING (auth.uid() = user_id);

-- Админ может всё
CREATE POLICY "Admin full access to entries" ON training_entries
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'curator'))
    );

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Пользователь видит свои уведомления
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Пользователь может обновлять свои (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Пользователь может удалять свои
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Любой авторизованный может создавать уведомления (для системных)
CREATE POLICY "Authenticated can insert notifications" ON notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- client_metrics
ALTER TABLE client_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own metrics" ON client_metrics
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admin full access to metrics" ON client_metrics
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'curator'))
    );

-- client_questionnaires
ALTER TABLE client_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own questionnaire" ON client_questionnaires
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admin full access to questionnaires" ON client_questionnaires
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'curator'))
    );

-- ============================================
-- Индексы для производительности
-- ============================================
CREATE INDEX IF NOT EXISTS idx_training_programs_user_id ON training_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_training_programs_status ON training_programs(status);
CREATE INDEX IF NOT EXISTS idx_training_entries_program_id ON training_entries(program_id);
CREATE INDEX IF NOT EXISTS idx_training_entries_user_id ON training_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_client_metrics_user_id ON client_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_client_questionnaires_user_id ON client_questionnaires(user_id);
