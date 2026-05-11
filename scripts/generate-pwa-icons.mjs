import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(join(root, 'public/favicon.svg'))
await sharp(svg).resize(192, 192).png().toFile(join(root, 'public/pwa-192.png'))
await sharp(svg).resize(512, 512).png().toFile(join(root, 'public/pwa-512.png'))

console.log('PWA icons written: public/pwa-192.png, public/pwa-512.png')
