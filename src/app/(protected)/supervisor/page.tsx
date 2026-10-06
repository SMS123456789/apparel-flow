import { getPageUser } from "@/server/auth/context";
import { roleLabels } from "@/modules/identity/types";
export default async function Page() {
  const user = await getPageUser("CUTTING_SUPERVISOR");
  return (
    <>
      <h1>{roleLabels[user.role]}</h1>
      <p className="intro">Signed in as: {user.fullName}</p>
      <dl className="identity-details">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Account</dt>
        <dd>Active</dd>
      </dl>
    </>
  );
}
