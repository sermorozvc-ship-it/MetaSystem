import type { UserWithProgress } from '@/lib/services/admin'

const CACHE_TTL_MS = 60_000

let cache: { data: UserWithProgress[]; ts: number } | null = null

export function getAdminClientsCache(): UserWithProgress[] | null {
    if (!cache) return null
    if (Date.now() - cache.ts > CACHE_TTL_MS) {
        cache = null
        return null
    }
    return cache.data
}

export function setAdminClientsCache(data: UserWithProgress[]) {
    cache = { data, ts: Date.now() }
}

export function clearAdminClientsCache() {
    cache = null
}