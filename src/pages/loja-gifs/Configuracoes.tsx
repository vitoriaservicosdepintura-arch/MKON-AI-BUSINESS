import { useEffect, useRef, useState } from 'react'
import { Save, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/log'
import { Card, CardHeader, Button, Field, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

type StoreSettings = {
  store_name: string
  store_description: string
  logo_url: string
  contact_email: string
  contact_phone: string
  shipping_enabled: boolean
  default_shipping_cost: number
  currency: string
  tax_rate: number
  auto_confirm_orders: boolean
}

export default function LojaGifsConfiguracoes() {
  const toast = useToast()
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .like('key', 'gif_store_%')
      
      const settingsMap = data?.reduce((acc, item) => {
        acc[item.key.replace('gif_store_', '')] = item.value
        return acc
      }, {} as Record<string, any>) || {}

      setSettings({
        store_name: settingsMap.name || 'Loja de GIFs',
        store_description: settingsMap.description || '',
        logo_url: settingsMap.logo_url || '',
        contact_email: settingsMap.email || '',
        contact_phone: settingsMap.phone || '',
        shipping_enabled: settingsMap.shipping_enabled ?? true,
        default_shipping_cost: Number(settingsMap.shipping_cost) || 5.99,
        currency: settingsMap.currency || 'EUR',
        tax_rate: Number(settingsMap.tax_rate) || 23,
        auto_confirm_orders: settingsMap.auto_confirm ?? false
      })
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    } finally {
      setLoading(false)
    }
  }

  const logoInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  /** Envia a logo para o Storage (bucket público loja-logos) e preenche o campo com o endereço. */
  const uploadLogo = async (file: File | undefined) => {
    if (!file || !settings) return
    if (file.size > 2 * 1024 * 1024) { toast.push('error', 'A logo deve ter no máximo 2 MB.'); return }
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `logo-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('loja-logos').upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('loja-logos').getPublicUrl(path)
      setSettings({ ...settings, logo_url: data.publicUrl })
      toast.push('success', 'Logo enviada. Clique em Guardar para aplicar.')
    } catch (error: any) {
      toast.push('error', error.message ?? 'Não foi possível enviar a logo.')
    } finally {
      setUploading(false)
      if (logoInput.current) logoInput.current.value = ''
    }
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const settingsToSave = [
        { key: 'gif_store_name', value: settings.store_name },
        { key: 'gif_store_description', value: settings.store_description },
        { key: 'gif_store_logo_url', value: settings.logo_url },
        { key: 'gif_store_email', value: settings.contact_email },
        { key: 'gif_store_phone', value: settings.contact_phone },
        { key: 'gif_store_shipping_enabled', value: settings.shipping_enabled },
        { key: 'gif_store_shipping_cost', value: settings.default_shipping_cost },
        { key: 'gif_store_currency', value: settings.currency },
        { key: 'gif_store_tax_rate', value: settings.tax_rate },
        { key: 'gif_store_auto_confirm', value: settings.auto_confirm_orders }
      ]

      const { error } = await supabase
        .from('system_settings')
        .upsert(settingsToSave)

      if (error) throw error
      await logActivity('gif_store.settings_updated', 'system_settings', '', { store: settings.store_name })
      toast.push('success', 'Configurações guardadas.')
    } catch (error: any) {
      toast.push('error', error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>
  }

  if (!settings) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Configurações da Loja</h1>
        <p className="mt-1 text-sm text-white/50">Configurações gerais da Loja de GIFs</p>
      </div>

      <Card>
        <CardHeader title="Informações da Loja" subtitle="Dados básicos da loja" />
        <div className="p-5 space-y-4">
          <Field label="Nome da Loja">
            <input className="input" value={settings.store_name} onChange={e => setSettings({ ...settings, store_name: e.target.value })} />
          </Field>
          <Field label="Descrição">
            <textarea className="input" rows={3} value={settings.store_description} onChange={e => setSettings({ ...settings, store_description: e.target.value })} />
          </Field>
          <Field label="Logo da empresa" hint="Cole o endereço de uma imagem, ou envie um ficheiro (PNG, JPG, WebP, SVG ou GIF, até 2 MB).">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <input className="input flex-1 min-w-[220px]" placeholder="https://…/logo.png" value={settings.logo_url} onChange={e => setSettings({ ...settings, logo_url: e.target.value })} />
                <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="hidden" onChange={e => uploadLogo(e.target.files?.[0])} />
                <Button type="button" variant="outline" onClick={() => logoInput.current?.click()} loading={uploading}>
                  <Upload className="h-4 w-4" /> Enviar logo
                </Button>
              </div>
              {settings.logo_url && (
                <div className="flex items-center gap-3">
                  <img src={settings.logo_url} alt="Pré-visualização da logo" className="h-14 w-auto max-w-[200px] rounded-lg border border-white/10 bg-white/5 object-contain p-1" />
                  <button type="button" className="text-xs text-white/50 hover:text-white" onClick={() => setSettings({ ...settings, logo_url: '' })}>Remover logo</button>
                </div>
              )}
            </div>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Email de Contato">
              <input type="email" className="input" value={settings.contact_email} onChange={e => setSettings({ ...settings, contact_email: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <input className="input" value={settings.contact_phone} onChange={e => setSettings({ ...settings, contact_phone: e.target.value })} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Envio e Pagamentos" subtitle="Configurações de entrega e pagamento" />
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="shipping" checked={settings.shipping_enabled} onChange={e => setSettings({ ...settings, shipping_enabled: e.target.checked })} className="rounded border-white/20 bg-white/5" />
            <label htmlFor="shipping" className="text-sm text-white/70">Envio ativo</label>
          </div>
          <Field label="Custo de Envio Padrão (€)">
            <input type="number" step="0.01" className="input" value={settings.default_shipping_cost} onChange={e => setSettings({ ...settings, default_shipping_cost: Number(e.target.value) })} />
          </Field>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="auto" checked={settings.auto_confirm_orders} onChange={e => setSettings({ ...settings, auto_confirm_orders: e.target.checked })} className="rounded border-white/20 bg-white/5" />
            <label htmlFor="auto" className="text-sm text-white/70">Confirmar pedidos automaticamente</label>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Financeiro" subtitle="Configurações fiscais e monetárias" />
        <div className="p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Moeda">
              <select className="input" value={settings.currency} onChange={e => setSettings({ ...settings, currency: e.target.value })}>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </Field>
            <Field label="Taxa de Imposto (%)">
              <input type="number" step="0.1" className="input" value={settings.tax_rate} onChange={e => setSettings({ ...settings, tax_rate: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          <Save className="h-4 w-4" /> Guardar Configurações
        </Button>
      </div>
    </div>
  )
}
