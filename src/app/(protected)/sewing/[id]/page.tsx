import { SewingDetail } from "@/components/production/sewing-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SewingDetail orderId={id} />;
}
