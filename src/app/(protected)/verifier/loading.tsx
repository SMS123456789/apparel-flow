import { WorkspaceLoading } from "@/components/shared/loading";
export default function Loading() {
  return (
    <WorkspaceLoading
      title="Verification queue"
      columns={["Order", "Recipe", "Garments", "State", "Updated", "Action"]}
      filters={true}
    />
  );
}
