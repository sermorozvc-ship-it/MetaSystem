/**
 * Универсальная обёртка таймаута для thenable-объектов (Promise или
 * supabase-js билдеров — `.from().select()` thenable, но не Promise).
 *
 * Зачем: Supabase-запросы в браузере могут «висеть» при флапающем
 * интернете / спящей вкладке / медленном RLS. Без таймаута UI-флаг
 * isLoading остаётся true бесконечно — пользователь видит зависший
 * спиннер и вынужден жать F5. Это особенно заметно на десктопе,
 * где вкладки часто оставляют открытыми надолго.
 *
 * Используем во всех клиентских чтениях, влияющих на загрузку страниц.
 *
 * @example
 *   const { data, error } = await withTimeout(
 *     supabase.from('training_entries').select('*'),
 *     'getTrainingEntries',
 *   )
 */
export const DEFAULT_SUPABASE_TIMEOUT_MS = 12_000

export function withTimeout<T>(
    promise: PromiseLike<T>,
    label: string,
    ms: number = DEFAULT_SUPABASE_TIMEOUT_MS,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => {
            reject(new Error(`[supabase] ${label} timeout after ${ms}ms`))
        }, ms)
        Promise.resolve(promise).then(
            (v) => { clearTimeout(t); resolve(v) },
            (e) => { clearTimeout(t); reject(e) },
        )
    })
}
