import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";

export function Layout({ menu }: { menu?: ReactNode }) {
    return (
        <div className="layout">
            <header className="layout-header">ClinicalStudyPB</header>
            <div className="layout-body">
                {menu && <nav className="layout-menu">{menu}</nav>}
                <main className="layout-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
