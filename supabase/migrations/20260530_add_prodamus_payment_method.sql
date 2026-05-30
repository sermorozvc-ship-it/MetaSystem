-- Миграция на Prodamus: добавляем 'prodamus' в список разрешённых методов оплаты.
-- Изменение аддитивное — старые значения ('manual','stripe','yookassa','yoomoney')
-- сохраняются, чтобы исторические записи и «хвостовые» ЮMoney-платежи не упали.

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('manual', 'stripe', 'yookassa', 'yoomoney', 'prodamus'));
