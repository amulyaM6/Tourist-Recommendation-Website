function normalize(value) {
  return (value || "").toString().trim().toLowerCase();
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function matchInterest(interest, destinationTags) {
  if (destinationTags.some((tag) => tag.includes(interest) || interest.includes(tag))) {
    return true;
  }

  const joined = destinationTags.join(" ");
  if (interest.includes("culture")) {
    return includesAny(joined, ["history", "culture", "architecture", "museum"]);
  }
  if (interest.includes("nature")) {
    return includesAny(joined, ["nature", "hiking", "mountains", "wildlife", "forest"]);
  }
  if (interest.includes("food")) {
    return includesAny(joined, ["food", "street food", "cuisine", "culinary"]);
  }
  if (interest.includes("beach")) {
    return includesAny(joined, ["beach", "island", "coast", "snorkel"]);
  }
  if (interest.includes("nightlife")) {
    return includesAny(joined, ["nightlife", "music", "bars", "clubs"]);
  }
  if (interest.includes("adventure")) {
    return includesAny(joined, ["adventure", "trek", "sports", "rafting", "ski"]);
  }
  if (interest.includes("photography")) {
    return includesAny(joined, ["photography", "landscape", "scenic", "sunset"]);
  }
  if (interest.includes("wellness")) {
    return includesAny(joined, ["wellness", "spa", "retreat", "yoga"]);
  }
  if (interest.includes("wildlife")) {
    return includesAny(joined, ["wildlife", "safari", "birding", "marine"]);
  }

  return false;
}

function scoreByBudget(preference, destinationBudget) {
  if (!preference || !destinationBudget) {
    return 0;
  }

  const pref = normalize(preference);
  const budget = normalize(destinationBudget);
  if (pref.includes("backpacker")) {
    return budget === "budget" ? 22 : budget === "mid" ? 8 : 0;
  }
  if (pref.includes("mid")) {
    return budget === "mid" ? 22 : budget === "budget" || budget === "luxury" ? 12 : 0;
  }
  if (pref.includes("luxury")) {
    return budget === "luxury" ? 22 : budget === "mid" ? 8 : 0;
  }
  return 0;
}

function scoreByTraveller(preference, bestFor) {
  const pref = normalize(preference);
  const audience = (bestFor || []).map(normalize);
  if (!pref) {
    return 0;
  }

  const hit =
    (pref.includes("solo") && audience.includes("solo")) ||
    (pref.includes("couple") && audience.includes("couples")) ||
    (pref.includes("family") && audience.includes("families")) ||
    (pref.includes("group") && audience.includes("friends"));

  return hit ? 16 : 2;
}

function scoreByInterests(interests, tags) {
  const selected = (interests || []).map(normalize);
  const destinationTags = (tags || []).map(normalize);
  let score = 0;

  for (const interest of selected) {
    score += matchInterest(interest, destinationTags) ? 15 : 0;
  }
  return score;
}

function interestMatchCount(interests, tags) {
  const selected = (interests || []).map(normalize);
  const destinationTags = (tags || []).map(normalize);
  return selected.filter((interest) => matchInterest(interest, destinationTags)).length;
}

function exactInterestMatchCount(interests, tags) {
  const selected = (interests || []).map(normalize);
  const destinationTags = (tags || []).map(normalize);
  return selected.filter((interest) => destinationTags.includes(interest)).length;
}

function scoreByDuration(duration, idealTrip) {
  if (!duration || !idealTrip) {
    return 0;
  }

  const d = normalize(duration);
  const t = normalize(idealTrip);

  if (d.includes("weekend")) {
    return t.includes("2-4") ? 14 : 0;
  }
  if (d.includes("short")) {
    return t.includes("4-7") || t.includes("5-8") ? 14 : 2;
  }
  if (d.includes("two weeks")) {
    return t.includes("10-14") ? 14 : 2;
  }
  if (d.includes("month")) {
    return t.includes("14+") ? 14 : 0;
  }

  return 0;
}

function buildWhyFits(destination, preferences, feedbackStats) {
  const reasons = [];
  const feedback = feedbackStats[destination.id];

  if (preferences.budget && scoreByBudget(preferences.budget, destination.budgetTier) >= 20) {
    reasons.push(`fits your ${preferences.budget.toLowerCase()} budget`);
  }
  if (preferences.traveller && scoreByTraveller(preferences.traveller, destination.bestFor) >= 16) {
    reasons.push(`is well-suited for ${preferences.traveller.toLowerCase()}`);
  }
  if ((preferences.interests || []).length) {
    reasons.push(`matches your selected interests`);
  }
  if (feedback && feedback.count >= 2 && feedback.average >= 4) {
    reasons.push(`is highly rated by similar users`);
  }

  return reasons.length
    ? `This destination ${reasons.join(", ")}.`
    : "This destination gives you a balanced mix based on your preferences.";
}

function passesHardFilters(preferences, destination, matchedInterestCount, exactMatchedInterestCount) {
  if ((preferences.interests || []).length && exactMatchedInterestCount === 0) {
    return false;
  }
  if (preferences.duration && scoreByDuration(preferences.duration, destination.idealTrip) <= 0) {
    return false;
  }
  if (preferences.budget && scoreByBudget(preferences.budget, destination.budgetTier) <= 0) {
    return false;
  }
  return true;
}

function pickDiversifiedTop(ranked, topN) {
  const picked = [];
  const countryCount = {};
  const placeNameSeen = {};

  for (const item of ranked) {
    const country = normalize(item.country);
    const placeName = normalize(item.name);
    if (placeNameSeen[placeName]) {
      continue;
    }
    if ((countryCount[country] || 0) >= 1) {
      continue;
    }
    picked.push(item);
    countryCount[country] = (countryCount[country] || 0) + 1;
    placeNameSeen[placeName] = true;
    if (picked.length === topN) {
      return picked;
    }
  }

  for (const item of ranked) {
    if (picked.find((p) => p.id === item.id)) {
      continue;
    }

    const country = normalize(item.country);
    const placeName = normalize(item.name);
    if (placeNameSeen[placeName]) {
      continue;
    }
    if ((countryCount[country] || 0) >= 2) {
      continue;
    }

    picked.push(item);
    countryCount[country] = (countryCount[country] || 0) + 1;
    placeNameSeen[placeName] = true;
    if (picked.length === topN) {
      return picked;
    }
  }

  for (const item of ranked) {
    if (picked.find((p) => p.id === item.id)) {
      continue;
    }
    const placeName = normalize(item.name);
    if (placeNameSeen[placeName]) {
      continue;
    }
    picked.push(item);
    placeNameSeen[placeName] = true;
    if (picked.length === topN) {
      return picked;
    }
  }

  return picked;
}

function buildRecommendations(preferences, destinations, topN, feedbackStats = {}) {
  const selectedInterests = preferences.interests || [];
  const scored = destinations
    .map((destination) => {
      const matchedInterestCount = interestMatchCount(selectedInterests, destination.tags);
      const exactMatchedInterestCount = exactInterestMatchCount(selectedInterests, destination.tags);
      const feedback = feedbackStats[destination.id] || { average: 0, count: 0 };
      const score =
        scoreByBudget(preferences.budget, destination.budgetTier) * 1.2 +
        scoreByTraveller(preferences.traveller, destination.bestFor) * 1.1 +
        scoreByInterests(preferences.interests, destination.tags) * 1.4 +
        scoreByDuration(preferences.duration, destination.idealTrip) * 1.1 +
        feedback.average * Math.min(feedback.count, 8);

      return {
        ...destination,
        score,
        matchedInterestCount,
        exactMatchedInterestCount,
        whyItFits: buildWhyFits(destination, preferences, feedbackStats)
      };
    });

  const strictRanked = scored
    .filter((destination) =>
      passesHardFilters(
        preferences,
        destination,
        destination.matchedInterestCount,
        destination.exactMatchedInterestCount
      )
    )
    .sort((a, b) => b.score - a.score);

  if (selectedInterests.length && strictRanked.length < topN) {
    const relaxedRanked = scored
      .filter((destination) => destination.exactMatchedInterestCount > 0)
      .sort((a, b) => b.score - a.score);
    return pickDiversifiedTop(relaxedRanked, topN);
  }

  return pickDiversifiedTop(strictRanked, topN);
}

module.exports = {
  buildRecommendations
};
