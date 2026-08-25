export type RvmField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "textarea" | "select" | "checklist";
  options?: string[];
  source?: boolean;
};

export type RvmSection = {
  id: number;
  title: string;
  description: string;
  fields: RvmField[];
};

const yn = ["Ja", "Nej", "Ej kontrollerat"];
const ok = ["OK", "Avvikelse", "Ej kontrollerat"];
const present = ["Finns", "Saknas", "Rekommenderas", "Ej aktuellt", "Ej kontrollerat"];
const checked = ["Kontrollerat", "Avvikelse", "Ej aktuellt", "Ej åtkomligt"];

export const rvmSections: RvmSection[] = [
  {
    id: 1,
    title: "Kund, fastighet och omfattning",
    description: "Skilj kunduppgift från verifierat underlag och ej åtkomliga delar.",
    fields: [
      { key: "customer_name", label: "Kundnamn", type: "text", source: true },
      { key: "contact", label: "Telefon / e-post", type: "text", source: true },
      { key: "property_address", label: "Fastighetsadress / fastighetsbeteckning", type: "text", source: true },
      { key: "build_year", label: "Byggår / större ombyggnadsår", type: "number", source: true },
      { key: "area_floors", label: "Boyta / biyta / antal plan", type: "text", source: true },
      { key: "foundation", label: "Grundläggning", type: "select", options: ["Platta", "Källare", "Krypgrund", "Annat"] },
      { key: "scope", label: "Kontrollens omfattning", type: "select", options: ["Full husstatus", "Del av hus", "Annat"] },
      { key: "external_property_source", label: "Extern underlagslänk, t.ex. Ratsit/MrKoll", type: "text", source: true },
      { key: "property_import_notes", label: "Importerad fastighetsinfo / anteckningar från underlag", type: "textarea", source: true },
      { key: "not_accessible", label: "Ej åtkomliga utrymmen eller produkter", type: "textarea" },
    ],
  },
  {
    id: 2,
    title: "Kundens upplevelse och historik",
    description: "Problem, historik och återkommande driftmönster.",
    fields: [
      { key: "uneven_heat", label: "Ojämn värme / kalla rum", type: "select", options: ["Ja", "Nej", "Periodvis"] },
      { key: "high_energy", label: "Hög energiförbrukning", type: "select", options: ["Ja", "Nej", "Okänt"] },
      { key: "poor_pressure", label: "Dåligt tryck eller flöde", type: "select", options: yn },
      { key: "pressure_loss", label: "Återkommande tryckfall eller påfyllning", type: "select", options: yn },
      { key: "previous_damage", label: "Tidigare läckage / vattenskada / frysskada", type: "select", options: yn },
      { key: "history_notes", label: "Kommentarer från kund och historik", type: "textarea", source: true },
    ],
  },
  {
    id: 3,
    title: "Snabbstart för platsbesök",
    description: "Starta genomgången med status, ansvarig och vilka underlag som finns. Bilder samlas i avsnitt 25.",
    fields: [
      { key: "inspection_status", label: "Genomgångens status", type: "select", options: ["Påbörjad", "Pågår", "Klar för granskning", "Komplettering krävs"] },
      { key: "inspection_owner", label: "Ansvarig montör / arbetsledare", type: "text" },
      { key: "customer_present", label: "Kund med på plats", type: "select", options: yn },
      { key: "documents_available", label: "Underlag finns", type: "checklist", options: ["Tidigare serviceprotokoll", "Manualer", "Energiförbrukning", "Ritning", "Produktbilder", "Kundens självdeklaration"] },
      { key: "quick_scope_notes", label: "Snabbanteckning inför kontroll", type: "textarea", source: true },
    ],
  },
  {
    id: 4,
    title: "Inkommande vatten, servis och vattenmätare",
    description: "Grunddata, ventiler, tryck och flöde.",
    fields: [
      { key: "water_source", label: "Vattenkälla", type: "select", options: ["Kommunalt", "Egen brunn", "Okänt"] },
      { key: "service_material", label: "Servismaterial / dimension", type: "text" },
      { key: "water_meter", label: "Vattenmätarfabrikat / Q3 / nummer", type: "text" },
      { key: "main_shutoff", label: "Huvudavstängning typ / dimension", type: "text" },
      { key: "static_pressure_bar", label: "Statisk vattentryck bar", type: "number", source: true },
      { key: "dynamic_pressure_bar", label: "Dynamiskt vattentryck bar", type: "number", source: true },
      { key: "flow_l_min", label: "Flöde vid tappunkt l/min", type: "number", source: true },
    ],
  },
  {
    id: 5,
    title: "Egen brunn, hydrofor/hydropress och vattenrening",
    description: "Fylls i när systemet finns.",
    fields: [
      { key: "well_type_depth", label: "Brunntyp / borrdjup", type: "text" },
      { key: "well_pump", label: "Pumpfabrikat / modell", type: "text" },
      { key: "hydropress", label: "Hydrofor/hydropress fabrikat och volym", type: "text" },
      { key: "filter_type", label: "Filtertyp / UV / avhärdare", type: "text" },
      { key: "water_sample", label: "Vattenprov rekommenderas", type: "select", options: yn },
      { key: "well_notes", label: "Servicehistorik / observationer", type: "textarea" },
    ],
  },
  {
    id: 6,
    title: "Tappvarmvatten, varmvattenberedare och VVC",
    description: "Produktregister, legionellarisk och temperaturer.",
    fields: [
      { key: "hot_water_type", label: "Typ: VVB / värmepump / panna / växlare", type: "select", options: ["Värmepump med integrerad VVB", "Extern varmvattenberedare", "Panna", "Värmeväxlare", "Elberedare", "Okänt"] },
      { key: "hot_water_product", label: "Serienummer, år, volym och effekt", type: "text" },
      { key: "mixing_valve", label: "Blandningsventil fabrikat/modell", type: "text" },
      { key: "hot_water_out_c", label: "Varmvatten ut från produktion °C", type: "number", source: true },
      { key: "nearest_tap_c", label: "Närmaste tappställe °C", type: "number", source: true },
      { key: "furthest_tap_c", label: "Längst bort tappställe °C", type: "number", source: true },
      { key: "time_to_50_sec", label: "Tid till 50 °C sek", type: "number", source: true },
    ],
  },
  {
    id: 7,
    title: "Värmekälla och värmeproduktion",
    description: "Systemtyp, driftbild, larm och svårersatta komponenter.",
    fields: [
      { key: "heat_source_type", label: "Systemtyp", type: "select", options: ["Bergvärme", "Jordvärme", "Luft/vatten", "Frånluftsvärmepump", "Fjärrvärme", "Elpanna", "Pelletspanna", "Vedpanna", "Okänt"] },
      { key: "heat_source_product", label: "Fabrikat, modell, serienummer, år", type: "text" },
      { key: "nominal_power", label: "Nominell effekt / tillsats", type: "text" },
      { key: "control_system", label: "Styrsystem / programversion", type: "text" },
      { key: "service_history", label: "Servicehistorik", type: "textarea" },
      { key: "alarms", label: "Aktuella / historiska larm", type: "textarea" },
    ],
  },
  {
    id: 8,
    title: "Energibrunn / markslinga och köldbärarsystem",
    description: "Borrhål, kollektor och brinetemperaturer.",
    fields: [
      { key: "energy_source_type", label: "Typ: energibrunn / jordvärme", type: "select", options: ["Energibrunn", "Jordvärmeslinga", "Sjövärme", "Luft/vatten", "Ej aktuellt", "Okänt"] },
      { key: "drill_depth", label: "Totalt / aktivt borrdjup", type: "text" },
      { key: "collector_type", label: "Kollektortyp / dimension", type: "text" },
      { key: "brine_in_c", label: "Brine in °C", type: "number", source: true },
      { key: "brine_out_c", label: "Brine ut °C", type: "number", source: true },
      { key: "brine_pressure_bar", label: "Köldbärartryck bar", type: "number", source: true },
      { key: "extra_drilling", label: "Tilläggsborrning bör utredas", type: "select", options: yn },
    ],
  },
  {
    id: 9,
    title: "Värmedistribution, tryckhållning och säkerhetsutrustning",
    description: "Cirkulation, expansionskärl, ventiler och mätvärden.",
    fields: [
      { key: "heat_pipe_material", label: "Huvudmaterial värmeledningar", type: "select", options: ["Stål", "Koppar", "PEX", "Alupex", "Blandat", "Okänt"] },
      { key: "circulation_pump", label: "Cirkulationspump fabrikat/modell", type: "text" },
      { key: "expansion_vessel", label: "Expansionskärl fabrikat/modell/volym", type: "text" },
      { key: "safety_valve", label: "Säkerhetsventil tryck/dimension", type: "text" },
      { key: "supply_temp_c", label: "Framledning värme °C", type: "number", source: true },
      { key: "return_temp_c", label: "Returledning värme °C", type: "number", source: true },
      { key: "heat_pressure_bar", label: "Systemtryck värme bar", type: "number", source: true },
    ],
  },
  {
    id: 10,
    title: "Radiatorer, radiatorventiler och golvvärme",
    description: "Antal, skick, paketbyte och injustering.",
    fields: [
      { key: "radiators_total", label: "Antal radiatorer totalt", type: "number", source: true },
      { key: "radiator_valves_total", label: "Antal radiatorventiler / termostater", type: "number", source: true },
      { key: "valve_type", label: "Ventilfabrikat / typ / dimension", type: "text" },
      { key: "valves_stuck", label: "Ventiler kärvar / läcker / saknar reglering", type: "select", options: yn },
      { key: "floor_heating", label: "Golvvärmefördelare / antal slingor", type: "text" },
      { key: "radiator_package_notes", label: "Paketdata och reservationer", type: "textarea" },
    ],
  },
  {
    id: 11,
    title: "Tappvattenledningar, rörmaterial, dimensioner och kopplingstyper",
    description: "Material, dimensioner, kopplingar och riskplacering.",
    fields: [
      { key: "cold_water_pipe", label: "Huvudledning kallvatten", type: "text" },
      { key: "hot_water_pipe", label: "Huvudledning varmvatten", type: "text" },
      { key: "pipe_couplings", label: "Kopplingstyper", type: "checklist", options: ["Press", "Löd", "Klämring", "Skärring", "Gängat", "Blandat"] },
      { key: "galvanized", label: "Galvaniserade ledningar finns/misstänks", type: "select", options: yn },
      { key: "pipe_in_pipe", label: "Rör-i-rör och läckageindikering", type: "select", options: ok },
      { key: "pipe_notes", label: "Dimension / plats / uppskattad längd", type: "textarea" },
    ],
  },
  {
    id: 12,
    title: "Avlopp, spillvatten, golvbrunnar och rensmöjligheter",
    description: "Material, brunnar, stopp, filmning och enskilt avlopp.",
    fields: [
      { key: "sewer_type", label: "Kommunalt / enskilt", type: "select", options: ["Kommunalt", "Enskilt avlopp", "Trekammarbrunn", "Minireningsverk", "Okänt"] },
      { key: "sewer_material", label: "Huvudmaterial / dimension", type: "text" },
      { key: "floor_drain", label: "Golvbrunnsfabrikat / typ / årgång", type: "text" },
      { key: "known_stops", label: "Kända stopp, bubbel eller luktproblem", type: "select", options: yn },
      { key: "sewer_film", label: "Filmning / spolning bör erbjudas", type: "select", options: yn },
      { key: "sewer_notes", label: "Observationer", type: "textarea" },
    ],
  },
  {
    id: 13,
    title: "Kök - vattensäkerhet och installationer",
    description: "Diskbänksskåp, maskiner, larm och framtida köksplaner.",
    fields: [
      { key: "kitchen_sink_cabinet", label: "Diskbänksskåp och synliga kopplingar", type: "select", options: ok },
      { key: "kitchen_waterproof_base", label: "Vattentätt underlag / läckageindikering", type: "select", options: present },
      { key: "dishwasher", label: "Diskmaskinsanslutning och avstängning", type: "select", options: ok },
      { key: "water_alarm", label: "Läckagelarm / vattenfelsbrytare", type: "select", options: present },
      { key: "kitchen_future", label: "Kundens framtida planer för köket", type: "select", options: ["Inga kända", "Renovering planeras", "Byte av vitvaror", "Okänt"] },
      { key: "kitchen_notes", label: "Köksobservationer", type: "textarea" },
    ],
  },
  {
    id: 14,
    title: "Badrum, WC och duschutrymmen",
    description: "Använd ett block per utrymme och komplettera vid fler rum.",
    fields: [
      { key: "bathroom_1_name", label: "Utrymme 1 - namn / placering", type: "text" },
      { key: "bathroom_1_year", label: "Bygg-/renoveringsår", type: "number", source: true },
      { key: "bathroom_1_wc", label: "WC - typ, anslutning och avstängning", type: "select", options: ok },
      { key: "bathroom_1_drain", label: "Golvbrunn - fabrikat/typ/årgång", type: "text" },
      { key: "bathroom_1_leak", label: "Läckagespår / missfärgning / lukt", type: "select", options: yn },
      { key: "bathroom_notes", label: "Utrymme 2 eller fler våtrum", type: "textarea" },
    ],
  },
  {
    id: 15,
    title: "Tvättstuga, grovkök och tekniska våtutrymmen",
    description: "Maskiner, brunnar, spillvägar, larm och framtidsplaner.",
    fields: [
      { key: "laundry_machines", label: "Tvättmaskin / torkutrustning och anslutningar", type: "select", options: ok },
      { key: "laundry_sink", label: "Tvättho / blandare / avstängningar", type: "select", options: ok },
      { key: "laundry_drain", label: "Golvbrunn - typ, årgång och skick", type: "text" },
      { key: "laundry_alarm", label: "Vattenfelsbrytare / läckagelarm", type: "select", options: present },
      { key: "laundry_notes", label: "Observationer och framtida planer", type: "textarea" },
    ],
  },
  {
    id: 16,
    title: "Övriga installationer och framtida planer",
    description: "Utekranar, garage, pool, gästhus och andra yrkesgrupper.",
    fields: [
      { key: "outdoor_taps", label: "Utekranar / frostskydd / dimension", type: "select", options: checked },
      { key: "garage_guesthouse", label: "Garage / gästhus / separat system", type: "select", options: checked },
      { key: "pool_spa", label: "Pool / spa / utedusch", type: "select", options: checked },
      { key: "planned_heat_source_change", label: "Planerat byte av värmekälla", type: "select", options: yn },
      { key: "other_trades", label: "Andra yrkesgrupper kan behövas", type: "checklist", options: ["El", "Vent", "Bygg", "Tak", "Fönster", "Isolering"] },
      { key: "future_notes", label: "Övriga framtidsplaner", type: "textarea" },
    ],
  },
  {
    id: 17,
    title: "Energi-, vattenförbrukning och driftdata",
    description: "Förbrukning, energideklaration och råd.",
    fields: [
      { key: "electricity_kwh", label: "Årsförbrukning el senaste 12 månader kWh", type: "number", source: true },
      { key: "heat_consumption", label: "Årsförbrukning värme / fjärrvärme", type: "text", source: true },
      { key: "water_m3", label: "Årsförbrukning vatten m³", type: "number", source: true },
      { key: "residents_temp", label: "Antal boende och normal inomhustemperatur", type: "text", source: true },
      { key: "energy_declaration", label: "Energideklaration / tidigare energiberäkning", type: "select", options: present },
      { key: "energy_notes", label: "Energieffektiviseringsråd", type: "textarea" },
    ],
  },
  {
    id: 18,
    title: "Underlag för skötselråd och återkommande service",
    description: "Markera råd som ska genereras i rapporten.",
    fields: [
      { key: "service_advice", label: "Relevanta skötselråd", type: "checklist", options: ["Spola tappställen", "Kontroll av systemtryck", "Luftning", "Okulär läckagekontroll", "Motionera ventiler", "Filterservice", "Läckagelarm", "Golvbrunnar", "Brunnsvattenprov", "Värmepumpsservice", "Legionellarisk"] },
      { key: "rvm_service_agreement", label: "Återkommande RVM Husstatus / serviceavtal", type: "select", options: ["Erbjuds", "Ej aktuellt"] },
      { key: "annual_control", label: "Årlig kontroll ska göras", type: "select", options: ["Ja", "Nej", "Ej bedömt"] },
      { key: "quarterly_control", label: "Kvartalsvis kontrollöversyn till kund", type: "select", options: ["Ja", "Nej", "Erbjuds"] },
      { key: "quarterly_delivery", label: "Leveranssätt kontrollöversyn", type: "select", options: ["E-post", "Post", "E-post och post"] },
      { key: "next_control", label: "Nästa rekommenderade kontroll", type: "text" },
      { key: "followup_owner", label: "Ansvarig för uppföljning", type: "text" },
      { key: "service_notes", label: "Servicekommentar", type: "textarea" },
    ],
  },
  {
    id: 19,
    title: "Samlat installations- och dimensionsregister",
    description: "En rad per större produkt. Format: komponent; system; fabrikat; modell; år; status; kostnad.",
    fields: [
      { key: "component_register", label: "Komponentrader", type: "textarea" },
    ],
  },
  {
    id: 20,
    title: "Noterade brister, risker och förbättringar",
    description: "Prioritet: Akut, Snar, Planerad eller Rekommendation.",
    fields: [
      { key: "observations", label: "Observationer och avvikelser", type: "textarea" },
      { key: "top_priority", label: "Högsta prioritet", type: "select", options: ["Akut", "Snar", "Planerad", "Rekommendation"] },
    ],
  },
  {
    id: 21,
    title: "Underlag för analys, livslängd och kostnadsestimat",
    description: "Alternativa kalkyler som ska kunna jämföras i rapportfilen.",
    fields: [
      { key: "cost_scenarios", label: "Kostnadsscenarier och jämförelser", type: "textarea" },
      { key: "price_date", label: "Prisdatum", type: "date" },
    ],
  },
  {
    id: 22,
    title: "Kundkommunikation och leverans",
    description: "Hur rapport, kontrollöversyn och fortsatt kontakt ska levereras till kunden.",
    fields: [
      { key: "digital_self_check", label: "Årlig digital egenkontroll från kund", type: "select", options: ["Erbjuds", "Ej aktuellt"] },
      { key: "customer_report_delivery", label: "Leverans av Husrapport", type: "select", options: ["Kundportal", "E-post", "Utskrift/post", "Kundportal och e-post"] },
      { key: "customer_contact_preference", label: "Föredragen kontakt", type: "select", options: ["Telefon", "E-post", "SMS", "Kundportal"] },
      { key: "customer_next_message", label: "Nästa meddelande till kund", type: "textarea" },
    ],
  },
  {
    id: 23,
    title: "Sammanfattning och nästa steg",
    description: "Slutsats, rapportbeslut och nästa aktivitet.",
    fields: [
      { key: "overall_status", label: "Övergripande status", type: "select", options: ["God", "Normal", "Brister att planera", "Snar åtgärd", "Akut utredning"] },
      { key: "create_report", label: "Husstatusrapport ska tas fram", type: "select", options: yn },
      { key: "create_action_plan", label: "Åtgärdsplan ska tas fram", type: "select", options: yn },
      { key: "create_quote", label: "Separat offert ska tas fram", type: "select", options: yn },
      { key: "report_owner_deadline", label: "Rapportansvarig och deadline", type: "text" },
      { key: "site_summary", label: "Kort sammanfattning från platsbesöket", type: "textarea" },
    ],
  },
  {
    id: 24,
    title: "Bekräftelse och avgränsning",
    description: "Signatur, plats och avgränsning enligt RVM Husstatus.",
    fields: [
      { key: "location", label: "Ort", type: "text" },
      { key: "confirmation_date", label: "Datum", type: "date" },
      { key: "customer_signer", label: "Namnförtydligande kund", type: "text" },
      { key: "rvm_signer", label: "Namnförtydligande RVM", type: "text" },
      { key: "limitations", label: "Avgränsning / förtydligande", type: "textarea" },
    ],
  },
  {
    id: 25,
    title: "Övrig information och bilder",
    description: "Fri yta för kompletterande observationer, referensbilder och underlag som inte passar i övriga avsnitt.",
    fields: [
      { key: "other_information", label: "Övrig information", type: "textarea", source: true },
      { key: "other_image_notes", label: "Bildkommentarer och placering", type: "textarea", source: true },
      { key: "other_followup", label: "Behöver följas upp", type: "select", options: ["Ja", "Nej", "Ej bedömt"] },
    ],
  },
];

export const rvmFieldCount = rvmSections.reduce((count, section) => count + section.fields.length, 0);

