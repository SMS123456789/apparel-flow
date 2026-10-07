import { WorkspaceLoading } from "@/components/shared/loading";
export default function Loading() {
  return (
    <WorkspaceLoading
      title="Administrative audit"
      columns={["Time", "Actor", "User", "Action", "Details"]}
      filters={false}
    />
  );
}
