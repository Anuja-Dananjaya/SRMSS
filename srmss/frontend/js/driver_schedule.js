const DS_API = (typeof API !== 'undefined') ? API : 'http://localhost:5001/api';
const DS_TOKEN = (typeof token !== 'undefined') ? token : localStorage.getItem('token');

async function loadMyTrips() {
  const container = document.getElementById('tripsContainer');
  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading your assigned trips...</p></div>';

  try {
    const res = await fetch(`${DS_API}/schedules/my`, { headers: { 'Authorization': `Bearer ${DS_TOKEN}` } });
    const data = await res.json();
    if (!data.success) {
      container.innerHTML = `<div class="empty-state"><p>${data.message || 'Failed to load trips.'}</p></div>`;
      return;
    }

    const schedules = data.schedules || [];
    if (schedules.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>No trips assigned.</p></div>`;
      return;
    }

    container.innerHTML = schedules.map(s => renderTripCard(s)).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="empty-state"><p>Error loading trips.</p></div>`;
  }
}

function renderTripCard(s) {
  const statusBadge = `<span class="trip-status ${s.status}">${capitalize(s.status)}</span>`;
  const startBtn = `<button class="btn btn-success" onclick="startTrip(${s.scheduleId})">Start Trip</button>`;
  const endBtn = `<button class="btn btn-danger" onclick="endTrip(${s.scheduleId})">End Trip</button>`;

  // Show appropriate action: if scheduled -> show Start; if ongoing -> show End; if completed -> none
  let actions = '';
  if (s.status === 'scheduled') actions = startBtn;
  else if (s.status === 'ongoing') actions = endBtn;

  return `
    <div class="trip-card">
      <div class="trip-card-header">
          <div>
            <strong>${s.routeCode || 'Route'}</strong>
            <div class="meta">${s.startPoint || ''} → ${s.endPoint || ''} • ${formatDate(s.scheduleDate)}</div>
          </div>
        <div style="display:flex; align-items:center; gap:10px;">
          ${statusBadge}
        </div>
      </div>
      <div class="trip-card-body">
        <div style="display:flex; gap:18px; align-items:center; flex-wrap:wrap;">
          <div class="muted">Bus: <span style="font-weight:700;">${s.registrationNo || '-'}</span></div>
          <div class="muted">Departure: <span style="font-weight:700;">${s.departureTime || '-'}</span></div>
          <div class="muted">Arrival: <span style="font-weight:700;">${s.arrivalTime || '-'}</span></div>
        </div>
      </div>
      <div class="trip-card-footer">
        ${actions}
      </div>
    </div>
  `;
}

function statusColor(status) {
  switch (status) {
    case 'scheduled': return '#10b981'; // green
    case 'ongoing': return '#047857';
    case 'completed': return '#6b7280';
    case 'delayed': return '#f59e0b';
    case 'cancelled': return '#ef4444';
    default: return '#6b7280';
  }
}

function capitalize(s) { if (!s) return ''; return s.charAt(0).toUpperCase() + s.slice(1); }

async function startTrip(id) {
  if (!confirm(`Start this trip now? ${id}`)) return;
  try {
    const res = await fetch(`${DS_API}/schedules/${id}/start`, { method: 'POST', headers: { 'Authorization': `Bearer ${DS_TOKEN}`, 'Content-Type':'application/json' } });
    const data = await res.json();
    if (data.success) {
      alert('Trip started');
      // If server returned the updated vehicle, store it so other pages can apply it immediately
      try {
        if (data.vehicle) localStorage.setItem('vehicleUpdate', JSON.stringify(data.vehicle));
        localStorage.setItem('vehiclesRefresh', Date.now().toString());
      } catch (e){}
      loadMyTrips();
    } else {
      alert(data.message || 'Failed to start trip');
    }
  } catch (err) {
    console.error(err);
    alert('Failed to start trip');
  }
}

async function endTrip(id) {
  if (!confirm(`End this trip now?${id}`)) return;
  try {
    const res = await fetch(`${DS_API}/schedules/${id}/end`, { method: 'POST', headers: { 'Authorization': `Bearer ${DS_TOKEN}`, 'Content-Type':'application/json' } });
    const data = await res.json();
    if (data.success) {
      alert('Trip ended');
      try {
        if (data.vehicle) localStorage.setItem('vehicleUpdate', JSON.stringify(data.vehicle));
        localStorage.setItem('vehiclesRefresh', Date.now().toString());
      } catch (e){}
      loadMyTrips();
    } else {
      alert(data.message || 'Failed to end trip');
    }
  } catch (err) {
    console.error(err);
    alert('Failed to end trip');
  }
}

function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('en-GB'); }
