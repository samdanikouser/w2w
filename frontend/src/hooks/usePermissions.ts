import { useAuthStore } from '../stores/authStore';

/**
 * Hook that provides granular permission checks.
 *
 * Usage:
 *   const { canCreate, canEdit, canDelete } = usePermissions();
 *   if (canCreate('employees')) { ... show Add button ... }
 */
export function usePermissions() {
  const { user } = useAuthStore();
  const modules: string[] = user?.modules || [];

  return {
    /** Can the user see this module at all? */
    canView: (mod: string) => modules.includes(mod),

    /** Can the user create new records in this module? */
    canCreate: (mod: string) => modules.includes(`${mod}:create`),

    /** Can the user edit existing records in this module? */
    canEdit: (mod: string) => modules.includes(`${mod}:edit`),

    /** Can the user delete records in this module? */
    canDelete: (mod: string) => modules.includes(`${mod}:delete`),

    /** Can the user approve records in this module? */
    canApprove: (mod: string) => modules.includes(`${mod}:approve`),
  };
}
