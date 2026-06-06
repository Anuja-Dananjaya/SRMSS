const API = 'http://localhost:5000/api';
const token = localStorage.getItem('token');
let activityLogs = [];

if (!token) window.location.href = 'login.html';

document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadAnalytics();
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

async function loadAnalytics() {
    await Promise.all([
        loadFuelStats(),
        loadMaintenanceStats(),
        loadScheduleStats(),
        loadActivityLogs()
    ]);
}

async function loadFuelStats() {
    try {
        const res = await fetch(`${API}/fuel`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.fuelLogs) {
            const logs = data.fuelLogs;
            const totalCost = logs.reduce((sum, l) => sum + Number(l.cost), 0);
            const totalVol = logs.reduce((sum, l) => sum + Number(l.fuelAmount), 0);

            document.getElementById('repTotalFuelSpent').textContent = `Rs. ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
            document.getElementById('repTotalFuelVolume').textContent = `${totalVol.toLocaleString(undefined, { maximumFractionDigits: 2 })} Liters`;
        }
    } catch (err) {
        console.error('Fuel stats failed:', err);
    }
}

async function loadMaintenanceStats() {
    try {
        const res = await fetch(`${API}/maintenance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.maintenance) {
            const maint = data.maintenance;
            const totalCost = maint.reduce((sum, m) => sum + Number(m.cost || 0), 0);
            const routine = maint.filter(m => m.maintenanceType === 'routine').length;
            const repairs = maint.filter(m => m.maintenanceType === 'repair' || m.maintenanceType === 'emergency').length;

            document.getElementById('repTotalMaintSpent').textContent = `Rs. ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
            document.getElementById('repMaintRatio').textContent = `${routine} Servicing / ${repairs} Repairs`;
        }
    } catch (err) {
        console.error('Maintenance stats failed:', err);
    }
}

async function loadScheduleStats() {
    try {
        const res = await fetch(`${API}/schedules`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.schedules) {
            const scheds = data.schedules;
            const total = scheds.length;
            const completed = scheds.filter(s => s.status === 'completed').length;
            const delayed = scheds.filter(s => s.status === 'delayed').length;
            const cancelled = scheds.filter(s => s.status === 'cancelled').length;
            
            const cancelRate = total > 0 ? ((cancelled / total) * 100).toFixed(2) : '0.00';

            document.getElementById('repTotalRuns').textContent = total;
            document.getElementById('repCompletedRuns').textContent = completed;
            document.getElementById('repCancelRate').textContent = `${cancelRate}%`;
            document.getElementById('repDelayedRuns').textContent = delayed;
        }
    } catch (err) {
        console.error('Schedule stats failed:', err);
    }
}

async function loadActivityLogs() {
    try {
        const res = await fetch(`${API}/activities`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const tbody = document.getElementById('activityLogsTableBody');
        
        if (data.success && data.activities) {
            activityLogs = data.activities;
            if (activityLogs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>No system activity logs found.</p></div></td></tr>`;
                return;
            }

            tbody.innerHTML = activityLogs.map((log, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${new Date(log.createdAt).toLocaleString('en-GB')}</td>
                    <td><strong>${log.userName || 'System'}</strong><br><small style="color:#6b7280">${log.userEmail || ''}</small></td>
                    <td><span class="activity-badge badge-${log.action.toLowerCase()}">${log.action}</span></td>
                    <td>${log.module}</td>
                    <td>${log.description || '-'}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>Failed to load activity logs.</p></div></td></tr>`;
        }
    } catch (err) {
        console.error('Activity logs load failed:', err);
        document.getElementById('activityLogsTableBody').innerHTML = 
            `<tr><td colspan="6"><div class="empty-state"><p>Failed to retrieve audit log from backend.</p></div></td></tr>`;
    }
}

function exportActivityLogsCSV() {
    if (activityLogs.length === 0) {
        alert('No logs available to export.');
        return;
    }

    let csv = 'Index,Timestamp,User,Action,Module,Description\n';
    activityLogs.forEach((log, i) => {
        const descClean = (log.description || '').replace(/"/g, '""');
        csv += `${i + 1},"${new Date(log.createdAt).toLocaleString('en-GB')}","${log.userName || 'System'}","${log.action}","${log.module}","${descClean}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `srmss_activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}
