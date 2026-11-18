// mkon-tour: escreve uma legenda de anúncio para cada divisão de um tour.
// Usa a foto da divisão quando o fornecedor de IA aceita imagens; se não aceitar, usa só o nome.
// Sem LLM configurado ou em erro, devolve legendas genéricas marcadas como "fallback" para revisão.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

type RoomIn = { id: string; name: string; photo: string | null }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let body: { title?: string; rooms?: RoomIn[] }
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  const rooms = Array.isArray(body.rooms) ? body.rooms.slice(0, 12).map(r => ({ id: String(r.id), name: String(r.name).slice(0, 60), photo: r.photo ?? null })) : []
  if (!rooms.length) return json({ error: 'Sem divisões' }, 400)

  const fallback = Object.fromEntries(rooms.map(r => [r.id, `${r.name}: espaço pensado para viver bem, com luz e arrumação.`]))
  const base = (Deno.env.get('LLM_BASE_URL') ?? '').replace(/\/+$/, '')
  const key = Deno.env.get('LLM_API_KEY') ?? ''
  const model = Deno.env.get('LLM_MODEL') ?? 'auto'
  if (!base || !key) return json({ captions: fallback, source: 'fallback', note: 'LLM_BASE_URL e LLM_API_KEY não definidos.' })

  const system = 'Escreve legendas de anúncio imobiliário em português europeu. Cada legenda tem uma linha, no máximo 110 caracteres, diz para que serve o cômodo e porque é ótimo (luz, espaço, vista, arrumação). Nunca inventes medidas. Responde só com JSON no formato {"captions": {"<id>": "legenda"}}.'
  const list = rooms.map(r => `- id ${r.id}: ${r.name}`).join('\n')

  const call = async (withImages: boolean): Promise<Record<string, string>> => {
    const text = `Tour de ${(body.title ?? 'imóvel').slice(0, 80)}. Divisões:\n${list}`
    const content: unknown[] = [{ type: 'text', text }]
    if (withImages) for (const r of rooms) if (r.photo) content.push({ type: 'image_url', image_url: { url: r.photo } })
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: withImages ? content : text }],
        temperature: 0.6,
        max_tokens: 800,
      }),
    })
    if (!res.ok) throw new Error(`fornecedor de IA respondeu ${res.status}`)
    const j = await res.json()
    const raw: string = j?.choices?.[0]?.message?.content ?? ''
    const m = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(m ? m[0] : raw)
    return (parsed?.captions ?? {}) as Record<string, string>
  }

  try {
    let captions: Record<string, string>
    try { captions = await call(true) } catch { captions = await call(false) }
    const clean = Object.fromEntries(rooms.map(r => [r.id, String(captions[r.id] ?? fallback[r.id]).slice(0, 140)]))
    return json({ captions: clean, source: 'ia' })
  } catch (e) {
    return json({ captions: fallback, source: 'fallback', note: e instanceof Error ? e.message : 'erro desconhecido' })
  }
})
