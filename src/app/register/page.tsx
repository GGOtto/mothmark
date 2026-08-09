import {redirect} from "next/navigation";

import {resolveCurrentEditorPageActor} from "@/auth/currentPageActor";
import {AccountAuthForm} from "@/components/auth/AccountAuthForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
	if ((await resolveCurrentEditorPageActor())?.accountType === "registered") redirect("/");
	return <AccountAuthForm mode="register" />;
}
