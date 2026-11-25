import { updateAdminAccountBiodata } from '../../utils/admin-accounts'
import {
  buildAdminSessionUser,
  requireAdminSession,
  setSignedSessionCookie
} from '../../utils/auth-session'
import { appendTaxAuditLog } from '../../utils/tax-admin'

interface UpdateBiodataPayload {
  fullName?: string
  nip?: string
  position?: string
  department?: string
  phone?: string
  address?: string
  newPassword?: string
  confirmPassword?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  const body = await readBody<UpdateBiodataPayload>(event)

  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
  const nip = typeof body?.nip === 'string' ? body.nip.trim() : ''
  const position = typeof body?.position === 'string' ? body.position.trim() : ''
  const department = typeof body?.department === 'string' ? body.department.trim() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const address = typeof body?.address === 'string' ? body.address.trim() : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword.trim() : ''
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
  if (newPassword && newPassword.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Kata sandi baru minimal 6 karakter.' })
  }
  if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Konfirmasi kata sandi baru tidak cocok.' })
  }

  const updated = await updateAdminAccountBiodata(session.email, {
    fullName,
    nip,
    position,
    department,
    phone,
    address,
    newPassword: newPassword || undefined
  })

  const nextSession = buildAdminSessionUser(updated)
  await setSignedSessionCookie(event, nextSession)

  await appendTaxAuditLog({
    action: 'Pembaruan Biodata Admin',
    targetName: updated.fullName,
    detail: `Biodata Admin (${updated.email} · NIP ${updated.nip} · ${updated.position}) disimpan & disahkan.`,
    actor: updated.email
  })

  return {
    success: true,
    message: `Biodata Admin "${updated.fullName}" berhasil disimpan!`,
    user: nextSession,
    account: updated
  }
})
