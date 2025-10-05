import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import {
  SettingsIcon,
  DatabaseIcon,
  NetworkIcon,
  WrenchIcon,
  SaveIcon,
  RotateCcwIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

import { LogSettings } from '@/components/settings/LogSettings';
import { Select } from '@/components/ui/Select';
import { logger } from '@/utils/logger';

type TabKey = 'general' | 'export' | 'api' | 'advanced';

interface PreferencesData {
  general: {
    theme: 'light' | 'dark' | 'system';
    startupBehavior: 'home' | 'restore' | 'blank';
    autoUpdate: boolean;
    notifications: boolean;
  };
  export: {
    defaultFormat: 'csv' | 'xlsx' | 'json';
    defaultPath: string | null;
    openAfterExport: boolean;
    includeHeaders: boolean;
    dateFormat: 'ISO' | 'US' | 'EU';
    encoding: string;
  };
  api: {
    rateLimit: {
      enabled: boolean;
      requestsPerSecond: number;
      maxConcurrent: number;
    };
    timeout: number;
    retries: number;
    retryDelay: number;
  };
  advanced: {
    logLevel: string;
    cacheEnabled: boolean;
    cacheDuration: number;
    developerMode: boolean;
    experimentalFeatures: boolean;
  };
}

export function Preferences() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [preferences, setPreferences] = useState<PreferencesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();

    // Listen for preference changes from other windows
    const handlePreferenceChange = (event: any, updatedPreferences: PreferencesData) => {
      setPreferences(updatedPreferences);
      setHasChanges(false);
    };

    if (window.electron?.preferences?.onChanged) {
      window.electron.preferences.onChanged(handlePreferenceChange);
    }

    return () => {
      // Cleanup listener
      if (window.electron?.preferences?.offChanged) {
        window.electron.preferences.offChanged(handlePreferenceChange);
      }
    };
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await window.electron.preferences.get();
      setPreferences(prefs);
    } catch (error) {
      logger.error('Failed to load preferences:', error);
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      await window.electron.preferences.save(preferences);
      setHasChanges(false);
      toast.success('Preferences saved successfully');
    } catch (error) {
      logger.error('Failed to save preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all preferences to defaults?')) {
      try {
        const defaults = await window.electron.preferences.reset();
        setPreferences(defaults);
        setHasChanges(false);
        toast.success('Preferences reset to defaults');
      } catch (error) {
        logger.error('Failed to reset preferences:', error);
        toast.error('Failed to reset preferences');
      }
    }
  };

  const updatePreference = (category: keyof PreferencesData, key: string, value: any) => {
    if (!preferences) return;

    setPreferences(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      };
    });
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Failed to load preferences</div>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'general',
      label: (
        <span className="flex items-center gap-2">
          <SettingsIcon className="h-4 w-4" />
          General
        </span>
      ),
      children: <GeneralSettings preferences={preferences.general} onChange={(key, value) => updatePreference('general', key, value)} />
    },
    {
      key: 'export',
      label: (
        <span className="flex items-center gap-2">
          <DatabaseIcon className="h-4 w-4" />
          Export
        </span>
      ),
      children: <ExportSettings preferences={preferences.export} onChange={(key, value) => updatePreference('export', key, value)} />
    },
    {
      key: 'api',
      label: (
        <span className="flex items-center gap-2">
          <NetworkIcon className="h-4 w-4" />
          API
        </span>
      ),
      children: <ApiSettings preferences={preferences.api} onChange={(key, value) => updatePreference('api', key, value)} />
    },
    {
      key: 'advanced',
      label: (
        <span className="flex items-center gap-2">
          <WrenchIcon className="h-4 w-4" />
          Advanced
        </span>
      ),
      children: <AdvancedSettings preferences={preferences.advanced} onChange={(key, value) => updatePreference('advanced', key, value)} />
    }
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold">Preferences</h1>
      </div>

      <div className="flex-1 overflow-auto">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as TabKey)}
          items={tabItems}
          className="px-4"
        />
      </div>

      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <button
          onClick={handleReset}
          className="px-4 py-2 flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <RotateCcwIcon className="h-4 w-4" />
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`px-4 py-2 flex items-center gap-2 rounded-md ${
            hasChanges
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <SaveIcon className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// General Settings Tab
function GeneralSettings({ preferences, onChange }: any) {
  return (
    <div className="space-y-6 p-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Theme
        </label>
        <Select
          value={preferences.theme}
          onChange={(value) => onChange('theme', value)}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' }
          ]}
          className="max-w-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Startup Behavior
        </label>
        <Select
          value={preferences.startupBehavior}
          onChange={(value) => onChange('startupBehavior', value)}
          options={[
            { value: 'home', label: 'Show Home' },
            { value: 'restore', label: 'Restore Last Session' },
            { value: 'blank', label: 'Start Blank' }
          ]}
          className="max-w-sm"
        />
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.autoUpdate}
            onChange={(e) => onChange('autoUpdate', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Auto-Update
          </span>
        </label>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.notifications}
            onChange={(e) => onChange('notifications', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Notifications
          </span>
        </label>
      </div>
    </div>
  );
}

// Export Settings Tab
function ExportSettings({ preferences, onChange }: any) {
  return (
    <div className="space-y-6 p-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Default Format
        </label>
        <Select
          value={preferences.defaultFormat}
          onChange={(value) => onChange('defaultFormat', value)}
          options={[
            { value: 'csv', label: 'CSV' },
            { value: 'xlsx', label: 'Excel (XLSX)' },
            { value: 'json', label: 'JSON' }
          ]}
          className="max-w-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Date Format
        </label>
        <Select
          value={preferences.dateFormat}
          onChange={(value) => onChange('dateFormat', value)}
          options={[
            { value: 'ISO', label: 'ISO 8601 (YYYY-MM-DD)' },
            { value: 'US', label: 'US (MM/DD/YYYY)' },
            { value: 'EU', label: 'EU (DD/MM/YYYY)' }
          ]}
          className="max-w-sm"
        />
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.openAfterExport}
            onChange={(e) => onChange('openAfterExport', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Open file after export
          </span>
        </label>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.includeHeaders}
            onChange={(e) => onChange('includeHeaders', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Include headers in exports
          </span>
        </label>
      </div>
    </div>
  );
}

// API Settings Tab
function ApiSettings({ preferences, onChange }: any) {
  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Rate Limiting</h3>

        <div>
          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={preferences.rateLimit.enabled}
              onChange={(e) => onChange('rateLimit', { ...preferences.rateLimit, enabled: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Rate Limiting
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Requests Per Second
          </label>
          <input
            type="number"
            value={preferences.rateLimit.requestsPerSecond}
            onChange={(e) => onChange('rateLimit', { ...preferences.rateLimit, requestsPerSecond: parseInt(e.target.value) })}
            min="1"
            max="100"
            className="w-32 px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Max Concurrent Requests
          </label>
          <input
            type="number"
            value={preferences.rateLimit.maxConcurrent}
            onChange={(e) => onChange('rateLimit', { ...preferences.rateLimit, maxConcurrent: parseInt(e.target.value) })}
            min="1"
            max="20"
            className="w-32 px-3 py-2 border rounded-md"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Request Timeout (seconds)
        </label>
        <input
          type="number"
          value={preferences.timeout / 1000}
          onChange={(e) => onChange('timeout', parseInt(e.target.value) * 1000)}
          min="5"
          max="300"
          className="w-32 px-3 py-2 border rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Max Retries
        </label>
        <input
          type="number"
          value={preferences.retries}
          onChange={(e) => onChange('retries', parseInt(e.target.value))}
          min="0"
          max="10"
          className="w-32 px-3 py-2 border rounded-md"
        />
      </div>
    </div>
  );
}

// Advanced Settings Tab
function AdvancedSettings({ preferences, onChange }: any) {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-lg font-medium mb-4">Logging</h3>
        <LogSettings />
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.cacheEnabled}
            onChange={(e) => onChange('cacheEnabled', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Cache
          </span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Cache Duration (minutes)
        </label>
        <input
          type="number"
          value={preferences.cacheDuration / 60000}
          onChange={(e) => onChange('cacheDuration', parseInt(e.target.value) * 60000)}
          min="1"
          max="60"
          className="w-32 px-3 py-2 border rounded-md"
        />
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.developerMode}
            onChange={(e) => onChange('developerMode', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Developer Mode
          </span>
        </label>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.experimentalFeatures}
            onChange={(e) => onChange('experimentalFeatures', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Experimental Features
          </span>
        </label>
      </div>
    </div>
  );
}