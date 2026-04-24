export type Movie = {
  id: string;
  tmdbId?: number;
  title: string;
  year: number;
  genres: string[];
  mood: string[];
  era: "1970s-1980s" | "1990s-2000s" | "2010s" | "2020s";
  runtime: number;
  language: string;
  overview: string;
  whyItMatches: string;
  chatReason: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  voteAverage?: number;
};

export const genres = [
  "Action",
  "Comedy",
  "Drama",
  "Horror",
  "Sci-Fi",
  "Romance",
  "Thriller",
  "Documentary",
  "Animation",
  "Fantasy",
] as const;

export const moods = [
  "Feel-good",
  "Mind-bending",
  "Emotional",
  "Intense",
  "Relaxing",
  "Inspiring",
  "Dark & Gritty",
  "Whimsical",
] as const;

export const eras = ["1970s-1980s", "1990s-2000s", "2010s", "2020s"] as const;

export const runtimes = ["Under 100 min", "100-130 min", "130+ min"] as const;

export const languages = ["English", "Korean", "Japanese", "French", "Spanish"] as const;

export const genreIdByName: Record<(typeof genres)[number], number> = {
  Action: 28,
  Comedy: 35,
  Drama: 18,
  Horror: 27,
  "Sci-Fi": 878,
  Romance: 10749,
  Thriller: 53,
  Documentary: 99,
  Animation: 16,
  Fantasy: 14,
};

export const languageCodeByName: Record<(typeof languages)[number], string> = {
  English: "en",
  Korean: "ko",
  Japanese: "ja",
  French: "fr",
  Spanish: "es",
};
