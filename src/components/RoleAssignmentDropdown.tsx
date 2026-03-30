/**
 * RoleAssignmentDropdown.tsx
 *
 * A styled select dropdown for assigning/changing user roles.
 * Uses the component library's Select for consistent Win97 theming.
 */
import React from "react";
import { Select } from "matchdb-component-library";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "finance", label: "Finance Team" },
  { value: "hr", label: "HR Team" },
  { value: "operations", label: "Operations" },
  { value: "marketing", label: "Marketing" },
  { value: "viewer", label: "Viewer (Read-only)" },
];

interface RoleAssignmentDropdownProps {
  value: string;
  onChange: (role: string) => void;
  disabled?: boolean;
  excludeAdmin?: boolean;
  size?: "sm" | "md";
}

export function RoleAssignmentDropdown({
  value,
  onChange,
  disabled,
  excludeAdmin,
  size = "sm",
}: RoleAssignmentDropdownProps) {
  const options = excludeAdmin
    ? ROLE_OPTIONS.filter((o) => o.value !== "admin")
    : ROLE_OPTIONS;

  return (
    <Select
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
        onChange(e.target.value)
      }
      disabled={disabled}
      style={{ fontSize: size === "sm" ? 11 : 13, minWidth: 120 }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  );
}

export default RoleAssignmentDropdown;
