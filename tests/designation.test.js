const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Designation = require('../src/models/Designation');
const Department = require('../src/models/Department');
const Employee = require('../src/models/Employee');
const designationRoutes = require('../src/routes/designations');

// Create Express app for testing
const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/designations', designationRoutes);
  return app;
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

describe('Designation Controller', () => {
  let app;
  let adminUser;
  let adminToken;
  let department;

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
    });

    // Create admin user
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      isActive: true,
    });

    adminToken = generateToken(adminUser._id);
  });

  describe('GET /api/v1/designations', () => {
    beforeEach(async () => {
      await Designation.create([
        {
          title: 'Software Engineer',
          code: 'SWE',
          level: 1,
          departmentId: department._id,
          isActive: true,
        },
        {
          title: 'Senior Software Engineer',
          code: 'SSWE',
          level: 2,
          departmentId: department._id,
          isActive: true,
        },
      ]);
    });

    it('should get all designations', async () => {
      const res = await request(app)
        .get('/api/v1/designations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should filter by department', async () => {
      const res = await request(app)
        .get(`/api/v1/designations?department=${department._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by active status', async () => {
      await Designation.create({
        title: 'Intern',
        code: 'INT',
        level: 1,
        isActive: false,
      });

      const res = await request(app)
        .get('/api/v1/designations?active=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every(d => d.isActive)).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/designations');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/designations/:id', () => {
    let designation;

    beforeEach(async () => {
      designation = await Designation.create({
        title: 'Software Engineer',
        code: 'SWE',
        level: 1,
        departmentId: department._id,
      });
    });

    it('should get single designation', async () => {
      const res = await request(app)
        .get(`/api/v1/designations/${designation._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Software Engineer');
    });

    it('should return 404 for non-existent designation', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .get(`/api/v1/designations/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/designations', () => {
    it('should create new designation', async () => {
      const res = await request(app)
        .post('/api/v1/designations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Tech Lead',
          code: 'TL',
          level: 3,
          departmentId: department._id,
          description: 'Technical Lead position',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Tech Lead');
    });

    it('should fail with duplicate code', async () => {
      await Designation.create({
        title: 'Software Engineer',
        code: 'SWE',
        level: 1,
      });

      const res = await request(app)
        .post('/api/v1/designations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Another Engineer',
          code: 'SWE',
          level: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('PATCH /api/v1/designations/:id', () => {
    let designation;

    beforeEach(async () => {
      designation = await Designation.create({
        title: 'Software Engineer',
        code: 'SWE',
        level: 1,
      });
    });

    it('should update designation', async () => {
      const res = await request(app)
        .patch(`/api/v1/designations/${designation._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Software Developer',
          level: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Software Developer');
      expect(res.body.data.level).toBe(2);
    });

    it('should return 404 for non-existent designation', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .patch(`/api/v1/designations/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/designations/:id', () => {
    let designation;

    beforeEach(async () => {
      designation = await Designation.create({
        title: 'Software Engineer',
        code: 'SWE',
        level: 1,
      });
    });

    it('should delete designation without employees', async () => {
      const res = await request(app)
        .delete(`/api/v1/designations/${designation._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail to delete designation with employees', async () => {
      await Employee.create({
        employeeCode: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        dateOfJoining: new Date(),
        designationId: designation._id,
      });

      const res = await request(app)
        .delete(`/api/v1/designations/${designation._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot delete');
    });

    it('should return 404 for non-existent designation', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .delete(`/api/v1/designations/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
