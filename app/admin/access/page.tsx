import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "../../../lib/session";
import { roleMatrix } from "../../../lib/foundation";
import { prisma } from "../../../lib/prisma";
import { logoutAction } from "../../logout/actions";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

async function getUsers() {
  try {
    return prisma.user.findMany({
      where: { companyId: "org_rehn_vvs" },
      orderBy: { role: "asc" },
    });
  } catch {
    return [];
  }
}

export default async function AccessPage() {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) redirect("/login");

  const users = await getUsers();
  const permissions = roleMatrix[sessionUser.role] ?? [];

  return (
    <main className="adminShell">
      <AdminSidebar active="access" label="Åtkomst" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Säker inloggning</p>
            <h1>Session, roll och behörighet är aktivt i demon.</h1>
            <p>
              Inloggningen skapar en databaslagrad session med hashad token i cookie. Roller styr vad användaren
              får göra och viktiga händelser skrivs till historiken.
            </p>
          </div>
          <form action={logoutAction} className="portalActions">
            <button>Logga ut</button>
          </form>
        </header>

        <section className="adminGrid lower">
          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Aktuell session</h3>
              <span>
                Gäller till{" "}
                {new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(
                  sessionUser.expiresAt,
                )}
              </span>
            </div>
            <div className="accessCard">
              <strong>{sessionUser.name}</strong>
              <span>{sessionUser.email}</span>
              <b>{sessionUser.role}</b>
            </div>
          </article>

          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Behörigheter</h3>
              <span>{permissions.length} rättigheter</span>
            </div>
            <div className="permissionGrid">
              {permissions.map((permission) => <span key={permission}>{permission}</span>)}
            </div>
          </article>
        </section>

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Användare i Rehn VVS</h3>
            <span>Roller från databasen</span>
          </div>
          <div className="userList">
            {users.map((user) => (
              <article key={user.id}>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <b>{user.role}</b>
                <small>{user.active ? "Aktiv" : "Inaktiv"}</small>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
