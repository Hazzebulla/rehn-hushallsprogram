"use client";

import { useState, useTransition } from "react";
import { runLocalBackupAction } from "./actions";
import type { BackupVm } from "./page";

export default function BackupView({
  backups,
  databaseOnline,
}: {
  backups: BackupVm[];
  databaseOnline: boolean;
}) {
  const [message, setMessage] = useState(
    databaseOnline ? "Backuphistorik läses från databasen." : "Databasen är offline. Backup kan inte köras.",
  );
  const [isPending, startTransition] = useTransition();

  function runBackup() {
    startTransition(async () => {
      const result = await runLocalBackupAction();
      setMessage(result.message);
      if (result.ok) {
        window.location.reload();
      }
    });
  }

  return (
    <section className="adminWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">Lokal demo-backup</p>
          <h1>Skapa kontrollerad backup av databas och dokument.</h1>
          <p>
            I Fas 1 räcker en lokal backup för demo. Den kopierar SQLite-databasen och skriver ett manifest med checksumma.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Skapar backup..." : message}
          </div>
        </div>
        <div className="portalActions">
          <button disabled={!databaseOnline || isPending} onClick={runBackup}>Kör backup</button>
        </div>
      </header>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Backupkörningar</h3>
          <span>{backups.length} jobb</span>
        </div>
        <div className="opsTable">
          {backups.map((backup) => (
            <article key={backup.id}>
              <strong>{backup.status}</strong>
              <span>{backup.scope}</span>
              <span>{backup.storageKey}</span>
              <b>{backup.checksum}</b>
              <time>{backup.createdAt} → {backup.finishedAt}</time>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
