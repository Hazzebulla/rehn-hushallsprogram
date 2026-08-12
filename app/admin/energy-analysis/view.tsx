"use client";

import { useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  rsk: string;
  type: "Bergvärme" | "Luft/vatten";
  heatKw: number;
  baseScop: number;
  priceExVat: number;
};

type QuoteRow = {
  id: string;
  title: string;
  qty: number;
  unitPrice: number;
  showPrice: boolean;
  includeInReport: boolean;
  position: string;
};

const products: Product[] = [
  { id: "gsi-608", name: "CTC GSi 608", rsk: "6249336", type: "Bergvärme", heatKw: 8, baseScop: 4.2, priceExVat: 98000 },
  { id: "gsi-612", name: "CTC GSi 612", rsk: "6249337", type: "Bergvärme", heatKw: 12, baseScop: 4.15, priceExVat: 109500 },
  { id: "gsi-616", name: "CTC GSi 616", rsk: "6249338", type: "Bergvärme", heatKw: 16, baseScop: 4.1, priceExVat: 120330 },
  { id: "ecoair-614m", name: "CTC EcoAir 614M", rsk: "6241427", type: "Luft/vatten", heatKw: 14, baseScop: 3.65, priceExVat: 87500 },
];

const defaultRows: QuoteRow[] = [
  { id: "pump", title: "Värmepump enligt vald produkt", qty: 1, unitPrice: 120330, showPrice: true, includeInReport: true, position: "1" },
  { id: "install", title: "Installation, driftsättning och injustering", qty: 1, unitPrice: 48500, showPrice: true, includeInReport: true, position: "2" },
  { id: "borehole", title: "Borrhålsåtgärd / kollektorkontroll", qty: 1, unitPrice: 0, showPrice: true, includeInReport: true, position: "3" },
  { id: "documentation", title: "Dokumentation, energirapport och kundgenomgång", qty: 1, unitPrice: 3900, showPrice: true, includeInReport: true, position: "4" },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function money(value: number) {
  return `${Math.round(value).toLocaleString("sv-SE")} kr`;
}

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function EnergyAnalysisView() {
  const [customerName, setCustomerName] = useState("Anna & Erik Svensson");
  const [customerEmail, setCustomerEmail] = useState("kund@example.se");
  const [address, setAddress] = useState("Björkvägen 12, Bromma");
  const [managerName, setManagerName] = useState("Mattias Rehn");
  const [quoteNo, setQuoteNo] = useState(`EV-${new Date().getFullYear()}-6249338`);
  const [quoteDate, setQuoteDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [validUntil, setValidUntil] = useState("30 dagar");
  const [showQuotePreview, setShowQuotePreview] = useState(false);
  const [municipality, setMunicipality] = useState("Sundsvall");
  const [mode, setMode] = useState<"energy" | "power">("energy");
  const [annualEnergy, setAnnualEnergy] = useState("44780");
  const [hotWater, setHotWater] = useState("5000");
  const [designLoad, setDesignLoad] = useState("14");
  const [atemp, setAtemp] = useState("305");
  const [dvut, setDvut] = useState("-22.9");
  const [supplyTemp, setSupplyTemp] = useState("55");
  const [heatFrom, setHeatFrom] = useState("17");
  const [timeConstant, setTimeConstant] = useState("1");
  const [ventilation, setVentilation] = useState("Ingen/Frånluft");
  const [currentBorehole, setCurrentBorehole] = useState("140");
  const [boreholeCount, setBoreholeCount] = useState("1");
  const [additionalBorehole, setAdditionalBorehole] = useState("0");
  const [rockLambda, setRockLambda] = useState("3.4");
  const [brineDelta, setBrineDelta] = useState("3");
  const [productId, setProductId] = useState("gsi-616");
  const [rotCustomer, setRotCustomer] = useState(true);
  const [rows, setRows] = useState<QuoteRow[]>(defaultRows);
  const [message, setMessage] = useState("Redo för platsberäkning.");

  const selectedProduct = products.find((product) => product.id === productId) ?? products[2];

  const result = useMemo(() => {
    const before = mode === "energy"
      ? Math.max(0, numberValue(annualEnergy))
      : Math.max(0, numberValue(designLoad) * 2850 + numberValue(hotWater));
    const hotWaterKwh = numberValue(hotWater);
    const area = Math.max(1, numberValue(atemp));
    const supplyPenalty = clamp((numberValue(supplyTemp) - 45) * 0.018, -0.18, 0.38);
    const brinePenalty = selectedProduct.type === "Bergvärme" ? clamp((numberValue(brineDelta) - 3) * 0.04, -0.08, 0.2) : 0;
    const scop = clamp(selectedProduct.baseScop - supplyPenalty - brinePenalty, 2.4, 5.1);
    const heatDemand = Math.max(0, before - hotWaterKwh);
    const powerCoverage = clamp((selectedProduct.heatKw / Math.max(1, numberValue(designLoad))) * 100, 35, 100);
    const energyCoverage = clamp(powerCoverage + 5, 45, 100);
    const after = Math.round((heatDemand * (energyCoverage / 100)) / scop + heatDemand * (1 - energyCoverage / 100) + hotWaterKwh / clamp(scop - 0.35, 2, 5));
    const savings = Math.max(0, before - after);
    const savingsPercent = before ? Math.round((savings / before) * 100) : 0;
    const existingBorehole = numberValue(currentBorehole) * Math.max(0, numberValue(boreholeCount));
    const plannedAdditionalBorehole = Math.max(0, numberValue(additionalBorehole));
    const boreholeNeed = selectedProduct.type === "Bergvärme"
      ? Math.round(clamp(savings * 0.0086 * (3.4 / Math.max(2, numberValue(rockLambda))), 80, 420))
      : 0;
    const boreholeShortfall = Math.max(0, boreholeNeed - existingBorehole - plannedAdditionalBorehole);
    const suggestedAdditionalBorehole = selectedProduct.type === "Bergvärme" ? Math.max(plannedAdditionalBorehole, boreholeShortfall) : 0;
    const specificExtraction = boreholeNeed ? Math.round(savings / boreholeNeed) : 0;
    const petBefore = Math.round(before / area);
    const petAfter = Math.round(after / area);
    const monthly = [12, 11, 10, 8, 5, 2, 1, 1, 3, 6, 9, 12].map((weight, index) => ({
      month: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"][index],
      before: Math.round((before * weight) / 80),
      after: Math.round((after * weight) / 80),
    }));

    return {
      before,
      after,
      savings,
      savingsPercent,
      scop,
      powerCoverage,
      energyCoverage,
      boreholeNeed,
      specificExtraction,
      petBefore,
      petAfter,
      monthly,
      boreholeShortfall,
      existingBorehole,
      plannedAdditionalBorehole,
      suggestedAdditionalBorehole,
      warning: existingBorehole > 0 && boreholeNeed > 0 && existingBorehole < boreholeNeed,
    };
  }, [additionalBorehole, annualEnergy, atemp, boreholeCount, brineDelta, currentBorehole, designLoad, hotWater, mode, rockLambda, selectedProduct, supplyTemp]);

  const quote = useMemo(() => {
    const rowsWithProduct = rows.map((row) => row.id === "pump" ? { ...row, title: selectedProduct.name, unitPrice: selectedProduct.priceExVat } : row);
    const subtotal = rowsWithProduct.reduce((sum, row) => sum + row.qty * row.unitPrice, 0);
    const laborBase = rowsWithProduct.filter((row) => /installation|driftsättning|borr|kollektor/i.test(row.title)).reduce((sum, row) => sum + row.qty * row.unitPrice, 0);
    const rot = rotCustomer ? Math.min(laborBase * 0.3, 50000) : 0;
    const afterRot = Math.max(0, subtotal - rot);
    const vat = afterRot * 0.25;
    return { rows: rowsWithProduct, subtotal, rot, afterRot, vat, total: afterRot + vat };
  }, [rows, rotCustomer, selectedProduct]);

  const qualityChecks = useMemo(() => {
    const checks = [
      {
        label: "Kund och adress",
        ok: Boolean(customerName.trim() && customerEmail.trim() && address.trim()),
        detail: "Kund, e-post och fastighetsadress krävs innan offert skickas.",
      },
      {
        label: "Energiunderlag",
        ok: result.before > 0 && numberValue(atemp) > 0 && numberValue(designLoad) > 0,
        detail: "Årsenergi/effekt, Atemp och DVUT-effekt måste vara rimliga.",
      },
      {
        label: "Värmekurva",
        ok: numberValue(supplyTemp) <= 60,
        detail: "Hög framledning ger lägre besparing och bör kontrolleras mot radiatorerna.",
      },
      {
        label: "Borrhål",
        ok: selectedProduct.type !== "Bergvärme" || !result.warning,
        detail: result.warning ? `Beräknat behov ${result.boreholeNeed} m. Befintligt + planerat: ${Math.round(result.existingBorehole + result.plannedAdditionalBorehole)} m.` : "Borrhålsbehovet ser rimligt ut mot indata.",
      },
      {
        label: "Offert",
        ok: quote.total > 0 && quote.rows.some((row) => row.includeInReport),
        detail: "Minst en rapporterad offertpost och totalsumma krävs.",
      },
    ];

    const passed = checks.filter((check) => check.ok).length;
    return {
      checks,
      passed,
      status: passed === checks.length ? "Offertklar" : passed >= 3 ? "Behöver kontroll" : "Underlag saknas",
    };
  }, [address, atemp, customerEmail, customerName, designLoad, quote, result, selectedProduct.type, supplyTemp]);

  function updateRow(id: string, patch: Partial<QuoteRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { id: `row-${Date.now()}`, title: "Egen rad", qty: 1, unitPrice: 0, showPrice: true, includeInReport: true, position: String(current.length + 1) },
    ]);
  }

  function updateQuoteFromAnalysis() {
    const drillingMeters = Math.round(result.suggestedAdditionalBorehole);
    const boreholePrice = drillingMeters > 0 ? drillingMeters * 520 : 0;
    setRows((current) =>
      current.map((row) => {
        if (row.id === "install") return { ...row, unitPrice: selectedProduct.type === "Bergvärme" ? 54500 : 46500 };
        if (row.id === "borehole") {
          return {
            ...row,
            title: drillingMeters > 0 ? `Tilläggsborrning ${drillingMeters} m / kollektorkontroll` : "Borrhålskontroll och protokollgenomgång",
            unitPrice: boreholePrice,
          };
        }
        return row;
      }),
    );
    setMessage("Offertens installations- och borrhålsrad uppdaterades från analysen.");
  }

  const mailBody = [
    `Hej ${customerName},`,
    "",
    "Här kommer preliminärt offertunderlag efter RVM energianalys värme.",
    "",
    `Offertnummer: ${quoteNo}`,
    `Ansvarig: ${managerName}`,
    `Fastighet: ${address}`,
    `Rekommenderad lösning: ${selectedProduct.name} (${selectedProduct.type}, RSK ${selectedProduct.rsk})`,
    `Beräknad energibesparing: ${result.savings.toLocaleString("sv-SE")} kWh/år (${result.savingsPercent} %)`,
    `Årsvärmefaktor: ${result.scop.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}`,
    result.boreholeNeed ? `Minsta rekommenderade aktiva borrhål: ${result.boreholeNeed} m` : "",
    result.boreholeNeed ? `Befintligt + planerad tilläggsborrning: ${Math.round(result.existingBorehole + result.plannedAdditionalBorehole)} m` : "",
    result.suggestedAdditionalBorehole ? `Föreslagen tilläggsborrning: ${Math.round(result.suggestedAdditionalBorehole)} m` : "",
    "",
    "Offertposter:",
    ...quote.rows.filter((row) => row.includeInReport).map((row) => `- ${row.title}: ${row.showPrice ? money(row.qty * row.unitPrice) : "pris visas ej"}`),
    "",
    `Preliminär totalsumma inkl. moms efter ROT: ${money(quote.total)}`,
    "",
    "Offerten är preliminär och ska kontrolleras mot platsbesök, materialval och slutlig projektering innan accept.",
    "",
    "Med vänlig hälsning",
    "Rehn VVS & Montage",
  ].filter(Boolean).join("\n");

  function sendQuote() {
    const href = `mailto:${encodeURIComponent(customerEmail)}?subject=${encodeURIComponent(`${quoteNo} - Offert energianalys värme - ${selectedProduct.name}`)}&body=${encodeURIComponent(mailBody)}`;
    window.location.href = href;
    setMessage("E-postutkast öppnat. Kontrollera mottagare, bilagor och villkor innan skick.");
  }

  async function copyQuote() {
    await navigator.clipboard.writeText(mailBody);
    setMessage("Offerttext kopierad till urklipp.");
  }

  return (
    <section className="adminWork energyModule">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">Energianalys värme</p>
          <h1>Räkna värmepump på plats och skapa offertunderlag direkt.</h1>
          <p>
            Modulen följer arbetsflödet från CTC Select: adress, energi- eller effektläge, värmekurva,
            varmvatten, ventilation, avancerade brine/bergvärden, produktval, resultat, offert, rapport och utskick.
          </p>
          <div className="persistenceNote online">{message}</div>
        </div>
        <div className="portalActions">
          <a className="buttonLink" href="/admin/customers">Kunder</a>
          <a className="buttonLink" href="/admin/documents">Dokument</a>
          <button className="buttonLink" type="button" onClick={() => setShowQuotePreview((current) => !current)}>
            {showQuotePreview ? "Dölj offert" : "Visa offert"}
          </button>
          <button className="buttonLink" type="button" onClick={copyQuote}>Kopiera offert</button>
          <button className="buttonLink primary" type="button" onClick={sendQuote}>Skicka offert</button>
        </div>
      </header>

      <section className="adminKpis">
        <article className="portalPanel"><span>Före</span><strong>{result.before.toLocaleString("sv-SE")}</strong><small>kWh/år</small></article>
        <article className="portalPanel"><span>Efter</span><strong>{result.after.toLocaleString("sv-SE")}</strong><small>kWh/år</small></article>
        <article className="portalPanel"><span>Besparing</span><strong>{result.savingsPercent} %</strong><small>{result.savings.toLocaleString("sv-SE")} kWh/år</small></article>
        <article className="portalPanel"><span>Offert</span><strong>{money(quote.total)}</strong><small>inkl. moms efter ROT</small></article>
      </section>

      <section className="portalPanel energyQuality">
        <div className="panelTitle">
          <h3>Analysstatus: {qualityChecks.status}</h3>
          <span>{qualityChecks.passed}/{qualityChecks.checks.length} kontroller godkända</span>
        </div>
        <div className="energyFlow">
          {["Indata", "Beräkna", "Produkt", "Offert", "Utskick"].map((step, index) => (
            <div className={index < Math.max(1, qualityChecks.passed) ? "done" : ""} key={step}>
              <b>{index + 1}</b>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <div className="energyCheckGrid">
          {qualityChecks.checks.map((check) => (
            <article className={check.ok ? "ok" : "warn"} key={check.label}>
              <strong>{check.label}</strong>
              <span>{check.ok ? "OK" : "Kontroll"}</span>
              <p>{check.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="energyWorkspace">
        <article className="portalPanel energyPanel">
          <div className="panelTitle"><h3>1. Kund och indata</h3><span>Platsbesök</span></div>
          <div className="energyFormGrid">
            <label>Kund<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
            <label>E-post<input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></label>
            <label>Adress<input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
            <label>Ansvarig<input value={managerName} onChange={(event) => setManagerName(event.target.value)} /></label>
            <label>Offertnummer<input value={quoteNo} onChange={(event) => setQuoteNo(event.target.value)} /></label>
            <label>Offertdatum<input value={quoteDate} onChange={(event) => setQuoteDate(event.target.value)} /></label>
            <label>Giltighet<input value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
            <label>Kommun klimatdata<input value={municipality} onChange={(event) => setMunicipality(event.target.value)} /></label>
            <label>Beräkningsläge<select value={mode} onChange={(event) => setMode(event.target.value as "energy" | "power")}><option value="energy">Energiläge kWh</option><option value="power">Effektläge kW</option></select></label>
            <label>Årsenergi inkl. värme/VV<input inputMode="decimal" value={annualEnergy} onChange={(event) => setAnnualEnergy(event.target.value)} /></label>
            <label>Effektbehov DVUT kW<input inputMode="decimal" value={designLoad} onChange={(event) => setDesignLoad(event.target.value)} /></label>
            <label>Atemp m²<input inputMode="decimal" value={atemp} onChange={(event) => setAtemp(event.target.value)} /></label>
            <label>DVUT °C<input inputMode="decimal" value={dvut} onChange={(event) => setDvut(event.target.value)} /></label>
            <label>Framledning vid DVUT °C<input inputMode="decimal" value={supplyTemp} onChange={(event) => setSupplyTemp(event.target.value)} /></label>
            <label>Värme från °C<input inputMode="decimal" value={heatFrom} onChange={(event) => setHeatFrom(event.target.value)} /></label>
            <label>Varmvatten kWh/år<input inputMode="decimal" value={hotWater} onChange={(event) => setHotWater(event.target.value)} /></label>
            <label>Ventilation<select value={ventilation} onChange={(event) => setVentilation(event.target.value)}><option>Ingen/Frånluft</option><option>Från- och tilluft</option><option>FTX med återvinning</option></select></label>
            <label>Tidskonstant dagar<input inputMode="decimal" value={timeConstant} onChange={(event) => setTimeConstant(event.target.value)} /></label>
            <label>Befintligt aktivt borrhål per hål m<input inputMode="decimal" value={currentBorehole} onChange={(event) => setCurrentBorehole(event.target.value)} /></label>
            <label>Antal befintliga borrhål<input inputMode="decimal" value={boreholeCount} onChange={(event) => setBoreholeCount(event.target.value)} /></label>
            <label>Planerad tilläggsborrning m<input inputMode="decimal" value={additionalBorehole} onChange={(event) => setAdditionalBorehole(event.target.value)} /></label>
            <label>Berg lambda W/(mK)<input inputMode="decimal" value={rockLambda} onChange={(event) => setRockLambda(event.target.value)} /></label>
            <label>Delta brine °C<input inputMode="decimal" value={brineDelta} onChange={(event) => setBrineDelta(event.target.value)} /></label>
            <label>Produkt<select value={productId} onChange={(event) => setProductId(event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          </div>
        </article>

        <article className="portalPanel energyPanel">
          <div className="panelTitle"><h3>2. Resultat</h3><span>{selectedProduct.name}</span></div>
          <div className="energyResultGrid">
            <div><span>Årsvärmefaktor</span><strong>{result.scop.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}</strong></div>
            <div><span>Energitäckning</span><strong>{Math.round(result.energyCoverage)} %</strong></div>
            <div><span>Effekttäckning</span><strong>{Math.round(result.powerCoverage)} %</strong></div>
            <div><span>PET före/efter</span><strong>{result.petBefore}/{result.petAfter}</strong></div>
            <div><span>Borrhål krav</span><strong>{result.boreholeNeed ? `${result.boreholeNeed} m` : "Ej aktuellt"}</strong></div>
            <div><span>Befintligt + tillägg</span><strong>{result.boreholeNeed ? `${Math.round(result.existingBorehole + result.plannedAdditionalBorehole)} m` : "Ej aktuellt"}</strong></div>
            <div><span>Föreslagen tilläggsborrning</span><strong>{result.suggestedAdditionalBorehole ? `${Math.round(result.suggestedAdditionalBorehole)} m` : "0 m"}</strong></div>
            <div><span>Energiuttag</span><strong>{result.specificExtraction ? `${result.specificExtraction} kWh/m` : "Ej aktuellt"}</strong></div>
          </div>
          {result.warning && <div className="riskNotice">Befintligt borrhål verkar kortare än beräknat behov. Kontrollera borrhålsprotokoll och kollektor innan offert låses.</div>}
          <div className="monthBars">
            {result.monthly.map((month) => (
              <div key={month.month}>
                <span>{month.month}</span>
                <i style={{ width: `${clamp((month.before / Math.max(1, result.monthly[0].before)) * 100, 4, 100)}%` }} />
                <b style={{ width: `${clamp((month.after / Math.max(1, result.monthly[0].before)) * 100, 4, 100)}%` }} />
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="portalPanel">
        <div className="panelTitle"><h3>3. Offert</h3><span>Prisrader, ROT och rapportval</span></div>
        <div className="quoteToolbar">
          <label><input type="checkbox" checked={rotCustomer} onChange={(event) => setRotCustomer(event.target.checked)} /> ROT-kund</label>
          <button type="button" onClick={updateQuoteFromAnalysis}>Uppdatera från analys</button>
          <button type="button" onClick={addRow}>Lägg till rad</button>
        </div>
        <div className="energyQuoteList">
          {quote.rows.map((row) => (
            <article key={row.id}>
              <input value={row.position} onChange={(event) => updateRow(row.id, { position: event.target.value })} aria-label="Position" />
              <input value={row.title} onChange={(event) => updateRow(row.id, { title: event.target.value })} aria-label="Radtext" />
              <input value={row.qty} inputMode="decimal" onChange={(event) => updateRow(row.id, { qty: numberValue(event.target.value) })} aria-label="Antal" />
              <input value={row.unitPrice} inputMode="decimal" onChange={(event) => updateRow(row.id, { unitPrice: numberValue(event.target.value) })} aria-label="Pris" />
              <label><input type="checkbox" checked={row.showPrice} onChange={(event) => updateRow(row.id, { showPrice: event.target.checked })} /> Visa pris</label>
              <label><input type="checkbox" checked={row.includeInReport} onChange={(event) => updateRow(row.id, { includeInReport: event.target.checked })} /> Rapport</label>
              <strong>{money(row.qty * row.unitPrice)}</strong>
            </article>
          ))}
        </div>
        <div className="energyTotals">
          <span>Exkl. moms: <strong>{money(quote.subtotal)}</strong></span>
          <span>ROT: <strong>-{money(quote.rot)}</strong></span>
          <span>Moms: <strong>{money(quote.vat)}</strong></span>
          <span>Totalt: <strong>{money(quote.total)}</strong></span>
        </div>
      </section>

      {showQuotePreview && <section className="portalPanel quotePreviewShell" id="quote-preview">
        <div className="panelTitle">
          <h3>4. Förhandsgranska offert</h3>
          <span>Bygglet-inspirerad kundlayout</span>
        </div>
        <article className="quoteDocument" aria-label="Offertförhandsgranskning">
          <header className="quoteDocHeader">
            <div className="quoteLogoBlock">
              <div className="miniMark" />
              <div>
                <strong>RVM</strong>
                <span>Rehn VVS & Montage AB</span>
              </div>
            </div>
            <div className="quoteDocTitle">
              <h2>Offert</h2>
              <strong>{quoteNo}</strong>
              <span>Sida 1 (1)</span>
            </div>
          </header>

          <div className="quoteDocMeta">
            <dl>
              <div><dt>Offertnr:</dt><dd>{quoteNo}</dd></div>
              <div><dt>Ansvarig:</dt><dd>{managerName || "Ansvarig saknas"}</dd></div>
              <div><dt>Datum:</dt><dd>{quoteDate}</dd></div>
              <div><dt>Giltig t.o.m:</dt><dd>{validUntil}</dd></div>
            </dl>
            <dl>
              <div><dt>Kund:</dt><dd>{customerName || "Kund saknas"}</dd></div>
              <div><dt>Arbetsplats:</dt><dd>{address || "Adress saknas"}</dd></div>
              <div><dt>Kontakt:</dt><dd>{customerEmail || "E-post saknas"}</dd></div>
              <div><dt>Projekt:</dt><dd>Energianalys värme</dd></div>
            </dl>
          </div>

          <section className="quoteDocSection">
            <h3>Projekt: {selectedProduct.name}</h3>
            <div className="quoteDocLine" />
            <strong>Offertbeskrivning:</strong>
            <p>
              Leverans och installation av {selectedProduct.name} baserat på RVM energianalys värme.
              Beräknad energibesparing är {result.savings.toLocaleString("sv-SE")} kWh/år, cirka {result.savingsPercent} %.
              Offerten är preliminär tills platskontroll, materialval och villkor är granskade.
            </p>
          </section>

          <section className="quoteDocSection">
            <table className="quoteDocTable">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Benämning</th>
                  <th>Antal</th>
                  <th>À-pris</th>
                  <th>Summa</th>
                </tr>
              </thead>
              <tbody>
                {quote.rows.filter((row) => row.includeInReport).map((row) => (
                  <tr key={row.id}>
                    <td>{row.position}</td>
                    <td>{row.title}</td>
                    <td>{row.qty}</td>
                    <td>{row.showPrice ? money(row.unitPrice) : "-"}</td>
                    <td>{row.showPrice ? money(row.qty * row.unitPrice) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="quoteDocSummary">
            <div>
              <strong>Beräkningsunderlag</strong>
              <span>Före: {result.before.toLocaleString("sv-SE")} kWh/år</span>
              <span>Efter: {result.after.toLocaleString("sv-SE")} kWh/år</span>
              <span>Årsvärmefaktor: {result.scop.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}</span>
              {result.boreholeNeed > 0 && <span>Min. aktivt borrhål: {result.boreholeNeed} m</span>}
              {result.boreholeNeed > 0 && <span>Befintligt + tillägg: {Math.round(result.existingBorehole + result.plannedAdditionalBorehole)} m</span>}
              {result.suggestedAdditionalBorehole > 0 && <span>Föreslagen tilläggsborrning: {Math.round(result.suggestedAdditionalBorehole)} m</span>}
            </div>
            <div className="quoteDocTotals">
              <span>Summa exkl. moms <strong>{money(quote.subtotal)}</strong></span>
              <span>ROT-avdrag <strong>-{money(quote.rot)}</strong></span>
              <span>Moms 25 % <strong>{money(quote.vat)}</strong></span>
              <b>Att betala inkl. moms {money(quote.total)}</b>
            </div>
          </section>

          <section className="quoteDocTerms">
            <strong>Villkor:</strong>
            <p>
              Offerten gäller efter godkänd platskontroll. Eventuella tillkommande arbeten, myndighetskrav,
              borrhålsåtgärder eller materialavvikelser offereras separat innan utförande.
            </p>
          </section>

          <footer className="quoteDocFooter">
            <div><strong>Postadress</strong><span>Rehn VVS & Montage I Timrå AB</span><span>Arbetsledarvägen 10</span><span>863 41 Sundsvall</span></div>
            <div><strong>Telefon</strong><span>070 298 86 63</span></div>
            <div><strong>Bankgiro</strong><span>5006-7636</span><strong>Momsreg.nr</strong><span>SE559017231701</span></div>
            <div><span>Godkänd för F-skatt</span><em>Offert skapad via RVM SaaS</em></div>
          </footer>
        </article>
      </section>}

      <section className="adminGrid lower">
        <article className="portalPanel">
          <div className="panelTitle"><h3>5. Rapporttext</h3><span>Kundunderlag</span></div>
          <p>
            Beräkningen visar ett beräknat energibehov före åtgärd på {result.before.toLocaleString("sv-SE")} kWh/år
            och efter åtgärd på {result.after.toLocaleString("sv-SE")} kWh/år med {selectedProduct.name}.
            Preliminär besparing är {result.savings.toLocaleString("sv-SE")} kWh/år, cirka {result.savingsPercent} %.
          </p>
          <ul className="dotList">
            <li>Verifiera befintlig värmekälla, borrhål och systemstatus på plats.</li>
            <li>Jämför kalkyl mot faktisk energiförbrukning och kundens driftvanor.</li>
            <li>Lås offert först efter materialkontroll, arbetsomfattning och villkor.</li>
          </ul>
        </article>
        <article className="portalPanel">
          <div className="panelTitle"><h3>6. Dokument och utskick</h3><span>Efter CTC Select-flödet</span></div>
          <div className="systemChecks">
            <div><strong>Produktblad</strong><b>Valbart</b><span>Bifoga produktblad, RSK och manualer.</span></div>
            <div><strong>Ecodesign</strong><b>Valbart</b><span>Lägg till energietikett när den finns.</span></div>
            <div><strong>Offert</strong><b>Utkast</b><span>Skickas via e-postutkast från knappen ovan.</span></div>
            <div><strong>Accept</strong><b>Separat</b><span>Affär markeras först när kund godkänt offert.</span></div>
          </div>
        </article>
      </section>
    </section>
  );
}
