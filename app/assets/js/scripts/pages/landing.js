function updateAvatar(uuid) {
    let avatarContainers = document.querySelectorAll('[avatar]')
    for(let container of avatarContainers) {
        container.src = `https://nmsr.nickac.dev/fullbody/${uuid}`
    }
}
function updateUsername(displayName) {
    let usernameContainers = document.querySelectorAll('[username]')
    for(let container of usernameContainers) {
        container.innerText = displayName
    }
}

function openLaunchOverlay() {
    let launchOverlay = document.querySelectorAll('[launch_overlay]')
    for(let overlay of launchOverlay) {
        overlay.style=""
    }
}
function closeLaunchOverlay() {
    let launchOverlay = document.querySelectorAll('[launch_overlay]')
    for(let overlay of launchOverlay) {
        overlay.style="display: none;"
    }
}

function updateLaunchText(text) {
    let launchTextContainers = document.querySelectorAll('[launch_text]')
    for(let container of launchTextContainers) {
        container.innerText = text
    }
}
function updateLaunchPercentage(percentage) {
    let launchPercentageContainers = document.querySelectorAll('[launch_percentage]')
    for(let container of launchPercentageContainers) {
        container.style.width = percentage+'%'
    }
}

function updateSelectedAccount(authUser) {
    if(authUser != null) {
        if(authUser.displayName != null) {
            updateUsername(authUser.displayName)
        }
        if(authUser.uuid != null) {
            updateAvatar(authUser.uuid)
        }
    }
}

updateSelectedAccount(ConfigManager.getSelectedAccount());

// ---- Service Status (incident.io summary) -----------------------------------

