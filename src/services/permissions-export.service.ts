/**
 * Permissions Export Service
 *
 * Handles multi-sheet Excel export for roles and permissions data.
 * Creates one overview sheet with role summaries and individual sheets
 * for each role showing detailed permissions.
 */

import type { Role, RolePermission } from '../api/services/permissions.service'
import { logger } from '../utils/logger'

const log = logger.api

// Lazy load Excel library
let XLSXUtils: any
let writeXLSX: any

async function loadXLSXLibrary() {
  if (!XLSXUtils || !writeXLSX) {
    const xlsx = await import('xlsx')
    XLSXUtils = xlsx.utils
    writeXLSX = xlsx.write
  }
  return { XLSXUtils, writeXLSX }
}

/**
 * Generate multi-sheet Excel workbook for roles and permissions
 *
 * Sheet 1: Roles Overview (name, description, external, link to detail sheet)
 * Sheet 2+: Individual role sheets with permission details
 */
export async function generatePermissionsExcel(
  roles: Role[],
  rolePermissions: RolePermission[]
): Promise<ArrayBuffer> {
  const { XLSXUtils: utils, writeXLSX: write } = await loadXLSXLibrary()

  log.debug('Generating permissions Excel export', {
    roleCount: roles.length,
    permissionCount: rolePermissions.length
  })

  // Create new workbook
  const workbook = utils.book_new()

  // ===== SHEET 1: Roles Overview =====
  const overviewData = [
    ['Roles Overview', '', ''], // Title row
    ['', '', ''], // Blank row
    ['Role Name', 'Description', 'External'] // Header row
  ]

  // Add role data
  roles.forEach(role => {
    overviewData.push([
      role.name ?? '',
      role.description ?? '',
      role.external ? 'Yes' : 'No'
    ])
  })

  const overviewSheet = utils.aoa_to_sheet(overviewData)

  // Set column widths for overview sheet
  overviewSheet['!cols'] = [
    { wch: 30 }, // Role Name
    { wch: 50 }, // Description
    { wch: 10 }  // External
  ]

  utils.book_append_sheet(workbook, overviewSheet, 'Roles Overview')

  // ===== SHEET 2+: Individual Role Sheets =====
  roles.forEach(role => {
    // Get permissions for this role
    const rolesPermissions = rolePermissions.filter(
      p => p.roleId === role._id || p.roleName === role.name
    )

    // Build permission data for this role
    const roleSheetData: any[][] = [
      [role.name], // Title row with role name
      ['Description:', role.description ?? ''], // Description
      ['External:', role.external ? 'Yes' : 'No'], // External flag
      [], // Blank row
      ['Module/Permission', 'Category', 'Create', 'Read', 'Update', 'Delete', 'Export'] // Header row
    ]

    // Add permissions
    rolesPermissions.forEach(permission => {
      // Map legacy API fields: view -> read, remove -> delete
      const perms = permission.permissions || {}
      const create = perms.create ? '✓' : '✗'
      const read = (perms.read || perms.view) ? '✓' : '✗'
      const update = perms.update ? '✓' : '✗'
      const deleteVal = (perms.delete || perms.remove) ? '✓' : '✗'
      const exportVal = perms.export ? '✓' : '✗'

      roleSheetData.push([
        permission.module ?? '',
        permission.category ?? '',
        create,
        read,
        update,
        deleteVal,
        exportVal
      ])

      // Add sub-permissions (indented)
      if (permission.subPermissions && permission.subPermissions.length > 0) {
        permission.subPermissions.forEach(subPerm => {
          const subPerms = subPerm.permissions || {}
          const subCreate = subPerms.create ? '✓' : '✗'
          const subRead = (subPerms.read || subPerms.view) ? '✓' : '✗'
          const subUpdate = subPerms.update ? '✓' : '✗'
          const subDelete = (subPerms.delete || subPerms.remove) ? '✓' : '✗'
          const subExport = subPerms.export ? '✓' : '✗'

          roleSheetData.push([
            `  ${subPerm.module ?? ''}`, // Indented with spaces
            subPerm.category ?? '',
            subCreate,
            subRead,
            subUpdate,
            subDelete,
            subExport
          ])
        })
      }
    })

    // Handle account access permissions (special highlighting if needed)
    const accountPerms = rolesPermissions.filter(p =>
      p.module && p.module.startsWith('c_accounts_')
    )
    if (accountPerms.length > 0) {
      roleSheetData.push([]) // Blank row
      roleSheetData.push(['Account Access Permissions', '', '', '', '', '', ''])
      accountPerms.forEach(perm => {
        roleSheetData.push([
          perm.module ?? '',
          perm.category ?? '',
          perm.permissions?.create ? '✓' : '✗',
          (perm.permissions?.read || perm.permissions?.view) ? '✓' : '✗',
          perm.permissions?.update ? '✓' : '✗',
          (perm.permissions?.delete || perm.permissions?.remove) ? '✓' : '✗',
          perm.permissions?.export ? '✓' : '✗'
        ])
      })
    }

    // Create worksheet from data
    const roleSheet = utils.aoa_to_sheet(roleSheetData)

    // Set column widths
    roleSheet['!cols'] = [
      { wch: 30 }, // Module/Permission
      { wch: 20 }, // Category
      { wch: 8 },  // Create
      { wch: 8 },  // Read
      { wch: 8 },  // Update
      { wch: 8 },  // Delete
      { wch: 8 }   // Export
    ]

    // Sanitize sheet name (max 31 chars, no special chars)
    const sheetName = role.name
      .substring(0, 31)
      .replace(/[:\\/\[\]*?]/g, '_')

    utils.book_append_sheet(workbook, roleSheet, sheetName)
  })

  log.debug('Permissions Excel workbook generated', {
    sheetCount: workbook.SheetNames?.length ?? 0,
    roles: roles.map(r => r.name).join(', ')
  })

  // Generate Excel file
  return write(workbook, {
    type: 'array',
    bookType: 'xlsx',
    compression: true
  })
}

/**
 * Simple single-sheet export for CSV/JSON compatibility
 * Flattens all permissions into a single table
 */
export function generatePermissionsFlatData(
  roles: Role[],
  rolePermissions: RolePermission[]
): Record<string, any>[] {
  const flatData: Record<string, any>[] = []

  roles.forEach(role => {
    const rolePerms = rolePermissions.filter(
      p => p.roleId === role._id || p.roleName === role.name
    )

    rolePerms.forEach(permission => {
      const perms = permission.permissions || {}

      flatData.push({
        'Role Name': role.name ?? '',
        'Role Description': role.description ?? '',
        'External': role.external ? 'Yes' : 'No',
        'Module': permission.module ?? '',
        'Category': permission.category ?? '',
        'Create': perms.create ? 'Yes' : 'No',
        'Read': (perms.read || perms.view) ? 'Yes' : 'No',
        'Update': perms.update ? 'Yes' : 'No',
        'Delete': (perms.delete || perms.remove) ? 'Yes' : 'No',
        'Export': perms.export ? 'Yes' : 'No'
      })
    })
  })

  return flatData
}
