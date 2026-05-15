'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { getUserPayment } from '@/lib/services/payment'
import { isQuestionnaireCompleted } from '@/lib/services/questionnaire'

const PAIN_POINTS = [
    { emoji: '😤', text: 'Я тренируюсь в зале больше года, но отражение в зеркале не меняется.' },
    { emoji: '😴', text: 'После работы нет сил, а когда есть силы, нет понимания что делать.' },
    { emoji: '😕', text: 'Не понимаю сколько подходов делать и как правильно прогрессировать.' },
    { emoji: '🤷', text: 'Пробовал программы из интернета, ничего не сработало.' },
    { emoji: '📉', text: 'Худею, но теряю мышцы. Набираю, но растёт живот, а не мышцы.' },
    { emoji: '🔄', text: 'Каждые 2 месяца начинаю заново с нуля.' },
]

const PLATFORM_FEATURES = [
    {
        icon: '📋',
        title: 'Программа прямо в кабинете',
        text: 'Каждую неделю ты видишь свою программу в приложении. Упражнения с видео по технике. Рабочие веса и повторения вводятся прямо в интерфейсе, после чего данные сохраняются автоматически.',
    },
    {
        icon: '📊',
        title: 'Метрики и графики прогресса',
        text: 'Все показатели веса, обхватов и процента жира представлены в виде наглядных графиков. Ты видишь как меняется тело в цифрах, а не на ощущение. Раздел сравнения фото: было и стало.',
    },
    {
        icon: '⚡',
        title: 'Автосохранение в реальном времени',
        text: 'Как только вы вводите данные тренировки, они мгновенно отображаются у меня. Никаких скриншотов и пересылки таблиц в чат. Я вижу твои результаты и корректирую программу.',
    },
    {
        icon: '💬',
        title: 'Чат с тренером внутри платформы',
        text: 'Все вопросы и ответы в одном месте. Не нужно искать переписку в Telegram. История общения сохраняется на весь срок ведения.',
    },
    {
        icon: '📅',
        title: 'Навигация по неделям',
        text: 'Видишь текущую неделю, прошлые программы и статус каждой тренировки. Сразу понятно что выполнено, что нет и что ждёт тебя дальше.',
    },
    {
        icon: '🛡️',
        title: 'Твои данные в безопасности',
        text: 'Анкета, замеры и фотографии прогресса хранятся в защищённой базе данных. Только ты и я видим твои данные. Никаких сторонних сервисов.',
    },
]

const COMPARE_ROWS: [string, string][] = [
    ['WhatsApp + Google Docs', 'Личная платформа с кабинетом'],
    ['Шаблонная программа', 'Программа под твои данные'],
    ['Составили и забыли', 'Корректировка каждую неделю'],
    ['Прогресс только на ощущение', 'Метрики и графики в цифрах'],
    ['Техника на глаз', 'Разбор техники по видео'],
    ['Ответ через несколько дней', 'Ответы в чате в течение дня'],
    ['Нет гарантий', 'Возврат за 5 дней если не устроит'],
]

const TIMELINE_STEPS = [
    {
        title: 'Анкета (после оплаты)',
        text: 'Ты получаешь доступ в личный кабинет и заполняешь подробную анкету. Цель, уровень подготовки, расписание, травмы если есть, данные по сну и стрессу. Вносишь стартовые замеры и фото. Это занимает 7–10 минут и даёт мне всё что нужно.',
    },
    {
        title: 'Программа в кабинете (48 часов)',
        text: 'В твоём личном кабинете появляется первая программа. Каждое упражнение с видео по технике. Параметры нагрузки рассчитаны под твои данные. Это не шаблон, а по-настоящему индивидуальный план.',
    },
    {
        title: 'Тренируешься и вносишь данные',
        text: 'После каждой тренировки вводишь рабочие веса, количество повторений и своё самочувствие прямо в платформе. Автосохранение работает в реальном времени. Занимает 2–3 минуты.',
    },
    {
        title: 'Я вижу всё в реальном времени',
        text: 'Я мгновенно вижу все данные сразу после того, как ты их внёс. Не нужно пересылать скриншоты или таблицы в чат. Я анализирую динамику и готовлю корректировку.',
    },
    {
        title: 'Еженедельная корректировка',
        text: 'Каждую неделю в твоём кабинете появляется обновлённая программа. Если нагрузка идёт хорошо, мы двигаемся вперёд. При возникновении сложностей мы сразу разбираемся в причинах и подстраиваем план. Программа растёт вместе с тобой.',
    },
    {
        title: 'Метрики и прогресс',
        text: 'Раз в месяц вносишь замеры. В разделе метрик видишь графики: динамика веса, обхватов, сна, уровня стресса. Сравниваешь фото за разные периоды. Прогресс становится видимым в цифрах.',
    },
]

