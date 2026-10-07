import { WorkspaceLoading } from "@/components/shared/loading";
export default function Loading() {
  return (
    <WorkspaceLoading
      title="Users"
      columns={["Name", "Email", "Role", "Status", "Created", "Actions"]}
      filters={true}
    />
  );
}
