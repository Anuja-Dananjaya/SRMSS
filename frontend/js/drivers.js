const API = 'http://localhost:5001/api';
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let allDrivers = [];
let allDepotsForDrivers = [];

// Redirect if not logged in
if (!token) window.location.href = 'login.html';

document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadDrivers();
    loadDepotsForDropdown();
    checkRole();
});

// Hide add button for non admin
function checkRole() {
    if (currentUser.role !== 'admin') {
        document.getElementById('addDriverBtn').style.display = 'none';
    }
}

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
        console.error('Error loading user info:', err);
    }
}

// Load all drivers
async function loadDrivers() {
    try {
        const res = await fetch(`${API}/drivers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.drivers) {
            allDrivers = data.drivers;
            displayDrivers(allDrivers);
            updateStats(allDrivers);
        } else {
            showTableError('Failed to load drivers.');
        }
    } catch (err) {
        showTableError('Server error. Make sure backend is running.');
    }
}

// Load active depots for dropdown
async function loadDepotsForDropdown() {
    try {
        const res = await fetch(`${API}/depots?status=active`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allDepotsForDrivers = data.depots;
            const select = document.getElementById('driverDepotId');
            select.innerHTML = '<option value="">-- No Depot --</option>' +
                data.depots.map(d => `<option value="${d.depotId}">${d.name}${d.location ? ' - ' + d.location : ''}</option>`).join('');
        }
    } catch (err) {
        console.error('Failed to load depots:', err);
    }
}

// Display drivers in table
function displayDrivers(drivers) {
    const tbody = document.getElementById('driversTableBody');

    if (!drivers || drivers.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="8">
                <div class="empty-state">
                    <i class="fas fa-id-card"></i>
                    <p>No drivers found. Click Add Driver to create one.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = drivers.map((d, i) => {
        const licenseExpiry = new Date(d.licenseExpiry);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((licenseExpiry - today) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        const isExpired = daysUntilExpiry <= 0;

        return `
        <tr>
            <td>${i + 1}</td>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="user-avatar">${d.name.charAt(0).toUpperCase()}</div>
                    <strong>${d.name}</strong>
                </div>
            </td>
            <td>${d.licenseNo}</td>
            <td>
                ${formatDate(d.licenseExpiry)}
                ${isExpired ? '<span class="license-badge expired"><i class="fas fa-times-circle"></i> Expired</span>' : ''}
                ${isExpiringSoon ? '<span class="license-badge expiring"><i class="fas fa-exclamation-triangle"></i> Expiring Soon</span>' : ''}
            </td>
            <td>${d.phone || '-'}</td>
            <td>${d.maxHoursPerDay || 8} hrs</td>
            <td><span class="status-badge status-driver-${d.status}">${formatStatus(d.status)}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon view" onclick="viewDriver(${d.driverId})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${currentUser.role === 'admin' ? `
                    <button class="btn-icon edit" onclick="editDriver(${d.driverId})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>` : ''}
                    <button class="btn-icon status" onclick="openStatusModal(${d.driverId}, '${d.status}')" title="Update Status">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                    ${currentUser.role === 'admin' ? `
                    <button class="btn-icon delete" onclick="openDeactivateModal(${d.driverId}, '${d.name}')" title="Deactivate">
                        <i class="fas fa-user-slash"></i>
                    </button>` : ''}
                </div>
            </td>
        </tr>
    `}).join('');
}

// Update stats
function updateStats(drivers) {
    const today = new Date();
    const expiringSoon = drivers.filter(d => {
        const expiry = new Date(d.licenseExpiry);
        const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        return days <= 30 && days > 0;
    }).length;

    document.getElementById('totalDrivers').textContent = drivers.length;
    document.getElementById('availableDrivers').textContent = drivers.filter(d => d.status === 'available').length;
    document.getElementById('onTripDrivers').textContent = drivers.filter(d => d.status === 'on_trip').length;
    document.getElementById('expiringLicenses').textContent = expiringSoon;
}

// Filter drivers
function filterDrivers() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;

    let filtered = allDrivers;

    if (status !== 'all') {
        filtered = filtered.filter(d => d.status === status);
    }

    if (search) {
        filtered = filtered.filter(d =>
            d.name.toLowerCase().includes(search) ||
            d.licenseNo.toLowerCase().includes(search)
        );
    }

    displayDrivers(filtered);
}

// Open add modal
function openAddModal() {
    document.getElementById('driverModalTitle').textContent = 'Add Driver';
    document.getElementById('driverId').value = '';
    document.getElementById('driverForm').reset();
    document.getElementById('driverFormAlert').innerHTML = '';
    document.getElementById('maxHoursPerDay').value = '8';
    document.getElementById('driverModal').classList.add('open');
}

// Edit driver
async function editDriver(id) {
    try {
        const res = await fetch(`${API}/drivers/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.driver) {
            const d = data.driver;
            document.getElementById('driverModalTitle').textContent = 'Edit Driver';
            document.getElementById('driverId').value = d.driverId;
            document.getElementById('name').value = d.name;
            document.getElementById('licenseNo').value = d.licenseNo;
            document.getElementById('licenseExpiry').value = d.licenseExpiry
                ? d.licenseExpiry.split('T')[0] : '';
            document.getElementById('phone').value = d.phone || '';
            document.getElementById('address').value = d.address || '';
            document.getElementById('maxHoursPerDay').value = d.maxHoursPerDay || 8;
            document.getElementById('driverDepotId').value = d.depotId || '';
            document.getElementById('driverFormAlert').innerHTML = '';
            document.getElementById('driverModal').classList.add('open');
        }
    } catch (err) {
        alert('Failed to load driver details.');
    }
}

