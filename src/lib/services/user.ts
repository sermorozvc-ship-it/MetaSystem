import { createClient, safeGetUser } from '@/lib/supabase/client'

/**
 * Полное удаление данных пользователя
 */
export async function purgeUserData(): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()
    const user = await safeGetUser()

    if (!user) return { success: false, error: 'Пользователь не найден' }

    try {
        console.log('Starting data purge for user:', user.id)

        // 1. Пытаемся удалить файлы в хранилище
        // Для простоты удаляем файлы, которые найдем в корневой папке пользователя
        const { data: files } = await supabase.storage
            .from('day-reports')
            .list(user.id)

        if (files && files.length > 0) {
            const pathsToRemove = files.map(f => `${user.id}/${f.name}`)
            await supabase.storage
                .from('day-reports')
                .remove(pathsToRemove)
            console.log(`Removed ${files.length} items from storage`)
        }

        // 2. Вызываем SQL функцию для очистки таблиц
        const { error: rpcError } = await supabase.rpc('delete_my_data')

        if (rpcError) throw rpcError

        // 3. Выходим из системы
        await supabase.auth.signOut()

        return { success: true }
    } catch (e: any) {
        console.error('Purge error:', e)
        return { success: false, error: e.message }
    }
}
