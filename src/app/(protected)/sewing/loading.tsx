import { WorkspaceLoading } from "@/components/shared/loading";
export default function Loading() {
  return (
    <WorkspaceLoading
      title="Sewing queue"
      columns={[
        "Order",
        "Recipe",
        "Garments",
        "Verified by / time",
        "Signed fabric variance",
        "Assembly",
        "Action",
      ]}
      filters={true}
    />
  );
}
