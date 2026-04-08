const express = require("express");
const fs = require("fs");
const path = require("path");
const { buildRecommendations } = require("./src/recommender");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_RECOMMENDATIONS = 15;

const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const DESTINATIONS_PATH = path.join(DATA_DIR, "destinations.json");
const DESTINATIONS_EXTRA_PATH = path.join(DATA_DIR, "destinations.extra.json");
const IMAGE_OVERRIDES_PATH = path.join(DATA_DIR, "image-overrides.json");

app.use(express.json());
app.use(express.static(__dirname));

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function readStore() {
  const raw = readJson(STORE_PATH, {});
  return {
    searches: raw.searches || [],
    feedback: raw.feedback || []
  };
}

function readImageOverrides() {
  return readJson(IMAGE_OVERRIDES_PATH, {});
}

const imageOverridesCache = readImageOverrides();

function getIdSeed(text) {
  return String(text).split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function enrichDestination(destination) {
  const seed = getIdSeed(destination.id || destination.name);

  return {
    ...destination,
    meta: {
      visaEase: (seed % 5) + 1,
      safetyScore: ((seed * 3) % 5) + 1,
      vegetarianFriendly: seed % 2 === 0,
      familyFriendly: seed % 3 !== 0,
      accessibilityFriendly: seed % 4 !== 0
    }
  };
}

function applySmartFilters(destinations, filters = {}) {
  return destinations.filter((d) => {
    const meta = d.meta || {};
    if (filters.minVisaEase && Number(meta.visaEase || 0) < Number(filters.minVisaEase)) return false;
    if (filters.minSafety && Number(meta.safetyScore || 0) < Number(filters.minSafety)) return false;
    if (filters.vegetarianFriendly && !meta.vegetarianFriendly) return false;
    if (filters.familyFriendly && !meta.familyFriendly) return false;
    if (filters.accessibilityFriendly && !meta.accessibilityFriendly) return false;
    return true;
  });
}

function getThemeActivity(tag, slot, placeName, country, seed) {
  const bank = {
    "history & culture": {
      morning: [
        `Start with a guided heritage walk through ${placeName}'s old quarter and key monuments.`,
        `Visit a major museum and one historic district to understand ${country}'s local story.`
      ],
      afternoon: [
        `Explore hidden lanes, markets, and cultural landmarks with time for local crafts.`,
        `Spend the afternoon in architectural hotspots and community-run cultural spaces.`
      ],
      evening: [
        `Join a traditional performance or storytelling session before dinner.`,
        `Enjoy an old-town sunset walk with curated historical viewpoints.`
      ]
    },
    "food & local cuisine": {
      morning: [
        `Do a local breakfast trail and sample regional specialties from neighborhood spots.`,
        `Visit a fresh market with a short culinary walkthrough and tasting session.`
      ],
      afternoon: [
        `Take a cooking workshop focused on signature dishes from ${country}.`,
        `Plan a street-food loop across 3-4 well-rated local areas in ${placeName}.`
      ],
      evening: [
        `Book a chef-recommended dinner and end with a dessert crawl.`,
        `Enjoy a sunset food-and-drink pairing experience in a lively district.`
      ]
    },
    "nature & hiking": {
      morning: [
        `Head out early for a scenic hike with viewpoints before crowds build up.`,
        `Do a sunrise trail or nature boardwalk with photography stops.`
      ],
      afternoon: [
        `Visit a nearby lake/park reserve and add a light outdoor activity.`,
        `Take a half-day eco route with local guides and short nature interpretation.`
      ],
      evening: [
        `Wind down with a golden-hour lookout and relaxed recovery session.`,
        `Keep the evening easy with a short waterfront or forest-edge walk.`
      ]
    },
    "beaches & water sports": {
      morning: [
        `Start with calm beach time plus optional paddleboarding or snorkeling.`,
        `Take a coastal boat ride to nearby coves and clear-water spots.`
      ],
      afternoon: [
        `Plan a water-sports block (surf/kayak/jet-ski based on conditions).`,
        `Do an island-hop or reef experience with a certified local operator.`
      ],
      evening: [
        `Watch sunset from a beach viewpoint and enjoy fresh seafood nearby.`,
        `Relax at a beachside promenade with music and local cafes.`
      ]
    },
    "nightlife & music": {
      morning: [
        `Keep the morning light with cafes and street-art neighborhoods.`,
        `Recover with a brunch circuit and easy city stroll.`
      ],
      afternoon: [
        `Explore music districts, vinyl stores, and creative hubs.`,
        `Set up a pre-night route with rooftop spots and local recommendations.`
      ],
      evening: [
        `Experience live music or curated nightlife venues in top-rated areas.`,
        `Do a safe nightlife loop with 2-3 signature spots and local transport planning.`
      ]
    },
    "wellness & spas": {
      morning: [
        `Begin with a guided wellness routine: yoga, breathwork, and healthy breakfast.`,
        `Schedule a spa or thermal session to reset before city activities.`
      ],
      afternoon: [
        `Add a calm nature activity and light wellness-focused lunch.`,
        `Take a restorative treatment block (massage/sauna/meditation).`
      ],
      evening: [
        `End with quiet dining and a digital-detox wind-down routine.`,
        `Keep the evening restorative with low-noise ambience and early rest.`
      ]
    },
    "adventure sports": {
      morning: [
        `Kick off with a certified adventure session (trek/cycle/climb based on location).`,
        `Run a high-energy morning plan with safety briefing and equipment checks.`
      ],
      afternoon: [
        `Continue with a second moderate-intensity activity and recovery break.`,
        `Explore terrain-based adventure circuits around ${placeName}.`
      ],
      evening: [
        `Review photos, stretch, and refuel with high-protein local meals.`,
        `Take a relaxed evening in preparation for the next active day.`
      ]
    },
    "wildlife & safaris": {
      morning: [
        `Take an early wildlife drive/walk when sightings are strongest.`,
        `Join a guided biodiversity trail with birding and habitat spotting.`
      ],
      afternoon: [
        `Visit conservation zones and learn local ecosystem practices.`,
        `Do a second viewing session in a different habitat belt.`
      ],
      evening: [
        `Wrap up with a nature-briefing and quiet scenic dinner.`,
        `Enjoy a low-light wildlife-safe evening experience with local experts.`
      ]
    }
  };

  const fallback = {
    morning: [`Explore a signature district in ${placeName} at a relaxed pace.`],
    afternoon: [`Add one curated local experience and neighborhood discovery walk.`],
    evening: [`Close the day with a memorable dinner and scenic stroll in ${country}.`]
  };

  const selected = bank[tag] || fallback;
  const options = selected[slot] || fallback[slot];
  return options[seed % options.length];
}

function getExampleSpot(place, theme, seed) {
  const placeName = cleanPlaceName(place.name);
  const country = cleanPlaceName(place.country);
  const byTheme = {
    "history & culture": [`${placeName} Old Town`, `${placeName} City Museum`, `${country} Heritage Quarter`],
    "food & local cuisine": [`${placeName} Central Market`, `${placeName} Street Food Lane`, `${country} Culinary District`],
    "nature & hiking": [`${placeName} National Park Trail`, `${placeName} Viewpoint Ridge`, `${country} Nature Reserve`],
    "beaches & water sports": [`${placeName} Main Beach`, `${placeName} Marina Bay`, `${country} Coastal Boardwalk`],
    "nightlife & music": [`${placeName} Live Music Street`, `${placeName} Night District`, `${country} Arts Quarter`],
    "wellness & spas": [`${placeName} Thermal Spa`, `${placeName} Wellness Retreat`, `${country} Healing Springs`],
    "adventure sports": [`${placeName} Adventure Basecamp`, `${placeName} Outdoor Activity Zone`, `${country} Trek Hub`],
    "wildlife & safaris": [`${placeName} Wildlife Sanctuary`, `${placeName} Eco Park`, `${country} Safari Route`]
  };
  const list = byTheme[theme] || [`${placeName} City Center`, `${country} Signature Landmark`];
  return list[seed % list.length];
}

function buildRichItinerary(place, days) {
  const tags = place.tags && place.tags.length ? place.tags : ["history & culture"];
  const plan = [];
  const baseSeed = getIdSeed(place.id);

  for (let day = 1; day <= days; day += 1) {
    const daySeed = baseSeed + day * 17;
    const theme = tags[(day - 1) % tags.length];
    plan.push({
      day,
      theme,
      morning: getThemeActivity(theme, "morning", place.name, place.country, daySeed),
      afternoon: getThemeActivity(theme, "afternoon", place.name, place.country, daySeed + 3),
      evening: getThemeActivity(theme, "evening", place.name, place.country, daySeed + 7),
      exampleSpot: getExampleSpot(place, theme, daySeed + 11),
      note: `Focus today on ${theme}. Pre-book key activities 24-48 hours earlier for better slots.`
    });
  }

  return plan;
}

function resolveItineraryDays(input) {
  const raw = String(input || "").toLowerCase().trim();
  if (!raw) return 5;
  if (raw.includes("weekend")) return 3;
  if (raw.includes("short")) return 6;
  if (raw.includes("two weeks")) return 12;
  if (raw.includes("month")) return 14;
  const asNum = Number(raw);
  if (!Number.isNaN(asNum) && asNum > 0) return asNum;
  return 5;
}

const imageCache = new Map();
const placeImageCache = new Map();

function cleanPlaceName(value) {
  return String(value || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s*\+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function getWikipediaImageByTitle(title) {
  const key = `wiki:${title}`;
  if (imageCache.has(key)) {
    return imageCache.get(key);
  }

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "User-Agent": "tourist-recommendation-app/1.0" } });
  if (!res.ok) return "";
  const data = await res.json();
  const img = data?.originalimage?.source || data?.thumbnail?.source || "";
  if (img && !isLowQualityOrMapImage(img)) {
    imageCache.set(key, img);
  }
  return img && !isLowQualityOrMapImage(img) ? img : "";
}

