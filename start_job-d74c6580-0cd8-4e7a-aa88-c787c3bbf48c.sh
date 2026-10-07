#!/bin/sh
set -eu
: "${PORT:=8000}"
: "${MONGODB_URI:?MONGODB_URI is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
export PORT MONGODB_URI JWT_SECRET
exec npm start
