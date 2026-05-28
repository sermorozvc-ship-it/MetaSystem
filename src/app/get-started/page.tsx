'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, UserPlus, CreditCard, Sparkles, ShieldCheck, ArrowRight, Loader2, LogIn, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isAdminUser } from '@/lib/auth/isAdminUser'

/**
 * Информационная страница между лендингом и регистрацией.
 *
 * Зачем: раньше пользователь видел /payment ДВАЖДЫ — до регистрации
 * (выбирал тариф) и после возврата с /auth (выбирал заново). Теперь
 * выбор тарифа происходит один раз — после регистрации. Эта страница
 * объясняет дальнейшие шаги, чтобы переход с лендинга на /auth не
 * выглядел как «куда меня кинуло».
 *
 * Редиректы:
 *  - admin           → /admin
 *  - залогинен       → /payment (там уже сам решит, куда дальше: онбординг/дашборд)
 *  - не залогинен    → показываем страницу с CTA «Регистрация» / «Войти»
 */

const STEPS = [
    {
        icon: UserPlus,
        title: 'Создаёте аккаунт',
        text: 'Email, пароль, имя — занимает меньше минуты. Аккаунт нужен чтобы привязать оплату и сохранить вашу программу.',
    },
    {
        icon: CreditCard,
        title: 'Выбираете тариф и оплачиваете',
        text: 'После регистрации откроется страница с актуальными тарифами. Там же добавляете план питания, вводите промокод и оплачиваете через ЮMoney.',
    },
    {
        icon: Sparkles,
        title: 'Заполняете анкету и получаете программу',
        text: 'После оплаты вы попадаете в личный кабинет, заполняете анкету, и в течение 48 часов получаете индивидуальную программу.',
    },
]

export default function GetStartedPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const [redirecting, setRedirecting] = useState(false)

    // Залогиненных пускаем дальше — на /payment, остальное разрулит сама /payment.
    // Используем router.replace, а не window.location.href, согласно desktop-page-load.md.
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_DISABLE_REDIRECTS === 'true') return
        if (authLoading || !user || redirecting) return

        setRedirecting(true)
        if (isAdminUser(user)) {
            router.replace('/admin')
        } else {
            router.replace('/payment')
        }
    }, [user, authLoading, redirecting, router])

    if (authLoading || (user && redirecting)) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main flex items-start justify-center p-4 py-10 overflow-y-auto">
            <div className="fixed inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/10 pointer-events-none" />

            <div className="relative w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-4 shadow-glow-accent">
                        <Flame className="w-9 h-9 text-bg-main" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-3">
                        Ещё пара шагов до старта
                    </h1>
                    <p className="text-text-secondary text-base md:text-lg max-w-xl mx-auto">
                        Чтобы увидеть актуальные тарифы, ввести промокод и оплатить —
                        нужно создать аккаунт. Это нужно для того, чтобы привязать
                        оплату и вашу будущую программу к личному кабинету.
                    </p>
                </div>

                {/* Шаги */}
                <div className="glass-card p-5 md:p-7 mb-6">
                    <div className="space-y-5">
                        {STEPS.map((step, i) => {
                            const Icon = step.icon
                            return (
                                <div key={i} className="flex items-start gap-4">
                                    <div className="flex-shrink-0 relative">
                                        <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center">
                                            <Icon className="w-5 h-5 text-accent" />
                                        </div>
                                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-bg-main text-[11px] font-bold flex items-center justify-center">
                                            {i + 1}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <div className="text-white font-semibold mb-1">{step.title}</div>
                                        <div className="text-sm text-text-secondary leading-relaxed">{step.text}</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Гарантии */}
                    <div className="mt-6 pt-5 border-t border-white/10 grid sm:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0" />
                            Оплата через ЮMoney без комиссии
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                            Гарантия возврата в течение 5 дней
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <div className="flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/auth?mode=register&returnTo=/payment')}
                        className="glass-button w-full flex items-center justify-center gap-2 py-4 text-base"
                    >
                        Зарегистрироваться
                        <ArrowRight className="w-5 h-5" />
                    </button>

                    <button
                        type="button"
                        onClick={() => router.push('/auth?mode=login')}
                        className="glass-button-secondary w-full flex items-center justify-center gap-2 py-3 text-sm"
                    >
                        <LogIn className="w-4 h-4" />
                        Уже есть аккаунт — войти
                    </button>

                    <button
                        type="button"
                        onClick={() => router.push('/')}
                        className="text-text-muted hover:text-white text-sm py-2 transition-colors"
                    >
                        ← Вернуться на главную
                    </button>
                </div>

                <p className="text-center text-xs text-text-muted mt-6">
                    Вопросы до оплаты — пишите в Telegram{' '}
                    <a
                        href="https://t.me/dgmukhin_adm"
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                    >
                        @dgmukhin_adm
                    </a>
                </p>
            </div>
        </div>
    )
}
