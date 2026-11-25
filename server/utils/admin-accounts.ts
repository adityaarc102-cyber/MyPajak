export interface AdminAccountPublic {
  id: string
  fullName: string
  nip: string
  position: string
  department: string
  phone: string
  address: string
  email: string
  profileCompleted: boolean
  createdAt: string
  updatedAt: string
}

interface AdminAccountStored extends AdminAccountPublic {
  passwordSalt: string
  passwordHash: string
}

const STORAGE_KEY = 'admin-accounts.json'
const textEncoder = new TextEncoder()

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

const randomHex = (byteLength: number): string => {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

const hashPassword = async (password: string, salt: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(`${salt}::${password}::mypajak-admin-v1`)
  )
  return bytesToHex(new Uint8Array(digest))
}

const safeEqualHex = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export const toPublicAdmin = (acc: AdminAccountStored): AdminAccountPublic => ({
  id: acc.id,
  fullName: acc.fullName,
  nip: acc.nip,
  position: acc.position,
  department: acc.department,
  phone: acc.phone,
  address: acc.address,
  email: acc.email,
  profileCompleted: acc.profileCompleted,
  createdAt: acc.createdAt,
  updatedAt: acc.updatedAt
})

async function createSeedAccount(): Promise<AdminAccountStored> {
  const salt = 'seed-admin-mypajak-2026'
  const passwordHash = await hashPassword('pajak2026', salt)
  const now = '2026-11-01T08:00:00.000Z'
  return {
    id: 'ADM-001',
    fullName: 'Admin Pajak Daerah',
    nip: '',
    position: 'Petugas Verifikator Pajak',
    department: 'Unit Pelayanan Pajak Daerah — MyPajak',
    phone: '',
    address: '',
    email: 'admin@mypajak.id',
    profileCompleted: false,
    createdAt: now,
    updatedAt: now,
    passwordSalt: salt,
    passwordHash
  }
}

async function readAccounts(): Promise<AdminAccountStored[]> {
  const storage = useStorage('db')
  const saved = await storage.getItem<AdminAccountStored[]>(STORAGE_KEY)
  if (Array.isArray(saved) && saved.length > 0) {
    return saved
  }
  const seeded = [await createSeedAccount()]
  await storage.setItem(STORAGE_KEY, seeded)
  return seeded
}

async function writeAccounts(accounts: AdminAccountStored[]): Promise<void> {
  const storage = useStorage('db')
  await storage.setItem(STORAGE_KEY, accounts)
}

export async function listAdminAccounts(): Promise<AdminAccountPublic[]> {
  const accounts = await readAccounts()
  return accounts.map(toPublicAdmin)
}

export async function findAdminAccountByEmail(email: string): Promise<AdminAccountPublic | null> {
  const normalized = email.trim().toLowerCase()
  const accounts = await readAccounts()
  const found = accounts.find((a) => a.email.toLowerCase() === normalized)
  return found ? toPublicAdmin(found) : null
}

export async function authenticateAdminAccount(
  identifier: string,
  password: string
): Promise<AdminAccountPublic | null> {
  const normalized = identifier.trim().toLowerCase()
  const cleanPassword = password.trim()
  const accounts = await readAccounts()

  const lookupEmail =
    normalized === 'admin' || normalized === 'admin@lokalverif.id'
      ? 'admin@mypajak.id'
      : normalized

  const matched = accounts.find(
    (a) => a.email.toLowerCase() === lookupEmail || (a.nip && a.nip.toLowerCase() === normalized)
  )

  if (!matched) return null

  const computedHash = await hashPassword(cleanPassword, matched.passwordSalt)
  if (!safeEqualHex(computedHash, matched.passwordHash)) {
    return null
  }

  return toPublicAdmin(matched)
}

export interface RegisterAdminInput {
  fullName: string
  nip: string
  position: string
  department: string
  phone: string
  address: string
  email: string
  password: string
}

export async function registerAdminAccount(input: RegisterAdminInput): Promise<AdminAccountPublic> {
  const accounts = await readAccounts()
  const normalizedEmail = input.email.trim().toLowerCase()

  if (accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Email admin ini sudah terdaftar. Silakan masuk atau gunakan email lain.'
    })
  }

  const normalizedNip = input.nip.trim()
  if (normalizedNip && accounts.some((a) => a.nip && a.nip.toLowerCase() === normalizedNip.toLowerCase())) {
    throw createError({
      statusCode: 409,
      statusMessage: 'NIP / ID Petugas ini sudah terdaftar pada akun admin lain.'
    })
  }

  const salt = randomHex(12)
  const passwordHash = await hashPassword(input.password.trim(), salt)
  const now = new Date().toISOString()
  const nextNumber = String(accounts.length + 1).padStart(3, '0')

  const created: AdminAccountStored = {
    id: `ADM-${nextNumber}`,
    fullName: input.fullName.trim(),
    nip: normalizedNip,
    position: input.position.trim(),
    department: input.department.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    email: normalizedEmail,
    profileCompleted: true,
    createdAt: now,
    updatedAt: now,
    passwordSalt: salt,
    passwordHash
  }

  accounts.unshift(created)
  await writeAccounts(accounts)
  return toPublicAdmin(created)
}

export interface UpdateAdminBiodataInput {
  fullName: string
  nip: string
  position: string
  department: string
  phone: string
  address: string
  newPassword?: string
}

export async function updateAdminAccountBiodata(
  currentEmail: string,
  input: UpdateAdminBiodataInput
): Promise<AdminAccountPublic> {
  const accounts = await readAccounts()
  const normalizedEmail = currentEmail.trim().toLowerCase()
  const idx = accounts.findIndex((a) => a.email.toLowerCase() === normalizedEmail)

  if (idx === -1) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Akun Admin Pajak tidak ditemukan.'
    })
  }

  const existing = accounts[idx]!
  const normalizedNip = input.nip.trim()

  if (
    normalizedNip &&
    accounts.some(
      (a, i) => i !== idx && a.nip && a.nip.toLowerCase() === normalizedNip.toLowerCase()
    )
  ) {
    throw createError({
      statusCode: 409,
      statusMessage: 'NIP / ID Petugas sudah digunakan oleh akun admin lain.'
    })
  }

  let passwordSalt = existing.passwordSalt
  let passwordHash = existing.passwordHash
  if (input.newPassword && input.newPassword.trim().length > 0) {
    passwordSalt = randomHex(12)
    passwordHash = await hashPassword(input.newPassword.trim(), passwordSalt)
  }

  const updated: AdminAccountStored = {
    ...existing,
    fullName: input.fullName.trim(),
    nip: normalizedNip,
    position: input.position.trim(),
    department: input.department.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    profileCompleted: true,
    updatedAt: new Date().toISOString(),
    passwordSalt,
    passwordHash
  }

  accounts[idx] = updated
  await writeAccounts(accounts)
  return toPublicAdmin(updated)
}
