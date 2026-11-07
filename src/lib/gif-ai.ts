import { askAI } from '@/lib/ai'
import { supabase } from '@/lib/supabase'

/**
 * Funções de IA específicas para a Loja de GIFs
 */

/**
 * Sugerir novas categorias com base nas vendas
 */
export async function suggestCategories(): Promise<string[]> {
  try {
    const { data: orders } = await supabase
      .from('gif_orders')
      .select('*, gif_order_items(*)')
      .limit(100)

    const categories = orders?.flatMap((o: any) => 
      o.gif_order_items?.map((item: any) => item.product_name) || []
    ) || []

    const prompt = `Com base nestes produtos vendidos: ${categories.join(', ')}
Sugira 5 novas categorias para uma loja de ímanes personalizados. Responda apenas com os nomes das categorias separados por vírgula.`

    const result = await askAI('Você é um especialista em e-commerce de produtos personalizados.', prompt)
    return result.split(',').map(c => c.trim()).filter(Boolean)
  } catch (error) {
    console.error('Erro ao sugerir categorias:', error)
    return []
  }
}

/**
 * Sugerir nome de produto
 */
export async function suggestProductName(category: string, description: string): Promise<string> {
  try {
    const prompt = `Crie um nome comercial atraente para um íman personalizado da categoria "${category}" com descrição: "${description}". Responda apenas com o nome.`
    return await askAI('Você é um especialista em naming de produtos.', prompt)
  } catch (error) {
    console.error('Erro ao sugerir nome:', error)
    return ''
  }
}

/**
 * Gerar descrição comercial do produto
 */
export async function generateProductDescription(product: {
  name: string
  category: string
  price: number
  material?: string
  dimensions?: string
}): Promise<string> {
  try {
    const prompt = `Crie uma descrição comercial atraente para este produto:
Nome: ${product.name}
Categoria: ${product.category}
Preço: €${product.price}
Material: ${product.material || 'não especificado'}
Dimensões: ${product.dimensions || 'não especificado'}

A descrição deve ser persuasiva, destacar benefícios e ter no máximo 200 palavras.`

    return await askAI('Você é um copywriter especializado em produtos personalizados.', prompt)
  } catch (error) {
    console.error('Erro ao gerar descrição:', error)
    return ''
  }
}

/**
 * Sugerir preço com base no custo
 */
export async function suggestPrice(cost: number, category: string): Promise<number> {
  try {
    const prompt = `Sugira um preço de venda para um íman personalizado com custo de produção de €${cost} na categoria "${category}". Considere margem de 40-60%. Responda apenas com o número.`
    const result = await askAI('Você é um especialista em precificação de produtos.', prompt)
    const price = parseFloat(result.replace(/[^\d.]/g, ''))
    return isNaN(price) ? cost * 1.5 : price
  } catch (error) {
    console.error('Erro ao sugerir preço:', error)
    return cost * 1.5
  }
}

/**
 * Analisar produtos mais vendidos
 */
export async function analyzeTopProducts(): Promise<string> {
  try {
    const { data: orderItems } = await supabase
      .from('gif_order_items')
      .select('product_name, quantity, total_price')

    const productMap = new Map<string, { quantity: number; revenue: number }>()
    orderItems?.forEach(item => {
      const existing = productMap.get(item.product_name) || { quantity: 0, revenue: 0 }
      existing.quantity += item.quantity
      existing.revenue += Number(item.total_price)
      productMap.set(item.product_name, existing)
    })

    const topProducts = Array.from(productMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)

    const prompt = `Analise estes produtos mais vendidos:
${topProducts.map(([name, data]) => `- ${name}: ${data.quantity} unidades, €${data.revenue.toFixed(2)}`).join('\n')}

Forneça insights sobre tendências e sugestões de marketing.`

    return await askAI('Você é um analista de e-commerce.', prompt)
  } catch (error) {
    console.error('Erro ao analisar produtos:', error)
    return ''
  }
}

/**
 * Sugerir campanha promocional
 */
export async function suggestPromotion(): Promise<string> {
  try {
    const { data: orders } = await supabase
      .from('gif_orders')
      .select('created_at, total_amount')
      .order('created_at', { ascending: false })
      .limit(30)

    const recentSales = orders?.length || 0
    const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0

    const prompt = `Dados de vendas recentes da loja:
- Pedidos nos últimos 30 dias: ${recentSales}
- Faturamento: €${totalRevenue.toFixed(2)}

Sugira uma campanha promocional eficaz para aumentar as vendas. Inclua:
1. Tipo de promoção
2. Desconto sugerido
3. Duração
4. Mensagem de marketing`

    return await askAI('Você é um especialista em marketing digital.', prompt)
  } catch (error) {
    console.error('Erro ao sugerir promoção:', error)
    return ''
  }
}

/**
 * Gerar texto para WhatsApp/Redes sociais
 */
export async function generateMarketingText(product: {
  name: string
  description?: string
  price: number
  category: string
}): Promise<string> {
  try {
    const prompt = `Crie um texto persuasivo para WhatsApp/Instagram para promover este produto:
Nome: ${product.name}
Categoria: ${product.category}
Preço: €${product.price}
Descrição: ${product.description || 'produto personalizado'}

O texto deve ser curto, engajador e incluir call-to-action.`

    return await askAI('Você é um especialista em marketing para redes sociais.', prompt)
  } catch (error) {
    console.error('Erro ao gerar texto de marketing:', error)
    return ''
  }
}

/**
 * Sugerir coleção sazonal
 */
export async function suggestSeasonalCollection(): Promise<string> {
  try {
    const currentMonth = new Date().getMonth()
    const season = currentMonth >= 2 && currentMonth <= 4 ? 'Primavera' :
                   currentMonth >= 5 && currentMonth <= 7 ? 'Verão' :
                   currentMonth >= 8 && currentMonth <= 10 ? 'Outono' : 'Inverno'

    const prompt = `Sugira uma coleção sazonal de produtos para a estação ${season} para uma loja de ímanes personalizados. Inclua:
1. Nome da coleção
2. 5 produtos temáticos
3. Cores e estilos sugeridos
4. Mensagem de marketing`

    return await askAI('Você é um especialista em tendências de e-commerce.', prompt)
  } catch (error) {
    console.error('Erro ao sugerir coleção:', error)
    return ''
  }
}
