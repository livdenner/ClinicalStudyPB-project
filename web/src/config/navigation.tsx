import type { UserRole } from "../types/auth";

export type NavigationIcon =
  | "dashboard"
  | "studies"
  | "users"
  | "recruitment"
  | "visits"
  | "reports";

export type NavigationItem = {
  label: string;
  path: string;
  icon: NavigationIcon;
  allowedRoles: UserRole[];
};

export const navigationItems: NavigationItem[] = [
  {
    label: "Visão geral",
    path: "/dashboard",
    icon: "dashboard",
    allowedRoles: ["ADMINISTRATOR", "RESEARCHER", "COORDINATOR"],
  },
  {
    label: "Estudos clínicos",
    path: "/estudos",
    icon: "studies",
    allowedRoles: ["RESEARCHER"],
  },
  {
    label: "Usuários e acessos",
    path: "/usuarios",
    icon: "users",
    allowedRoles: ["ADMINISTRATOR"],
  },
  {
    label: "Recrutamento",
    path: "/recrutamento",
    icon: "recruitment",
    allowedRoles: ["COORDINATOR", "RESEARCHER"],
  },
  {
    label: "Visitas",
    path: "/visitas",
    icon: "visits",
    allowedRoles: ["RESEARCHER", "COORDINATOR"],
  },
  {
    label: "Relatórios",
    path: "/relatorios",
    icon: "reports",
    allowedRoles: ["ADMINISTRATOR", "RESEARCHER", "COORDINATOR"],
  },
];

export function getNavigationItemsForRole(
  role?: UserRole | null,
): NavigationItem[] {
  if (!role) {
    return [];
  }

  return navigationItems.filter((item) => item.allowedRoles.includes(role));
}

export function getDefaultRouteForRole(role?: UserRole | null): string {
  switch (role) {
    case "RESEARCHER":
      return "/estudos";
    case "ADMINISTRATOR":
      return "/usuarios";
    case "COORDINATOR":
      return "/recrutamento";
    default:
      return "/acesso-negado";
  }
}

export function canRoleAccessPath(
  role: UserRole | null | undefined,
  path: string,
): boolean {
  if (!role) {
    return false;
  }

  const matchedItem = navigationItems.find(
    (item) => path === item.path || path.startsWith(`${item.path}/`),
  );

  if (!matchedItem) {
    return role !== "PARTICIPANT";
  }

  return matchedItem.allowedRoles.includes(role);
}
