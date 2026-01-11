# AI Navigator Integration Documentation

## Overview
AI Navigator telah diintegrasikan dengan Groq API menggunakan model Llama-3.3-70B-Versatile untuk memberikan respons cerdas dan terlatih tentang website YouTube to MP3 converter.

## Konfigurasi
### Environment Variables
Tambahkan ke file `.env`:
```bash
GROQ_API_KEY=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
GROQ_MODEL=llama-3.3-70b-versatile
```

## Fitur AI Navigator
### 1. Pengetahuan Website
AI telah dilatih untuk memahami semua fitur website:
- Konversi YouTube ke MP3/M4A/FLAC
- Trim audio dengan start/end time
- Metadata ID3 (judul, artis, album)
- Normalisasi audio dan Dolby Atmos
- Antrian processing untuk multiple URLs
- Riwayat download
- Pengaturan backend dan upload cookies
- Dark/light theme toggle

### 2. Commands Khusus
- `/walkthrough` - Memulai panduan langkah demi langkah
- `/faq` - Menampilkan pertanyaan yang sering diajukan

### 3. Respons Cerdas
AI memberikan jawaban yang:
- Helpful dan action-oriented
- Contextual dengan fitur website
- Concise dan mudah dipahami
- Dilengkapi saran relevan

## Implementasi Teknis
### 1. Groq API Integration
```javascript
const callGroqAPI = async (prompt, context = {}) => {
  // Memanggil Groq API dengan model Llama-3.3-70B-Versatile
  // System prompt trained untuk website YouTube to MP3 converter
}
```

### 2. Enhanced Assistant Response
```javascript
const buildAssistantResponse = async (prompt) => {
  // Menggunakan Groq API untuk respons cerdas
  // Fallback ke respons dasar jika API gagal
}
```

### 3. API Endpoint
Endpoint: `POST /api/assistant-chat`
Request: `{ prompt: "string" }`
Response: `{ reply: "string", suggestions: ["string"] }`

## Cara Penggunaan
1. Buka website YouTube to MP3 converter
2. Klik tombol "AI Navigator" di kanan bawah
3. Ketik pertanyaan tentang fitur website
4. AI akan memberikan jawaban cerdas dan saran relevan

## Contoh Pertanyaan
- "Bagaimana cara convert video YouTube?"
- "Apa perbedaan M4A dan MP3?"
- "Cara trim audio?"
- "Bagaimana upload cookies?"
- "Fitur antrian bagaimana cara kerjanya?"

## Training Data
AI telah dilatih dengan informasi:
- Semua fitur website
- Panduan penggunaan step-by-step
- Tips dan trik optimasi
- Troubleshooting common issues

## Error Handling
- Jika Groq API gagal, fallback ke respons dasar
- Error logging untuk monitoring
- Graceful degradation untuk user experience

## Monitoring
Check console logs untuk:
- `[Groq API] Error:` - Error dari API calls
- `[Assistant] Groq API error:` - Error di assistant response

## Future Enhancements
- Context memory untuk percakapan berkelanjutan
- Integration dengan user preferences
- Voice input support
- Multi-language support

## Testing
Untuk testing integration:
1. Start server dengan `npm start`
2. Buka website di browser
3. Test AI Navigator dengan berbagai pertanyaan
4. Verify respons dan suggestions

## Security Notes
- API key disimpan di environment variables
- Rate limiting dari Groq API
- No sensitive data dalam system prompt
- Safe input validation
