// =========================================================
// Add these lines inside your existing drivers.js server file
// =========================================================

// Serves the Command Dashboard directly when navigating to http://localhost:5001/dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Optional: Fallback catch-all redirect to route empty addresses back to the dashboard loop view context
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});