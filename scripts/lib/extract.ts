import { Readable } from 'node:stream'
import yauzl from 'yauzl'

export function openZipEntry(zipPath: string, fileName: string): Promise<Readable> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err ?? new Error('yauzl returned no zipfile'))
      let found = false
      zipfile.on('entry', (entry) => {
        if (entry.fileName === fileName) {
          found = true
          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr || !readStream) return reject(streamErr ?? new Error('no stream'))
            resolve(readStream)
          })
        } else {
          zipfile.readEntry()
        }
      })
      zipfile.on('end', () => {
        if (!found) reject(new Error(`File not found in zip: ${fileName}`))
      })
      zipfile.on('error', reject)
      zipfile.readEntry()
    })
  })
}

export async function readTextFromZip(zipPath: string, fileName: string): Promise<string> {
  const stream = await openZipEntry(zipPath, fileName)
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf-8')
}
