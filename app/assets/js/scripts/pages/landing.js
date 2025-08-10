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

  // Map incident.io impact/status to our UI states
  const impactToState = (impact) => {
    switch (impact) {
      case 'full_outage': return 'down';
      case 'partial_outage': return 'partial';
      case 'degraded_performance': return 'degraded';
      default: return 'ok';
    }
  };

  // Pick the "worst" impact among incidents
  const worstImpact = (incidents) => {
    let order = { down: 3, partial: 2, degraded: 1, ok: 0 };
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

  // Small "time ago" helper in local timezone
  const timeAgo = (iso) => {
    try {
      const d = new Date(iso);
      const diffMs = Date.now() - d.getTime();
      const mins = Math.round(diffMs / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins} min ago`;
      const hours = Math.round(mins / 60);
      if (hours < 24) return `${hours} h ago`;
      const days = Math.round(hours / 24);
      return `${days} d ago`;
    } catch { return ''; }
  };

  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };

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
      item.addEventListener('click', () => {
        // Open the incident page in the system browser (Electron will handle target=_blank)
        window.open(link, '_blank');
      });
    }
    return item;
  };

  const render = (data) => {
    const dot = document.querySelector(SELECTORS.dot);
    const title = document.querySelector(SELECTORS.title);
    const body = document.querySelector(SELECTORS.body);
    const link = document.querySelector(SELECTORS.link);
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
      ok: 'All systems operational',
      degraded: 'Degraded performance',
      partial: 'Partial outage',
      down: 'Major outage',
      maintenance: 'Maintenance in progress'
    }[state] || 'Status';

    title.textContent = `${stateText}${counts.incidents ? ` · ${counts.incidents} incident${counts.incidents>1?'s':''}` : ''}${counts.maintNow ? ` · ${counts.maintNow} maintenance` : ''}`;

    if (link) link.href = data.page_url || 'https://status.mcflowblock.com/';

    // Body lists
    clear(body);

    // Ongoing incidents
    for (const inc of (data.ongoing_incidents || [])) {
      const chips = [];
      const impactState = impactToState(inc.current_worst_impact);
      chips.push(makeChip(inc.current_worst_impact.replace('_',' '), impactState));
      if (Array.isArray(inc.affected_components)) {
        for (const comp of inc.affected_components) {
          const compState = impactToState(comp.current_status);
          const label = comp.group_name ? `${comp.group_name} / ${comp.name}` : comp.name;
          chips.push(makeChip(label, compState));
        }
      }
      const meta = `${inc.status} • updated ${timeAgo(inc.last_update_at)}`;
      body.appendChild(renderListItem(inc.name, meta, chips, inc.url));
    }

    // Maintenances in progress
    for (const m of (data.in_progress_maintenances || [])) {
      const chips = [];
      if (Array.isArray(m.affected_components)) {
        for (const comp of m.affected_components) {
          const compState = impactToState(comp.current_status);
          const label = comp.group_name ? `${comp.group_name} / ${comp.name}` : comp.name;
          chips.push(makeChip(label, compState));
        }
      }
      const meta = `in progress • started ${timeAgo(m.started_at)} • ends ${new Date(m.scheduled_end_at).toLocaleString()}`;
      body.appendChild(renderListItem(m.name, meta, chips, m.url));
    }

    // Scheduled maintenances
    for (const s of (data.scheduled_maintenances || [])) {
      const meta = `scheduled • ${new Date(s.starts_at).toLocaleString()} → ${new Date(s.ends_at).toLocaleString()}`;
      body.appendChild(renderListItem(s.name, meta, [], s.url));
    }

    // Empty state
    if (!body.children.length) {
      body.appendChild(renderListItem('No active incidents', 'Everything looks good.'));
    }
  };

  const showError = () => {
    const dot = document.querySelector(SELECTORS.dot);
    const title = document.querySelector(SELECTORS.title);
    const body = document.querySelector(SELECTORS.body);
    if (dot) dot.setAttribute('data-state', 'degraded');
    if (title) title.textContent = 'Status unavailable';
    if (body) {
      clear(body);
      body.appendChild(renderListItem('Cannot reach status API', 'Please try again later.'));
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

  // Initial load + refresh every 60s
  fetchAndRenderStatus();
  setInterval(fetchAndRenderStatus, 60_000);

  window.refreshStatus = fetchAndRenderStatus;
})();
