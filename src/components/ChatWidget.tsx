import { useState, useRef, useEffect } from 'react'

interface Message {
	role: 'user' | 'assistant'
	content: string
}

const SYSTEM_PROMPT = `You are an automation consultant assistant for Lean Flow Systems, a Quebec-based company that builds custom workflow automation, AI integrations, and internal tools for small and medium businesses (SMEs).

Your mission is to qualify potential clients through a friendly, professional discovery conversation. Follow this sequence strictly:

1. Greet the visitor and ask what type of business they operate and their role in it.
2. Explore their pain points: which daily processes are manual, repetitive, or error-prone? Where do things slow down or break?
3. Go technical: ask what software and tools they currently use (CRM, ERP, spreadsheets, accounting software, email platforms, project management tools, etc.), where handoffs between systems fail, and roughly how many hours per week are lost to manual work.
4. Explore the ideal automated state: what would their process look like if it worked perfectly without manual intervention?
5. Summarize the automation needs you've identified in a concise paragraph.
6. Ask for their name and contact information (email and/or phone number) so that Francis, the founder, can follow up with a tailored proposal.

Rules:
- Keep each response to 2-3 sentences maximum.
- Ask only one question at a time.
- Be warm, professional, and direct. No filler phrases.
- Respond in the same language the user writes in (French or English).
- Never quote specific prices or delivery timelines.
- If asked about pricing, explain that it depends on project scope and that Francis will provide a detailed quote after reviewing their needs.
- Never break character or mention that you are an AI model.`

function stripThinking(text: string): string {
	return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

const SUGGESTIONS = [
	'Je perds mon temps avec des opérations manuelles',
	'Mes demandes clients arrivent de partout',
	'Je fais trop de suivis manuels dans Excel',
]

export default function ChatWidget() {
	const [messages, setMessages] = useState<Message[]>([
		{
			role: 'assistant',
			content:
				'Décrivez votre principal défi opérationnel — je vais identifier où une automatisation créerait le plus de valeur pour vous.',
		},
	])
	const [input, setInput] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const messagesContainerRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const leadSaved = useRef(false)

	useEffect(() => {
		const el = messagesContainerRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [messages])

	useEffect(() => {
		if (!loading) inputRef.current?.focus()
	}, [loading])

	const detectAndSaveLead = async (allMessages: Message[]) => {
		if (leadSaved.current) return
		const fullText = allMessages.map((m) => m.content).join(' ')
		const emailMatch = fullText.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i)
		const phoneMatch = fullText.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)
		if (emailMatch || phoneMatch) {
			leadSaved.current = true
			try {
				await fetch('/api/save-lead', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						email: emailMatch?.[0] ?? null,
						phone: phoneMatch?.[0] ?? null,
						conversation: allMessages,
					}),
				})
			} catch {
				// Silently fail — lead saving is non-critical
			}
		}
	}

	const sendMessage = async (overrideText?: string) => {
		const text = overrideText ?? input.trim()
		if (!text || loading) return
		setError(null)

		const userMsg: Message = { role: 'user', content: text }
		const history = [...messages, userMsg]
		setMessages([...history, { role: 'assistant', content: '' }])
		setInput('')
		setLoading(true)

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
				}),
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error ?? 'Server error')
			}

			const reader = res.body!.getReader()
			const decoder = new TextDecoder()
			let full = ''
			let buffer = ''

			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				buffer += decoder.decode(value, { stream: true })
				const lines = buffer.split('\n')
				buffer = lines.pop() ?? ''

				for (const line of lines) {
					if (!line.trim()) continue
					try {
						const json = JSON.parse(line)
						if (json.message?.content) {
							full += json.message.content
							const cleaned = stripThinking(full)
							setMessages((prev) => {
								const copy = [...prev]
								copy[copy.length - 1] = { role: 'assistant', content: cleaned }
								return copy
							})
						}
					} catch {
						// Ignore malformed JSON lines
					}
				}
			}

			const finalMessages: Message[] = [
				...history,
				{ role: 'assistant', content: stripThinking(full) },
			]
			await detectAndSaveLead(finalMessages)
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Une erreur est survenue.'
			setError(message)
			setMessages((prev) => prev.slice(0, -1))
		} finally {
			setLoading(false)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			sendMessage()
		}
	}

	const isIdle = messages.length === 1 && !loading

	return (
		<div className="chat-widget">
			<div className="chat-header">
				<span className="chat-header-dot" />
				<span>Diagnostic automatisation</span>
				<span className="chat-header-sub">Assistant Lean Flow</span>
			</div>

			<div className="chat-messages" ref={messagesContainerRef}>
				{messages.map((msg, i) => (
					<div key={i} className={`chat-msg chat-msg--${msg.role}`}>
						<div className="chat-bubble">
							{msg.content === '' && loading && i === messages.length - 1 ? (
								<span className="chat-typing">
									<span />
									<span />
									<span />
								</span>
							) : (
								msg.content
							)}
						</div>
					</div>
				))}

				{error && <p className="chat-error">{error}</p>}
			</div>

			{isIdle && (
				<div className="chat-suggestions">
					{SUGGESTIONS.map((s) => (
						<button key={s} className="chat-suggestion" onClick={() => sendMessage(s)}>
							{s}
						</button>
					))}
				</div>
			)}

			<div className="chat-input-row">
				<input
					type="text"
					ref={inputRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Décrivez votre situation..."
					disabled={loading}
					className="chat-input"
				/>
				<button
					onClick={() => sendMessage()}
					disabled={loading || !input.trim()}
					className="chat-send"
					aria-label="Envoyer"
				>
					↑
				</button>
			</div>
		</div>
	)
}
