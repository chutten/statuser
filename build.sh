#!/usr/bin/env bash

# RUN THIS IN THE PROJECT ROOT FOLDER TO BUILD THE XPI

rm dist/*.xpi
jpm xpi
NAME=$(echo @statuser-*.xpi)
mv "$NAME" "dist/${NAME//@}"
