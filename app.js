// app.js
import { renderDoughnut } from './chart.js';

const usernameInput = document.getElementById('username');
const searchBtn = document.getElementById('searchBtn');
const userInfoEl = document.getElementById('userInfo');
const repoListEl = document.getElementById('repoList');
const languageCanvas = document.getElementById('languageChart');
const sortSelect = document.getElementById('sortSelect');
const filterLang = document.getElementById('filterLang');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const repoControls = document.getElementById('repoControls');
const repoCount = document.getElementById('repoCount');
const rateInfo = document.getElementById('rateInfo');
const bookmarkBtn = document.getElementById('bookmarkBtn');

let currentUser = null;
let allRepos = [];
let shownRepos = 0;
const perPage = 12;

function showLoading(target) {
  target.innerHTML = `<div class="p-4 text-center"><div class="spinner-border" role="status"></div></div>`;
}

function showError(target, message) {
  target.innerHTML = `<div class="alert alert-danger">${message}</div>`;
}


// theme toggle
(function initTheme() {
  const tbtn = document.getElementById('themeToggle');
  const saved = localStorage.getItem('GITREPOS_THEME') || 'dark';
  setTheme(saved);
  tbtn.addEventListener('click', () => {
    const newt = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(newt);
  });
})();
function setTheme(name) {
  if (name === 'dark') document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.setAttribute('data-theme','light');
  localStorage.setItem('GITREPOS_THEME', name);
  document.getElementById('themeToggle').textContent = name === 'dark' ? '🌙' : '☀️';
}

// basic caching with TTL
function cacheSet(key, value, ttlSec = 300) {
  const payload = { ts: Date.now(), ttl: ttlSec*1000, data: value };
  localStorage.setItem(key, JSON.stringify(payload));
}
function cacheGet(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (Date.now() - p.ts > p.ttl) { localStorage.removeItem(key); return null; }
    return p.data;
  } catch { return null; }
}

