const API = 'http://localhost:5000/api';
const token = localStorage.getItem('token');
let allRoutes = [];
let map = null;
let currentRouteLayer = null;
let markers = [];

if (!token) window.location.href = 'login.html';

document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadRoutes();
    initMap();
    setMinDate();
});

// Set minimum date to today
function setMinDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('assignDate').min = today;
    document.getElementById('assignDate').value = today;
}

// Load logged in user
async function loadUserInfo() {
    try {
        const res = await fetch(`${API}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.user) {
            document.getElementById('userName').textContent = data.user.name;
        }
    } catch (err) {
        console.error('Error loading user:', err);
    }
}

// Load all routes
async function loadRoutes() {
    try {
        const res = await fetch(`${API}/routes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            allRoutes = data.routes;
            displayRoutes(allRoutes);
            updateStats(allRoutes);
            loadMapRouteOptions(allRoutes);
        } else {
            showTableError('Failed to load routes.');
        }
    } catch (err) {
        showTableError('Server error. Make sure backend is running.');
    }
}

// Display routes in table
function displayRoutes(routes) {
    const tbody = document.getElementById('routesTableBody');

    if (!routes || routes.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="9">
                <div class="empty-state">
                    <i class="fas fa-route"></i>
                    <p>No routes found. Click Create Route to add one.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = routes.map((r, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${r.routeCode}</strong></td>
            <td>${r.startPoint} → ${r.endPoint}</td>
            <td>${r.totalDistance ? r.totalDistance + ' km' : '-'}</td>
            <td>${r.estimatedDuration ? r.estimatedDuration + ' min' : '-'}</td>
            <td><span class="route-badge badge-${r.routeType}">${formatRouteType(r.routeType)}</span></td>
            <td>${r.total_stops || 0}</td>
            <td><span class="status-badge status-${r.status}">${r.status === 'active' ? 'Active' : 'Inactive'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon view" onclick="viewRoute(${r.routeId})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon edit" onclick="editRoute(${r.routeId})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon assign" onclick="openAssignModal(${r.routeId})" title="Assign">
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="btn-icon map-btn" onclick="viewOnMap(${r.routeId})" title="View on Map">
                        <i class="fas fa-map-marked-alt"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteRoute(${r.routeId})" title="Deactivate">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Update stats
function updateStats(routes) {
    document.getElementById('totalRoutes').textContent = routes.length;
    document.getElementById('activeRoutes').textContent = routes.filter(r => r.status === 'active').length;
    document.getElementById('expressRoutes').textContent = routes.filter(r => r.routeType === 'express').length;
    document.getElementById('longDistanceRoutes').textContent = routes.filter(r => r.routeType === 'long_distance').length;
}

// Filter routes
function filterRoutes() {
    const search = document.getElementById('routeSearch').value.toLowerCase();
    const type = document.getElementById('routeTypeFilter').value;
    const status = document.getElementById('routeStatusFilter').value;

    let filtered = allRoutes;

    if (type !== 'all') filtered = filtered.filter(r => r.routeType === type);
    if (status !== 'all') filtered = filtered.filter(r => r.status === status);
    if (search) {
        filtered = filtered.filter(r =>
            r.routeCode.toLowerCase().includes(search) ||
            r.startPoint.toLowerCase().includes(search) ||
            r.endPoint.toLowerCase().includes(search)
        );
    }

    displayRoutes(filtered);
}

// Tab switching
function switchTab(tab) {
    document.getElementById('listTabContent').classList.toggle('active', tab === 'list');
    document.getElementById('mapTabContent').classList.toggle('active', tab === 'map');
    document.getElementById('listTab').classList.toggle('active', tab === 'list');
    document.getElementById('mapTab').classList.toggle('active', tab === 'map');

    if (tab === 'map' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

// Open add modal
function openRouteModal(route = null) {
    document.getElementById('routeForm').reset();
    document.getElementById('routeFormAlert').innerHTML = '';
    document.getElementById('stopsContainer').innerHTML = `
        <div class="stop-row">
            <input type="text" placeholder="Stop Name" class="stop-name">
            <input type="number" placeholder="Distance from start (km)" class="stop-distance" step="0.1">
            <button type="button" class="btn btn-danger btn-sm" onclick="removeStop(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    if (route) {
        document.getElementById('routeModalTitle').textContent = 'Edit Route';
        document.getElementById('routeId').value = route.routeId;
        document.getElementById('routeCode').value = route.routeCode;
        document.getElementById('startPoint').value = route.startPoint;
        document.getElementById('endPoint').value = route.endPoint;
        document.getElementById('totalDistance').value = route.totalDistance || '';
        document.getElementById('estimatedDuration').value = route.estimatedDuration || '';
        document.getElementById('routeType').value = route.routeType;
        document.getElementById('mapUrl').value = route.mapUrl || '';

        if (route.stops && route.stops.length > 0) {
            const container = document.getElementById('stopsContainer');
            container.innerHTML = '';
            route.stops.forEach(stop => {
                const div = document.createElement('div');
                div.className = 'stop-row';
                div.innerHTML = `
                    <input type="text" placeholder="Stop Name" class="stop-name" value="${stop.stopName}">
                    <input type="number" placeholder="Distance from start (km)" class="stop-distance" step="0.1" value="${stop.distanceFromStart || ''}">
                    <button type="button" class="btn btn-danger btn-sm" onclick="removeStop(this)">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                container.appendChild(div);
            });
        }
    } else {
        document.getElementById('routeModalTitle').textContent = 'Create Route';
        document.getElementById('routeId').value = '';
    }

    document.getElementById('routeModal').classList.add('open');
}

// Add stop row
function addStop() {
    const container = document.getElementById('stopsContainer');
    const div = document.createElement('div');
    div.className = 'stop-row';
    div.innerHTML = `
        <input type="text" placeholder="Stop Name" class="stop-name">
        <input type="number" placeholder="Distance from start (km)" class="stop-distance" step="0.1">
        <button type="button" class="btn btn-danger btn-sm" onclick="removeStop(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(div);
}

// Remove stop row
function removeStop(btn) {
    btn.parentElement.remove();
}

// Save route
async function saveRoute() {
    const routeId = document.getElementById('routeId').value;

    const stops = Array.from(document.querySelectorAll('.stop-row'))
        .map(row => ({
            stopName: row.querySelector('.stop-name').value.trim(),
            distanceFromStart: parseFloat(row.querySelector('.stop-distance').value) || null
        }))
        .filter(s => s.stopName);

    const body = {
        routeCode: document.getElementById('routeCode').value.trim(),
        startPoint: document.getElementById('startPoint').value.trim(),
        endPoint: document.getElementById('endPoint').value.trim(),
        totalDistance: parseFloat(document.getElementById('totalDistance').value) || null,
        estimatedDuration: parseInt(document.getElementById('estimatedDuration').value) || null,
        mapUrl: document.getElementById('mapUrl').value.trim() || null,
        routeType: document.getElementById('routeType').value,
        status: 'active',
        stops
    };

    if (!body.routeCode || !body.startPoint || !body.endPoint) {
        document.getElementById('routeFormAlert').innerHTML =
            '<div class="alert alert-error">Route code, start point and end point are required.</div>';
        return;
    }

    try {
        const url = routeId ? `${API}/routes/${routeId}` : `${API}/routes`;
        const method = routeId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (data.success) {
            closeRouteModal();
            loadRoutes();
        } else {
            document.getElementById('routeFormAlert').innerHTML =
                `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('routeFormAlert').innerHTML =
            '<div class="alert alert-error">Server error. Please try again.</div>';
    }
}

// Edit route
async function editRoute(id) {
    try {
        const res = await fetch(`${API}/routes/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success && data.route) {
            openRouteModal(data.route);
        }
    } catch (err) {
        alert('Failed to load route details.');
    }
}

// View route details
async function viewRoute(id) {
    try {
        const res = await fetch(`${API}/routes/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success && data.route) {
            const r = data.route;
            const stopsHtml = r.stops && r.stops.length > 0
                ? r.stops.map((s, i) => `
                    <div class="stop-item">
                        <span class="stop-number">${i + 1}</span>
                        <span>${s.stopName}</span>
                        <span style="color:#6b7280">${s.distanceFromStart ? s.distanceFromStart + ' km' : ''}</span>
                    </div>
                `).join('')
                : '<p style="color:#6b7280">No stops defined.</p>';

            document.getElementById('viewRouteContent').innerHTML = `
                <div class="detail-row">
                    <span class="detail-label">Route Code</span>
                    <span class="detail-value">${r.routeCode}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Start Point</span>
                    <span class="detail-value">${r.startPoint}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">End Point</span>
                    <span class="detail-value">${r.endPoint}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Distance</span>
                    <span class="detail-value">${r.totalDistance ? r.totalDistance + ' km' : 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Estimated Duration</span>
                    <span class="detail-value">${r.estimatedDuration ? r.estimatedDuration + ' minutes' : 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Route Type</span>
                    <span class="detail-value">
                        <span class="route-badge badge-${r.routeType}">${formatRouteType(r.routeType)}</span>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">
                        <span class="status-badge status-${r.status}">${r.status}</span>
                    </span>
                </div>
                <h3 style="margin: 20px 0 12px; font-size:16px;">
                    <i class="fas fa-map-pin"></i> Stops
                </h3>
                ${stopsHtml}
            `;

            document.getElementById('viewRouteModal').classList.add('open');
        }
    } catch (err) {
        alert('Failed to load route details.');
    }
}

// Delete route
async function deleteRoute(id) {
    if (!confirm('Are you sure you want to deactivate this route?')) return;

    try {
        const res = await fetch(`${API}/routes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            loadRoutes();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to deactivate route.');
    }
}

// Open assign modal
async function openAssignModal(routeId) {
    document.getElementById('assignRouteId').value = routeId;
    document.getElementById('assignAlert').innerHTML = '';

    try {
        const vehiclesRes = await fetch(`${API}/vehicles/available/for-assignment`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const driversRes = await fetch(`${API}/routes/available-drivers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const vehiclesData = await vehiclesRes.json();
        const driversData = await driversRes.json();

        const vehicleSelect = document.getElementById('assignVehicleId');
        const driverSelect = document.getElementById('assignDriverId');

        vehicleSelect.innerHTML = '<option value="">-- Select Vehicle --</option>';
        driverSelect.innerHTML = '<option value="">-- Select Driver --</option>';

        if (vehiclesData.success && vehiclesData.vehicles.length > 0) {
            vehiclesData.vehicles.forEach(v => {
                vehicleSelect.innerHTML += `
                    <option value="${v.vehicleId}">
                        ${v.registrationNo} - ${v.model} (${v.capacity} seats)
                    </option>`;
            });
        } else {
            vehicleSelect.innerHTML += '<option disabled>No vehicles available</option>';
        }

        if (driversData.success && driversData.drivers.length > 0) {
            driversData.drivers.forEach(d => {
                driverSelect.innerHTML += `
                    <option value="${d.driverId}" data-expiry="${d.daysUntilExpiry || 999}">
                        ${d.name} - ${d.licenseNo}
                        ${d.licenseStatus === 'Expiring Soon' ? '⚠️' : ''}
                    </option>`;
            });
        } else {
            driverSelect.innerHTML += '<option disabled>No drivers available</option>';
        }

        // License warning
        driverSelect.addEventListener('change', function () {
            const selected = this.options[this.selectedIndex];
            const days = selected.dataset.expiry;
            const warning = document.getElementById('licenseWarning');
            warning.style.display = days && days < 30 ? 'block' : 'none';
        });

        document.getElementById('assignModal').classList.add('open');

    } catch (err) {
        alert('Failed to load assignment options.');
    }
}

// Submit assignment
async function submitAssignment() {
    const routeId = document.getElementById('assignRouteId').value;
    const vehicleId = document.getElementById('assignVehicleId').value;
    const driverId = document.getElementById('assignDriverId').value;
    const scheduleDate = document.getElementById('assignDate').value;
    const departureTime = document.getElementById('assignDeparture').value + ':00';
    const arrivalTime = document.getElementById('assignArrival').value + ':00';

    if (!vehicleId || !driverId || !scheduleDate) {
        document.getElementById('assignAlert').innerHTML =
            '<div class="alert alert-error">Please select vehicle, driver and schedule date.</div>';
        return;
    }

    try {
        const res = await fetch(`${API}/routes/${routeId}/assign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ vehicleId, driverId, scheduleDate, departureTime, arrivalTime })
        });

        const data = await res.json();

        if (data.success) {
            closeAssignModal();
            loadRoutes();
            alert('✓ ' + data.message);
        } else {
            document.getElementById('assignAlert').innerHTML =
                `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('assignAlert').innerHTML =
            '<div class="alert alert-error">Assignment failed. Please try again.</div>';
    }
}

// Map functions
function initMap() {
    map = L.map('routeMap').setView([7.8731, 80.7718], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);
}

function loadMapRouteOptions(routes) {
    const select = document.getElementById('mapRouteSelect');
    select.innerHTML = '<option value="">-- Select a Route --</option>';
    routes.filter(r => r.status === 'active').forEach(r => {
        select.innerHTML += `<option value="${r.routeId}">${r.routeCode} - ${r.startPoint} → ${r.endPoint}</option>`;
    });
}

async function displayRouteOnMap() {
    const routeId = document.getElementById('mapRouteSelect').value;
    if (!routeId) return;

    try {
        const res = await fetch(`${API}/routes/${routeId}/map-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            if (currentRouteLayer) map.removeLayer(currentRouteLayer);
            markers.forEach(m => map.removeLayer(m));
            markers = [];

            const cityCoords = {
                'Colombo Fort': [6.9344, 79.8428],
                'Colombo': [6.9271, 79.8612],
                'Kandy': [7.2906, 80.6337],
                'Galle': [6.0328, 80.2168],
                'Negombo': [7.2088, 79.8359],
                'Kurunegala': [7.4863, 80.3642],
                'Anuradhapura': [8.3114, 80.4037],
                'Jaffna': [9.6615, 80.0255],
                'Ratnapura': [6.6828, 80.3991],
                'Badulla': [6.9934, 81.0561],
                'Kegalle': [7.1167, 80.3167],
                'Kadawatha': [7.0167, 79.9500],
                'Ambepussa': [7.1500, 80.1000],
                'Moratuwa': [6.7730, 79.8820],
                'Panadura': [6.7138, 79.9070],
                'Aluthgama': [6.4264, 80.0060],
                'Wattala': [6.9897, 79.8920],
                'Ja-Ela': [7.0742, 79.8917],
                'Peradeniya': [7.2667, 80.6000],
                'Nittambuwa': [7.1670, 80.0330]
            };

            const coords = [];
            const route = data.route;
            const stops = data.stops;

            if (cityCoords[route.startPoint]) {
                coords.push(cityCoords[route.startPoint]);
                const marker = L.marker(cityCoords[route.startPoint])
                    .bindPopup(`<b>Start: ${route.startPoint}</b>`)
                    .addTo(map);
                markers.push(marker);
            }

            stops.forEach((stop, i) => {
                if (cityCoords[stop.stopName]) {
                    coords.push(cityCoords[stop.stopName]);
                    const marker = L.marker(cityCoords[stop.stopName])
                        .bindPopup(`<b>Stop ${i + 1}: ${stop.stopName}</b><br>${stop.distanceFromStart || ''} km from start`)
                        .addTo(map);
                    markers.push(marker);
                }
            });

            if (cityCoords[route.endPoint]) {
                coords.push(cityCoords[route.endPoint]);
                const marker = L.marker(cityCoords[route.endPoint])
                    .bindPopup(`<b>End: ${route.endPoint}</b>`)
                    .addTo(map);
                markers.push(marker);
            }

            if (coords.length >= 2) {
                currentRouteLayer = L.polyline(coords, {
                    color: '#3b82f6',
                    weight: 4,
                    opacity: 0.8
                }).addTo(map);
                map.fitBounds(currentRouteLayer.getBounds(), { padding: [30, 30] });
            }

            const infoPanel = document.getElementById('routeInfo');
            infoPanel.style.display = 'block';
            infoPanel.innerHTML = `
                <div class="detail-row">
                    <span class="detail-label">Route</span>
                    <span class="detail-value">${route.routeCode} — ${route.startPoint} to ${route.endPoint}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Distance</span>
                    <span class="detail-value">${route.totalDistance || 'N/A'} km</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Duration</span>
                    <span class="detail-value">${route.estimatedDuration || 'N/A'} minutes</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Stops</span>
                    <span class="detail-value">${stops.map(s => s.stopName).join(' → ') || 'None'}</span>
                </div>
            `;
        }
    } catch (err) {
        alert('Failed to load map data.');
    }
}

function viewOnMap(routeId) {
    switchTab('map');
    setTimeout(() => {
        document.getElementById('mapRouteSelect').value = routeId;
        displayRouteOnMap();
    }, 200);
}

// Close modals
function closeRouteModal() { document.getElementById('routeModal').classList.remove('open'); }
function closeViewRouteModal() { document.getElementById('viewRouteModal').classList.remove('open'); }
function closeAssignModal() { document.getElementById('assignModal').classList.remove('open'); }

// Helpers
function formatRouteType(type) {
    const map = {
        urban: 'Urban',
        rural: 'Rural',
        long_distance: 'Long Distance',
        express: 'Express'
    };
    return map[type] || type;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
}

function showTableError(msg) {
    document.getElementById('routesTableBody').innerHTML =
        `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div></td></tr>`;
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}