import { readCollection, writeCollection } from './db'

export type MerchantCategory =
  | 'Jasa Rumah Tangga'
  | 'Kuliner & Katering'
  | 'Percetakan & ATK'
  | 'Otomotif'

export interface MerchantService {
  name: string
  price: number
}

export interface MerchantReview {
  id: number
  reviewerName: string
  rating: number
  comment: string
  createdAt: string
}

export interface Merchant {
  id: number
  name: string
  category: MerchantCategory
  district: string
  address: string
  latitude: number
  longitude: number
  openingHours: string
  nextTaxDueDate: string
  estimatedNextTax: number
  distanceKm: number
  isVerified: boolean
  isOpen: boolean
  rating: number
  reviewCount: number
  whatsapp: string
  description: string
  imageUrl?: string
  services: MerchantService[]
  reviews: MerchantReview[]
}

export const MERCHANT_CATEGORIES: readonly MerchantCategory[] = [
  'Jasa Rumah Tangga',
  'Kuliner & Katering',
  'Percetakan & ATK',
  'Otomotif'
] as const

const initialMerchants: Merchant[] = [
  {
    id: 1,
    name: 'Berkah Teknik AC & Kelistrikan',
    category: 'Jasa Rumah Tangga',
    district: 'Kec. Sukajadi',
    address: 'Jl. Sukajadi No. 142, seberang Masjid Al-Barokah, Bandung',
    latitude: -6.8898,
    longitude: 107.5955,
    openingHours: '08.00 – 20.00 WIB',
    nextTaxDueDate: '2026-12-10',
    estimatedNextTax: 95000,
    distanceKm: 0.8,
    isVerified: true,
    isOpen: true,
    rating: 4.9,
    reviewCount: 128,
    whatsapp: '6281234567890',
    description:
      'Teknisi berpengalaman melayani cuci AC, isi freon, bongkar pasang, dan perbaikan instalasi listrik rumah bergaransi 30 hari.',
    services: [
      { name: 'Cuci AC Split (0.5 - 1 PK)', price: 75000 },
      { name: 'Tambah Freon R32 / R410A', price: 150000 },
      { name: 'Perbaikan Instalasi & Korsleting Listrik', price: 100000 }
    ],
    reviews: [
      {
        id: 101,
        reviewerName: 'Andi Pratama',
        rating: 5,
        comment: 'Teknisi datang tepat waktu, pengerjaan bersih dan AC langsung dingin kembali.',
        createdAt: '2026-11-12T09:00:00.000Z'
      }
    ]
  },
  {
    id: 2,
    name: 'Print Cepat Nusantara & Fotokopi',
    category: 'Percetakan & ATK',
    district: 'Kec. Cicendo',
    address: 'Jl. Pajajaran No. 78, dekat Stasiun Bandung, Kec. Cicendo',
    latitude: -6.9061,
    longitude: 107.5897,
    openingHours: '07.30 – 21.00 WIB',
    nextTaxDueDate: '2026-12-12',
    estimatedNextTax: 75000,
    distanceKm: 2.1,
    isVerified: true,
    isOpen: false,
    rating: 4.7,
    reviewCount: 62,
    whatsapp: '6285722334455',
    description:
      'Percetakan dokumen kilat, cetak tugas akhir & skripsi, jilid hardcover, spanduk banner, hingga kebutuhan ATK kantor dan mahasiswa.',
    services: [
      { name: 'Print Warna A4 (per lembar)', price: 1500 },
      { name: 'Jilid Hardcover Skripsi Express', price: 35000 },
      { name: 'Cetak Banner / Spanduk (per m²)', price: 25000 }
    ],
    reviews: [
      {
        id: 201,
        reviewerName: 'Dimas Saputra',
        rating: 5,
        comment: 'Jilid hardcover skripsi sehari jadi, hasilnya sangat rapi!',
        createdAt: '2026-11-14T16:40:00.000Z'
      }
    ]
  },
  {
    id: 3,
    name: 'Dapur Bu Sari — Rumah Makan & Katering',
    category: 'Kuliner & Katering',
    district: 'Kec. Coblong',
    address: 'Jl. Dipati Ukur Gg. Melati No. 19, dekat Kampus Unpad, Coblong',
    latitude: -6.8902,
    longitude: 107.6134,
    openingHours: '06.30 – 19.00 WIB',
    nextTaxDueDate: '2026-11-28',
    estimatedNextTax: 2450000,
    distanceKm: 1.4,
    isVerified: true,
    isOpen: true,
    rating: 4.8,
    reviewCount: 94,
    whatsapp: '6281398765432',
    imageUrl: '/images/cat-kuliner.jpg',
    description:
      'Rumah makan & katering rumahan higienis tanpa MSG berlebih. Melayani makan di tempat, nasi kotak acara, dan tumpeng mini.',
    services: [
      { name: 'Nasi Kotak Ayam Bakar Komplit', price: 28000 },
      { name: 'Katering Harian 5 Hari (Makan Siang)', price: 125000 },
      { name: 'Paket Tumpeng Mini (10 Porsi)', price: 350000 }
    ],
    reviews: [
      {
        id: 301,
        reviewerName: 'Nadia Putri',
        rating: 5,
        comment: 'Ayam bakarnya empuk dan sambalnya pas. Pengantaran untuk acara kantor tepat waktu.',
        createdAt: '2026-11-19T11:15:00.000Z'
      }
    ]
  },
  {
    id: 4,
    name: 'Bengkel Motor Mas Joko 24 Jam',
    category: 'Otomotif',
    district: 'Kec. Antapani',
    address: 'Jl. Terusan Jakarta No. 215, samping Alfamart Antapani Tengah',
    latitude: -6.9158,
    longitude: 107.6612,
    openingHours: 'Buka 24 Jam',
    nextTaxDueDate: '2026-12-15',
    estimatedNextTax: 65000,
    distanceKm: 3.2,
    isVerified: false,
    isOpen: true,
    rating: 4.6,
    reviewCount: 41,
    whatsapp: '6282155667788',
    description:
      'Servis rutin motor matic & bebek, ganti oli asli, tune up injeksi, serta layanan darurat tambal ban panggilan area sekitar.',
    services: [
      { name: 'Tambal Ban Tubeless Panggilan', price: 30000 },
      { name: 'Servis Ringan + Ganti Oli Matic', price: 95000 },
      { name: 'Tune Up Injeksi & Bersih CVT', price: 120000 }
    ],
    reviews: []
  },
  {
    id: 5,
    name: 'Rumah Makan Sunda Mang Ujang',
    category: 'Kuliner & Katering',
    district: 'Kec. Sukajadi',
    address: 'Jl. Karang Tinggal No. 27, dekat PVJ, Kec. Sukajadi, Bandung',
    latitude: -6.8881,
    longitude: 107.5979,
    openingHours: '09.00 – 21.30 WIB',
    nextTaxDueDate: '2026-11-25',
    estimatedNextTax: 1850000,
    distanceKm: 1.0,
    isVerified: true,
    isOpen: true,
    rating: 4.9,
    reviewCount: 156,
    whatsapp: '6281299001122',
    imageUrl: '/images/kuliner-sunda.jpg',
    description:
      'Rumah makan khas Sunda dengan nasi liwet kastrol, gurame bakar cobek, dan lalapan segar untuk keluarga & rombongan.',
    services: [
      { name: 'Paket Nasi Liwet Ayam Kampung', price: 38000 },
      { name: 'Gurame Bakar Cobek Ukuran Besar', price: 92000 },
      { name: 'Paket Bancakan 4 Orang', price: 175000 }
    ],
    reviews: []
  },
  {
    id: 6,
    name: 'Warung Bakso & Mie Ayam Mas Hendra',
    category: 'Kuliner & Katering',
    district: 'Kec. Cicendo',
    address: 'Jl. Pasirkaliki No. 110, dekat Istana Plaza, Kec. Cicendo',
    latitude: -6.9045,
    longitude: 107.5982,
    openingHours: '10.00 – 21.00 WIB',
    nextTaxDueDate: '2026-12-02',
    estimatedNextTax: 780000,
    distanceKm: 1.9,
    isVerified: true,
    isOpen: true,
    rating: 4.7,
    reviewCount: 88,
    whatsapp: '6281344556677',
    imageUrl: '/images/kuliner-warung.jpg',
    description:
      'Rumah makan bakso urat daging sapi asli, mie ayam jamur, dan es campur segar yang ramai dikunjungi pekerja & pelajar.',
    services: [
      { name: 'Bakso Urat Spesial + Tetelan', price: 26000 },
      { name: 'Mie Ayam Jamur Pangsit', price: 22000 },
      { name: 'Paket Keluarga 5 Porsi', price: 115000 }
    ],
    reviews: []
  }
]

