import React, { useEffect, useRef } from "react";

interface NavItem {
  id: string;
  label: string;
  count?: number;
  active?: boolean;
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
 * Instead it emits a 'matchdb:subnav' CustomEvent so the Shell sidebar
 * can render the MFE nav groups as sub-rows in its single unified sidebar.
 */
const DBLayout: React.FC<DBLayoutProps> = ({ navGroups, children }) => {
  const prevJson = useRef("");

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

  useEffect(() => {
    return () => {
      // Clear sub-nav when this component unmounts
      window.dispatchEvent(new CustomEvent("matchdb:subnav", { detail: [] }));
    };
  }, []);

  return <>{children}</>;
};

export type { NavGroup, NavItem };
export default DBLayout;
