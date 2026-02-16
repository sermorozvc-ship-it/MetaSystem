'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, AlertTriangle, Bell, ArrowLeft, CheckCircle, Mail, X, CheckCheck, ExternalLink, Send } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import { getConversation, sendReply } from '@/lib/services/messages'

interface AdminMessage {
    id: number
    from_user_id: string | null
    to_user_id: string
    message: string
    is_read: boolean
    message_type: 'message' | 'warning' | 'announcement'
    created_at: string
}

// Демо-сообщения для показа при отсутствии реальных данных
const demoMessages: AdminMessage[] = [
    {
        id: 1,
        from_user_id: null,
        to_user_id: 'demo',
        message: 'Добро пожаловать в программу «Метаболический Запуск»! 🔥\n\nЯ ваш куратор и буду помогать вам на протяжении всего курса. Если у вас возникнут вопросы — пишите сюда, я отвечу в течение 24 часов.\n\nУспешного старта!',
        is_read: false,
        message_type: 'message',
        created_at: new Date().toISOString()
    },
    {
        id: 2,
        from_user_id: null,
        to_user_id: 'demo',
        message: '📢 Важное обновление: добавлен новый калькулятор висцерального жира!\n\nТеперь вы можете отслеживать свой WHR и WHtR прямо в приложении. Инструмент доступен в задании Дня 1.',
        is_read: true,
        message_type: 'announcement',
        created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
        id: 3,
        from_user_id: null,
        to_user_id: 'demo',
        message: 'Напоминание: не забудьте отправить отчёт за день 1!\n\nПришлите:\n1. Скриншот результата калькулятора\n2. Фото продуктового набора\n\nЭто поможет мне оценить ваш прогресс.',
        is_read: true,
        message_type: 'warning',
        created_at: new Date(Date.now() - 172800000).toISOString()
    }
]