// fetch wrapper with optional token
async function fetchWithAuth(url) {
  const res = await fetch(url);
  const limit = res.headers.get('x-ratelimit-limit');
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  updateRateInfo(limit, remaining, reset);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${res.statusText} — ${txt}`);
  }
  return res.json();
}

function updateRateInfo(limit, remaining, reset) {
  if (!limit && !remaining) {
    const cache = cacheGet('GITREPOS_RATE');
    if (cache) {
      limit = cache.limit; remaining = cache.remaining; reset = cache.reset;
    }
  } else {
    cacheSet('GITREPOS_RATE', { limit, remaining, reset }, 60);
  }
  if (!limit) { rateInfo.textContent = ''; return; }
  const resetDate = reset ? new Date(parseInt(reset,10)*1000) : null;
  rateInfo.innerHTML = `Rate: <strong>${remaining}/${limit}</strong>${resetDate? ' • reset: '+resetDate.toLocaleTimeString():''}`;
}

// render user info
function renderUserInfo(user) {
  currentUser = user;
  userInfoEl.innerHTML = `
    <img src="${user.avatar_url}" alt="${user.login}">
    <div>
      <h3>${user.name || user.login}</h3>
      <p class="text-muted">${user.bio || ''}</p>
      <p class="small text-muted">Repos: ${user.public_repos} • Followers: ${user.followers}</p>
      <div class="mt-2">
        <a href="${user.html_url}" target="_blank" class="btn btn-sm btn-outline-primary">View on GitHub</a>
        <button id="saveBookmark" class="btn btn-sm btn-outline-success">Bookmark</button>
        <a href="repo.html" class="btn btn-sm btn-outline-secondary">Open Repo Page</a>
      </div>
    </div>
  `;
  document.getElementById('saveBookmark').addEventListener('click', () => toggleBookmark(user));
}

// bookmarks
function getBookmarks() {
  return JSON.parse(localStorage.getItem('GITREPOS_BOOKMARKS') || '[]');
}
function toggleBookmark(user) {
  const bookmarks = getBookmarks();
  const idx = bookmarks.findIndex(b => b.login === user.login);
  if (idx === -1) {
    bookmarks.push({ login: user.login, avatar_url: user.avatar_url, name: user.name });
    alert('Bookmarked ' + user.login);
  } else {
    bookmarks.splice(idx,1);
    alert('Removed bookmark');
  }
  localStorage.setItem('GITREPOS_BOOKMARKS', JSON.stringify(bookmarks));
}
bookmarkBtn.addEventListener('click', () => {
  const bookmarks = getBookmarks();
  if (!bookmarks.length) return alert('No bookmarks saved.');
  let html = '<div class="row">';
  bookmarks.forEach(b => {
    html += `<div class="col-md-3"><div class="card p-2 text-center">
      <img src="${b.avatar_url}" width="60" class="rounded-circle"><div>${b.name || b.login}</div>
      <div class="mt-2"><button class="btn btn-sm btn-primary open" data-login="${b.login}">Open</button></div>
    </div></div>`;
  });
  html += '</div>';
  repoListEl.innerHTML = html;
  document.querySelectorAll('.open').forEach(btn => btn.addEventListener('click', e => {
    document.getElementById('username').value = e.target.dataset.login;
    searchUser();
  }));
});

// render repo batch
function renderReposBatch(repos) {
  const frag = document.createDocumentFragment();
  repos.forEach(repo => {
    const col = document.createElement('div');
    col.className = 'col-md-4';
    col.innerHTML = `
      <div class="repo-card">
        <h5>${repo.name}</h5>
        <p>${repo.description || ''}</p>
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <span class="badge bg-secondary">★ ${repo.stargazers_count}</span>
            <span class="badge bg-info text-dark">🍴 ${repo.forks_count}</span>
            <span class="badge bg-warning text-dark">🛠 ${repo.language || 'N/A'}</span>
          </div>
          <div>
            <a class="btn btn-sm btn-outline-primary" href="${repo.html_url}" target="_blank">View</a>
            <a class="btn btn-sm btn-outline-secondary" href="repo.html?user=${repo.owner.login}&repo=${encodeURIComponent(repo.name)}">Details</a>
          </div>
        </div>
      </div>
    `;
    frag.appendChild(col);
  });
  repoListEl.appendChild(frag);
}

// apply filter & sort
function getFilteredSortedRepos() {
  const lang = filterLang.value;
  let arr = allRepos.slice();
  if (lang) arr = arr.filter(r => r.language === lang);
  const s = sortSelect.value;
  if (s === 'best') arr.sort((a,b) => (b.stargazers_count||0) - (a.stargazers_count||0));
  else if (s === 'updated') arr.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
  else if (s === 'forks') arr.sort((a,b) => (b.forks_count||0) - (a.forks_count||0));
  else if (s === 'name') arr.sort((a,b) => a.name.localeCompare(b.name));
  return arr;
}

function refreshListing(reset=true) {
  if (reset) { repoListEl.innerHTML = ''; shownRepos = 0; }
  const arr = getFilteredSortedRepos();
  const next = arr.slice(shownRepos, shownRepos + perPage);
  renderReposBatch(next);
  shownRepos += next.length;
  repoControls.style.display = 'flex';
  repoCount.textContent = `Showing ${shownRepos} of ${arr.length} repos`;
  loadMoreBtn.style.display = shownRepos < arr.length ? 'inline-block' : 'none';
  // build language filter options:
  const langs = [...new Set(allRepos.map(r => r.language).filter(Boolean))].sort();
  filterLang.innerHTML = `<option value="">Filter: All languages</option>` + langs.map(l => `<option value="${l}">${l}</option>`).join('');
  // language chart:
  const lc = {};
  allRepos.forEach(r => { if (r.language) lc[r.language] = (lc[r.language]||0)+1; });
  if (Object.keys(lc).length) renderDoughnut(languageCanvas, lc, { title: 'Languages used across repos' });
}

loadMoreBtn.addEventListener('click', () => refreshListing(false));
sortSelect.addEventListener('change', () => refreshListing(true));
filterLang.addEventListener('change', () => refreshListing(true));

// main search
async function searchUser() {
  const username = usernameInput.value.trim();
  if (!username) return alert('Enter a username');
  userInfoEl.innerHTML = '';
  repoListEl.innerHTML = '';
  repoControls.style.display = 'none';
  showLoading(userInfoEl);
  try {
    const cacheKey = `GITREPOS_USER_${username.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    let user;
    if (cached) {
      user = cached.user;
      allRepos = cached.repos;
    } else {
      user = await fetchWithAuth(`https://api.github.com/users/${username}`);
      // get repos (100 per_page max). If large count, we still fetch first 300 (3 pages)
      const pages = Math.min(3, Math.ceil(user.public_repos / 100) || 1);
      const repoPromises = [];
      for (let p=1;p<=pages;p++) repoPromises.push(fetchWithAuth(`https://api.github.com/users/${username}/repos?per_page=100&page=${p}`));
      const repoPages = await Promise.all(repoPromises);
      allRepos = repoPages.flat();
      cacheSet(cacheKey, { user, repos: allRepos }, 180); // 3min cache
    }
    renderUserInfo(user);
    repoListEl.innerHTML = '';
    refreshListing(true);
  } catch (err) {
    showError(userInfoEl, err.message);
  }
}

searchBtn.addEventListener('click', searchUser);
usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchUser(); });

// initial rate info
updateRateInfo();
