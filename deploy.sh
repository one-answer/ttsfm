#!/bin/bash
VERSION=${1:-v2}
docker build --no-cache  .  -t aolifu/ttsfm:$VERSION
docker push aolifu/ttsfm:$VERSION
docker stop ttsfm
docker rm ttsfm
docker run -d --name ttsfm -p 11017:7000 aolifu/ttsfm:$VERSION