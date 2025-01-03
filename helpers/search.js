const MAX_RESULT_COUNT = 20;

/**
 * Creates the search parameter body used to make a POST request to the Resonite API's Record Search
 * endpoint.
 *
 * @param {string} searchStr The string used to search for worlds.
 * @param {number} pageIndex The normalized offset that will be multiplied by the count.
 * @return {RecordApiSearchParameters} The search parameters that can be used to search for particular worlds.
 */
function createWorldSerachParams(searchStr, pageIndex) {
  const searchTerms = searchStr.trim()
    .split(/\s+/)
    .filter(term => !!term)
    .map(term => term.match(/([+-])?(.+)/));

  const optionalTags = [];
  const requiredTags = [];
  const excludedTags = [];

  for (const [, modifier, term] of searchTerms) {
    switch (modifier) {
      case '+':
        requiredTags.push(term);
        break;
      case '-':
        excludedTags.push(term);
        break;
      default:
        optionalTags.push(term);
    }
  }

  return {
    recordType: 'world',
    count: MAX_RESULT_COUNT,
    offset: MAX_RESULT_COUNT * pageIndex,
    private: false,
    sortBy: 'FirstPublishTime',
    sortDirection: 'Descending',
    optionalTags,
    requiredTags,
    excludedTags
  };
}

/**
 * Creates the initial request object required for making a POST request to the Resonite API's
 * Record Search endpoint.
 *
 * @param {WorldSearchRequestParameters} params The additional search parameters specificed by the user.
 * @return {RequestInit} The request message that is created
 */
export function createSearchRequestInit({ term, pageIndex }) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(
      createWorldSerachParams(term ?? '', pageIndex ?? 0)
    )
  };
}