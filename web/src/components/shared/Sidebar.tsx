import {
    CalendarDays,
    ChartNoAxesCombined,
    ClipboardList,
    LayoutDashboard,
    LogIn,
    LogOut,
    UserRoundCheck,
    UsersRound,
    type LucideIcon,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../../assets/logo-sidebar.svg";
import { getNavigationItemsForRole, type NavigationIcon } from "../../config/navigation";
import { useAuth } from "../../context/AuthContext";
import { SeloPerfil } from "../usuarios/SeloPerfil";

const navigationIcons: Record<NavigationIcon, LucideIcon> = {
    dashboard: LayoutDashboard,
    studies: ClipboardList,
    users: UsersRound,
    recruitment: UserRoundCheck,
    visits: CalendarDays,
    reports: ChartNoAxesCombined,
};

export function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const visibleNavigationItems = getNavigationItemsForRole(user?.role);

    async function handleLogout() {
        await logout();
        navigate("/login", { replace: true });
    }

    return (
        <aside className="fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] text-[var(--color-sidebar-text)] px-4 pt-[21px] pb-4">
            <div className="flex min-h-9 items-center px-1.5">
                <img
                    src={logo}
                    alt="ClinicalStudyPB"
                    className="block h-9 w-[172px] object-contain object-left"
                />
            </div>

            <nav aria-label="Navegação principal" className="mt-[52px] flex flex-col gap-[5px]">
                {visibleNavigationItems.map((item) => {
                    const Icon = navigationIcons[item.icon];

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === "/dashboard"}
                            className={({ isActive }) =>
                                `flex min-h-[43px] items-center gap-[13px] rounded-[10px] px-[13px] text-[13px] no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sidebar-text)] ${
                                    isActive
                                        ? "bg-[var(--color-sidebar-selected)] font-semibold text-[var(--color-sidebar-selected-text)]"
                                        : "font-medium text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text)]"
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon
                                        aria-hidden="true"
                                        className={`h-5 w-5 shrink-0 ${
                                            isActive
                                                ? "text-[var(--color-sidebar-selected-text)]"
                                                : "text-[var(--color-sidebar-muted)]"
                                        }`}
                                        strokeWidth={1.7}
                                    />
                                    <span>{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            <div className="mt-auto border-t border-[var(--color-sidebar-border)] pt-3.5">
                {user ? (
                    <div className="flex flex-col gap-2.5 px-1.5">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--color-sidebar-text)]">
                                {user.name}
                            </p>
                            <div className="mt-0.5">
                                <SeloPerfil perfil={user.role} sobreFundoEscuro />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex min-h-[38px] w-full items-center gap-2.5 rounded-[10px] px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sidebar-text)] font-medium text-[var(--color-sidebar-muted)] transition-colors hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text)]"
                        >
                            <LogOut
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0"
                                strokeWidth={1.8}
                            />
                            <span>Sair</span>
                        </button>
                    </div>
                ) : (
                    <NavLink
                        to="/login"
                        className="flex min-h-[40px] items-center gap-2.5 rounded-[10px] px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sidebar-text)] font-medium text-[var(--color-sidebar-muted)] no-underline transition-colors hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text)]"
                    >
                        <LogIn
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-[var(--color-sidebar-muted)]"
                            strokeWidth={1.8}
                        />
                        <span>Entrar na conta</span>
                    </NavLink>
                )}
            </div>
        </aside>
    );
}
