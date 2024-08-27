#!/bin/sh
rm -rf db || true
cd static
rm -rf images || true
rm -rf embeddings || true
rm -rf high_res_feats || true

mkdir images
mkdir embeddings
mkdir high_res_feats
cd ..

mkdir db
