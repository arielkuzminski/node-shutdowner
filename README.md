# shutdowner

Odlicza podany czas i wyłącza komputer. Działa na Windows, Linux (systemd), macOS i WSL. Wymaga Node.js ≥ 22.18, nie ma zależności runtime.

```bash
node src/cli.ts --minutes 30             # wyłącz za 30 minut
node src/cli.ts -m 1 -s 30               # za 1,5 minuty
node src/cli.ts --seconds 10 --dry-run   # próbnie: odlicza i tylko wypisuje komendę
node src/cli.ts --help
```

Ctrl+C anuluje odliczanie.

## Wersja w przeglądarce

```bash
node src/cli.ts --gui              # albo: npm run gui
node src/cli.ts --gui --dry-run    # próbnie (npm run gui:dry)
node src/cli.ts --gui --port 8080  # stały port zamiast losowego
```

Program uruchamia lokalny serwer i otwiera przeglądarkę (z WSL: przeglądarkę w Windows). Na stronie ustawiasz czas, pauzujesz, wznawiasz i anulujesz.

- Odliczanie trwa w programie w terminalu, nie na stronie. Kartę można zamknąć, a odliczanie biegnie dalej. Link do ponownego otwarcia jest w terminalu, a kilka otwartych kart pokazuje ten sam stan.
- Ctrl+C w terminalu kończy program i anuluje odliczanie.
- Serwer nasłuchuje tylko na `127.0.0.1`, a link zawiera jednorazowy token. Inne strony otwarte w przeglądarce ani inne komputery w sieci nie mogą sterować odliczaniem.
- Program nie blokuje uśpienia komputera. Jeśli komputer zaśnie w trakcie odliczania, wyłączy się zaraz po wybudzeniu.

Wersja jako osobna aplikacja okienkowa: [shutdowner-electron-app](https://github.com/arielkuzminski/shutdowner-electron-app/releases/latest).

Komendę `shutdowner` można zainstalować globalnie przez `npm link` w katalogu repo. `npm install -g` nie zadziała, bo Node nie uruchamia plików `.ts` z `node_modules`.

| System  | Komenda                                                |
| ------- | ------------------------------------------------------ |
| Windows | `shutdown /s /t 0`                                     |
| WSL     | `shutdown.exe /s /t 0` (wyłącza hosta Windows)         |
| Linux   | `systemctl poweroff`                                   |
| macOS   | `osascript -e 'tell app "System Events" to shut down'` |
