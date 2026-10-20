import municipalityRegions from "../constants/municipalityRegions.json";

// Municipality/region data: https://github.com/matteocontrini/comuni-json
// Snapshot dated 2020-01-01; only municipality names and regions are retained.
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("it-IT").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const UNKNOWN_REGION = "Regione non identificata";
export const ITALIAN_REGIONS = Object.keys(municipalityRegions).sort((a, b) => a.localeCompare(b, "it-IT"));
const cityRegions = new Map();
for (const [region, cities] of Object.entries(municipalityRegions)) {
  for (const city of cities) {
    for (const name of [city, ...city.split(/\s*\/\s*/)]) {
      const key = normalize(name);
      if (!cityRegions.has(key)) cityRegions.set(key, new Set());
      cityRegions.get(key).add(region);
    }
  }
}
for (const [alias, officialName] of [["Reggio Emilia", "Reggio nell'Emilia"], ["Reggio Calabria", "Reggio di Calabria"]]) {
  const regions = cityRegions.get(normalize(officialName));
  if (regions) cityRegions.set(normalize(alias), regions);
}
const citiesByLength = [...cityRegions.keys()].sort((a, b) => b.length - a.length);

export const getCasRegion = (membership) => {
  const text = normalize(membership).replace(/^cas(?: di)?\s+/, "");
  if (!text) return UNKNOWN_REGION;
  const exact = cityRegions.get(text);
  if (exact) return exact.size === 1 ? [...exact][0] : UNKNOWN_REGION;
  let remaining = ` ${text} `;
  const regions = new Set();
  for (const city of citiesByLength) {
    const match = ` ${city} `;
    if (!remaining.includes(match)) continue;
    for (const region of cityRegions.get(city)) regions.add(region);
    remaining = remaining.replaceAll(match, " ");
  }
  return regions.size === 1 ? [...regions][0] : UNKNOWN_REGION;
};

export const groupPresidentsByRegion = (presidents, { includeAllRegions = false } = {}) => {
  const groups = new Map(includeAllRegions ? ITALIAN_REGIONS.map((region) => [region, []]) : []);
  for (const president of presidents) {
    const region = getCasRegion(president.casMembership);
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push(president);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    a === UNKNOWN_REGION ? 1 : b === UNKNOWN_REGION ? -1 : a.localeCompare(b, "it-IT"))
    .map(([region, users]) => ({ region, users: [...users].sort((a, b) =>
      (a.username || "").localeCompare(b.username || "", "it-IT", { sensitivity: "base" })) }));
};
