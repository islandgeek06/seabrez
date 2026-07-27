// Rasterizes assets/icon.svg into the PNG + ICO assets electron-builder needs.
//   node scripts/generate-icons.mjs
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = path.join(root, 'assets', 'icon.svg')
const svgBuf = await fs.readFile(svg)

// Master PNG (used for macOS/Linux and as the electron-builder fallback).
await sharp(svgBuf).resize(1024, 1024).png().toFile(path.join(root, 'assets', 'icon.png'))

// Multi-resolution ICO for Windows.
const sizes = [256, 128, 64, 48, 32, 16]
const pngBuffers = await Promise.all(
  sizes.map((s) => sharp(svgBuf).resize(s, s).png().toBuffer()),
)
const ico = await pngToIco(pngBuffers)
await fs.writeFile(path.join(root, 'assets', 'icon.ico'), ico)

console.log('Generated assets/icon.png and assets/icon.ico')
