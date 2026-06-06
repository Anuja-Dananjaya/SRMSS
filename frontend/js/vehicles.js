
const API = 'http://localhost:5000/api';
const token = localStorage.getItem('token');
let allVehicles = [];

// Redirect to login if no token
if (!token) window.location.href = 'login.html';

// Load on page ready
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadVehicles();
});

// Load logged in user name
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

// Load all vehicles
async function loadVehicles() {
    try {
        const res = await fetch(`${API}/vehicles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            allVehicles = data.vehicles;
            displayVehicles(allVehicles);
            updateStats(allVehicles);
        } else {
            showTableError('Failed to load vehicles.');
        }
    } catch (err) {
        showTableError('Server error. Make sure backend is running.');
    }
}

// Display vehicles in table
function displayVehicles(vehicles) {
    const tbody = document.getElementById('vehiclesTableBody');

    if (!vehicles || vehicles.length === 0) {
        tbody.innerHTML = `
                    <tr><td colspan="9">
                        <div class="empty-state">
                            <i class="fas fa-bus"></i>
                            <p>No vehicles found. Click Add Vehicle to create one.</p>
                        </div>
                    </td></tr>`;
        return;
    }

    tbody.innerHTML = vehicles.map((v, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${v.registrationNo}</strong></td>
                    <td>${v.model}</td>
                    <td>${v.capacity} seats</td>
                    <td>${Number(v.mileage || 0).toLocaleString()}</td>
                    <td>${v.fuelEfficiency ? v.fuelEfficiency + ' km/L' : '-'}</td>
                    <td>${v.last_maintenance_date ? formatDate(v.last_maintenance_date) : '-'}</td>
                    <td><span class="status-badge status-${v.status}">${formatStatus(v.status)}</span></td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-icon view" onclick="viewVehicle(${v.vehicleId})" title="View">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon edit" onclick="editVehicle(${v.vehicleId})" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon status" onclick="openStatusModal(${v.vehicleId}, '${v.status}')" title="Update Status">
                                <i class="fas fa-exchange-alt"></i>
                            </button>
                            <button class="btn-icon delete" onclick="deleteVehicle(${v.vehicleId})" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
}

// Update stat cards
function updateStats(vehicles) {
    document.getElementById('totalVehicles').textContent = vehicles.length;
    document.getElementById('activeVehicles').textContent = vehicles.filter(v => v.status === 'active').length;
    document.getElementById('maintenanceVehicles').textContent = vehicles.filter(v => v.status === 'maintenance').length;
    const totalMileage = vehicles.reduce((sum, v) => sum + Number(v.mileage || 0), 0);
    document.getElementById('totalMileage').textContent = totalMileage.toLocaleString();
}

// Filter vehicles
function filterVehicles() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;

    let filtered = allVehicles;

    if (status !== 'all') {
        filtered = filtered.filter(v => v.status === status);
    }

    if (search) {
        filtered = filtered.filter(v =>
            v.registrationNo.toLowerCase().includes(search) ||
            v.model.toLowerCase().includes(search)
        );
    }

    displayVehicles(filtered);
}

// Open add modal
function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Add Vehicle';
    document.getElementById('vehicleId').value = '';
    document.getElementById('vehicleForm').reset();
    document.getElementById('formAlert').innerHTML = '';
    document.getElementById('vehicleModal').classList.add('open');
}

// Open edit modal
async function editVehicle(id) {
    try {
        const res = await fetch(`${API}/vehicles/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success && data.vehicle) {
            const v = data.vehicle;
            document.getElementById('modalTitle').textContent = 'Edit Vehicle';
            document.getElementById('vehicleId').value = v.vehicleId;
            document.getElementById('registrationNo').value = v.registrationNo;
            document.getElementById('model').value = v.model;
            document.getElementById('capacity').value = v.capacity;
            document.getElementById('mileage').value = v.mileage;
            document.getElementById('fuelEfficiency').value = v.fuelEfficiency || '';
            document.getElementById('status').value = v.status;
            document.getElementById('formAlert').innerHTML = '';
            document.getElementById('vehicleModal').classList.add('open');
        }
    } catch (err) {
        alert('Failed to load vehicle details.');
    }
}

