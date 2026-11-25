import {
  MERCHANT_CATEGORIES,
  addMerchant,
  type Merchant,
  type MerchantCategory,
  type MerchantService
} from '../utils/merchants'

interface ServicePayload {
  name?: string
  price?: number | string
}

interface CreateMerchantPayload {
  name?: string
  category?: string
  district?: string
  whatsapp?: string
  description?: string
  services?: ServicePayload[]
}

const isValidCategory = (value: string): value is MerchantCategory =>
  (MERCHANT_CATEGORIES as readonly string[]).includes(value)

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateMerchantPayload>(event)

  // Validasi nama usaha
  if (typeof body?.name !== 'string' || body.name.trim().length < 3) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nama usaha wajib diisi minimal 3 karakter.'
    })
  }

  // Validasi kategori
  if (typeof body?.category !== 'string' || !isValidCategory(body.category.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Kategori usaha tidak valid.'
    })
  }

  // Validasi kecamatan / area
  if (typeof body?.district !== 'string' || body.district.trim().length < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Kecamatan atau area layanan wajib diisi.'
    })
  }

  // Validasi nomor WhatsApp (format 628...)
  const cleanedWhatsapp =
    typeof body?.whatsapp === 'string' ? body.whatsapp.replace(/[\s\-()+]/g, '') : ''

  if (!/^628\d{7,13}$/.test(cleanedWhatsapp)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nomor WhatsApp wajib menggunakan format 628 diikuti 7-13 digit angka.'
    })
  }

  // Validasi daftar layanan/produk (minimal 1 layanan valid)
  if (!Array.isArray(body?.services) || body.services.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Minimal 1 layanan atau produk harus ditambahkan.'
    })
  }

  const sanitizedServices: MerchantService[] = body.services
    .map((service) => {
      const name = typeof service?.name === 'string' ? service.name.trim() : ''
      const hasPrice =
        service?.price !== null &&
        service?.price !== undefined &&
        String(service.price).trim() !== ''
      const parsedPrice = hasPrice ? Number(service.price) : NaN
      const price = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? Math.round(parsedPrice) : -1
      return { name, price }
    })
    .filter((service) => service.name.length > 0 && service.price >= 0)

  if (sanitizedServices.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pastikan minimal 1 layanan memiliki nama dan harga yang valid.'
    })
  }

  const districtClean = body.district.trim()

  const newMerchant: Merchant = {
    id: Date.now(),
    name: body.name.trim(),
    category: body.category.trim() as MerchantCategory,
    district: districtClean,
    address: `${districtClean}, area layanan lokal Bandung`,
    latitude: -6.9034,
    longitude: 107.6186,
    openingHours: '08.00 – 20.00 WIB',
    nextTaxDueDate: '2026-12-10',
    estimatedNextTax: 150000,
    distanceKm: Number((Math.random() * 2.2 + 0.5).toFixed(1)),
    isVerified: false,
    isOpen: true,
    rating: 0,
    reviewCount: 0,
    whatsapp: cleanedWhatsapp,
    description:
      typeof body?.description === 'string' && body.description.trim().length > 0
        ? body.description.trim()
        : 'Mitra UMKM & jasa lokal siap melayani kebutuhan Anda di area sekitar.',
    services: sanitizedServices,
    reviews: []
  }

  await addMerchant(newMerchant)

  return {
    success: true,
    message: 'Pendaftaran mitra UMKM berhasil disimpan!',
    data: newMerchant
  }
})
