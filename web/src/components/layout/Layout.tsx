import { Outlet } from "react-router-dom";
import { Sidebar } from "../shared/Sidebar";

export function Layout() {
    return (
        <div className="min-h-screen">
            <Sidebar />

            <main className="ml-[var(--sidebar-width)] min-h-screen max-[760px]:ml-0">
                <div className="mx-auto min-h-screen w-full max-w-[1600px] px-7 pt-16 pb-10 min-[1600px]:px-9 max-[760px]:px-[18px] max-[760px]:pt-[82px] max-[760px]:pb-7">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
