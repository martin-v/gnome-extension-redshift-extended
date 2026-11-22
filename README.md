# Redshift Extended

Eine GNOME-Shell-Extension für das eingebaute Nachtlicht:

- Um 12:00 Uhr wird das Nachtlicht wieder aktiviert und „Bis morgen deaktivieren“
  aufgehoben. Die normale GNOME-Zeitplanung bleibt unverändert.
- Zwischen konfigurierbarem Beginn und Zielzeit werden Nachtlicht-Farbtemperatur
  und Bildschirmhelligkeit schrittweise abgesenkt. Bis zum konfigurierbaren Ende
  bleiben sie auf dem Zielwert; anschließend werden die ursprünglichen Werte
  wiederhergestellt. Das funktioniert auch über Mitternacht.

Standardmäßig läuft die Absenkung von 21:00 bis 23:00 Uhr auf 1800 K und
20 % Helligkeit; um 07:00 Uhr werden die Werte wiederhergestellt. Bereits
niedrigere Ausgangswerte werden nicht erhöht. Die Zeiten, Temperatur und
Helligkeit können in den Extension-Einstellungen geändert werden. Die Zielzeit
muss nach dem Beginn und vor dem Ende liegen; bei ungültiger Reihenfolge wird
die Absenkung ausgesetzt.

Das Nachtlicht muss nach GNOMEs eigener Zeitplanung während des gewünschten
Zeitraums aktiv sein, damit die Farbtemperatur sichtbar wirkt. Eine manuelle
Deaktivierung bleibt bis zur Reaktivierung um 12:00 Uhr bestehen. Die Extension
muss zu diesem Zeitpunkt laufen; nach einem Standby über 12:00 Uhr erfolgt die
Reaktivierung beim nächsten Aufwachen. Eine laufende Absenkung überschreibt
manuelle Änderungen; beim Ende oder Deaktivieren werden nur noch Werte
wiederhergestellt, die zuletzt von der Extension gesetzt wurden.

## Installation

Benötigt werden GNOME Shell 45–48 und der GNOME Settings Daemon. Die
Helligkeitssteuerung funktioniert nur bei von GNOME unterstützten Displays,
typischerweise eingebauten Laptop-Bildschirmen; das Nachtlicht funktioniert
unabhängig davon.

Das Repository nach
`~/.local/share/gnome-shell/extensions/redshift-extended@martin-v/` kopieren,
dann aus diesem Verzeichnis:

```sh
glib-compile-schemas schemas
gnome-extensions enable redshift-extended@martin-v
gnome-extensions prefs redshift-extended@martin-v
```

Gegebenenfalls nach dem Kopieren erneut bei GNOME anmelden, damit die Extension
erkannt wird. Beim Deaktivieren der Extension werden die zuvor gespeicherte
Farbtemperatur und Helligkeit wiederhergestellt, sofern sie nicht inzwischen
anderweitig geändert wurden.