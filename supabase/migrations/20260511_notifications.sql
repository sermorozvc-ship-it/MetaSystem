-- ============================================
-- MetaSystem v2 — Notifications
-- Дата: 2026-05-11
-- ============================================

-- Таблица уведомлений
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'payment_confirmed',
    'program_uploaded',
    'training_completed',
    'metric_added',
    'message_received',
    'subscription_expiring',
    'subscription_expired'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- RLS-политики
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Пользователи видят только свои уведомления
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Пользователи могут обновлять свои уведомления (отмечать прочитанными)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Пользователи могут удалять свои уведомления
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Система может создавать уведомления для любого пользователя
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Админы видят все уведомления
CREATE POLICY "Admins can view all notifications"
  ON notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Комментарий
COMMENT ON TABLE notifications IS 'Уведомления для пользователей';
