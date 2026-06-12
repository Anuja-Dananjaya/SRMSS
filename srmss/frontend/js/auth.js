const API = 'http://localhost:5001/api';
const token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) window.location.href = 'login.html';

function isSuperAdmin() {
  return currentUser?.role === 'superadmin';
}

async function initPage() {
  await loadUserInfo();
  renderNavbar();
}

async function loadUserInfo() {
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.user) {
      Object.assign(currentUser, data.user);
      localStorage.setItem('user', JSON.stringify(currentUser));

      const nameEl = document.getElementById('userName');
      if (nameEl) nameEl.textContent = data.user.name;

      const roleEl = document.getElementById('userRole');
      if (roleEl) {
        roleEl.textContent = formatRole(data.user.role);
        roleEl.className = `role-badge role-${data.user.role}`;
      }

      const depotEl = document.getElementById('userDepot');
      if (depotEl && data.user.depotName) {
        depotEl.textContent = data.user.depotName;
        depotEl.style.display = 'inline';
      }
    }
  } catch (err) {
    console.error('Error loading user:', err);
  }
}

function renderNavbar() {
  const depotLink = document.getElementById('navDepots');
  if (depotLink) {
    depotLink.style.display = isSuperAdmin() ? 'inline' : 'none';
  }

  const usersLink = document.getElementById('navUsers');
  if (usersLink) {
    const canSeeUsers = ['superadmin', 'admin'].includes(currentUser?.role);
    usersLink.style.display = canSeeUsers ? 'inline' : 'none';
  }

  const myTripsLink = document.getElementById('navMyTrips');
  if (myTripsLink) {
    // Only depot operators should see My Trips
    myTripsLink.style.display = currentUser?.role === 'operator' ? 'inline' : 'none';
  }
}

async function renderDepotFilter(onChange) {
  const container = document.getElementById('depotFilterContainer');
  if (!container || !['superadmin', 'admin'].includes(currentUser?.role)) return;

  if (typeof onChange === 'function') {
    window._depotFilterCallback = onChange;
  }

  const previousSelection = document.getElementById('depotFilterSelect')?.value || '';

  try {
    const res = await fetch(`${API}/depots`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.depots.length > 0) {
      // If admin, show their depot only (no All Depots option)
      if (currentUser?.role === 'admin') {
        const myDepot = data.depots.find(d => Number(d.depotId) === Number(currentUser.depotId));
        container.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px; 
                      background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:10px 16px;">
            <i class="fas fa-building" style="color:#0284c7;"></i>
            <lable style="font-weight:600; color:#0284c7; white-space:nowrap;">Viewing Depot:</lable>
            <span style="font-weight:600; color:#0369a1;">${myDepot ? `${myDepot.name} — ${myDepot.city}` : 'Assigned Depot'}</span>
          </div>
        `;
        // Ensure any callback receives the admin's depotId
        if (typeof onChange === 'function') onChange(String(currentUser.depotId || ''));
        return;
      }

      // Superadmin: show full depot selector with All option
      container.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px; 
                    background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:10px 16px;">
          <i class="fas fa-building" style="color:#0284c7;"></i>
          <lable style="font-weight:600; color:#0284c7; white-space:nowrap;">Viewing Depot:</lable>
          <select id="depotFilterSelect" onchange="onDepotFilterChange()" 
                  style="border:1px solid #bae6fd; border-radius:6px; padding:4px 10px; 
                         color:#0369a1; background:white; font-size:14px;">
            <option value="0">All Depots</option>
            ${data.depots.map(d => `<option value="${d.depotId}">${d.name} — ${d.city}</option>`).join('')}
          </select>
        </div>
      `;
      const select = document.getElementById('depotFilterSelect');
      if (select) {
         if (previousSelection) {
          select.value = previousSelection;
        } else {
          select.value = '0'; // Default to All Depots
        }
      }
      onDepotFilterChange();
    }
  } catch (err) {
    console.error('Error loading depots for filter:', err);
  }
}

function onDepotFilterChange() {
  const val = document.getElementById('depotFilterSelect')?.value || '';
  if (typeof window._depotFilterCallback === 'function') {
    window._depotFilterCallback(val);
  }
}

function getSelectedDepotId() {
  if (currentUser?.role === 'admin') return String(currentUser.depotId || '');
  if (!['superadmin', 'admin'].includes(currentUser?.role)) return '';
  const select = document.getElementById('depotFilterSelect');
  const val = select?.value || '';
  // treat '0' as empty (All Depots)
  return val === '0' ? '' : val;
}

function getSelectedDepotParam() {
  const depotId = getSelectedDepotId();
  return depotId ? `?depotId=${depotId}` : '';
}

function buildApiUrl(path, depotId = '') {
  const selected = depotId || getSelectedDepotId();
  return selected ? `${API}${path}?depotId=${selected}` : `${API}${path}`;
}

function requireSelectedDepotForCreate() {
  const depotId = getSelectedDepotId();
  if (!depotId) {
    return { ok: false, message: 'Select a depot from the filter above before creating records (or choose a specific depot instead of All Depots).' };
  }
  return { ok: true, depotId };
}

function formatRole(role) {
  const map = {
    superadmin: 'Super Admin',
    admin: 'Admin',
    supervisor: 'Supervisor',
    operator: 'Operator'
  };
  return map[role] || role;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-GB');
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}