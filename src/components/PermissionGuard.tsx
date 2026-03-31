/**
 * PermissionGuard.tsx
 *
 * Conditional render wrapper that checks the current user's permissions
 * before rendering children. Uses the CompanyContext RBAC system.
 *
 * Usage:
 *   <PermissionGuard requiredPermission="invite_workers">
 *     <Button>Invite Worker</Button>
 *   </PermissionGuard>
 */
import React from "react";
import { useCompanyContext } from "../hooks/useCompanyContext";
import type { UserRole } from "../api/jobsApi";

interface PermissionGuardProps {
  /** Permission string to check, e.g. "invite_workers" */
  requiredPermission?: string;
  /** Role(s) to check — user must have one of these */
  requiredRoles?: UserRole[];
  /** Fallback to render if unauthorized (defaults to null) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({
  requiredPermission,
  requiredRoles,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { role, hasPermission, hasRole, isLoading } = useCompanyContext();

  // While loading, hide protected content
  if (isLoading) return <>{fallback}</>;

  // Admin always has access
  if (role === "admin") return <>{children}</>;

  // Check role requirement
  if (requiredRoles && requiredRoles.length > 0) {
    if (!hasRole(...requiredRoles)) return <>{fallback}</>;
  }

  // Check permission requirement
  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default PermissionGuard;
