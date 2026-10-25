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
import logo from "../../assets/logo.svg";
import { navigationItems, type NavigationIcon } from "../../config/navigation";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS } from "../../types/auth";

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

    async function handleLogout() {
        await logout();
        navigate("/login", { replace: true });
    }

    return (
        <aside className="fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col border-r border-[#dce5ed] bg-white px-4 pt-[21px] pb-4">
            <div className="flex min-h-9 items-center px-1.5">
                <img
                    src={logo}
                    alt="ClinicalStudyPB"
                    className="block h-9 w-[172px] object-contain object-left"
                />
            </div>

            <nav className="mt-[52px] flex flex-col gap-[5px]">
                {navigationItems.map((item) => {
                    const Icon = navigationIcons[item.icon];

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === "/dashboard"}
                            className={({ isActive }) =>
                                `flex min-h-[43px] items-center gap-[13px] rounded-[10px] px-[13px] text-[13px] no-underline transition-colors duration-150 ${
                                    isActive
                                        ? "bg-[#e4f3f1] font-semibold text-[#075e5a]"
                                        : "font-medium text-[#24384c] hover:bg-[#f4f8f9] hover:text-[#126966]"
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon
                                        aria-hidden="true"
                                        className={`h-5 w-5 shrink-0 ${
                                            isActive ? "text-[#187b78]" : "text-[#75899d]"
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

            <div className="mt-auto border-t border-[#dce5ed] pt-3.5">
                {user ? (
                    <div className="flex flex-col gap-2.5 px-1.5">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#1b2d40]">
                                {user.name}
                            </p>
                            <span className="mt-0.5 inline-flex items-center rounded-full bg-[#e4f3f1] px-2 py-0.5 text-[11px] font-semibold text-[#075e5a]">
                                {ROLE_LABELS[user.role] ?? user.role}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex min-h-[38px] w-full items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-medium text-[#52677c] transition-colors hover:bg-red-50 hover:text-red-700"
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
                        className="flex min-h-[40px] items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-medium text-[#24384c] no-underline transition-colors hover:bg-[#f4f8f9] hover:text-[#126966]"
                    >
                        <LogIn
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-[#75899d]"
                            strokeWidth={1.8}
                        />
                        <span>Entrar na conta</span>
                    </NavLink>
                )}
            </div>
        </aside>
    );
}
