/**
 * Полифилл для отключения Web Locks API
 * 
 * Supabase Auth использует navigator.locks для предотвращения race conditions.
 * В React Strict Mode это вызывает AbortError из-за двойного mount компонентов.
 * 
 * Этот файл заменяет navigator.locks на простую реализацию без блокировок.
 * ВАЖНО: Импортировать этот файл ПЕРВЫМ в layout.tsx
 */

if (typeof window !== 'undefined' && navigator) {
    // В некоторых браузерах navigator.locks может быть read-only.
    // Поэтому используем Object.defineProperty если можем
    try {
        if ('locks' in navigator) {
            Object.defineProperty(navigator, 'locks', {
                get: () => ({
                    request: async (
                        _name: any,
                        optionsOrCallback: any,
                        callback?: any
                    ) => {
                        const actualCallback = typeof optionsOrCallback === 'function'
                            ? optionsOrCallback
                            : callback

                        return await actualCallback(null)
                    },
                    query: async () => ({
                        held: [],
                        pending: []
                    })
                })
            })
        }
    } catch (e) {
        console.warn('Failed to polyfill navigator.locks', e)
    }
}

export { }
