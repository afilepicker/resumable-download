This is to illustrate that chromium blows up on memory usage

To run it (you need to install express). 
```
npm i
```
Running the app will first generate a random 5GiB large file to `public/random.bin` and then run a localhost server at a random port, that you can open and test with different browsers

to run
```
node index.js
```

chromium issue: https://bugs.chromium.org/p/chromium/issues/detail?id=1334778
