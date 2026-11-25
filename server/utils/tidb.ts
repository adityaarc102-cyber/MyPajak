import mysql from 'mysql2/promise'
import type { Pool, RowDataPacket } from 'mysql2/promise'

interface TiDbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  ssl: boolean
}

let poolInstance: Pool | null = null
let initPromise: Promise<Pool | null> | null = null
let lastInitError: string | null = null

function getTiDbConfig(): TiDbConfig | null {
  const rc = useRuntimeConfig()
  const host = String(rc.tidbHost || '').trim()
  const user = String(rc.tidbUser || '').trim()
  const password = String(rc.tidbPassword || '').trim()
  const database = String(rc.tidbDatabase || 'mypajak').trim() || 'mypajak'
  const port = Number(rc.tidbPort || 4000) || 4000
  const ssl = String(rc.tidbSsl ?? 'true').toLowerCase() !== 'false'

  if (!host || !user || !password) {
    return null
  }

  return { host, port, user, password, database, ssl }
}

const sanitizeIdentifier = (name: string): string => name.replace(/[^a-zA-Z0-9_]/g, '') || 'mypajak'

async function initializePool(): Promise<Pool | null> {
  const cfg = getTiDbConfig()
  if (!cfg) {
    lastInitError = 'Konfigurasi NUXT_TIDB_* belum diisi di .env'
    return null
  }

  const dbName = sanitizeIdentifier(cfg.database)
  const sslOptions = cfg.ssl
    ? { minVersion: 'TLSv1.2' as const, rejectUnauthorized: true }
    : undefined

  try {
    // 1. Pastikan database aplikasi (mypajak) sudah terbuat di TiDB Cloud
    const bootstrapConn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      ssl: sslOptions,
      connectTimeout: 10000
    })

    try {
      await bootstrapConn.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      )
    } finally {
      await bootstrapConn.end()
    }

    // 2. Buat connection pool ke database target
    const pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: dbName,
      ssl: sslOptions,
      waitForConnections: true,
      connectionLimit: 8,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 10000
    })

    // 3. Buat tabel penyimpanan utama + tabel relasional rapi agar dapat dilihat langsung di TiDB Cloud
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mypajak_store (
        store_key VARCHAR(120) PRIMARY KEY,
        payload LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id VARCHAR(64) PRIMARY KEY,
        full_name VARCHAR(200) NOT NULL,
        nip VARCHAR(80) DEFAULT '',
        position VARCHAR(160) DEFAULT '',
        department VARCHAR(200) DEFAULT '',
        phone VARCHAR(60) DEFAULT '',
        address TEXT,
        email VARCHAR(190) NOT NULL,
        profile_completed TINYINT(1) DEFAULT 0,
        created_at VARCHAR(64) DEFAULT '',
        updated_at VARCHAR(64) DEFAULT ''
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS merchants (
        id BIGINT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(120) DEFAULT '',
        district VARCHAR(120) DEFAULT '',
        address TEXT,
        whatsapp VARCHAR(60) DEFAULT '',
        is_verified TINYINT(1) DEFAULT 0,
        is_open TINYINT(1) DEFAULT 1,
        rating DECIMAL(3,1) DEFAULT 0,
        estimated_next_tax BIGINT DEFAULT 0,
        next_tax_due_date VARCHAR(32) DEFAULT ''
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tax_records (
        id BIGINT PRIMARY KEY,
        billing_code VARCHAR(80) DEFAULT '',
        ntpn VARCHAR(80) DEFAULT NULL,
        merchant_name VARCHAR(200) NOT NULL,
        district VARCHAR(120) DEFAULT '',
        npwp VARCHAR(60) DEFAULT '',
        tax_type VARCHAR(120) DEFAULT '',
        period VARCHAR(32) DEFAULT '',
        gross_revenue BIGINT DEFAULT 0,
        tax_amount BIGINT DEFAULT 0,
        payment_method VARCHAR(100) DEFAULT '',
        status VARCHAR(80) DEFAULT '',
        is_archived TINYINT(1) DEFAULT 0,
        submitted_at VARCHAR(64) DEFAULT ''
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id BIGINT PRIMARY KEY,
        invoice_code VARCHAR(80) DEFAULT '',
        category VARCHAR(80) DEFAULT '',
        merchant_name VARCHAR(200) DEFAULT '',
        item_label VARCHAR(200) DEFAULT '',
        customer_name VARCHAR(160) DEFAULT '',
        total_paid BIGINT DEFAULT 0,
        payment_channel VARCHAR(100) DEFAULT '',
        status VARCHAR(60) DEFAULT 'Lunas',
        paid_at VARCHAR(64) DEFAULT ''
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id BIGINT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        merchant_name VARCHAR(200) DEFAULT '',
        category VARCHAR(80) DEFAULT '',
        amount BIGINT DEFAULT 0,
        due_date VARCHAR(32) DEFAULT '',
        status VARCHAR(40) DEFAULT 'Aktif',
        created_at VARCHAR(64) DEFAULT ''
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tax_audit_logs (
        id BIGINT PRIMARY KEY,
        action VARCHAR(160) NOT NULL,
        target_name VARCHAR(200) DEFAULT '',
        detail TEXT,
        actor VARCHAR(190) DEFAULT '',
        created_at VARCHAR(64) DEFAULT ''
      )
    `)

    poolInstance = pool
    lastInitError = null
    return pool
  } catch (err) {
    lastInitError = err instanceof Error ? err.message : String(err)
    console.error('[TiDB] Gagal inisialisasi koneksi TiDB Cloud:', lastInitError)
    return null
  }
}

export async function getTiDbPool(): Promise<Pool | null> {
  if (poolInstance) return poolInstance
  if (!initPromise) {
    initPromise = initializePool().finally(() => {
      if (!poolInstance) {
        initPromise = null
      }
    })
  }
  return await initPromise
}

export async function syncTiDbMirrorTable(storeKey: string, data: unknown): Promise<void> {
  const pool = await getTiDbPool()
  if (!pool || !Array.isArray(data)) return

  try {
    if (storeKey === 'admin-accounts.json') {
      await pool.query('DELETE FROM admin_accounts')
      for (const item of data as Record<string, unknown>[]) {
        await pool.query(
          `INSERT INTO admin_accounts
            (id, full_name, nip, position, department, phone, address, email, profile_completed, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(item.id || ''),
            String(item.fullName || ''),
            String(item.nip || ''),
            String(item.position || ''),
            String(item.department || ''),
            String(item.phone || ''),
            String(item.address || ''),
            String(item.email || ''),
            item.profileCompleted ? 1 : 0,
            String(item.createdAt || ''),
            String(item.updatedAt || '')
          ]
        )
      }
    } else if (storeKey === 'merchants.json') {
      await pool.query('DELETE FROM merchants')
      for (const item of data as Record<string, unknown>[]) {
        await pool.query(
          `INSERT INTO merchants
            (id, name, category, district, address, whatsapp, is_verified, is_open, rating, estimated_next_tax, next_tax_due_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(item.id || 0),
            String(item.name || ''),
            String(item.category || ''),
            String(item.district || ''),
            String(item.address || ''),
            String(item.whatsapp || ''),
            item.isVerified ? 1 : 0,
            item.isOpen ? 1 : 0,
            Number(item.rating || 0),
            Number(item.estimatedNextTax || 0),
            String(item.nextTaxDueDate || '')
          ]
        )
      }
    } else if (storeKey === 'taxes.json') {
      await pool.query('DELETE FROM tax_records')
      for (const item of data as Record<string, unknown>[]) {
        await pool.query(
          `INSERT INTO tax_records
            (id, billing_code, ntpn, merchant_name, district, npwp, tax_type, period, gross_revenue, tax_amount, payment_method, status, is_archived, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(item.id || 0),
            String(item.billingCode || ''),
            item.ntpn ? String(item.ntpn) : null,
            String(item.merchantName || ''),
            String(item.district || ''),
            String(item.npwp || ''),
            String(item.taxType || ''),
            String(item.period || ''),
            Number(item.grossRevenue || 0),
            Number(item.taxAmount || 0),
            String(item.paymentMethod || ''),
            String(item.status || ''),
            item.isArchived ? 1 : 0,
            String(item.submittedAt || '')
          ]
        )
      }
    } else if (storeKey === 'payments.json') {
      await pool.query('DELETE FROM payments')
      for (const item of data as Record<string, unknown>[]) {
        await pool.query(
          `INSERT INTO payments
            (id, invoice_code, category, merchant_name, item_label, customer_name, total_paid, payment_channel, status, paid_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(item.id || 0),
            String(item.invoiceCode || ''),
            String(item.category || ''),
            String(item.merchantName || ''),
            String(item.itemLabel || ''),
            String(item.customerName || ''),
            Number(item.totalPaid || 0),
            String(item.paymentChannel || ''),
            String(item.status || 'Lunas'),
            String(item.paidAt || '')
          ]
        )
      }
    } else if (storeKey === 'reminders.json') {
      await pool.query('DELETE FROM reminders')
      for (const item of data as Record<string, unknown>[]) {
        await pool.query(
          `INSERT INTO reminders
            (id, title, merchant_name, category, amount, due_date, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(item.id || 0),
            String(item.title || ''),
            String(item.merchantName || ''),
            String(item.category || ''),
            Number(item.amount || 0),
            String(item.dueDate || ''),
            String(item.status || 'Aktif'),
            String(item.createdAt || '')
          ]
        )
      }
    } else if (storeKey === 'tax-audit.json') {
      await pool.query('DELETE FROM tax_audit_logs')
      for (const item of data as Record<string, unknown>[]) {
        await pool.query(
          `INSERT INTO tax_audit_logs
            (id, action, target_name, detail, actor, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            Number(item.id || 0),
            String(item.action || ''),
            String(item.targetName || ''),
            String(item.detail || ''),
            String(item.actor || ''),
            String(item.createdAt || '')
          ]
        )
      }
    }
  } catch (err) {
    console.warn(`[TiDB] Gagal sinkron tabel mirror untuk ${storeKey}:`, err)
  }
}

export async function getTiDbHealthStatus() {
  const cfg = getTiDbConfig()
  const pool = await getTiDbPool()
  if (!pool || !cfg) {
    return {
      connected: false,
      engine: 'Local Fallback (Nitro FS)',
      host: cfg?.host || null,
      database: cfg?.database || null,
      error: lastInitError || 'TiDB tidak terkonfigurasi'
    }
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT DATABASE() AS db, VERSION() AS version, NOW() AS serverTime'
    )
    const [tableRows] = await pool.query<RowDataPacket[]>('SHOW TABLES')
    const tables = tableRows.map((row) => String(Object.values(row)[0] || ''))

    return {
      connected: true,
      engine: 'TiDB Cloud (MySQL2)',
      host: cfg.host,
      port: cfg.port,
      database: rows[0]?.db || cfg.database,
      version: rows[0]?.version || null,
      serverTime: rows[0]?.serverTime || null,
      tables
    }
  } catch (err) {
    return {
      connected: false,
      engine: 'TiDB Cloud (Error)',
      host: cfg.host,
      database: cfg.database,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}