function isLowQualityOrMapImage(url) {
  const lowered = String(url || "").toLowerCase();
  if (!lowered) return true;
  const blockedParts = [
    "locator_map",
    "location_map",
    "blank_map",
    "map_of",
    "relief_location_map",
    "administrative_map",
    "svg",
    "coat_of_arms",
    "flag_of",
    "logo",
    "icon",
    "seal"
  ];
  return blockedParts.some((part) => lowered.includes(part));
}

function isBadImageTitle(title) {
  const lowered = String(title || "").toLowerCase();
  if (!lowered) return true;
  const blocked = [
    "map",
    "locator",
    "flag",
    "coat of arms",
    "logo",
    "icon",
    "seal",
    "diagram",
    "route",
    "cat",
    "dog",
    "statue",
    "painting"
  ];
  return blocked.some((token) => lowered.includes(token));
}

function titleMatchesPlace(title, name, country) {
  const lowered = String(title || "").toLowerCase();
  const n = String(name || "").toLowerCase().trim();
  const c = String(country || "").toLowerCase().trim();
  if (!lowered || !n) return false;
  return lowered.includes(n) || (c && lowered.includes(c));
}

function buildPicsumUrl(name, country, variant = 0) {
  const seed = encodeURIComponent(`${cleanPlaceName(name)}-${cleanPlaceName(country)}-${variant}`);
  return `https://picsum.photos/seed/${seed}/1200/800`;
}

