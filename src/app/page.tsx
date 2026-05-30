'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getUserPayment } from '@/lib/services/payment'
import { isQuestionnaireCompleted } from '@/lib/services/questionnaire'
import { isAdminUser } from '@/lib/auth/isAdminUser'

const PAIN_POINTS = [
    {
        emoji: '😤',
        heading: 'Год без результата',
        text: 'Тренируешься больше года, но отражение в зеркале не меняется.',
    },
    {
        emoji: '😴',
        heading: 'Нет сил — нет системы',
        text: 'После работы нет сил, а когда есть — непонятно что делать.',
    },
    {
        emoji: '😕',
        heading: 'Хаос в нагрузке',
        text: 'Непонятно сколько подходов делать и как правильно прогрессировать.',
    },
    {
        emoji: '🤷',
        heading: 'Программы не работают',
        text: 'Пробовал программы из интернета — ни одна не дала результата.',
    },
    {
        emoji: '📉',
        heading: 'Тело меняется не туда',
        text: 'Худеешь — теряешь мышцы. Набираешь — растёт живот, а не мышцы.',
    },
    {
        emoji: '🔄',
        heading: 'Старт с нуля каждые 2 месяца',
        text: 'Мотивация кончается, и всё начинается заново.',
    },
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
        result: 'минус 15 кг за 5 месяцев',
        text: 'Тренировался сам 2 года и почти ничего не добился. С Дмитрием за 5 месяцев убрал живот.',
        author: 'Азиз, 43 года, Мытищи',
        initials: 'АЗ',
        photo: '/case-aziz.jpg',
        details: {
            pointA: {
                label: 'Точка А',
                text: '43 года, вес с лишним жиром на животе, хроническая усталость после работы, сниженный гормональный фон. Тренировался самостоятельно 2 года — результата почти не было.',
            },
            goals: {
                label: 'Запрос',
                items: [
                    'Убрать живот и лишний жир',
                    'Нормализовать гормональный фон',
                    'Повысить уровень энергии и тонус',
                    'Выстроить систему — не просто «ходить в зал»',
                ],
            },
            actions: {
                label: 'Что было сделано',
                items: [
                    'Индивидуальная программа с учётом возраста и гормонального статуса',
                    'Питание с акцентом на белок и контроль калорийности',
                    'Силовые тренировки 3 раза в неделю без перегрузок',
                    'Еженедельная корректировка нагрузки по данным из платформы',
                ],
            },
            pointB: {
                label: 'Точка Б',
                items: [
                    'Минус 15 кг за 5 месяцев',
                    'Живот ушёл, появился рельеф',
                    'Гормональный фон нормализовался',
                    'Уровень энергии вырос — стало хватать и на работу, и на тренировки',
                ],
            },
            challenges: {
                label: 'Сложности',
                items: [
                    'Первые недели — перестройка режима питания после многолетних привычек',
                    'Скептицизм после 2 лет безрезультатных тренировок',
                    'Совмещение тренировок с плотным рабочим графиком',
                ],
            },
        },
    },
    {
        result: 'минус 30 кг за год · жим с 80 до 145 кг',
        text: 'Пришёл к Дмитрию на месяц, остался на год, работаем дальше.',
        author: 'Валерий, 46 лет, Москва · менеджер',
        initials: 'ВА',
        photo: '/case-valeriy.jpg',
        details: {
            pointA: {
                label: 'Точка А',
                text: 'Вес 118 кг, одышка, боли в суставах, высокое давление, низкая выносливость. Быстрая утомляемость, проблемы со сном, отсутствие уверенности в себе.',
            },
            goals: {
                label: 'Запрос',
                items: [
                    'Сбросить лишний вес',
                    'Улучшить здоровье и самочувствие',
                    'Повысить уровень энергии',
                    'Развить силу и выносливость',
                ],
            },
            actions: {
                label: 'Что было сделано',
                items: [
                    'Сбалансированное питание с дефицитом калорий',
                    'Силовые и кардиотренировки 3–4 раза в неделю',
                    'Контроль сна и уровня стресса',
                    'Постепенное увеличение активности',
                ],
            },
            pointB: {
                label: 'Точка Б',
                items: [
                    'Минус 30 кг — вес 88 кг',
                    'Жим лёжа вырос с 80 до 145 кг',
                    'Суставы перестали болеть, давление нормализовалось',
                    'Появилась лёгкость в движении, улучшился сон',
                    'Стал увереннее, сильнее и выносливее',
                ],
            },
            challenges: {
                label: 'Сложности',
                items: [
                    'Первые месяцы — борьба с пищевыми привычками',
                    'Лень и отсутствие мотивации',
                    'Периодические застои в весе',
                ],
            },
        },
    },
    {
        result: 'минус 7 кг · набор сухой массы · 3 месяца',
        text: 'Дима очень помог в плане нормализации питания и выстраивания тренировочного процесса.',
        author: 'Георгий, 32 года, Казань · свой бизнес',
        initials: 'ГЕ',
        photo: '/case-georgiy.jpg',
        details: {
            pointA: {
                label: 'Точка А',
                text: 'Вес 88 кг, скрытый андрогенный дефицит, хроническая усталость, апатия. Вес не менялся несколько лет, сил на тренировки не хватало.',
            },
            goals: {
                label: 'Запрос',
                items: [
                    'Организовать правильное питание',
                    'Сохранить и увеличить мышцы',
                    'Повысить уровень энергии',
                ],
            },
            actions: {
                label: 'Что было сделано',
                items: [
                    'Коррекция питания с упором на белки и полезные жиры',
                    'Силовые тренировки 3 раза в неделю',
                    'Работа с режимом сна и восстановлением',
                    'Контроль гормонального фона',
                ],
            },
            pointB: {
                label: 'Точка Б',
                items: [
                    'Минус 5 кг жира за 2 месяца, последующее увеличение сухой массы',
                    'Сформировал здоровые пищевые привычки',
                    'Увеличил мышечную массу без набора жира',
                    'Почувствовал прилив сил, получил повышение на работе',
                ],
            },
            challenges: {
                label: 'Сложности',
                items: [
                    'Первые недели — усталость и адаптация к новому питанию',
                    'Сомнения, можно ли прогрессировать без жёсткой диеты',
                    'Перестройка привычек потребовала дисциплины',
                ],
            },
        },
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
        base: [
            'Доступ к личному кабинету MetaSystem',
            'Индивидуальная программа тренировок',
            'Еженедельная корректировка (4 раза)',
            'Разбор техники по видео (до 4 раз)',
            'Поддержка в чате весь месяц',
            'Метрики и графики прогресса',
            'Контроль прогресса по итогам месяца',
            'Гарантия возврата за 5 дней',
        ],
        bonuses: [] as string[],
        desc: 'Хорошо подходит для знакомства с системой.',
        featured: false,
        badge: null,
    },
    {
        key: '3_months' as const,
        duration: 'ПРОГРЕСС · 3 месяца',
        price: '6 ₽',
        perMonth: '2 ₽ в месяц (экономия 9 800 ₽)',
        base: [
            'Доступ к личному кабинету MetaSystem',
            'Индивидуальная программа тренировок',
            'Еженедельная корректировка (12 раз)',
            'Разбор техники по видео (до 12 раз)',
            'Поддержка в чате 3 месяца',
            'Метрики и графики прогресса',
            'Контроль прогресса каждый месяц',
            'Гарантия возврата за 5 дней',
        ],
        bonuses: [
            'Пересмотр программы после первого мезоцикла',
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
        base: [
            'Доступ к личному кабинету MetaSystem',
            'Индивидуальная программа тренировок',
            'Еженедельная корректировка (24 раза)',
            'Разбор техники по видео (без ограничений)',
            'Поддержка в чате 6 месяцев',
            'Метрики и графики прогресса',
            'Контроль прогресса каждый месяц',
            'Гарантия возврата за 5 дней',
        ],
        bonuses: [
            'Программа питания включена (3 000 ₽ в подарок)',
            'Приоритетный ответ в чате',
        ],
        desc: 'За 6 месяцев меняется не только тело — меняется привычка тренироваться.',
        featured: false,
        badge: 'МАКСИМАЛЬНЫЙ РЕЗУЛЬТАТ',
    },
]

