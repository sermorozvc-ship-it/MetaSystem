'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
    ArrowLeft, User, Dumbbell, TrendingUp, FileText, Plus,
    Loader2, Calendar, Upload, X, Check
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isAdmin, getUserDetails } from '@/lib/services/admin'
import { getQuestionnaireByUserId, type ClientQuestionnaire } from '@/lib/services/questionnaire'
import { getClientPrograms, createProgram, type TrainingProgram } from '@/lib/services/training'
import { parseMdToJson, validateProgram, EXAMPLE_PROGRAM_MD } from '@/lib/utils/md-parser'

type Tab = 'questionnaire' | 'programs' | 'metrics'

export default function AdminClientDetailPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const params = useParams()
    const userId = params.userId as string

    const [activeTab, setActiveTab] = useState<Tab>('programs')
    const [isLoading, setIsLoading] = useState(true)
    const [isAdminUser, setIsAdminUser] = useState(false)

    const [clientProfile, setClientProfile] = useState<any>(null)
    const [questionnaire, setQuestionnaire] = useState<ClientQuestionnaire | null>(null)
    const [programs, setPrograms] = useState<TrainingProgram[]>([])

    // Upload program modal
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [programMd, setProgramMd] = useState('')
    const [weekNumber, setWeekNumber] = useState(1)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [trainingDays, setTrainingDays] = useState(3)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth')
        }
    }, [user, authLoading, router])

    useEffect(() => {
        if (!user) return

        const checkAdmin = async () => {
            const admin = await isAdmin(user)
            if (!admin) {
                router.replace('/dashboard')
                return
            }
            setIsAdminUser(true)
        }

        checkAdmin()
    }, [user, router])

    useEffect(() => {
        if (!isAdminUser || !userId) return

        const loadClientData = async () => {
            try {
                const [profile, quest, progs] = await Promise.all([
                    getUserDetails(userId),
                    getQuestionnaireByUserId(userId),
                    getClientPrograms(userId),
                ])

                setClientProfile(profile)
                setQuestionnaire(quest)
                setPrograms(progs)
            } catch (e) {
                console.error('Error loading client data:', e)
            } finally {
                setIsLoading(false)
            }
        }

        loadClientData()
    }, [isAdminUser, userId])

    const handleUploadProgram = async () => {
        setUploadError('')
        setIsUploading(true)

        try {
            // Validate dates
            if (!startDate || !endDate) {
                setUploadError('Укажите даты начала и окончания')
                setIsUploading(false)
                return
            }

            // Parse MD to JSON
            const programData = parseMdToJson(programMd)
            programData.weekNumber = weekNumber
            programData.startDate = startDate
            programData.endDate = endDate

            // Validate
            const validation = validateProgram(programData)
            if (!validation.valid) {
                setUploadError(validation.errors.join(', '))
                setIsUploading(false)
                return
            }

            // Create program
            await createProgram(userId, weekNumber, startDate, endDate, trainingDays, programMd, programData)

            // Reload programs
            const updatedPrograms = await getClientPrograms(userId)
            setPrograms(updatedPrograms)

            // Close modal
            setShowUploadModal(false)
            setProgramMd('')
            setWeekNumber(weekNumber + 1)
        } catch (e: any) {
            console.error('Error uploading program:', e)
            setUploadError(e.message || 'Ошибка загрузки программы')
        } finally {
            setIsUploading(false)
        }
    }

    const loadExampleProgram = () => {
        setProgramMd(EXAMPLE_PROGRAM_MD)
    }

    if (!authLoading && !user) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    if (isLoading || !isAdminUser) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main p-4 py-12">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/admin/clients')}
                            className="glass-button-secondary flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Назад
                        </button>
                        <div>
                            <h1 className="text-3xl font-display font-bold text-white">
                                {clientProfile?.full_name || 'Клиент'}
                            </h1>
                            <p className="text-text-secondary">{clientProfile?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('questionnaire')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                            activeTab === 'questionnaire'
                                ? 'bg-accent text-bg-main'
                                : 'glass-button-secondary text-text-secondary'
                        }`}
                    >
                        <FileText className="w-4 h-4 inline mr-2" />
                        Анкета
                    </button>
                    <button
                        onClick={() => setActiveTab('programs')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                            activeTab === 'programs'
                                ? 'bg-accent text-bg-main'
                                : 'glass-button-secondary text-text-secondary'
                        }`}
                    >
                        <Dumbbell className="w-4 h-4 inline mr-2" />
                        Программы
                    </button>
                    <button
                        onClick={() => setActiveTab('metrics')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                            activeTab === 'metrics'
                                ? 'bg-accent text-bg-main'
                                : 'glass-button-secondary text-text-secondary'
                        }`}
                    >
                        <TrendingUp className="w-4 h-4 inline mr-2" />
                        Метрики
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'questionnaire' && (
                    <div className="glass-card p-8">
                        {questionnaire ? (
                            <div className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-sm text-text-muted">Возраст</label>
                                        <p className="text-white font-semibold">{questionnaire.age || '—'}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-text-muted">Пол</label>
                                        <p className="text-white font-semibold">
                                            {questionnaire.gender === 'male' ? 'Мужской' : 'Женский'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-text-muted">Рост</label>
                                        <p className="text-white font-semibold">{questionnaire.height_cm} см</p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-text-muted">Вес</label>
                                        <p className="text-white font-semibold">{questionnaire.weight_kg} кг</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-text-muted">Цель</label>
                                    <p className="text-white">{questionnaire.goal || '—'}</p>
                                </div>

                                <div>
                                    <label className="text-sm text-text-muted">Опыт тренировок</label>
                                    <p className="text-white">{questionnaire.training_experience || '—'}</p>
                                </div>

                                <div>
                                    <label className="text-sm text-text-muted">Предпочитаемые дни тренировок</label>
                                    <p className="text-white">{questionnaire.preferred_training_days} дней/неделю</p>
                                </div>

                                {questionnaire.injuries && (
                                    <div>
                                        <label className="text-sm text-text-muted">Травмы/ограничения</label>
                                        <p className="text-white">{questionnaire.injuries}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <FileText className="w-16 h-16 text-text-muted mx-auto mb-4" />
                                <p className="text-text-secondary">Анкета не заполнена</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'programs' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-display font-bold text-white">
                                Программы ({programs.length})
                            </h2>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="glass-button flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Загрузить программу
                            </button>
                        </div>

                        {programs.length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <Dumbbell className="w-16 h-16 text-text-muted mx-auto mb-4" />
                                <h3 className="text-xl font-display font-bold text-white mb-2">Программ пока нет</h3>
                                <p className="text-text-secondary mb-6">Загрузите первую программу для клиента</p>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="glass-button flex items-center gap-2 mx-auto"
                                >
                                    <Upload className="w-4 h-4" />
                                    Загрузить программу
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {programs.map((program) => (
                                    <div key={program.id} className="glass-card p-6">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="text-xl font-display font-bold text-white mb-1">
                                                    Неделя {program.week_number}
                                                </h3>
                                                <p className="text-sm text-text-secondary mb-2">
                                                    {new Date(program.start_date).toLocaleDateString('ru-RU')} —{' '}
                                                    {new Date(program.end_date).toLocaleDateString('ru-RU')}
                                                </p>
                                                <p className="text-sm text-text-muted">
                                                    {program.training_days_count} тренировочных дней
                                                </p>
                                            </div>
                                            <div
                                                className={`px-3 py-1 rounded-full ${
                                                    program.status === 'active'
                                                        ? 'bg-accent/20 text-accent'
                                                        : 'bg-bg-elevated text-text-muted'
                                                }`}
                                            >
                                                <span className="text-xs font-semibold">{program.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'metrics' && (
                    <div className="glass-card p-12 text-center">
                        <TrendingUp className="w-16 h-16 text-text-muted mx-auto mb-4" />
                        <p className="text-text-secondary">Метрики будут доступны в следующей фазе</p>
                    </div>
                )}
            </div>

            {/* Upload Program Modal */}
            {showUploadModal && (
                <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
                    <div
                        className="glass-card p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-display font-bold text-white">Загрузить программу</h2>
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="glass-button-secondary p-2"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Номер недели</label>
                                    <input
                                        type="number"
                                        value={weekNumber}
                                        onChange={(e) => setWeekNumber(parseInt(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">
                                        Тренировочных дней
                                    </label>
                                    <input
                                        type="number"
                                        min="2"
                                        max="7"
                                        value={trainingDays}
                                        onChange={(e) => setTrainingDays(parseInt(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Дата начала</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="glass-input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Дата окончания</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="glass-input w-full"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm text-text-secondary">Программа (Markdown)</label>
                                    <button
                                        onClick={loadExampleProgram}
                                        className="text-xs text-accent hover:underline"
                                    >
                                        Загрузить пример
                                    </button>
                                </div>
                                <textarea
                                    value={programMd}
                                    onChange={(e) => setProgramMd(e.target.value)}
                                    className="glass-input w-full h-96 resize-none font-mono text-sm"
                                    placeholder="# Неделя 1&#10;&#10;## День 1: Верх тела&#10;&#10;### Жим гантелей лёжа&#10;- 3 x 10-12&#10;..."
                                />
                            </div>

                            {uploadError && (
                                <div className="p-4 rounded-xl bg-danger/10 border border-danger/30">
                                    <p className="text-sm text-danger">{uploadError}</p>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="glass-button-secondary flex-1"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleUploadProgram}
                                    disabled={isUploading}
                                    className="glass-button flex-1 flex items-center justify-center gap-2"
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Загрузка...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Загрузить
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
