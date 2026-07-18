// MetaSystem — Diary Export
//
// Собирает заполненный клиентом week-N.md в формате, который ждёт training-brain
// (см. https://github.com/dgmuk/training-brain/blob/main/templates/week-diary-input.md).
//
// Ключевые требования формата:
//   1. YAML frontmatter из исходного program_md сохраняется БАЙТ-В-БАЙТ
//      (правило training-program-format.md: фронтматтер не нормализуем).
//   2. Все блоки уровня недели (Рекомендация, Контекст недели, Красные флаги,
//      Резюме/Объём/Самочувствие прошлой недели) переносятся в начало.
//   3. Каждое упражнение: ### Название → [Видео](url) → - **План:** … → - **Подход N:** …
//      → **Альтернативы:** (если есть).
//   4. В конце каждого дня: ### 📊 Статистика сессии + **Самочувствие:**.
//   5. В конце недели: ## 📊 Итоговая статистика недели.

import type {
    TrainingProgram,
    TrainingEntry,
    Exercise,
    TrainingDay,
    AlternativeExercise,
} from '@/lib/services/training'
import { parseCheckinQuestions, formatCheckinAnswers } from '@/lib/utils/checkin-questions'

interface SetData {
    weight?: string | number
    reps?: string | number
    rir?: string | number
    setComment?: string
    label?: 'warmup' | 'heavy' | 'dropset' | null
}

interface ExerciseClientData {
    sets?: SetData[]
    comment?: string
    selectedAlternativeId?: string
    // legacy
    actualWeight?: string | number
    actualReps?: string | number
    rpe?: string | number
}

/**
 * Метаданные клиента для генерации YAML frontmatter, если в исходном
 * program_md его нет. Frontmatter нужен training-brain для однозначной
 * идентификации клиента и недели (см. CLAUDE.md в training-brain).
 */
export interface DiaryMeta {
    /** Полное имя клиента ("Дмитрий Мухин") — для поля client_name */
    clientName?: string | null
    /** UUID или slug клиента из БД — для поля client_id */
    clientId?: string | null
    /** Номер мезоцикла. Если не передан, ставим 1 (минимум 1) */
    mesocycle?: number
    /** Тип недели: standard | calibration | deload */
    type?: 'standard' | 'calibration' | 'deload'
    /**
     * Ответы клиента на чек-ин (из таблицы weekly_checkins).
     * Ключи — текст вопроса как в parseCheckinQuestions.
     * Если передано и ненулевое — добавляется блок "## 💬 Чек-ин клиента"
     * в конец дневника, после "Итоговая статистика недели".
     */
    checkinAnswers?: Record<string, string> | null
}

const RU_TRANSLIT: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
    з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
    я: 'ya',
}

/** Приводит русское имя к slug на латинице, как в clients/index.md training-brain */
function nameToSlug(name: string): string {
    return name
        .toLowerCase()
        .split('')
        .map(ch => RU_TRANSLIT[ch] ?? ch)
        .join('')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
}

/**
 * Извлекает YAML frontmatter из markdown.
 * Возвращает { frontmatter, body } где frontmatter — это полный блок ---...--- с
 * завершающим переводом строки, либо пустая строка если frontmatter не найден.
 */
function splitFrontmatter(md: string): { frontmatter: string; body: string } {
    if (!md) return { frontmatter: '', body: '' }
    // Ищем блок --- ... --- в самом начале (с возможным CRLF)
    const match = md.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/)
    if (!match) return { frontmatter: '', body: md }
    return { frontmatter: match[1], body: match[2] }
}

/**
 * Формирует YAML frontmatter из метаданных программы и клиента.
 * Используется когда в исходном program_md фронтматтера нет (например,
 * тренер создавал программу через текстовый редактор без YAML).
 *
 * Поля и порядок соответствуют training-brain/templates/week-1-calibration.md.
 */
function buildFrontmatter(program: TrainingProgram, meta?: DiaryMeta): string {
    const clientName = meta?.clientName?.trim() || 'Клиент'
    // client_id: либо явный slug, либо транслит имени, либо короткий UUID-prefix
    let clientId = meta?.clientId?.trim() || ''
    if (!clientId && meta?.clientName) clientId = nameToSlug(meta.clientName)
    if (!clientId && program.user_id) clientId = `user-${program.user_id.slice(0, 8)}`
    if (!clientId) clientId = 'unknown'

    const mesocycle = meta?.mesocycle && meta.mesocycle > 0 ? meta.mesocycle : 1
    const type = meta?.type || 'standard'

    const lines = [
        '---',
        `client_id: ${clientId}`,
        `client_name: ${clientName}`,
        `mesocycle: ${mesocycle}`,
        `week: ${program.week_number}`,
        `period_start: ${program.start_date}`,
        `period_end: ${program.end_date}`,
        `type: ${type}`,
        '---',
        '',
    ]
    return lines.join('\n')
}

