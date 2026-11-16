"use client";

import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import {
	CAMPAIGN_SENDER_LABEL,
	CAMPAIGN_SENDERS,
	type CampaignSender,
} from "@/lib/unifers/sender";

export function SenderTabs({
	value,
	onChange,
}: {
	value: CampaignSender;
	onChange: (value: CampaignSender) => void;
}) {
	return (
		<Tabs
			value={value}
			onValueChange={(next) => {
				const match = CAMPAIGN_SENDERS.find((sender) => sender === next);
				if (match) onChange(match);
			}}
		>
			<TabsList>
				{CAMPAIGN_SENDERS.map((sender) => (
					<TabsTrigger key={sender} value={sender}>
						Sent with {CAMPAIGN_SENDER_LABEL[sender]}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
