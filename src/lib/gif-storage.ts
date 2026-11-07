import { supabase } from '@/lib/supabase'

/**
 * Configuração do Supabase Storage para a Loja de GIFs
 * Buckets:
 * - gif-category-covers: imagens de categorias (público)
 * - gif-product-images: imagens de produtos (público)
 * - gif-animations: GIFs animados (público)
 * - gif-customer-photos: fotos de clientes (privado)
 * - gif-customizations: arquivos personalizados (privado)
 */

export const GIF_STORAGE_BUCKETS = {
  CATEGORY_COVERS: 'gif-category-covers',
  PRODUCT_IMAGES: 'gif-product-images',
  ANIMATIONS: 'gif-animations',
  CUSTOMER_PHOTOS: 'gif-customer-photos',
  CUSTOMIZATIONS: 'gif-customizations',
} as const

/**
 * Upload de imagem de categoria
 */
export async function uploadCategoryCover(file: File, categoryId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${categoryId}/${Date.now()}.${ext}`
  
  const { error } = await supabase.storage
    .from(GIF_STORAGE_BUCKETS.CATEGORY_COVERS)
    .upload(path, file, { upsert: true })
  
  if (error) throw error
  
  const { data: { publicUrl } } = supabase.storage
    .from(GIF_STORAGE_BUCKETS.CATEGORY_COVERS)
    .getPublicUrl(path)
  
  return publicUrl
}

/**
 * Upload de imagem de produto
 */
export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${productId}/${Date.now()}.${ext}`
  
  const { error } = await supabase.storage
    .from(GIF_STORAGE_BUCKETS.PRODUCT_IMAGES)
    .upload(path, file, { upsert: true })
  
  if (error) throw error
  
  const { data: { publicUrl } } = supabase.storage
    .from(GIF_STORAGE_BUCKETS.PRODUCT_IMAGES)
    .getPublicUrl(path)
  
  return publicUrl
}

/**
 * Upload de GIF animado
 */
export async function uploadGif(file: File, productId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${productId}/${Date.now()}.${ext}`
  
  const { error } = await supabase.storage
    .from(GIF_STORAGE_BUCKETS.ANIMATIONS)
    .upload(path, file, { upsert: true })
  
  if (error) throw error
  
  const { data: { publicUrl } } = supabase.storage
    .from(GIF_STORAGE_BUCKETS.ANIMATIONS)
    .getPublicUrl(path)
  
  return publicUrl
}

/**
 * Upload de foto de cliente (privado)
 */
export async function uploadCustomerPhoto(file: File, customerId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${customerId}/${Date.now()}.${ext}`
  
  const { error } = await supabase.storage
    .from(GIF_STORAGE_BUCKETS.CUSTOMER_PHOTOS)
    .upload(path, file, { upsert: true })
  
  if (error) throw error
  
  const { data: { publicUrl } } = supabase.storage
    .from(GIF_STORAGE_BUCKETS.CUSTOMER_PHOTOS)
    .getPublicUrl(path)
  
  return publicUrl
}

/**
 * Upload de arquivo de personalização (privado)
 */
export async function uploadCustomizationFile(file: File, orderId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${orderId}/${Date.now()}.${ext}`
  
  const { error } = await supabase.storage
    .from(GIF_STORAGE_BUCKETS.CUSTOMIZATIONS)
    .upload(path, file, { upsert: true })
  
  if (error) throw error
  
  const { data: { publicUrl } } = supabase.storage
    .from(GIF_STORAGE_BUCKETS.CUSTOMIZATIONS)
    .getPublicUrl(path)
  
  return publicUrl
}

/**
 * Deletar arquivo do storage
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path])
  
  if (error) throw error
}

/**
 * Obter URL pública de um arquivo
 */
export function getPublicUrl(bucket: string, path: string): string {
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)
  
  return publicUrl
}
