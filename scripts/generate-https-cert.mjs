import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import forge from 'node-forge'

const certDir = path.resolve(process.cwd(), 'certs')
const certPath = path.join(certDir, 'dev-cert.pem')
const keyPath = path.join(certDir, 'dev-key.pem')
const metaPath = path.join(certDir, 'cert-ips.json')

function getActiveLanIPv4s() {
  const nets = os.networkInterfaces()
  const ips = new Set(['127.0.0.1'])
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const isV4 = net.family === 'IPv4' || net.family === 4
      if (isV4 && !net.internal && !net.address.startsWith('169.254.')) {
        ips.add(net.address)
      }
    }
  }
  return Array.from(ips).sort()
}

const currentIps = getActiveLanIPv4s()

// Lewati pembuatan ulang jika sertifikat sudah ada, belum kedaluwarsa, dan mencakup seluruh IP Wi-Fi aktif saat ini
let shouldRegenerate = true
if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(metaPath)) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    const sameIps =
      Array.isArray(meta.ips) &&
      meta.ips.length === currentIps.length &&
      meta.ips.every((ip, idx) => ip === currentIps[idx])
    const notExpiringSoon = typeof meta.expiresAt === 'number' && meta.expiresAt > Date.now() + 7 * 24 * 60 * 60 * 1000
    if (sameIps && notExpiringSoon) {
      shouldRegenerate = false
    }
  } catch {
    shouldRegenerate = true
  }
}

if (shouldRegenerate) {
  fs.mkdirSync(certDir, { recursive: true })

  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = String(Date.now())

  const now = new Date()
  const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  cert.validity.notBefore = new Date(now.getTime() - 60 * 60 * 1000)
  cert.validity.notAfter = expires

  const attrs = [
    { name: 'commonName', value: 'MyPajak Local HTTPS' },
    { name: 'organizationName', value: 'MyPajak Dev' }
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)

  const altNames = [
    { type: 2, value: 'localhost' },
    ...currentIps.map((ip) => ({ type: 7, ip }))
  ]

  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true
    },
    {
      name: 'subjectAltName',
      altNames
    }
  ])

  cert.sign(keys.privateKey, forge.md.sha256.create())

  fs.writeFileSync(certPath, forge.pki.certificateToPem(cert), 'utf8')
  fs.writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey), 'utf8')
  fs.writeFileSync(
    metaPath,
    JSON.stringify({ ips: currentIps, expiresAt: expires.getTime() }, null, 2),
    'utf8'
  )
  console.log(`[HTTPS] Sertifikat TLS berhasil dibuat untuk: localhost, ${currentIps.join(', ')}`)
} else {
  console.log(`[HTTPS] Menggunakan sertifikat TLS aktif untuk: localhost, ${currentIps.join(', ')}`)
}

const wifiIps = currentIps.filter((ip) => ip !== '127.0.0.1')
console.log('[HTTPS] Akses dari Laptop : https://localhost:3000/')
for (const ip of wifiIps) {
  console.log(`[HTTPS] Akses dari HP WiFi: https://${ip}:3000/`)
}
