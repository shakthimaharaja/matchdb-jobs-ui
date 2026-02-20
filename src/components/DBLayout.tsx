import React, { useEffect, useRef } from "react";

interface NavItem {
  id: string;
  label: string;
  count?: number;
  active?: boolean;
  depth?: number; // 0 = top-level, 1 = child sub-item
  tooltip?: string; // shown as browser title/tooltip on hover in ShellLayout
  onClick?: () => void;
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

interface DBLayoutProps {
  userType: "vendor" | "candidate";
  navGroups: NavGroup[];
  breadcrumb: string[];
  children: React.ReactNode;
}

/**
 * DBLayout no longer renders its own header/sidebar.
 * Instead it emits CustomEvents so the Shell can render nav + breadcrumb:
 *   matchdb:subnav      — sidebar nav groups
 *   matchdb:breadcrumb  — breadcrumb segments (string[])
 */
const DBLayout: React.FC<DBLayoutProps> = ({ navGroups, breadcrumb, children }) => {
  const prevJson = useRef("");
  const prevBc = useRef("");

  useEffect(() => {
    // Only dispatch when navGroups actually change (avoid infinite loops)
    const json = JSON.stringify(
      navGroups.map((g) => ({
        label: g.label,
        icon: g.icon,
        items: g.items.map((i) => ({
          id: i.id,
          label: i.label,
          count: i.count,
          active: i.active,
          depth: i.depth,
          tooltip: i.tooltip,
        })),
      })),
    );
    if (json !== prevJson.current) {
      prevJson.current = json;
      window.dispatchEvent(
        new CustomEvent("matchdb:subnav", {
          detail: navGroups,
        }),
      );
    }
  });

  // Emit breadcrumb segments whenever they change
  useEffect(() => {
    const json = JSON.stringify(breadcrumb);
    if (json !== prevBc.current) {
      prevBc.current = json;
      window.dispatchEvent(
        new CustomEvent("matchdb:breadcrumb", { detail: breadcrumb }),
      );
    }
  });

  useEffect(() => {
    return () => {
      // Clear sub-nav + breadcrumb when this component unmounts
      window.dispatchEvent(new CustomEvent("matchdb:subnav", { detail: [] }));
      window.dispatchEvent(new CustomEvent("matchdb:breadcrumb", { detail: [] }));
    };
  }, []);

  return <>{children}</>;
};

export type { NavGroup, NavItem };
export default DBLayout;
