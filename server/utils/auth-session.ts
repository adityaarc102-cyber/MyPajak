import type { H3Event } from 'h3'
import type { AdminAccountPublic } from './admin-accounts'

export const SESSION_COOKIE_NAME = 'lokalverif_admin_session'
const SESSION_SECRET = 'mypajak-local-hmac-secret-2026-v3'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'admin_pajak'
  nip: string
  position: string
  department: string
  phone: string
  address: string
  profileCompleted: boolean
  loggedInAt: string
  adminVerified: boolean
  adminVerifiedAt: string | null
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const toBase64Url = (input: string): string => {
  const bytes = textEncoder.encode(input)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const fromBase64Url = (input: string): string => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return textDecoder.decode(bytes)
}

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

let cachedHmacKey: CryptoKey | null = null

const getHmacKey = async (): Promise<CryptoKey> => {
  if (cachedHmacKey) return cachedHmacKey
  cachedHmacKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return cachedHmacKey
}

const signPayload = async (payloadB64: string): Promise<string> => {
  const key = await getHmacKey()
  const sigBuffer = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payloadB64))
  return bytesToHex(new Uint8Array(sigBuffer))
}

const safeEquals = async (a: string, b: string): Promise<boolean> => {
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', textEncoder.encode(a)),
    crypto.subtle.digest('SHA-256', textEncoder.encode(b))
  ])
  const arrA = new Uint8Array(digestA)
  const arrB = new Uint8Array(digestB)
  if (arrA.length !== arrB.length) return false
  let diff = 0
  for (let i = 0; i < arrA.length; i += 1) {
    diff |= (arrA[i] ?? 0) ^ (arrB[i] ?? 0)
  }
  return diff === 0
}

export function buildAdminSessionUser(account: AdminAccountPublic): SessionUser {
  const now = new Date().toISOString()
  return {
    id: account.id,
    name: account.fullName,
    email: account.email,
    role: 'admin_pajak',
    nip: account.nip,
    position: account.position,
    department: account.department,
    phone: account.phone,
    address: account.address,
    profileCompleted: account.profileCompleted,
    loggedInAt: now,
    adminVerified: account.profileCompleted,
    adminVerifiedAt: account.profileCompleted ? now : null
  }
}

export async function setSignedSessionCookie(event: H3Event, user: SessionUser) {
  const payloadB64 = toBase64Url(JSON.stringify(user))
  const signature = await signPayload(payloadB64)
  const token = `${payloadB64}.${signature}`

  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8 // 8 jam
  })
}

export function clearSignedSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
}

export async function readSignedSession(event: H3Event): Promise<SessionUser | null> {
  const raw = getCookie(event, SESSION_COOKIE_NAME)
  if (!raw || typeof raw !== 'string') return null

  const dotIdx = raw.lastIndexOf('.')
  if (dotIdx <= 0) return null

  const payloadB64 = raw.slice(0, dotIdx)
  const providedSig = raw.slice(dotIdx + 1)
  const expectedSig = await signPayload(payloadB64)

  if (!(await safeEquals(providedSig, expectedSig))) {
    return null
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payloadB64)) as Partial<SessionUser>
    if (!parsed?.email || parsed.role !== 'admin_pajak') {
      return null
    }
    return {
      id: String(parsed.id || 'ADM-001'),
      name: String(parsed.name || 'Admin Pajak Daerah'),
      email: String(parsed.email),
      role: 'admin_pajak',
      nip: String(parsed.nip || ''),
      position: String(parsed.position || 'Petugas Pajak Daerah'),
      department: String(parsed.department || 'Unit Pelayanan Pajak Daerah — MyPajak'),
      phone: String(parsed.phone || ''),
      address: String(parsed.address || ''),
      profileCompleted: parsed.profileCompleted === true,
      loggedInAt: String(parsed.loggedInAt || new Date().toISOString()),
      adminVerified: parsed.adminVerified === true && parsed.profileCompleted === true,
      adminVerifiedAt:
        parsed.adminVerified === true && typeof parsed.adminVerifiedAt === 'string'
          ? parsed.adminVerifiedAt
          : null
    }
  } catch {
    return null
  }
}

export async function requireAdminSession(event: H3Event): Promise<SessionUser> {
  const user = await readSignedSession(event)
  if (!user || user.role !== 'admin_pajak') {
    throw createError({
      statusCode: 401,
      statusMessage: 'Sesi Admin Pajak diperlukan. Silakan login terlebih dahulu.'
    })
  }
  return user
}

export async function requireVerifiedAdmin(event: H3Event): Promise<SessionUser> {
  const user = await requireAdminSession(event)
  if (!user.profileCompleted || !user.adminVerified) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Silakan lengkapi & simpan biodata akun Admin Pajak terlebih dahulu.'
    })
  }
  return user
}
