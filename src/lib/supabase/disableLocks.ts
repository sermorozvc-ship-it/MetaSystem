/**
 * Полифилл для отключения Web Locks API
 * 
 * Supabase Auth использует navigator.locks для предотвращения race conditions
 * при обновлении токенов между вкладками.
 * 
 * Проблема: Navigator LockManager может вызывать deadlock, когда несколько
 * компонентов одновременно пытаются получить lock на токен auth.
 * Это приводит к таймауту 10 секунд и каскадной поломке всего приложения.
 * 
 * Решение: Заменяем navigator.locks на реализацию, которая:
 * 1. Не блокирует — каждый запрос выполняется немедленно
 * 2. Корректно обрабатывает AbortSignal (Supabase передаёт его)
 * 3. Передаёт фейковый lock-объект (не null) в callback, как ожидает Supabase
 * 
 * ВАЖНО: Импортировать этот файл ПЕРВЫМ в layout.tsx
 */

if (typeof window !== 'undefined' && navigator) {
    try {
        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            get: () => ({
                request: async (
                    _name: any,
                    optionsOrCallback: any,
                    callback?: any
                ) => {
                    // Supabase может вызвать request(name, callback) или request(name, options, callback)
                    const actualCallback = typeof optionsOrCallback === 'function'
                        ? optionsOrCallback
                        : callback

                    // Если передан options с signal, проверяем не отменён ли запрос
                    if (typeof optionsOrCallback === 'object' && optionsOrCallback?.signal?.aborted) {
                        throw new DOMException('The request was aborted.', 'AbortError')
                    }

                    // Передаём фейковый lock-объект вместо null
                    // Supabase проверяет наличие lock-объекта
                    const fakeLock = {
                        name: typeof _name === 'string' ? _name : 'unknown',
                        mode: 'exclusive' as const
                    }

                    return await actualCallback(fakeLock)
                },
                query: async () => ({
                    held: [],
                    pending: []
                })
            })
        })
    } catch (e) {
        console.warn('Failed to polyfill navigator.locks', e)
    }
}

export { }
