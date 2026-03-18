import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request }) => {
	const body = await request.json()

	let ollamaResponse: Response
	try {
		ollamaResponse = await fetch('http://localhost:11434/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: 'qwen3:8b',
				messages: body.messages,
				stream: true,
				think: false,
			}),
		})
	} catch {
		return new Response(JSON.stringify({ error: 'Ollama is not running. Start it with: ollama serve' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	if (!ollamaResponse.ok) {
		return new Response(JSON.stringify({ error: 'Ollama returned an error' }), {
			status: ollamaResponse.status,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	return new Response(ollamaResponse.body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-cache',
		},
	})
}
