const API_BASE = 'http://localhost:5000/api';
const token = localStorage.getItem('token');
let map = null;
let currentRouteLayer = null;

if (!token) window.location.href = 'login.html';

document.addEventListener('DOMContentLoaded', () => { loadRoutes(); loadUserInfo(); initializeMap(); });

async function loadUserInfo() {
    try {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) document.getElementById('userName').textContent = data.user.name;
    } catch(e) { console.error(e); }
}

function initializeMap() {
    map = L.map('routeMap').setView([7.8731, 80.7718], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM' }).addTo(map);
}

async function loadRoutes() {
    try {
        const res = await fetch(`${API_BASE}/routes`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) { displayRoutes(data.routes); updateRouteStats(data.routes); loadRouteSelectOptions(data.routes); }
    } catch(e) { alert('Failed to load routes'); }
}

function displayRoutes(routes) {
    const tbody = document.getElementById('routesTableBody');
    if (!routes.length) { tbody.innerHTML = '<tr><td colspan="8" class="text-center">No routes found</td></tr>'; return; }
    tbody.innerHTML = routes.map(r => `
        <tr>
            <td><strong>${r.routeCode}</strong></td>
            <td>${r.startPoint} → ${r.endPoint}</td>
            <td>${r.totalDistance || '-'} km</td>
            <td>${r.estimatedDuration || '-'} min</td>
            <td><span class="badge badge-${r.routeType}">${r.routeType}</span></td>
            <td>${r.total_stops || 0}</td>
            <td><span class="status-badge status-${r.status}">${r.status === 'active' ? 'Active' : 'Inactive'}</span></td>
            <td class="actions">
                <button class="btn-icon" onclick="viewRouteOnMap(${r.routeId})" title="View Map"><i class="fas fa-map-marked-alt"></i></button>
                <button class="btn-icon" onclick="editRoute(${r.routeId})" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="assignToRoute(${r.routeId})" title="Assign"><i class="fas fa-user-plus"></i></button>
            </td>
        </tr>
    `).join('');
}

function updateRouteStats(routes) {
    document.getElementById('totalRoutes').textContent = routes.length;
    document.getElementById('activeRoutes').textContent = routes.filter(r => r.status === 'active').length;
    document.getElementById('expressRoutes').textContent = routes.filter(r => r.routeType === 'express').length;
}

function loadRouteSelectOptions(routes) {
    const select = document.getElementById('mapRouteSelect');
    select.innerHTML = '<option value="">-- Select Route --</option>' + routes.filter(r => r.status === 'active').map(r => `<option value="${r.routeId}">${r.routeCode} - ${r.startPoint} to ${r.endPoint}</option>`).join('');
}

async function displayRouteOnMap() {
    const routeId = document.getElementById('mapRouteSelect').value;
    if (!routeId) return;
    try {
        const res = await fetch(`${API_BASE}/routes/${routeId}/map-data`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success && data.stops) {
            if (currentRouteLayer) map.removeLayer(currentRouteLayer);
            const latLngs = [];
            data.stops.forEach(stop => { if (stop.latitude && stop.longitude) latLngs.push([stop.latitude, stop.longitude]); });
            document.getElementById('routeInfo').style.display = 'block';
            document.getElementById('routeInfo').innerHTML = `<h3>${data.route.routeCode}</h3><p>${data.route.startPoint} → ${data.route.endPoint}</p><p>Distance: ${data.route.totalDistance || 'N/A'} km | Type: ${data.route.routeType}</p><p><strong>Stops:</strong> ${data.stops.map(s => s.stopName).join(' → ')}</p><p><em>Note: For full map visualization, add latitude/longitude to route_stops table</em></p>`;
        } else { alert('No stop data for this route'); }
    } catch(e) { alert('Failed to load map data'); }
}

async function viewRouteOnMap(routeId) {
    switchTab('map');
    setTimeout(() => { document.getElementById('mapRouteSelect').value = routeId; displayRouteOnMap(); }, 100);
}

function switchTab(tab) {
    document.getElementById('listTab').classList.toggle('active', tab === 'list');
    document.getElementById('mapTab').classList.toggle('active', tab === 'map');
    document.querySelectorAll('.tab-btn').forEach((btn, i) => btn.classList.toggle('active', (tab === 'list' && i === 0) || (tab === 'map' && i === 1)));
    if (tab === 'map' && map) setTimeout(() => map.invalidateSize(), 100);
}

function addStop() {
    const container = document.getElementById('stopsContainer');
    const div = document.createElement('div');
    div.className = 'stop-row';
    div.innerHTML = `<input type="text" placeholder="Stop Name" class="stop-name"><input type="text" placeholder="Distance (km)" class="stop-distance"><button type="button" onclick="removeStop(this)" class="btn-danger-small">✕</button>`;
    container.appendChild(div);
}

function removeStop(btn) { btn.parentElement.remove(); }

function openRouteModal(route = null) {
    const modal = document.getElementById('routeModal');
    document.getElementById('routeForm').reset();
    document.getElementById('stopsContainer').innerHTML = '<div class="stop-row"><input type="text" placeholder="Stop Name" class="stop-name"><input type="text" placeholder="Distance (km)" class="stop-distance"><button type="button" onclick="removeStop(this)" class="btn-danger-small">✕</button></div>';
    if (route) {
        document.getElementById('routeModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Route';
        document.getElementById('routeId').value = route.routeId;
        document.getElementById('routeCode').value = route.routeCode;
        document.getElementById('startPoint').value = route.startPoint;
        document.getElementById('endPoint').value = route.endPoint;
        document.getElementById('totalDistance').value = route.totalDistance;
        document.getElementById('estimatedDuration').value = route.estimatedDuration;
        document.getElementById('routeType').value = route.routeType;
        document.getElementById('mapUrl').value = route.mapUrl || '';
        if (route.stops && route.stops.length) {
            const container = document.getElementById('stopsContainer');
            container.innerHTML = '';
            route.stops.forEach(stop => {
                const div = document.createElement('div');
                div.className = 'stop-row';
                div.innerHTML = `<input type="text" placeholder="Stop Name" class="stop-name" value="${stop.stopName}"><input type="text" placeholder="Distance (km)" class="stop-distance" value="${stop.distanceFromStart || ''}"><button type="button" onclick="removeStop(this)" class="btn-danger-small">✕</button>`;
                container.appendChild(div);
            });
        }
    } else {
        document.getElementById('routeModalTitle').innerHTML = '<i class="fas fa-plus"></i> Create Route';
        document.getElementById('routeId').value = '';
    }
    modal.style.display = 'flex';
}

function closeRouteModal() { document.getElementById('routeModal').style.display = 'none'; }

document.getElementById('routeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const routeId = document.getElementById('routeId').value;
    const stops = Array.from(document.querySelectorAll('.stop-row')).map((row, idx) => ({ stopName: row.querySelector('.stop-name').value, distanceFromStart: row.querySelector('.stop-distance').value || null })).filter(s => s.stopName);
    const routeData = {
        routeCode: document.getElementById('routeCode').value,
        startPoint: document.getElementById('startPoint').value,
        endPoint: document.getElementById('endPoint').value,
        totalDistance: parseFloat(document.getElementById('totalDistance').value) || null,
        estimatedDuration: parseInt(document.getElementById('estimatedDuration').value) || null,
        mapUrl: document.getElementById('mapUrl').value || null,
        routeType: document.getElementById('routeType').value,
        status: 'active',
        stops
    };
    try {
        let res;
        if (routeId) res = await fetch(`${API_BASE}/routes/${routeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(routeData) });
        else res = await fetch(`${API_BASE}/routes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(routeData) });
        const data = await res.json();
        if (data.success) { closeRouteModal(); loadRoutes(); alert('✓ ' + data.message); }
        else alert('✗ ' + data.message);
    } catch(e) { alert('✗ Failed to save route'); }
});

