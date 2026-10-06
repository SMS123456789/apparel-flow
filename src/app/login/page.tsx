import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/server/auth/context";
import { AuthenticationError, AuthorizationError } from "@/server/http/errors";
import { demoPersonas, rolePaths } from "@/modules/identity/types";
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string }>;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (!(
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError
    ))
      throw error;
  }
  if (user) redirect(rolePaths[user.role]);
  const query = await searchParams;
  const enabled =
    process.env.DEMO_ACCOUNTS_ENABLED === "true"
      ? demoPersonas
          .filter((persona) =>
            Boolean(
              process.env[`${persona.env}_EMAIL`] &&
              process.env[`${persona.env}_PASSWORD`],
            ),
          )
          .map((persona) => persona.id)
      : [];
  return (
    <>
      <header className="login-header">
        <span className="brand">ApparelFlow</span>
        <span>Factory operations</span>
      </header>
      <main className="login-main">
        <section className="login-surface" aria-labelledby="login-title">
          <h1 id="login-title">Sign in</h1>
          <p className="intro">
            Use your assigned account to open your workspace.
          </p>
          {query.access === "unavailable" && (
            <p className="alert error" role="alert">
              Application access is unavailable for this account. Contact the
              administrator.
            </p>
          )}
          <LoginForm enabledPersonas={enabled} />
        </section>
      </main>
    </>
  );
}
