-- Добавляем политику для админов/тренеров на просмотр всех записей тренировок
-- Применить в Supabase Dashboard > SQL Editor

CREATE POLICY IF NOT EXISTS "Admins can manage all entries"
ON training_entries
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'trainer', 'curator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'trainer', 'curator')
  )
);
