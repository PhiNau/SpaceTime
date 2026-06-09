# Raumkrümmung durch Masse

Interaktive Web-Simulation für den Physikunterricht in der EF. Die App zeigt modellhaft, wie eine zentrale Masse ein dargestelltes Gitternetz verformt und wie Testmassen sowie Lichtstrahlen dadurch qualitativ abgelenkt werden.

## Start

```bash
npm install
npm run dev
```

Danach die angezeigte lokale Vite-Adresse im Browser öffnen.

## Veröffentlichung auf GitHub Pages

Das Projekt ist für die Project-Page `https://phinau.github.io/SpaceTime/` vorbereitet.

1. Änderungen auf den Branch `main` pushen.
2. In GitHub unter `Settings` -> `Pages` als Quelle `GitHub Actions` auswählen.
3. Der Workflow `Deploy to GitHub Pages` baut die Vite-App und veröffentlicht den Ordner `dist`.

Der wichtige Vite-Pfad steht in `vite.config.ts`:

```ts
base: "/SpaceTime/"
```

## Bedienung

- Zentralmasse, sichtbare Krümmung, Simulationsgeschwindigkeit und Lichtablenkung werden über Slider verändert.
- Der Objekttyp wird links gewählt.
- Im Canvas klicken, ziehen und loslassen, um eine Testmasse oder einen Lichtstrahl zu starten.
- Bei Testmassen bestimmt die Pfeillänge die Anfangsgeschwindigkeit.
- Bei Lichtstrahlen bestimmt die Pfeillänge nur die Richtung; die Lichtgeschwindigkeit bleibt konstant.

## Didaktischer Hinweis

Diese Simulation ist ein vereinfachtes Modell und keine exakte Rechnung der Allgemeinen Relativitätstheorie.

- Das Gitter ist ein Modellbild und die Eindellung ist nicht wörtlich zu verstehen.
- Raumzeit ist vierdimensional; gezeigt wird nur eine zweidimensionale Analogie.
- Testmassen werden mit einem Newton-ähnlichen, stabilisierten Bewegungsmodell berechnet.
- Lichtablenkung wird über ein qualitatives optisches Analogmodell didaktisch verstärkt.
- Ziel ist Veranschaulichung im Unterricht, nicht eine Forschungssimulation.

## Struktur

```text
src/
  controls.ts    UI und Mausinteraktion
  main.ts        Startpunkt und Animationsloop
  physics.ts     Vektorrechnung und Bewegungsmodelle
  renderer.ts    Canvas-Zeichnung und 2,5D-Projektion
  simulation.ts  Zustand, Objekte und Parameter
  styles.css     Layout und Gestaltung
  types.ts       Gemeinsame Typen
```
