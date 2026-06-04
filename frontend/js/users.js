const API = 'http://localhost:5000/api';
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let allUsers = [];

// Redirect if not logged in
if (!token) window.location.href = 'login.html';

// Redirect if not admin
if (currentUser.role !== 'admin') window.location.href = 'dashboard.html';

document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadUsers();
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
        console.error('Error loading user info:', err);
    }
}

// Load all users
async function loadUsers() {
    try {
        const res = await fetch(`${API}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.users) {
            allUsers = data.users;
            displayUsers(allUsers);
            updateStats(allUsers);
        } else {
            showTableError('Failed to load users.');
        }
    } catch (err) {
        showTableError('Server error. Make sure backend is running.');
    }
}

// Display users in table
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');

    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No users found.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = users.map((u, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="user-avatar">${u.name.charAt(0).toUpperCase()}</div>
                    <strong>${u.name}</strong>
                </div>
            </td>
            <td>${u.email}</td>
            <td><span class="role-badge role-${u.role}">${formatRole(u.role)}</span></td>
            <td>${u.phone || '-'}</td>
            <td>${formatDate(u.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon view" onclick="viewUser(${u.userId})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon edit" onclick="editUser(${u.userId})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${u.userId !== currentUser.userId ? `
                    <button class="btn-icon delete" onclick="openDeleteModal(${u.userId}, '${u.name}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>` : '<span style="color:#9ca3af; font-size:12px; padding:6px;">You</span>'}
                </div>
            </td>
        </tr>
    `).join('');
}

// Update stats
function updateStats(users) {
    document.getElementById('totalUsers').textContent = users.length;
    document.getElementById('totalAdmins').textContent = users.filter(u => u.role === 'admin').length;
    document.getElementById('totalSupervisors').textContent = users.filter(u => u.role === 'supervisor').length;
    document.getElementById('totalOperators').textContent = users.filter(u => u.role === 'operator').length;
}

// Filter users
function filterUsers() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const role = document.getElementById('roleFilter').value;

    let filtered = allUsers;

    if (role !== 'all') {
        filtered = filtered.filter(u => u.role === role);
    }

    if (search) {
        filtered = filtered.filter(u =>
            u.name.toLowerCase().includes(search) ||
            u.email.toLowerCase().includes(search)
        );
    }

    displayUsers(filtered);
}

// Open add modal
function openAddModal() {
    document.getElementById('userModalTitle').textContent = 'Add User';
    document.getElementById('userId').value = '';
    document.getElementById('userForm').reset();
    document.getElementById('userFormAlert').innerHTML = '';
    document.getElementById('passwordGroup').style.display = 'block';
    document.getElementById('password').required = true;
    document.getElementById('userModal').classList.add('open');
}

// Edit user
async function editUser(id) {
    try {
        const res = await fetch(`${API}/users/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.user) {
            const u = data.user;
            document.getElementById('userModalTitle').textContent = 'Edit User';
            document.getElementById('userId').value = u.userId;
            document.getElementById('name').value = u.name;
            document.getElementById('email').value = u.email;
            document.getElementById('role').value = u.role;
            document.getElementById('phone').value = u.phone || '';
            document.getElementById('userFormAlert').innerHTML = '';

            // Hide password field for edit
            document.getElementById('passwordGroup').style.display = 'none';
            document.getElementById('password').required = false;

            document.getElementById('userModal').classList.add('open');
        }
    } catch (err) {
        alert('Failed to load user details.');
    }
}

// Save user - create or update
async function saveUser() {
    const userId = document.getElementById('userId').value;
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const phone = document.getElementById('phone').value.trim();

    if (!name || !email || !role) {
        document.getElementById('userFormAlert').innerHTML =
            '<div class="alert alert-error">Name, email and role are required.</div>';
        return;
    }

    if (!userId && !password) {
        document.getElementById('userFormAlert').innerHTML =
            '<div class="alert alert-error">Password is required for new users.</div>';
        return;
    }

    if (!userId && password.length < 6) {
        document.getElementById('userFormAlert').innerHTML =
            '<div class="alert alert-error">Password must be at least 6 characters.</div>';
        return;
    }

    try {
        let res;

        if (userId) {
            // Update existing user
            res = await fetch(`${API}/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, email, role, phone })
            });
        } else {
            // Create new user via auth register
            res = await fetch(`${API}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, email, password, role, phone })
            });
        }

        const data = await res.json();

        if (res.ok) {
            closeUserModal();
            loadUsers();
        } else {
            document.getElementById('userFormAlert').innerHTML =
                `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('userFormAlert').innerHTML =
            '<div class="alert alert-error">Server error. Please try again.</div>';
    }
}

// View user details
async function viewUser(id) {
    try {
        const res = await fetch(`${API}/users/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.user) {
            const u = data.user;
            document.getElementById('viewUserContent').innerHTML = `
                <div style="text-align:center; margin-bottom:20px;">
                    <div class="user-avatar-large">${u.name.charAt(0).toUpperCase()}</div>
                    <h3 style="margin-top:12px; color:#1f2937;">${u.name}</h3>
                    <span class="role-badge role-${u.role}">${formatRole(u.role)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${u.email}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${u.phone || 'Not provided'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Role</span>
                    <span class="detail-value">
                        <span class="role-badge role-${u.role}">${formatRole(u.role)}</span>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Member Since</span>
                    <span class="detail-value">${formatDate(u.createdAt)}</span>
                </div>
            `;
            document.getElementById('viewUserModal').classList.add('open');
        }
    } catch (err) {
        alert('Failed to load user details.');
    }
}

// Open delete confirmation modal
function openDeleteModal(id, name) {
    document.getElementById('deleteUserId').value = id;
    document.getElementById('deleteUserName').textContent = name;
    document.getElementById('deleteModal').classList.add('open');
}

// Confirm delete
async function confirmDelete() {
    const id = document.getElementById('deleteUserId').value;

    try {
        const res = await fetch(`${API}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
            closeDeleteModal();
            loadUsers();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Failed to delete user.');
    }
}

// Close modals
function closeUserModal() { document.getElementById('userModal').classList.remove('open'); }
function closeViewModal() { document.getElementById('viewUserModal').classList.remove('open'); }
function closeDeleteModal() { document.getElementById('deleteModal').classList.remove('open'); }

// Helpers
function formatRole(role) {
    const map = { admin: 'Admin', supervisor: 'Supervisor', operator: 'Operator' };
    return map[role] || role;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
}

function showTableError(msg) {
    document.getElementById('usersTableBody').innerHTML =
        `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div></td></tr>`;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}