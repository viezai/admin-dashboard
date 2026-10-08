import express from 'express';
import {
  insertContact,
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
  exportAllContacts
} from '../db.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { dispatchNewContactWebhook } from '../services/webhook.js';

const router = express.Router();

// Rate limiter for contact submissions: 10 requests / 5 minutes per IP
const contactSubmissionLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
  message: 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng đợi 5 phút trước khi thử lại.'
});

/**
 * POST /api/contacts
 * Public Contact Ingestion from Landing Page
 */
router.post('/', contactSubmissionLimiter, async (req, res) => {
  try {
    const {
      name,
      fullName,
      email,
      company,
      need,
      message,
      website,      // Honeypot field 1
      hp_check      // Honeypot field 2
    } = req.body || {};

    // 1. Honeypot check (Spam protection)
    if (website || hp_check) {
      // Silently respond with success to trick automated spam bots
      return res.status(200).json({
        success: true,
        message: 'Cảm ơn bạn! Yêu cầu tư vấn giải pháp đã được tiếp nhận thành công.'
      });
    }

    // 2. Normalize and Validate fields
    const resolvedName = (fullName || name || '').trim();
    const resolvedEmail = (email || '').trim().toLowerCase();
    const resolvedCompany = (company || '').trim();
    const resolvedNeed = (need || 'General AI Agent Consultation').trim();
    const resolvedMessage = (message || '').trim();

    if (!resolvedName) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp Họ và Tên.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!resolvedEmail || !emailRegex.test(resolvedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp địa chỉ Email hợp lệ.'
      });
    }

    if (!resolvedCompany) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp Tên Doanh nghiệp hoặc Tổ chức.'
      });
    }

    // Capture metadata
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // 3. Save to SQLite
    const newContact = insertContact({
      fullName: resolvedName,
      email: resolvedEmail,
      company: resolvedCompany,
      need: resolvedNeed,
      message: resolvedMessage,
      ip,
      userAgent
    });

    // 4. Trigger Webhook asynchronously
    dispatchNewContactWebhook(newContact);

    return res.status(201).json({
      success: true,
      message: 'Cảm ơn bạn! Yêu cầu tư vấn giải pháp đã được tiếp nhận thành công.',
      leadId: newContact.id,
      data: newContact
    });
  } catch (err) {
    console.error('[API Contacts] Ingestion error:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi máy chủ nội bộ khi xử lý form liên hệ.'
    });
  }
});

/**
 * GET /api/contacts
 * Protected list contacts with filters, search, and pagination
 */
router.get('/', requireAdminAuth, (req, res) => {
  try {
    const { search = '', status = 'all', page = 1, limit = 20 } = req.query;
    const result = getContacts({ search, status, page, limit });
    return res.json({
      success: true,
      data: result.contacts,
      pagination: result.pagination
    });
  } catch (err) {
    console.error('[API Contacts] List error:', err);
    return res.status(500).json({ success: false, error: 'Lỗi khi tải danh sách liên hệ.' });
  }
});

/**
 * GET /api/contacts/export/csv
 * Protected CSV Export with UTF-8 BOM
 */
router.get('/export/csv', requireAdminAuth, (req, res) => {
  try {
    const contacts = exportAllContacts();

    // CSV header row
    const headers = ['ID', 'Họ Tên', 'Email', 'Doanh Nghiệp', 'Nhu Cầu', 'Lời Nhắn', 'Trạng Thái', 'Ghi Chú', 'Địa Chỉ IP', 'Ngày Gửi'];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const clean = String(str).replace(/"/g, '""').replace(/\r\n|\r|\n/g, ' ');
      return `"${clean}"`;
    };

    const rows = contacts.map(c => [
      c.id,
      escapeCsv(c.full_name),
      escapeCsv(c.email),
      escapeCsv(c.company),
      escapeCsv(c.need),
      escapeCsv(c.message),
      escapeCsv(c.status),
      escapeCsv(c.notes),
      escapeCsv(c.ip_address),
      escapeCsv(c.created_at)
    ].join(','));

    // UTF-8 BOM (﻿) ensures Excel renders Vietnamese characters correctly
    const csvContent = '﻿' + [headers.join(','), ...rows].join('\n');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="viezai-leads-${dateStr}.csv"`);
    return res.send(csvContent);
  } catch (err) {
    console.error('[API Contacts] CSV export error:', err);
    return res.status(500).json({ success: false, error: 'Lỗi khi xuất file CSV.' });
  }
});

/**
 * GET /api/contacts/:id
 * Protected single contact details
 */
router.get('/:id', requireAdminAuth, (req, res) => {
  try {
    const contact = getContactById(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy liên hệ này.' });
    }
    return res.json({ success: true, data: contact });
  } catch (err) {
    console.error('[API Contacts] Detail error:', err);
    return res.status(500).json({ success: false, error: 'Lỗi khi tải chi tiết liên hệ.' });
  }
});

/**
 * PATCH /api/contacts/:id
 * Protected update contact status and internal notes
 */
router.patch('/:id', requireAdminAuth, (req, res) => {
  try {
    const { status, notes } = req.body || {};

    const validStatuses = ['new', 'contacting', 'completed', 'archived'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Trạng thái không hợp lệ. Phải là một trong: ${validStatuses.join(', ')}`
      });
    }

    const updated = updateContact(req.params.id, { status, notes });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy liên hệ để cập nhật.' });
    }

    return res.json({
      success: true,
      message: 'Cập nhật liên hệ thành công.',
      data: updated
    });
  } catch (err) {
    console.error('[API Contacts] Update error:', err);
    return res.status(500).json({ success: false, error: 'Lỗi khi cập nhật liên hệ.' });
  }
});

/**
 * DELETE /api/contacts/:id
 * Protected delete contact
 */
router.delete('/:id', requireAdminAuth, (req, res) => {
  try {
    const success = deleteContact(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy liên hệ để xóa.' });
    }
    return res.json({ success: true, message: 'Đã xóa liên hệ thành công.' });
  } catch (err) {
    console.error('[API Contacts] Delete error:', err);
    return res.status(500).json({ success: false, error: 'Lỗi khi xóa liên hệ.' });
  }
});

export default router;