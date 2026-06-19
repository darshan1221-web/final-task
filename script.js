/* ================================================================
   WeatherScope – Real-Time Weather Dashboard
   Stack  : HTML5, CSS3, Vanilla JavaScript, Fetch API
   API    : OpenWeatherMap (free tier)
================================================================ */

'use strict';

/* ── Config ─────────────────────────────────────────────────── */
const API_KEY     = '579c93a1dc700ef51fc9cff3aaf26aec'; 
const BASE_URL    = 'https://api.openweathermap.org/data/2.5/weather';
const MAX_HISTORY = 8;

/* ── State ──────────────────────────────────────────────────── */
let weatherData    = null;   // raw API response
let unitIsCelsius  = true;   // temperature unit toggle
let searchHistory  = JSON.parse(localStorage.getItem('ws_history') || '[]');

/* ── DOM refs ───────────────────────────────────────────────── */
const cityInput      = document.getElementById('city-input');
const searchBtn      = document.getElementById('search-btn');
const statusMsg      = document.getElementById('status-message');
const weatherContent = document.getElementById('weather-content');
const placeholder    = document.getElementById('placeholder');
const themeToggle    = document.getElementById('theme-toggle');
const recentSection  = document.getElementById('recent-section');
const liveClock      = document.getElementById('live-clock');

/* ── Temperature unit buttons ───────────────────────────────── */
const btnC = document.getElementById('btn-c');
const btnF = document.getElementById('btn-f');

/* ================================================================
   1. LIVE CLOCK  (Requirement 11)
================================================================ */
function updateClock() {
  const now = new Date();
  const opts = {
    weekday : 'short',
    month   : 'short',
    day     : 'numeric',
    hour    : '2-digit',
    minute  : '2-digit',
    second  : '2-digit',
    hour12  : true,
  };
  liveClock.textContent = now.toLocaleString('en-IN', opts);
}
updateClock();
setInterval(updateClock, 1000);

/* ================================================================
   2. DARK / LIGHT MODE TOGGLE  (Requirement 10)
================================================================ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('ws_theme', theme);
}

// Restore saved theme
const savedTheme = localStorage.getItem('ws_theme') || 'dark';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

/* ================================================================
   3. STATUS / LOADING / ERROR  (Requirement 8)
================================================================ */
function showLoading(msg = 'Fetching weather data…') {
  statusMsg.className   = 'loading';
  statusMsg.innerHTML   = `<div class="spinner"></div>${msg}`;
  weatherContent.classList.remove('visible');
  placeholder.style.display = 'none';
}

function showError(msg) {
  statusMsg.className   = 'error';
  statusMsg.innerHTML   = `⚠️ ${msg}`;
  placeholder.style.display = 'block';
}

function hideStatus() {
  statusMsg.className   = '';
  statusMsg.style.display = 'none';
}

/* ================================================================
   4. FETCH WEATHER DATA  (Requirement 1–7)
================================================================ */
async function fetchWeather(city) {
  if (!city.trim()) {
    showError('Please enter a city name to search.');
    return;
  }

  showLoading(`Looking up weather for "${city}"…`);

  try {
    const url      = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
    const response = await fetch(url);

    if (response.status === 404) {
      throw new Error(`City "${city}" not found. Check the spelling and try again.`);
    }
    if (response.status === 401) {
      throw new Error('Invalid API key. Please set a valid OpenWeatherMap API key.');
    }
    if (!response.ok) {
      throw new Error(`Server error (${response.status}). Please try again later.`);
    }

    const data = await response.json();
    weatherData = data;

    addToHistory(data.name + (data.sys.country ? `, ${data.sys.country}` : ''));
    renderWeather(data);
    hideStatus();
    weatherContent.classList.add('visible');
    placeholder.style.display = 'none';

  } catch (err) {
    showError(err.message || 'Something went wrong. Check your connection and try again.');
  }
}

