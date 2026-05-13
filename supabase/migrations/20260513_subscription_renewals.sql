-- ============================================
-- MetaSystem: Механизм продления тарифов и докупки питания
-- Date: 2026-05-13
-- ============================================

-- ============================================
-- Таблица истории продлений подписок
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_renewals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Предыдущий тариф (снапшот на момент продления)
  previous_plan_type TEXT,
  previous_end_date DATE,
  previous_had_nutrition BOOLEAN DEFAULT false,

  -- Новый тариф
  new_plan_type TEXT NOT NULL CHECK (new_plan_type IN ('1_month', '3_months', '6_months')),
  new_plan_months INTEGER NOT NULL,
  includes_nutrition BOOLEAN DEFAULT false,

  -- Оплата
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  amount DECIMAL(10,2),

  -- Тип операции
  renewal_type TEXT NOT NULL DEFAULT 'renewal'
    CHECK (renewal_type IN ('renewal', 'nutrition_upgrade', 'plan_change')),

  -- Статус
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled')),

  -- Новые даты подписки (заполняются при подтверждении)
  new_start_date DATE,
  new_end_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewals_user_id ON subscription_renewals(user_id);
CREATE INDEX IF NOT EXISTS idx_renewals_status ON subscription_renewals(status);
CREATE INDEX IF NOT EXISTS idx_renewals_type ON subscription_renewals(renewal_type);

COMMENT ON TABLE subscription_renewals IS 'История продлений и изменений тарифов клиентов';
COMMENT ON COLUMN subscription_renewals.renewal_type IS 'renewal=продление, nutrition_upgrade=докупка питания, plan_change=смена тарифа';

-- RLS
ALTER TABLE subscription_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own renewals" ON subscription_renewals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own renewals" ON subscription_renewals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all renewals" ON subscription_renewals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'trainer')
    )
  );

CREATE TRIGGER update_renewals_updated_at
  BEFORE UPDATE ON subscription_renewals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Новые поля в profiles
-- ============================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS nutrition_questionnaire_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_pending BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.renewal_pending IS 'Флаг: есть ожидающее продление (pending payment для renewal)';
COMMENT ON COLUMN profiles.nutrition_questionnaire_completed IS 'Заполнена ли анкета по питанию';

-- ============================================
-- Функция: применить продление подписки
-- ============================================
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

  -- Если подписка ещё активна — продлеваем от текущей даты окончания
  -- Если истекла — продлеваем от сегодня
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
      ELSE has_nutrition_plan  -- сохраняем если уже было питание
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

-- ============================================
-- Функция: применить докупку питания
-- ============================================
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
-- Обновляем вебхук ЮMoney: добавляем поле renewal_type в payments
-- ============================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS renewal_type TEXT
    CHECK (renewal_type IN ('initial', 'renewal', 'nutrition_upgrade'));

COMMENT ON COLUMN payments.renewal_type IS 'Тип платежа: initial=первичный, renewal=продление, nutrition_upgrade=докупка питания';

-- Все существующие платежи — первичные
UPDATE payments SET renewal_type = 'initial' WHERE renewal_type IS NULL;
