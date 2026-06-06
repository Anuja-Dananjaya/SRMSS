const API = 'http://localhost:5001/api';
const token = localStorage.getItem('token');
let allMaintenance = [];
let allVehicles = [];

if (!token) window.location.href = 'login.html';

document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    initPage();
});

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
        console.error(err);
    }
}

async function initPage() {
    await Promise.all([
        loadVehicles(),
        loadMaintenance()
    ]);
}

async function loadVehicles() {
    try {
        const res = await fetch(`${API}/vehicles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allVehicles = data.vehicles;
            const select = document.getElementById('vehicleId');
            select.innerHTML = '<option value="">-- Select Vehicle --</option>' +
                allVehicles.map(v => `<option value="${v.vehicleId}">${v.registrationNo} - ${v.model}</option>`).join('');
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadMaintenance() {
    try {
        const res = await fetch(`${API}/maintenance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allMaintenance = data.maintenance;
            displayMaintenance(allMaintenance);
            updateStats(allMaintenance);
        } else {
            showTableError('Failed to load maintenance logs.');
        }
    } catch (err) {
        showTableError('Server error loading maintenance.');
    }
}

function displayMaintenance(records) {
    const tbody = document.getElementById('maintenanceTableBody');
    if (!records || records.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="9">
                <div class="empty-state">
                    <i class="fas fa-tools"></i>
                    <p>No maintenance logs recorded. Click Add Maintenance Record to start.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = records.map((m, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${formatDate(m.serviceDate)}</strong></td>
            <td>${m.registrationNo}</td>
            <td><span class="type-tag type-${m.maintenanceType}">${formatType(m.maintenanceType)}</span></td>
            <td>${m.description || '-'}</td>
            <td>Rs. ${m.cost ? Number(m.cost).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
            <td>${m.nextServiceDue ? formatDate(m.nextServiceDue) : '-'}</td>
            <td><span class="status-badge status-${m.status}">${formatStatus(m.status)}</span></td>
            <td>
                <div class="action-btns">
                    ${m.status === 'pending' ? `
                        <button class="btn-icon status" onclick="openCompleteModal(${m.maintenanceId}, ${m.cost || 0}, '${m.description || ''}')" title="Complete Service">
                            <i class="fas fa-check-circle"></i>
                        </button>
                    ` : ''}
                    <button class="btn-icon delete" onclick="deleteMaint(${m.maintenanceId})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateStats(records) {
    const totalCost = records.reduce((sum, r) => sum + Number(r.cost || 0), 0);
    document.getElementById('totalTasks').textContent = records.length;
    document.getElementById('completedTasks').textContent = records.filter(r => r.status === 'completed').length;
    document.getElementById('pendingTasks').textContent = records.filter(r => r.status === 'pending').length;
    document.getElementById('totalMaintCost').textContent = `Rs. ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function filterMaintenance() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const type = document.getElementById('typeFilter').value;
    const status = document.getElementById('statusFilter').value;

    let filtered = allMaintenance;

    if (type !== 'all') {
        filtered = filtered.filter(m => m.maintenanceType === type);
    }
    if (status !== 'all') {
        filtered = filtered.filter(m => m.status === status);
    }
    if (search) {
        filtered = filtered.filter(m => m.registrationNo.toLowerCase().includes(search));
    }
    displayMaintenance(filtered);
}

function openAddModal() {
    document.getElementById('maintForm').reset();
    document.getElementById('formAlert').innerHTML = '';
    document.getElementById('serviceDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('maintModal').classList.add('open');
}

async function saveMaintLog() {
    const body = {
        vehicleId: parseInt(document.getElementById('vehicleId').value),
        maintenanceType: document.getElementById('maintenanceType').value,
        status: document.getElementById('status').value,
        serviceDate: document.getElementById('serviceDate').value,
        nextServiceDue: document.getElementById('nextServiceDue').value || null,
        cost: parseFloat(document.getElementById('cost').value) || null,
        description: document.getElementById('description').value
    };

    if (!body.vehicleId || !body.maintenanceType || !body.serviceDate) {
        document.getElementById('formAlert').innerHTML = '<div class="alert alert-error">Please fill in all required fields.</div>';
        return;
    }

    try {
        const res = await fetch(`${API}/maintenance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            closeMaintModal();
            loadMaintenance();
        } else {
            document.getElementById('formAlert').innerHTML = `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('formAlert').innerHTML = '<div class="alert alert-error">Server error saving maintenance log.</div>';
    }
}

function openCompleteModal(id, cost, desc) {
    document.getElementById('completeMaintId').value = id;
    document.getElementById('completeCost').value = cost || '';
    document.getElementById('completeDescription').value = desc || '';
    document.getElementById('completeNextServiceDue').value = '';
    document.getElementById('completeModal').classList.add('open');
}

async function submitCompleteMaint() {
    const id = document.getElementById('completeMaintId').value;
    const body = {
        status: 'completed',
        cost: parseFloat(document.getElementById('completeCost').value) || 0,
        description: document.getElementById('completeDescription').value,
        nextServiceDue: document.getElementById('completeNextServiceDue').value || null
    };

    try {
        const res = await fetch(`${API}/maintenance/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            closeCompleteModal();
            loadMaintenance();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to complete maintenance work.');
    }
}

async function deleteMaint(id) {
    if (!confirm('Are you sure you want to delete this maintenance record?')) return;

    try {
        const res = await fetch(`${API}/maintenance/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            loadMaintenance();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to delete record.');
    }
}

function closeMaintModal() { document.getElementById('maintModal').classList.remove('open'); }
function closeCompleteModal() { document.getElementById('completeModal').classList.remove('open'); }

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB');
}

function formatStatus(status) {
    return status === 'completed' ? 'Completed' : 'Pending';
}

function formatType(type) {
    const map = { routine: 'Routine Servicing', repair: 'Repair Works', emergency: 'Emergency Breakdown' };
    return map[type] || type;
}

function showTableError(msg) {
    document.getElementById('maintenanceTableBody').innerHTML =
        `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div></td></tr>`;
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}
