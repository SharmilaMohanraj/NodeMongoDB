FROM node:20.18.1-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY .env.example ./.env.example
EXPOSE 8000
ENV PORT=8000
CMD ["npm", "start"]
