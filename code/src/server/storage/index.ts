import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Every file the platform stores goes through this interface (02 §4), so the
// local volume of Phase 1 can be swapped for S3-compatible buckets without
// touching callers. Keys start with "public/" or "private/".

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<Buffer | null>
  delete(key: string): Promise<void>
}

/** A directory on disk: the `media` volume in production (deploy/compose.yaml). */
export class LocalDiskStorage implements StorageProvider {
  constructor(private readonly root: string) {}

  private file(key: string) {
    const resolved = path.resolve(this.root, key)
    if (!resolved.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid storage key')
    return resolved
  }

  // The content type matters to object storage, not to a file on disk.
  async put(key: string, data: Buffer, _contentType?: string) {
    const file = this.file(key)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, data)
  }

  async get(key: string) {
    try {
      return await readFile(this.file(key))
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw e
    }
  }

  async delete(key: string) {
    await rm(this.file(key), { force: true })
  }
}

let instance: StorageProvider | undefined

export function storage(): StorageProvider {
  instance ??= new LocalDiskStorage(process.env.STORAGE_DIR ?? path.resolve('storage'))
  return instance
}

/** For tests. */
export function setStorage(provider: StorageProvider) {
  instance = provider
}
