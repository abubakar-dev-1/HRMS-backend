const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Employee = require('../src/models/Employee');
const departmentRoutes = require('../src/routes/departments');

// Create Express app for testing
const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/departments', departmentRoutes);
  return app;
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

describe('Department Controller', () => {
  let app;
  let adminUser;
  let adminToken;

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
  });

  describe('GET /api/v1/departments', () => {
    beforeEach(async () => {
      await Department.create([
        { name: 'Engineering', code: 'ENG', description: 'Engineering Dept' },
        { name: 'Marketing', code: 'MKT', description: 'Marketing Dept' },
      ]);
    });

    it('should get all departments', async () => {
      const res = await request(app)
        .get('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should include employee count', async () => {
      const dept = await Department.findOne({ code: 'ENG' });
      await Employee.create({
        employeeCode: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        dateOfJoining: new Date(),
        departmentId: dept._id,
      });

      const res = await request(app)
        .get('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const engDept = res.body.data.find(d => d.code === 'ENG');
      expect(engDept.employeeCount).toBe(1);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/departments');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/departments/:id', () => {
    let department;

    beforeEach(async () => {
      department = await Department.create({
        name: 'Engineering',
        code: 'ENG',
        description: 'Engineering Department',
      });
    });

    it('should get single department', async () => {
      const res = await request(app)
        .get(`/api/v1/departments/${department._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Engineering');
    });

    it('should return 404 for non-existent department', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .get(`/api/v1/departments/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/departments', () => {
    it('should create new department', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Finance',
          code: 'FIN',
          description: 'Finance Department',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Finance');
    });

    it('should fail with duplicate code', async () => {
      await Department.create({
        name: 'Engineering',
        code: 'ENG',
        description: 'Engineering Department',
      });

      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Engineering 2',
          code: 'ENG',
          description: 'Another Engineering',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('PATCH /api/v1/departments/:id', () => {
    let department;

    beforeEach(async () => {
      department = await Department.create({
        name: 'Engineering',
        code: 'ENG',
        description: 'Engineering Department',
      });
    });

    it('should update department', async () => {
      const res = await request(app)
        .patch(`/api/v1/departments/${department._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Software Engineering',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Software Engineering');
    });

    it('should return 404 for non-existent department', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .patch(`/api/v1/departments/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/departments/:id', () => {
    let department;

    beforeEach(async () => {
      department = await Department.create({
        name: 'Engineering',
        code: 'ENG',
        description: 'Engineering Department',
      });
    });

    it('should delete department without employees', async () => {
      const res = await request(app)
        .delete(`/api/v1/departments/${department._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail to delete department with employees', async () => {
      await Employee.create({
        employeeCode: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        dateOfJoining: new Date(),
        departmentId: department._id,
        status: 'active',
      });

      const res = await request(app)
        .delete(`/api/v1/departments/${department._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot delete');
    });

    it('should return 404 for non-existent department', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .delete(`/api/v1/departments/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
