const API = 'http://localhost:5001/api';
const token = localStorage.getItem('token');
let allFuelLogs = [];
let allVehicles = [];
let allSchedules = [];

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
        loadSchedules(),
        loadFuelLogs()
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

async function loadSchedules() {
    try {
        const res = await fetch(`${API}/schedules`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allSchedules = data.schedules;
        }
    } catch (err) {
        console.error(err);
    }
}

function loadVehicleSchedules() {
    const vehicleId = parseInt(document.getElementById('vehicleId').value);
    const select = document.getElementById('scheduleId');
    if (!vehicleId) {
        select.innerHTML = '<option value="">-- Select Schedule --</option>';
        return;
    }

    const filtered = allSchedules.filter(s => s.vehicleId === vehicleId);
    select.innerHTML = '<option value="">-- Select Schedule --</option>' +
        filtered.map(s => `<option value="${s.scheduleId}">${formatDate(s.scheduleDate)} : Route ${s.routeCode} (${s.departureTime.slice(0, 5)})</option>`).join('');
}

async function loadFuelLogs() {
    try {
        const res = await fetch(`${API}/fuel`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allFuelLogs = data.fuelLogs;
            displayFuelLogs(allFuelLogs);
            updateStats(allFuelLogs);
        } else {
            showTableError('Failed to load fuel logs.');
        }
    } catch (err) {
        showTableError('Server error loading fuel logs.');
    }
}

function displayFuelLogs(logs) {
    const tbody = document.getElementById('fuelTableBody');
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="8">
                <div class="empty-state">
                    <i class="fas fa-gas-pump"></i>
                    <p>No fuel logs recorded. Click Add Fuel Log to add one.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map((l, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${formatDate(l.date)}</strong></td>
            <td>${l.registrationNo}</td>
            <td>${l.routeCode ? `Route ${l.routeCode} (${formatDate(l.scheduleDate)})` : '<span style="color:#9ca3af;">None</span>'}</td>
            <td>${Number(l.fuelAmount).toFixed(2)} L</td>
            <td>Rs. ${Number(l.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${l.odometerReading ? Number(l.odometerReading).toLocaleString() + ' km' : '-'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon delete" onclick="deleteFuelLog(${l.fuelLogId})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateStats(logs) {
    const totalVolume = logs.reduce((sum, l) => sum + Number(l.fuelAmount), 0);
    const totalCost = logs.reduce((sum, l) => sum + Number(l.cost), 0);
    const avgCost = totalVolume > 0 ? (totalCost / totalVolume) : 0;

    document.getElementById('totalLogs').textContent = logs.length;
    document.getElementById('totalAmount').textContent = `${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;
    document.getElementById('totalCost').textContent = `Rs. ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    document.getElementById('avgCostPerLiter').textContent = `Rs. ${avgCost.toFixed(2)}`;
}

function filterFuelLogs() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const date = document.getElementById('dateFilter').value;

    let filtered = allFuelLogs;

    if (date) {
        filtered = filtered.filter(l => l.date.split('T')[0] === date);
    }
    if (search) {
        filtered = filtered.filter(l => l.registrationNo.toLowerCase().includes(search));
    }
    displayFuelLogs(filtered);
}

function openAddModal() {
    document.getElementById('fuelForm').reset();
    document.getElementById('formAlert').innerHTML = '';
    document.getElementById('scheduleId').innerHTML = '<option value="">-- Select Schedule --</option>';
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
    document.getElementById('fuelModal').classList.add('open');
}

async function saveFuelLog() {
    const body = {
        vehicleId: parseInt(document.getElementById('vehicleId').value),
        scheduleId: parseInt(document.getElementById('scheduleId').value) || null,
        fuelAmount: parseFloat(document.getElementById('fuelAmount').value),
        cost: parseFloat(document.getElementById('cost').value),
        date: document.getElementById('date').value,
        odometerReading: parseFloat(document.getElementById('odometerReading').value) || null
    };

    if (!body.vehicleId || !body.fuelAmount || !body.cost || !body.date) {
        document.getElementById('formAlert').innerHTML = '<div class="alert alert-error">Please fill in all required fields.</div>';
        return;
    }

    try {
        const res = await fetch(`${API}/fuel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            closeFuelModal();
            loadFuelLogs();
        } else {
            document.getElementById('formAlert').innerHTML = `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('formAlert').innerHTML = '<div class="alert alert-error">Server error saving fuel log.</div>';
    }
}

async function deleteFuelLog(id) {
    if (!confirm('Are you sure you want to delete this fuel log?')) return;

    try {
        const res = await fetch(`${API}/fuel/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            loadFuelLogs();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to delete fuel log.');
    }
}

function closeFuelModal() { document.getElementById('fuelModal').classList.remove('open'); }

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB');
}

function showTableError(msg) {
    document.getElementById('fuelTableBody').innerHTML =
        `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div></td></tr>`;
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}
