const API = 'http://localhost:5001/api';
const token = localStorage.getItem('token');
let allDepots = [];

if (!token) window.location.href = 'login.html';

document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadDepots();
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
        console.error('Error loading user info:', err);
    }
}

async function loadDepots() {
    try {
        const res = await fetch(`${API}/depots`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allDepots = data.depots;
            displayDepots(allDepots);
            updateStats(allDepots);
        } else {
            showTableError('Failed to load depots.');
        }
    } catch (err) {
        showTableError('Server error connecting to depots API.');
    }
}

function displayDepots(depots) {
    const tbody = document.getElementById('depotsTableBody');
    if (!depots || depots.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state">
                    <i class="fas fa-warehouse"></i>
                    <p>No depots found. Click Add Depot to create one.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = depots.map((d, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${d.name}</strong></td>
            <td>${d.location || '<span style="color:#9ca3af;">—</span>'}</td>
            <td>${d.contactPhone || '<span style="color:#9ca3af;">—</span>'}</td>
            <td>${d.contactEmail || '<span style="color:#9ca3af;">—</span>'}</td>
            <td><span class="status-badge status-${d.status === 'active' ? 'ongoing' : 'cancelled'}">${d.status.charAt(0).toUpperCase() + d.status.slice(1)}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit" onclick="editDepot(${d.depotId})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="openDeleteModal(${d.depotId}, '${d.name.replace(/'/g, "\\'")}')'" title="Deactivate">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateStats(depots) {
    document.getElementById('totalDepots').textContent = depots.length;
    document.getElementById('activeDepots').textContent = depots.filter(d => d.status === 'active').length;
    document.getElementById('inactiveDepots').textContent = depots.filter(d => d.status === 'inactive').length;
}

function filterDepots() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;

    let filtered = allDepots;
    if (status !== 'all') filtered = filtered.filter(d => d.status === status);
    if (search) {
        filtered = filtered.filter(d =>
            (d.name && d.name.toLowerCase().includes(search)) ||
            (d.location && d.location.toLowerCase().includes(search))
        );
    }
    displayDepots(filtered);
}

function openAddModal() {
    document.getElementById('depotModalTitle').textContent = 'Add Depot';
    document.getElementById('depotId').value = '';
    document.getElementById('depotForm').reset();
    document.getElementById('depotFormAlert').innerHTML = '';
    document.getElementById('depotStatusGroup').style.display = 'none';
    document.getElementById('depotModal').classList.add('open');
}

function editDepot(id) {
    const d = allDepots.find(item => item.depotId === id);
    if (!d) return;
    document.getElementById('depotModalTitle').textContent = 'Edit Depot';
    document.getElementById('depotId').value = d.depotId;
    document.getElementById('depotName').value = d.name;
    document.getElementById('depotLocation').value = d.location || '';
    document.getElementById('depotPhone').value = d.contactPhone || '';
    document.getElementById('depotEmail').value = d.contactEmail || '';
    document.getElementById('depotStatus').value = d.status;
    document.getElementById('depotStatusGroup').style.display = 'block';
    document.getElementById('depotFormAlert').innerHTML = '';
    document.getElementById('depotModal').classList.add('open');
}

async function saveDepot() {
    const depotId = document.getElementById('depotId').value;
    const name = document.getElementById('depotName').value.trim();
    const location = document.getElementById('depotLocation').value.trim();
    const contactPhone = document.getElementById('depotPhone').value.trim();
    const contactEmail = document.getElementById('depotEmail').value.trim();
    const status = document.getElementById('depotStatus').value;

    if (!name) {
        document.getElementById('depotFormAlert').innerHTML = '<div class="alert alert-error">Depot name is required.</div>';
        return;
    }

    const body = { name, location: location || null, contactPhone: contactPhone || null, contactEmail: contactEmail || null };
    if (depotId) body.status = status;

    const url = depotId ? `${API}/depots/${depotId}` : `${API}/depots`;
    const method = depotId ? 'PUT' : 'POST';

    try {
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
            closeDepotModal();
            loadDepots();
        } else {
            document.getElementById('depotFormAlert').innerHTML = `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('depotFormAlert').innerHTML = '<div class="alert alert-error">Server error saving depot.</div>';
    }
}

function openDeleteModal(id, name) {
    document.getElementById('deleteDepotId').value = id;
    document.getElementById('deleteDepotName').textContent = name;
    document.getElementById('deleteDepotModal').classList.add('open');
}

async function confirmDeleteDepot() {
    const id = document.getElementById('deleteDepotId').value;
    try {
        const res = await fetch(`${API}/depots/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            closeDeleteModal();
            loadDepots();
        } else {
            closeDeleteModal();
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to deactivate depot.');
    }
}

function closeDepotModal() { document.getElementById('depotModal').classList.remove('open'); }
function closeDeleteModal() { document.getElementById('deleteDepotModal').classList.remove('open'); }

function showTableError(msg) {
    document.getElementById('depotsTableBody').innerHTML =
        `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div></td></tr>`;
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}
