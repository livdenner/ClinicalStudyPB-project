export type NavigationIcon =
    "dashboard" | "studies" | "users" | "recruitment" | "visits" | "reports";

export type NavigationItem = {
    label: string;
    path: string;
    icon: NavigationIcon;
};

export const navigationItems: NavigationItem[] = [
    { label: "Visão geral", path: "/dashboard", icon: "dashboard" },
    { label: "Estudos clínicos", path: "/estudos", icon: "studies" },
    { label: "Usuários e acessos", path: "/usuarios", icon: "users" },
    { label: "Recrutamento", path: "/recrutamento", icon: "recruitment" },
    { label: "Visitas", path: "/visitas", icon: "visits" },
    { label: "Relatórios", path: "/relatorios", icon: "reports" },
];
