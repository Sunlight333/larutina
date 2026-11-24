import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AwsClient } from 'aws4fetch'

// Every file the platform stores goes through this interface (02 §4): R2
// buckets in production, a local directory in development and tests. Keys
// start with "public/" or "private/".

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

export type R2Config = {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  publicBucket: string
  privateBucket: string
}

/**
 * Cloudflare R2 through its S3 API. "public/…" keys go to the public bucket
 * and "private/…" keys to the private one, each without that first segment,
 * so the public bucket's own domain serves `<month>/<file>` directly.
 */
export class R2Storage implements StorageProvider {
  private readonly client: AwsClient

  constructor(private readonly config: R2Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: 'auto',
    })
  }

  url(key: string) {
    const [scope, ...rest] = key.split('/')
    const bucket = scope === 'public' ? this.config.publicBucket : scope === 'private' ? this.config.privateBucket : null
    if (!bucket || !rest.length || rest.some((p) => !p || p === '.' || p === '..')) throw new Error('Invalid storage key')
    const base = this.config.endpoint.replace(/\/+$/, '')
    return `${base}/${bucket}/${rest.map(encodeURIComponent).join('/')}`
  }

  async put(key: string, data: Buffer, contentType: string) {
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT',
      body: new Uint8Array(data),
      headers: { 'Content-Type': contentType || 'application/octet-stream' },
    })
    if (!res.ok) throw new Error(`R2 put failed (${res.status}): ${key}`)
  }

  async get(key: string) {
    const res = await this.client.fetch(this.url(key), { method: 'GET' })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`R2 get failed (${res.status}): ${key}`)
    return Buffer.from(await res.arrayBuffer())
  }

  async delete(key: string) {
    const res = await this.client.fetch(this.url(key), { method: 'DELETE' })
    // S3 answers 204 whether or not the object existed.
    if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed (${res.status}): ${key}`)
  }
}

/** R2 settings from the environment, or null when any is missing. */
export function r2ConfigFromEnv(env: Record<string, string | undefined> = process.env): R2Config | null {
  const config = {
    endpoint: env.R2_ENDPOINT ?? '',
    accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
    publicBucket: env.R2_PUBLIC_BUCKET ?? '',
    privateBucket: env.R2_PRIVATE_BUCKET ?? '',
  }
  return Object.values(config).every(Boolean) ? config : null
}

let instance: StorageProvider | undefined

/** R2 when it is configured (production), otherwise a local directory. */
export function storage(): StorageProvider {
  if (!instance) {
    const r2 = r2ConfigFromEnv()
    instance = r2 ? new R2Storage(r2) : new LocalDiskStorage(process.env.STORAGE_DIR ?? path.resolve('storage'))
  }
  return instance
}

/** For tests. */
export function setStorage(provider: StorageProvider) {
  instance = provider
}
