import { loginAction } from "./actions";

const loginNotes = [
  ["Säker session", "Du behöver bara logga in en gång under samma webbläsarsession."],
  ["Rätt behörighet", "Admin, arbetsledare, montör och kund styrs av rollen i databasen."],
  ["Skyddade länkar", "Alla sidor skickar först till inloggning när session saknas."],
  ["Kunddata", "Rapporter, bilder och dokument visas bara efter inloggning."],
];

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const error = params?.error;
  const next = params?.next ?? "/admin";

  return (
    <main className="loginShell">
      <section className="loginCard">
        <div className="brandLine">
          <div className="miniMark" />
          <div>
            <strong>Rehn VVS</strong>
            <span>Säker inloggning · RVM Husstatus</span>
          </div>
        </div>
        <h1>Logga in till RVM Husstatus</h1>
        <p>
          Logga in för att fylla i platsbesök, autospara formulär och skapa husrapport.
        </p>
        {error ? (
          <div className="persistenceNote offline">
            {error === "missing"
              ? "Fyll i e-post och lösenord."
              : error === "database"
                ? "Databasen svarar inte just nu. Försök igen senare eller kontrollera databaskvoten."
                : "Fel e-post eller lösenord."}
          </div>
        ) : null}
        <form action={loginAction} className="loginForm">
          <input name="next" type="hidden" value={next} />
          <label>
            Användarnamn / e-post
            <input autoComplete="username" name="email" type="email" />
          </label>
          <label>
            Lösenord
            <input autoComplete="current-password" name="password" type="password" />
          </label>
          <button>Logga in</button>
        </form>
      </section>

      <section className="loginRoles">
        {loginNotes.map(([role, text]) => (
          <article className="portalPanel" key={role}>
            <h3>{role}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
