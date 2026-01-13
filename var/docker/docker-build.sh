#!/bin/bash

set -o xtrace

docker rmi localhost/growchief || true
docker build --target dist -t localhost/growchief -f Dockerfile .
docker build --target devcontainer -t localhost/growchief-devcontainer -f Dockerfile .
