import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  setRolePermissions,
  type Permission,
  type Role,
} from '@/features/admin/admin.api';
import { getApiErrorMessage } from '@/lib/apiError';

const ROLES_KEY = ['admin-roles'];

export function RolesTab({ canManage }: { canManage: boolean }): JSX.Element {
  const rolesQuery = useQuery({ queryKey: ROLES_KEY, queryFn: listRoles });
  const permissionsQuery = useQuery({ queryKey: ['admin-permissions'], queryFn: listPermissions });

  return (
    <div className="flex flex-col gap-4">
      {canManage ? <CreateRole /> : null}
      {rolesQuery.isLoading ? <p className="text-sm text-slate-500">Loading roles…</p> : null}
      {(rolesQuery.data ?? []).map((role) => (
        <RoleCard key={role.id} role={role} permissions={permissionsQuery.data ?? []} canManage={canManage} />
      ))}
    </div>
  );
}

function CreateRole(): JSX.Element {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createRole({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      setName('');
      setDescription('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ROLES_KEY });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Create a role</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField label="Name" placeholder="content-editor" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex-1">
          <TextField label="Description" placeholder="Optional" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <Button type="button" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Create
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}

function RoleCard({
  role,
  permissions,
  canManage,
}: {
  role: Role;
  permissions: Permission[];
  canManage: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const granted = new Set(role.permissions);

  const update = useMutation({
    mutationFn: (keys: string[]) => setRolePermissions(role.id, keys),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  });
  const remove = useMutation({
    mutationFn: () => deleteRole(role.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  });

  const toggle = (key: string): void => {
    const next = new Set(granted);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update.mutate([...next]);
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            {role.name}
            {role.isSystem ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">system</span>
            ) : null}
          </h3>
          <p className="text-xs text-slate-500">
            {role.description ?? 'No description'} · {role.userCount} user{role.userCount === 1 ? '' : 's'}
          </p>
        </div>
        {canManage && !role.isSystem ? (
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {permissions.map((permission) => (
          <label key={permission.key} className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={granted.has(permission.key)}
              disabled={!canManage || update.isPending}
              onChange={() => toggle(permission.key)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="font-mono text-xs">{permission.key}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