const BENEFITS = [
    { icon: '🎯', title: 'Индивидуальная программа тренировок', text: 'Составлена под твой уровень, цель, расписание и оборудование. Учитывает травмы, данные по сну и стрессу. Не бывает двух одинаковых программ.' },
    { icon: '🖥️', title: 'Личный кабинет на платформе', text: 'Программа, метрики, графики и чат с тренером собраны в одном месте. Работает на телефоне и компьютере.' },
    { icon: '🔄', title: 'Еженедельная корректировка', text: 'Каждую неделю новая версия программы с учётом твоих результатов. Ты всегда в оптимальной зоне роста.' },
    { icon: '📊', title: 'Метрики и графики прогресса', text: 'Вес, обхваты, процент жира в виде графиков. Раздел сравнения фото: было и стало. Прогресс виден в цифрах, а не на ощущение.' },
    { icon: '📹', title: 'Разбор техники по видео', text: 'Снимаешь себя во время упражнения, я смотрю и даю правки. Правильная техника снижает риск травм и повышает отдачу от каждого подхода.' },
    { icon: '💬', title: 'Поддержка в чате', text: 'Вопросы по тренировкам, питанию, восстановлению. Отвечаю в течение дня. Вся история переписки хранится в кабинете.' },
    { icon: '📅', title: 'Контроль прогресса', text: 'Раз в месяц разбираем что изменилось в цифрах. Ты видишь динамику и понимаешь куда движешься.' },
    { icon: '🛡️', title: 'Гарантия результата', text: 'Если в течение первых пяти дней что-то не устроит, я полностью верну деньги без вопросов. Мне не нужны клиенты которым не подошло.' },
]

const REVIEWS = [
    {
        result: 'минус 16 кг за 4.5 месяца',
        text: 'Тренировался сам 2 года и почти ничего не добился. С Дмитрием за 4.5 месяца убрал живот, нормализовал гормональный фон и повысил уровень энергии. Самое удобное заключается в том, что программа и динамика изменений всех показателей отображаются прямо в приложении.',
        author: 'Алексей, 36 лет, Москва',
    },
    {
        result: 'плюс 8 кг сухой массы за 6 месяцев',
        text: 'Три года в зале и всё встало. Думала справлюсь сама. За полгода с Дмитрием прогресс которого не было никогда. Очень удобно что в личном кабинете видна вся история тренировок и графики. Понимаешь что работает, а что нет.',
        author: 'Мария, 31 год, Санкт-Петербург',
    },
    {
        result: 'жим 80 кг вырос до 115 кг за 8 месяцев',
        text: 'Работаю много, времени мало. 3 тренировки в неделю по 60 минут. Через 8 месяцев результат которого не ожидал. Платформа очень удобная, заполнил данные после тренировки за 2 минуты и всё сразу видит тренер.',
        author: 'Павел, 38 лет, Казань',
    },
]

