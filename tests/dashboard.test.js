const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Employee = require('../src/models/Employee');
const Department = require('../src/models/Department');
const Leave = require('../src/models/Leave');
const Attendance = require('../src/models/Attendance');
const dashboardRoutes = require('../src/routes/dashboard');

// Create Express app for testing
const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/dashboard', dashboardRoutes);
  return app;
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

describe('Dashboard Controller', () => {
  let app;
  let adminUser;
  let adminToken;
  let department;
  let employee;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    app = createApp();
  });

  beforeEach(async () => {
    // Create department
    department = await Department.create({
      name: 'Engineering',
      code: 'ENG',
      description: 'Engineering Department',
      isActive: true,
    });

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
      departmentId: department._id,
      status: 'active',
    });
  });

  describe('GET /api/v1/dashboard/stats', () => {
    it('should get dashboard stats', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalEmployees');
      expect(res.body.data).toHaveProperty('activeEmployees');
      expect(res.body.data).toHaveProperty('presentToday');
      expect(res.body.data).toHaveProperty('onLeaveToday');
      expect(res.body.data).toHaveProperty('pendingLeaves');
      expect(res.body.data).toHaveProperty('totalDepartments');
    });

    it('should count employees correctly', async () => {
      // Add another employee
      await Employee.create({
        employeeCode: 'EMP-0002',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        dateOfJoining: new Date(),
        departmentId: department._id,
        status: 'active',
      });

      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalEmployees).toBe(2);
      expect(res.body.data.activeEmployees).toBe(2);
    });

    it('should count pending leaves', async () => {
      await Leave.create({
        employeeId: employee._id,
        leaveType: 'annual',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        totalDays: 3,
        reason: 'Vacation',
        status: 'pending',
      });

      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pendingLeaves).toBe(1);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/dashboard/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/dashboard/activities', () => {
    beforeEach(async () => {
      // Create some leave requests
      await Leave.create({
        employeeId: employee._id,
        leaveType: 'annual',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        totalDays: 3,
        reason: 'Vacation',
        status: 'pending',
      });

      // Create some attendance records
      await Attendance.create({
        employeeId: employee._id,
        date: new Date(),
        clockIn: new Date(),
        status: 'present',
      });
    });

    it('should get recent activities', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/activities')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should limit activities', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/activities?limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/dashboard/activities');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/dashboard/upcoming-leaves', () => {
    beforeEach(async () => {
      // Create future approved leave
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const endDate = new Date(futureDate);
      endDate.setDate(endDate.getDate() + 3);

      await Leave.create({
        employeeId: employee._id,
        leaveType: 'annual',
        startDate: futureDate,
        endDate: endDate,
        totalDays: 4,
        reason: 'Vacation',
        status: 'approved',
      });
    });

    it('should get upcoming leaves', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/upcoming-leaves')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should only show approved leaves', async () => {
      // Add a pending leave
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      await Leave.create({
        employeeId: employee._id,
        leaveType: 'sick',
        startDate: futureDate,
        endDate: futureDate,
        totalDays: 1,
        reason: 'Medical',
        status: 'pending',
      });

      const res = await request(app)
        .get('/api/v1/dashboard/upcoming-leaves')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Should only have 1 approved leave, not the pending one
      expect(res.body.data.length).toBe(1);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/dashboard/upcoming-leaves');
      expect(res.status).toBe(401);
    });
  });
});
