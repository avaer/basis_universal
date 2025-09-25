#!/bin/bash

BUILD_DIR="build"

rm -Rf "$BUILD_DIR"
mkdir "$BUILD_DIR"

cmake -S . -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD_DIR" --config Release -j
