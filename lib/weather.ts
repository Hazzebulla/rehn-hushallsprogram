type GeocodeResult = {
  name: string;
  country_code?: string;
  latitude: number;
  longitude: number;
};

type WeatherResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
  };
  current_units?: {
    temperature_2m?: string;
  };
};

export type LiveOutdoorTemperature = {
  temperature: number;
  unit: string;
  measuredAt?: string;
  place: string;
  provider: string;
};

function addressCandidates(address: string) {
  const cleaned = address.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  const withoutStreetNumber = cleaned.replace(/\b\d+[A-Za-zÅÄÖåäö]?\b/g, "").replace(/\s+/g, " ").trim();

  return Array.from(new Set([
    cleaned,
    withoutStreetNumber,
    cleaned.match(/\bi\s+([A-Za-zÅÄÖåäö\s-]{3,})$/)?.[1]?.trim() ?? "",
    cleaned.replace(/^villa\s+i\s+/i, "").replace(/^ville\s+i\s+/i, "").trim(),
    ...parts,
    parts.at(-1) ?? "",
    parts.length > 1 ? parts.slice(1).join(", ") : "",
  ].filter((candidate) => candidate.length >= 3)));
}

async function geocodeAddress(address: string) {
  for (const candidate of addressCandidates(address)) {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", candidate);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "sv");
    url.searchParams.set("format", "json");
    url.searchParams.set("countryCode", "SE");

    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) continue;

    const data = await response.json() as { results?: GeocodeResult[] };
    const result = data.results?.[0];
    if (result?.latitude && result?.longitude) return result;
  }

  return undefined;
}

export async function getLiveOutdoorTemperature(address?: string | null): Promise<LiveOutdoorTemperature | undefined> {
  if (!address) return undefined;

  try {
    const location = await geocodeAddress(address);
    if (!location) return undefined;

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("current", "temperature_2m");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url, { next: { revalidate: 10 * 60 } });
    if (!response.ok) return undefined;

    const data = await response.json() as WeatherResponse;
    const temperature = data.current?.temperature_2m;
    if (typeof temperature !== "number") return undefined;

    return {
      temperature,
      unit: data.current_units?.temperature_2m ?? "°C",
      measuredAt: data.current?.time,
      place: location.name,
      provider: "Open-Meteo",
    };
  } catch {
    return undefined;
  }
}
