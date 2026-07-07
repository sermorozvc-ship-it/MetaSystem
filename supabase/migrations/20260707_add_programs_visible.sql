-- Добавляем колонку programs_visible в profiles.
-- Когда false — клиент НЕ видит свои тренировочные программы.
-- Админ через service_role обходит RLS и видит всё как раньше.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS programs_visible boolean DEFAULT true;

-- Обновляем RLS-политику: клиент видит свои программы ТОЛЬКО если programs_visible = true
DROP POLICY IF EXISTS "Users can view own programs" ON training_programs;
CREATE POLICY "Users can view own programs" ON training_programs
  FOR SELECT USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.programs_visible = true OR profiles.programs_visible IS NULL)
    )
  );
