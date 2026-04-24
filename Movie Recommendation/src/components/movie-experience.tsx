"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { eras, genres, languages, moods, runtimes, type Movie } from "@/lib/movie-data";

type TabId = "discover" | "browse" | "ratings";
type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  recommendations?: Movie[];
  error?: boolean;
};

type RatedMovie = {
  id: string;
  title: string;
  value: number;
};

const suggestionChips = [
  "Something like Inception but lighter",
  "A recent feel-good movie",
  "Mind-bending sci-fi under 2 hours",
  "An emotional foreign-language film",
];

const emptyFilters = {
  genre: "",
  mood: "",
  era: "",
  runtime: "",
  language: "",
};

export function MovieExperience() {
  const [activeTab, setActiveTab] = useState<TabId>("discover");
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Tell me the mood, tone, or comparison you want, and I will pull live movie picks from OMDb.",
    },
  ]);
  const [filters, setFilters] = useState(emptyFilters);
  const [browseResults, setBrowseResults] = useState<Movie[]>([]);
  const [browseMessage, setBrowseMessage] = useState("Loading live movie discovery...");
  const [ratings, setRatings] = useState<Record<string, RatedMovie>>({});
  const [manualTitle, setManualTitle] = useState("");
  const [manualRating, setManualRating] = useState(4);
  const [personalized, setPersonalized] = useState<Movie[]>([]);
  const [personalizedMessage, setPersonalizedMessage] = useState("");
  const [errorBanner, setErrorBanner] = useState("");
  const [isChatPending, startChatTransition] = useTransition();
  const [isBrowsePending, startBrowseTransition] = useTransition();
  const [isPersonalizedPending, startPersonalizedTransition] = useTransition();

  useEffect(() => {
    startBrowseTransition(async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const response = await fetch(`/api/browse?${params.toString()}`, {
        method: "GET",
      });

      const data = (await response.json()) as {
        results: Movie[];
        message: string;
      };

      if (!response.ok) {
        setBrowseResults([]);
        setBrowseMessage(data.message);
        setErrorBanner(data.message);
        return;
      }

      setBrowseResults(data.results);
      setBrowseMessage(data.message);
      setErrorBanner("");
    });
  }, [filters]);

  const ratedMovies = useMemo(
    () => Object.values(ratings).sort((a, b) => b.value - a.value || a.title.localeCompare(b.title)),
    [ratings]
  );

  const likedCount = ratedMovies.filter((entry) => entry.value >= 4).length;
  const dislikedCount = ratedMovies.filter((entry) => entry.value <= 2).length;

  async function submitPrompt(nextPrompt: string) {
    const cleanPrompt = nextPrompt.trim();
    if (!cleanPrompt) return;

    setPrompt("");
    setChat((current) => [...current, { role: "user", text: cleanPrompt }]);

    startChatTransition(async () => {
      const history = chat.map((entry) => entry.text);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt, history }),
      });

      const data = (await response.json()) as {
        message: string;
        recommendations: Movie[];
      };

      setChat((current) => [
        ...current,
        {
          role: "assistant",
          text: data.message,
          recommendations: data.recommendations,
          error: !response.ok,
        },
      ]);

      if (!response.ok) {
        setErrorBanner(data.message);
      } else {
        setErrorBanner("");
      }
    });
  }

  function setMovieRating(movie: Movie, value: number) {
    setRatings((current) => ({
      ...current,
      [movie.id]: {
        id: movie.id,
        title: movie.title,
        value,
      },
    }));
  }

  function addManualRating() {
    const normalized = manualTitle.trim();
    if (!normalized) return;

    const key = `manual:${normalized.toLowerCase()}`;

    setRatings((current) => ({
      ...current,
      [key]: {
        id: key,
        title: normalized,
        value: manualRating,
      },
    }));
    setManualTitle("");
    setManualRating(4);
  }

  function generatePersonalized() {
    startPersonalizedTransition(async () => {
      const response = await fetch("/api/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings: Object.values(ratings) }),
      });

      const data = (await response.json()) as {
        message: string;
        recommendations: Movie[];
      };

      setPersonalizedMessage(data.message);
      setPersonalized(data.recommendations);

      if (!response.ok) {
        setErrorBanner(data.message);
      } else {
        setErrorBanner("");
      }
    });
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[32px] border border-[var(--line)] bg-[var(--background-elevated)] p-6 shadow-[var(--shadow)] backdrop-blur md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(87,35,122,0.25),transparent_32%)]" />
          <div className="relative flex flex-col gap-5">
            <span className="w-fit rounded-full border border-[var(--line-strong)] bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.32em] text-[var(--gold-soft)]">
              ReelMatch Live
            </span>
            <div className="max-w-3xl">
              <h1 className="font-[family:var(--font-display)] text-5xl leading-none text-[var(--gold-soft)] sm:text-6xl">
                Live movie recommendations with a velvet-rope feel.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                Powered by live OMDb search for chat, filtered browsing, and taste-driven suggestions from your ratings.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Live source" value="OMDb" detail="Fresh live movie lookups from a simpler movie API." />
              <StatCard label="Filter browse" value="5 dimensions" detail="Genre, mood, era, runtime, and language together." />
              <StatCard label="Shared ratings" value={`${ratedMovies.length} logged`} detail="Rate anywhere and feed the same taste profile." />
            </div>
          </div>
        </section>

        {errorBanner ? (
          <section className="rounded-2xl border border-[rgba(255,140,140,0.35)] bg-[rgba(120,25,25,0.2)] px-4 py-3 text-sm text-[#ffd6d6]">
            {errorBanner}
          </section>
        ) : null}

        <section className="flex flex-wrap gap-3">
          <TabButton label="Discover" active={activeTab === "discover"} onClick={() => setActiveTab("discover")} />
          <TabButton label="Browse" active={activeTab === "browse"} onClick={() => setActiveTab("browse")} />
          <TabButton label="Ratings" active={activeTab === "ratings"} onClick={() => setActiveTab("ratings")} />
        </section>

        {activeTab === "discover" ? (
          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 backdrop-blur">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--gold-soft)]">AI-Style Live Discovery</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">Describe a vibe and get live OMDb-backed picks you can keep refining.</p>
                </div>
                <div className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                  Conversation memory on
                </div>
              </div>

              <div className="flex max-h-[560px] flex-col gap-4 overflow-y-auto pr-1">
                {chat.map((entry, index) => (
                  <div
                    key={`${entry.role}-${index}`}
                    className={`rounded-3xl border p-4 ${
                      entry.role === "assistant"
                        ? entry.error
                          ? "border-[rgba(255,140,140,0.28)] bg-[rgba(120,25,25,0.18)]"
                          : "border-[var(--line)] bg-black/20"
                        : "ml-auto border-[var(--line-strong)] bg-[rgba(212,175,55,0.12)]"
                    }`}
                  >
                    <p className="text-sm leading-7 text-[var(--text)]">{entry.text}</p>
                    {entry.recommendations ? (
                      <div className="mt-4 grid gap-3">
                        {entry.recommendations.map((movie) => (
                          <MovieCard key={movie.id} movie={movie} rating={ratings[movie.id]?.value} onRate={setMovieRating} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {isChatPending ? <LoadingPulse label="Pulling live movie picks..." /> : null}
              </div>

              <div className="mt-5 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => void submitPrompt(chip)}
                      className="rounded-full border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--gold-soft)]"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void submitPrompt(prompt);
                    }}
                    placeholder="Try: something like Inception but lighter"
                    className="min-h-14 flex-1 rounded-2xl border border-[var(--line)] bg-black/25 px-4 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                  />
                  <button
                    type="button"
                    onClick={() => void submitPrompt(prompt)}
                    className="rounded-2xl bg-[linear-gradient(135deg,#f0d78a,#b8891d)] px-5 py-3 font-medium text-[#241707] transition hover:scale-[1.01]"
                  >
                    Find movies
                  </button>
                </div>
              </div>
            </div>

            <aside className="rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 backdrop-blur">
              <h2 className="text-xl font-semibold text-[var(--gold-soft)]">Live-data notes</h2>
              <div className="mt-4 grid gap-3">
                <InsightCard title="Source of truth" text="Chat and browse now hit OMDb server routes instead of a local fixed catalog." />
                <InsightCard title="Tradeoff" text="OMDb is simpler than TMDB, so browse and personalization are live but more approximate." />
                <InsightCard title="Next upgrade" text="If you want deeper AI reasoning later, we can layer OpenAI or Anthropic on top of the same live movie feed." />
              </div>
            </aside>
          </section>
        ) : null}

        {activeTab === "browse" ? (
          <section className="rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--gold-soft)]">Filter-Based Browse</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">These results come from live OMDb lookups, not a static dataset.</p>
              </div>
              <button
                type="button"
                onClick={() => setFilters(emptyFilters)}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--gold-soft)]"
              >
                Reset filters
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <FilterSelect label="Genre" value={filters.genre} onChange={(value) => setFilters((current) => ({ ...current, genre: value }))} options={genres} />
              <FilterSelect label="Mood" value={filters.mood} onChange={(value) => setFilters((current) => ({ ...current, mood: value }))} options={moods} />
              <FilterSelect label="Era" value={filters.era} onChange={(value) => setFilters((current) => ({ ...current, era: value }))} options={eras} />
              <FilterSelect label="Runtime" value={filters.runtime} onChange={(value) => setFilters((current) => ({ ...current, runtime: value }))} options={runtimes} />
              <FilterSelect label="Language" value={filters.language} onChange={(value) => setFilters((current) => ({ ...current, language: value }))} options={languages} />
            </div>

            {browseMessage ? <p className="mt-4 text-sm text-[var(--muted)]">{browseMessage}</p> : null}
            {isBrowsePending ? <LoadingPulse label="Refreshing live browse results..." /> : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {browseResults.map((movie) => (
                <MovieCard key={movie.id} movie={movie} rating={ratings[movie.id]?.value} onRate={setMovieRating} compact />
              ))}
            </div>
            {!isBrowsePending && browseResults.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
                No exact matches yet. Try relaxing one filter, or add your OMDb key if live data is not configured.
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "ratings" ? (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 backdrop-blur">
              <h2 className="text-xl font-semibold text-[var(--gold-soft)]">Ratings System</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Rate live results or manually log a title, then use that profile to fetch fresh recommendations.</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StatCard label="Liked" value={`${likedCount}`} detail="Movies rated 4-5 stars." />
                <StatCard label="Disliked" value={`${dislikedCount}`} detail="Movies rated 1-2 stars." />
              </div>

              <div className="mt-5 rounded-3xl border border-[var(--line)] bg-black/20 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gold-soft)]">Manual log</h3>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={manualTitle}
                    onChange={(event) => setManualTitle(event.target.value)}
                    placeholder="Movie title"
                    className="min-h-12 flex-1 rounded-2xl border border-[var(--line)] bg-black/25 px-4 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                  />
                  <select
                    value={manualRating}
                    onChange={(event) => setManualRating(Number(event.target.value))}
                    className="min-h-12 rounded-2xl border border-[var(--line)] bg-black/25 px-4 text-sm text-[var(--text)] outline-none"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value} star{value > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addManualRating}
                    className="rounded-2xl bg-[linear-gradient(135deg,#f0d78a,#b8891d)] px-5 py-3 font-medium text-[#241707]"
                  >
                    Save rating
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {ratedMovies.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
                    Rate a few movies first and this space will turn into your live taste profile.
                  </div>
                ) : (
                  ratedMovies.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-black/15 px-4 py-3">
                      <div>
                        <p className="font-medium text-[var(--text)]">{entry.title}</p>
                        <p className="text-xs text-[var(--muted)]">Manual titles will be resolved live during recommendation lookup</p>
                      </div>
                      <StarRating value={entry.value} onChange={(value) => setRatings((current) => ({ ...current, [entry.id]: { ...entry, value } }))} />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--gold-soft)]">Personalized Recommendations</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">This now pulls live results shaped by the genres in your ratings.</p>
                </div>
                <button
                  type="button"
                  onClick={generatePersonalized}
                  className="rounded-2xl bg-[linear-gradient(135deg,#f0d78a,#b8891d)] px-5 py-3 font-medium text-[#241707]"
                >
                  Analyze my taste
                </button>
              </div>

              {isPersonalizedPending ? <LoadingPulse label="Looking through live OMDb data for your next match..." /> : null}
              {personalizedMessage ? <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{personalizedMessage}</p> : null}

              <div className="mt-5 grid gap-4">
                {personalized.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} rating={ratings[movie.id]?.value} onRate={setMovieRating} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-5 py-3 text-sm font-medium transition ${
        active
          ? "border-[var(--line-strong)] bg-[rgba(212,175,55,0.14)] text-[var(--gold-soft)]"
          : "border-[var(--line)] bg-black/10 text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--gold-soft)]"
      }`}
    >
      {label}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-2xl border border-[var(--line)] bg-black/25 px-4 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MovieCard({
  movie,
  rating,
  onRate,
  compact = false,
}: {
  movie: Movie;
  rating?: number;
  onRate: (movie: Movie, value: number) => void;
  compact?: boolean;
}) {
  return (
    <article className="group overflow-hidden rounded-[28px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.14))] transition duration-300 hover:-translate-y-1 hover:border-[var(--line-strong)]">
      {movie.backdropUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={movie.backdropUrl} alt={movie.title} className="h-40 w-full object-cover opacity-80" />
      ) : (
        <div className="h-40 w-full bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.2),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.2))]" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-[family:var(--font-display)] text-3xl leading-none text-[var(--gold-soft)]">{movie.title}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {movie.year} • {movie.runtime > 0 ? `${movie.runtime} min` : "Runtime TBD"} • {movie.language}
            </p>
          </div>
          <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">{movie.era}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {movie.genres.map((genre) => (
            <span key={genre} className="rounded-full bg-white/5 px-3 py-1 text-xs text-[var(--text)]">
              {genre}
            </span>
          ))}
        </div>
        <p className={`mt-4 text-sm leading-7 text-[var(--text)] ${compact ? "line-clamp-3" : ""}`}>{movie.whyItMatches}</p>
        <p className={`mt-2 text-sm leading-7 text-[var(--muted)] ${compact ? "line-clamp-2" : ""}`}>{movie.chatReason}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">
            {movie.voteAverage ? `IMDb ${movie.voteAverage.toFixed(1)}` : "Rate this movie"}
          </div>
          <StarRating value={rating ?? 0} onChange={(value) => onRate(movie, value)} />
        </div>
      </div>
    </article>
  );
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`Rate ${star} stars`}
          className={`text-lg transition ${star <= value ? "text-[var(--gold)]" : "text-white/25 hover:text-[var(--gold-soft)]"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-black/15 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 font-[family:var(--font-display)] text-4xl text-[var(--gold-soft)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function InsightCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-black/15 p-4">
      <h3 className="text-base font-semibold text-[var(--gold-soft)]">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{text}</p>
    </div>
  );
}

function LoadingPulse({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-black/15 px-4 py-3 text-sm text-[var(--muted)]">
      <span className="inline-flex gap-1">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--gold)]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--gold)] [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--gold)] [animation-delay:240ms]" />
      </span>
      {label}
    </div>
  );
}
