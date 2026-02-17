'use client'
import { useEffect } from 'react'

export function ErrorSuppressor() {
    useEffect(() => {
        // 1. Suppress Unhandled Rejection
        const handler = (event: PromiseRejectionEvent) => {
            const reason = event.reason
            if (
                reason?.name === 'AbortError' ||
                reason?.message?.includes('aborted') ||
                reason?.message?.includes('signal is aborted') ||
                reason?.message?.includes('Auth timeout') ||
                reason?.message?.includes('Failed to fetch') ||
                reason?.message?.includes('NetworkError') ||
                reason?.message?.includes('Load failed') ||
                reason?.code === 'PGRST116'
            ) {
                event.preventDefault()
            }
        }

        // 2. Suppress Error Events
        const errorHandler = (event: ErrorEvent) => {
            if (
                event.error?.name === 'AbortError' ||
                event.error?.message?.includes('aborted') ||
                event.error?.message?.includes('Auth timeout') ||
                event.error?.message?.includes('Failed to fetch') ||
                event.error?.message?.includes('Load failed')
            ) {
                event.preventDefault()
            }
        }

        // 3. Monkey-patch console.error to stop Next.js Overlay from showing it
        const originalConsoleError = console.error
        console.error = (...args: any[]) => {
            const msg = args[0]
            if (
                typeof msg === 'string' &&
                (msg.includes('AbortError') ||
                    msg.includes('signal is aborted') ||
                    msg.includes('Auth timeout') ||
                    msg.includes('Failed to fetch'))
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
