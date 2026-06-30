import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuditTab } from '@/components/admin/AuditTab';
import { OrganizationsTab } from '@/components/admin/OrganizationsTab';
import { OverviewTab } from '@/components/admin/OverviewTab';
import { RolesTab } from '@/components/admin/RolesTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { useAuth } from '@/features/auth/AuthContext';

interface TabDef {
  key: string;
  label: string;
  permission: string;
  render: () => JSX.Element;
}

export function AdminPage(): JSX.Element {
  const { hasPermission } = useAuth();
  const canManageRoles = hasPermission('roles:manage');
  const canManageUsers = hasPermission('users:manage');

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview', permission: 'users:read', render: () => <OverviewTab /> },
    { key: 'users', label: 'Users', permission: 'users:read', render: () => <UsersTab canManage={canManageUsers} /> },
    { key: 'roles', label: 'Roles', permission: 'roles:read', render: () => <RolesTab canManage={canManageRoles} /> },
    { key: 'audit', label: 'Audit log', permission: 'audit_logs:read', render: () => <AuditTab /> },
    { key: 'orgs', label: 'Organizations', permission: 'organizations:manage', render: () => <OrganizationsTab /> },
  ];

  const visibleTabs = tabs.filter((tab) => hasPermission(tab.permission));
  const [active, setActive] = useState(visibleTabs[0]?.key ?? 'overview');

  if (visibleTabs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-800">Not authorized</h1>
        <p className="mt-2 text-sm text-slate-500">You don’t have access to the admin area.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-indigo-600">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const activeTab = visibleTabs.find((tab) => tab.key === active) ?? visibleTabs[0]!;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <Link to="/dashboard" className="text-sm font-semibold text-indigo-600 hover:underline">
          Back to dashboard
        </Link>
      </header>

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab.key === activeTab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab.render()}
    </div>
  );
}
