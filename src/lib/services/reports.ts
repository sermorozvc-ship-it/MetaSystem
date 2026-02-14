import { createClient } from '@/lib/supabase/client'

export interface ReportFile {
    name: string
    url: string
    type: string
}

export interface DayReport {
    id?: number
    user_id?: string
    day_number: number
    comment?: string
    files: ReportFile[]
    status?: 'pending' | 'approved' | 'rejected'
    curator_comment?: string
    created_at?: string
}

export async function uploadReportFiles(
    dayNumber: number,
    files: File[],
    userId: string
): Promise<ReportFile[]> {
    const supabase = createClient()
    const uploadedFiles: ReportFile[] = []

    for (const file of files) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${userId}/day-${dayNumber}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`

        const { data, error } = await supabase.storage
            .from('day-reports')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            })

        if (error) {
            console.error('Upload error:', error)
            continue
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('day-reports')
            .getPublicUrl(data.path)

        uploadedFiles.push({
            name: file.name,
            url: urlData.publicUrl,
            type: file.type
        })
    }

    return uploadedFiles
}

export async function submitDayReport(
    dayNumber: number,
    files: ReportFile[],
    comment?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // For demo mode without auth, save to localStorage
        const demoReports = JSON.parse(localStorage.getItem('demo_reports') || '[]')
        demoReports.push({
            day_number: dayNumber,
            files,
            comment,
            status: 'pending',
            created_at: new Date().toISOString()
        })
        localStorage.setItem('demo_reports', JSON.stringify(demoReports))
        return { success: true }
    }

    console.log('Submitting report:', { dayNumber, files: files.length, comment: !!comment })

    const { data, error } = await supabase
        .from('day_reports')
        .insert({
            user_id: user.id,
            day_number: dayNumber,
            files,
            comment,
            status: 'pending'
        })
        .select()

    if (error) {
        console.error('Submit error:', error)
        return { success: false, error: error.message }
    }

    console.log('Report submitted successfully:', data)
    return { success: true }
}

export async function getDayReports(dayNumber?: number): Promise<DayReport[]> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // Demo mode - get from localStorage
        const demoReports = JSON.parse(localStorage.getItem('demo_reports') || '[]')
        if (dayNumber) {
            return demoReports.filter((r: DayReport) => r.day_number === dayNumber)
        }
        return demoReports
    }

    let query = supabase
        .from('day_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (dayNumber) {
        query = query.eq('day_number', dayNumber)
    }

    const { data, error } = await query

    if (error) {
        console.error('Fetch error:', error)
        return []
    }

    return data || []
}
