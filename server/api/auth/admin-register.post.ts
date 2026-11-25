import { registerAdminAccount } from '../../utils/admin-accounts'
import { buildAdminSessionUser, setSignedSessionCookie } from '../../utils/auth-session'
import { appendTaxAuditLog } from '../../utils/tax-admin'

interface RegisterAdminPayload {
  fullName?: string
  nip?: string
  position?: string
  department?: string
  phone?: string
  address?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterAdminPayload>(event)

  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
  const nip = typeof body?.nip === 'string' ? body.nip.trim() : ''
  const position = typeof body?.position === 'string' ? body.position.trim() : ''
  const department = typeof body?.department === 'string' ? body.department.trim() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const address = typeof body?.address === 'string' ? body.address.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password.trim() : ''
  const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword.trim() : ''

  if (fullName.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Nama lengkap admin minimal 3 karakter.' })
  }
  if (nip.length < 4) {
    throw createError({ statusCode: 400, statusMessage: 'NIP / ID Petugas minimal 4 karakter.' })
  }
  if (position.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Jabatan petugas pajak wajib diisi.' })
  }
  if (department.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Unit kerja / instansi wajib diisi.' })
  }
  if (phone.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Nomor HP / WhatsApp minimal 8 digit.' })
  }
  if (address.length < 5) {
    throw createError({ statusCode: 400, statusMessage: 'Alamat kantor / domisili minimal 5 karakter.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Format email akun admin tidak valid.' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Kata sandi akun admin minimal 6 karakter.' })
  }
  if (confirmPassword && password !== confirmPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Konfirmasi kata sandi tidak cocok.' })
  }

  const account = await registerAdminAccount({
    fullName,
    nip,
    position,
    department,
    phone,
    address,
    email,
    password
  })

  const sessionUser = buildAdminSessionUser(account)
  await setSignedSessionCookie(event, sessionUser)

  await appendTaxAuditLog({
    action: 'Pendaftaran Akun Admin',
    targetName: account.fullName,
    detail: `Akun khusus Admin Pajak (${account.email} · NIP ${account.nip} · ${account.position}) berhasil dibuat dan disimpan.`,
    actor: account.email
  })

  return {
    success: true,
    message: `Akun & biodata Admin "${account.fullName}" berhasil disimpan!`,
    user: sessionUser,
    account
  }
})
