FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Copy the server
COPY cloudrun-server.mjs ./

EXPOSE 8080

CMD ["node", "cloudrun-server.mjs"]