async function getWikimediaSearchImage(name, country, variant = 0) {
  const terms = [
    `${name} ${country} landmark`,
    `${name} ${country} city`,
    `${name} tourism`
  ];
  const term = terms[Math.min(Number(variant || 0), terms.length - 1)];
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json`;
  const res = await fetch(url, { headers: { "User-Agent": "tourist-recommendation-app/1.0" } });
  if (!res.ok) return "";
  const data = await res.json();
  const pages = Object.values(data?.query?.pages || {});
  for (const page of pages) {
    const fileTitle = String(page?.title || "");
    if (isBadImageTitle(fileTitle)) continue;
    if (!titleMatchesPlace(fileTitle, name, country)) continue;
    const imageUrl = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url || "";
    if (!imageUrl) continue;
    if (isLowQualityOrMapImage(imageUrl)) continue;
    return imageUrl;
  }
  return "";
}

function readAllDestinations() {
  const base = readJson(DESTINATIONS_PATH, []);
  const extra = readJson(DESTINATIONS_EXTRA_PATH, []);
  return base.concat(extra).map(enrichDestination);
}

function buildFeedbackStats(feedbackItems) {
  const stats = {};
  for (const item of feedbackItems || []) {
    if (!stats[item.destinationId]) {
      stats[item.destinationId] = { sum: 0, count: 0, average: 0 };
    }
    stats[item.destinationId].sum += item.rating;
    stats[item.destinationId].count += 1;
  }

  for (const destinationId of Object.keys(stats)) {
    const current = stats[destinationId];
    current.average = current.count ? Number((current.sum / current.count).toFixed(2)) : 0;
  }
  return stats;
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "tourist-recommendation-api",
    time: new Date().toISOString()
  });
});

app.get("/api/destinations", (_req, res) => {
  const destinations = readAllDestinations();
  res.json({ total: destinations.length, destinations });
});

app.post("/api/recommendations", (req, res) => {
  const preferences = req.body || {};
  const hasMeaningfulInput =
    Boolean(String(preferences.duration || "").trim()) ||
    Boolean(String(preferences.traveller || "").trim()) ||
    Boolean(String(preferences.budget || "").trim()) ||
    Boolean(String(preferences.extras || "").trim()) ||
    ((preferences.interests || []).length > 0);

  if (!hasMeaningfulInput) {
    return res.status(400).json({
      error: "Please provide at least one travel preference before requesting recommendations."
    });
  }

  const store = readStore();
  const destinations = applySmartFilters(readAllDestinations(), preferences.smartFilters || {});
  const feedbackStats = buildFeedbackStats(store.feedback);
  const recommendations = buildRecommendations(preferences, destinations, MAX_RECOMMENDATIONS, feedbackStats);

  store.searches.unshift({
    id: `search_${Date.now()}`,
    createdAt: new Date().toISOString(),
    preferences,
    recommendationIds: recommendations.map((item) => item.id)
  });
  store.searches = store.searches.slice(0, 100);
  writeJson(STORE_PATH, store);

  res.json({
    count: recommendations.length,
    recommendations
  });
});

app.post("/api/feedback", (req, res) => {
  const { destinationId, rating, notes } = req.body || {};

  if (!destinationId || typeof rating !== "number") {
    return res.status(400).json({
      error: "destinationId and numeric rating are required"
    });
  }

  const safeRating = Math.max(1, Math.min(5, Math.round(rating)));
  const store = readStore();

  store.feedback.unshift({
    id: `fb_${Date.now()}`,
    destinationId,
    rating: safeRating,
    notes: (notes || "").toString().slice(0, 500),
    createdAt: new Date().toISOString()
  });
  store.feedback = store.feedback.slice(0, 300);
  writeJson(STORE_PATH, store);

  return res.status(201).json({ message: "Feedback saved" });
});

app.get("/api/insights", (_req, res) => {
  const destinations = readAllDestinations();
  const store = readStore();

  const feedbackByDestination = {};
  for (const item of store.feedback) {
    if (!feedbackByDestination[item.destinationId]) {
      feedbackByDestination[item.destinationId] = [];
    }
    feedbackByDestination[item.destinationId].push(item.rating);
  }

  const topRated = Object.entries(feedbackByDestination)
    .map(([destinationId, ratings]) => {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      const match = destinations.find((d) => d.id === destinationId);
      return {
        destinationId,
        ratingsCount: ratings.length,
        averageRating: Number(avg.toFixed(2)),
        name: match ? match.name : destinationId
      };
    })
    .sort((a, b) => b.averageRating - a.averageRating)
    .slice(0, 5);

  res.json({
    totalSearches: store.searches.length,
    totalFeedback: store.feedback.length,
    topRated
  });
});

app.post("/api/compare", (req, res) => {
  const { destinationIds = [] } = req.body || {};
  const ids = destinationIds.slice(0, 3);
  const all = readAllDestinations();
  const items = ids.map((id) => all.find((d) => d.id === id)).filter(Boolean);
  return res.json({ count: items.length, destinations: items });
});

app.post("/api/itinerary", (req, res) => {
  const { destinationId, days = 5 } = req.body || {};
  const all = readAllDestinations();
  const place = all.find((d) => d.id === destinationId);
  if (!place) return res.status(404).json({ error: "Destination not found" });

  const safeDays = Math.max(2, Math.min(14, resolveItineraryDays(days)));
  const plan = buildRichItinerary(place, safeDays);

  return res.json({
    destinationId: place.id,
    destination: place.name,
    days: safeDays,
    itinerary: plan
  });
});

app.get("/api/place-image", async (req, res) => {
  try {
    const destinationId = String(req.query.id || "").trim();
    const name = cleanPlaceName(req.query.name);
    const country = cleanPlaceName(req.query.country);
    const variant = Number(req.query.v || 0);
    const placeKey = `${name.toLowerCase()}|${country.toLowerCase()}`;

    if (!destinationId && !name && !country) {
      return res.status(400).json({ error: "id, name or country is required" });
    }

    if (destinationId && imageOverridesCache[destinationId]) {
      return res.redirect(imageOverridesCache[destinationId]);
    }

    if (placeImageCache.has(placeKey)) {
      return res.redirect(placeImageCache.get(placeKey));
    }

    const candidates = variant === 0
      ? [`${name}, ${country}`, name, `${name} (${country})`, country]
      : [`${name} travel`, `${name} city`, `${country} tourism`, country];

    for (const title of candidates) {
      if (!title || !title.trim()) continue;
      const imageUrl = await getWikipediaImageByTitle(title.trim());
      if (imageUrl) {
        placeImageCache.set(placeKey, imageUrl);
        return res.redirect(imageUrl);
      }
    }

    const wikiSearchImage = await getWikimediaSearchImage(name, country, variant);
    if (wikiSearchImage) {
      placeImageCache.set(placeKey, wikiSearchImage);
      return res.redirect(wikiSearchImage);
    }

    const picsum = buildPicsumUrl(name, country, variant);
    placeImageCache.set(placeKey, picsum);
    return res.redirect(picsum);
  } catch (_err) {
    const name = cleanPlaceName(req.query.name);
    const country = cleanPlaceName(req.query.country);
    const variant = Number(req.query.v || 0);
    const fallback = buildPicsumUrl(name || "travel", country || "destination", variant);
    return res.redirect(fallback);
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index1.html"));
});

app.listen(PORT, () => {
  console.log(`Tourist Recommendation Platform running on http://localhost:${PORT}`);
});
