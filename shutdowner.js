const nodeCmd = require('node-cmd');

const delayArgument = process.argv[2];
let timer = delayArgument;

console.log('Naciśnij CTRL + C by anulować');

const interval = setInterval(() => {
  console.log(`Komputer wyłączy się za : ${timer} sekund`);
  if (timer === 0) {
    clearInterval(interval);
    shutdownPC();
  }
  timer--;
}, 1000);

const shutdownPC = () => {
  nodeCmd.get('shutdown -s -t 00', (err, data, stderr) => console.log(err, data, stderr));
};
