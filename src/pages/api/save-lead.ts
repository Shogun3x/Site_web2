import type { APIRoute } from 'astro'
import fs from 'node:fs'
import path from 'node:path'

export const POST: APIRoute = async ({ request }) => {
	try {
		const lead = await request.json()
		const leadsPath = path.join(process.cwd(), 'leads.json')

		let leads: unknown[] = []
		if (fs.existsSync(leadsPath)) {
			leads = JSON.parse(fs.readFileSync(leadsPath, 'utf-8'))
		}

		leads.push({ ...lead, timestamp: new Date().toISOString() })
		fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2))

		console.log(`[Lean Flow] New lead saved — email: ${lead.email ?? 'n/a'}, phone: ${lead.phone ?? 'n/a'}`)

		return new Response(JSON.stringify({ ok: true }), {
			headers: { 'Content-Type': 'application/json' },
		})
	} catch (err) {
		console.error('[Lean Flow] Failed to save lead:', err)
		return new Response(JSON.stringify({ error: 'Failed to save lead' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		})
	}
}
