import type { PrismaClient } from '@prisma/client'
import type { Permission } from '@/server/auth/permissions'

// The trash bin (Phase 1 step 2): admin-managed records are soft-deleted
// (deleted_at) and can be restored from /admin/papelera. Each entity that
// supports it is registered here.

export type TrashRow = { id: string; label: string; deletedAt: Date }
export type TrashType = {
  type: string
  label: string
  permission: Permission
  list(db: PrismaClient): Promise<TrashRow[]>
  restore(db: PrismaClient, id: string): Promise<void>
}

const deleted = { deletedAt: { not: null } } as const
const order = { deletedAt: 'desc' } as const

export const TRASH: TrashType[] = [
  {
    type: 'Product',
    label: 'Productos',
    permission: 'catalog.edit',
    list: async (db) => (await db.product.findMany({ where: deleted, orderBy: order, select: { id: true, name: true, code: true, deletedAt: true } })).map((r) => ({ id: r.id, label: `${r.name} (${r.code})`, deletedAt: r.deletedAt! })),
    restore: async (db, id) => void (await db.product.update({ where: { id }, data: { deletedAt: null } })),
  },
  {
    type: 'Brand',
    label: 'Marcas',
    permission: 'catalog.edit',
    list: async (db) => (await db.brand.findMany({ where: deleted, orderBy: order })).map((r) => ({ id: r.id, label: r.name, deletedAt: r.deletedAt! })),
    restore: async (db, id) => void (await db.brand.update({ where: { id }, data: { deletedAt: null } })),
  },
  {
    type: 'Category',
    label: 'Categorías',
    permission: 'catalog.edit',
    list: async (db) => (await db.category.findMany({ where: deleted, orderBy: order })).map((r) => ({ id: r.id, label: r.name, deletedAt: r.deletedAt! })),
    restore: async (db, id) => void (await db.category.update({ where: { id }, data: { deletedAt: null } })),
  },
  {
    type: 'Concern',
    label: 'Necesidades',
    permission: 'catalog.edit',
    list: async (db) => (await db.concern.findMany({ where: deleted, orderBy: order })).map((r) => ({ id: r.id, label: r.name, deletedAt: r.deletedAt! })),
    restore: async (db, id) => void (await db.concern.update({ where: { id }, data: { deletedAt: null } })),
  },
  {
    type: 'Ingredient',
    label: 'Ingredientes',
    permission: 'catalog.edit',
    list: async (db) => (await db.ingredient.findMany({ where: deleted, orderBy: order })).map((r) => ({ id: r.id, label: `${r.commonName} (${r.inciName})`, deletedAt: r.deletedAt! })),
    restore: async (db, id) => void (await db.ingredient.update({ where: { id }, data: { deletedAt: null } })),
  },
  {
    type: 'Page',
    label: 'Páginas',
    permission: 'content.edit',
    list: async (db) => (await db.page.findMany({ where: deleted, orderBy: order })).map((r) => ({ id: r.id, label: r.title, deletedAt: r.deletedAt! })),
    restore: async (db, id) => void (await db.page.update({ where: { id }, data: { deletedAt: null } })),
  },
  {
    type: 'Article',
    label: 'Journal',
    permission: 'content.edit',
    list: async (db) => (await db.article.findMany({ where: deleted, orderBy: order })).map((r) => ({ id: r.id, label: r.title, deletedAt: r.deletedAt! })),
    restore: async (db, id) => void (await db.article.update({ where: { id }, data: { deletedAt: null } })),
  },
  {
    type: 'MediaAsset',
    label: 'Imágenes',
    permission: 'media.manage',
    list: async (db) => (await db.mediaAsset.findMany({ where: { ...deleted, visibility: 'PUBLIC' }, orderBy: order })).map((r) => ({ id: r.id, label: r.fileName, deletedAt: r.deletedAt! })),
    restore: async (db, id) => void (await db.mediaAsset.update({ where: { id }, data: { deletedAt: null } })),
  },
]
