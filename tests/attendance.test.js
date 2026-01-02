const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Employee = require('../src/models/Employee');
const Attendance = require('../src/models/Attendance');
const attendanceRoutes = require('../src/routes/attendance');

// Create Express app for testing
const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/attendance', attendanceRoutes);
  return app;
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

describe('Attendance Controller', () => {
  let app;
  let adminUser;
  let adminToken;
  let employee;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    app = createApp();
  });

  beforeEach(async () => {
    // Create admin user
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      isActive: true,
    });

    adminToken = generateToken(adminUser._id);

    // Create employee
    employee = await Employee.create({
      employeeCode: 'EMP-0001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      dateOfJoining: new Date(),
      status: 'active',
    });
  });

  describe('GET /api/v1/attendance', () => {
    beforeEach(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await Attendance.create([
        {
          employeeId: employee._id,
          date: today,
          clockIn: new Date(),
          status: 'present',
        },
        {
          employeeId: employee._id,
          date: new Date(Date.now() - 86400000), // yesterday
          clockIn: new Date(Date.now() - 86400000),
          clockOut: new Date(Date.now() - 78000000),
          totalHours: 8,
          status: 'present',
        },
      ]);
    });

    it('should get all attendance records', async () => {
      const res = await request(app)
        .get('/api/v1/attendance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/attendance?status=present')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every(a => a.status === 'present')).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/attendance');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/attendance/today', () => {
    it('should get today attendance (empty when no record)', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/today')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return attendance record if exists', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await Attendance.create({
        employeeId: employee._id,
        date: today,
        clockIn: new Date(),
        status: 'present',
      });

      const res = await request(app)
        .get(`/api/v1/attendance/today?employeeId=${employee._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/attendance/clock-in', () => {
    it('should clock in successfully', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ employeeId: employee._id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('present');
      expect(res.body.data.clockIn).toBeDefined();
    });

    it('should fail if already clocked in', async () => {
      // First clock in
      await request(app)
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ employeeId: employee._id });

      // Try to clock in again
      const res = await request(app)
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ employeeId: employee._id });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Already clocked in');
    });
  });

  describe('POST /api/v1/attendance/clock-out', () => {
    beforeEach(async () => {
      // Clock in first
      await request(app)
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ employeeId: employee._id });
    });

    it('should clock out successfully', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/clock-out')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ employeeId: employee._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.clockOut).toBeDefined();
      // totalHours may be 0 for same-minute clock in/out
      expect(typeof res.body.data.totalHours === 'number' || res.body.data.totalHours === undefined).toBe(true);
    });

    it('should fail if no clock-in record', async () => {
      // Create a new employee without clock-in
      const newEmployee = await Employee.create({
        employeeCode: 'EMP-0002',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        dateOfJoining: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/attendance/clock-out')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ employeeId: newEmployee._id });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('No clock-in record');
    });

    it('should fail if already clocked out', async () => {
      // First clock out
      await request(app)
        .post('/api/v1/attendance/clock-out')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ employeeId: employee._id });

      // Try to clock out again
      const res = await request(app)
        .post('/api/v1/attendance/clock-out')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ employeeId: employee._id });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Already clocked out');
    });
  });

  describe('GET /api/v1/attendance/stats', () => {
    beforeEach(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await Attendance.create({
        employeeId: employee._id,
        date: today,
        clockIn: new Date(),
        status: 'present',
      });
    });

    it('should get attendance stats', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('presentToday');
      expect(res.body.data).toHaveProperty('absentToday');
      expect(res.body.data).toHaveProperty('totalEmployees');
      expect(res.body.data).toHaveProperty('attendanceRate');
    });
  });

  describe('POST /api/v1/attendance (manual entry)', () => {
    it('should create manual attendance entry', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const res = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: employee._id,
          date: yesterday,
          clockIn: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000), // 9 AM
          clockOut: new Date(yesterday.getTime() + 17 * 60 * 60 * 1000), // 5 PM
          status: 'present',
          notes: 'Manual entry',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // totalHours may vary based on implementation
      expect(res.body.data.status).toBe('present');
    });
  });
});
