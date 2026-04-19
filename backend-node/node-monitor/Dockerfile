FROM node:16.14 AS dist 
WORKDIR /usr/src/app

COPY package.json yarn.lock ./ 

RUN yarn
COPY . . 
CMD [ "yarn", "start" ]
