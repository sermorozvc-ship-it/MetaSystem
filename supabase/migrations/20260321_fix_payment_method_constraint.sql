-- Добавляем yoomoney в список разрешённых методов оплаты
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('manual', 'stripe', 'yookassa', 'yoomoney'));
