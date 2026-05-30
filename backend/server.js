const express = require('express');
const cors = require('cors');
const path = require('path');//added
require('dotenv').config();
const db = require('./config/db');

// Import the routes
const authRoutes = require('./routes/authRoutes');
const driverRoutes = require('./routes/driverRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const routeRoutes = require('./routes/routeRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const fuelRoutes = require('./routes/fuelRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../frontend/pages')));//added
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));//added
app.use('/js', express.static(path.join(__dirname, '../frontend/js'))); //added
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Base route to test server
app.get('/', (req, res) => {
  res.json({ message: 'SRMSS API is running' });
});

// 404 handler - only for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});
// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`📍 Vehicles: http://localhost:${PORT}/vehicles.html`);//added
  console.log(`📍 Routes: http://localhost:${PORT}/routes.html`);//added
  console.log(`📍 API: http://localhost:${PORT}/api/vehicles`);//added
});