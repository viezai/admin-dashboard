# Multi-stage lightweight Node Alpine container for ViezAI Admin Dashboard
FROM node:20-alpine AS runner

WORKDIR /app

# Thiết lập biến môi trường production
ENV NODE_ENV=production
ENV PORT=4000

# Copy package descriptors
COPY package.json ./

# Cài đặt production dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Copy toàn bộ mã nguồn
COPY . .

# Tạo thư mục data cho SQLite lưu trữ dữ liệu bền vững
RUN mkdir -p data

# Chạy với user bảo mật node
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "server.js"]