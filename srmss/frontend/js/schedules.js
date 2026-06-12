let allSchedules = [];
let allRoutes = [];
let allVehicles = [];
let allDrivers = [];


document.addEventListener('DOMContentLoaded', () => {
    initPage().then(() => {
        renderDepotFilter((depotId) => initSchedulePage(depotId));
        initSchedulePage(getSelectedDepotId());
    });
});



async function initSchedulePage(depotId = '') {
    await Promise.all([
        loadRoutes(depotId),
        loadVehicles(depotId),
        loadDrivers(depotId),
        loadSchedules(depotId)
    ]);
}

async function loadRoutes(depotId = '') {
    const url = depotId ? `${API}/routes?depotId=${depotId}` : `${API}/routes`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

        const data = await res.json();
        if (data.success) {
            allRoutes = data.routes;
            const routeSelect = document.getElementById('routeId');
            routeSelect.innerHTML = '<option value="">-- Select Route --</option>' + 
                allRoutes.map(r => `<option value="${r.routeId}">${r.routeCode} (${r.startPoint} → ${r.endPoint})</option>`).join('');
        }
    } catch (err) {
        console.error('Error loading routes:', err);
    }
}

async function loadVehicles(depotId = '') {
    const url = depotId ? `${API}/vehicles?depotId=${depotId}` : `${API}/vehicles`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

        const data = await res.json();
        if (data.success) {
            allVehicles = data.vehicles;
                const vehicleSelect = document.getElementById('vehicleId');
                // Only show active vehicles for schedule assignment
                const activeVehicles = allVehicles.filter(v => v.status === 'active');
                vehicleSelect.innerHTML = '<option value="">-- Select Vehicle --</option>' + 
                    activeVehicles.map(v => `<option value="${v.vehicleId}">${v.registrationNo} - ${v.model}</option>`).join('');
        }
    } catch (err) {
        console.error('Error loading vehicles:', err);
    }
}

async function loadDrivers(depotId = '') {
    const url = depotId ? `${API}/drivers?depotId=${depotId}` : `${API}/drivers`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

        const data = await res.json();
        // Since driver API might return data directly or wrapped in {success, drivers}
        const drivers = data.drivers || data;
        if (Array.isArray(drivers)) {
            allDrivers = drivers;
            const driverSelect = document.getElementById('driverId');
            driverSelect.innerHTML = '<option value="">-- Select Driver --</option>' + 
                allDrivers.map(d => `<option value="${d.driverId}">${d.name} (${d.status})</option>`).join('');
        }
    } catch (err) {
        console.error('Error loading drivers:', err);
    }
}

async function loadSchedules(depotId = '') {
    const url = depotId ? `${API}/schedules?depotId=${depotId}` : `${API}/schedules`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        
        const data = await res.json();
        if (data.success) {
            allSchedules = data.schedules;
            displaySchedules(allSchedules);
            updateStats(allSchedules);
        } else {
            showTableError('Failed to load schedules.');
        }
    } catch (err) {
        showTableError('Server error connecting to schedules API.');
    }
}

function displaySchedules(schedules) {
    const tbody = document.getElementById('schedulesTableBody');
    if (!schedules || schedules.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="10">
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No schedules found. Click Create Schedule to plan one.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = schedules.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${formatDate(s.scheduleDate)}</strong></td>
            <td><span class="route-tag">${s.routeCode}</span></td>
            <td>${s.startPoint} → ${s.endPoint}</td>
            <td>${s.registrationNo || 'N/A'}</td>
            <td>${s.driverName || 'N/A'}</td>
            <td>${s.departureTime.slice(0, 5)} - ${s.arrivalTime.slice(0, 5)}</td>
            <td><span class="type-badge">${s.scheduleType}</span></td>
            <td><span class="status-badge status-${s.status}">${formatStatus(s.status)}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit" onclick="editSchedule(${s.scheduleId})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteSchedule(${s.scheduleId})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateStats(schedules) {
    document.getElementById('totalSchedules').textContent = schedules.length;
    document.getElementById('ongoingSchedules').textContent = schedules.filter(s => s.status === 'ongoing').length;
    document.getElementById('scheduledSchedules').textContent = schedules.filter(s => s.status === 'scheduled').length;
    document.getElementById('completedSchedules').textContent = schedules.filter(s => s.status === 'completed').length;
}

function filterSchedules() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const date = document.getElementById('dateFilter').value;
    const status = document.getElementById('statusFilter').value;

    let filtered = allSchedules;

    if (status !== 'all') {
        filtered = filtered.filter(s => s.status === status);
    }
    if (date) {
        filtered = filtered.filter(s => s.scheduleDate.split('T')[0] === date);
    }
    if (search) {
        filtered = filtered.filter(s => 
            (s.routeCode && s.routeCode.toLowerCase().includes(search)) ||
            (s.driverName && s.driverName.toLowerCase().includes(search)) ||
            (s.registrationNo && s.registrationNo.toLowerCase().includes(search))
        );
    }
    displaySchedules(filtered);
}

function toggleRecurrence() {
    const type = document.getElementById('scheduleType').value;
    const group = document.getElementById('endDateGroup');
    if (type === 'weekly' || type === 'monthly') {
        group.style.display = 'block';
    } else {
        group.style.display = 'none';
        document.getElementById('endDate').value = '';
    }
}

function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Create Schedule';
    document.getElementById('scheduleId').value = '';
    document.getElementById('scheduleForm').reset();
    document.getElementById('formAlert').innerHTML = '';
    document.getElementById('statusGroup').style.display = 'none';
    document.getElementById('endDateGroup').style.display = 'none';
    document.getElementById('scheduleModal').classList.add('open');
}

