import { createClient, safeGetUser } from '@/lib/supabase/client'

/**
 * Сжатие изображения перед загрузкой
 */
async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<File | Blob> {
    if (!file.type.startsWith('image/')) return file

    return new Promise((resolve) => {
        const reader = new FileReader()
        
        reader.onerror = () => {
            console.warn('FileReader error, returning original file')
            resolve(file)
        }
        
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            
            img.onerror = () => {
                console.warn('Image load error, returning original file')
                resolve(file)
            }
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas')
                    let width = img.width
                    let height = img.height

                    // Ресайз
                    if (width > maxWidth) {
                        height = (maxWidth / width) * height
                        width = maxWidth
                    }

                    canvas.width = width
                    canvas.height = height

                    const ctx = canvas.getContext('2d')
                    ctx?.drawImage(img, 0, 0, width, height)

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(new File([blob], file.name, { type: 'image/jpeg' }))
                            } else {
                                resolve(file)
                            }
                        },
                        'image/jpeg',
                        quality
                    )
                } catch (err) {
                    console.warn('Canvas processing error, returning original file', err)
                    resolve(file)
                }
            }
            
            img.src = event.target?.result as string
        }
    })
}

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

    console.log(`Uploading ${files.length} files for day ${dayNumber}...`)

    for (const file of files) {
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${userId}/day-${dayNumber}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`

            const compressedFile = await compressImage(file)
            console.log(`Compression: ${Math.round(file.size / 1024)}KB -> ${Math.round(compressedFile.size / 1024)}KB`)

            const { data, error } = await supabase.storage
                .from('day-reports')
                .upload(fileName, compressedFile, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (error) {
                console.error('Upload error for file:', file.name, error)
                continue
            }

            const { data: urlData } = supabase.storage
                .from('day-reports')
                .getPublicUrl(data.path)

            uploadedFiles.push({
                name: file.name,
                url: urlData.publicUrl,
                type: compressedFile.type
            })
        } catch (e) {
            console.error('Exception during file upload:', e)
        }
    }

    return uploadedFiles
}

export async function submitDayReport(
    dayNumber: number,
    files: ReportFile[],
    comment?: string,
    explicitUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    // Используем явно переданный userId или пытаемся получить текущего пользователя
    const userId = explicitUserId || (await safeGetUser())?.id

    if (!userId) {
        console.log('No user found, saving to demo mode')
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

    console.log('Submitting report to Supabase:', { dayNumber, filesCount: files.length, userId })

    try {
        const { data, error } = await supabase
            .from('day_reports')
            .insert({
                user_id: userId,
                day_number: dayNumber,
                files,
                comment,
                status: 'pending'
            })
            .select()

        if (error) {
            console.error('Submit error from Supabase:', error)
            return { success: false, error: error.message }
        }

        console.log('Report submitted successfully:', data)
        return { success: true }
    } catch (e: any) {
        console.error('Exception in submitDayReport:', e)
        return { success: false, error: e.message || 'Unknown error' }
    }
}

export async function getDayReports(dayNumber?: number): Promise<DayReport[]> {
    const supabase = createClient()

    const user = await safeGetUser()

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
