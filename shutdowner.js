const nodeCmd = require('node-cmd');

const delayArgument = process.argv[2];

if (!delayArgument) {
  console.error('Proszę podaj czas w minutach i spróbuj ponownie.');
  return false;
}

let timer = delayArgument * 60;

console.log('Naciśnij CTRL + C by anulować');

const interval = setInterval(() => {
  let minutes = Math.floor(timer / 60);
  let seconds = (timer % 60);
  console.log(`Komputer wyłączy się za : ${minutes} minut, ${seconds} sekund`);
  if (timer === 0) {
    clearInterval(interval);
    shutdownPC();
  }
  timer--;
}, 1000);

const shutdownPC = () => {
  nodeCmd.get('shutdown -s -t 00', (err, data, stderr) => console.log(err, data, stderr));
};
