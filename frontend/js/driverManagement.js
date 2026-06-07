// driverManagement.js - Handles driver UI and route start/end actions
const API = 'http://localhost:5001/api';
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) window.location.href = 'login.html';

document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadDrivers();
    loadDepotsForDropdown();
    checkRole();
    // Attach start/end listeners
    document.getElementById('startRouteBtn').addEventListener('click', () => openRouteModal('start'));
    document.getElementById('endRouteBtn').addEventListener('click', () => openRouteModal('end'));
});

function checkRole() {
    if (currentUser.role !== 'admin') {
        document.getElementById('addDriverBtn').style.display = 'none';
    }
}

async function loadUserInfo() {
    try {
        const res = await fetch(`${API}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.user) document.getElementById('userName').textContent = data.user.name;
    } catch (e) { console.error(e); }
}

// Existing driver functions (loadDrivers, loadDepotsForDropdown, etc.)
// ... (the rest of the original drivers.js logic is omitted for brevity) ...

// ---------- Route Start / End Logic ----------
function openRouteModal(action) {
    const scheduleId = prompt(`Enter Schedule ID to ${action} route:`);
    if (!scheduleId) return;
    if (action === 'start') startRoute(scheduleId);
    else endRoute(scheduleId);
}

async function startRoute(scheduleId) {
    try {
        const res = await fetch(`${API}/driverManagement/start/${scheduleId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) alert(data.message);
        else alert(data.message || 'Failed to start route');
    } catch (e) { alert('Error starting route'); }
}

async function endRoute(scheduleId) {
    try {
        const res = await fetch(`${API}/driverManagement/end/${scheduleId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) alert(data.message);
        else alert(data.message || 'Failed to end route');
    } catch (e) { alert('Error ending route'); }
}
