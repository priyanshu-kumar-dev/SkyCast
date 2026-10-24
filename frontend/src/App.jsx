
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sun, Moon, CloudSun, Cloud, CloudFog, CloudRain, CloudSnow,
  CloudLightning, CloudDrizzle, Droplets, Wind, Gauge, MapPin,
  Search, Sunrise, Sunset, Thermometer, RefreshCw, CalendarDays,
  Clock3, LocateFixed, LoaderCircle, Star, X, Heart, Eye,
  Activity, Sparkles, Umbrella, AlertTriangle, Navigation,
  Cloudy, ChevronRight, Compass, CheckCircle2, CloudMoon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_CITY = {
  name: "Jaipur",
  admin1: "Rajasthan",
  country: "India",
  country_code: "IN",
  latitude: 26.9124,
  longitude: 75.7873,
};

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

function weatherInfo(code, isDay = true) {
  if (code === 0)
    return { label: isDay ? "Clear sky" : "Clear night", Icon: isDay ? Sun : Moon };
  if (code === 1)
    return { label: "Mainly clear", Icon: isDay ? CloudSun : CloudMoon };
  if (code === 2)
    return { label: "Partly cloudy", Icon: isDay ? CloudSun : CloudMoon };
  if (code === 3) return { label: "Overcast", Icon: Cloud };
  if ([45, 48].includes(code)) return { label: "Foggy", Icon: CloudFog };
  if ([51, 53, 55, 56, 57].includes(code))
    return { label: "Drizzle", Icon: CloudDrizzle };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { label: "Rain", Icon: CloudRain };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { label: "Snow", Icon: CloudSnow };
  if ([95, 96, 99].includes(code))
    return { label: "Thunderstorm", Icon: CloudLightning };
  return { label: "Conditions unavailable", Icon: CloudSun };
}

function clock(value, minutes = true) {
  if (!value) return "--";
  const match = String(value).match(/T(\d{2}):(\d{2})/);
  if (!match) return "--";
  const date = new Date(Date.UTC(2020, 0, 1, +match[1], +match[2]));
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    ...(minutes ? { minute: "2-digit" } : {}),
    hour12: true,
    timeZone: "UTC",
  });
}

function dateLabel(value, options = {}) {
  if (!value) return "Local forecast";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    ...options,
    timeZone: "UTC",
  });
}

function weekday(value, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return dateLabel(value, { weekday: "short" });
}

function windDirection(degrees = 0) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.round(((degrees % 360) + 360) % 360 / 45) % 8
  ];
}

function aqiInfo(value) {
  if (value == null || !Number.isFinite(Number(value)))
    return { label: "Unavailable", color: "text-slate-400", advice: "No current AQI reading." };

  const n = Number(value);
  if (n <= 50)
    return { label: "Good", color: "text-emerald-500", advice: "Air quality is satisfactory." };
  if (n <= 100)
    return { label: "Moderate", color: "text-lime-500", advice: "Sensitive people should take care." };
  if (n <= 150)
    return { label: "Unhealthy for sensitive groups", color: "text-amber-500", advice: "Sensitive people should reduce prolonged outdoor activity." };
  if (n <= 200)
    return { label: "Unhealthy", color: "text-orange-500", advice: "Consider reducing prolonged outdoor activity." };
  if (n <= 300)
    return { label: "Very unhealthy", color: "text-rose-500", advice: "Limit outdoor exposure." };
  return { label: "Hazardous", color: "text-red-600", advice: "Avoid prolonged outdoor exposure." };
}

function uvLabel(value) {
  if (value == null) return "Unavailable";
  if (value < 3) return "Low";
  if (value < 6) return "Moderate";
  if (value < 8) return "High";
  if (value < 11) return "Very high";
  return "Extreme";
}

