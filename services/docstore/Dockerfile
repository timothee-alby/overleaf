# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment

FROM gcr.io/overleaf-ops/node:14.18.3 as base

WORKDIR /overleaf/services/docstore

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

FROM base as app

COPY package.json package-lock.json /overleaf/
COPY services/docstore/package.json /overleaf/services/docstore/
COPY libraries/ /overleaf/libraries/

RUN cd /overleaf && npm ci --quiet

COPY services/docstore/ /overleaf/services/docstore/

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