async function editRoute(id) {
    try {
        const res = await fetch(`${API_BASE}/routes/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) openRouteModal(data.route);
    } catch(e) { alert('Failed to load route'); }
}

async function assignToRoute(routeId) {
    try {
        const vehiclesRes = await fetch(`${API_BASE}/vehicles/available/for-assignment`, { headers: { 'Authorization': `Bearer ${token}` } });
        const driversRes = await fetch(`${API_BASE}/routes/available-drivers`, { headers: { 'Authorization': `Bearer ${token}` } });
        const vehicles = await vehiclesRes.json();
        const drivers = await driversRes.json();
        document.getElementById('assignContent').innerHTML = `
            <input type="hidden" id="assignRouteId" value="${routeId}">
            <div class="form-group"><label>Select Vehicle:</label><select id="assignVehicleId"><option value="">-- Select --</option>${vehicles.success ? vehicles.vehicles.map(v => `<option value="${v.vehicleId}">${v.registrationNo} - ${v.model} (${v.capacity} seats)</option>`).join('') : ''}</select></div>
            <div class="form-group"><label>Select Driver:</label><select id="assignDriverId"><option value="">-- Select --</option>${drivers.success ? drivers.drivers.map(d => `<option value="${d.driverId}">${d.name} - ${d.licenseNo}</option>`).join('') : ''}</select></div>
            <div class="form-group"><label>Schedule Date:</label><input type="date" id="assignDate"></div>
            <div class="form-actions"><button onclick="closeAssignModal()" class="btn-secondary">Cancel</button><button onclick="submitAssignment()" class="btn-primary">Assign</button></div>`;
        document.getElementById('assignModal').style.display = 'flex';
    } catch(e) { alert('Failed to load assignment options'); }
}

async function submitAssignment() {
    const routeId = document.getElementById('assignRouteId').value;
    const vehicleId = document.getElementById('assignVehicleId').value;
    const driverId = document.getElementById('assignDriverId').value;
    const scheduleDate = document.getElementById('assignDate').value;
    if (!vehicleId || !driverId || !scheduleDate) { alert('Please fill all fields'); return; }
    try {
        const res = await fetch(`${API_BASE}/routes/${routeId}/assign`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ vehicleId, driverId, scheduleDate, departureTime: '08:00:00', arrivalTime: '17:00:00' })
        });
        const data = await res.json();
        if (data.success) { closeAssignModal(); alert('✓ ' + data.message); }
        else alert('✗ ' + data.message);
    } catch(e) { alert('Assignment failed'); }
}

function closeAssignModal() { document.getElementById('assignModal').style.display = 'none'; }

function filterRoutes() {
    const type = document.getElementById('routeTypeFilter').value;
    const search = document.getElementById('routeSearch').value.toLowerCase();
    fetch(`${API_BASE}/routes`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()).then(data => {
        if (data.success) {
            let filtered = data.routes;
            if (type !== 'all') filtered = filtered.filter(r => r.routeType === type);
            if (search) filtered = filtered.filter(r => r.routeCode.toLowerCase().includes(search) || r.startPoint.toLowerCase().includes(search) || r.endPoint.toLowerCase().includes(search));
            displayRoutes(filtered);
        }
    });
}

function logout() { localStorage.removeItem('token'); window.location.href = 'login.html'; }