#!/bin/bash

source $NVM_DIR/nvm.sh;
nvm exec lts/dubnium ares-package --no-minify -o build -e *.test.js dist
