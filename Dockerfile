# Stage 1: Use an official Node.js runtime as a parent image.
# Using 'alpine' results in a smaller, more secure final image.
FROM node:18-alpine AS base

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker's layer caching.
# This layer only gets rebuilt if these files change.
COPY package*.json ./

# Stage 2: Install production dependencies
FROM base AS dependencies
# Install only production dependencies using 'npm ci' for faster, more reliable builds
RUN npm ci --only=production

# Stage 3: Build the final application image
FROM base AS release
# Copy the installed dependencies from the 'dependencies' stage
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
# Copy the rest of your application's source code
COPY . .

# The app binds to port 3000, so we'll expose it
EXPOSE 3000

# Define the command to run your app
CMD [ "node", "index.js" ]