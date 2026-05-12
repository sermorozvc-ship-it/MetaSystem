'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, MessageCircle, ArrowLeft, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
    getMyConversation, sendMessageToTrainer,
    getClientsWithMessages, getConversationWithClient, sendMessageToClient, markConversationRead,
    type ChatMessage
} from '@/lib/services/messages'
import { getAllUsers, type UserWithProgress } from '@/lib/services/admin'

const ADMIN_EMAILS = ['dgmukhin@gmail.com']
const TRAINER_ID = '2c87d862-8f21-4ca0-ac69-eafe5a343ee1'

// ─── Клиентский чат ──────────────────────────────────────────────────────────

function ClientChat({ user }: { user: any }) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')
    const bottomRef = useRef<HTMLDivElement>(null)

    const load = async () => {
        const data = await getMyConversation()
        setMessages(data)
        setIsLoading(false)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }

    useEffect(() => { load() }, [])

    const handleSend = async () => {
        if (!text.trim() || sending) return
        setSending(true)
        setError('')
        const result = await sendMessageToTrainer(text.trim())
        if (result.success) { setText(''); await load() }
        else setError(result.error || 'Ошибка отправки')
        setSending(false)
    }

    if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b border-border px-4 py-4 flex items-center gap-3 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <span className="text-accent font-bold text-sm">ДМ</span>
                </div>
                <div>
                    <p className="font-semibold text-white">Дмитрий Мухин</p>
                    <p className="text-xs text-text-muted">Тренер · отвечает в течение дня</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && (
                    <div className="text-center py-16">
                        <MessageCircle className="w-12 h-12 text-text-muted mx-auto mb-3" />
                        <p className="text-text-secondary text-sm">Напишите тренеру — он ответит в течение дня</p>
                    </div>
                )}
                {messages.map(msg => {
                    const isFromMe = msg.from_user_id === user?.id
                    return (
                        <div key={msg.id} className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                                isFromMe ? 'bg-accent text-bg-main rounded-br-sm' : 'bg-bg-elevated text-white rounded-bl-sm'
                            }`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                <p className={`text-xs mt-1 ${isFromMe ? 'text-bg-main/60' : 'text-text-muted'}`}>
                                    {new Date(msg.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border px-4 py-4 flex-shrink-0">
                {error && <p className="text-xs text-danger mb-2">{error}</p>}
                <div className="flex gap-3 items-end">
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                        placeholder="Напишите сообщение... (Enter — отправить)"
                        className="glass-input flex-1 resize-none text-sm min-h-[44px] max-h-32 py-3"
                        rows={1}
                    />
                    <button onClick={handleSend} disabled={!text.trim() || sending}
                        className="glass-button p-3 flex-shrink-0 disabled:opacity-40">
                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Админский чат ───────────────────────────────────────────────────────────

function AdminChat() {
    const [clients, setClients] = useState<UserWithProgress[]>([])
    const [selectedClient, setSelectedClient] = useState<UserWithProgress | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
    const [isLoadingClients, setIsLoadingClients] = useState(true)
    const [isLoadingMsgs, setIsLoadingMsgs] = useState(false)
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const load = async () => {
            const [allUsers, withMsgs] = await Promise.all([getAllUsers(), getClientsWithMessages()])
            const clientsOnly = allUsers.filter(u => u.role !== 'admin' && u.role !== 'trainer')
            setClients(clientsOnly)
            // Строим карту непрочитанных
            const map: Record<string, number> = {}
            for (const c of withMsgs) map[c.userId] = c.unread
            setUnreadMap(map)
            setIsLoadingClients(false)
        }
        load()
    }, [])

    const selectClient = async (client: UserWithProgress) => {
        setSelectedClient(client)
        setIsLoadingMsgs(true)
        const data = await getConversationWithClient(client.id)
        setMessages(data)
        setIsLoadingMsgs(false)
        await markConversationRead(client.id)
        setUnreadMap(prev => ({ ...prev, [client.id]: 0 }))
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }

    const handleSend = async () => {
        if (!text.trim() || !selectedClient || sending) return
        setSending(true)
        const result = await sendMessageToClient(selectedClient.id, text.trim())
        if (result.success) {
            setText('')
            const data = await getConversationWithClient(selectedClient.id)
            setMessages(data)
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
        setSending(false)
    }

    // Клиенты у которых есть сообщения — сначала
    const clientsWithMsgs = clients.filter(c => unreadMap[c.id] !== undefined || messages.some(m => m.from_user_id === c.id || m.to_user_id === c.id))
    const sortedClients = [...clients].sort((a, b) => (unreadMap[b.id] || 0) - (unreadMap[a.id] || 0))

    return (
        <div className="flex h-full">
            {/* Список клиентов */}
            <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
                <div className="px-4 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-text-muted" />
                        <h2 className="font-semibold text-white text-sm">Клиенты</h2>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoadingClients ? (
                        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>
                    ) : sortedClients.length === 0 ? (
                        <p className="text-text-muted text-sm text-center py-8">Нет клиентов</p>
                    ) : (
                        sortedClients.map(client => (
                            <button key={client.id} onClick={() => selectClient(client)}
                                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-bg-elevated transition-colors ${
                                    selectedClient?.id === client.id ? 'bg-accent/10 border-r-2 border-accent' : ''
                                }`}>
                                <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
                                    {(client.full_name || client.email).charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{client.full_name || 'Без имени'}</p>
                                    <p className="text-xs text-text-muted truncate">{client.email}</p>
                                </div>
                                {(unreadMap[client.id] || 0) > 0 && (
                                    <span className="w-5 h-5 rounded-full bg-accent text-bg-main text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {unreadMap[client.id]}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Переписка */}
            <div className="flex-1 flex flex-col min-w-0">
                {!selectedClient ? (
                    <div className="flex-1 flex items-center justify-center text-center p-8">
                        <div>
                            <MessageCircle className="w-12 h-12 text-text-muted mx-auto mb-3" />
                            <p className="text-text-secondary">Выберите клиента слева</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="border-b border-border px-4 py-4 flex items-center gap-3 flex-shrink-0">
                            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                                {(selectedClient.full_name || selectedClient.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-semibold text-white text-sm">{selectedClient.full_name || 'Без имени'}</p>
                                <p className="text-xs text-text-muted">{selectedClient.email}</p>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {isLoadingMsgs ? (
                                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>
                            ) : messages.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-text-muted text-sm">Сообщений пока нет</p>
                                    <p className="text-text-muted text-xs mt-1">Напишите первым</p>
                                </div>
                            ) : (
                                messages.map(msg => {
                                    const isFromTrainer = msg.from_user_id === TRAINER_ID
                                    return (
                                        <div key={msg.id} className={`flex ${isFromTrainer ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                                                isFromTrainer ? 'bg-accent text-bg-main rounded-br-sm' : 'bg-bg-elevated text-white rounded-bl-sm'
                                            }`}>
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                                <p className={`text-xs mt-1 ${isFromTrainer ? 'text-bg-main/60' : 'text-text-muted'}`}>
                                                    {new Date(msg.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {/* Input */}
                        <div className="border-t border-border px-4 py-4 flex-shrink-0">
                            <div className="flex gap-3 items-end">
                                <textarea
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                                    placeholder="Ответить клиенту... (Enter — отправить)"
                                    className="glass-input flex-1 resize-none text-sm min-h-[44px] max-h-32 py-3"
                                    rows={1}
                                />
                                <button onClick={handleSend} disabled={!text.trim() || sending}
                                    className="glass-button p-3 flex-shrink-0 disabled:opacity-40">
                                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ─── Главная страница ─────────────────────────────────────────────────────────

export default function MessagesPage() {
    const { user, isLoading: authLoading } = useAuth()

    useEffect(() => {
        if (!authLoading && !user) window.location.href = '/auth'
    }, [user, authLoading])

    if (authLoading || !user) {
        return <div className="min-h-screen bg-bg-main flex items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
    }

    const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')
        || user.user_metadata?.role === 'admin'
        || user.user_metadata?.role === 'trainer'

    return (
        <div className="bg-bg-main flex flex-col" style={{ height: '100vh', paddingTop: '72px' }}>
            {isAdmin ? <AdminChat /> : <ClientChat user={user} />}
        </div>
    )
}