// Save vehicle (create or update)
async function saveVehicle() {
    const vehicleId = document.getElementById('vehicleId').value;
    const body = {
        registrationNo: document.getElementById('registrationNo').value,
        model: document.getElementById('model').value,
        capacity: parseInt(document.getElementById('capacity').value),
        mileage: parseFloat(document.getElementById('mileage').value) || 0,
        fuelEfficiency: parseFloat(document.getElementById('fuelEfficiency').value) || null,
        status: document.getElementById('status').value
    };

    if (!body.registrationNo || !body.model || !body.capacity) {
        document.getElementById('formAlert').innerHTML =
            '<div class="alert alert-error">Registration number, model and capacity are required.</div>';
        return;
    }

    try {
        const url = vehicleId ? `${API}/vehicles/${vehicleId}` : `${API}/vehicles`;
        const method = vehicleId ? 'PUT' : 'POST';

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
            closeVehicleModal();
            loadVehicles();
        } else {
            document.getElementById('formAlert').innerHTML =
                `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('formAlert').innerHTML =
            '<div class="alert alert-error">Server error. Please try again.</div>';
    }
}

// View vehicle details
async function viewVehicle(id) {
    try {
        const res = await fetch(`${API}/vehicles/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success && data.vehicle) {
            const v = data.vehicle;
            let maintHtml = '';

            if (v.maintenance_history && v.maintenance_history.length > 0) {
                maintHtml = v.maintenance_history.map(m => `
                            <div class="maintenance-item">
                                <h4>${m.maintenanceType} — ${formatDate(m.serviceDate)}</h4>
                                <p>${m.description || 'No description'} — Cost: Rs. ${m.cost || 0}</p>
                            </div>
                        `).join('');
            } else {
                maintHtml = '<p style="color:#6b7280">No maintenance records found.</p>';
            }

            document.getElementById('viewVehicleContent').innerHTML = `
                        <div class="detail-row">
                            <span class="detail-label">Registration No</span>
                            <span class="detail-value">${v.registrationNo}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Model</span>
                            <span class="detail-value">${v.model}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Capacity</span>
                            <span class="detail-value">${v.capacity} seats</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Mileage</span>
                            <span class="detail-value">${Number(v.mileage || 0).toLocaleString()} km</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Fuel Efficiency</span>
                            <span class="detail-value">${v.fuelEfficiency ? v.fuelEfficiency + ' km/L' : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">
                                <span class="status-badge status-${v.status}">${formatStatus(v.status)}</span>
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Total Maintenance Records</span>
                            <span class="detail-value">${v.total_maintenance || 0}</span>
                        </div>
                        <h3 style="margin: 20px 0 12px; font-size:16px;">Maintenance History</h3>
                        ${maintHtml}
                    `;

            document.getElementById('viewVehicleModal').classList.add('open');
        }
    } catch (err) {
        alert('Failed to load vehicle details.');
    }
}

// Open status modal
function openStatusModal(id, currentStatus) {
    document.getElementById('statusVehicleId').value = id;
    document.getElementById('newStatus').value = currentStatus;
    document.getElementById('statusModal').classList.add('open');
}

// Save status
async function saveStatus() {
    const id = document.getElementById('statusVehicleId').value;
    const status = document.getElementById('newStatus').value;

    try {
        const res = await fetch(`${API}/vehicles/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        const data = await res.json();

        if (data.success) {
            closeStatusModal();
            loadVehicles();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to update status.');
    }
}

// Delete vehicle
async function deleteVehicle(id) {
    if (!confirm('Are you sure you want to deactivate this vehicle?')) return;

    try {
        const res = await fetch(`${API}/vehicles/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            loadVehicles();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to delete vehicle.');
    }
}

// Export CSV
function exportCSV() {
    let csv = 'ID,Registration,Model,Capacity,Mileage,Fuel Efficiency,Status\n';
    allVehicles.forEach(v => {
        csv += `${v.vehicleId},${v.registrationNo},${v.model},${v.capacity},${v.mileage},${v.fuelEfficiency || ''},${v.status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicles_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Close modals
function closeVehicleModal() { document.getElementById('vehicleModal').classList.remove('open'); }
function closeViewModal() { document.getElementById('viewVehicleModal').classList.remove('open'); }
function closeStatusModal() { document.getElementById('statusModal').classList.remove('open'); }

// Helpers
function formatStatus(status) {
    const map = { active: 'Active', maintenance: 'Maintenance', inactive: 'Inactive' };
    return map[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
}

function showTableError(msg) {
    document.getElementById('vehiclesTableBody').innerHTML =
        `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div></td></tr>`;
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}
