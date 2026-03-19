import type { APIRoute } from 'astro'
import fs from 'node:fs'
import path from 'node:path'

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json()

		if (body.type === 'crm') {
			// Save structured CRM output to leads-crm.json
			const crmPath = path.join(process.cwd(), 'leads-crm.json')
			let crm: unknown[] = []
			if (fs.existsSync(crmPath)) {
				crm = JSON.parse(fs.readFileSync(crmPath, 'utf-8'))
			}
			crm.push({ ...body.data, timestamp: body.timestamp ?? new Date().toISOString() })
			fs.writeFileSync(crmPath, JSON.stringify(crm, null, 2))
			console.log(`[Lean Flow] CRM lead saved — status: ${body.data?.lead_status ?? 'unknown'}, name: ${body.data?.name ?? 'n/a'}`)
		} else {
			// Save raw conversation lead to leads.json
			const leadsPath = path.join(process.cwd(), 'leads.json')
			let leads: unknown[] = []
			if (fs.existsSync(leadsPath)) {
				leads = JSON.parse(fs.readFileSync(leadsPath, 'utf-8'))
			}
			leads.push({ ...body, timestamp: new Date().toISOString() })
			fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2))
			console.log(`[Lean Flow] Lead saved — email: ${body.email ?? 'n/a'}, phone: ${body.phone ?? 'n/a'}`)
		}

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
