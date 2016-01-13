#!/usr/bin/env bash

# RUN THIS IN THE PROJECT ROOT FOLDER TO BUILD THE XPI

rm dist/*.xpi
jpm xpi
NAME=$(echo @statuser-*.xpi)
mv "$NAME" "dist/${NAME//@}"

# set the version from `package.json`'s `"version"` field
VERSION=$(grep -o '"version"\s*:\s*"[^"]*' package.json | cut -d '"' -f 4 ) # read version from package.json
IFS=$'\n' # temporarily set the fields delimiter to newline
for f in $(find -name '*.rdf.template' -or -name '*.html.template')
do
  sed "s/{{\s*VERSION\s*}}/$VERSION/g" "$f" | sed "2s;^;<!-- AUTOMATICALLY GENERATED FROM: $f -->\n\n;" |  tee ${f%.*} > /dev/null
done
for f in $(find -name '*.md.template')
do
  sed "s/{{\s*VERSION\s*}}/$VERSION/g" "$f" | sed "1s;^;<!-- AUTOMATICALLY GENERATED FROM: $f -->\n\n;" |  tee ${f%.*} > /dev/null
done