// Кружок с цифрой в timeline — считает от 0 до target при попадании в viewport
function TimelineDot({ number }: { number: number }) {
    const [displayed, setDisplayed] = useState(0)
    const [animated, setAnimated] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !animated) {
                    setAnimated(true)
                    observer.disconnect()
                    // count-up: 0 → number за ~400ms
                    const steps = number          // шагов = само число (1..6)
                    const duration = 420          // мс
                    const interval = duration / steps
                    let current = 0
                    const tick = setInterval(() => {
                        current += 1
                        setDisplayed(current)
                        if (current >= number) clearInterval(tick)
                    }, interval)
                }
            },
            { threshold: 0.6 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [number, animated])

    return (
        <div
            ref={ref}
            className={`timeline-dot ${animated ? 'timeline-dot-animated' : ''}`}
        >
            {displayed}
        </div>
    )
}

// Блок «осталось мест» — честная альтернатива псевдо-таймеру
// Число мест меняй вручную по мере набора потока
const SPOTS_TOTAL = 5
let SPOTS_LEFT: number = 2

function SpotsBlock() {
    return (
        <div className="urgency-block">
            <div className="urgency-label">🎯 Набор в текущий поток</div>
            <div className="spots-row">
                {Array.from({ length: SPOTS_TOTAL }).map((_, i) => (
                    <div
                        key={i}
                        className={`spot-dot ${i < SPOTS_TOTAL - SPOTS_LEFT ? 'spot-dot-taken' : 'spot-dot-free'}`}
                        title={i < SPOTS_TOTAL - SPOTS_LEFT ? 'Занято' : 'Свободно'}
                    />
                ))}
            </div>
            <div className="urgency-timer" style={{ fontSize: 'clamp(36px, 7vw, 56px)' }}>
                {SPOTS_LEFT} {SPOTS_LEFT === 1 ? 'место' : SPOTS_LEFT < 5 ? 'места' : 'мест'}
            </div>
            <div className="urgency-text">
                Работаю с ограниченным числом клиентов одновременно — это позволяет уделять
                каждому достаточно внимания. Когда поток закрывается, следующий старт
                через 3–4 недели.
            </div>
        </div>
    )
}