(() => {
  const STATUS_API = 'https://status.mcflowblock.com/api/v1/summary';
  const SELECTORS = {
    dot: '#statusWidget .status-dot',
    title: '#statusTitle',
    body: '#statusBody',
    link: '#statusLink'
  };

  // i18n helpers: Lang.queryJS('landing.…') + fallback
  const t = (key, fallback = '') =>
    (window.Lang && typeof Lang.queryJS === 'function')
      ? (Lang.queryJS(key) || fallback || key)
      : (fallback || key);

  const plural = (n, oneKey, manyKey, fallbackOne, fallbackMany) =>
    n === 1 ? t(oneKey, fallbackOne) : t(manyKey, fallbackMany);

  // Map incident.io impact/status to our UI states
  const impactToState = (impact) => {
    switch (impact) {
      case 'full_outage': return 'down';
      case 'partial_outage': return 'partial';
      case 'degraded_performance': return 'degraded';
      default: return 'ok';
    }
  };

  // Group helpers: build one chip per component group with the group's worst state.
const STATE_ORDER = { down: 3, partial: 2, degraded: 1, ok: 0 };
const STRICT_GROUPS_ONLY = false; // true = ignore components without group_name

function groupWorstStates(components = []) {
  const map = new Map(); // group_name -> worst state
  for (const c of components) {
    const group = c.group_name || (STRICT_GROUPS_ONLY ? null : c.name);
    if (!group) continue;
    const state = impactToState(c.current_status);
    const prev = map.get(group) || 'ok';
    if (STATE_ORDER[state] > STATE_ORDER[prev]) map.set(group, state);
  }
  return map;
}

function makeGroupChips(components = []) {
  const chips = [];
  const groups = groupWorstStates(components);
  for (const [group, state] of groups) chips.push(makeChip(group, state));
  return chips;
}

  // Localized impact label for chips
  const impactLabel = (impact) => ({
    full_outage: t(Lang.queryJS('landing.status.impact.fullOutage', 'full outage')),
    partial_outage: t(Lang.queryJS('landing.status.impact.partialOutage', 'partial outage')),
    degraded_performance: t(Lang.queryJS('landing.status.impact.degradedPerformance', 'degraded performance'))
  }[impact] || (impact ? impact.replace('_', ' ') : ''));

  // Pick the "worst" impact among incidents
  const worstImpact = (incidents) => {
    const order = { down: 3, partial: 2, degraded: 1, ok: 0 };
    let worst = 'ok';
    for (const inc of (incidents || [])) {
      const st = impactToState(inc.current_worst_impact);
      if (order[st] > order[worst]) worst = st;
    }
    return worst;
  };

  // Compute overall state for the widget
  const overallState = (data) => {
    const incidentState = worstImpact(data.ongoing_incidents);
    if (incidentState !== 'ok') return incidentState;
    if ((data.in_progress_maintenances || []).length > 0) return 'maintenance';
    return 'ok';
  };

  // Localized "time ago"
  const timeAgo = (iso) => {
    try {
      const d = new Date(iso);
      const diffMs = Date.now() - d.getTime();
      const mins = Math.round(diffMs / 60000);

      if (mins < 1) return t(Lang.queryJS('landing.status.time.justNow', 'just now'));
      if (mins < 60) return `${mins} ${t(Lang.queryJS('landing.status.time.minSuffix', 'min'))} ${t(Lang.queryJS('landing.status.updatedSuffix', 'ago'))}`.trim();

      const hours = Math.round(mins / 60);
      if (hours < 24) return `${hours} ${t(Lang.queryJS('landing.status.time.hourSuffix', 'h'))} ${t(Lang.queryJS('landing.status.updatedSuffix', 'ago'))}`.trim();

      const days = Math.round(hours / 24);
      return `${days} ${t(Lang.queryJS('landing.status.time.daySuffix', 'd'))} ${t(Lang.queryJS('landing.status.updatedSuffix', 'ago'))}`.trim();
    } catch { return ''; }
  };

  const clear = (el) => { while (el && el.firstChild) el.removeChild(el.firstChild); };

  const makeChip = (label, state) => {
    const span = document.createElement('span');
    span.className = `chip ${state}`;
    span.textContent = label;
    return span;
  };

  const renderListItem = (title, meta, chips = [], link) => {
    const item = document.createElement('div');
    item.className = 'status-item';

    const strong = document.createElement('div');
    strong.textContent = title;
    item.appendChild(strong);

    if (meta) {
      const metaEl = document.createElement('div');
      metaEl.className = 'meta';
      metaEl.textContent = meta;
      item.appendChild(metaEl);
    }

    if (chips.length) {
      const wrap = document.createElement('div');
      wrap.className = 'status-chips';
      chips.forEach(c => wrap.appendChild(c));
      item.appendChild(wrap);
    }

    if (link) {
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => window.open(link, '_blank'));
    }
    return item;
  };

  const render = (data) => {
    const dot   = document.querySelector(SELECTORS.dot);
    const title = document.querySelector(SELECTORS.title);
    const body  = document.querySelector(SELECTORS.body);
    const link  = document.querySelector(SELECTORS.link);
    if (!dot || !title || !body) return;

    // Overall state + header
    const state = overallState(data);
    dot.setAttribute('data-state', state);

    const counts = {
      incidents: (data.ongoing_incidents || []).length,
      maintNow: (data.in_progress_maintenances || []).length,
      maintSched: (data.scheduled_maintenances || []).length
    };

    const stateText = {
      ok:          t(Lang.queryJS('landing.status.state.ok', 'All systems operational')),
      degraded:    t(Lang.queryJS('landing.status.state.degraded', 'Degraded performance')),
      partial:     t(Lang.queryJS('landing.status.state.partial', 'Partial outage')),
      down:        t(Lang.queryJS('landing.status.state.down', 'Major outage')),
      maintenance: t(Lang.queryJS('landing.status.state.maintenance', 'Maintenance in progress'))
    }[state] || t(Lang.queryJS('landing.status.state.default', 'Status'));

    let header = stateText;
    if (counts.incidents) {
      header += ` · ${counts.incidents} ${plural(counts.incidents,
        Lang.queryJS('landing.status.incident.one', 'incident'), Lang.queryJS('landing.status.incident.many', 'incidents'))}`;
    }
    if (counts.maintNow) {
      header += ` · ${counts.maintNow} ${plural(counts.maintNow,
        Lang.queryJS('landing.status.maintenance.one', 'maintenance'), Lang.queryJS('landing.status.maintenance.many', 'maintenances'))}`;
    }
    title.textContent = header;

    if (link) {
      link.href = data.page_url || 'https://status.mcflowblock.com/';
      link.textContent = t(Lang.queryJS('landing.status.seeFullStatus', 'See full status'));
    }

    // Body lists
    clear(body);

    // Ongoing incidents
    for (const inc of (data.ongoing_incidents || [])) {
const chips = Array.isArray(inc.affected_components)
  ? makeGroupChips(inc.affected_components)
  : [];


      const statusLabel = ({
        identified:   t(Lang.queryJS('landing.status.incidentStatus.identified', 'identified')),
        investigating:t(Lang.queryJS('landing.status.incidentStatus.investigating', 'investigating')),
        monitoring:   t(Lang.queryJS('landing.status.incidentStatus.monitoring', 'monitoring'))
      }[inc.status] || inc.status);

      const meta = `${statusLabel} • ${t(Lang.queryJS('landing.status.updated', 'updated'))} ${timeAgo(inc.last_update_at)}`;
      body.appendChild(renderListItem(inc.name, meta, chips, inc.url));
    }

    // Maintenances in progress
    for (const m of (data.in_progress_maintenances || [])) {
      const chips = [];
      if (Array.isArray(m.affected_components)) {
        for (const comp of m.affected_components) {
            if (!chips.find(c => c.textContent === comp.group_name)) {
                const compState = impactToState(comp.current_status);
                const label = comp.group_name ? `${comp.group_name}` : comp.name;
                chips.push(makeChip(label, compState));
            }
        }
      }
      const meta = `${t(Lang.queryJS('landing.status.inProgress', 'in progress'))} • ${t(Lang.queryJS('landing.status.started', 'started'))} ${timeAgo(m.started_at)} • ${t(Lang.queryJS('landing.status.ends', 'ends'))} ${new Date(m.scheduled_end_at).toLocaleString()}`;
      body.appendChild(renderListItem(m.name, meta, chips, m.url));
    }

    // Scheduled maintenances
    for (const s of (data.scheduled_maintenances || [])) {
      const meta = `${t(Lang.queryJS('landing.status.scheduled', 'scheduled'))} • ${new Date(s.starts_at).toLocaleString()} → ${new Date(s.ends_at).toLocaleString()}`;
      body.appendChild(renderListItem(s.name, meta, [], s.url));
    }

    // Empty state
    if (!body.children.length) {
      body.appendChild(
        renderListItem(
          t(Lang.queryJS('landing.status.empty.title', 'No active incidents')),
          t(Lang.queryJS('landing.status.empty.subtitle', 'Everything looks good.'))
        )
      );
    }
  };

  const showError = () => {
    const dot = document.querySelector(SELECTORS.dot);
    const title = document.querySelector(SELECTORS.title);
    const body = document.querySelector(SELECTORS.body);
    if (dot) dot.setAttribute('data-state', 'degraded');
    if (title) title.textContent = t(Lang.queryJS('landing.status.error.title', 'Status unavailable'));
    if (body) {
      clear(body);
      body.appendChild(
        renderListItem(
          t(Lang.queryJS('landing.status.error.bodyTitle', 'Cannot reach status API')),
          t(Lang.queryJS('landing.status.error.bodySubtitle', 'Please try again later.'))
        )
      );
    }
  };

  const fetchAndRenderStatus = async () => {
    try {
      const res = await fetch(STATUS_API, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch (e) {
      console.error('Status widget error:', e);
      showError();
    }
  };

  // Initial translated "loading" title
  const initTitle = document.querySelector(SELECTORS.title);
  if (initTitle) initTitle.textContent = t(Lang.queryJS('landing.status.loading', 'Loading status…'));

  // Initial load + refresh every 60s
  fetchAndRenderStatus();
  setInterval(fetchAndRenderStatus, 60_000);

  // Optional manual refresh hook
  window.refreshStatus = fetchAndRenderStatus;
})();

