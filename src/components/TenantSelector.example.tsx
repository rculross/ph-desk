/**
 * TenantSelector Component Usage Example
 * 
 * This file demonstrates how to use the TenantSelector component
 * in different contexts within the extension.
 */

import React from 'react'

import type { TenantOption } from '../hooks/useTenantSelector'
import { logger } from '../utils/logger'

import { TenantSelector } from './TenantSelector'

// Example usage in a header/toolbar
export const HeaderExample: React.FC = () => {
  const handleTenantChange = (tenant: TenantOption) => {
    logger.extension.info('Tenant changed to:', tenant.name)
    // Handle any additional logic when tenant changes
  }

  return (
    <div className="flex items-center justify-between p-4 bg-background border-b">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Planhat Extension</h1>
      </div>
      
      {/* TenantSelector in the top-right corner */}
      <TenantSelector 
        size="md"
        showLogo={true}
        showPlan={false}
        onTenantChange={handleTenantChange}
        className="min-w-[200px]"
      />
    </div>
  )
}

// Example usage with different configurations
export const ConfigurationExamples: React.FC = () => {
  return (
    <div className="space-y-8 p-6">
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Size Variants</h2>
        
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Small</label>
          <TenantSelector size="sm" />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Medium (Default)</label>
          <TenantSelector size="md" />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Large</label>
          <TenantSelector size="lg" />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Feature Variants</h2>
        
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">With Logos</label>
          <TenantSelector showLogo={true} />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">With Subscription Plans</label>
          <TenantSelector showPlan={true} />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Full Featured</label>
          <TenantSelector showLogo={true} showPlan={true} />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Disabled</label>
          <TenantSelector disabled={true} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Dropdown Positioning</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Bottom Start</label>
            <TenantSelector placement="bottom-start" />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Bottom End (Default)</label>
            <TenantSelector placement="bottom-end" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Example usage in extension popup
export const PopupExample: React.FC = () => {
  return (
    <div className="w-80 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Settings</h2>
        <TenantSelector size="sm" className="min-w-[150px]" />
      </div>
      
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Current tenant data and settings will be displayed here.
        </p>
        
        <div className="p-3 bg-muted rounded-md">
          <p className="text-xs text-muted-foreground">
            Switch tenants to view different data sets and configurations.
          </p>
        </div>
      </div>
    </div>
  )
}

export default {
  HeaderExample,
  ConfigurationExamples,
  PopupExample
}