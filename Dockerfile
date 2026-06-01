# Sonqollay — imagen única: compila el frontend y lo sirve junto con la API APS.
# Build:  docker build -t sonqollay .
# Run:    docker run -p 3000:3000 --env-file server/.env sonqollay

# --- etapa 1: compilar el frontend ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build            # genera /app/dist

# --- etapa 2: backend que sirve dist + API ---
FROM node:20-alpine
WORKDIR /app
# deps del servidor
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev
# código del servidor y el frontend compilado
COPY server ./server
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
