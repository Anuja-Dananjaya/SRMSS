const API = 'http://localhost:5001/api';
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) window.location.href = 'login.html';

// Charts references
let scheduleStatusChart = null;
let vehicleStatusChart = null;
let routeTypesChart = null;
let scheduleTrendChart = null;

document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate();
    loadUserInfo();
    loadDashboard();
});

function setCurrentDate() {
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

async function loadUserInfo() {
    try {
        const res = await fetch(`${API}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.user) {
            document.getElementById('userName').textContent = data.user.name;
            const roleEl = document.getElementById('userRole');
            roleEl.textContent = formatRole(data.user.role);
            roleEl.className = `role-badge role-${data.user.role}`;
        }
    } catch (err) {
        console.error('Error loading user:', err);
    }
}

async function loadDashboard() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('dashboardContent').style.display = 'none';

    try {
        const res = await fetch(`${API}/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();

        if (result.success) {
            const d = result.data;
            updateStats(d);
            renderCharts(d);
            renderTodaySchedules(d.todaySchedules);
            renderVehicleUtilization(d.vehicleUtilization);
            renderRecentActivity(d.recentActivity);
            renderAlerts(d);

            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'block';
        }
    } catch (err) {
        document.getElementById('loadingState').innerHTML =
            '<i class="fas fa-exclamation-circle" style="font-size:32px; color:#ef4444;"></i><p style="color:#ef4444; margin-top:16px;">Failed to load dashboard. Make sure backend is running.</p>';
    }
}

function updateStats(d) {
    // Vehicles
    document.getElementById('totalVehicles').textContent = d.vehicles.total || 0;
    document.getElementById('activeVehicles').textContent = `${d.vehicles.active || 0} active`;

    // Drivers
    document.getElementById('totalDrivers').textContent = d.drivers.total || 0;
    document.getElementById('availableDrivers').textContent = `${d.drivers.available || 0} available`;

    // Routes
    document.getElementById('totalRoutes').textContent = d.routes.total || 0;
    document.getElementById('activeRoutes').textContent = `${d.routes.active || 0} active`;

    // Schedules
    document.getElementById('todaySchedules').textContent = d.schedules.today || 0;
    document.getElementById('ongoingSchedules').textContent = `${d.schedules.ongoing || 0} ongoing`;

    // Fuel
    document.getElementById('totalFuelCost').textContent = `Rs.${Number(d.fuel.totalCost || 0).toLocaleString()}`;
    document.getElementById('totalFuelAmount').textContent = `${d.fuel.totalFuel || 0}L used`;

    // Maintenance
    document.getElementById('pendingMaintenance').textContent = d.maintenance.pending || 0;
    document.getElementById('dueSoonMaintenance').textContent = `${d.maintenance.due_soon || 0} due soon`;
}

function renderCharts(d) {
    // Schedule Status Pie Chart
    if (scheduleStatusChart) scheduleStatusChart.destroy();
    const schedCtx = document.getElementById('scheduleStatusChart').getContext('2d');
    scheduleStatusChart = new Chart(schedCtx, {
        type: 'doughnut',
        data: {
            labels: ['Scheduled', 'Ongoing', 'Completed', 'Delayed', 'Cancelled'],
            datasets: [{
                data: [
                    d.schedules.scheduled || 0,
                    d.schedules.ongoing || 0,
                    d.schedules.completed || 0,
                    d.schedules.delayed || 0,
                    d.schedules.cancelled || 0
                ],
                backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#6b7280'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            cutout: '65%'
        }
    });

    // Vehicle Status Doughnut Chart
    if (vehicleStatusChart) vehicleStatusChart.destroy();
    const vehCtx = document.getElementById('vehicleStatusChart').getContext('2d');
    vehicleStatusChart = new Chart(vehCtx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Maintenance', 'Inactive'],
            datasets: [{
                data: [
                    d.vehicles.active || 0,
                    d.vehicles.maintenance || 0,
                    d.vehicles.inactive || 0
                ],
                backgroundColor: ['#10b981', '#f59e0b', '#6b7280'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            cutout: '65%'
        }
    });

    // Route Types Bar Chart
    if (routeTypesChart) routeTypesChart.destroy();
    const routeCtx = document.getElementById('routeTypesChart').getContext('2d');
    routeTypesChart = new Chart(routeCtx, {
        type: 'bar',
        data: {
            labels: ['Urban', 'Rural', 'Long Distance', 'Express'],
            datasets: [{
                label: 'Routes',
                data: [
                    d.routes.urban || 0,
                    d.routes.rural || 0,
                    d.routes.long_distance || 0,
                    d.routes.express || 0
                ],
                backgroundColor: ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });

    // Schedule Trend Line Chart
    if (scheduleTrendChart) scheduleTrendChart.destroy();
    const trendCtx = document.getElementById('scheduleTrendChart').getContext('2d');
    const trendLabels = d.scheduleTrend.map(t => t.month);
    scheduleTrendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: trendLabels,
            datasets: [
                {
                    label: 'Total',
                    data: d.scheduleTrend.map(t => t.total),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Completed',
                    data: d.scheduleTrend.map(t => t.completed),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Cancelled',
                    data: d.scheduleTrend.map(t => t.cancelled),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderTodaySchedules(schedules) {
    const tbody = document.getElementById('todaySchedulesTable');

    if (!schedules || schedules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#6b7280; padding:20px;">No schedules for today</td></tr>';
        return;
    }

    tbody.innerHTML = schedules.map(s => `
        <tr>
            <td>
                <strong>${s.routeCode}</strong><br>
                <small style="color:#6b7280;">${s.startPoint} → ${s.endPoint}</small>
            </td>
            <td>${s.registrationNo}</td>
            <td>${s.driverName}</td>
            <td>${s.departureTime}</td>
            <td><span class="status-badge status-schedule-${s.status}">${formatScheduleStatus(s.status)}</span></td>
        </tr>
    `).join('');
}

function renderVehicleUtilization(vehicles) {
    const tbody = document.getElementById('vehicleUtilizationTable');

    if (!vehicles || vehicles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#6b7280; padding:20px;">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = vehicles.map(v => {
        const rate = v.totalTrips > 0
            ? Math.round((v.completedTrips / v.totalTrips) * 100)
            : 0;

        return `
            <tr>
                <td>
                    <strong>${v.registrationNo}</strong><br>
                    <small style="color:#6b7280;">${v.model}</small>
                </td>
                <td>${v.totalTrips}</td>
                <td>${v.completedTrips}</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${rate}%"></div>
                    </div>
                    <small>${rate}%</small>
                </td>
            </tr>
        `;
    }).join('');
}

function renderRecentActivity(activities) {
    const container = document.getElementById('recentActivityList');

    if (!activities || activities.length === 0) {
        container.innerHTML = '<p style="color:#6b7280; padding:16px;">No recent activity.</p>';
        return;
    }

    container.innerHTML = activities.map(a => `
        <div class="activity-item">
            <div class="activity-icon activity-${a.action.toLowerCase()}">
                <i class="fas fa-${getActivityIcon(a.action)}"></i>
            </div>
            <div class="activity-content">
                <p><strong>${a.userName || 'System'}</strong> — ${a.description || a.action + ' in ' + a.module}</p>
                <small style="color:#9ca3af;">${formatDateTime(a.createdAt)}</small>
            </div>
        </div>
    `).join('');
}

function renderAlerts(d) {
    const container = document.getElementById('alertsSection');
    const alerts = [];

    if (d.drivers.expiring_soon > 0) {
        alerts.push(`
            <div class="dashboard-alert alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>${d.drivers.expiring_soon} driver license(s)</strong> expiring within 30 days.
                <a href="drivers.html">View Drivers</a>
            </div>
        `);
    }

    if (d.maintenance.due_soon > 0) {
        alerts.push(`
            <div class="dashboard-alert alert-warning">
                <i class="fas fa-wrench"></i>
                <strong>${d.maintenance.due_soon} vehicle(s)</strong> have maintenance due within 7 days.
                <a href="maintenance.html">View Maintenance</a>
            </div>
        `);
    }

    if (d.vehicles.maintenance > 0) {
        alerts.push(`
            <div class="dashboard-alert alert-info">
                <i class="fas fa-bus"></i>
                <strong>${d.vehicles.maintenance} vehicle(s)</strong> currently under maintenance.
                <a href="vehicles.html">View Vehicles</a>
            </div>
        `);
    }

    if (d.schedules.delayed > 0) {
        alerts.push(`
            <div class="dashboard-alert alert-danger">
                <i class="fas fa-clock"></i>
                <strong>${d.schedules.delayed} trip(s)</strong> are currently delayed.
                <a href="schedules.html">View Schedules</a>
            </div>
        `);
    }

    container.innerHTML = alerts.join('');
}

// Helpers
function formatRole(role) {
    const map = { admin: 'Admin', supervisor: 'Supervisor', operator: 'Operator' };
    return map[role] || role;
}

function formatScheduleStatus(status) {
    const map = {
        scheduled: 'Scheduled',
        ongoing: 'Ongoing',
        completed: 'Completed',
        delayed: 'Delayed',
        cancelled: 'Cancelled'
    };
    return map[status] || status;
}

function getActivityIcon(action) {
    const map = {
        CREATE: 'plus-circle',
        UPDATE: 'edit',
        DELETE: 'trash',
        LOGIN: 'sign-in-alt',
        LOGOUT: 'sign-out-alt'
    };
    return map[action] || 'circle';
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-GB');
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}