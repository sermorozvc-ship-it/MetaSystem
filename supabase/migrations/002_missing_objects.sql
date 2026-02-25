-- Migration 002: Missing Objects
-- This script creates tables and functions that are used in the codebase but were missing from the initial schema.

-- ============================================
-- Journal Entries Table
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

-- ============================================
-- Admin Messages Table
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

-- ============================================
-- Day Reports (Update or Create if missing)
-- ============================================
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='day_reports' AND column_name='status') THEN
        ALTER TABLE day_reports ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='day_reports' AND column_name='files') THEN
        ALTER TABLE day_reports ADD COLUMN files JSONB DEFAULT '[]';
    END IF;
END $$;

-- ============================================
-- RPC Functions for Admin Service
-- ============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
    RETURN user_role IN ('admin', 'curator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- ============================================
-- RLS Policies for new tables
-- ============================================
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journal" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journal" ON journal_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journal" ON journal_entries FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their messages" ON admin_messages 
FOR SELECT USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

CREATE POLICY "Users can insert messages" ON admin_messages 
FOR INSERT WITH CHECK (auth.uid() = from_user_id);