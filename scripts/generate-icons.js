// scripts/generate-icons.js
// Generates solid dark-background PNG icons for the PWA manifest.
// Pure Node.js — no dependencies.
// Run: node scripts/generate-icons.js

const { writeFileSync, mkdirSync } = require('fs')
const zlib = require('zlib')

// CRC32 — required by PNG format
const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[i] = c >>> 0
}
function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff]
  return ((crc ^ 0xffffffff) >>> 0)
}

function makeChunk(type, data) {
  const typeB = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeB, data])))
  return Buffer.concat([len, typeB, data, crcBuf])
}

function makeSolidPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)  // width
  ihdr.writeUInt32BE(size, 4)  // height
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // colour type: RGB truecolour

  // One scanline: filter byte (0 = None) + R G B per pixel
  const row = Buffer.alloc(1 + size * 3)
  row[0] = 0
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r
    row[2 + x * 3] = g
    row[3 + x * 3] = b
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  const idat = zlib.deflateSync(raw)

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('client/public', { recursive: true })

// Background colour: #111827 = rgb(17, 24, 39)
const png192 = makeSolidPNG(192, 17, 24, 39)
const png512 = makeSolidPNG(512, 17, 24, 39)

writeFileSync('client/public/icon-192.png', png192)
writeFileSync('client/public/icon-512.png', png512)

console.log('Generated client/public/icon-192.png and client/public/icon-512.png')