export default function MessagesPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const [messages, setMessages] = useState<AdminMessage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null)
    const [replyText, setReplyText] = useState('')
    const [isSending, setIsSending] = useState(false)

    useEffect(() => {
        if (authLoading) return
        loadMessages()
    }, [user, authLoading])

    const loadMessages = async () => {
        try {
            if (!user) {
                // Демо-режим — показываем демо-сообщения
                const stored = localStorage.getItem('demo_messages')
                if (stored) {
                    setMessages(JSON.parse(stored))
                } else {
                    localStorage.setItem('demo_messages', JSON.stringify(demoMessages))
                    setMessages(demoMessages)
                }
                setIsLoading(false)
                return
            }

            const data = await getConversation(user.id)
            setMessages(data && data.length > 0 ? data : demoMessages)
        } catch (e) {
            console.error('Messages fetch failed:', e)
            setMessages(demoMessages)
        } finally {
            setIsLoading(false)
        }
    }

    const markAsRead = async (messageId: number) => {
        if (!user) {
            // Демо-режим
            const updated = messages.map(m =>
                m.id === messageId ? { ...m, is_read: true } : m
            )
            setMessages(updated)
            localStorage.setItem('demo_messages', JSON.stringify(updated))
            return
        }

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
        if (!msg.is_read && msg.to_user_id === user?.id) {
            await markAsRead(msg.id)
        }
    }

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedMessage || !user) return

        setIsSending(true)
        try {
            // Who are we replying to?
            // If the message was FROM us, we still reply to the curator
            const recipientId = selectedMessage.from_user_id || selectedMessage.to_user_id

            // Avoid replying to ourselves
            // Find the curator ID from existing messages or fallback to default
            let finalRecipientId = recipientId

            if (recipientId === user.id) {
                // If the selected message is from us/to us, find the first message from a curator
                const curatorMsg = messages.find(m => m.from_user_id && m.from_user_id !== user.id)
                finalRecipientId = curatorMsg?.from_user_id || '3c07b01d-29e6-47c7-b533-f722f752e4b3'
            }

            const result = await sendReply(finalRecipientId as string, replyText.trim())

            if (result.success) {
                setReplyText('')
                await loadMessages() // Refresh conversation
            }
        } finally {
            setIsSending(false)
        }
    }

    const markAllAsRead = async () => {
        if (messages.every(m => m.is_read)) return

        setIsLoading(true)
        try {
            if (!user) {
                const updated = messages.map(m => ({ ...m, is_read: true }))
                setMessages(updated)
                localStorage.setItem('demo_messages', JSON.stringify(updated))
            } else {
                const supabase = createClient()
                await supabase
                    .from('admin_messages')
                    .update({ is_read: true })
                    .eq('to_user_id', user.id)
                    .eq('is_read', false)

                setMessages(prev => prev.map(m => ({ ...m, is_read: true })))
            }
        } finally {
            setIsLoading(false)
        }
    }

    const unreadCount = messages.filter(m => !m.is_read && m.to_user_id === user?.id).length

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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-10">
                    <div className="flex items-center gap-3 md:gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-10 h-10 rounded-xl bg-deep-dark-200/60 border border-white/10
                                       flex items-center justify-center text-gray-400 hover:text-white 
                                       hover:bg-deep-dark-300 transition-all duration-200 group"
                        >
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <h1 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2 md:gap-3">
                                <MessageSquare className="w-6 h-6 md:w-8 md:h-8 text-meta-orange shrink-0" />
                                <span className="truncate">Сообщения</span>
                            </h1>
                            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-meta-orange inline-block" />
                                {unreadCount > 0
                                    ? unreadCount === 1 ? '1 новое сообщение' : `${unreadCount} новых сообщения`
                                    : 'Все сообщения прочитаны'
                                }
                            </p>
                        </div>
                    </div>

                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl
                                     bg-white/5 border border-white/10 text-sm text-gray-300
                                     hover:bg-white/10 hover:text-white transition-all duration-200"
                        >
                            <CheckCheck className="w-4 h-4" />
                            Прочитать все
                        </button>
                    )}
                </div>

                {/* Mobile: Message Detail Overlay */}
                {selectedMessage && (
                    <div className="lg:hidden fixed inset-0 z-[60] bg-black/80 backdrop-blur-md" onClick={() => setSelectedMessage(null)}>
                        <div
                            className="absolute bottom-0 left-0 right-0 bg-deep-dark-100 border-t border-white/10 rounded-t-[2.5rem] max-h-[85vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="sticky top-0 bg-deep-dark-100/90 backdrop-blur-sm rounded-t-[2.5rem] z-10 px-6 pt-8 pb-4 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white">Просмотр</h3>
                                <button
                                    onClick={() => setSelectedMessage(null)}
                                    className="w-10 h-10 rounded-full bg-deep-dark-300 flex items-center justify-center text-gray-400"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="px-6 pb-24">
                                <MessageDetail
                                    message={selectedMessage}
                                    getMessageIcon={getMessageIcon}
                                    getMessageTypeLabel={getMessageTypeLabel}
                                    user={user}
                                    replyText={replyText}
                                    setReplyText={setReplyText}
                                    onSend={handleSendReply}
                                    isSending={isSending}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Messages List */}
                    <div className="lg:col-span-5 xl:col-span-4 glass-card overflow-hidden h-fit">
                        <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Входящие</h2>
                            <span className="text-xs bg-meta-orange/20 text-meta-orange px-2 py-1 rounded-full">{messages.length}</span>
                        </div>

                        <div className="p-2 space-y-1 max-h-[65vh] overflow-y-auto custom-scrollbar">
                            {messages.length === 0 ? (
                                <div className="text-center py-20 px-4">
                                    <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                                        <Mail className="w-8 h-8 text-gray-600" />
                                    </div>
                                    <p className="text-white font-semibold">Пусто</p>
                                    <p className="text-sm text-gray-400 mt-1 max-w-[200px] mx-auto">
                                        Сообщения от куратора появятся здесь
                                    </p>
                                </div>
                            ) : (
                                messages.map(msg => (
                                    <button
                                        key={msg.id}
                                        onClick={() => handleMessageClick(msg)}
                                        className={`w-full text-left p-4 rounded-2xl transition-all duration-200 relative group
                                            ${selectedMessage?.id === msg.id
                                                ? 'bg-meta-orange/15 shadow-lg shadow-meta-orange/5'
                                                : 'hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${msg.message_type === 'warning'
                                                ? 'bg-yellow-500/15'
                                                : msg.message_type === 'announcement'
                                                    ? 'bg-blue-500/15'
                                                    : 'bg-meta-orange/15'
                                                }`}>
                                                {getMessageIcon(msg.message_type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-[11px] font-bold uppercase tracking-wider ${msg.from_user_id === user?.id
                                                        ? 'text-gray-400'
                                                        : msg.message_type === 'warning'
                                                            ? 'text-yellow-400'
                                                            : msg.message_type === 'announcement'
                                                                ? 'text-blue-400'
                                                                : 'text-meta-orange'
                                                        }`}>
                                                        {msg.from_user_id === user?.id ? 'Ваш ответ' : getMessageTypeLabel(msg.message_type)}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-medium">
                                                        {new Date(msg.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className={`text-sm leading-snug truncate ${!msg.is_read && msg.to_user_id === user?.id ? 'text-white font-bold' : 'text-gray-400 font-medium'
                                                    }`}>
                                                    {msg.from_user_id === user?.id && <span className="text-meta-orange mr-1">Вы:</span>}
                                                    {msg.message}
                                                </p>
                                            </div>
                                            {!msg.is_read && msg.to_user_id === user?.id && (
                                                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-meta-orange shadow-[0_0_10px_rgba(255,107,0,0.5)]" />
                                            )}
                                        </div>
                                        {selectedMessage?.id === msg.id && (
                                            <div className="absolute left-0 top-4 bottom-4 w-1 bg-meta-orange rounded-r-full" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Desktop: Message Detail */}
                    <div className="hidden lg:block lg:col-span-7 xl:col-span-8 glass-card border border-white/5 min-h-[60vh] h-full">
                        {selectedMessage ? (
                            <div className="p-8 xl:p-10 h-full flex flex-col">
                                <MessageDetail
                                    message={selectedMessage}
                                    getMessageIcon={getMessageIcon}
                                    getMessageTypeLabel={getMessageTypeLabel}
                                    user={user}
                                    replyText={replyText}
                                    setReplyText={setReplyText}
                                    onSend={handleSendReply}
                                    isSending={isSending}
                                />
                            </div>
                        ) : (
                            <div className="h-full min-h-[500px] flex items-center justify-center text-center p-10">
                                <div className="max-w-xs">
                                    <div className="w-20 h-20 rounded-[2.5rem] bg-white/5 flex items-center justify-center mx-auto mb-6">
                                        <Mail className="w-10 h-10 text-gray-700" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Выберите сообщение</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Нажмите на любое сообщение слева, чтобы открыть детали и прочитать полный текст.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
                @keyframes slide-up {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
            `}</style>
        </div>
    )
}

// Вынесенный компонент детали сообщения
function MessageDetail({
    message,
    getMessageIcon,
    getMessageTypeLabel,
    user,
    replyText,
    setReplyText,
    onSend,
    isSending
}: {
    message: AdminMessage
    getMessageIcon: (type: string) => React.ReactNode
    getMessageTypeLabel: (type: string) => string
    user: any
    replyText: string
    setReplyText: (val: string) => void
    onSend: () => void
    isSending: boolean
}) {
    const isFromMe = message.from_user_id === user?.id

    return (
        <div className="flex flex-col h-full animate-fade-in">
            {/* Header Detail */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${isFromMe
                        ? 'bg-white/10 text-gray-400'
                        : message.message_type === 'warning'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : message.message_type === 'announcement'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-meta-orange/20 text-meta-orange'
                        }`}>
                        {isFromMe ? <Mail className="w-6 h-6" /> : getMessageIcon(message.message_type)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <h3 className={`text-lg font-bold uppercase tracking-wider ${isFromMe
                                ? 'text-gray-300'
                                : message.message_type === 'warning'
                                    ? 'text-yellow-400'
                                    : message.message_type === 'announcement'
                                        ? 'text-blue-400'
                                        : 'text-meta-orange'
                                }`}>
                                {isFromMe ? 'Ваш ответ' : getMessageTypeLabel(message.message_type)}
                            </h3>
                            {message.is_read && !isFromMe && (
                                <span className="flex items-center gap-1 text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">
                                    <CheckCircle className="w-3 h-3" />
                                    Прочитано
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-400 font-medium">
                            {isFromMe ? 'Вы' : 'Куратор курса MetaSystem'}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-tight">Отправлено</p>
                    <p className="text-sm text-gray-300 font-bold">
                        {new Date(message.created_at).toLocaleString('ru-RU', {
                            day: 'numeric', month: 'short', year: 'numeric'
                        })} в {new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>

            {/* Content Body */}
            <div className={`flex-1 ${isFromMe ? 'bg-meta-orange/5 border-meta-orange/10' : 'bg-white/5 border-white/5'} border rounded-3xl p-6 md:p-8 mb-8 overflow-y-auto`}>
                <div className="prose prose-invert max-w-none">
                    <p className="text-white text-base md:text-lg leading-relaxed whitespace-pre-wrap font-medium">
                        {message.message}
                    </p>
                </div>
            </div>

            {/* Footer / Reply Action */}
            <div className="pt-6 border-t border-white/5">
                <div className="space-y-4">
                    <div className="relative group">
                        <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={isFromMe ? "Продолжить переписку..." : "Напишите ваш ответ куратору..."}
                            className="w-full bg-deep-dark-200/60 border border-white/10 rounded-2xl p-4 md:p-5
                                     text-white placeholder:text-gray-500 focus:outline-none focus:border-meta-orange/50
                                     transition-all duration-300 min-h-[120px] resize-none pr-12 text-sm md:text-base font-medium"
                        />
                        <div className="absolute right-4 bottom-4 text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                            {replyText.length} символов
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <button
                            onClick={onSend}
                            disabled={isSending || !replyText.trim()}
                            className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-meta-orange text-white font-bold 
                                     flex items-center justify-center gap-3 hover:bg-meta-orange-hover 
                                     disabled:opacity-50 disabled:grayscale transition-all duration-300 
                                     shadow-lg shadow-meta-orange/20 active:scale-95"
                        >
                            {isSending ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                            {isFromMe ? "Отправить ещё" : "Отправить куратору"}
                        </button>

                        <a
                            href="https://t.me/BodyBal"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors group"
                        >
                            <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                            Перейти в Telegram
                        </a>
                    </div>
                </div>
            </div>

            {message.message_type === 'warning' && !isFromMe && (
                <div className="mt-8 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-200/80 leading-relaxed font-medium">
                            Это системное предупреждение. Пожалуйста, убедитесь, что вы соблюдаете правила программы
                            и рекомендации куратора для достижения максимального результата.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
