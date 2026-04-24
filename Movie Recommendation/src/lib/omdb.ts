import { type Movie } from "@/lib/movie-data";

type FilterState = {
  genre?: string;
  mood?: string;
  era?: string;
  runtime?: string;
  language?: string;
};

type RatedMovie = {
  id: string;
  title: string;
  value: number;
};

type OmdbSearchItem = {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
};

type OmdbSearchResponse = {
  Search?: OmdbSearchItem[];
  Response: "True" | "False";
  Error?: string;
};

type OmdbDetailResponse = {
  Title: string;
  Year: string;
  Runtime: string;
  Genre: string;
  Plot: string;
  Language: string;
  Poster: string;
  imdbRating: string;
  imdbID: string;
  Response: "True" | "False";
  Error?: string;
};

const OMDB_BASE_URL = "https://www.omdbapi.com/";

const moodQueries: Record<string, string[]> = {
  "Feel-good": ["love", "family", "holiday"],
  "Mind-bending": ["future", "dream", "time"],
  Emotional: ["life", "heart", "memory"],
  Intense: ["war", "crime", "hunt"],
  Relaxing: ["journey", "home", "summer"],
  Inspiring: ["hope", "dream", "victory"],
  "Dark & Gritty": ["dark", "night", "killer"],
  Whimsical: ["magic", "wonder", "moon"],
};

const genreQueries: Record<string, string[]> = {
  Action: ["mission", "war", "force"],
  Comedy: ["love", "wedding", "holiday"],
  Drama: ["life", "family", "world"],
  Horror: ["dead", "night", "evil"],
  "Sci-Fi": ["star", "future", "space"],
  Romance: ["love", "heart", "kiss"],
  Thriller: ["night", "secret", "killer"],
  Documentary: ["world", "story", "earth"],
  Animation: ["dream", "magic", "adventure"],
  Fantasy: ["magic", "kingdom", "dragon"],
};

function getApiKey() {
  const apiKey = process.env.OMDB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OMDB_API_KEY. Add it to .env.local.");
  }
  return apiKey;
}

async function omdbFetch(params: Record<string, string | number | undefined>) {
  const url = new URL(OMDB_BASE_URL);
  url.searchParams.set("apikey", getApiKey());
  url.searchParams.set("r", "json");

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`OMDb request failed with ${response.status}.`);
  }
  return response.json();
}

async function searchByTitle(query: string, year?: string) {
  const data = (await omdbFetch({
    s: query,
    type: "movie",
    y: year,
    page: 1,
  })) as OmdbSearchResponse;

  if (data.Response === "False") return [];
  return data.Search ?? [];
}

async function getById(imdbId: string) {
  const data = (await omdbFetch({
    i: imdbId,
    plot: "short",
    type: "movie",
  })) as OmdbDetailResponse;

  if (data.Response === "False") {
    throw new Error(data.Error ?? "OMDb detail lookup failed.");
  }

  return data;
}

