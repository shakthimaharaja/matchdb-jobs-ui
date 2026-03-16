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
  navGroups: NavGroup[];
  breadcrumb: string[];
  children: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function serializeNavGroups(groups: NavGroup[]): string {
  return JSON.stringify(
    groups.map((g) => ({
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
}

/**
 * DBLayout no longer renders its own header/sidebar.
 * Instead it emits CustomEvents so the Shell can render nav + breadcrumb:
 *   matchdb:subnav      — sidebar nav groups
 *   matchdb:breadcrumb  — breadcrumb segments (string[])
 *
 * NOTE: React runs child effects before parent effects. Because ShellLayout
 * (parent) registers its event listener in useEffect, and DBLayout (child)
 * dispatches in useEffect, the very first dispatch can be lost. We work
 * around this by deferring the first dispatch with setTimeout(0) so the
 * parent listener is guaranteed to be registered.
 */
const DBLayout: React.FC<DBLayoutProps> = ({
  navGroups,
  breadcrumb,
  children,
}) => {
  const prevJson = useRef("");
  const prevBc = useRef("");
  const mountedRef = useRef(false);
  const navGroupsRef = useRef(navGroups);
  navGroupsRef.current = navGroups;

  // Deferred first dispatch — guarantees the Shell listener is ready
  useEffect(() => {
    const timer = setTimeout(() => {
      mountedRef.current = true;
      prevJson.current = serializeNavGroups(navGroupsRef.current);
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:subnav", { detail: navGroupsRef.current }),
      );
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Skip until the deferred mount dispatch has run
    if (!mountedRef.current) return;
    const json = serializeNavGroups(navGroups);
    if (json !== prevJson.current) {
      prevJson.current = json;
      globalThis.dispatchEvent(
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
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:breadcrumb", { detail: breadcrumb }),
      );
    }
  });

  useEffect(() => {
    return () => {
      // Clear sub-nav + breadcrumb when this component unmounts
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:subnav", { detail: [] }),
      );
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:breadcrumb", { detail: [] }),
      );
    };
  }, []);

  return <>{children}</>;
};

export type { NavGroup, NavItem };
export default DBLayout;