/**
 * Форматирует целевые веса упражнения в строку для блока **План:**.
 * Кол-во весов = кол-ву сетов. 0 → "0" (собственный вес/калибровка), не "—".
 */
function formatPlanWeights(ex: Exercise | AlternativeExercise, plannedSets: number): string {
    const tw = (ex as Exercise).targetWeights
    if (!tw || tw.length === 0) return ''
    const weights = [...tw]
    // Подгоняем длину под кол-во сетов (повторяем последний / усекаем)
    while (weights.length < plannedSets) weights.push(weights[weights.length - 1] ?? 0)
    weights.length = plannedSets
    const hasAny = weights.some(w => w > 0)
    if (!hasAny) return weights.map(() => '0').join('/') + ' кг'
    return weights.map(w => (Number.isFinite(w) ? String(w) : '0')).join('/') + ' кг'
}

/**
 * Строка факта одного подхода в формате diary-input:
 *   - **Подход N:** {weight} кг × {reps} повт.[ • RIR {rir}][ 🔴 Тяжело][ _(коммент)_]
 * Незаполненный подход → - **Подход N:** — × —
 */
function formatSetLine(idx: number, s: SetData | undefined): string {
    const weight = s?.weight !== undefined && s.weight !== '' ? `${s.weight} кг` : '—'
    const reps = s?.reps !== undefined && s.reps !== '' ? `${s.reps} повт.` : '—'
    const rir = s?.rir !== undefined && s.rir !== '' ? ` • RIR ${s.rir}` : ''
    const labelStr =
        s?.label === 'heavy' ? ' 🔴 Тяжело'
        : s?.label === 'dropset' ? ' 🟣 Дроп-сет'
        : s?.label === 'warmup' ? ' 🔵 Разминка'
        : ''
    const commentStr = s?.setComment ? ` _(${s.setComment})_` : ''
    return `- **Подход ${idx + 1}:** ${weight} × ${reps}${rir}${labelStr}${commentStr}`
}

/**
 * Блок альтернатив для упражнения, в формате week-N-standard:
 *   **Альтернативы:**
 *   - Название | [Видео](url) | N x M-K
 */
function renderAlternatives(ex: Exercise): string[] {
    const alts = ex.alternatives || []
    if (alts.length === 0) return []
    const lines: string[] = ['**Альтернативы:**']
    for (const alt of alts) {
        const parts = [alt.name]
        if (alt.videoUrl) parts.push(`[Видео](${alt.videoUrl})`)
        parts.push(`${alt.sets} x ${alt.reps}`)
        lines.push(`- ${parts.join(' | ')}`)
    }
    return lines
}

/**
 * Один день: заголовок, рекомендация дня, упражнения с фактом, кардио, статистика, самочувствие.
 * Возвращает агрегаты дня для итоговой статистики недели.
 */