// Слайдер кейсов с фото до/после
function CaseSlider() {
    const cases = REVIEWS.filter(r => r.photo)
    const [idx, setIdx] = useState(0)
    const [dir, setDir] = useState<'left' | 'right'>('right')
    const [animating, setAnimating] = useState(false)
    const [openSection, setOpenSection] = useState<string | null>(null)

    const go = (next: number, direction: 'left' | 'right') => {
        if (animating || next === idx) return
        setDir(direction)
        setAnimating(true)
        setOpenSection(null) // сбрасываем аккордеон при смене слайда
        setTimeout(() => {
            setIdx(next)
            setAnimating(false)
        }, 320)
    }

    const prev = () => go((idx - 1 + cases.length) % cases.length, 'left')
    const next = () => go((idx + 1) % cases.length, 'right')

    const r = cases[idx]

    const toggleSection = (key: string) =>
        setOpenSection(prev => prev === key ? null : key)

    return (
        <div className="case-slider">
            <div className={`case-card case-card-anim ${animating ? (dir === 'right' ? 'slide-out-left' : 'slide-out-right') : 'slide-in'}`}>
                <div className="case-photo-wrap">
                    <img
                        src={r.photo!}
                        alt={`До и после — ${r.author}`}
                        className="case-photo"
                    />
                    <div className="case-photo-label">До · После</div>
                </div>
                <div className="case-content">
                    <div className="review-result" style={{ marginBottom: 20 }}>
                        Результат: {r.result}
                    </div>
                    <div className="review-quote">"</div>
                    <div className="review-text">{r.text}</div>

                    {/* Аккордеон с деталями кейса */}
                    {r.details && (
                        <div className="case-accordion">
                            {/* Точка А */}
                            <div className={`case-acc-item ${openSection === 'pointA' ? 'open' : ''}`}>
                                <button
                                    type="button"
                                    className="case-acc-btn"
                                    onClick={() => toggleSection('pointA')}
                                    aria-expanded={openSection === 'pointA'}
                                >
                                    <span className="case-acc-icon">📍</span>
                                    <span>{r.details.pointA.label}</span>
                                    <span className="case-acc-arrow">↓</span>
                                </button>
                                <div className="case-acc-body">
                                    <p className="case-acc-text">{r.details.pointA.text}</p>
                                </div>
                            </div>

                            {/* Запрос */}
                            <div className={`case-acc-item ${openSection === 'goals' ? 'open' : ''}`}>
                                <button
                                    type="button"
                                    className="case-acc-btn"
                                    onClick={() => toggleSection('goals')}
                                    aria-expanded={openSection === 'goals'}
                                >
                                    <span className="case-acc-icon">🎯</span>
                                    <span>{r.details.goals.label}</span>
                                    <span className="case-acc-arrow">↓</span>
                                </button>
                                <div className="case-acc-body">
                                    <ul className="case-acc-list">
                                        {r.details.goals.items.map((item, i) => <li key={i}>{item}</li>)}
                                    </ul>
                                </div>
                            </div>

                            {/* Что сделано */}
                            <div className={`case-acc-item ${openSection === 'actions' ? 'open' : ''}`}>
                                <button
                                    type="button"
                                    className="case-acc-btn"
                                    onClick={() => toggleSection('actions')}
                                    aria-expanded={openSection === 'actions'}
                                >
                                    <span className="case-acc-icon">⚙️</span>
                                    <span>{r.details.actions.label}</span>
                                    <span className="case-acc-arrow">↓</span>
                                </button>
                                <div className="case-acc-body">
                                    <ul className="case-acc-list">
                                        {r.details.actions.items.map((item, i) => <li key={i}>{item}</li>)}
                                    </ul>
                                </div>
                            </div>

                            {/* Точка Б */}
                            <div className={`case-acc-item ${openSection === 'pointB' ? 'open' : ''}`}>
                                <button
                                    type="button"
                                    className="case-acc-btn"
                                    onClick={() => toggleSection('pointB')}
                                    aria-expanded={openSection === 'pointB'}
                                >
                                    <span className="case-acc-icon">✅</span>
                                    <span>{r.details.pointB.label}</span>
                                    <span className="case-acc-arrow">↓</span>
                                </button>
                                <div className="case-acc-body">
                                    <ul className="case-acc-list accent">
                                        {r.details.pointB.items.map((item, i) => <li key={i}>{item}</li>)}
                                    </ul>
                                </div>
                            </div>

                            {/* Сложности */}
                            <div className={`case-acc-item ${openSection === 'challenges' ? 'open' : ''}`}>
                                <button
                                    type="button"
                                    className="case-acc-btn"
                                    onClick={() => toggleSection('challenges')}
                                    aria-expanded={openSection === 'challenges'}
                                >
                                    <span className="case-acc-icon">⚡</span>
                                    <span>{r.details.challenges.label}</span>
                                    <span className="case-acc-arrow">↓</span>
                                </button>
                                <div className="case-acc-body">
                                    <ul className="case-acc-list">
                                        {r.details.challenges.items.map((item, i) => <li key={i}>{item}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="review-author-row" style={{ marginTop: 24 }}>
                        <div className="review-avatar">{r.initials}</div>
                        <div className="review-author">{r.author}</div>
                    </div>
                </div>
            </div>

            {/* Навигация */}
            {cases.length > 1 && (
                <div className="case-slider-nav">
                    <button type="button" className="case-slider-btn" onClick={prev} aria-label="Предыдущий кейс">←</button>
                    <div className="case-slider-dots">
                        {cases.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                className={`case-slider-dot ${i === idx ? 'active' : ''}`}
                                onClick={() => go(i, i > idx ? 'right' : 'left')}
                                aria-label={`Кейс ${i + 1}`}
                            />
                        ))}
                    </div>
                    <button type="button" className="case-slider-btn" onClick={next} aria-label="Следующий кейс">→</button>
                </div>
            )}
        </div>
    )
}

// Универсальный count-up с easeOut — резкий старт, замедление к концу
// target: конечное число, suffix: «+», « кг», «%» и т.п.
// duration: мс (по умолчанию 900)
function CountUp({ target, suffix = '', duration = 900 }: { target: number; suffix?: string; duration?: number }) {
    const [value, setValue] = useState(0)
    const [started, setStarted] = useState(false)
    const ref = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !started) {
                    setStarted(true)
                    observer.disconnect()

                    const startTime = performance.now()
                    const tick = (now: number) => {
                        const elapsed = now - startTime
                        const progress = Math.min(elapsed / duration, 1)
                        // easeOutExpo — резкий старт, плавное торможение
                        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
                        setValue(Math.round(eased * target))
                        if (progress < 1) requestAnimationFrame(tick)
                    }
                    requestAnimationFrame(tick)
                }
            },
            { threshold: 0.5 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [target, duration, started])

    return (
        <span ref={ref}>
            {value}{suffix}
        </span>
    )
}

