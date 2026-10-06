const { z } = require('zod');

const id = z.string().trim().regex(/^[a-fA-F0-9]{24}$/, 'Invalid resource id');
const optionalId = id.nullish();
const employeeFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  role: z.enum(['HR', 'MANAGER', 'EMPLOYEE']).default('EMPLOYEE'),
  departmentId: optionalId,
  designationId: optionalId,
  managerId: optionalId,
};
const employeeCreateSchema = z.object(employeeFields).strict();
const employeeUpdateSchema = z.object({
  firstName: employeeFields.firstName.optional(),
  lastName: employeeFields.lastName.optional(),
  email: employeeFields.email.optional(),
  password: employeeFields.password.optional(),
  role: z.enum(['HR', 'MANAGER', 'EMPLOYEE']).optional(),
  departmentId: optionalId.optional(),
  designationId: optionalId.optional(),
  managerId: optionalId.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
const idParamsSchema = z.object({ id }).strict();
const departmentCreateSchema = z.object({ name: z.string().trim().min(1).max(150), description: z.string().trim().max(1000).optional() }).strict();
const departmentUpdateSchema = departmentCreateSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
const designationCreateSchema = z.object({ name: z.string().trim().min(1).max(150), departmentId: optionalId, description: z.string().trim().max(1000).optional() }).strict();
const designationUpdateSchema = designationCreateSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
module.exports = { employeeCreateSchema, employeeUpdateSchema, departmentCreateSchema, departmentUpdateSchema, designationCreateSchema, designationUpdateSchema, idParamsSchema };