function renderDay(
    day: TrainingDay,
    entry: TrainingEntry | undefined,
    out: string[],
): { tonnage: number; exercises: number; sets: number; reps: number; completed: boolean } {
    const completed = !!entry?.completed_at
    out.push(`## День ${day.dayNumber}: ${day.title}${completed ? ' ✅' : ''}`)
    if (day.coachNote) out.push(`**Рекомендация дня:** ${day.coachNote}`)
    if (day.dayContext) {
        out.push('')
        out.push(`**Контекст дня:** ${day.dayContext}`)
    }
    if (day.warmup) {
        out.push('')
        out.push(`**Разминка:** ${day.warmup}`)
    }
    if (day.cooldown) {
        out.push('')
        out.push(`**Заминка:** ${day.cooldown}`)
    }
    out.push('')

    let dayTonnage = 0
    let dayExercises = 0
    let daySets = 0
    let dayReps = 0

    for (const ex of day.exercises) {
        const cd = entry?.entry_data?.[ex.id] as ExerciseClientData | undefined

        // Какое упражнение реально выполнено: основное или альтернатива
        const selectedAlt = cd?.selectedAlternativeId
            ? ex.alternatives?.find(a => a.id === cd.selectedAlternativeId)
            : undefined
        const performedName = selectedAlt ? selectedAlt.name : ex.name
        const performedSets = selectedAlt ? selectedAlt.sets : ex.sets
        const performedReps = selectedAlt ? selectedAlt.reps : ex.reps
        const performedVideo = selectedAlt ? selectedAlt.videoUrl : ex.videoUrl

        out.push(`### ${performedName}${selectedAlt ? ` *(альтернатива к: ${ex.name})*` : ''}`)
        if (performedVideo) out.push(`[Видео](${performedVideo})`)

        // План
        const weightsStr = selectedAlt ? '' : formatPlanWeights(ex, performedSets)
        out.push(`- **План:** ${performedSets} x ${performedReps}${weightsStr ? ` • ${weightsStr}` : ''}`)

        // Факт подходов
        let exerciseHasData = false
        if (cd?.sets && Array.isArray(cd.sets)) {
            const total = Math.max(performedSets, cd.sets.length)
            const filled = cd.sets.filter(s => (s?.weight !== undefined && s.weight !== '') || (s?.reps !== undefined && s.reps !== ''))
            if (filled.length > 0) {
                exerciseHasData = true
                for (let i = 0; i < total; i++) {
                    const s = cd.sets[i]
                    out.push(formatSetLine(i, s))
                    if (s?.label === 'warmup') continue // разминочные не считаем в тоннаж
                    const w = parseFloat(String(s?.weight ?? '')) || 0
                    const r = parseInt(String(s?.reps ?? ''), 10) || 0
                    if (w || r) {
                        dayTonnage += w * r
                        daySets++
                        dayReps += r
                    }
                }
            } else {
                out.push(`- **Факт:** не заполнено`)
            }
        } else if (cd?.actualWeight && cd.actualReps) {
            // legacy формат
            exerciseHasData = true
            const w = parseFloat(String(cd.actualWeight)) || 0
            const r = parseInt(String(cd.actualReps), 10) || 0
            const rpe = cd.rpe ? ` • RPE ${cd.rpe}` : ''
            out.push(`- **Факт:** ${w} кг × ${r} повт.${rpe}`)
            dayTonnage += w * r
            daySets += performedSets
            dayReps += r * performedSets
        } else {
            out.push(`- **Факт:** не заполнено`)
        }

        if (exerciseHasData) dayExercises++
        if (cd?.comment) out.push(`- **Комментарий к упражнению:** ${cd.comment}`)

        // Альтернативы — только если выполнено основное (если выбрана альтернатива, блок не нужен)
        if (!selectedAlt) {
            const altLines = renderAlternatives(ex)
            if (altLines.length > 0) out.push(...altLines)
        }

        out.push('')
    }

    if (day.cardio) {
        out.push(`**Кардио:** ${day.cardio}`)
        out.push('')
    }

    // Статистика сессии
    if (dayExercises > 0) {
        out.push(`### 📊 Статистика сессии`)
        out.push(`| Показатель | Значение |`)
        out.push(`|---|---|`)
        out.push(`| Общий тоннаж | **${dayTonnage.toLocaleString('ru-RU')} кг** |`)
        out.push(`| Упражнений | ${dayExercises} |`)
        out.push(`| Подходов | ${daySets} |`)
        out.push(`| Повторений | ${dayReps} |`)
        out.push('')
    }

    // Самочувствие
    if (entry) {
        out.push(`**Самочувствие:**`)
        out.push(`- Энергия: ${entry.energy_level ?? '—'}/10`)
        out.push(`- Настроение: ${entry.mood ?? '—'}/5`)
        out.push(`- RPE тренировки: ${entry.sleep_quality ?? '—'}/10`)
        if (entry.workout_duration_seconds) {
            const total = entry.workout_duration_seconds
            const h = Math.floor(total / 3600)
            const m = Math.floor((total % 3600) / 60)
            const s = total % 60
            const dur = h > 0
                ? `${h}ч ${m}мин`
                : s > 0 ? `${m}мин ${s}с` : `${m}мин`
            out.push(`- Время тренировки: ${dur}`)
        }
        if (entry.notes) out.push(`- Заметки: ${entry.notes}`)
        if (entry.completed_at) {
            out.push(`- Завершено: ${new Date(entry.completed_at).toLocaleString('ru-RU')}`)
        }
    } else {
        out.push(`**Самочувствие:** не заполнено`)
    }

    out.push('')
    out.push('---')
    out.push('')

    return { tonnage: dayTonnage, exercises: dayExercises, sets: daySets, reps: dayReps, completed }
}

