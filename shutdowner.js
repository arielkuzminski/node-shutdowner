const nodeCmd = require('node-cmd');

const argv = require('yargs').argv;
const delayArgument = argv.minutes;
const delayArgumentSeconds = argv.seconds;

if (!delayArgument || isNaN(delayArgument) || delayArgument < 0) {
  console.error('Proszę podaj czas w minutach i spróbuj ponownie.');
  return new Error();
}

let timer = (delayArgument * 60) + (delayArgumentSeconds || 0);

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
