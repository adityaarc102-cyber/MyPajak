import { getMerchants } from '../utils/merchants'

export default defineEventHandler(async () => {
  const merchants = await getMerchants()

  return {
    success: true,
    total: merchants.length,
    data: merchants
  }
})
