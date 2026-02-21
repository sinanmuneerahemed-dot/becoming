import { CheckinClient } from "@/components/checkin/CheckinClient";

export function generateStaticParams() {
  return Array.from({ length: 9 }, (_, i) => ({ step: String(i + 1) }));
}

export default function CheckinPage({
  params,
}: {
  params: { step: string };
}) {
  return <CheckinClient step={params.step} />;
}
