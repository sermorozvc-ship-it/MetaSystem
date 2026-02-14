'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function DebugPage() {
    const [data, setData] = useState<any>(null)
    const [error, setError] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [envCheck, setEnvCheck] = useState<string>('')

    // Create inside component to be sure
    const supabase = createClient()

    useEffect(() => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        setEnvCheck(url ? `Defined (${url.substring(0, 15)}...)` : 'UNDEFINED')

        const fetch = async () => {
            console.log('Fetching profiles...')
            try {
                const { data: profiles, error } = await supabase.from('profiles').select('*')
                console.log('Fetch done:', profiles, error)
                setData(profiles)
                setError(error)
            } catch (e: any) {
                console.error('Fetch crashed:', e)
                setError({ message: 'Crash: ' + e.message })
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [])

    return (
        <div className="p-10 text-white bg-black min-h-screen">
            <h1 className="text-xl font-bold mb-4">Admin Debug Info V2</h1>

            <div className="mb-4 text-sm text-gray-400">
                Env URL: {envCheck} <br />
                Loading: {loading ? 'TRUE' : 'FALSE'}
            </div>

            <div className="bg-gray-900 p-4 rounded">
                <h2 className="text-yellow-500">Profiles Data:</h2>
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
            </div>

            {(error || (!loading && !data)) && (
                <div className="bg-red-900/20 p-4 rounded mt-4">
                    <h2 className="text-red-500">Errors/Status:</h2>
                    <pre className="text-xs">{JSON.stringify(error, null, 2)}</pre>
                    {!data && !loading && !error && <p>Completed but Data is Empty/Null (and no error?)</p>}
                </div>
            )}
        </div>
    )
}