const OBJECTIONS = [
    {
        q: '«Я уже пробовал заниматься с онлайн-тренерами, но это не принесло результата»',
        a: 'Понимаю. Большинство онлайн-тренеров дают шаблонную программу в PDF и пропадают. Я работаю через собственную платформу: программа в личном кабинете, еженедельные корректировки, чат, метрики. Всё прозрачно и в одном месте. Плюс гарантия возврата за 5 дней — если не устроит, верну деньги без вопросов.',
    },
    {
        q: '«Дорого. Не уверен что оно того стоит»',
        a: 'Месяц ведения стоит меньше чем большинство людей тратит на спортпит и абонемент вместе взятые. При этом результат за месяц с системой обычно превышает результат за год без неё. Посчитай сколько времени ты уже тренируешься без нужного прогресса. Это тоже стоит денег.',
    },
    {
        q: '«У меня мало времени»',
        a: 'Именно для этого и нужна система. Программа строится с учётом вашего реального расписания. Даже три тренировки в неделю длительностью от 45 до 60 минут позволяют получить отличный результат. Данные вносишь в платформу за 2–3 минуты после тренировки. Я работаю с занятыми людьми 10 лет, это условие задачи, не проблема.',
    },
    {
        q: '«Боюсь что не справлюсь или мне это не подойдёт»',
        a: 'Для этого и существует первая неделя. Получаешь доступ, смотришь как устроена платформа, начинаешь по программе, задаёшь вопросы. Если за 5 дней понимаешь что это не то — возвращаю деньги полностью. Риск нулевой.',
    },
]

const FAQ_ITEMS = [
    { q: 'Как быстро получу доступ к платформе после оплаты?', a: 'В течение 24 часов. После оплаты я создаю для тебя аккаунт и отправляю ссылку на вход. Дальше заполняешь анкету, и через 48 часов в кабинете появляется первая программа.' },
    { q: 'На каком устройстве работает платформа?', a: 'Доступно на любом устройстве: телефон, планшет или компьютер. Платформа адаптирована для мобильных устройств, так что удобно пользоваться в зале сразу после тренировки.' },
    { q: 'Нужен ли зал или можно заниматься дома?', a: 'Программу составляю под твои условия: зал, дом с оборудованием или только вес тела. Система работает. Главное понимать исходные данные.' },
    { q: 'Что если у меня есть травма?', a: 'Это учитывается при составлении программы. Многие травмы не мешают тренировкам. Достаточно подобрать правильные упражнения и следить за техникой. Просто укажите ограничения в анкете и я учту их при составлении плана.' },
    { q: 'Как часто нужно тренироваться?', a: 'Программа строится под твоё реальное расписание. Три тренировки в неделю по 45–60 минут дают отличный результат при системном подходе.' },
    { q: 'Как работает гарантия возврата?', a: 'Если за первые 5 дней что-то не устроит, просто напиши мне в личку. Я верну деньги полностью. Без условий и объяснений.' },
    { q: 'Я новичок, подойдёт ли мне это?', a: 'Да. Работаю с людьми от абсолютных новичков до тех кто тренируется несколько лет. Программа всегда строится под твой текущий уровень.' },
    { q: 'Мне больше 40 лет, не поздно ли начинать?', a: 'Нет. Физиология адаптации работает в любом возрасте. Работаю с клиентами 40–55 лет, результаты такие же реальные.' },
    { q: 'Что такое MetaSystem?', a: 'Это моя собственная платформа для ведения клиентов. Личный кабинет где хранится программа, метрики, история тренировок и чат со мной. Всё в одном месте вместо WhatsApp и Google Docs.' },
    { q: 'Включает ли ведение программу питания?', a: 'Питание за 3 000 рублей добавляется к любому тарифу. На тарифе 6 месяцев питание включено в подарок.' },
    { q: 'Можно ли продлить тариф?', a: 'Да, в любое время. По той же цене что и при старте — рост цены не распространяется на действующих клиентов.' },
    { q: 'Как связаться если есть вопросы до оплаты?', a: 'Пиши в Telegram — t.me/dgmukhin_adm. Отвечаю в течение дня.' },
]

