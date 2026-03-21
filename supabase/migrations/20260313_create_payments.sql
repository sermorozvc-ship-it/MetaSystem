-- Таблица оплат для платного курса (MVP — ручная оплата)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  currency TEXT DEFAULT 'RUB',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'refunded')),
  payment_method TEXT DEFAULT 'manual'
    CHECK (payment_method IN ('manual', 'stripe', 'yookassa')),
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  cohort_start DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои оплаты
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- Пользователь может создать запрос на оплату
CREATE POLICY "Users can create payment requests"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Админ может видеть и обновлять все оплаты
CREATE POLICY "Admins can manage all payments"
  ON public.payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Функция для автообновления updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();
