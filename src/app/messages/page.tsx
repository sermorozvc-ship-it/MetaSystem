'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, AlertTriangle, Bell, ArrowLeft, CheckCircle, Mail, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'

interface AdminMessage {
    id: number
    from_user_id: string | null
    to_user_id: string
    message: string
    is_read: boolean
    message_type: 'message' | 'warning' | 'announcement'
    created_at: string
}

export default function MessagesPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const [messages, setMessages] = useState<AdminMessage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null)

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth')
            return
        }

        if (user) {
            loadMessages()
        }
    }, [user, authLoading])

    const loadMessages = async () => {
        try {
            const supabase = createClient()

            // Добавляем таймаут чтобы страница не зависала
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 5000)
            )

            const fetchPromise = supabase
                .from('admin_messages')
                .select('*')
                .eq('to_user_id', user?.id)
                .order('created_at', { ascending: false })

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any

            if (error) {
                console.error('Error loading messages:', error)
            } else {
                setMessages(data || [])
            }
        } catch (e) {
            console.error('Messages fetch failed:', e)
        } finally {
            setIsLoading(false)
        }
    }

    const markAsRead = async (messageId: number) => {
        const supabase = createClient()

        await supabase
            .from('admin_messages')
            .update({ is_read: true })
            .eq('id', messageId)

        setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, is_read: true } : m
        ))
    }

    const handleMessageClick = async (msg: AdminMessage) => {
        setSelectedMessage(msg)
        if (!msg.is_read) {
            await markAsRead(msg.id)
        }
    }

    const unreadCount = messages.filter(m => !m.is_read).length

    const getMessageIcon = (type: string) => {
        switch (type) {
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-400" />
            case 'announcement':
                return <Bell className="w-5 h-5 text-blue-400" />
            default:
                return <Mail className="w-5 h-5 text-meta-orange" />
        }
    }

    const getMessageTypeLabel = (type: string) => {
        switch (type) {
            case 'warning':
                return 'Предупреждение'
            case 'announcement':
                return 'Объявление'
            default:
                return 'Сообщение'
        }
    }

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-deep-dark flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-meta-orange border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-deep-dark">
            <Sidebar activeItem="messages" />

            <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="w-10 h-10 rounded-xl bg-deep-dark-200/60 border border-white/10
                                       flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
                                <MessageSquare className="w-5 h-5 md:w-7 md:h-7 text-meta-orange shrink-0" />
                                <span className="truncate">Сообщения от куратора</span>
                            </h1>
                            <p className="text-gray-400 mt-1">
                                {unreadCount > 0
                                    ? `${unreadCount} непрочитанных сообщений`
                                    : 'Все сообщения прочитаны'
                                }
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Messages List */}
                    <div className="glass-card p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Входящие</h2>

                        {messages.length === 0 ? (
                            <div className="text-center py-12">
                                <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-400">У вас пока нет сообщений</p>
                                <p className="text-sm text-gray-500 mt-2">
                                    Здесь будут появляться сообщения от куратора курса
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                                {messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        onClick={() => handleMessageClick(msg)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all ${selectedMessage?.id === msg.id
                                            ? 'bg-meta-orange/10 border border-meta-orange/30'
                                            : 'bg-deep-dark-200/40 border border-white/5 hover:border-white/10'
                                            } ${!msg.is_read ? 'border-l-4 border-l-meta-orange' : ''}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${msg.message_type === 'warning'
                                                ? 'bg-yellow-500/10'
                                                : msg.message_type === 'announcement'
                                                    ? 'bg-blue-500/10'
                                                    : 'bg-meta-orange/10'
                                                }`}>
                                                {getMessageIcon(msg.message_type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-sm font-medium ${msg.message_type === 'warning'
                                                        ? 'text-yellow-400'
                                                        : msg.message_type === 'announcement'
                                                            ? 'text-blue-400'
                                                            : 'text-meta-orange'
                                                        }`}>
                                                        {getMessageTypeLabel(msg.message_type)}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(msg.created_at).toLocaleDateString('ru-RU')}
                                                    </span>
                                                </div>
                                                <p className={`text-sm truncate ${!msg.is_read ? 'text-white font-medium' : 'text-gray-400'
                                                    }`}>
                                                    {msg.message}
                                                </p>
                                            </div>
                                            {!msg.is_read && (
                                                <div className="w-2 h-2 rounded-full bg-meta-orange flex-shrink-0 mt-2" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Message Detail */}
                    <div className="glass-card p-6">
                        {selectedMessage ? (
                            <>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedMessage.message_type === 'warning'
                                            ? 'bg-yellow-500/10'
                                            : selectedMessage.message_type === 'announcement'
                                                ? 'bg-blue-500/10'
                                                : 'bg-meta-orange/10'
                                            }`}>
                                            {getMessageIcon(selectedMessage.message_type)}
                                        </div>
                                        <div>
                                            <h3 className={`font-semibold ${selectedMessage.message_type === 'warning'
                                                ? 'text-yellow-400'
                                                : selectedMessage.message_type === 'announcement'
                                                    ? 'text-blue-400'
                                                    : 'text-meta-orange'
                                                }`}>
                                                {getMessageTypeLabel(selectedMessage.message_type)}
                                            </h3>
                                            <p className="text-sm text-gray-400">
                                                От куратора курса
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedMessage.is_read && (
                                            <span className="flex items-center gap-1 text-xs text-green-400">
                                                <CheckCircle className="w-3 h-3" />
                                                Прочитано
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-deep-dark-200/40 rounded-xl p-4 mb-4">
                                    <p className="text-sm text-gray-400 mb-2">
                                        {new Date(selectedMessage.created_at).toLocaleString('ru-RU', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                    <p className="text-white whitespace-pre-wrap leading-relaxed">
                                        {selectedMessage.message}
                                    </p>
                                </div>

                                {selectedMessage.message_type === 'warning' && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-yellow-200">
                                                Это предупреждение от администрации. Пожалуйста, внимательно ознакомьтесь
                                                с содержанием и примите необходимые меры.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-center py-20">
                                <div>
                                    <Mail className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                                    <p className="text-gray-400">Выберите сообщение для просмотра</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