async function editSchedule(id) {
    const s = allSchedules.find(item => item.scheduleId === id);
    if (!s) return;

    document.getElementById('modalTitle').textContent = 'Edit Schedule';
    document.getElementById('scheduleId').value = s.scheduleId;
    document.getElementById('routeId').value = s.routeId;
    const vehicleSelect = document.getElementById('vehicleId');
    // If the schedule's vehicle is not in the current active list, add it so it can be selected
    if (!vehicleSelect.querySelector(`option[value="${s.vehicleId}"]`)) {
        const v = allVehicles.find(x => x.vehicleId === s.vehicleId);
        if (v) {
            vehicleSelect.insertAdjacentHTML('beforeend', `<option value="${v.vehicleId}">${v.registrationNo} - ${v.model} (${v.status})</option>`);
        }
    }
    vehicleSelect.value = s.vehicleId;
    document.getElementById('driverId').value = s.driverId;
    document.getElementById('departureTime').value = s.departureTime.slice(0, 5);
    document.getElementById('arrivalTime').value = s.arrivalTime.slice(0, 5);
    document.getElementById('scheduleDate').value = s.scheduleDate.split('T')[0];
    document.getElementById('scheduleType').value = s.scheduleType;
    document.getElementById('status').value = s.status;
    document.getElementById('notes').value = s.notes || '';
    
    document.getElementById('statusGroup').style.display = 'block';
    toggleRecurrence();
    document.getElementById('formAlert').innerHTML = '';
    document.getElementById('scheduleModal').classList.add('open');
}

async function saveSchedule() {
    const scheduleId = document.getElementById('scheduleId').value;
    const body = {
        routeId: parseInt(document.getElementById('routeId').value),
        vehicleId: parseInt(document.getElementById('vehicleId').value),
        driverId: parseInt(document.getElementById('driverId').value),
        departureTime: document.getElementById('departureTime').value,
        arrivalTime: document.getElementById('arrivalTime').value,
        scheduleDate: document.getElementById('scheduleDate').value,
        scheduleType: document.getElementById('scheduleType').value,
        endDate: document.getElementById('endDate').value || null,
        notes: document.getElementById('notes').value,
        status: document.getElementById('status').value || 'scheduled'
    };

    if (!body.routeId || !body.vehicleId || !body.driverId || !body.departureTime || !body.arrivalTime || !body.scheduleDate) {
        document.getElementById('formAlert').innerHTML = '<div class="alert alert-error">Please fill in all required fields.</div>';
        return;
    }

    try {
        // Pre-check conflicts
        const checkRes = await fetch(`${API}/schedules/check-conflicts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ ...body, excludeId: scheduleId ? parseInt(scheduleId) : null })
        });
        const checkData = await checkRes.json();

        if (checkData.success && checkData.hasConflicts) {
            document.getElementById('formAlert').innerHTML = `
                <div class="alert alert-error">
                    <strong>Schedule Conflict Detected:</strong>
                    <ul>${checkData.conflicts.map(c => `<li>${c}</li>`).join('')}</ul>
                </div>`;
            return;
        }

        const url = scheduleId ? `${API}/schedules/${scheduleId}` : `${API}/schedules`;
        const method = scheduleId ? 'PUT' : 'POST';

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
            closeScheduleModal();
            loadSchedules(getSelectedDepotId());
        } else {
            document.getElementById('formAlert').innerHTML = `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('formAlert').innerHTML = '<div class="alert alert-error">Server error saving schedule.</div>';
    }
}

async function deleteSchedule(id) {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
        const res = await fetch(`${API}/schedules/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            loadSchedules(getSelectedDepotId());
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to delete schedule.');
    }
}

function openTripExecutionModal(id, status, departureTime, arrivalTime) {
    document.getElementById('execScheduleId').value = id;
    document.getElementById('execStatus').value = status;
    document.getElementById('actualDeparture').value = departureTime ? departureTime.slice(0, 16) : '';
    document.getElementById('actualArrival').value = arrivalTime ? arrivalTime.slice(0, 16) : '';
    document.getElementById('tripExecutionModal').classList.add('open');
}

async function saveTripExecution() {
    const id = document.getElementById('execScheduleId').value;
    const body = {
        status: document.getElementById('execStatus').value,
        actualDeparture: document.getElementById('actualDeparture').value || null,
        actualArrival: document.getElementById('actualArrival').value || null
    };

    try {
        const res = await fetch(`${API}/schedules/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            closeTripExecutionModal();
            loadSchedules(getSelectedDepotId());
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to update trip progress.');
    }
}

function closeScheduleModal() { document.getElementById('scheduleModal').classList.remove('open'); }
function closeTripExecutionModal() { document.getElementById('tripExecutionModal').classList.remove('open'); }

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB');
}

function formatStatus(status) {
    const map = { scheduled: 'Scheduled', ongoing: 'Ongoing', completed: 'Completed', delayed: 'Delayed', cancelled: 'Cancelled' };
    return map[status] || status;
}

function showTableError(msg) {
    document.getElementById('schedulesTableBody').innerHTML =
        `<tr><td colspan="10"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div></td></tr>`;
}


