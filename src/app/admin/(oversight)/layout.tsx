import type {ReactNode} from "react";

import {AdminShell} from "../AdminShell";

export default function AdminOversightLayout({children}: {children: ReactNode}) {
	return <AdminShell>{children}</AdminShell>;
}
