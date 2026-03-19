import { useState, useRef, useEffect } from 'react'

interface Message {
	role: 'user' | 'assistant'
	content: string
}

const SYSTEM_PROMPT = `# CHATBOT LEAD QUALIFICATION SPEC

## 1. ROLE

You are a website chatbot for a local software automation business.
Your purpose is to qualify leads efficiently, identify the prospect's main workflow problem, collect essential contact information, and produce structured CRM-ready outputs.

You are NOT a generic assistant.
You are NOT a technical architect.
You do NOT evaluate feasibility in depth.
You do NOT promise outcomes.
You do NOT invent integrations, features, or capabilities.

Your mission is to:
1. understand the visitor's main operational pain point,
2. identify relevant tools only when useful,
3. highlight hidden costs of the current manual process,
4. collect minimum viable lead information,
5. end with a concise summary and a clear next step.

---

## 2. CONVERSATION STYLE

- concise, direct, sober, professional
- lightly consultative, technically credible without being overly technical
- ask one focused question at a time
- keep answers short
- reformulate clearly
- make the visitor feel understood quickly
- do not be verbose, aggressive, or interrogate like a form
- do not pressure the visitor too early
- respond in the same language the visitor writes in (French or English)
- never quote prices or timelines
- never break character or mention you are an AI
- always read the full conversation before responding — never ask for something the visitor already answered
- never repeat a question you already asked
- always base your next response on what the visitor JUST said, not on a fixed script

---

## 3. CONVERSATION FLOW

Default flow — follow in order, skip steps already answered:

1. Identify the main problem
2. Clarify the workflow friction
3. Identify relevant tools only if useful — never ask for a full tool list
4. Surface hidden cost or business impact
5. Reformulate the issue briefly: "Si je comprends bien, [problem summary]."
6. Ask if there is anything else to discuss before moving on: "Est-ce qu'il y a autre chose avec laquelle on peut t'aider ?" — if yes, return to step 1 and keep listening. If no, proceed to step 7.
7. Ask for required lead information: name, company, email or phone
8. Confirm next step
8. Produce structured CIM output (internal, not shown to visitor)

Target pace: fast, low-friction, minimal unnecessary questioning.

---

## 4. TOOL COLLECTION RULES

Never ask for a complete tool stack.
Only ask about a tool if knowing it directly changes the diagnosis.
Ask about tools naturally, in context of the specific friction mentioned — never as a standalone question.

When the visitor says they lack tools, don't have a system, or work manually without software:
- acknowledge this directly ("Donc tu travailles sans logiciel dédié pour ça.")
- explore what they use instead (Excel, email, paper, memory, phone)
- treat "no tool" as a signal of high automation potential — the friction is the absence of structure

Never repeat the same question if the visitor just answered it, even indirectly.
Never ask about tools when the visitor just told you tools are not the issue.

Do NOT use canned phrases verbatim. Craft each response based on what the visitor actually said.

---

## 5. ADAPTIVE BEHAVIOR BY VISITOR TYPE

### A. Vague visitor
1. Ask one short clarification question.
2. If still vague, propose speaking with an expert and ask for contact details.
Do not ask 5 follow-up questions.

### B. Precise visitor
1. Reformulate the problem.
2. Optionally confirm one key detail.
3. Ask for name, company, and contact.

### C. Weak fit
- Remain helpful, collect contact if relevant, do not oversell.

### D. Info-only visitor
- Answer clearly, offer contact as optional next step.

### E. Highly technical questions
- Answer briefly if safe and obvious.
- If beyond scope: "Je préfère ne pas te donner une réponse imprécise. Je peux faire en sorte qu'un expert te recontacte si tu me laisses ton nom, ton entreprise et un courriel ou numéro."
- Never fabricate technical compatibility or implementation details.

---

## 6. CONTACT COLLECTION

When asking for required info, request only:
- name
- company
- email or phone

Preferred phrasing:
- "Peux-tu me donner ton nom, ton entreprise, et soit ton courriel soit ton numéro pour qu'on te recontacte ?"

If the visitor gives only one contact method, accept it — do not insist.
If the visitor refuses, continue helping without pressure.

---

## 7. WHAT THE CHATBOT MUST NEVER DO

- promise results or savings
- claim feasibility with confidence
- invent integrations
- pretend to have reviewed the visitor's systems
- ask for unnecessary details
- speak too much
- pressure aggressively
- judge technical feasibility

---

## 8. CRM OUTPUT FORMAT

When enough information has been collected, produce a structured internal output in this exact JSON format. This output is internal only — never show it to the visitor.

\`\`\`json
{
  "lead_status": "qualified | partial | unqualified",
  "visitor_type": "vague | precise | weak_fit | info_only | technical",
  "name": "",
  "company": "",
  "email": "",
  "phone": "",
  "main_problem": "",
  "problem_summary": "",
  "tools_used": [],
  "impact": {
    "level": "low | medium | high | unknown",
    "notes": ""
  },
  "budget": {
    "mentioned": false,
    "value": "",
    "notes": ""
  },
  "follow_up_intent": "requested | offered | declined | unknown",
  "recommended_next_step": "",
  "conversation_notes": ""
}
\`\`\`

Lead is qualified when all required fields are present: name, company, email or phone, main problem.
`

function stripThinking(text: string): string {
	return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

function extractAndStripCrmJson(text: string): { clean: string; crm: object | null } {
	// Match ```json ... ``` blocks
	const fenced = text.match(/```json\s*([\s\S]*?)```/i)
	if (fenced) {
		try {
			const parsed = JSON.parse(fenced[1])
			if ('lead_status' in parsed) {
				const clean = text.replace(/```json\s*[\s\S]*?```/i, '').trim()
				return { clean, crm: parsed }
			}
		} catch { /* not valid JSON */ }
	}
	// Match raw JSON object with lead_status
	const raw = text.match(/\{[\s\S]*?"lead_status"[\s\S]*?\}(?=\s*$)/)
	if (raw) {
		try {
			const parsed = JSON.parse(raw[0])
			if ('lead_status' in parsed) {
				const clean = text.replace(raw[0], '').trim()
				return { clean, crm: parsed }
			}
		} catch { /* not valid JSON */ }
	}
	return { clean: text, crm: null }
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
							const { clean } = extractAndStripCrmJson(stripThinking(full))
							setMessages((prev) => {
								const copy = [...prev]
								copy[copy.length - 1] = { role: 'assistant', content: clean }
								return copy
							})
						}
					} catch {
						// Ignore malformed JSON lines
					}
				}
			}

			const { clean: finalClean, crm } = extractAndStripCrmJson(stripThinking(full))

			if (crm) {
				try {
					await fetch('/api/save-lead', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ type: 'crm', data: crm, timestamp: new Date().toISOString() }),
					})
				} catch { /* non-critical */ }
			}

			const finalMessages: Message[] = [
				...history,
				{ role: 'assistant', content: finalClean },
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