function getAdvice(current, air) {
  if (!current) return "Weather information is loading.";

  const code = current.weather_code;
  const temp = current.temperature_2m;
  const uv = current.uv_index ?? 0;
  const aqi = air?.current?.us_aqi;

  if ([95, 96, 99].includes(code))
    return "Thunderstorms are possible. Stay safe during lightning and check local weather alerts.";
  if ([65, 67, 82].includes(code))
    return "Heavy rain may affect travel. Carry rain protection and allow extra time.";
  if ([51, 53, 55, 56, 57, 61, 63, 66, 80, 81].includes(code))
    return "Rain or drizzle is possible. Consider carrying an umbrella.";
  if (uv >= 8)
    return "UV levels are very high. Seek shade and use sun protection around midday.";
  if (temp >= 38)
    return "It is very hot. Drink water regularly and avoid strenuous outdoor activity.";
  if (aqi != null && aqi > 150)
    return "Air quality is poor. Consider limiting strenuous outdoor activity.";
  if (temp <= 8)
    return "It is cold outside. Wear warm layers if you are heading out.";
  if ((current.precipitation ?? 0) > 0)
    return "Precipitation is being reported. Check the hourly forecast before travelling.";
  return "Check the hourly forecast before heading out and enjoy your day.";
}

function Card({ children, className = "", ...props }) {
  return (
    <section
      className={`rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

function SectionHeading({ eyebrow, title, detail }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-500">
          {eyebrow}
        </p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
      </div>
      {detail && <p className="text-xs opacity-55">{detail}</p>}
    </div>
  );
}

function MetricCard({ icon: Icon, title, value, detail, color = "text-sky-500" }) {
  return (
    <Card className="transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm opacity-65">{title}</span>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/5 ${color}`}>
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-5 break-words text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-5 opacity-55">{detail}</p>
    </Card>
  );
}

