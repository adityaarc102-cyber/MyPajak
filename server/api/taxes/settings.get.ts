import { getTaxSettings } from '../../utils/tax-admin'

export default defineEventHandler(async () => {
  const settings = await getTaxSettings()
  return {
    success: true,
    data: settings
  }
})
