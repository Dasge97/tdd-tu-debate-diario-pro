FROM node:22-alpine

WORKDIR /workspace
ENV PATH="/workspace/bin:${PATH}"

COPY package.json ./
RUN npm install

COPY bin ./bin

RUN npm i -g opencode-ai
RUN mv /usr/local/bin/opencode /usr/local/bin/opencode.real
RUN cp /workspace/bin/opencode /usr/local/bin/opencode
RUN chmod +x /workspace/bin/entrypoint.sh /workspace/bin/opencode /usr/local/bin/opencode

ENTRYPOINT ["/workspace/bin/entrypoint.sh"]
