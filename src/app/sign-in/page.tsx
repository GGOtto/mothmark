import {redirect} from "next/navigation";

import {resolveCurrentEditorPageActor} from "@/auth/currentPageActor";
import {AccountAuthForm} from "@/components/auth/AccountAuthForm";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
	if ((await resolveCurrentEditorPageActor())?.accountType === "registered") redirect("/");
	return <AccountAuthForm mode="sign-in" />;
}
