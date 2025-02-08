#!/bin/bash

metode=$1

if [ "$metode" = "cloud" ];then
 echo "Run Cloud"
 npm install
 npm update
 #npm audit fix --force
 npm run start -- --env prod
fi

if [ "$metode" = "update" ];then
 echo "Run Update..."
 npm install
 npm update
 npm audit fix --force
fi

if [ "$metode" = "s" ];then
 echo "Run Tes Local"
 npm run dev -- --env dev
fi

if [ "$metode" = "clean" ];then
 echo "Clean node_module"
 rm -rf node_modules && npm install
fi