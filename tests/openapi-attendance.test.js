const { spec } = require('../src/openapi');

const collectSchemaRefs = (value, refs = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSchemaRefs(item, refs));
  } else if (value && typeof value === 'object') {
    if (typeof value.$ref === 'string' && value.$ref.startsWith('#/components/schemas/')) refs.push(value.$ref);
    Object.values(value).forEach((item) => collectSchemaRefs(item, refs));
  }
  return refs;
};

describe('scheduled attendance OpenAPI', () => {
  test('documents server-timed check-in without a request body or unresolved schema reference', () => {
    const operation = spec.paths['/attendance/check-in'].post;

    expect(operation).not.toHaveProperty('requestBody');
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation.servers).toEqual([{ url: '/api', description: 'Scheduling API base path' }]);
    expect(operation.responses).toHaveProperty('201');
    expect(operation.responses[201].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/Attendance');

    const refs = collectSchemaRefs(spec);
    expect(refs).not.toContain('#/components/schemas/AttendanceTimeInput');
    refs.forEach((reference) => {
      const name = reference.slice('#/components/schemas/'.length);
      expect(spec.components.schemas).toHaveProperty(name);
    });
  });
});
