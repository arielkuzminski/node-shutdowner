const nodeCmd = require('node-cmd');

const delayArgument = process.argv[2];
let timer = delayArgument;

const interval = setInterval(() => {
    console.log(`Komputer wyłączy się za : ${timer} sekund`);
    if (timer === 0) {
        clearInterval(interval);
    }
    timer--;
}, 1000)
