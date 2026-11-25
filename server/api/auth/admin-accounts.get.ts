import { listAdminAccounts } from '../../utils/admin-accounts'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  const accounts = await listAdminAccounts()

  return {
    success: true,
    accounts: accounts.map((acc) => ({
      id: acc.id,
      fullName: acc.fullName,
      email: acc.email,
      nip: acc.nip,
      position: acc.position,
      department: acc.department,
      phone: acc.phone,
      address: acc.address,
      profileCompleted: acc.profileCompleted
    }))
  }
})
