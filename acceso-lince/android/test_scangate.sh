#!/bin/sh
set -eu
cd "$(dirname "$0")"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
javac -d "$T" app/src/main/java/mx/uadeo/linceguard/ScanGate.java app/src/main/java/mx/uadeo/linceguard/ScanQueue.java tests/ScanGateTest.java tests/ScanQueueTest.java
java -cp "$T" ScanGateTest
java -cp "$T" ScanQueueTest
