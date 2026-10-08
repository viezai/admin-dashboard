import assert from 'node:assert/strict';
import http from 'node:http';
import { app, bootstrap } from '../server.js';
import { initDatabase } from '../src/db.js';

const ADMIN_TOKEN = process.env.ADMIN_KEY || 'viezai_admin_2026';
let server;
let baseUrl;

// Helper to make HTTP requests
function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          // Plain text / CSV
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      if (typeof options.body === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(options.body));
      } else {
        req.write(options.body);
      }
    }

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Bắt đầu chạy test suite ViezAI Admin Dashboard API...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}`);
      console.error(err);
      failed++;
    }
  }

  // Setup server
  await initDatabase();
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Health check
    await test('AC-0: Health Check endpoint phản hồi 200 OK', async () => {
      const res = await request('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.json.status, 'ok');
    });

    // 2. Ingestion validation
    await test('AC-1.1: Từ chối form thiếu thông tin bắt buộc (họ tên, email)', async () => {
      const res = await request('/api/contacts', {
        method: 'POST',
        body: { fullName: '', email: 'test@viezai.com' }
      });
      assert.equal(res.status, 400);
      assert.equal(res.json.success, false);
    });

    await test('AC-1.2: Từ chối form khi email sai định dạng', async () => {
      const res = await request('/api/contacts', {
        method: 'POST',
        body: { fullName: 'Nguyễn Văn A', email: 'invalid-email-format' }
      });
      assert.equal(res.status, 400);
      assert.equal(res.json.success, false);
    });

    await test('AC-1.3: Chặn spam Honeypot bot (website field có giá trị)', async () => {
      const res = await request('/api/contacts', {
        method: 'POST',
        body: {
          fullName: 'Spam Bot',
          email: 'bot@spam.com',
          website: 'http://spam-link.xyz',
          message: 'Buy crypto now'
        }
      });
      // Vẫn trả về 200/201 để đánh lừa bot nhưng không lưu dữ liệu
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
    });

    let createdId;
    await test('AC-1.4: Tiếp nhận form liên hệ hợp lệ thành công (201 Created)', async () => {
      const res = await request('/api/contacts', {
        method: 'POST',
        body: {
          fullName: 'Trần Minh Khang',
          email: 'khang.tran@enterprise.vn',
          company: 'Viez Technology Corp',
          need: 'Multi-Agent Orchestration & Workflow Automation',
          message: 'Chúng tôi muốn tư vấn giải pháp điều phối AI Agent cho khối Ngân hàng.'
        }
      });
      assert.equal(res.status, 201);
      assert.equal(res.json.success, true);
      assert.ok(res.json.data.id);
      createdId = res.json.data.id;
    });

    // 3. Admin Authentication
    await test('AC-2.1: Từ chối truy cập danh sách khi không có Admin Key', async () => {
      const res = await request('/api/contacts');
      assert.equal(res.status, 401);
      assert.equal(res.json.success, false);
    });

    await test('AC-2.2: Từ chối khi cung cấp Admin Key không đúng', async () => {
      const res = await request('/api/contacts', {
        headers: { 'Authorization': 'Bearer wrong_token_123' }
      });
      assert.equal(res.status, 401);
      assert.equal(res.json.success, false);
    });

    await test('AC-2.3: Cho phép truy cập khi cung cấp đúng Admin Key', async () => {
      const res = await request('/api/contacts', {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.ok(Array.isArray(res.json.data));
    });

    // 4. Contact Management & Workflow
    await test('AC-3.1: Xem chi tiết liên hệ theo ID', async () => {
      const res = await request(`/api/contacts/${createdId}`, {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.data.email, 'khang.tran@enterprise.vn');
      assert.equal(res.json.data.status, 'new');
    });

    await test('AC-3.2: Cập nhật trạng thái và ghi chú nội bộ (PATCH)', async () => {
      const res = await request(`/api/contacts/${createdId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
        body: {
          status: 'contacting',
          notes: 'Đã trao đổi qua email, hẹn demo lúc 10h thứ 6.'
        }
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);

      // Xác minh lại
      const checkRes = await request(`/api/contacts/${createdId}`, {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
      });
      assert.equal(checkRes.json.data.status, 'contacting');
      assert.equal(checkRes.json.data.notes, 'Đã trao đổi qua email, hẹn demo lúc 10h thứ 6.');
    });

    await test('AC-3.3: Lọc danh sách theo trạng thái và tìm kiếm từ khóa', async () => {
      const res = await request('/api/contacts?status=contacting&search=Khang', {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
      });
      assert.equal(res.status, 200);
      assert.ok(res.json.data.length >= 1);
      assert.equal(res.json.data[0].id, createdId);
    });

    await test('AC-3.4: Thống kê KPI Dashboard (GET /api/stats)', async () => {
      const res = await request('/api/stats', {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
      });
      assert.equal(res.status, 200);
      assert.ok(res.json.data.total >= 1);
      assert.ok(res.json.data.contacting >= 1);
    });

    // 5. CSV Export
    await test('AC-4: Xuất file CSV tiếng Việt có tiền tố UTF-8 BOM', async () => {
      const res = await request(`/api/contacts/export/csv?token=${ADMIN_TOKEN}`);
      assert.equal(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/csv'));
      // Kiểm tra UTF-8 BOM
      assert.ok(res.body.startsWith('﻿'));
      assert.ok(res.body.includes('Trần Minh Khang'));
    });

    // 6. Delete Contact
    await test('AC-3.5: Xóa lượt liên hệ thành công', async () => {
      const res = await request(`/api/contacts/${createdId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);

      // Xác minh đã bị xóa
      const checkRes = await request(`/api/contacts/${createdId}`, {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
      });
      assert.equal(checkRes.status, 404);
    });

  } finally {
    server.close();
  }

  console.log(`\n===========================================`);
  console.log(`📊 Kết quả kiểm thử: ${passed} passed, ${failed} failed`);
  console.log(`===========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Lỗi nghiêm trọng khi chạy test:', err);
  process.exit(1);
});