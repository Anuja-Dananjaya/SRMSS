let allDepots = [];

// Redirect non-superadmin away
document.addEventListener('DOMContentLoaded', () => {
    initPage().then(() => {
        if (currentUser.role !== 'superadmin') {
            window.location.href = 'dashboard.html';
            return;
        }
        loadDepots();
    });
});

async function loadDepots() {
    try {
        const res = await fetch(`${API}/depots?includeInactive=true`, {
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
        showTableError('Server error. Make sure backend is running.');
    }
}

function displayDepots(depots) {
    const tbody = document.getElementById('depotsTableBody');

    if (!depots || depots.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="8">
                <div class="empty-state">
                    <i class="fas fa-building"></i>
                    <p>No depots found. Click Add Depot to create one.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = depots.map((d, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${d.name}</strong></td>
            <td>${d.city}</td>
            <td>${d.address || '-'}</td>
            <td>${d.phone || '-'}</td>
            <td><span class="status-badge status-${d.status}">${d.status === 'active' ? 'Active' : 'Inactive'}</span></td>
            <td>${formatDate(d.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit" onclick="editDepot(${d.depotId})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${d.status === 'active' ? `
                    <button class="btn-icon delete" onclick="openDeactivateModal(${d.depotId}, '${d.name}')" title="Deactivate">
                        <i class="fas fa-ban"></i>
                    </button>` : ''}
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

    if (status !== 'all') {
        filtered = filtered.filter(d => d.status === status);
    }
    if (search) {
        filtered = filtered.filter(d =>
            d.name.toLowerCase().includes(search) ||
            d.city.toLowerCase().includes(search)
        );
    }
    displayDepots(filtered);
}

function openAddModal() {
    document.getElementById('depotModalTitle').textContent = 'Add Depot';
    document.getElementById('depotId').value = '';
    document.getElementById('depotForm').reset();
    document.getElementById('depotFormAlert').innerHTML = '';
    document.getElementById('depotModal').classList.add('open');
}

function editDepot(id) {
    const d = allDepots.find(dep => dep.depotId === id);
    if (!d) return;

    document.getElementById('depotModalTitle').textContent = 'Edit Depot';
    document.getElementById('depotId').value = d.depotId;
    document.getElementById('depotName').value = d.name;
    document.getElementById('depotCity').value = d.city;
    document.getElementById('depotAddress').value = d.address || '';
    document.getElementById('depotPhone').value = d.phone || '';
    document.getElementById('depotStatus').value = d.status;
    document.getElementById('depotFormAlert').innerHTML = '';
    document.getElementById('depotModal').classList.add('open');
}

async function saveDepot() {
    const depotId = document.getElementById('depotId').value;
    const body = {
        name: document.getElementById('depotName').value.trim(),
        city: document.getElementById('depotCity').value.trim(),
        address: document.getElementById('depotAddress').value.trim() || null,
        phone: document.getElementById('depotPhone').value.trim() || null,
        status: document.getElementById('depotStatus').value
    };

    if (!body.name || !body.city) {
        document.getElementById('depotFormAlert').innerHTML =
            '<div class="alert alert-error">Depot name and city are required.</div>';
        return;
    }

    try {
        const url = depotId ? `${API}/depots/${depotId}` : `${API}/depots`;
        const method = depotId ? 'PUT' : 'POST';

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
            document.getElementById('depotFormAlert').innerHTML =
                `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('depotFormAlert').innerHTML =
            '<div class="alert alert-error">Server error. Please try again.</div>';
    }
}

function openDeactivateModal(id, name) {
    document.getElementById('deactivateDepotId').value = id;
    document.getElementById('deactivateDepotName').textContent = name;
    document.getElementById('deactivateModal').classList.add('open');
}

async function confirmDeactivate() {
    const id = document.getElementById('deactivateDepotId').value;

    try {
        const res = await fetch(`${API}/depots/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            closeDeactivateModal();
            loadDepots();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to deactivate depot.');
    }
}

function closeDepotModal() { document.getElementById('depotModal').classList.remove('open'); }
function closeDeactivateModal() { document.getElementById('deactivateModal').classList.remove('open'); }

function showTableError(msg) {
    document.getElementById('depotsTableBody').innerHTML =
        `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div></td></tr>`;
}