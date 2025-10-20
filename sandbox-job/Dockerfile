FROM node:20-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev
RUN npm install tsx

COPY sandbox-job ./sandbox-job
COPY shared ./shared

RUN mkdir -p node_modules/'cloudflare:workers' \
  && printf "export const env = {};\nexport default { env };\n" > node_modules/'cloudflare:workers'/index.js

ENV NODE_ENV=production

ENTRYPOINT ["npx", "tsx", "sandbox-job/index.ts"]