const MERCHANTS_KEY = 'merchants.json'

export async function getMerchants(): Promise<Merchant[]> {
  return await readCollection<Merchant>(MERCHANTS_KEY, initialMerchants)
}

export async function addMerchant(merchant: Merchant): Promise<Merchant> {
  const list = await getMerchants()
  list.push(merchant)
  await writeCollection(MERCHANTS_KEY, list)
  return merchant
}

export async function updateMerchantFlags(
  id: number,
  updates: { isVerified?: boolean; isOpen?: boolean }
): Promise<Merchant | null> {
  const list = await getMerchants()
  const target = list.find((item) => item.id === id)
  if (!target) return null

  if (typeof updates.isVerified === 'boolean') {
    target.isVerified = updates.isVerified
  }
  if (typeof updates.isOpen === 'boolean') {
    target.isOpen = updates.isOpen
  }

  await writeCollection(MERCHANTS_KEY, list)
  return target
}

export async function addMerchantReview(
  id: number,
  reviewInput: { reviewerName: string; rating: number; comment: string }
): Promise<{ merchant: Merchant; review: MerchantReview } | null> {
  const list = await getMerchants()
  const target = list.find((item) => item.id === id)
  if (!target) return null

  const review: MerchantReview = {
    id: Date.now(),
    reviewerName: reviewInput.reviewerName.trim(),
    rating: reviewInput.rating,
    comment: reviewInput.comment.trim(),
    createdAt: new Date().toISOString()
  }

  const totalScore = target.rating * target.reviewCount + review.rating
  target.reviewCount += 1
  target.rating = Number((totalScore / target.reviewCount).toFixed(1))
  target.reviews.unshift(review)

  await writeCollection(MERCHANTS_KEY, list)
  return { merchant: target, review }
}
