/**
 * Полифилл для отключения Web Locks API
 * 
 * Supabase Auth использует navigator.locks для предотвращения race conditions.
 * В React Strict Mode это вызывает AbortError из-за двойного mount компонентов.
 * 
 * Этот файл заменяет navigator.locks на простую реализацию без блокировок.
 * ВАЖНО: Импортировать этот файл ПЕРВЫМ в layout.tsx
 */

if (typeof window !== 'undefined') {
    // Проверяем существует ли navigator.locks
    if (navigator.locks) {
        // Заменяем на реализацию без блокировок
        // @ts-ignore - переопределяем readonly свойство
        navigator.locks = {
            request: async <T>(
                _name: string,
                optionsOrCallback: LockOptions | ((lock: Lock | null) => Promise<T>),
                callback?: (lock: Lock | null) => Promise<T>
            ): Promise<T> => {
                // Определяем какой аргумент является callback
                const actualCallback = typeof optionsOrCallback === 'function'
                    ? optionsOrCallback
                    : callback!

                // Выполняем callback напрямую без блокировки
                // Передаём null вместо реального lock объекта
                return await actualCallback(null)
            },
            query: async (): Promise<LockManagerSnapshot> => ({
                held: [],
                pending: []
            })
        }
    }
}

export { }
