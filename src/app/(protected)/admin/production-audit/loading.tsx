import { WorkspaceLoading } from "@/components/shared/loading";
export default function Loading() {
  return (
    <WorkspaceLoading
      title="Production audit"
      columns={["Time", "Order", "Actor", "Action", "Summary", "Details"]}
      filters={false}
    />
  );
}
