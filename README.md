# iRoomba S7 Card

[![Validate](https://github.com/MEbsen/IRomba-S7-HACS-card/actions/workflows/validate.yml/badge.svg)](https://github.com/MEbsen/IRomba-S7-HACS-card/actions/workflows/validate.yml)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?logo=home-assistant-community-store)](https://hacs.xyz/docs/faq/custom_repositories/)
[![Home Assistant 2024.8+](https://img.shields.io/badge/Home%20Assistant-2024.8%2B-18BCF2.svg?logo=homeassistant&logoColor=white)](https://www.home-assistant.io/)
[![MIT License](https://img.shields.io/github/license/MEbsen/IRomba-S7-HACS-card)](LICENSE)

An animated Home Assistant dashboard card for an iRobot Roomba S7 exposed through Home Assistant's official **iRobot Roomba and Braava** integration.

> **Early development:** The first test build is `v0.1.0-dev.1`.

> **Unofficial project:** This independent community project is not affiliated with, endorsed by, or sponsored by iRobot Corporation. iRobot and Roomba are trademarks of their respective owner.

## Planned first version

- Animated states for docked, charging, cleaning, paused, returning, error and unavailable.
- Controls shown only when the selected vacuum supports them.
- Start, pause, stop, return-to-base and locate support.
- Battery, charging and bin-full information discovered from the selected Home Assistant device.
- Visual Home Assistant card editor.
- Optional mission statistics.
- Responsive design using Home Assistant theme colours.

The official Home Assistant integration does not expose the Roomba map, room zones or live position. This card intentionally focuses on status and controls and does not require Docker or a separate map service.

## Installation with HACS

[![Open your Home Assistant instance and add this repository to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=MEbsen&repository=IRomba-S7-HACS-card&category=plugin)

1. Open **HACS → Frontend**.
2. Choose **Custom repositories**.
3. Add `https://github.com/MEbsen/IRomba-S7-HACS-card`.
4. Select category **Dashboard**.
5. Install **iRoomba S7 Card** and reload the browser.

HACS normally creates the resource automatically. If needed, add:

```text
/hacsfiles/IRomba-S7-HACS-card/iroomba-s7-card.js
```

Resource type: **JavaScript module**.

## Configuration

Add **Custom: iRoomba S7 Card** and select the vacuum in the visual editor.

```yaml
type: custom:iroomba-s7-card
entity: vacuum.alfred
title: Alfred
show_stats: true
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entity` | string | required | Vacuum entity from Home Assistant. |
| `title` | string | entity name | Optional card title. |
| `show_stats` | boolean | `true` | Show mission counters discovered on the same device. |

## Development and releases

Stable code lives on `main`; active development lives on `dev`.

```bash
npm install
npm run check
```

Development prereleases are built automatically from `dev` when `CARD_VERSION` uses `X.Y.Z-dev.N`. Stable releases are created from `main` when the version is `X.Y.Z` and the final commit message is exactly `Release vX.Y.Z`.

The workflows validate syntax and HACS compatibility, build the standalone card and publish the JavaScript file as a GitHub Release asset. Existing tags are never overwritten.

## License

[MIT](LICENSE)
