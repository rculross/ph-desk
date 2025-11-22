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
  rolePermissions: RolePermission[],
  users: any[] = []
): Promise<ArrayBuffer> {
  const { XLSXUtils: utils, writeXLSX: write } = await loadXLSXLibrary()

  log.debug('Generating permissions Excel export', {
    roleCount: roles.length,
    permissionCount: rolePermissions.length,
    userCount: users.length,
    sampleRole: roles[0],
    samplePermission: rolePermissions[0]
  })

  // Count active users per role
  const userCountByRole: Record<string, number> = {}
  users.forEach(user => {
    if (user.isActive && user.role?._id) {
      const roleId = user.role._id
      userCountByRole[roleId] = (userCountByRole[roleId] || 0) + 1
    }
  })

  // Create new workbook
  const workbook = utils.book_new()

  // ===== SHEET 1: Roles Overview =====
  const overviewData = [
    ['Roles Overview', '', '', ''], // Title row
    ['', '', '', ''], // Blank row
    ['Role Name', 'Description', 'External', 'Total Users'] // Header row
  ]

  // Add role data
  roles.forEach(role => {
    const userCount = userCountByRole[role._id] || 0
    overviewData.push([
      role.name ?? '',
      role.description ?? '',
      role.external ? 'Yes' : null,
      userCount
    ])
  })

  const overviewSheet = utils.aoa_to_sheet(overviewData)

  // Add hyperlinks to role names (starting from row 4, which is row index 3)
  roles.forEach((role, index) => {
    const rowNum = index + 4 // +3 for header rows, +1 for 1-based indexing
    const cellRef = `A${rowNum}`
    const sheetName = role.name.substring(0, 31).replace(/[:\\/\[\]*?]/g, '_')

    // Add hyperlink
    if (!overviewSheet[cellRef]) {
      overviewSheet[cellRef] = {}
    }
    overviewSheet[cellRef].l = {
      Target: `#'${sheetName}'!A1`,
      Tooltip: `View ${role.name} permissions`
    }
    // Ensure the cell has the text value
    overviewSheet[cellRef].v = role.name ?? ''
    overviewSheet[cellRef].t = 's' // String type
  })

  // Set column widths for overview sheet
  overviewSheet['!cols'] = [
    { wch: 30 }, // Role Name
    { wch: 50 }, // Description
    { wch: 10 }, // External
    { wch: 12 }  // Total Users
  ]

  utils.book_append_sheet(workbook, overviewSheet, 'Roles Overview')

  // ===== SHEET 2: Permissions Comparison =====
  // Create a matrix showing all permissions across all roles
  const comparisonData: any[][] = [
    ['Permissions Comparison - All Roles'], // Title
    [], // Blank row
  ]

  // Build header row: Permission Name | Category | Role1 | Role2 | Role3...
  const headerRow = ['Permission Name', 'Category', ...roles.map(r => r.name ?? '')]
  comparisonData.push(headerRow)

  // Get all unique permissions across all roles
  const allPermissions = new Map<string, { name: string; category: string }>()
  rolePermissions.forEach(perm => {
    const key = perm.module ?? ''
    if (!allPermissions.has(key)) {
      allPermissions.set(key, {
        name: perm.module ?? '',
        category: perm.category ?? ''
      })
    }
  })

  // Sort permissions by category, then by name
  const sortedPermissions = Array.from(allPermissions.values()).sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category)
    }
    return a.name.localeCompare(b.name)
  })

  // Build comparison matrix
  sortedPermissions.forEach(perm => {
    const row: any[] = [perm.name, perm.category]

    // For each role, check if they have this permission and what level
    roles.forEach(role => {
      const rolePerms = rolePermissions.filter(
        p => (p.roleId === role._id || p.roleName === role.name) && p.module === perm.name
      )

      if (rolePerms.length === 0) {
        row.push(null) // No permission
      } else {
        const permissions = rolePerms[0].permissions || {}
        const isWorkflow = perm.category === 'Workflow'
        const isAccountAccess = perm.category === 'Account Access'

        if (isWorkflow || isAccountAccess) {
          // Workflow or Account Access: just Yes or blank
          row.push(permissions.enabled ? 'Yes' : null)
        } else {
          // Model: Show CVURE code (Create, View, Update, Remove, Export)
          let code = ''
          if (permissions.create) code += 'C'
          if (permissions.read || permissions.view) code += 'V'
          if (permissions.update) code += 'U'
          if (permissions.delete || permissions.remove) code += 'R'
          if (permissions.export) code += 'E'
          row.push(code || null)
        }
      }
    })

    comparisonData.push(row)
  })

  const comparisonSheet = utils.aoa_to_sheet(comparisonData)

  // Set column widths for comparison sheet
  const comparisonCols = [
    { wch: 35 }, // Permission Name
    { wch: 15 }, // Category
    ...roles.map(() => ({ wch: 12 })) // Each role column
  ]
  comparisonSheet['!cols'] = comparisonCols

  // Freeze panes: freeze first 2 columns and first 3 rows
  comparisonSheet['!freeze'] = { xSplit: 2, ySplit: 3 }

  utils.book_append_sheet(workbook, comparisonSheet, 'Comparison')

  // ===== SHEET 3+: Individual Role Sheets =====
  roles.forEach(role => {
    // Get permissions for this role
    const rolesPermissions = rolePermissions.filter(
      p => p.roleId === role._id || p.roleName === role.name
    )

    // Find the active Account Access permission (mutually exclusive, only one should be enabled)
    const accountAccessPerm = rolesPermissions.find(
      p => p.category === 'Account Access' && p.permissions?.enabled
    )
    const accountAccessName = accountAccessPerm?.module || 'None'

    // Filter out Account Access permissions from the main table
    const nonAccountAccessPerms = rolesPermissions.filter(
      p => p.category !== 'Account Access'
    )

    // Build permission data for this role
    const roleSheetData: any[][] = [
      [role.name], // Title row with role name
      ['Description:', role.description ?? ''], // Description
      ['External:', role.external ? 'Yes' : null], // External flag
      ['Account Access:', accountAccessName], // Account Access (mutually exclusive)
      [], // Blank row
      ['Permission Name', 'Category', 'Create', 'Read', 'Update', 'Delete', 'Export'] // Header row
    ]

    // Add permissions (excluding Account Access which is in the header)
    nonAccountAccessPerms.forEach(permission => {
      const perms = permission.permissions || {}
      const moduleName = permission.module ?? ''
      const category = permission.category ?? ''
      const isWorkflow = category === 'Workflow'

      // Workflow permissions: only Create column based on enabled flag
      // Model permissions: standard CRUD columns
      let create: string | null
      let read: string | null
      let update: string | null
      let deleteVal: string | null
      let exportVal: string | null

      if (isWorkflow) {
        // Workflow permission: Create = enabled, all others null
        create = perms.enabled ? 'Yes' : null
        read = null
        update = null
        deleteVal = null
        exportVal = null
      } else {
        // Model permission: Map legacy API fields: view -> read, remove -> delete
        create = perms.create ? 'Yes' : null
        read = (perms.read || perms.view) ? 'Yes' : null
        update = perms.update ? 'Yes' : null
        deleteVal = (perms.delete || perms.remove) ? 'Yes' : null
        exportVal = perms.export ? 'Yes' : null
      }

      roleSheetData.push([
        moduleName,
        category,
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
          const subModuleName = subPerm.module ?? ''
          const subCategory = subPerm.category ?? ''
          const subIsWorkflow = subCategory === 'Workflow'

          let subCreate: string | null
          let subRead: string | null
          let subUpdate: string | null
          let subDelete: string | null
          let subExport: string | null

          if (subIsWorkflow) {
            // Workflow sub-permission: Create = enabled, all others null
            subCreate = subPerms.enabled ? 'Yes' : null
            subRead = null
            subUpdate = null
            subDelete = null
            subExport = null
          } else {
            // Model sub-permission: standard CRUD
            subCreate = subPerms.create ? 'Yes' : null
            subRead = (subPerms.read || subPerms.view) ? 'Yes' : null
            subUpdate = subPerms.update ? 'Yes' : null
            subDelete = (subPerms.delete || subPerms.remove) ? 'Yes' : null
            subExport = subPerms.export ? 'Yes' : null
          }

          roleSheetData.push([
            `  ${subModuleName}`, // Indented with spaces
            subCategory,
            subCreate,
            subRead,
            subUpdate,
            subDelete,
            subExport
          ])
        })
      }
    })

    // Account access permissions are already included in the main list
    // No need for a separate section since they're categorized as "Account Access"

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
      const moduleName = permission.module ?? ''
      const category = permission.category ?? ''
      const isWorkflow = category === 'Workflow'

      // Workflow permissions: only Create column based on enabled flag
      // Model permissions: standard CRUD columns
      let create: string | null
      let read: string | null
      let update: string | null
      let deleteVal: string | null
      let exportVal: string | null

      if (isWorkflow) {
        // Workflow permission: Create = enabled, all others null
        create = perms.enabled ? 'Yes' : null
        read = null
        update = null
        deleteVal = null
        exportVal = null
      } else {
        // Model permission: standard CRUD
        create = perms.create ? 'Yes' : null
        read = (perms.read || perms.view) ? 'Yes' : null
        update = perms.update ? 'Yes' : null
        deleteVal = (perms.delete || perms.remove) ? 'Yes' : null
        exportVal = perms.export ? 'Yes' : null
      }

      flatData.push({
        'Role Name': role.name ?? '',
        'Role Description': role.description ?? '',
        'External': role.external ? 'Yes' : null,
        'Permission Name': moduleName,
        'Category': category,
        'Create': create,
        'Read': read,
        'Update': update,
        'Delete': deleteVal,
        'Export': exportVal
      })
    })
  })

  return flatData
}
