// MKON Voice — síntese de voz no servidor (Supabase Edge Function).
//
// Só o proprietário autenticado pode usar. Devolve áudio MP3.
// Configuração (segredos do Supabase), por ordem de prioridade:
//   MULTIVOZES_URL + MULTIVOZES_API_KEY (+ MULTIVOZES_VOICE, por omissão Thalita) → motor MultiVozes self-hosted
//   ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID  → voz natural (pt-BR feminina)
//   ou, em alternativa: OPENAI_API_KEY (+ opcional OPENAI_TTS_VOICE, por omissão "nova")
//
// Deploy: supabase functions deploy mkon-voice

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_CHARS = 700

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sessão em falta.' }, 401)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
    })
    const { data: owner } = await sb.from('administrators').select('id').eq('role', 'owner').limit(1)
    if (!owner || owner.length === 0) return json({ error: 'Acesso reservado ao proprietário.' }, 403)

    let body: { text?: string }
    try { body = await req.json() } catch { return json({ error: 'Pedido inválido.' }, 400) }
    const text = String(body.text ?? '').trim().slice(0, MAX_CHARS)
    if (!text) return json({ error: 'Texto vazio.' }, 400)

    const mvUrl = (Deno.env.get('MULTIVOZES_URL') ?? '').replace(/\/+$/, '')
    const mvKey = Deno.env.get('MULTIVOZES_API_KEY')
    const mvVoice = Deno.env.get('MULTIVOZES_VOICE') ?? 'pt-BR-ThalitaMultilingualNeural'
    const elKey = Deno.env.get('ELEVENLABS_API_KEY')
    const elVoice = Deno.env.get('ELEVENLABS_VOICE_ID')
    const oaKey = Deno.env.get('OPENAI_API_KEY')

    let res: Response
    try {
        if (mvUrl && mvKey) {
            // Motor MultiVozes (self-hosted), voz brasileira feminina Thalita.
            res = await fetch(`${mvUrl}/v1/audio/speech`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mvKey}` },
                body: JSON.stringify({ model: 'tts-1', input: text, voice: mvVoice, response_format: 'mp3', speed: 1.0 }),
            })
        } else if (elKey && elVoice) {
            res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoice}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'xi-api-key': elKey, Accept: 'audio/mpeg' },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
                }),
            })
        } else if (oaKey) {
            res = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${oaKey}` },
                body: JSON.stringify({
                    model: 'tts-1-hd',
                    voice: Deno.env.get('OPENAI_TTS_VOICE') ?? 'nova',
                    input: text,
                    response_format: 'mp3',
                }),
            })
        } else {
            return json({ error: 'Voz não configurada: defina ELEVENLABS_API_KEY e ELEVENLABS_VOICE_ID (ou OPENAI_API_KEY) nos segredos do Supabase.' }, 500)
        }
    } catch {
        return json({ error: 'Não foi possível ligar ao serviço de voz.' }, 502)
    }

    if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return json({ error: `Serviço de voz devolveu erro ${res.status}.`, detail: detail.slice(0, 200) }, 502)
    }

    return new Response(res.body, { status: 200, headers: { ...CORS, 'Content-Type': 'audio/mpeg' } })
})

function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
