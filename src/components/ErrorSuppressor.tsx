'use client'
import { useEffect } from 'react'

export function ErrorSuppressor() {
    useEffect(() => {
        // 1. Suppress Unhandled Rejection
        const handler = (event: PromiseRejectionEvent) => {
            if (
                event.reason?.name === 'AbortError' ||
                event.reason?.message?.includes('aborted') ||
                event.reason?.code === 'PGRST116'
            ) {
                event.preventDefault()
            }
        }

        // 2. Suppress Error Events
        const errorHandler = (event: ErrorEvent) => {
            if (event.error?.name === 'AbortError' || event.error?.message?.includes('aborted')) {
                event.preventDefault()
            }
        }

        // 3. Monkey-patch console.error to stop Next.js Overlay from showing it
        const originalConsoleError = console.error
        console.error = (...args: any[]) => {
            const msg = args[0]
            if (
                typeof msg === 'string' &&
                (msg.includes('AbortError') || msg.includes('signal is aborted'))
            ) {
                // Suppress
                return
            }
            // Also suppress the specific lock error stack trace often printed
            if (args[0] && args[0].stack && args[0].stack.includes('locks.js')) {
                return
            }

            originalConsoleError.apply(console, args)
        }

        window.addEventListener('unhandledrejection', handler)
        window.addEventListener('error', errorHandler)

        return () => {
            console.error = originalConsoleError
            window.removeEventListener('unhandledrejection', handler)
            window.removeEventListener('error', errorHandler)
        }
    }, [])
    return null
}
