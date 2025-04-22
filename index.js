const express = require('express');
const mysql = require('mysql2/promise'); // Using promise-based API
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Create MySQL connection pool (recommended for production)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to database');
    connection.release();
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
})();

// Basic API to check server
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to School Management API',
    status: 'running'
  });
});

// POST /addSchool - Add a new school
app.post('/addSchool', async (req, res) => {
  const { name, address, latitude, longitude } = req.body;

  // Validation
  if (!name || !address || !latitude || !longitude) {
    return res.status(400).json({ 
      success: false,
      error: 'All fields are required' 
    });
  }

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ 
      success: false,
      error: 'Latitude and Longitude must be valid numbers' 
    });
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)',
      [name, address, latitude, longitude]
    );
    
    res.status(201).json({
      success: true,
      message: 'School added successfully',
      schoolId: result.insertId
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to add school'
    });
  }
});

// GET /listSchools - List all schools sorted by proximity
app.get('/listSchools', async (req, res) => {
  const { lat, lon } = req.query;

  // Validation
  if (!lat || !lon) {
    return res.status(400).json({
      success: false,
      error: 'Latitude and Longitude query parameters are required'
    });
  }

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({
      success: false,
      error: 'Latitude and Longitude must be valid numbers'
    });
  }

  // Haversine formula
  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * 
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  try {
    const [schools] = await pool.query(
      'SELECT id, name, address, latitude, longitude FROM schools'
    );

    const schoolsWithDistance = schools.map(school => ({
      ...school,
      distance: haversine(lat, lon, school.latitude, school.longitude)
    }));

    const sortedSchools = schoolsWithDistance.sort((a, b) => a.distance - b.distance);
    
    console.log('Sorted schools:', sortedSchools);
    
    res.json({
      success: true,
      count: sortedSchools.length,
      data: sortedSchools
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schools'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});