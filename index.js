const express = require('express');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Create MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Connect to database
db.connect((err) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to database.');
});

// Basic API to check server
app.get('/', (req, res) => {
  res.send('Welcome to School Management API');
});

// POST /addSchool - Add a new school
app.post('/addSchool', (req, res) => {
  const { name, address, latitude, longitude } = req.body;

  // Validation
  if (!name || !address || !latitude || !longitude) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ error: 'Latitude and Longitude must be valid numbers' });
  }

  const sql = 'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)';
  const values = [name, address, latitude, longitude];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error inserting data:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({ message: 'School added successfully', schoolId: result.insertId });
  });
});

// GET /listSchools - List all schools sorted by proximity
app.get('/listSchools', (req, res) => {
  const { lat, lon } = req.query;

  // Validation for latitude and longitude query params
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and Longitude query parameters are required' });
  }

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Latitude and Longitude must be valid numbers' });
  }

  // Haversine formula to calculate distance between two geographical points
  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const sql = 'SELECT id, name, address, latitude, longitude FROM schools';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching data:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Calculate distance for each school and add it to the result
    const schoolsWithDistance = results.map(school => {
      const distance = haversine(lat, lon, school.latitude, school.longitude);
      return { ...school, distance };
    });

    // Sort schools by distance in ascending order
    const sortedSchools = schoolsWithDistance.sort((a, b) => a.distance - b.distance);

    console.log("Sorted Schools (by Distance):", sortedSchools);

    // Send the sorted list of schools
    res.json(sortedSchools);
    
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