const PLANS = [
    {
        key: '1_month' as const,
        duration: 'СТАРТ · 1 месяц',
        price: '5 ₽',
        perMonth: '5 ₽ в месяц',
        features: [
            'Доступ к личному кабинету MetaSystem',
            'Индивидуальная программа тренировок',
            'Еженедельная корректировка (4 раза)',
            'Разбор техники по видео (до 4 раз)',
            'Поддержка в чате весь месяц',
            'Метрики и графики прогресса',
            'Контроль прогресса по итогам месяца',
            'Гарантия возврата за 5 дней',
        ],
        desc: 'Хорошо подходит для знакомства с системой.',
        featured: false,
        badge: null,
    },
    {
        key: '3_months' as const,
        duration: 'ПРОГРЕСС · 3 месяца',
        price: '6 ₽',
        perMonth: '2 ₽ в месяц (экономия 9 800 ₽)',
        features: [
            'Доступ к личному кабинету MetaSystem',
            'Индивидуальная программа тренировок',
            'Еженедельная корректировка (12 раз)',
            'Разбор техники по видео (до 12 раз)',
            'Поддержка в чате 3 месяца',
            'Метрики и графики прогресса',
            'Контроль прогресса каждый месяц',
            'Гарантия возврата за 5 дней',
            'БОНУС: Пересмотр программы после первого мезоцикла',
        ],
        desc: 'За 3 месяца проходим полный цикл и закрепляем результат.',
        featured: true,
        badge: 'САМЫЙ ПОПУЛЯРНЫЙ',
    },
    {
        key: '6_months' as const,
        duration: 'ТРАНСФОРМАЦИЯ · 6 месяцев',
        price: '7 ₽',
        perMonth: '1.17 ₽ в месяц (экономия 29 500 ₽)',
        features: [
            'Доступ к личному кабинету MetaSystem',
            'Индивидуальная программа тренировок',
            'Еженедельная корректировка (24 раза)',
            'Разбор техники по видео (без ограничений)',
            'Поддержка в чате 6 месяцев',
            'Метрики и графики прогресса',
            'Контроль прогресса каждый месяц',
            'Гарантия возврата за 5 дней',
            'БОНУС: Программа питания включена (3 000 ₽ в подарок)',
            'БОНУС: Приоритетный ответ в чате',
        ],
        desc: 'За 6 месяцев меняется не только тело — меняется привычка тренироваться.',
        featured: false,
        badge: 'МАКСИМАЛЬНЫЙ РЕЗУЛЬТАТ',
    },
]

