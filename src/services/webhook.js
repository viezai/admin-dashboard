/**
 * Asynchronous Webhook Dispatcher
 * Sends instant notifications to Discord, Telegram or custom Webhook endpoints
 */
export async function dispatchNewContactWebhook(contact) {
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const genericWebhookUrl = process.env.GENERIC_WEBHOOK_URL;

  const payloadText = `🚀 [ViezAI Lead Mới]
• Khách hàng: ${contact.full_name}
• Email: ${contact.email}
• Doanh nghiệp: ${contact.company}
• Dịch vụ quan tâm: ${contact.need || 'Tư vấn chung'}
• Lời nhắn: ${contact.message ? contact.message.slice(0, 300) : '(Không có)'}
• Thời gian: ${contact.created_at}`;

  // 1. Discord Webhook
  if (discordUrl) {
    try {
      fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '🚀 ViezAI Landing Page — Khách hàng Đăng ký Mới',
            color: 0x10b981,
            fields: [
              { name: 'Họ và Tên', value: contact.full_name, inline: true },
              { name: 'Email', value: contact.email, inline: true },
              { name: 'Công ty', value: contact.company, inline: true },
              { name: 'Nhu cầu AI Agent', value: contact.need || 'Chưa chọn', inline: false },
              { name: 'Nội dung', value: contact.message || '(Trống)', inline: false }
            ],
            footer: { text: `Lead ID: #${contact.id} • viezai.com` },
            timestamp: new Date().toISOString()
          }]
        })
      }).catch(err => console.warn('[Webhook] Discord error:', err.message));
    } catch (e) {
      console.warn('[Webhook] Discord trigger failed:', e.message);
    }
  }

  // 2. Telegram Bot
  if (telegramBotToken && telegramChatId) {
    try {
      const tgUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
      fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: payloadText
        })
      }).catch(err => console.warn('[Webhook] Telegram error:', err.message));
    } catch (e) {
      console.warn('[Webhook] Telegram trigger failed:', e.message);
    }
  }

  // 3. Generic Webhook
  if (genericWebhookUrl) {
    try {
      fetch(genericWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'contact.created',
          data: contact
        })
      }).catch(err => console.warn('[Webhook] Generic error:', err.message));
    } catch (e) {
      console.warn('[Webhook] Generic trigger failed:', e.message);
    }
  }
}