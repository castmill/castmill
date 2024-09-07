# Step 1: Building the frontend
FROM node:20 AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock) files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy the rest of your frontend source code
COPY . .

# Build your SolidJS project
RUN npm run build

# Step 2: Setting up the Nginx server
FROM nginx:stable-alpine

# Copy the built assets from the builder stage to the Nginx serve directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Optional: If you are using client-side routing, configure Nginx to redirect all requests to your index.html
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html index.htm; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
