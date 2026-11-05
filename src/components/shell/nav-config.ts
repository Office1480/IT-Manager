import { AppWindow, BarChart3, Boxes, CalendarDays, FolderKanban, HandCoins, Lightbulb, Network, ScrollText, Settings, Users, Workflow } from "lucide-react";
import type { Permission } from "@/lib/rbac";

export type NavItem = { key: string; href: string; icon: typeof Users; permission?: Permission };
export type NavGroup = { key: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { key: "overview", items: [{ key: "dashboard", href: "/", icon: BarChart3 }] },
  {
    key: "team",
    items: [
      { key: "people", href: "/people", icon: Users },
      { key: "orgChart", href: "/org-chart", icon: Network },
      { key: "leave", href: "/leave", icon: CalendarDays },
      { key: "advances", href: "/advances", icon: HandCoins },
    ],
  },
  {
    key: "equipment",
    items: [
      { key: "assets", href: "/assets", icon: Boxes, permission: "asset.read" },
      { key: "licenses", href: "/licenses", icon: AppWindow, permission: "asset.read" },
    ],
  },
  {
    key: "projects",
    items: [
      { key: "projectList", href: "/projects", icon: FolderKanban },
      { key: "responsibilityMap", href: "/projects/map", icon: Workflow },
      { key: "ideation", href: "/ideation", icon: Lightbulb },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { key: "audit", href: "/audit", icon: ScrollText, permission: "audit.read" },
  { key: "settings", href: "/settings", icon: Settings, permission: "settings.manage" },
];
