import { normalize } from './items.js'
import { SPECIES } from './species.js'

// Recherche d'espèces à partir d'un texte libre (nom FR, nom EN, dossier de sprites).

/** @type {Map<string, string>} */
const INDEX = new Map()
for (const [id, species] of Object.entries(SPECIES)) {
  // Le dossier d'abord : c'est la seule clé sans ambiguïté entre les formes d'une même espèce
  for (const key of [id, species.name, species.form ? `${species.en}${species.form}` : species.en]) {
    const wanted = normalize(key)
    if (!INDEX.has(wanted)) INDEX.set(wanted, id)
  }
}

/**
 * @param {string} query
 * @returns {string | undefined} l'identifiant d'espèce, ou undefined
 */
export function findSpecies(query) {
  return INDEX.get(normalize(query))
}

/** @param {string} speciesId */
export function speciesName(speciesId) {
  return SPECIES[speciesId]?.name ?? speciesId
}

/** Nombre de dossiers de sprites partageant le même numéro de Pokédex (formes) */
/** @type {Map<number, number>} */
const FORMS = new Map()
for (const species of Object.values(SPECIES)) FORMS.set(species.dex, (FORMS.get(species.dex) ?? 0) + 1)

/** @param {string} speciesId */
export function formCount(speciesId) {
  const species = SPECIES[speciesId]
  return species ? (FORMS.get(species.dex) ?? 1) : 1
}

/** Nombre de numéros de Pokédex distincts par génération */
/** @type {Record<number, number>} */
export const DEX_SIZE_BY_GEN = {}
{
  /** @type {Record<number, Set<number>>} */
  const seen = {}
  for (const species of Object.values(SPECIES)) (seen[species.gen] ??= new Set()).add(species.dex)
  for (const [gen, set] of Object.entries(seen)) DEX_SIZE_BY_GEN[Number(gen)] = set.size
}
