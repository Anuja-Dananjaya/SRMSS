const API_BASE = 'http://localhost:5000/api';
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadVehicles();
});

async function loadUserInfo() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('userName').textContent = data.user.name;
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function loadVehicles() {
    try {
        const response = await fetch(`${API_BASE}/vehicles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            displayVehicles(data.vehicles);
            updateStats(data.vehicles);
        } else {
            alert('Failed to load vehicles');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Network error');
    }
}

function displayVehicles(vehicles) {
    const tbody = document.getElementById('vehiclesTableBody');
    
    if (!vehicles || vehicles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No vehicles found</td></tr>';
        return;
    }
    
    tbody.innerHTML = vehicles.map(vehicle => `
        <tr>
            <td>${vehicle.vehicleId}</td>
            <td><strong>${vehicle.registrationNo}</strong></td>
            <td>${vehicle.model}</td>
            <td>${vehicle.capacity}</td>
            <td>${Number(vehicle.mileage).toLocaleString()}</td>
            <td>${vehicle.fuelEfficiency || '-'}</td>
            <td><span class="status-badge status-${vehicle.status}">${formatStatus(vehicle.status)}</span></td>
            <td>${vehicle.last_maintenance_date || '-'}</td>
            <td class="actions">
                <button class="btn-icon" onclick="viewVehicle(${vehicle.vehicleId})" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon" onclick="editVehicle(${vehicle.vehicleId})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="showMaintenance(${vehicle.vehicleId})" title="Maintenance">
                    <i class="fas fa-wrench"></i>
                </button>
                <button class="btn-icon" onclick="changeStatus(${vehicle.vehicleId}, '${vehicle.status}')" title="Change Status">
                    <i class="fas fa-exchange-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateStats(vehicles) {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.status === 'active').length;
    const maintenance = vehicles.filter(v => v.status === 'maintenance').length;
    const totalMileage = vehicles.reduce((sum, v) => sum + Number(v.mileage), 0);
    
    document.getElementById('totalVehicles').textContent = total;
    document.getElementById('activeVehicles').textContent = active;
    document.getElementById('maintenanceVehicles').textContent = maintenance;
    document.getElementById('totalMileage').textContent = totalMileage.toLocaleString();
}

function formatStatus(status) {
    const map = { 'active': 'Active', 'maintenance': 'Maintenance', 'inactive': 'Inactive' };
    return map[status] || status;
}

function openVehicleModal(vehicle = null) {
    const modal = document.getElementById('vehicleModal');
    document.getElementById('vehicleForm').reset();
    
    if (vehicle) {
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Vehicle';
        document.getElementById('vehicleId').value = vehicle.vehicleId;
        document.getElementById('registrationNo').value = vehicle.registrationNo;
        document.getElementById('model').value = vehicle.model;
        document.getElementById('capacity').value = vehicle.capacity;
        document.getElementById('mileage').value = vehicle.mileage;
        document.getElementById('fuelEfficiency').value = vehicle.fuelEfficiency;
        document.getElementById('status').value = vehicle.status;
    } else {
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> Add Vehicle';
        document.getElementById('vehicleId').value = '';
    }
    modal.style.display = 'flex';
}

function closeVehicleModal() {
    document.getElementById('vehicleModal').style.display = 'none';
}

function closeViewModal() {
    document.getElementById('viewVehicleModal').style.display = 'none';
}

document.getElementById('vehicleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const vehicleId = document.getElementById('vehicleId').value;
    const vehicleData = {
        registrationNo: document.getElementById('registrationNo').value,
        model: document.getElementById('model').value,
        capacity: parseInt(document.getElementById('capacity').value),
        mileage: parseFloat(document.getElementById('mileage').value) || 0,
        fuelEfficiency: parseFloat(document.getElementById('fuelEfficiency').value) || null,
        status: document.getElementById('status').value
    };
    
    try {
        let response;
        if (vehicleId) {
            response = await fetch(`${API_BASE}/vehicles/${vehicleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(vehicleData)
            });
        } else {
            response = await fetch(`${API_BASE}/vehicles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(vehicleData)
            });
        }
        
        const data = await response.json();
        if (data.success) {
            closeVehicleModal();
            loadVehicles();
            alert('✓ ' + data.message);
        } else {
            alert('✗ ' + data.message);
        }
    } catch (error) {
        alert('✗ Failed to save vehicle');
    }
});

async function viewVehicle(id) {
    try {
        const response = await fetch(`${API_BASE}/vehicles/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const v = data.vehicle;
            let maintHtml = '<h4>Maintenance History:</h4>';
            if (v.maintenance_history && v.maintenance_history.length > 0) {
                maintHtml += '<ul>';
                v.maintenance_history.forEach(m => {
                    maintHtml += `<li><strong>${m.serviceDate}</strong> - ${m.maintenanceType}: ${m.description || 'No description'}</li>`;
                });
                maintHtml += '</ul>';
            } else {
                maintHtml += '<p>No maintenance records</p>';
            }
            
            document.getElementById('viewVehicleContent').innerHTML = `
                <div>
                    <p><strong>Registration:</strong> ${v.registrationNo}</p>
                    <p><strong>Model:</strong> ${v.model}</p>
                    <p><strong>Capacity:</strong> ${v.capacity} seats</p>
                    <p><strong>Mileage:</strong> ${Number(v.mileage).toLocaleString()} km</p>
                    <p><strong>Fuel Efficiency:</strong> ${v.fuelEfficiency || 'N/A'} km/L</p>
                    <p><strong>Status:</strong> ${formatStatus(v.status)}</p>
                    <hr>
                    ${maintHtml}
                </div>
            `;
            document.getElementById('viewVehicleModal').style.display = 'flex';
        }
    } catch (error) {
        alert('Failed to load vehicle details');
    }
}

async function editVehicle(id) {
    try {
        const response = await fetch(`${API_BASE}/vehicles/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            openVehicleModal(data.vehicle);
        }
    } catch (error) {
        alert('Failed to load vehicle details');
    }
}

async function changeStatus(id, currentStatus) {
    const newStatus = prompt(`Enter new status (active/maintenance/inactive):`, currentStatus);
    if (!newStatus || newStatus === currentStatus) return;
    
    try {
        const response = await fetch(`${API_BASE}/vehicles/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await response.json();
        if (data.success) {
            loadVehicles();
            alert('✓ Status updated');
        } else {
            alert('✗ ' + data.message);
        }
    } catch (error) {
        alert('Failed to update status');
    }
}

async function showMaintenance(id) {
    try {
        const response = await fetch(`${API_BASE}/vehicles/${id}/maintenance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.maintenance.length > 0) {
            let msg = 'Maintenance Records:\n\n';
            data.maintenance.forEach(m => {
                msg += `${m.serviceDate} - ${m.maintenanceType}: ${m.description || '-'}\n`;
            });
            alert(msg);
        } else {
            alert('No maintenance records found');
        }
    } catch (error) {
        alert('Failed to load maintenance history');
    }
}

function filterVehicles() {
    const status = document.getElementById('statusFilter').value;
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    fetch(`${API_BASE}/vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            let filtered = data.vehicles;
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
    });
}

function exportVehicles() {
    fetch(`${API_BASE}/vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            let csv = "ID,Registration,Model,Capacity,Mileage,Fuel Efficiency,Status\n";
            data.vehicles.forEach(v => {
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
    });
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}