import type { Permission } from '@/server/auth/permissions'
import type { SettingGroup } from '@/server/settings/registry'

export function groupPermission(group: SettingGroup): Permission {
  switch (group) {
    case 'brand':
    case 'company':
    case 'site':
    case 'commerce':
      return 'settings.brand'
    case 'catalog':
    case 'listing':
      return 'settings.catalog'
    case 'navigation':
    case 'copy':
      return 'settings.content'
  }
}