export default function LandingPage() {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const [openFaq, setOpenFaq] = useState<Set<number>>(new Set())
    const [scrolled, setScrolled] = useState(false)
    const [redirecting, setRedirecting] = useState(false)
    const [showStickyCta, setShowStickyCta] = useState(false)

    // Авторизованный редирект (если не отключён dev-флагом или preview-режимом)
    // Используем ref чтобы не перезапускать при каждом рендере
    const redirected = useRef(false)
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_DISABLE_REDIRECTS === 'true') return
        // ?preview=1 — позволяет просматривать лендинг будучи авторизованным
        const params = new URLSearchParams(window.location.search)
        if (params.get('preview') === '1') return
        if (!isLoading && user && !redirected.current) {
            redirected.current = true
            setRedirecting(true)
            const check = async () => {
                try {
                    // Проверяем роль — админ идёт в /admin
                    if (isAdminUser(user)) {
                        router.replace('/admin')
                        return
                    }

                    const payment = await getUserPayment()
                    if (!payment || payment.status !== 'confirmed') {
                        router.replace('/payment')
                        return
                    }
                    const done = await isQuestionnaireCompleted()
                    if (!done) {
                        router.replace('/questionnaire')
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
                                router.replace('/questionnaire/nutrition')
                                return
                            }
                        }
                    } catch {}
                    router.replace('/dashboard')
                } catch {
                    router.replace('/payment')
                }
            }
            check()
        }
    }, [user, isLoading, router])

    // Sticky navbar background + sticky CTA на мобиле
    // Используем rAF-throttle чтобы не вызывать setState на каждый scroll-event
    useEffect(() => {
        let rafId = 0
        let prevScrolled = false
        let prevSticky = false

        const onScroll = () => {
            if (rafId) return
            rafId = requestAnimationFrame(() => {
                rafId = 0
                const y = window.scrollY
                const nextScrolled = y > 50
                const docHeight = document.documentElement.scrollHeight - window.innerHeight
                const nearBottom = docHeight > 0 && y > docHeight - 120
                const nextSticky = y > window.innerHeight * 0.6 && !nearBottom

                // setState только при реальном изменении — нет лишних ре-рендеров
                if (nextScrolled !== prevScrolled) {
                    prevScrolled = nextScrolled
                    setScrolled(nextScrolled)
                }
                if (nextSticky !== prevSticky) {
                    prevSticky = nextSticky
                    setShowStickyCta(nextSticky)
                }
            })
        }

        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            window.removeEventListener('scroll', onScroll)
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [])

    // Fade-in on scroll через IntersectionObserver
    // Без setTimeout — observer стартует сразу после mount,
    // элементы уже в viewport сразу получают класс visible
    useEffect(() => {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReduced) {
            // Сразу показываем всё без анимации
            document.querySelectorAll('.fade-in').forEach((el) => el.classList.add('visible'))
            return
        }

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
        return () => observer.disconnect()
    }, [])

    const handleBuyPlan = (_planKey: string) => {
        // Раньше тариф сохранялся в sessionStorage и пользователь шёл сразу
        // на /payment — но без аккаунта, что приводило к двойному показу
        // /payment (до и после регистрации). Теперь любой клик по тарифу
        // ведёт на информационную страницу /get-started, где пользователь
        // регистрируется и уже после этого попадает на /payment один раз.
        router.push('/get-started')
    }

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
        // Обновляем hash в адресной строке — пользователь может шарить ссылку
        if (typeof window !== 'undefined') {
            history.replaceState(null, '', id === 'top' ? window.location.pathname : `#${id}`)
        }
    }

    return (
        <div className="landing-root">
            {/* Плавный оверлей при редиректе авторизованного пользователя */}
            {redirecting && (
                <div className="landing-redirect-overlay" role="status" aria-live="polite">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    <span className="landing-redirect-text">Загружаем твой кабинет…</span>
                </div>
            )}

            {/* NAVBAR */}
            <nav className={`landing-navbar ${scrolled ? 'scrolled' : ''}`}>
                <div className="landing-nav-inner">
                    <a href="#" className="landing-logo" onClick={(e) => { e.preventDefault(); scrollTo('top') }}>
                        <div className="landing-logo-mark">
                            <img
                                src="/trainer.jpg"
                                alt="Дмитрий Мухин"
                                className="landing-logo-photo"
                                onError={(e) => {
                                    const img = e.currentTarget
                                    img.style.display = 'none'
                                    const fb = img.nextElementSibling as HTMLElement | null
                                    if (fb) fb.style.display = 'flex'
                                }}
                            />
                            <span className="landing-logo-fallback">ДМ</span>
                        </div>
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
                    <span>Программа с первого дня</span>
                    <span>Корректировка каждую неделю</span>
                    <span>Личный кабинет с метриками</span>
                    <span>Результат или деньги назад</span>
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
                <p className="hero-login">
                    Уже есть аккаунт?{' '}
                    <a
                        href="/auth?mode=login"
                        onClick={(e) => { e.preventDefault(); router.push('/auth?mode=login') }}
                    >
                        Войти →
                    </a>
                </p>
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
                                <div className="pain-card-emoji">{p.emoji}</div>
                                <div className="pain-card-heading">{p.heading}</div>
                                <div className="pain-card-text">{p.text}</div>
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

                    {/* Mockup-кадры платформы */}
                    <div className="platform-mockups">
                        {/* Кадр 1: Программа недели */}
                        <div className="mockup-card">
                            <div className="mockup-topbar">
                                <div className="mockup-dot" /><div className="mockup-dot" /><div className="mockup-dot" />
                                <span className="mockup-url">metasystem.fit/dashboard</span>
                            </div>
                            <div className="mockup-body">
                                <div className="mockup-label">📋 Программа · Неделя 4</div>
                                <div className="mockup-week-row">
                                    {['Пн', 'Ср', 'Пт'].map((d, i) => (
                                        <div key={d} className={`mockup-day ${i < 2 ? 'done' : 'active'}`}>
                                            <span className="mockup-day-name">{d}</span>
                                            <span className="mockup-day-icon">{i < 2 ? '✓' : '▶'}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mockup-exercise-list">
                                    {['Жим лёжа · 4×8 · 80 кг', 'Тяга верхнего блока · 3×10', 'Разводка гантелей · 3×12'].map((ex) => (
                                        <div key={ex} className="mockup-exercise-row">
                                            <div className="mockup-exercise-dot" />
                                            <span>{ex}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mockup-caption">Программа недели</div>
                        </div>

                        {/* Кадр 2: Метрики */}
                        <div className="mockup-card">
                            <div className="mockup-topbar">
                                <div className="mockup-dot" /><div className="mockup-dot" /><div className="mockup-dot" />
                                <span className="mockup-url">metasystem.fit/metrics</span>
                            </div>
                            <div className="mockup-body">
                                <div className="mockup-label">📊 Метрики · Динамика веса</div>
                                <div className="mockup-chart">
                                    {[82, 81.2, 80.5, 79.8, 79.1, 78.6, 78.0].map((v, i) => (
                                        <div
                                            key={i}
                                            className="mockup-bar"
                                            style={{ height: `${((v - 77) / 6) * 100}%` }}
                                            title={`${v} кг`}
                                        />
                                    ))}
                                </div>
                                <div className="mockup-chart-labels">
                                    <span>Нед 1</span><span>Нед 4</span><span>Нед 7</span>
                                </div>
                                <div className="mockup-metric-row">
                                    <span className="mockup-metric-val">−4 кг</span>
                                    <span className="mockup-metric-sub">за 7 недель</span>
                                </div>
                            </div>
                            <div className="mockup-caption">График прогресса</div>
                        </div>

                        {/* Кадр 3: Чат */}
                        <div className="mockup-card">
                            <div className="mockup-topbar">
                                <div className="mockup-dot" /><div className="mockup-dot" /><div className="mockup-dot" />
                                <span className="mockup-url">metasystem.fit/messages</span>
                            </div>
                            <div className="mockup-body">
                                <div className="mockup-label">💬 Чат с тренером</div>
                                <div className="mockup-chat">
                                    <div className="mockup-msg trainer">Программа на неделю загружена. Жим начинаем с 75 кг — не форсируй.</div>
                                    <div className="mockup-msg client">Сделал тренировку, всё внёс. Жим пошёл легче!</div>
                                    <div className="mockup-msg trainer">Вижу данные — отлично. На следующей неделе добавим 2.5 кг.</div>
                                </div>
                            </div>
                            <div className="mockup-caption">Чат с тренером</div>
                        </div>

                        {/* Кадр 4: Ввод данных */}
                        <div className="mockup-card">
                            <div className="mockup-topbar">
                                <div className="mockup-dot" /><div className="mockup-dot" /><div className="mockup-dot" />
                                <span className="mockup-url">metasystem.fit/programs</span>
                            </div>
                            <div className="mockup-body">
                                <div className="mockup-label">⚡ Ввод результатов</div>
                                <div className="mockup-input-rows">
                                    {[
                                        { ex: 'Жим лёжа', sets: '4', reps: '8', kg: '80' },
                                        { ex: 'Тяга блока', sets: '3', reps: '10', kg: '65' },
                                    ].map((row) => (
                                        <div key={row.ex} className="mockup-input-row">
                                            <span className="mockup-input-name">{row.ex}</span>
                                            <div className="mockup-input-fields">
                                                <div className="mockup-input-field">{row.sets}<span>подх</span></div>
                                                <div className="mockup-input-field">{row.reps}<span>повт</span></div>
                                                <div className="mockup-input-field accent">{row.kg}<span>кг</span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mockup-save-btn">✓ Сохранено автоматически</div>
                            </div>
                            <div className="mockup-caption">Ввод данных тренировки</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* СРАВНЕНИЕ */}
            <section>
                <div className="landing-container-wide fade-in">
                    <h2 className="section-title">Как я работаю и в чём заключаются основные отличия</h2>

                    {/* Десктоп: обычная таблица */}
                    <div className="compare-table compare-table-desktop" style={{ marginTop: 48 }}>
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

                    {/* Мобайл: стек карточек bad → стрелка → good */}
                    <div className="compare-mobile" style={{ marginTop: 32 }}>
                        {COMPARE_ROWS.map(([bad, good], i) => (
                            <div key={i} className="compare-mobile-pair">
                                <div className="compare-mobile-bad">❌ {bad}</div>
                                <div className="compare-mobile-arrow" aria-hidden="true">↓</div>
                                <div className="compare-mobile-good">✅ {good}</div>
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
                                <TimelineDot number={i + 1} />
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

            {/* КЕЙСЫ / ОТЗЫВЫ */}
            <section className="bg-section">
                <div className="landing-container-wide fade-in">
                    <h2 className="section-title">Что говорят люди которые уже прошли</h2>

                    {/* Слайдер кейсов с фото */}
                    <div style={{ marginTop: 48 }}>
                        <CaseSlider />
                    </div>

                    <p className="reviews-footer">
                        📸 Фотографии до/после и скриншоты из платформы — в Telegram канале<br />
                        <a href="https://t.me/BodyBal" target="_blank" rel="noreferrer">→ t.me/BodyBal</a>
                    </p>
                </div>
            </section>

            {/* URGENCY / МЕСТА */}
            <section>
                <div className="fade-in">
                    <SpotsBlock />
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

                                {/* Базовые фичи */}
                                <div className="pricing-group-label">Что входит каждый месяц</div>
                                <ul className="pricing-features">
                                    {plan.base.map((f, j) => (
                                        <li key={j}>{f}</li>
                                    ))}
                                </ul>

                                {/* Бонусы — только если есть */}
                                {plan.bonuses.length > 0 && (
                                    <>
                                        <div className="pricing-group-label pricing-group-label-bonus">Бонусы</div>
                                        <ul className="pricing-features pricing-features-bonus">
                                            {plan.bonuses.map((b, j) => (
                                                <li key={j}>{b}</li>
                                            ))}
                                        </ul>
                                    </>
                                )}

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
                        🔒 Безопасная оплата через Продамус · Гарантия возврата за 5 дней · Доступ в платформу в течение 24 часов
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
                        <div className="author-avatar-photo">
                            {/* Положи фото в public/trainer.jpg */}
                            <img
                                src="/trainer.jpg"
                                alt="Дмитрий Мухин — фитнес-тренер"
                                className="author-photo-img"
                                onError={(e) => {
                                    // fallback на инициалы если фото не загрузилось
                                    const t = e.currentTarget
                                    t.style.display = 'none'
                                    const fb = t.nextElementSibling as HTMLElement | null
                                    if (fb) fb.style.display = 'flex'
                                }}
                            />
                            <div className="author-photo-fallback" style={{ display: 'none' }}>ДМ</div>
                        </div>
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
                            <div className="author-stat-value">
                                <CountUp target={10} duration={700} />
                            </div>
                            <div className="author-stat-label">лет опыта</div>
                        </div>
                        <div>
                            <div className="author-stat-value">
                                <CountUp target={100} suffix="+" duration={900} />
                            </div>
                            <div className="author-stat-label">клиентов</div>
                        </div>
                        <div>
                            <div className="author-stat-value">
                                <CountUp target={16} suffix=" кг" duration={800} />
                            </div>
                            <div className="author-stat-label">лучший результат<br />за 4.5 месяца</div>
                        </div>
                        <div>
                            <div className="author-stat-value">
                                <CountUp target={100} suffix="%" duration={900} />
                            </div>
                            <div className="author-stat-label">индивидуальных<br />программ</div>
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
                        Начать прямо сейчас →
                    </a>
                    <a href="https://t.me/dgmukhin_adm" target="_blank" rel="noreferrer" className="btn-outline">
                        Задать вопрос
                    </a>
                </div>
                {/* Бейдж-гарантия */}
                <div className="guarantee-badge">
                    <div className="guarantee-badge-seal">🛡️</div>
                    <div className="guarantee-badge-text">
                        <div className="guarantee-badge-title">Гарантия возврата</div>
                        <div className="guarantee-badge-sub">Если за 5 дней не устроит — верну деньги полностью. Без вопросов.</div>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="bg-section">
                <div className="landing-container fade-in">
                    <h2 className="section-title">Частые вопросы</h2>
                    <div className="faq-list" style={{ marginTop: 48 }}>
                        {FAQ_ITEMS.map((item, i) => {
                            const isOpen = openFaq.has(i)
                            const panelId = `faq-panel-${i}`
                            const buttonId = `faq-btn-${i}`
                            return (
                                <div key={i} className={`faq-item ${isOpen ? 'open' : ''}`}>
                                    <button
                                        type="button"
                                        id={buttonId}
                                        className="faq-q"
                                        aria-expanded={isOpen}
                                        aria-controls={panelId}
                                        onClick={() =>
                                            setOpenFaq((prev) => {
                                                const next = new Set(prev)
                                                if (next.has(i)) next.delete(i)
                                                else next.add(i)
                                                return next
                                            })
                                        }
                                    >
                                        <span>{item.q}</span>
                                        <span className="faq-arrow" aria-hidden="true">↓</span>
                                    </button>
                                    <div
                                        id={panelId}
                                        role="region"
                                        aria-labelledby={buttonId}
                                        className="faq-a"
                                    >
                                        {item.a}
                                    </div>
                                </div>
                            )
                        })}
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

            {/* Мобильный sticky CTA — показываем после первого экрана */}
            <div
                className={`landing-sticky-cta ${showStickyCta ? 'visible' : ''}`}
                aria-hidden={!showStickyCta}
            >
                <div className="landing-sticky-cta-inner">
                    <div className="landing-sticky-cta-text">
                        <div className="landing-sticky-cta-title">Готов начать?</div>
                        <div className="landing-sticky-cta-sub">Гарантия возврата за 5 дней</div>
                    </div>
                    <button
                        type="button"
                        className="landing-sticky-cta-btn"
                        onClick={() => scrollTo('pricing')}
                    >
                        Выбрать тариф →
                    </button>
                </div>
            </div>
        </div>
    )
}
