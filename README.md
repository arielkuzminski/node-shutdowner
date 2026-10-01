# shutdowner

Odlicza podany czas i wyłącza komputer. Działa na Windows, Linux (systemd), macOS i WSL. Wymaga Node.js ≥ 22.18, nie ma zależności runtime.

```bash
node src/cli.ts --minutes 30             # wyłącz za 30 minut
node src/cli.ts -m 1 -s 30               # za 1,5 minuty
node src/cli.ts --seconds 10 --dry-run   # próbnie: odlicza i tylko wypisuje komendę
node src/cli.ts --help
```

Ctrl+C anuluje odliczanie.

Komendę `shutdowner` można zainstalować globalnie przez `npm link` w katalogu repo. `npm install -g` nie zadziała, bo Node nie uruchamia plików `.ts` z `node_modules`.

| System  | Komenda                                                |
| ------- | ------------------------------------------------------ |
| Windows | `shutdown /s /t 0`                                     |
| WSL     | `shutdown.exe /s /t 0` (wyłącza hosta Windows)         |
| Linux   | `systemctl poweroff`                                   |
| macOS   | `osascript -e 'tell app "System Events" to shut down'` |
