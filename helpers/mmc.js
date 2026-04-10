import {
  mmcCompetitionFullDataMap,
  validCompetitionTags,
} from "../config/mmc/init.js";

/**
 * Finds the MMC config for the MMC event that the world falls under.
 *
 * @param {Iterable<string>} tags The tags for the world.
 * @param {Date} entryDate The date of the world entry. This is usually the publish date if present; otherwise, the creation date is used.
 * @return {MmcConfigSearchResult} The result info of the search.
 */
function findMmcConfig(tags, entryDate) {
  let isValidCompetitionTag = null;
  let mmcConfig = null;

  for (const worldTag of tags) {
    const normalizedTag = worldTag.toLowerCase();
    const config = mmcCompetitionFullDataMap.get(normalizedTag);

    if (
      config == null ||
      config.startDate > entryDate ||
      config.endDate < entryDate
    ) {
      continue;
    }

    isValidCompetitionTag = validCompetitionTags.has(worldTag);
    mmcConfig = config;
  }

  const isCompetitionActive =
    Date.now() >= mmcConfig?.startDate.getTime() &&
    Date.now() < mmcConfig?.endDate.getTime();

  return {
    mmcConfig,
    isValidCompetitionTag,
    isCompetitionActive,
  };
}

/**
 * Returns matched categories based on the given tags.
 *
 * @param {Set<string>} worldTags The world tags to use when matching categories.
 * @param {MmcCategory[]} categories The list of categories to use when searching for matching categories.
 * @yields {[string, MmcCategory]} The key value pair of the category.
 */
function* matchCategories(worldTags, categories) {
  for (const category of categories) {
    let currentCategory = category;
    while (
      currentCategory != null &&
      worldTags.has(currentCategory.requiredTags.at(-1))
    ) {
      if (currentCategory.parent == null) {
        yield [category.tagKey, category];
      }
      currentCategory = currentCategory.parent;
    }
  }
}

/**
 * Check the world record and add necessary MMC information to it.
 *
 * @param {WorldInfo} worldRecord The world record to possibly add MMC info to.
 * @returns {WorldInfo} The mutated world record that was passed in.
 */
export function addMMC(worldRecord) {
  const isOfficialWorld = worldRecord.ownerId === "G-Creator-Jam";

  const { firstPublishTime, creationTime } = worldRecord;
  const tags = new Set(worldRecord.tags);
  const { mmcConfig, isValidCompetitionTag, isCompetitionActive } =
    findMmcConfig(tags, new Date(firstPublishTime ?? creationTime));

  if (mmcConfig == null) {
    return worldRecord;
  }

  const categories = isOfficialWorld
    ? []
    : new Map(matchCategories(tags, mmcConfig.categories)).values().toArray();
  const isActiveCompetitionEntry =
    isOfficialWorld || isCompetitionActive || categories.length > 0;

  if (!isActiveCompetitionEntry) {
    return worldRecord;
  }

  const mmcType = isOfficialWorld
    ? "official"
    : isValidCompetitionTag
      ? "entry"
      : "error";

  return Object.assign(worldRecord, {
    mmc: {
      year: mmcConfig.year,
      wikiPath: mmcConfig.wikiPath,
      type: mmcType,
      entered: isValidCompetitionTag,
      categories: isValidCompetitionTag
        ? // Need to handle MMC 2020 categories this way due to the dual casings for categories (e.g., "world and World", "avatar and Avatar", and "other and Other")
          categories
        : null,
      error: isValidCompetitionTag ? null : "Invalid Competition Tag",
    },
  });
}
