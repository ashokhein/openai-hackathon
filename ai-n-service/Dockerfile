FROM node:18.12.0 as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

RUN yarn install

COPY . .

RUN yarn build

FROM node:18.12.0-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock tsconfig.json .env.example ./

RUN yarn install --production

COPY --from=builder /usr/src/app/dist ./dist

CMD [ "yarn", "start" ]