// Save driver
async function saveDriver() {
    const driverId = document.getElementById('driverId').value;
    const name = document.getElementById('name').value.trim();
    const licenseNo = document.getElementById('licenseNo').value.trim();
    const licenseExpiry = document.getElementById('licenseExpiry').value;
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const maxHoursPerDay = document.getElementById('maxHoursPerDay').value;
    const depotId = document.getElementById('driverDepotId').value || null;

    if (!name || !licenseNo || !licenseExpiry) {
        document.getElementById('driverFormAlert').innerHTML =
            '<div class="alert alert-error">Name, license number and expiry date are required.</div>';
        return;
    }

    const body = { name, licenseNo, licenseExpiry, phone, address, maxHoursPerDay, depotId: depotId ? parseInt(depotId) : null };

    try {
        const url = driverId ? `${API}/drivers/${driverId}` : `${API}/drivers`;
        const method = driverId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (res.ok) {
            closeDriverModal();
            loadDrivers();
        } else {
            document.getElementById('driverFormAlert').innerHTML =
                `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('driverFormAlert').innerHTML =
            '<div class="alert alert-error">Server error. Please try again.</div>';
    }
}

// View driver details
async function viewDriver(id) {
    try {
        const res = await fetch(`${API}/drivers/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.driver) {
            const d = data.driver;
            const licenseExpiry = new Date(d.licenseExpiry);
            const today = new Date();
            const daysUntilExpiry = Math.ceil((licenseExpiry - today) / (1000 * 60 * 60 * 24));

            let licenseStatus = '<span style="color:#16a34a">Valid</span>';
            if (daysUntilExpiry <= 0) {
                licenseStatus = '<span style="color:#dc2626">Expired</span>';
            } else if (daysUntilExpiry <= 30) {
                licenseStatus = `<span style="color:#d97706">Expiring in ${daysUntilExpiry} days</span>`;
            }

            document.getElementById('viewDriverContent').innerHTML = `
                <div style="text-align:center; margin-bottom:20px;">
                    <div class="user-avatar-large">${d.name.charAt(0).toUpperCase()}</div>
                    <h3 style="margin-top:12px; color:#1f2937;">${d.name}</h3>
                    <span class="status-badge status-driver-${d.status}">${formatStatus(d.status)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">License Number</span>
                    <span class="detail-value">${d.licenseNo}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">License Expiry</span>
                    <span class="detail-value">${formatDate(d.licenseExpiry)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">License Status</span>
                    <span class="detail-value">${licenseStatus}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${d.phone || 'Not provided'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Address</span>
                    <span class="detail-value">${d.address || 'Not provided'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Max Hours Per Day</span>
                    <span class="detail-value">${d.maxHoursPerDay || 8} hours</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Registered</span>
                    <span class="detail-value">${formatDate(d.createdAt)}</span>
                </div>
            `;
            document.getElementById('viewDriverModal').classList.add('open');
        }
    } catch (err) {
        alert('Failed to load driver details.');
    }
}

// Open status modal
function openStatusModal(id, currentStatus) {
    document.getElementById('statusDriverId').value = id;
    document.getElementById('newStatus').value = currentStatus;
    document.getElementById('statusModal').classList.add('open');
}

// Save status
async function saveStatus() {
    const id = document.getElementById('statusDriverId').value;
    const status = document.getElementById('newStatus').value;

    try {
        const res = await fetch(`${API}/drivers/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        const data = await res.json();

        if (res.ok) {
            closeStatusModal();
            loadDrivers();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to update status.');
    }
}

// Open deactivate modal
function openDeactivateModal(id, name) {
    document.getElementById('deactivateDriverId').value = id;
    document.getElementById('deactivateDriverName').textContent = name;
    document.getElementById('deactivateModal').classList.add('open');
}

// Confirm deactivate
async function confirmDeactivate() {
    const id = document.getElementById('deactivateDriverId').value;

    try {
        const res = await fetch(`${API}/drivers/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
            closeDeactivateModal();
            loadDrivers();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to deactivate driver.');
    }
}

// Close modals
function closeDriverModal() { document.getElementById('driverModal').classList.remove('open'); }
function closeViewModal() { document.getElementById('viewDriverModal').classList.remove('open'); }
function closeStatusModal() { document.getElementById('statusModal').classList.remove('open'); }
function closeDeactivateModal() { document.getElementById('deactivateModal').classList.remove('open'); }

// Helpers
function formatStatus(status) {
    const map = {
        available: 'Available',
        on_trip: 'On Trip',
        unavailable: 'Unavailable'
    };
    return map[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
}

function showTableError(msg) {
    document.getElementById('driversTableBody').innerHTML =
        `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div></td></tr>`;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}