function parseRuntime(runtime: string) {
  const match = runtime.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function parseGenres(genre: string) {
  return genre
    .split(",")
    .map((item) => item.trim())
    .map((item) => (item === "Science Fiction" ? "Sci-Fi" : item))
    .filter(Boolean);
}

function detectEra(year: number): Movie["era"] {
  if (year >= 2020) return "2020s";
  if (year >= 2010) return "2010s";
  if (year >= 1990) return "1990s-2000s";
  return "1970s-1980s";
}

function deriveMoods(genres: string[], plot: string) {
  const genreSet = new Set(genres);
  const text = plot.toLowerCase();
  const mood = new Set<string>();

  if (genreSet.has("Comedy") || genreSet.has("Romance")) mood.add("Feel-good");
  if (genreSet.has("Sci-Fi") || genreSet.has("Fantasy") || text.includes("time")) mood.add("Mind-bending");
  if (genreSet.has("Drama") || genreSet.has("Romance") || text.includes("loss")) mood.add("Emotional");
  if (genreSet.has("Action") || genreSet.has("Thriller") || genreSet.has("Crime")) mood.add("Intense");
  if (genreSet.has("Documentary") || text.includes("journey")) mood.add("Relaxing");
  if (text.includes("dream") || text.includes("hope") || text.includes("inspire")) mood.add("Inspiring");
  if (genreSet.has("Horror") || genreSet.has("Thriller")) mood.add("Dark & Gritty");
  if (genreSet.has("Animation") || genreSet.has("Fantasy")) mood.add("Whimsical");

  return [...mood].slice(0, 3);
}

function normalizeMovie(detail: OmdbDetailResponse, reason: string): Movie {
  const year = Number(detail.Year.slice(0, 4)) || new Date().getFullYear();
  const genres = parseGenres(detail.Genre);

  return {
    id: `omdb:${detail.imdbID}`,
    title: detail.Title,
    year,
    genres: genres.slice(0, 3),
    mood: deriveMoods(genres, detail.Plot),
    era: detectEra(year),
    runtime: parseRuntime(detail.Runtime),
    language: detail.Language.split(",")[0]?.trim() || "Unknown",
    overview: detail.Plot || "No overview available yet.",
    whyItMatches: reason,
    chatReason: detail.Plot || reason,
    posterUrl: detail.Poster && detail.Poster !== "N/A" ? detail.Poster : null,
    backdropUrl: detail.Poster && detail.Poster !== "N/A" ? detail.Poster : null,
    voteAverage: Number(detail.imdbRating) || undefined,
  };
}

function uniqueByImdb(items: OmdbSearchItem[]) {
  return Array.from(new Map(items.map((item) => [item.imdbID, item])).values());
}

async function detailsFromSearch(items: OmdbSearchItem[], reasonBuilder: (item: OmdbSearchItem) => string, limit: number) {
  const details = await Promise.all(
    uniqueByImdb(items)
      .slice(0, limit * 3)
      .map(async (item) => {
        try {
          const detail = await getById(item.imdbID);
          return normalizeMovie(detail, reasonBuilder(item));
        } catch {
          return null;
        }
      })
  );

  return details.filter((movie): movie is Movie => Boolean(movie)).slice(0, limit);
}

function matchesEra(year: number, era?: string) {
  if (!era) return true;
  if (era === "2020s") return year >= 2020 && year <= 2029;
  if (era === "2010s") return year >= 2010 && year <= 2019;
  if (era === "1990s-2000s") return year >= 1990 && year <= 2009;
  return year >= 1970 && year <= 1989;
}

function matchesRuntime(runtime: number, range?: string) {
  if (!range) return true;
  if (range === "Under 100 min") return runtime > 0 && runtime < 100;
  if (range === "100-130 min") return runtime >= 100 && runtime <= 130;
  return runtime > 130;
}

function matchesLanguage(language: string, wanted?: string) {
  if (!wanted) return true;
  return language.toLowerCase().includes(wanted.toLowerCase());
}

function matchesGenre(movieGenres: string[], wanted?: string) {
  if (!wanted) return true;
  return movieGenres.some((genre) => genre.toLowerCase() === wanted.toLowerCase());
}

function matchesMood(movieMoods: string[], wanted?: string) {
  if (!wanted) return true;
  return movieMoods.some((mood) => mood.toLowerCase() === wanted.toLowerCase());
}

function promptSearchQueries(prompt: string) {
  const lower = prompt.toLowerCase();
  const queries = new Set<string>();

  Object.entries(genreQueries).forEach(([genre, seeds]) => {
    if (lower.includes(genre.toLowerCase())) seeds.forEach((seed) => queries.add(seed));
  });

  Object.entries(moodQueries).forEach(([mood, seeds]) => {
    if (lower.includes(mood.toLowerCase())) seeds.forEach((seed) => queries.add(seed));
  });

  const likeMatch = prompt.match(/(?:like|similar to)\s+([^,.]+)/i);
  if (likeMatch?.[1]) queries.add(likeMatch[1].trim());

  const plain = prompt.replace(/something like/gi, "").replace(/but lighter/gi, "").trim();
  if (plain) queries.add(plain);
  if (queries.size === 0) queries.add("love");

  return [...queries].slice(0, 4);
}

function browseQueries(filters: FilterState) {
  const queries = new Set<string>();

  if (filters.genre && genreQueries[filters.genre]) genreQueries[filters.genre].forEach((seed) => queries.add(seed));
  if (filters.mood && moodQueries[filters.mood]) moodQueries[filters.mood].forEach((seed) => queries.add(seed));
  if (filters.language) queries.add(filters.language);

  if (queries.size === 0) {
    ["love", "star", "night", "dream", "life", "world"].forEach((seed) => queries.add(seed));
  }

  return [...queries].slice(0, 6);
}

function topGenreSeeds(genres: string[]) {
  const queries = new Set<string>();
  genres.forEach((genre) => {
    if (genreQueries[genre]) genreQueries[genre].forEach((seed) => queries.add(seed));
  });
  if (queries.size === 0) queries.add("love");
  return [...queries].slice(0, 5);
}

export async function getChatRecommendations(prompt: string, history: string[]) {
  const queries = promptSearchQueries(`${history.slice(-2).join(" ")} ${prompt}`.trim());
  const searchResults = (await Promise.all(queries.map((query) => searchByTitle(query)))).flat();

  const movies = await detailsFromSearch(
    searchResults,
    () => `Live OMDb recommendation shaped around your latest vibe: "${prompt}".`,
    12
  );

  const lower = prompt.toLowerCase();
  const filtered = movies
    .filter((movie) => {
      if ((lower.includes("recent") || lower.includes("latest") || lower.includes("new")) && movie.year < 2020) return false;
      if ((lower.includes("short") || lower.includes("shorter")) && movie.runtime > 110) return false;
      if (lower.includes("lighter") && movie.mood.includes("Dark & Gritty")) return false;
      return true;
    })
    .slice(0, 4);

  return filtered.length ? filtered : movies.slice(0, 4);
}

export async function getBrowseMovies(filters: FilterState) {
  const searchResults = (await Promise.all(browseQueries(filters).map((query) => searchByTitle(query)))).flat();
  const movies = await detailsFromSearch(
    searchResults,
    () => "Live OMDb result chosen from your current browse filters.",
    18
  );

  return movies
    .filter((movie) => matchesGenre(movie.genres, filters.genre))
    .filter((movie) => matchesMood(movie.mood, filters.mood))
    .filter((movie) => matchesEra(movie.year, filters.era))
    .filter((movie) => matchesRuntime(movie.runtime, filters.runtime))
    .filter((movie) => matchesLanguage(movie.language, filters.language))
    .slice(0, 6);
}

export async function getPersonalizedRecommendations(ratings: RatedMovie[]) {
  const liked = ratings.filter((rating) => rating.value >= 4);
  const dislikedTitles = new Set(ratings.filter((rating) => rating.value <= 2).map((rating) => rating.title.toLowerCase()));

  const likedDetails = await Promise.all(
    liked.map(async (rating) => {
      const results = await searchByTitle(rating.title);
      if (!results[0]) return null;
      try {
        return await getById(results[0].imdbID);
      } catch {
        return null;
      }
    })
  );

  const genreCounts = new Map<string, number>();
  likedDetails
    .filter((detail): detail is OmdbDetailResponse => Boolean(detail))
    .flatMap((detail) => parseGenres(detail.Genre))
    .forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1));

  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);

  const searchResults = (await Promise.all(topGenreSeeds(topGenres).map((query) => searchByTitle(query)))).flat();
  const movies = await detailsFromSearch(
    searchResults,
    () => "Live OMDb recommendation based on the genres you have been rating highly.",
    20
  );

  return movies
    .filter((movie) => !ratings.some((rating) => rating.title.toLowerCase() === movie.title.toLowerCase()))
    .filter((movie) => !dislikedTitles.has(movie.title.toLowerCase()))
    .filter((movie) => topGenres.length === 0 || movie.genres.some((genre) => topGenres.includes(genre)))
    .slice(0, 4);
}