function TemperatureChart({ hourly, indexes, toTemp }) {
  const [selected, setSelected] = useState(0);

  const points = indexes.slice(0, 24).map(({ time, index }) => ({
    time,
    temp: hourly.temperature_2m[index],
    rain: hourly.precipitation_probability?.[index] ?? 0,
  })).filter((point) => Number.isFinite(point.temp));

  if (!points.length)
    return <p className="py-8 text-center text-sm opacity-55">Hourly data unavailable.</p>;

  const width = 760;
  const height = 220;
  const padX = 28;
  const padY = 28;
  const values = points.map((point) => point.temp);
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const range = Math.max(1, max - min);

  const coords = points.map((point, i) => ({
    x: padX + (i / Math.max(1, points.length - 1)) * (width - padX * 2),
    y: height - padY - ((point.temp - min) / range) * (height - padY * 2),
  }));

  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${coords[0].x},${height - padY} ${line} ${coords.at(-1).x},${height - padY}`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 text-xs opacity-60">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-400" /> Temperature</span>
        <span>Select a point to explore</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible" role="img" aria-label="Hourly temperature chart">
        <defs>
          <linearGradient id="skycast-temp-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity=".3" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => {
          const y = padY + i / 3 * (height - padY * 2);
          return <line key={i} x1={padX} x2={width - padX} y1={y} y2={y} stroke="currentColor" opacity=".1" strokeDasharray="4 5" />;
        })}
        <polygon points={area} fill="url(#skycast-temp-fill)" />
        <polyline points={line} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point, i) => (
          <g
            key={points[i].time}
            role="button"
            tabIndex={0}
            aria-label={`${clock(points[i].time)}: ${toTemp(points[i].temp)}`}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setSelected(i);
            }}
            style={{ cursor: "pointer" }}
          >
            <circle cx={point.x} cy={point.y} r={selected === i ? 7 : 4} fill="#38bdf8" stroke="var(--page)" strokeWidth="2" />
            {i % 4 === 0 && <text x={point.x} y={height - 3} fill="currentColor" opacity=".6" textAnchor="middle" fontSize="11">{clock(points[i].time, false)}</text>}
          </g>
        ))}
      </svg>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
        <div>
          <p className="text-sm font-semibold">{clock(points[selected]?.time)} forecast</p>
          <p className="mt-1 text-xs opacity-60">Rain probability: {points[selected]?.rain ?? 0}%</p>
        </div>
        <p className="text-3xl font-semibold text-sky-500">{toTemp(points[selected]?.temp)}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [city, setCity] = useState(() => readStorage("skycast-city", DEFAULT_CITY));
  const [weather, setWeather] = useState(null);
  const [air, setAir] = useState(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [airError, setAirError] = useState(false);
  const [unit, setUnit] = useState(() => readStorage("skycast-unit", "celsius"));
  const [theme, setTheme] = useState(() => readStorage("skycast-theme", "dark"));
  const [favorites, setFavorites] = useState(() => readStorage("skycast-favorites", []));
  const [showFavorites, setShowFavorites] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const isDark = theme === "dark";

  const toTemp = useCallback((value) => {
    if (value == null || !Number.isFinite(Number(value))) return "--";
    const number = Number(value);
    return `${Math.round(unit === "fahrenheit" ? number * 9 / 5 + 32 : number)}°`;
  }, [unit]);

  const loadWeather = useCallback(async (place, isRefresh = false) => {
    if (!place || !Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) {
      setError("This location has invalid coordinates.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    const weatherParams = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index",
      hourly: "temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "7",
      wind_speed_unit: "kmh",
    });

    const airParams = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: "us_aqi,pm2_5,pm10",
      hourly: "us_aqi,pm2_5,pm10",
      timezone: "auto",
      forecast_days: "1",
    });

    try {
      const [weatherResponse, airResponse] = await Promise.all([
        fetch(`${WEATHER_URL}?${weatherParams}`),
        fetch(`${AIR_URL}?${airParams}`).catch(() => null),
      ]);

      if (!weatherResponse.ok) throw new Error("Weather service is unavailable. Please try again.");
      const data = await weatherResponse.json();

      if (!data.current || !data.hourly || !data.daily) {
        throw new Error("Incomplete weather data received. Please refresh.");
      }

      let airData = null;
      if (airResponse?.ok) {
        try {
          airData = await airResponse.json();
        } catch {
          airData = null;
        }
      }

      setWeather(data);
      setAir(airData);
      setAirError(!airData?.current);
      setCity(place);
      setLastUpdated(new Date());
      saveStorage("skycast-city", place);
    } catch (err) {
      setError(err.message || "Unable to load weather. Check your internet connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWeather(city);
  }, []); // Load the saved/default city once.

  useEffect(() => saveStorage("skycast-theme", theme), [theme]);
  useEffect(() => saveStorage("skycast-unit", unit), [unit]);
  useEffect(() => saveStorage("skycast-favorites", favorites), [favorites]);

  useEffect(() => {
    const timer = setInterval(() => loadWeather(city, true), 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [city, loadWeather]);

  async function searchCity(event) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;

    setSearching(true);
    setResults([]);
    setError("");

    try {
      const params = new URLSearchParams({
        name: query.split(",")[0].trim(),
        count: "10",
        language: "en",
        format: "json",
      });

      const response = await fetch(`${GEO_URL}?${params}`);
      if (!response.ok) throw new Error("City search failed. Please try again.");

      const data = await response.json();
      let places = data.results || [];

      if (query.includes(",")) {
        const requested = query.split(",").slice(1).map((part) => part.trim().toLowerCase());
        const matching = places.filter((item) =>
          requested.some((part) =>
            [item.country, item.country_code, item.admin1, item.admin2]
              .filter(Boolean)
              .some((field) => field.toLowerCase() === part)
          )
        );
        if (matching.length) places = matching;
      }

      const unique = new Map();
      places.forEach((item) => {
        const place = {
          name: item.name,
          admin1: item.admin1 || "",
          country: item.country || "",
          country_code: item.country_code || "",
          latitude: item.latitude,
          longitude: item.longitude,
        };
        unique.set(`${place.latitude},${place.longitude}`, place);
      });

      const found = [...unique.values()].slice(0, 6);
      if (!found.length) throw new Error("City not found. Try another spelling.");

      setResults(found);
    } catch (err) {
      setError(err.message || "Unable to search for that city.");
    } finally {
      setSearching(false);
    }
  }

  function chooseCity(place) {
    setResults([]);
    setSearch("");
    setShowFavorites(false);
    loadWeather(place);
  }

  function toggleFavorite() {
    const key = `${city.latitude},${city.longitude}`;
    const exists = favorites.some((item) => `${item.latitude},${item.longitude}` === key);

    setFavorites((old) =>
      exists
        ? old.filter((item) => `${item.latitude},${item.longitude}` !== key)
        : [...old, city]
    );
  }

  const isFavorite = favorites.some(
    (item) => item.latitude === city.latitude && item.longitude === city.longitude
  );

  function myLocation() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location access.");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = coords.latitude;
        const longitude = coords.longitude;

        let place = {
          name: "My Location",
          admin1: "",
          country: "",
          country_code: "",
          latitude,
          longitude,
        };

        try {
          const params = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),
            localityLanguage: "en",
          });
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`
          );

          if (response.ok) {
            const data = await response.json();
            place = {
              ...place,
              name: data.city || data.locality || data.principalSubdivision || "My Location",
              admin1: data.principalSubdivision || "",
              country: data.countryName || "",
              country_code: data.countryCode || "",
            };
          }
        } catch {
          // Coordinates still work if reverse geocoding fails.
        }

        try {
          await loadWeather(place);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        const messages = {
          1: "Location permission denied. Allow location access in browser settings.",
          2: "Location unavailable. Check device location services.",
          3: "Location timed out. Please try again.",
        };
        setError(messages[err.code] || "Unable to detect your location.");
        setLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 }
    );
  }

  const current = weather?.current;
  const hourly = weather?.hourly;
  const daily = weather?.daily;

  const { label: condition, Icon: WeatherIcon } = weatherInfo(
    current?.weather_code,
    Boolean(current?.is_day)
  );

  const currentDate = current?.time?.slice(0, 10);
  const todayIndex = Math.max(0, daily?.time?.indexOf(currentDate) ?? 0);

  const hourlyIndexes = useMemo(() => {
    if (!hourly?.time) return [];
    return hourly.time
      .map((time, index) => ({ time, index }))
      .filter(({ time }) => !current?.time || time.slice(0, 13) >= current.time.slice(0, 13))
      .slice(0, 24);
  }, [hourly, current?.time]);

  const aqi = air?.current?.us_aqi;
  const aqiStatus = aqiInfo(aqi);
  const uvValue = current?.uv_index ?? daily?.uv_index_max?.[todayIndex];
  const advice = getAdvice(current, air);

  const rainChance = hourlyIndexes.length
    ? hourly?.precipitation_probability?.[hourlyIndexes[0].index]
    : null;

  const background = current?.is_day
    ? "from-sky-950 via-blue-950 to-indigo-950"
    : "from-[#050816] via-[#10162e] to-[#171432]";

  return (
    <div
      className={isDark ? "dark min-h-screen" : "min-h-screen"}
      style={{
        "--page": isDark ? "#080e1b" : "#f4f7fb",
        "--card": isDark ? "rgba(255,255,255,0.045)" : "#ffffff",
        "--border": isDark ? "rgba(255,255,255,0.09)" : "#e2e8f0",
        background: "var(--page)",
        color: isDark ? "#f8fafc" : "#0f172a",
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-24 h-96 w-96 rounded-full bg-sky-500/10 blur-[130px]" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-indigo-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--border)] px-6 py-8 lg:flex">
          <a href="#today" className="flex items-center gap-3 text-2xl font-bold tracking-tight">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg">
              <Sun size={24} />
            </span>
            Sky<span className="text-sky-500">Cast</span>
          </a>

          <p className="mb-4 mt-12 text-[10px] font-bold uppercase tracking-[0.23em] opacity-45">
            Your weather
          </p>
          <nav className="space-y-2">
            {[
              ["Overview", "#today", CloudSun],
              ["Hourly forecast", "#hourly", Clock3],
              ["Temperature trends", "#chart", Activity],
              ["7-day forecast", "#forecast", CalendarDays],
              ["Air quality", "#air", Wind],
              ["Sunrise & sunset", "#sun", Sunrise],
            ].map(([label, href, Icon], index) => (
              <a
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  index === 0
                    ? "bg-sky-500/10 font-semibold text-sky-500"
                    : "opacity-65 hover:bg-[var(--card)] hover:opacity-100"
                }`}
              >
                <Icon size={18} /> {label}
              </a>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs opacity-60">
              <Sparkles size={14} className="text-sky-500" /> Current weather
            </div>
            <div className="flex items-center gap-3">
              <WeatherIcon size={34} className="text-sky-500" />
              <div>
                <p className="text-2xl font-semibold">{loading ? "--" : toTemp(current?.temperature_2m)}</p>
                <p className="text-xs opacity-60">{city.name}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
          <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Your personal weather station
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Good day to explore<span className="text-sky-500">.</span>
              </h1>
              <p className="mt-2 text-sm opacity-60">Everything you need to plan your day.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadWeather(city, true)}
                disabled={loading || refreshing}
                className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm transition hover:opacity-75 disabled:opacity-50"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={() => setUnit((old) => old === "celsius" ? "fahrenheit" : "celsius")}
                className="h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold"
                title="Toggle temperature units"
              >
                °{unit === "celsius" ? "C" : "F"} <span className="opacity-50">⇄</span>
              </button>
              <button
                onClick={() => setTheme((old) => old === "dark" ? "light" : "dark")}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </header>

          <form onSubmit={searchCity} className="relative z-20 mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4">
              <Search size={19} className="shrink-0 opacity-50" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search a city, e.g. Jaipur or Dubai, UAE"
                aria-label="Search city"
                className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); setResults([]); }} aria-label="Clear search">
                  <X size={17} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={myLocation}
              disabled={locating}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm disabled:opacity-50"
            >
              {locating ? <LoaderCircle size={17} className="animate-spin" /> : <LocateFixed size={17} className="text-sky-500" />}
              My location
            </button>

            <button
              type="submit"
              disabled={searching || !search.trim()}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
            >
              {searching ? <LoaderCircle size={17} className="animate-spin" /> : <Search size={17} />}
              Search
            </button>

            <AnimatePresence>
              {results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--page)] shadow-2xl sm:right-40"
                >
                  <p className="px-4 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] opacity-50">Choose a location</p>
                  {results.map((place) => (
                    <button
                      type="button"
                      key={`${place.latitude}-${place.longitude}`}
                      onClick={() => chooseCity(place)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sky-500/10"
                    >
                      <MapPin size={17} className="shrink-0 text-sky-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{place.name}</span>
                        <span className="block truncate text-xs opacity-55">{[place.admin1, place.country].filter(Boolean).join(", ")}</span>
                      </span>
                      <ChevronRight size={16} className="opacity-40" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {error && (
            <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error"><X size={17} /></button>
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFavorites((old) => !old)}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium"
            >
              <Heart size={14} className="text-rose-400" />
              Favourite cities ({favorites.length})
            </button>
            <button
              onClick={toggleFavorite}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium"
            >
              <Star size={14} className={isFavorite ? "fill-amber-400 text-amber-400" : "text-amber-400"} />
              {isFavorite ? "Remove current city" : "Save current city"}
            </button>
            {lastUpdated && (
              <span className="ml-auto flex items-center gap-1.5 text-[11px] opacity-50">
                <CheckCircle2 size={13} /> Updated {clock(lastUpdated.toISOString()) === "--" ? lastUpdated.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : lastUpdated.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </div>

          <AnimatePresence>
            {showFavorites && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
                <Card>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">Your favourite cities</h2>
                    <button onClick={() => setShowFavorites(false)} aria-label="Close favourites"><X size={17} /></button>
                  </div>
                  {favorites.length === 0 ? (
                    <p className="text-sm opacity-60">No favourites yet. Save a city to access it quickly.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {favorites.map((place) => (
                        <div key={`${place.latitude}-${place.longitude}`} className="flex items-center gap-1 rounded-xl border border-[var(--border)] pr-2">
                          <button onClick={() => chooseCity(place)} className="px-3 py-2 text-sm">{place.name}</button>
                          <button onClick={() => setFavorites((old) => old.filter((item) => item.latitude !== place.latitude || item.longitude !== place.longitude))} aria-label={`Remove ${place.name}`} className="opacity-50 hover:opacity-100"><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.section
            id="today"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`relative mb-8 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br ${background} p-6 text-white shadow-2xl sm:p-9`}
          >
            <div className="pointer-events-none absolute -right-10 -top-20 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm text-slate-300">
                  <MapPin size={15} className="text-sky-300" />
                  {[city.name, city.admin1, city.country].filter(Boolean).join(", ")}
                </p>
                <h2 className="text-xl font-semibold tracking-tight sm:text-3xl">
                  {dateLabel(current?.time, { weekday: "long", year: "numeric" })}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {current?.time ? `Local time ${clock(current.time)}` : "Live local weather"}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                LIVE WEATHER
              </div>
            </div>

            {loading && !current ? (
              <div className="relative mt-10 flex items-center gap-3 text-sm text-slate-300">
                <LoaderCircle size={20} className="animate-spin" /> Loading weather...
              </div>
            ) : current ? (
              <>
                <div className="relative mt-9 flex flex-wrap items-center justify-between gap-6 sm:mt-12">
                  <div>
                    <div className="flex items-start gap-3">
                      <p className="text-7xl font-light leading-none tracking-[-0.08em] sm:text-8xl">{toTemp(current.temperature_2m)}</p>
                      <span className="mt-2 rounded-full bg-white/[0.08] px-2.5 py-1 text-xs text-slate-300">{unit === "celsius" ? "°C" : "°F"}</span>
                    </div>
                    <p className="mt-5 text-xl font-medium">{condition}</p>
                    <p className="mt-1 text-sm text-slate-400">Feels like {toTemp(current.apparent_temperature)}</p>
                  </div>
                  <motion.div
                    animate={{ y: [0, -7, 0], rotate: [0, 3, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="mr-2 flex h-32 w-32 items-center justify-center rounded-full bg-sky-300/[0.07] sm:mr-8 sm:h-40 sm:w-40"
                  >
                    <WeatherIcon size={90} strokeWidth={1.2} className="text-sky-200 drop-shadow-[0_0_25px_rgba(125,211,252,0.25)] sm:h-28 sm:w-28" />
                  </motion.div>
                </div>

                <div className="relative mt-9 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-4">
                  {[
                    ["High / Low", `${toTemp(daily?.temperature_2m_max?.[todayIndex])} / ${toTemp(daily?.temperature_2m_min?.[todayIndex])}`, Thermometer],
                    ["Rain chance", rainChance == null ? "--" : `${rainChance}%`, CloudRain],
                    ["UV index", uvValue == null ? "--" : `${Number(uvValue).toFixed(1)} · ${uvLabel(uvValue)}`, Sun],
                    ["Wind", `${Math.round(current.wind_speed_10m)} km/h ${windDirection(current.wind_direction_10m)}`, Wind],
                  ].map(([label, value, Icon]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-sky-200"><Icon size={19} /></span>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="mt-1 truncate text-sm font-semibold">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="relative mt-8">
                <p className="text-slate-300">Weather information is unavailable.</p>
                <button onClick={() => loadWeather(city)} className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm">Try again</button>
              </div>
            )}
          </motion.section>

          <section className="mb-8">
            <SectionHeading eyebrow="At a glance" title="Today's highlights" detail="Current conditions" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Droplets} title="Humidity" value={current ? `${current.relative_humidity_2m}%` : "--"} detail="Relative humidity" color="text-sky-500" />
              <MetricCard icon={Wind} title="Wind speed" value={current ? `${Math.round(current.wind_speed_10m)} km/h` : "--"} detail={`Direction: ${windDirection(current?.wind_direction_10m)}`} color="text-violet-500" />
              <MetricCard icon={Gauge} title="Pressure" value={current ? `${Math.round(current.surface_pressure)} hPa` : "--"} detail="Surface atmospheric pressure" color="text-amber-500" />
              <MetricCard icon={CloudRain} title="Precipitation" value={current ? `${current.precipitation} mm` : "--"} detail="Current precipitation" color="text-emerald-500" />
            </div>
          </section>

          <section id="hourly" className="mb-8">
            <SectionHeading eyebrow="Coming up" title="Hourly forecast" detail="Next 24 hours" />
            <Card>
              {loading && !hourly ? (
                <p className="py-8 text-center text-sm opacity-55">Loading hourly forecast...</p>
              ) : (
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                  {hourlyIndexes.map(({ time, index }, position) => {
                    const { label, Icon } = weatherInfo(hourly.weather_code[index], position === 0 ? Boolean(current?.is_day) : true);
                    return (
                      <div key={time} title={label} className={`flex min-w-[88px] flex-col items-center gap-3 rounded-2xl border px-3 py-5 ${position === 0 ? "border-sky-400/30 bg-sky-400/10" : "border-[var(--border)] bg-[var(--card)]"}`}>
                        <span className="text-xs opacity-60">{position === 0 ? "Now" : clock(time, false)}</span>
                        <Icon size={27} className="text-sky-500" />
                        <span className="text-lg font-semibold">{toTemp(hourly.temperature_2m[index])}</span>
                        <span className="flex items-center gap-1 text-[11px] text-sky-500"><Droplets size={12} />{hourly.precipitation_probability?.[index] ?? 0}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>

          <section id="chart" className="mb-8">
            <SectionHeading eyebrow="Visual forecast" title="Temperature trends" detail="Select a point to inspect" />
            <Card>
              {hourly ? <TemperatureChart hourly={hourly} indexes={hourlyIndexes} toTemp={toTemp} /> : <p className="py-8 text-center text-sm opacity-55">Preparing temperature chart...</p>}
            </Card>
          </section>

          <section id="forecast" className="mb-8">
            <SectionHeading eyebrow="Plan ahead" title="7-day forecast" detail="The week ahead" />
            <Card>
              {!daily ? (
                <p className="py-8 text-center text-sm opacity-55">Loading forecast...</p>
              ) : (
                <div className="space-y-1">
                  {daily.time.map((date, index) => {
                    const { label, Icon } = weatherInfo(daily.weather_code[index]);
                    const minimum = Math.min(...daily.temperature_2m_min);
                    const maximum = Math.max(...daily.temperature_2m_max);
                    const range = Math.max(1, maximum - minimum);
                    const left = ((daily.temperature_2m_min[index] - minimum) / range) * 100;
                    const width = ((daily.temperature_2m_max[index] - daily.temperature_2m_min[index]) / range) * 100;

                    return (
                      <div key={date} className="grid grid-cols-[66px_minmax(80px,1fr)] items-center gap-x-3 gap-y-2 rounded-xl px-2 py-4 transition hover:bg-slate-500/5 sm:grid-cols-[90px_minmax(110px,1.1fr)_55px_minmax(100px,1fr)] sm:gap-4 sm:px-3">
                        <p className="text-sm font-medium">{weekday(date, index)}</p>
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon size={21} className="shrink-0 text-sky-500" />
                          <span className="truncate text-xs opacity-60">{label}</span>
                        </div>
                        <p className="hidden text-xs text-sky-500 sm:block"><Droplets size={13} className="mr-1 inline" />{daily.precipitation_probability_max?.[index] ?? 0}%</p>
                        <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                          <span className="w-8 text-right text-xs opacity-60">{toTemp(daily.temperature_2m_min[index])}</span>
                          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-500/15">
                            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300" style={{ marginLeft: `${left}%`, width: `${Math.max(width, 4)}%` }} />
                          </div>
                          <span className="w-8 text-xs font-semibold">{toTemp(daily.temperature_2m_max[index])}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>

          <section id="air" className="mb-8">
            <SectionHeading eyebrow="Breathe easier" title="Air quality" detail="Latest available readings" />
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <div className="flex items-center justify-between">
                  <p className="text-sm opacity-60">US Air Quality Index</p>
                  <Activity size={20} className="text-sky-500" />
                </div>
                <p className="mt-5 text-4xl font-semibold">{air?.current?.us_aqi ?? "--"}</p>
                <p className={`mt-2 text-sm font-semibold ${aqiStatus.color}`}>{aqiStatus.label}</p>
                <p className="mt-2 text-xs leading-5 opacity-60">{airError ? "Air-quality service did not return data for this location." : aqiStatus.advice}</p>
                {air?.current?.time && <p className="mt-3 text-[10px] opacity-40">Reading: {clock(air.current.time)}</p>}
              </Card>
              {[
                { label: "PM2.5", value: air?.current?.pm2_5, desc: "Fine particles · µg/m³", Icon: Wind },
                { label: "PM10", value: air?.current?.pm10, desc: "Coarse particles · µg/m³", Icon: Cloudy },
              ].map((item) => (
                <Card key={item.label}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm opacity-60">{item.label}</p>
                    <item.Icon size={20} className="text-violet-500" />
                  </div>
                  <p className="mt-5 text-3xl font-semibold">{item.value == null ? "--" : Number(item.value).toFixed(1)}</p>
                  <p className="mt-2 text-xs opacity-50">{item.desc}</p>
                  <p className="mt-4 text-xs opacity-60">{item.value == null ? "No current reading available" : "Modelled outdoor concentration"}</p>
                </Card>
              ))}
            </div>
            <p className="mt-3 text-[11px] opacity-50">Air-quality values are model-based estimates, not a substitute for official local monitoring.</p>
          </section>

          <section className="mb-8">
            <SectionHeading eyebrow="Your daily guide" title="Weather insights" detail="Based on current conditions" />
            <Card className="flex items-start gap-4 border-sky-500/20 bg-gradient-to-br from-sky-500/[0.07] to-indigo-500/[0.03]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
                {current && [95, 96, 99].includes(current.weather_code) ? <AlertTriangle size={24} /> : current && [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(current.weather_code) ? <Umbrella size={24} /> : <Sparkles size={24} />}
              </span>
              <div>
                <h3 className="font-semibold">Today's suggestion</h3>
                <p className="mt-2 text-sm leading-6 opacity-70">{advice}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">UV: {uvLabel(uvValue)}</span>
                  <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">Rain chance: {rainChance == null ? "--" : `${rainChance}%`}</span>
                  <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">AQI: {aqiStatus.label}</span>
                </div>
              </div>
            </Card>
          </section>

          <section id="sun" className="mb-8">
            <SectionHeading eyebrow="Daylight" title="Sunrise & sunset" detail="Local times" />
            <Card className="bg-gradient-to-br from-amber-500/[0.06] to-orange-500/[0.025]">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-500"><Sunrise size={28} /></span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-50">Sunrise</p>
                    <p className="mt-1 text-2xl font-semibold">{clock(daily?.sunrise?.[todayIndex])}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-400/10 text-orange-500"><Sunset size={28} /></span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-50">Sunset</p>
                    <p className="mt-1 text-2xl font-semibold">{clock(daily?.sunset?.[todayIndex])}</p>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <footer className="flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] py-6 text-xs opacity-55 sm:flex-row sm:items-center">
            <a href="#today" className="flex items-center gap-2 font-semibold opacity-100">
              <Sun size={17} className="text-sky-500" /> SkyCast
            </a>
            <p>Weather by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="text-sky-500 hover:underline">Open-Meteo</a></p>
            <p>Air quality by <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer" className="text-sky-500 hover:underline">Open-Meteo</a></p>
            <p>Weather made simple · {city.name}</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
