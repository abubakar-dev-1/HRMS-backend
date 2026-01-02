const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Employee = require('../src/models/Employee');
const Leave = require('../src/models/Leave');
const leaveRoutes = require('../src/routes/leaves');

// Create Express app for testing
const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/leaves', leaveRoutes);
  return app;
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

describe('Leave Controller', () => {
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
    });
  });

  describe('GET /api/v1/leaves', () => {
    beforeEach(async () => {
      await Leave.create([
        {
          employeeId: employee._id,
          leaveType: 'annual',
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-17'),
          totalDays: 3,
          reason: 'Vacation',
          status: 'pending',
        },
        {
          employeeId: employee._id,
          leaveType: 'sick',
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-02-02'),
          totalDays: 2,
          reason: 'Medical appointment',
          status: 'approved',
        },
      ]);
    });

    it('should get all leaves', async () => {
      const res = await request(app)
        .get('/api/v1/leaves')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/leaves?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('pending');
    });

    it('should filter by leave type', async () => {
      const res = await request(app)
        .get('/api/v1/leaves?type=sick')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].leaveType).toBe('sick');
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/leaves');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/leaves/:id', () => {
    let leave;

    beforeEach(async () => {
      leave = await Leave.create({
        employeeId: employee._id,
        leaveType: 'annual',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        totalDays: 3,
        reason: 'Vacation',
      });
    });

    it('should get single leave', async () => {
      const res = await request(app)
        .get(`/api/v1/leaves/${leave._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reason).toBe('Vacation');
    });

    it('should return 404 for non-existent leave', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .get(`/api/v1/leaves/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/leaves', () => {
    it('should create leave request', async () => {
      const res = await request(app)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: employee._id,
          leaveType: 'annual',
          startDate: new Date('2024-03-01'),
          endDate: new Date('2024-03-03'),
          totalDays: 3,
          reason: 'Family event',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reason).toBe('Family event');
      expect(res.body.data.status).toBe('pending');
    });

    it('should fail without employeeId', async () => {
      const res = await request(app)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          leaveType: 'annual',
          startDate: new Date('2024-03-01'),
          endDate: new Date('2024-03-03'),
          reason: 'Family event',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/leaves/:id', () => {
    let leave;

    beforeEach(async () => {
      leave = await Leave.create({
        employeeId: employee._id,
        leaveType: 'annual',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        totalDays: 3,
        reason: 'Vacation',
        status: 'pending',
      });
    });

    it('should update pending leave', async () => {
      const res = await request(app)
        .patch(`/api/v1/leaves/${leave._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Updated reason',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.reason).toBe('Updated reason');
    });

    it('should fail to update non-pending leave', async () => {
      await Leave.findByIdAndUpdate(leave._id, { status: 'approved' });

      const res = await request(app)
        .patch(`/api/v1/leaves/${leave._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Updated reason' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('processed');
    });
  });

  describe('PATCH /api/v1/leaves/:id/approve', () => {
    let leave;

    beforeEach(async () => {
      leave = await Leave.create({
        employeeId: employee._id,
        leaveType: 'annual',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        totalDays: 3,
        reason: 'Vacation',
        status: 'pending',
      });
    });

    it('should approve leave', async () => {
      const res = await request(app)
        .patch(`/api/v1/leaves/${leave._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comments: 'Approved' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });

    it('should fail to approve already processed leave', async () => {
      await Leave.findByIdAndUpdate(leave._id, { status: 'approved' });

      const res = await request(app)
        .patch(`/api/v1/leaves/${leave._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/leaves/:id/reject', () => {
    let leave;

    beforeEach(async () => {
      leave = await Leave.create({
        employeeId: employee._id,
        leaveType: 'annual',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        totalDays: 3,
        reason: 'Vacation',
        status: 'pending',
      });
    });

    it('should reject leave', async () => {
      const res = await request(app)
        .patch(`/api/v1/leaves/${leave._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Not enough coverage' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rejected');
    });
  });

  describe('DELETE /api/v1/leaves/:id', () => {
    let leave;

    beforeEach(async () => {
      leave = await Leave.create({
        employeeId: employee._id,
        leaveType: 'annual',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        totalDays: 3,
        reason: 'Vacation',
        status: 'pending',
      });
    });

    it('should delete pending leave', async () => {
      const res = await request(app)
        .delete(`/api/v1/leaves/${leave._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail to delete processed leave', async () => {
      await Leave.findByIdAndUpdate(leave._id, { status: 'approved' });

      const res = await request(app)
        .delete(`/api/v1/leaves/${leave._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/leaves/stats', () => {
    beforeEach(async () => {
      await Leave.create([
        {
          employeeId: employee._id,
          leaveType: 'annual',
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-17'),
          totalDays: 3,
          reason: 'Vacation',
          status: 'pending',
        },
        {
          employeeId: employee._id,
          leaveType: 'sick',
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-02-02'),
          totalDays: 2,
          reason: 'Medical',
          status: 'approved',
        },
        {
          employeeId: employee._id,
          leaveType: 'personal',
          startDate: new Date('2024-03-01'),
          endDate: new Date('2024-03-01'),
          totalDays: 1,
          reason: 'Personal matter',
          status: 'rejected',
        },
      ]);
    });

    it('should get leave stats', async () => {
      const res = await request(app)
        .get('/api/v1/leaves/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pending).toBe(1);
      expect(res.body.data.approved).toBe(1);
      expect(res.body.data.rejected).toBe(1);
      expect(res.body.data.total).toBe(3);
    });
  });
});