/* ================================================================
   5. RENDER WEATHER DATA
================================================================ */
function renderWeather(data) {
  // City & country  (Req 2)
  document.getElementById('city-name').textContent  = data.name;
  document.getElementById('country-tag').textContent = data.sys.country || '';

  // Temperature  (Req 3)
  renderTemperature();

  // Condition & Icon  (Req 4, 7)
  const cond = data.weather[0];
  document.getElementById('condition-label').textContent = cond.description;
  const iconEl = document.getElementById('weather-icon');
  iconEl.src = `https://openweathermap.org/img/wn/${cond.icon}@2x.png`;
  iconEl.alt = cond.description;

  // Humidity  (Req 5)
  const humidity = data.main.humidity;
  document.getElementById('stat-humidity').textContent = `${humidity}%`;
  setBar('bar-humidity', humidity, 100);

  // Wind  (Req 6)
  const windKmh = (data.wind.speed * 3.6).toFixed(1);
  document.getElementById('stat-wind').textContent = `${windKmh} km/h`;
  setBar('bar-wind', windKmh, 120); // 120 km/h as max reference

  // Visibility
  const vis = data.visibility ? (data.visibility / 1000).toFixed(1) : '—';
  document.getElementById('stat-visibility').textContent = vis !== '—' ? `${vis} km` : '—';
  setBar('bar-visibility', vis !== '—' ? vis : 0, 10);

  // Pressure
  const pres = data.main.pressure;
  document.getElementById('stat-pressure').textContent = `${pres} hPa`;
  setBar('bar-pressure', pres - 900, 200); // 900–1100 range

  // Sunrise / Sunset
  document.getElementById('stat-sunrise').textContent = unixToTime(data.sys.sunrise, data.timezone);
  document.getElementById('stat-sunset').textContent  = unixToTime(data.sys.sunset,  data.timezone);

  // Extra pills
  document.getElementById('pill-cloud').textContent  = `${data.clouds.all}%`;
  document.getElementById('pill-uv').textContent     = 'N/A';  // base plan API
  document.getElementById('pill-coords').textContent = `${data.coord.lat.toFixed(2)}, ${data.coord.lon.toFixed(2)}`;
}

function renderTemperature() {
  if (!weatherData) return;
  const tempC   = weatherData.main.temp;
  const feelsC  = weatherData.main.feels_like;
  const display = unitIsCelsius ? tempC : celsiusToFahrenheit(tempC);
  const feels   = unitIsCelsius ? feelsC : celsiusToFahrenheit(feelsC);
  const unit    = unitIsCelsius ? '°C' : '°F';

  document.getElementById('temp-main').textContent  = `${Math.round(display)}${unit}`;
  document.getElementById('feels-like').textContent = `Feels like ${Math.round(feels)}${unit}`;
}

/* ── Helpers ────────────────────────────────────────────────── */
function celsiusToFahrenheit(c) { return (c * 9/5) + 32; }

function setBar(id, value, max) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  document.getElementById(id).style.width = pct + '%';
}

function unixToTime(unix, offsetSec) {
  const utcMs = (unix + offsetSec) * 1000;
  const d = new Date(utcMs);
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/* ================================================================
   6. TEMPERATURE UNIT TOGGLE
================================================================ */
btnC.addEventListener('click', () => {
  if (unitIsCelsius) return;
  unitIsCelsius = true;
  btnC.classList.add('active');
  btnF.classList.remove('active');
  btnC.setAttribute('aria-pressed', 'true');
  btnF.setAttribute('aria-pressed', 'false');
  renderTemperature();
});

btnF.addEventListener('click', () => {
  if (!unitIsCelsius) return;
  unitIsCelsius = false;
  btnF.classList.add('active');
  btnC.classList.remove('active');
  btnF.setAttribute('aria-pressed', 'true');
  btnC.setAttribute('aria-pressed', 'false');
  renderTemperature();
});

/* ================================================================
   7. RECENT SEARCH HISTORY  (Requirement 9)
================================================================ */
function addToHistory(cityLabel) {
  // Remove duplicate if exists
  searchHistory = searchHistory.filter(c => c.toLowerCase() !== cityLabel.toLowerCase());
  // Prepend latest
  searchHistory.unshift(cityLabel);
  // Cap at MAX_HISTORY
  if (searchHistory.length > MAX_HISTORY) {
    searchHistory = searchHistory.slice(0, MAX_HISTORY);
  }
  localStorage.setItem('ws_history', JSON.stringify(searchHistory));
  renderHistory();
}

function renderHistory() {
  recentSection.innerHTML = '';
  if (searchHistory.length === 0) return;

  const label = document.createElement('span');
  label.className   = 'recent-label';
  label.textContent = 'Recent:';
  recentSection.appendChild(label);

  searchHistory.forEach(city => {
    const tag = document.createElement('button');
    tag.className   = 'recent-tag';
    tag.textContent = city;
    tag.setAttribute('role', 'listitem');
    tag.addEventListener('click', () => {
      cityInput.value = city.split(',')[0].trim();
      fetchWeather(cityInput.value);
    });
    recentSection.appendChild(tag);
  });

  const clearBtn = document.createElement('button');
  clearBtn.className   = 'clear-history';
  clearBtn.textContent = '✕ Clear';
  clearBtn.title       = 'Clear search history';
  clearBtn.addEventListener('click', clearHistory);
  recentSection.appendChild(clearBtn);
}

function clearHistory() {
  searchHistory = [];
  localStorage.removeItem('ws_history');
  renderHistory();
}

// Init history on load
renderHistory();

/* ================================================================
   8. SEARCH TRIGGERS
================================================================ */
searchBtn.addEventListener('click', () => fetchWeather(cityInput.value.trim()));

cityInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') fetchWeather(cityInput.value.trim());
});

// Auto-load first history item if available, else load default city
if (searchHistory.length > 0) {
  const first = searchHistory[0].split(',')[0].trim();
  cityInput.value = first;
  fetchWeather(first);
}
