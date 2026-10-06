const express = require('express');
const { z } = require('zod');
const { validate } = require('./middleware');
const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) }).strict();
const createAuthRouter = (service) => { const router = express.Router(); router.post('/login', validate(schema), async (req, res) => res.json({ data: await service.login(req.body) })); return router; };
module.exports = { createAuthRouter };