function Timer() {
    const [time, setTime] = useState('72:00:00')

    useEffect(() => {
        let deadline = Number(localStorage.getItem('offer_deadline'))
        if (!deadline || Number.isNaN(deadline)) {
            deadline = Date.now() + 72 * 60 * 60 * 1000
            localStorage.setItem('offer_deadline', String(deadline))
        }
        const tick = () => {
            const diff = deadline - Date.now()
            if (diff <= 0) {
                setTime('00:00:00')
                return
            }
            const h = Math.floor(diff / 3600000)
            const m = Math.floor((diff % 3600000) / 60000)
            const s = Math.floor((diff % 60000) / 1000)
            setTime(
                `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            )
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [])

    return <div className="urgency-timer">{time}</div>
}

export default function LandingPage() {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const [scrolled, setScrolled] = useState(false)

    // Авторизованный редирект (если не отключён dev-флагом)
    // Используем ref чтобы не перезапускать при каждом рендере
    const redirected = useRef(false)
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_DISABLE_REDIRECTS === 'true') return
        if (!isLoading && user && !redirected.current) {
            redirected.current = true
            const check = async () => {
                try {
                    // Проверяем роль — админ идёт в /admin
                    const ADMIN_EMAILS = ['dgmukhin@gmail.com']
                    const isAdminUser = ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')
                        || user.user_metadata?.role === 'admin'
                        || user.user_metadata?.role === 'curator'
                        || user.user_metadata?.role === 'trainer'

                    if (isAdminUser) {
                        window.location.href = '/admin'
                        return
                    }

                    const payment = await getUserPayment()
                    if (!payment || payment.status !== 'confirmed') {
                        window.location.href = '/payment'
                        return
                    }
                    const done = await isQuestionnaireCompleted()
                    if (!done) {
                        window.location.href = '/questionnaire'
                        return
                    }
                    // Проверяем анкету питания при необходимости
                    try {
                        const { isNutritionQuestionnaireRequired, isNutritionQuestionnaireCompleted } =
                            await import('@/lib/services/nutrition')
                        const needsNutrition = await isNutritionQuestionnaireRequired()
                        if (needsNutrition) {
                            const nutritionDone = await isNutritionQuestionnaireCompleted()
                            if (!nutritionDone) {
                                window.location.href = '/questionnaire/nutrition'
                                return
                            }
                        }
                    } catch {}
                    window.location.href = '/dashboard'
                } catch {
                    window.location.href = '/payment'
                }
            }
            check()
        }
    }, [user, isLoading])

    // Sticky navbar background
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    // Fade-in on scroll — запускаем после полного рендера
    useEffect(() => {
        const init = () => {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('visible')
                            observer.unobserve(entry.target)
                        }
                    })
                },
                { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
            )
            document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el))
            return observer
        }

        // Небольшая задержка чтобы DOM полностью отрисовался
        const timer = setTimeout(() => {
            const obs = init()
            return () => obs.disconnect()
        }, 100)

        return () => clearTimeout(timer)
    }, [])

    const handleBuyPlan = (planKey: string) => {
        // Сохраняем выбранный план и переходим на страницу оплаты
        // Регистрация происходит после оплаты через /onboarding
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('selected_plan', planKey)
        }
        window.location.href = `/payment?plan=${planKey}`
    }

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }

    return (
        <div className="landing-root">
            {/* NAVBAR */}
            <nav className={`landing-navbar ${scrolled ? 'scrolled' : ''}`}>
                <div className="landing-nav-inner">
                    <a href="#" className="landing-logo" onClick={(e) => { e.preventDefault(); scrollTo('top') }}>
                        <div className="landing-logo-mark">ДМ</div>
                        <span className="landing-logo-text">Дмитрий Мухин</span>
                    </a>
                    <a
                        href="#pricing"
                        className="landing-nav-cta"
                        onClick={(e) => { e.preventDefault(); scrollTo('pricing') }}
                    >
                        Начать →
                    </a>
                </div>
            </nav>

            {/* HERO */}
            <section id="top" className="landing-hero">
                <div className="badge">⚡ Научный подход · 10 лет опыта · Личная платформа для каждого клиента</div>
                <h1 className="landing-h1">
                    Ты уже тренируешься.<br />
                    Осталось начать <span className="accent">прогрессировать</span>.
                </h1>
                <p className="landing-lede">
                    Вы получаете онлайн-ведение с индивидуальной программой и еженедельной корректировкой.
                    В личном кабинете ваш прогресс отображается в виде понятных цифр и графиков.
                    Это настоящая система, а не шаблон с вашим именем.
                </p>
                <div className="hero-facts">
                    <span>✓ Программа с первого дня</span>
                    <span>✓ Корректировка каждую неделю</span>
                    <span>✓ Личный кабинет с метриками</span>
                    <span>✓ Результат или деньги назад</span>
                </div>
                <div className="btn-group">
                    <a href="#pricing" className="btn-primary" onClick={(e) => { e.preventDefault(); scrollTo('pricing') }}>
                        Выбрать тариф →
                    </a>
                    <a href="#platform" className="btn-outline" onClick={(e) => { e.preventDefault(); scrollTo('platform') }}>
                        Как устроена платформа
                    </a>
                </div>
                <p className="hero-people">👤 Прямо сейчас со мной занимаются 23 человека</p>
            </section>

            {/* ВИДЕО */}
            <section className="bg-section" style={{ display: 'none' }}>
                <div className="landing-container fade-in">
                    <h2 className="section-title">Посмотрите видео и я всё расскажу за 5 минут</h2>
                    <p className="section-subtitle">
                        Что ты получишь, как устроена платформа и почему это работает там где самостоятельные тренировки не дают результата.
                    </p>
                    <div className="video-wrapper">
                        <div className="video-placeholder">
                            <div className="video-play-btn">▶</div>
                            <div className="video-label">Видео · 5 минут</div>
                        </div>
                    </div>
                    <div className="video-tags">
                        <span>🎯 Объясняю систему</span>
                        <span>🖥️ Показываю платформу изнутри</span>
                        <span>💬 Закрываю главные вопросы</span>
                    </div>
                </div>
            </section>

            {/* БОЛЬ */}
            <section>
                <div className="landing-container-wide fade-in">
                    <h2 className="section-title">Это про тебя?</h2>
                    <div className="pain-grid" style={{ marginTop: 48 }}>
                        {PAIN_POINTS.map((p, i) => (
                            <div key={i} className="pain-card">
                                <span style={{ marginRight: 8 }}>{p.emoji}</span>
                                {p.text}
                            </div>
                        ))}
                    </div>
                    <p className="pain-footer">
                        Если хотя бы два пункта из шести совпали, то проблема заключается не в отсутствии силы воли.
                        Дело в отсутствии системы. Системой я занимаюсь 10 лет.
                    </p>
                </div>
            </section>

            {/* ПЛАТФОРМА */}
            <section id="platform" className="bg-section">
                <div className="landing-container-wide fade-in">
                    <h2 className="section-title">Твой личный кабинет внутри системы</h2>
                    <p className="section-subtitle">
                        Большинство тренеров работают через WhatsApp и Google Docs.
                        Я создал собственную платформу, где ты видишь всё в одном месте
                        и понимаешь что происходит с твоим телом в цифрах.
                    </p>
                    <div className="platform-grid">
                        {PLATFORM_FEATURES.map((f, i) => (
                            <div key={i} className="platform-card">
                                <div className="platform-icon">{f.icon}</div>
                                <div className="platform-title">{f.title}</div>
                                <div className="platform-text">{f.text}</div>
                            </div>
                        ))}
                    </div>
                    <div className="platform-highlight">
                        <div className="platform-highlight-label">Как это выглядит изнутри</div>
                        <div className="platform-highlight-text">
                            После оплаты ты заполняешь подробную анкету: цель, параметры тела,
                            уровень подготовки, травмы, режим сна и стресс.
                            Вносишь стартовые замеры и фото.
                            В течение 48 часов в твоём кабинете появляется первая программа.
                            Каждую неделю я загружаю новую версию с учётом твоих результатов.
                            Ты тренируешься, вносишь данные прямо в приложение.
                            Я вижу всё в реальном времени и корректирую план.
                        </div>
                    </div>
                </div>
            </section>

            {/* СРАВНЕНИЕ */}
            <section>
                <div className="landing-container-wide fade-in">
                    <h2 className="section-title">Как я работаю и в чём заключаются основные отличия</h2>
                    <div className="compare-table" style={{ marginTop: 48 }}>
                        <div className="compare-header">
                            <div className="compare-col-bad">Как у большинства</div>
                            <div className="compare-col-good">Как у меня</div>
                        </div>
                        {COMPARE_ROWS.map(([bad, good], i) => (
                            <div key={i} className="compare-row">
                                <div className="compare-cell bad">❌ {bad}</div>
                                <div className="compare-cell good">✅ {good}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* КАК РАБОТАЕМ */}
            <section id="how" className="bg-section">
                <div className="landing-container fade-in">
                    <h2 className="section-title">Как выглядит работа изнутри</h2>
                    <p className="section-subtitle">
                        Шесть шагов от оплаты до первого видимого прогресса.
                    </p>
                    <div className="timeline">
                        {TIMELINE_STEPS.map((s, i) => (
                            <div key={i} className="timeline-step">
                                <div className="timeline-dot">{i + 1}</div>
                                <div className="timeline-title">{s.title}</div>
                                <div className="timeline-text">{s.text}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ЧТО ПОЛУЧАЕШЬ */}
            <section>
                <div className="landing-container-wide fade-in">
                    <h2 className="section-title">Что входит в ведение</h2>
                    <div className="benefits-grid" style={{ marginTop: 48 }}>
                        {BENEFITS.map((b, i) => (
                            <div key={i} className="benefit-card">
                                <div className="benefit-icon">{b.icon}</div>
                                <div className="benefit-title">{b.title}</div>
                                <div className="benefit-text">{b.text}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ОТЗЫВЫ */}
            <section className="bg-section">
                <div className="landing-container-wide fade-in">
                    <h2 className="section-title">Что говорят люди которые уже прошли</h2>
                    <div className="reviews-grid" style={{ marginTop: 48 }}>
                        {REVIEWS.map((r, i) => (
                            <div key={i} className="review-card">
                                <div className="review-result">Результат: {r.result}</div>
                                <div className="review-quote">"</div>
                                <div className="review-text">{r.text}</div>
                                <div className="review-author">{r.author}</div>
                            </div>
                        ))}
                    </div>
                    <p className="reviews-footer">
                        📸 Фотографии до/после и скриншоты из платформы — в Telegram канале<br />
                        <a href="https://t.me/BodyBal" target="_blank" rel="noreferrer">→ t.me/BodyBal</a>
                    </p>
                </div>
            </section>

            {/* URGENCY / ТАЙМЕР */}
            <section>
                <div className="fade-in">
                    <div className="urgency-block">
                        <div className="urgency-label">⚡ Актуальная цена действует</div>
                        <Timer />
                        <div className="urgency-text">
                            Цена растёт по мере того как система доказывает эффективность
                            и растёт очередь на ведение. Текущие условия зафиксированы
                            для тех кто начнёт сейчас.
                        </div>
                    </div>
                </div>
            </section>

            {/* ТАРИФЫ */}
            <section id="pricing" className="bg-section">
                <div className="landing-container-wide fade-in">
                    <h2 className="section-title">Выбери свой формат</h2>
                    <p className="section-subtitle">
                        Все тарифы включают одинаковое наполнение и доступ к платформе.
                        Разница только в сроке и итоговой стоимости месяца.
                    </p>
                    <div className="pricing-grid">
                        {PLANS.map((plan) => (
                            <div key={plan.key} className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
                                {plan.badge && <div className="pricing-badge">{plan.badge}</div>}
                                <div className="pricing-duration">{plan.duration}</div>
                                <div className="pricing-price">{plan.price}</div>
                                <div className="pricing-per-month">{plan.perMonth}</div>
                                <ul className="pricing-features">
                                    {plan.features.map((f, j) => (
                                        <li key={j}>{f}</li>
                                    ))}
                                </ul>
                                <div className="pricing-desc">{plan.desc}</div>
                                <button
                                    onClick={() => handleBuyPlan(plan.key)}
                                    className={`pricing-btn ${plan.featured ? 'primary' : 'secondary'}`}
                                >
                                    Выбрать тариф
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="nutrition-addon">
                        <div>+ Программа питания — 2 ₽ к любому тарифу</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, fontWeight: 400 }}>
                            Это не жёсткая диета, а нормальная схема, которая легко вписывается в привычную жизнь.
                            На тарифе 6 месяцев питание включено в подарок.
                        </div>
                    </div>
                    <p className="pricing-footer">
                        🔒 Безопасная оплата через ЮMoney · Гарантия возврата за 5 дней · Доступ в платформу в течение 24 часов
                    </p>
                </div>
            </section>

            {/* ВОЗРАЖЕНИЯ */}
            <section>
                <div className="landing-container fade-in">
                    <h2 className="section-title">Вопросы которые останавливают</h2>
                    <div style={{ marginTop: 48 }}>
                        {OBJECTIONS.map((o, i) => (
                            <div key={i} className="objection-card">
                                <div className="objection-q">{o.q}</div>
                                <div className="objection-a">{o.a}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ОБО МНЕ */}
            <section className="bg-section">
                <div className="landing-container-wide fade-in">
                    <h2 className="section-title">Почему ты можешь мне доверять</h2>
                    <div className="author-card" style={{ marginTop: 48 }}>
                        <div className="author-avatar">ДМ</div>
                        <div className="author-info">
                            <div className="author-name">Дмитрий Мухин</div>
                            <div className="author-role">Фитнес-тренер · 10 лет практики</div>
                            <p>
                                Работаю с занятыми людьми которые хотят получить результат
                                а не просто ходить в зал. Строю программы на основе актуальных
                                исследований по физиологии и периодизации нагрузок.
                            </p>
                            <p>
                                Мой подход: объясняю почему, а не просто говорю что.
                                За каждым решением стоит конкретная физиологическая причина.
                            </p>
                            <p>
                                Создал собственную платформу MetaSystem для ведения клиентов
                                потому что стандартные инструменты не давали нужного уровня
                                прозрачности и контроля.
                            </p>
                            <a href="https://t.me/BodyBal" target="_blank" rel="noreferrer" className="author-link">
                                → Telegram канал
                            </a>
                        </div>
                    </div>
                    <div className="author-stats">
                        <div>
                            <div className="author-stat-value">10</div>
                            <div className="author-stat-label">лет опыта</div>
                        </div>
                        <div>
                            <div className="author-stat-value">100+</div>
                            <div className="author-stat-label">клиентов</div>
                        </div>
                        <div>
                            <div className="author-stat-value">16 кг</div>
                            <div className="author-stat-label">лучший результат<br />за 4.5 месяца</div>
                        </div>
                        <div>
                            <div className="author-stat-value">0</div>
                            <div className="author-stat-label">шаблонных программ</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="final-cta">
                <div className="final-label">ГОТОВ РАБОТАТЬ СИСТЕМНО?</div>
                <h2 className="section-title" style={{ marginBottom: 24 }}>
                    Хватит топтаться на месте.<br />
                    <span style={{ color: 'var(--accent)' }}>Начни расти.</span>
                </h2>
                <p className="section-subtitle">
                    Первые результаты видны уже через 3–4 недели.
                    Личный кабинет, программа и поддержка в чате с первого дня.
                    Гарантия возврата за 5 дней — риска нет.
                </p>
                <div className="btn-group">
                    <a
                        href="#pricing"
                        className="btn-final"
                        onClick={(e) => { e.preventDefault(); scrollTo('pricing') }}
                    >
                        Выбрать тариф и начать →
                    </a>
                    <a href="https://t.me/dgmukhin_adm" target="_blank" rel="noreferrer" className="btn-outline">
                        Задать вопрос
                    </a>
                </div>
                <p style={{ marginTop: 28, fontSize: 13, color: 'var(--text-muted)' }}>
                    🛡️ Гарантия возврата за 5 дней · Доступ в платформу в течение 24 часов
                </p>
            </section>

            {/* FAQ */}
            <section className="bg-section">
                <div className="landing-container fade-in">
                    <h2 className="section-title">Частые вопросы</h2>
                    <div className="faq-list" style={{ marginTop: 48 }}>
                        {FAQ_ITEMS.map((item, i) => (
                            <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                                <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                    <span>{item.q}</span>
                                    <span className="faq-arrow">↓</span>
                                </div>
                                <div className="faq-a">{item.a}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="landing-footer">
                <div className="landing-footer-inner">
                    <div className="landing-footer-copy">© Дмитрий Мухин · Тренер</div>
                    <div className="landing-footer-links">
                        <a href="https://t.me/BodyBal" target="_blank" rel="noreferrer">Telegram канал</a>
                        <a href="https://t.me/dgmukhin_adm" target="_blank" rel="noreferrer">Написать</a>
                    </div>
                </div>
            </footer>
        </div>
    )
}
