import { getPageUser } from "@/server/auth/context";
import { VerificationTerminal } from "@/components/production/verification-terminal";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getPageUser("CUTTING_VERIFIER");
  return <VerificationTerminal orderId={(await params).id} actorId={user.id} />;
}
