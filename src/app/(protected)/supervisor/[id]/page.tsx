import { OrderPreparation } from "@/components/production/order-preparation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <OrderPreparation orderId={(await params).id} />;
}
