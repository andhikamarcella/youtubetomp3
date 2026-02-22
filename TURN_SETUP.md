# TURN (coturn) untuk Voice Call Forum

## 1) Jalankan coturn

### Opsi A: VPS + Docker

1. Siapkan env:

- `TURN_SHARED_SECRET` = string random panjang (minimal 32 char)
- `TURN_REALM` = domain/IP coturn (contoh: `turn.example.com`)

2. Jalankan:

```bash
cd coturn
TURN_SHARED_SECRET="..." TURN_REALM="turn.example.com" docker compose up -d
```

3. Buka port di firewall/security-group:

- `3478/udp`
- `5349/udp` (opsional)
- Relay range: `49160-49200/udp`

### Opsi B: Tanpa Docker

Install `coturn`, lalu gunakan konfigurasi setara dengan `coturn/turnserver.conf`.

## 2) Set ENV di backend (Railway)

Tambahkan env berikut:

- `TURN_SHARED_SECRET` (harus sama dengan coturn)
- `TURN_URLS`
  - contoh UDP: `turn:turn.example.com:3478?transport=udp`
  - kalau mau TCP juga: `turn:turn.example.com:3478?transport=tcp`
  - kalau lebih dari satu, pisahkan koma
- `TURN_TTL_SECONDS` (opsional, default 21600)

Backend akan melayani `GET /api/turn-credentials` dan mengembalikan `iceServers` berisi TURN time-limited.

## 3) Cara kerja (singkat)

- coturn mode `use-auth-secret` memakai username yang berisi timestamp expire.
- Backend bikin username + password HMAC-SHA1 (TURN REST API style).
- Client forum call mengambil `iceServers` dari backend, jadi lebih stabil lintas NAT.