/**
 * Собрать заполненный дневник недели в markdown по формату week-diary-input.md
 * из training-brain.
 *
 * Сохраняет YAML frontmatter из исходного program_md без модификаций.
 * Если frontmatter в program_md отсутствует — генерирует его на основе
 * меты (clientName, clientId, mesocycle, type), чтобы training-brain мог
 * однозначно идентифицировать клиента и неделю.
 */
export function buildDiaryMd(
    program: TrainingProgram,
    entries: TrainingEntry[],
    meta?: DiaryMeta,
): string {
    const { frontmatter } = splitFrontmatter(program.program_md || '')
    const entriesMap = new Map(entries.map(e => [e.day_number, e]))
    const out: string[] = []

    if (frontmatter) {
        // trimEnd чтобы при join('\n') не было двойного перевода после ---
        out.push(frontmatter.trimEnd())
    } else {
        // Frontmatter в исходнике отсутствует — генерируем из меты
        out.push(buildFrontmatter(program, meta).trimEnd())
    }

    out.push(`# Неделя ${program.week_number}`)
    out.push('')
    out.push(`**Период:** ${program.start_date} — ${program.end_date}`)

    const pd = program.program_data
    if (pd?.weeklyNote) {
        out.push('')
        out.push(`**Рекомендация:** ${pd.weeklyNote}`)
    }
    if (pd?.weekContext) {
        out.push('')
        out.push(`**Контекст недели:** ${pd.weekContext}`)
    }
    if (pd?.redFlags) {
        out.push('')
        out.push(`**Красные флаги:** ${pd.redFlags}`)
    }
    if (pd?.weekVolume) {
        out.push('')
        out.push(`**Объём недели:** ${pd.weekVolume}`)
    }
    if (pd?.nutritionNote) {
        out.push('')
        out.push(`**Питание / калории:** ${pd.nutritionNote}`)
    }
    if (pd?.prevWeekStats?.coachSummary) {
        out.push('')
        out.push(`**Резюме прошлой недели:** ${pd.prevWeekStats.coachSummary}`)
    }
    if (pd?.prevWeekStats?.volumeSummary) {
        out.push('')
        out.push(`**Объём прошлой недели:** ${pd.prevWeekStats.volumeSummary}`)
    }
    if (pd?.prevWeekStats?.wellnessSummary) {
        out.push('')
        out.push(`**Самочувствие прошлой недели:** ${pd.prevWeekStats.wellnessSummary}`)
    }
    out.push('')

    const days = pd?.days || []
    if (days.length === 0) {
        // Если структура отсутствует — отдаём program_md как есть (запасной вариант)
        return program.program_md
    }

    // Дни
    let weekTonnage = 0
    let weekExercises = 0
    let weekSets = 0
    let weekReps = 0
    let completedCount = 0

    for (const day of days) {
        const entry = entriesMap.get(day.dayNumber)
        const agg = renderDay(day, entry, out)
        weekTonnage += agg.tonnage
        weekExercises += agg.exercises
        weekSets += agg.sets
        weekReps += agg.reps
        if (agg.completed) completedCount++
    }

    // Итоговая статистика недели
    if (weekExercises > 0 || completedCount > 0) {
        out.push(`## 📊 Итоговая статистика недели`)
        out.push('')
        out.push(`| Показатель | Значение |`)
        out.push(`|---|---|`)
        out.push(`| Общий тоннаж за неделю | **${weekTonnage.toLocaleString('ru-RU')} кг** |`)
        out.push(`| Всего упражнений | ${weekExercises} |`)
        out.push(`| Всего подходов | ${weekSets} |`)
        out.push(`| Всего повторений | ${weekReps} |`)
        out.push(`| Завершено тренировок | ${completedCount}/${days.length} |`)
        out.push('')
    }

    // Алгоритм подбора веса (если был в программе)
    if (pd?.weightAlgorithm) {
        out.push(`## Алгоритм подбора веса`)
        out.push('')
        out.push(pd.weightAlgorithm)
        out.push('')
    }

    // Чек-ин клиента — берём текст вопросов из program_data.checkin
    // и формируем блок ответов из meta.checkinAnswers
    const checkinAnswers = meta?.checkinAnswers
    const checkinSrc = pd?.checkin
    if (checkinAnswers && checkinSrc) {
        const questions = parseCheckinQuestions(checkinSrc)
        const block = formatCheckinAnswers(questions, checkinAnswers)
        if (block) {
            out.push(block)
            out.push('')
        }
    }

    return out.join('\n')
}
