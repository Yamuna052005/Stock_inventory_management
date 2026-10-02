FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY frontend ./frontend
COPY backend ./backend
RUN npm install --prefix frontend && npm run build --prefix frontend && npm install --omit=dev --prefix backend

FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
ENV NODE_ENV=production PORT=5000 DB_PATH=/data/warehouse.db FRONTEND_DIST=../frontend/dist
EXPOSE 5000
CMD ["node", "backend/src/index.js"]
