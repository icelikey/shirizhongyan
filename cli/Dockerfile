FROM node:20-alpine

WORKDIR /worker
COPY scripts/tdg-agent-worker.mjs ./tdg-agent-worker.mjs

ENV NODE_ENV=production
CMD ["node", "tdg-agent-worker.mjs"]
