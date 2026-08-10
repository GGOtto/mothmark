import {HostedPlayer} from "@/components/player/HostedPlayer";

import "../play.scss";

export default async function HostedWorldPage({params}: {params: Promise<{world: string}>}) {
	return <HostedPlayer slug={(await params).world} />;
}
