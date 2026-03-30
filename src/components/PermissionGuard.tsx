/**
 * PermissionGuard.tsx
 *
 * Conditional render wrapper that checks the current user's permissions
 * before rendering children. Uses the RBAC system to hide unauthorized UI.
 *
 * Usage:
 *   <PermissionGuard requiredPermission="invite:candidate">
 *     <Button>Invite Candidate</Button>
 *   </PermissionGuard>
 */
import React from "react";

interface PermissionGuardProps {
  /** Permission string to check, e.g. "invite:candidate" */
  requiredPermission?: string;
  /** Role(s) to check — user must have one of these */
  requiredRoles?: string[];
  /** Current user's permissions array */
  userPermissions: string[];
  /** Current user's role */
  userRole: string;
  /** Fallback to render if unauthorized (defaults to null) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({
  requiredPermission,
  requiredRoles,
  userPermissions,
  userRole,
  fallback = null,
  children,
}: PermissionGuardProps) {
  // Admin always has access
  if (userRole === "admin") return <>{children}</>;

  // Check role requirement
  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(userRole)) return <>{fallback}</>;
  }

  // Check permission requirement
  if (requiredPermission) {
    if (!userPermissions.includes(requiredPermission)) return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default PermissionGuard;
