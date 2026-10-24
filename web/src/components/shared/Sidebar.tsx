import {
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  UserRoundCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import logo from "../../assets/logo.svg";
import { navigationItems, type NavigationIcon } from "../../config/navigation";

const navigationIcons: Record<NavigationIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  studies: ClipboardList,
  users: UsersRound,
  recruitment: UserRoundCheck,
  visits: CalendarDays,
  reports: ChartNoAxesCombined,
};

export function Sidebar() {
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
    </aside>
  );
}
